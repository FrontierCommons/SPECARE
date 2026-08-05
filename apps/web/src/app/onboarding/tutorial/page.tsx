'use client';

import { useSession } from '../../../state/session';
import { TutorialModal } from '../../../components/TutorialModal';

/**
 * First step a brand-new user hits, before timezone/circle setup. Marking
 * the flag seen is the whole navigation trigger — RootGate reacts to
 * tutorialSeen flipping true and moves on to timezone (or pact, if this
 * device already has a pending circle) on its own.
 */
export default function OnboardingTutorialPage() {
  const { markTutorialSeen } = useSession();
  const finish = () => void markTutorialSeen();
  return <TutorialModal onSkip={finish} onFinish={finish} />;
}
