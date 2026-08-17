import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useSession } from '../state/session';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { OnboardingStack } from './OnboardingStack';
import { MainSwitcher } from './MainSwitcher';
import { TutorialModal } from '../components/TutorialModal';
import { flushQueue } from '../lib/offlineQueue';
import { color } from '../design/tokens';

/**
 * Top-level flow:
 *   not signed in                        -> Auth
 *   signed in, checking circle/flag status -> loading
 *   signed in, no circle, tutorial unseen  -> first-run Tutorial
 *   signed in, circle pact unfinished      -> Onboarding, straight to the pact
 *   signed in, no circle, deferred         -> Main (screens show their own empty state)
 *   signed in, no circle otherwise         -> Onboarding, from timezone
 *   signed in, active circle               -> Main (4 destinations)
 * The circle check always asks the server (see session.tsx) so a returning
 * member on a fresh device skips straight to Main instead of re-onboarding.
 */
export function RootNavigator() {
  const { ready, user, activeCircleId, pendingCircleId, circlesReady, tutorialSeen, onboardingDeferred, markTutorialSeen } =
    useSession();

  useEffect(() => {
    if (ready && user) void flushQueue(); // best-effort flush of any offline check-ins
  }, [ready, user]);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.sage} />
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!circlesReady || tutorialSeen === null || onboardingDeferred === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.sage} />
      </View>
    );
  }

  if (!activeCircleId) {
    if (tutorialSeen === false && !pendingCircleId) {
      return <TutorialModal onSkip={() => void markTutorialSeen()} onFinish={() => void markTutorialSeen()} />;
    }
    if (!pendingCircleId && onboardingDeferred) {
      return <MainSwitcher />;
    }
    return <OnboardingStack />;
  }

  return <MainSwitcher />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' },
});

export default RootNavigator;
