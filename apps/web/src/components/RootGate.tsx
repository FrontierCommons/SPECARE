'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '../state/session';
import { flushQueue } from '../lib/offlineQueue';
import { color } from '../design/tokens';

const AUTH_PATH = '/auth';
const ROOT_PATH = '/';
const TUTORIAL_PATH = '/onboarding/tutorial';
const ONBOARDING_PATHS = [TUTORIAL_PATH, '/onboarding/timezone', '/onboarding/join', '/onboarding/pact'];
const APP_HOME = '/today';

/**
 * Web port of apps/mobile/src/navigation/RootNavigator.tsx. Mobile has no
 * router — it just renders one of {Auth, loading, Onboarding, Main} based on
 * session state. Here the same decision tree redirects between real routes
 * instead, so URLs stay bookmarkable/refresh-safe. Mounted once in the root
 * layout so every route is covered.
 *
 *   not signed in                          -> /auth
 *   signed in, checking circle status      -> loading
 *   signed in, brand new, tutorial unseen   -> /onboarding/tutorial
 *   signed in, no circle yet                -> /onboarding/timezone
 *   signed in, circle pact unfinished       -> /onboarding/pact
 *   signed in, active circle                -> /today (unless already elsewhere in the app)
 *
 * The tutorial only intercepts a truly first-time user: once they've made
 * any progress (a pendingCircleId, i.e. already past timezone/join) it stops
 * inserting itself, so it can't re-interrupt someone mid-setup just because
 * this device never recorded seeing it.
 */
export function RootGate({ children }: { children: React.ReactNode }) {
  const { ready, user, activeCircleId, pendingCircleId, circlesReady, tutorialSeen } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) void flushQueue(); // best-effort flush of any offline check-ins
  }, [ready, user]);

  const showTutorialFirst = tutorialSeen === false && !pendingCircleId;

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      if (pathname !== AUTH_PATH) router.replace(AUTH_PATH);
      return;
    }

    if (!circlesReady || tutorialSeen === null) return;

    if (!activeCircleId) {
      if (showTutorialFirst) {
        if (pathname !== TUTORIAL_PATH) router.replace(TUTORIAL_PATH);
        return;
      }
      if (!ONBOARDING_PATHS.includes(pathname) || pathname === TUTORIAL_PATH) {
        router.replace(pendingCircleId ? '/onboarding/pact' : '/onboarding/timezone');
      }
      return;
    }

    // Signed in with an active circle — bounce out of auth/onboarding/root routes.
    // The bare root path renders nothing on its own (app/page.tsx), so it must
    // always be bounced somewhere rather than falling through to a blank page.
    if (pathname === AUTH_PATH || pathname === ROOT_PATH || ONBOARDING_PATHS.includes(pathname)) {
      router.replace(APP_HOME);
    }
  }, [ready, user, circlesReady, activeCircleId, pendingCircleId, tutorialSeen, showTutorialFirst, pathname, router]);

  if (!ready) return <Spinner />;
  if (!user) return pathname === AUTH_PATH ? <>{children}</> : <Spinner />;
  if (!circlesReady || tutorialSeen === null) return <Spinner />;
  if (!activeCircleId) {
    if (showTutorialFirst) return pathname === TUTORIAL_PATH ? <>{children}</> : <Spinner />;
    return ONBOARDING_PATHS.includes(pathname) && pathname !== TUTORIAL_PATH ? <>{children}</> : <Spinner />;
  }
  if (pathname === AUTH_PATH || pathname === ROOT_PATH || ONBOARDING_PATHS.includes(pathname)) return <Spinner />;
  return <>{children}</>;
}

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: color.sage, borderTopColor: 'transparent' }}
      />
    </div>
  );
}
