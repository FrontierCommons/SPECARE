'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as storage from '../lib/storage';
import { api } from '../api/client';
import { resyncPushSubscription } from '../lib/push';
import type { MyCircleDTO, UserDTO } from '@sper/shared-types';

interface SessionState {
  ready: boolean;
  user: UserDTO | null;
  activeCircleId: string | null;
  /** A circle the user already belongs to but hasn't agreed the pact for. */
  pendingCircleId: string | null;
  /** Every circle this user belongs to, agreed or not — lets the UI offer a switcher. */
  circles: MyCircleDTO[];
  /** True once we've asked the server which circle (if any) this user has. */
  circlesReady: boolean;
  /** Null while the local flag is still loading; RootGate waits on that before deciding whether to show the tutorial. */
  tutorialSeen: boolean | null;
  /** Persists the flag and flips the in-memory value in the same tick, so RootGate reacts immediately instead of racing a storage re-read. */
  markTutorialSeen: () => Promise<void>;
  setUser: (u: UserDTO | null) => void;
  setActiveCircle: (id: string | null) => void;
  /** Web-only: lets the onboarding join/create step hand its freshly-created
   * or freshly-joined (pact-not-yet-agreed) circle id to the pact step
   * without inventing a second, query-param-based channel for the same data. */
  setPendingCircle: (id: string | null) => void;
  /** Re-fetch the member's circle list — call after joining or leaving one. */
  refreshCircles: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Deletes the account server-side, then clears local state exactly like signOut. */
  deleteAccount: () => Promise<void>;
}

const CIRCLE_KEY = 'sper.activeCircle';
// Keyed per-account (not a single shared key) so a new sign-up in the same
// browser still gets the tutorial — seeing it once shouldn't stick to the
// device forever if that device later creates a second account.
const tutorialKey = (userId: string) => `sper.tutorialSeen.${userId}`;
const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserDTO | null>(null);
  const [activeCircleId, setActiveCircleId] = useState<string | null>(null);
  const [pendingCircleId, setPendingCircleId] = useState<string | null>(null);
  const [circles, setCircles] = useState<MyCircleDTO[]>([]);
  const [circlesReady, setCirclesReady] = useState(false);
  const [tutorialSeen, setTutorialSeen] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const signedIn = await api.isSignedIn();
      if (signedIn) {
        try {
          setUser(await api.me());
        } catch {
          // Stored tokens no longer resolve to an account — treat as signed out.
          await api.signOut();
        }
      }
      setReady(true);
    })();
  }, []);

  // If this browser already has a push subscription (from a previous
  // explicit opt-in), re-point it at whoever's signed in now — otherwise a
  // second account on a shared browser would keep sending pushes to the
  // first account's session. Never prompts for permission on its own.
  useEffect(() => {
    if (user?.id) void resyncPushSubscription();
  }, [user?.id]);

  // Re-checked whenever the signed-in account changes — signing out and
  // creating a second account in the same browser must not inherit the
  // first account's "already seen" flag.
  useEffect(() => {
    if (!user) {
      setTutorialSeen(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const seen = (await storage.getItem(tutorialKey(user.id))) != null;
      if (!cancelled) setTutorialSeen(seen);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const markTutorialSeen = useCallback(async () => {
    if (!user) return;
    setTutorialSeen(true); // flip immediately so RootGate's redirect effect doesn't race the storage write
    await storage.setItem(tutorialKey(user.id), '1');
  }, [user]);

  // Fetches this user's full circle list and picks which one is active.
  // A previously-selected circle (persisted locally) wins as long as it's
  // still one the user has agreed the pact for — this is what lets a member
  // belong to several circles and have their last-viewed one stick across
  // sessions instead of always snapping back to the most recently joined.
  const loadCircles = useCallback(async () => {
    try {
      const list = await api.myCircles();
      setCircles(list);
      const agreedList = list.filter((c) => c.covenant_agreed);
      if (agreedList.length > 0) {
        const stored = await storage.getItem(CIRCLE_KEY);
        const keep =
          stored && agreedList.some((c) => c.circle_id === stored)
            ? stored
            : agreedList[0]!.circle_id;
        setActiveCircleId(keep);
        setPendingCircleId(null);
        void storage.setItem(CIRCLE_KEY, keep);
      } else if (list.length > 0) {
        setActiveCircleId(null);
        setPendingCircleId(list[0]!.circle_id);
      } else {
        setActiveCircleId(null);
        setPendingCircleId(null);
        void storage.removeItem(CIRCLE_KEY);
      }
    } catch {
      // Offline or the request failed — fall back to the last known circle
      // rather than forcing onboarding just because we couldn't reach the API.
      const stored = await storage.getItem(CIRCLE_KEY);
      if (stored) setActiveCircleId(stored);
    }
  }, []);

  // Whenever someone becomes signed in — cold boot, login, register, magic
  // link, or password reset — ask the server which circle(s) (if any) they
  // already belong to. A returning member should never be asked to pick a
  // timezone and start a circle again just because this device's local
  // cache is empty; only a truly first-time user reaches onboarding.
  useEffect(() => {
    if (!user) {
      setCirclesReady(false);
      setActiveCircleId(null);
      setPendingCircleId(null);
      setCircles([]);
      return;
    }
    let cancelled = false;
    (async () => {
      await loadCircles();
      if (!cancelled) setCirclesReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loadCircles]);

  const setActiveCircle = useCallback((id: string | null) => {
    setActiveCircleId(id);
    setPendingCircleId(null);
    if (id) void storage.setItem(CIRCLE_KEY, id);
    else void storage.removeItem(CIRCLE_KEY);
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
    await storage.removeItem(CIRCLE_KEY);
    setUser(null);
    setActiveCircleId(null);
    setPendingCircleId(null);
    setCircles([]);
  }, []);

  const deleteAccount = useCallback(async () => {
    await api.deleteAccount();
    await api.signOut(); // clears local tokens — the account is already gone server-side
    await storage.removeItem(CIRCLE_KEY);
    setUser(null);
    setActiveCircleId(null);
    setPendingCircleId(null);
    setCircles([]);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        ready,
        user,
        activeCircleId,
        pendingCircleId,
        circles,
        circlesReady,
        tutorialSeen,
        markTutorialSeen,
        setUser,
        setActiveCircle,
        setPendingCircle: setPendingCircleId,
        refreshCircles: loadCircles,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
