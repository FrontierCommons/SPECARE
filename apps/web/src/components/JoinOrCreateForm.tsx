'use client';

import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';
import { PRESSABLE } from '../design/interaction';

const titleStyle = { ...type.title, color: color.textPrimary };
const bodyStyle = { ...type.body, color: color.textSecondary };
const primaryTextStyle = { ...type.label, color: color.bg, fontWeight: 600 as const };
const errorStyle = { ...type.caption, color: color.statePit };
const tabTextStyle = { ...type.caption, color: color.textSecondary };
const tabTextActiveStyle = { ...type.caption, color: color.textPrimary };
const inputTextStyle = { ...type.body, color: color.textPrimary };

type Mode = 'create' | 'join';

/**
 * Fork: create a circle (become its first member) or join an existing one
 * with a code. Reused both from onboarding (a first-time member's only path
 * to a circle) and from the My Circle screen's "join another circle" flow —
 * same dual-use as apps/mobile/src/screens/onboarding/JoinOrCreateScreen.tsx.
 */
export function JoinOrCreateForm({ onJoined }: { onJoined: (circleId: string) => void }) {
  const [mode, setMode] = useState<Mode>('create');
  const [circleName, setCircleName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setError(null);
    setBusy(true);
    try {
      const circle =
        mode === 'create'
          ? await api.createCircle(circleName.trim())
          : await api.joinCircle({ code: code.trim().toUpperCase() });
      onJoined(circle.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : strings.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-md">
      <h1 style={titleStyle}>{strings.onboarding.joinTitle}</h1>
      <p style={bodyStyle}>{strings.onboarding.joinBody}</p>

      <div className="my-sm flex gap-sm">
        <Tab label={strings.onboarding.createCircle} active={mode === 'create'} onClick={() => setMode('create')} />
        <Tab label={strings.onboarding.joinCircle} active={mode === 'join'} onClick={() => setMode('join')} />
      </div>

      {mode === 'create' ? (
        <input
          placeholder={strings.onboarding.circleName}
          value={circleName}
          onChange={(e) => setCircleName(e.target.value)}
          style={inputTextStyle}
          className="rounded-md border border-border bg-surface p-md placeholder:text-textMuted"
        />
      ) : (
        <input
          placeholder={strings.onboarding.code}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          style={{ ...inputTextStyle, letterSpacing: 6, textAlign: 'center', fontSize: 26 }}
          className="rounded-md border border-border bg-surface p-md placeholder:text-textMuted"
        />
      )}

      {error ? <p style={errorStyle}>{error}</p> : null}

      <button
        onClick={go}
        disabled={busy}
        className={`rounded-md bg-sage p-md text-center disabled:opacity-60 ${PRESSABLE}`}
      >
        <span style={primaryTextStyle}>{mode === 'create' ? strings.onboarding.create : strings.onboarding.join}</span>
      </button>
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-md border p-sm text-center ${PRESSABLE} ${
        active ? 'border-sage bg-surfaceRaised' : 'border-border'
      }`}
    >
      <span style={active ? tabTextActiveStyle : tabTextStyle}>{label}</span>
    </button>
  );
}

export default JoinOrCreateForm;
