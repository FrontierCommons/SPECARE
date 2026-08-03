'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../api/client';
import { useSession } from '../../../state/session';
import { timezoneOptions, labelForTimezone } from '../../../lib/timezones';
import { color, type } from '../../../design/tokens';
import { strings } from '../../../design/strings';

const titleStyle = { ...type.title, color: color.textPrimary };
const bodyStyle = { ...type.body, color: color.textSecondary };
const tzTextStyle = { ...type.heading, color: color.sage };
const primaryTextStyle = { ...type.label, color: color.bg, fontWeight: 600 as const };
const linkStyle = { ...type.label, color: color.sage };
const rowTextStyle = { ...type.body, color: color.textSecondary };
const rowTextActiveStyle = { ...type.body, color: color.sage, fontWeight: 600 as const };

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
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-md bg-bg p-lg">
        <h1 style={titleStyle}>{strings.onboarding.timezoneTitle}</h1>
        <div className="w-fit rounded-md border border-border bg-surface p-md">
          <span style={tzTextStyle}>{labelForTimezone(confirmedTz, options)}</span>
        </div>
        <p style={bodyStyle}>{strings.onboarding.timezoneBody}</p>
        <button
          onClick={() => router.push('/onboarding/join')}
          className="mt-md rounded-md bg-sage p-md text-center"
        >
          <span style={primaryTextStyle}>{strings.onboarding.looksRight}</span>
        </button>
        <button onClick={() => setConfirmedTz(null)} className="py-sm text-center">
          <span style={linkStyle}>{strings.onboarding.changeTimezone}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-md bg-bg p-lg">
      <h1 style={titleStyle}>{strings.onboarding.timezoneTitle}</h1>
      <p style={bodyStyle}>{strings.onboarding.timezonePrompt}</p>

      <div className="flex flex-1 flex-col gap-xs overflow-y-auto py-xs">
        {options.map((z) => {
          const active = selected === z.value;
          return (
            <button
              key={z.value}
              onClick={() => setSelected(z.value)}
              aria-pressed={active}
              className={`rounded-md border p-md text-left ${
                active ? 'border-sage bg-surfaceRaised' : 'border-border bg-surface'
              }`}
            >
              <span style={active ? rowTextActiveStyle : rowTextStyle}>{z.label}</span>
            </button>
          );
        })}
      </div>

      <button onClick={confirm} disabled={busy} className="mt-md rounded-md bg-sage p-md text-center">
        <span style={primaryTextStyle}>{strings.onboarding.confirmTimezone}</span>
      </button>
    </div>
  );
}
