'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMembers, useCreateInvite } from '../../../api/hooks';
import { useSession } from '../../../state/session';
import { api } from '../../../api/client';
import { Avatar } from '../../../components/Avatar';
import { JoinOrCreateForm } from '../../../components/JoinOrCreateForm';
import { PactForm } from '../../../components/PactForm';
import { color, type } from '../../../design/tokens';
import { strings } from '../../../design/strings';
import { PRESSABLE } from '../../../design/interaction';

type JoinStep = 'closed' | 'join' | 'pact';

const titleStyle = { ...type.title, color: color.textPrimary };
const linkStyle = { ...type.label, color: color.sage };
const inviteTextStyle = { ...type.label, color: color.sage };
const codeLabelStyle = { ...type.caption, color: color.textSecondary };
const codeStyle = { ...type.display, color: color.textPrimary, letterSpacing: 6 };
const sectionStyle = { ...type.heading, color: color.textPrimary };
const chipTextStyle = { ...type.label, color: color.textSecondary };
const chipTextActiveStyle = { ...type.label, color: color.sage, fontWeight: 600 as const };
const chipAddTextStyle = { ...type.label, color: color.textMuted };
const memberNameStyle = { ...type.heading, color: color.textPrimary };
const memberTzStyle = { ...type.caption, color: color.textMuted };
const pactStyle = { ...type.caption };
const leaveTextStyle = { ...type.label, color: color.textPrimary };

export default function CirclePage() {
  const router = useRouter();
  const { activeCircleId, setActiveCircle, circles, refreshCircles } = useSession();
  const circleId = activeCircleId!;
  const members = useMembers(circleId);
  const invite = useCreateInvite(circleId);
  const [code, setCode] = useState<string | null>(null);
  const [joinStep, setJoinStep] = useState<JoinStep>('closed');
  const [joiningCircleId, setJoiningCircleId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const agreedCircles = circles.filter((c) => c.covenant_agreed);

  const makeInvite = async () => {
    const res = await invite.mutateAsync(undefined);
    setCode(res.code);
    const text = `Join my SPER circle with code: ${res.code}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
      } catch {
        /* user dismissed share sheet */
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(res.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* clipboard unavailable — the code is still shown on screen */
      }
    }
  };

  const leave = async () => {
    await api.leaveCircle(circleId);
    // Let the refreshed list pick the next active circle (another one the
    // member already agreed to, or null if that was their last) rather than
    // forcing null and dropping them into onboarding while they still belong
    // to other circles.
    await refreshCircles();
    router.push('/today');
  };

  if (joinStep === 'join') {
    return (
      <div className="min-h-full bg-bg p-lg">
        <div className="mb-md flex items-center justify-between">
          <button onClick={() => setJoinStep('closed')} className={PRESSABLE}>
            <span style={linkStyle}>‹ Back</span>
          </button>
        </div>
        <JoinOrCreateForm
          onJoined={(id) => {
            setJoiningCircleId(id);
            setJoinStep('pact');
          }}
        />
      </div>
    );
  }

  if (joinStep === 'pact' && joiningCircleId) {
    return (
      <div className="min-h-full bg-bg p-xl">
        <PactForm
          circleId={joiningCircleId}
          onAgreed={async () => {
            await refreshCircles();
            setActiveCircle(joiningCircleId);
            setJoinStep('closed');
            setJoiningCircleId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-bg p-lg">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/today')} className={PRESSABLE}>
          <span style={linkStyle}>‹ Back</span>
        </button>
        <h1 style={titleStyle}>{strings.circle.title}</h1>
        <div className="w-11" />
      </div>

      <div className="mt-md flex flex-col gap-md">
        <p style={sectionStyle}>{strings.circle.yourCircles}</p>
        <div className="flex gap-sm overflow-x-auto py-xs">
          {agreedCircles.map((c) => {
            const active = c.circle_id === circleId;
            return (
              <button
                key={c.circle_id}
                onClick={() => setActiveCircle(c.circle_id)}
                aria-pressed={active}
                className={`shrink-0 rounded-pill border px-md py-xs ${PRESSABLE} ${
                  active ? 'border-sage bg-surfaceRaised' : 'border-border bg-surface'
                }`}
              >
                <span style={active ? chipTextActiveStyle : chipTextStyle}>{c.name}</span>
              </button>
            );
          })}
          <button
            onClick={() => setJoinStep('join')}
            className={`shrink-0 rounded-pill border border-dashed border-border px-md py-xs ${PRESSABLE}`}
          >
            <span style={chipAddTextStyle}>{strings.circle.joinAnother}</span>
          </button>
        </div>

        <button
          onClick={makeInvite}
          className={`rounded-md border border-sage bg-surfaceRaised p-md text-center shadow-sm ${PRESSABLE}`}
        >
          <span style={inviteTextStyle}>{strings.circle.invite}</span>
        </button>
        {code ? (
          <div className="flex flex-col items-center gap-xs rounded-md bg-surface p-md shadow-sm">
            <span style={codeLabelStyle}>{copied ? 'Copied!' : strings.circle.inviteBody}</span>
            <span style={codeStyle}>{code}</span>
          </div>
        ) : null}

        <p style={sectionStyle} className="mt-md">
          {strings.circle.members}
        </p>
        {members.data?.map((m) => (
          <div key={m.user_id} className="flex items-center justify-between rounded-md bg-surface p-md shadow-sm">
            <div className="flex items-center gap-md">
              <Avatar name={m.name} avatarUrl={m.avatar_url} size={40} />
              <div>
                <p style={memberNameStyle}>{m.name}</p>
                <p style={memberTzStyle}>{m.timezone}</p>
              </div>
            </div>
            <span style={{ ...pactStyle, color: m.covenant_agreed ? color.sage : color.textMuted }}>
              {m.covenant_agreed ? strings.circle.pactAgreed : strings.circle.pactPending}
            </span>
          </div>
        ))}

        <button onClick={leave} className={`mt-lg p-md text-center ${PRESSABLE}`}>
          <span style={leaveTextStyle}>{strings.circle.leave}</span>
        </button>
      </div>
    </div>
  );
}
