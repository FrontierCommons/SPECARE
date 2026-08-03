'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as storage from '../lib/storage';
import { api } from '../api/client';
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
  setUser: (u: UserDTO | null) => void;
  setActiveCircle: (id: string | null) => void;
  /** Web-only: lets the onboarding join/create step hand its freshly-created
   * or freshly-joined (pact-not-yet-agreed) circle id to the pact step
   * without inventing a second, query-param-based channel for the same data. */
  setPendingCircle: (id: string | null) => void;
  /** Re-fetch the member's circle list — call after joining or leaving one. */
  refreshCircles: () => Promise<void>;
  signOut: () => Promise<void>;
}

const CIRCLE_KEY = 'sper.activeCircle';
const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserDTO | null>(null);
  const [activeCircleId, setActiveCircleId] = useState<string | null>(null);
  const [pendingCircleId, setPendingCircleId] = useState<string | null>(null);
  const [circles, setCircles] = useState<MyCircleDTO[]>([]);
  const [circlesReady, setCirclesReady] = useState(false);

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

  return (
    <SessionContext.Provider
      value={{
        ready,
        user,
        activeCircleId,
        pendingCircleId,
        circles,
        circlesReady,
        setUser,
        setActiveCircle,
        setPendingCircle: setPendingCircleId,
        refreshCircles: loadCircles,
        signOut,
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
