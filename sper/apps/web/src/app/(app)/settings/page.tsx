'use client';

import { useState } from 'react';
import type { CheckInFrequency } from '@sper/shared-types';
import { useSession } from '../../../state/session';
import { useUpdateProfile } from '../../../api/hooks';
import { Avatar } from '../../../components/Avatar';
import { color, type } from '../../../design/tokens';
import { strings } from '../../../design/strings';

const FREQUENCIES: { value: CheckInFrequency; label: string }[] = [
  { value: 'once', label: strings.settings.frequencyOnce },
  { value: 'twice', label: strings.settings.frequencyTwice },
  { value: 'thrice', label: strings.settings.frequencyThrice },
];

const titleStyle = { ...type.display, color: color.textPrimary };
const nameStyle = { ...type.heading, color: color.textPrimary };
const emailStyle = { ...type.caption, color: color.textMuted };
const rowLabelStyle = { ...type.label, color: color.textPrimary };
const rowBodyStyle = { ...type.caption, color: color.textMuted };
const rowValueStyle = { ...type.body, color: color.sage };
const segmentTextStyle = { ...type.caption, color: color.textSecondary };
const segmentTextActiveStyle = { ...type.caption, color: color.sage, fontWeight: 600 as const };
const linkTextStyle = { ...type.label, color: color.sage };
const pactTextStyle = { ...type.body, color: color.textSecondary };
const signOutTextStyle = { ...type.label, color: color.statePit };
const versionStyle = { ...type.caption, color: color.textMuted };

/**
 * Everything that isn't the daily rhythm lives here: who you are, whether the
 * nudge is on, and the door out — of the account, not of the circle (that
 * stays a deliberate, separate action on My Circle).
 */
export default function SettingsPage() {
  const { user, setUser, signOut } = useSession();
  const updateProfile = useUpdateProfile();
  const [showPact, setShowPact] = useState(false);

  if (!user) return null;

  const togglePause = () => {
    const paused = !user.notifications_paused;
    setUser({ ...user, notifications_paused: paused }); // optimistic
    updateProfile.mutate(
      { notifications_paused: paused },
      { onError: () => setUser({ ...user, notifications_paused: !paused }) },
    );
  };

  const setFrequency = (frequency: CheckInFrequency) => {
    const previous = user.checkin_frequency;
    setUser({ ...user, checkin_frequency: frequency }); // optimistic
    updateProfile.mutate(
      { checkin_frequency: frequency },
      { onError: () => setUser({ ...user, checkin_frequency: previous }) },
    );
  };

  return (
    <div className="min-h-full bg-bg p-lg">
      <div className="flex flex-col gap-md">
        <h1 style={titleStyle}>{strings.settings.title}</h1>

        <div className="flex items-center gap-md rounded-md bg-surface p-md shadow-sm">
          <Avatar name={user.name} avatarUrl={user.avatar_url} size={56} />
          <div>
            <p style={nameStyle}>{user.name}</p>
            <p style={emailStyle}>{user.email}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-md rounded-md bg-surface p-md shadow-sm">
          <div className="flex-1">
            <p style={rowLabelStyle}>{strings.settings.pauseNudge}</p>
            <p style={rowBodyStyle}>{strings.settings.notificationsBody}</p>
          </div>
          <button
            role="switch"
            aria-checked={user.notifications_paused}
            onClick={togglePause}
            className="relative h-6 w-11 shrink-0 rounded-pill transition-colors"
            style={{ backgroundColor: user.notifications_paused ? color.sage : color.border }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full transition-all duration-200"
              style={{
                left: user.notifications_paused ? '22px' : '2px',
                backgroundColor: color.textPrimary,
              }}
            />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-md bg-surface p-md shadow-sm">
          <span style={rowLabelStyle}>{strings.settings.timezone}</span>
          <span style={rowValueStyle}>{user.timezone}</span>
        </div>

        <div className="rounded-md bg-surface p-md shadow-sm">
          <p style={rowLabelStyle}>{strings.settings.frequency}</p>
          <p style={rowBodyStyle}>{strings.settings.frequencyBody}</p>
          <div className="mt-sm flex gap-sm">
            {FREQUENCIES.map((f) => {
              const active = user.checkin_frequency === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFrequency(f.value)}
                  aria-pressed={active}
                  className={`flex-1 rounded-md border py-sm text-center ${
                    active ? 'border-sage bg-surfaceRaised' : 'border-border'
                  }`}
                >
                  <span style={active ? segmentTextActiveStyle : segmentTextStyle}>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button onClick={() => setShowPact((v) => !v)} className="flex items-center justify-between py-sm">
          <span style={linkTextStyle}>{strings.settings.viewPact}</span>
          <span style={{ color: color.sage }}>{showPact ? '︿' : '﹀'}</span>
        </button>
        {showPact ? (
          <div className="-mt-sm rounded-md bg-surfaceRaised p-md">
            <p style={pactTextStyle}>{strings.pact.body}</p>
          </div>
        ) : null}

        <button onClick={signOut} className="mt-lg p-md text-center">
          <span style={signOutTextStyle}>{strings.settings.signOut}</span>
        </button>

        <p style={versionStyle} className="text-center">
          {strings.settings.version}
        </p>
      </div>
    </div>
  );
}
