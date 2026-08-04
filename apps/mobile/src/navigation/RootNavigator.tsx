import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useSession } from '../state/session';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { OnboardingStack } from './OnboardingStack';
import { MainSwitcher } from './MainSwitcher';
import { flushQueue } from '../lib/offlineQueue';
import { color } from '../design/tokens';

/**
 * Top-level flow:
 *   not signed in                      -> Auth
 *   signed in, checking circle status  -> loading
 *   signed in, no circle yet at all    -> Onboarding, from timezone
 *   signed in, circle pact unfinished  -> Onboarding, straight to the pact
 *   signed in, active circle           -> Main (4 destinations)
 * The circle check always asks the server (see session.tsx) so a returning
 * member on a fresh device skips straight to Main instead of re-onboarding.
 */
export function RootNavigator() {
  const { ready, user, activeCircleId, circlesReady } = useSession();

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

  if (!circlesReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.sage} />
      </View>
    );
  }

  if (!activeCircleId) {
    return <OnboardingStack />;
  }

  return <MainSwitcher />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' },
});

export default RootNavigator;
