'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../api/client';
import { useSession } from '../../../state/session';
import { timezoneOptions, labelWithOffset } from '../../../lib/timezones';
import { color, type } from '../../../design/tokens';
import { strings } from '../../../design/strings';
import { PRESSABLE } from '../../../design/interaction';

const titleStyle = { ...type.title, color: color.textPrimary };
const bodyStyle = { ...type.body, color: color.textSecondary };
const tzTextStyle = { ...type.heading, color: color.sageText };
const primaryTextStyle = { ...type.label, color: color.ink, fontWeight: 600 as const };
const linkStyle = { ...type.label, color: color.sageText };
const selectTextStyle = { ...type.body, color: color.textPrimary };

/**
 * Two distinct moments, not one screen with everything at once: first pick a
 * timezone, THEN — separately — see the note about what that means (the
 * daily nudge time). Confirming a pick also syncs it to the account, so
 * changing your mind here isn't stuck with whatever the device guessed.
 */
export default function TimezonePage() {
  const { user, setUser, pendingCircleId } = useSession();
  const router = useRouter();

  // A returning member who already has a circle pending only the pact
  // shouldn't be asked to pick a timezone and start over.
  useEffect(() => {
    if (pendingCircleId) router.replace('/onboarding/pact');
  }, [pendingCircleId, router]);

  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const initial = user?.timezone || deviceTz;
  const options = useMemo(() => timezoneOptions(initial), [initial]);

  const [selected, setSelected] = useState(initial);
  const [confirmedTz, setConfirmedTz] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      if (user && selected !== user.timezone) {
        setUser(await api.updateProfile({ timezone: selected }));
      }
    } catch {
      // Keep the local pick even if the sync failed — it'll sync next update.
    } finally {
      setBusy(false);
      setConfirmedTz(selected);
    }
  };

  if (confirmedTz) {
    return (
      <div className="sper-warm-glow mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-md bg-bg p-lg">
        <div className="animate-fade-in-up flex flex-col gap-md">
          <h1 style={titleStyle}>{strings.onboarding.timezoneTitle}</h1>
          <div className="w-fit rounded-md border border-border bg-surface p-md shadow-md">
            <span style={tzTextStyle}>
              {labelWithOffset(options.find((z) => z.value === confirmedTz) ?? { value: confirmedTz, label: confirmedTz })}
            </span>
          </div>
          <p style={bodyStyle}>{strings.onboarding.timezoneBody}</p>
          <button
            onClick={() => router.push('/onboarding/join')}
            className={`mt-md rounded-md bg-sage p-md text-center shadow-sm ${PRESSABLE}`}
          >
            <span style={primaryTextStyle}>{strings.onboarding.looksRight}</span>
          </button>
          <button onClick={() => setConfirmedTz(null)} className={`py-sm text-center ${PRESSABLE}`}>
            <span style={linkStyle}>{strings.onboarding.changeTimezone}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sper-warm-glow mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-md bg-bg p-lg">
      <div className="animate-fade-in-up flex flex-col gap-md">
        <h1 style={titleStyle}>{strings.onboarding.timezoneTitle}</h1>
        <p style={bodyStyle}>{strings.onboarding.timezonePrompt}</p>

        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-md border border-border bg-surface p-md"
          style={selectTextStyle}
        >
          {options.map((z) => (
            <option key={z.value} value={z.value}>
              {labelWithOffset(z)}
            </option>
          ))}
        </select>

        <button
          onClick={confirm}
          disabled={busy}
          className={`mt-md rounded-md bg-sage p-md text-center shadow-sm disabled:opacity-60 ${PRESSABLE}`}
        >
          <span style={primaryTextStyle}>{strings.onboarding.confirmTimezone}</span>
        </button>
      </div>
    </div>
  );
}
