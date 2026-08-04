'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '../../../state/session';
import { JoinOrCreateForm } from '../../../components/JoinOrCreateForm';

export default function JoinPage() {
  const router = useRouter();
  const { setPendingCircle } = useSession();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center bg-bg p-lg">
      <JoinOrCreateForm
        onJoined={(circleId) => {
          setPendingCircle(circleId);
          router.push('/onboarding/pact');
        }}
      />
    </div>
  );
}
