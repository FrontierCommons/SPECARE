'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '../../../state/session';
import { JoinOrCreateForm } from '../../../components/JoinOrCreateForm';
import { PRESSABLE } from '../../../design/interaction';
import { color, type } from '../../../design/tokens';
import { strings } from '../../../design/strings';

const doLaterTextStyle = { ...type.label, color: color.textPrimary };

export default function JoinPage() {
  const router = useRouter();
  const { setPendingCircle, markOnboardingDeferred } = useSession();

  return (
    <div className="sper-warm-glow relative mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center bg-bg p-lg">
      <button
        onClick={() => {
          // Lets RootGate stop routing here on future visits, instead of
          // bouncing back into onboarding.
          void markOnboardingDeferred();
          router.push('/today');
        }}
        className={`absolute right-lg top-lg rounded-pill border border-border px-md py-xs ${PRESSABLE}`}
      >
        <span style={doLaterTextStyle}>{strings.onboarding.doLater}</span>
      </button>
      <div className="animate-fade-in-up">
        <JoinOrCreateForm
          onJoined={(circleId) => {
            setPendingCircle(circleId);
            router.push('/onboarding/pact');
          }}
        />
      </div>
    </div>
  );
}
