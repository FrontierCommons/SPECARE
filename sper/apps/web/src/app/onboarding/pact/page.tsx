'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../../../state/session';
import { PactForm } from '../../../components/PactForm';

export default function PactPage() {
  const router = useRouter();
  const { pendingCircleId, setActiveCircle } = useSession();

  // No circle id to agree to (e.g. a direct navigation here) — send back to
  // the step that produces one.
  useEffect(() => {
    if (!pendingCircleId) router.replace('/onboarding/join');
  }, [pendingCircleId, router]);

  if (!pendingCircleId) return null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center bg-bg p-xl">
      <PactForm
        circleId={pendingCircleId}
        onAgreed={() => setActiveCircle(pendingCircleId)} // RootGate takes it from here, to /today
      />
    </div>
  );
}
