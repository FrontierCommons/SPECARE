import React, { useState } from 'react';
import { TimezoneScreen } from '../screens/onboarding/TimezoneScreen';
import { JoinOrCreateScreen } from '../screens/onboarding/JoinOrCreateScreen';
import { CirclePactScreen } from '../screens/onboarding/CirclePactScreen';
import { useSession } from '../state/session';

type Step = 'timezone' | 'join' | 'pact';

/**
 * Linear onboarding: confirm timezone, create/join a circle, agree the pact.
 * On pact agreement the circle becomes active and the app switches to Main.
 *
 * If the server already reports a circle pending only the pact (a returning
 * member who never finished agreeing), we skip straight to that step instead
 * of asking them to pick a timezone and create/join a circle all over again.
 */
export function OnboardingStack() {
  const { setActiveCircle, pendingCircleId } = useSession();
  const [step, setStep] = useState<Step>(pendingCircleId ? 'pact' : 'timezone');
  const [circleId, setCircleId] = useState<string | null>(pendingCircleId ?? null);

  if (step === 'timezone') {
    return <TimezoneScreen onNext={() => setStep('join')} />;
  }
  if (step === 'join') {
    return (
      <JoinOrCreateScreen
        onJoined={(id) => {
          setCircleId(id);
          setStep('pact');
        }}
      />
    );
  }
  return (
    <CirclePactScreen
      circleId={circleId!}
      onAgreed={() => setActiveCircle(circleId!)}
    />
  );
}

export default OnboardingStack;
