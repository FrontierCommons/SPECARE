'use client';

import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';
import { PRESSABLE } from '../design/interaction';

const eyebrowStyle = { ...type.caption, color: color.sage, letterSpacing: 2, textTransform: 'uppercase' as const };
const covenantStyle = { ...type.display, color: color.textPrimary, fontSize: 32, lineHeight: '44px' };
const subtextStyle = { ...type.body, color: color.textSecondary };
const checkboxLabelStyle = { ...type.body, color: color.textSecondary };
const primaryTextStyle = { ...type.label, color: color.bg, fontWeight: 600 as const };
const errorStyle = { ...type.caption, color: color.statePit };

/**
 * The covenant gate. No circle content is reachable until the member agrees.
 * Reused both from onboarding and from the My Circle screen's "join another
 * circle" flow — same dual-use as
 * apps/mobile/src/screens/onboarding/CirclePactScreen.tsx.
 */
export function PactForm({ circleId, onAgreed }: { circleId: string; onAgreed: () => void }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agree = async () => {
    if (!checked) return;
    setBusy(true);
    setError(null);
    try {
      await api.agreePact(circleId);
      onAgreed();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : strings.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-lg">
      <span style={eyebrowStyle}>{strings.pact.title}</span>
      <p style={covenantStyle}>{strings.pact.body}</p>
      <p style={subtextStyle}>{strings.pact.subtext}</p>

      <button
        onClick={() => setChecked((c) => !c)}
        role="checkbox"
        aria-checked={checked}
        className={`flex items-center gap-sm text-left ${PRESSABLE}`}
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-sm border-[1.5px] ${
            checked ? 'border-sage bg-sage' : 'border-border'
          }`}
        >
          {checked ? <span className="text-sm font-bold text-bg">✓</span> : null}
        </span>
        <span style={checkboxLabelStyle} className="flex-1">
          {strings.pact.checkboxLabel}
        </span>
      </button>

      {error ? <p style={errorStyle}>{error}</p> : null}

      <button
        onClick={agree}
        disabled={busy || !checked}
        className={`rounded-md p-md text-center ${PRESSABLE} ${checked ? 'bg-sage' : 'bg-border'}`}
      >
        <span style={primaryTextStyle}>{strings.pact.agree}</span>
      </button>
    </div>
  );
}

export default PactForm;
