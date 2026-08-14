'use client';

import { useRef, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { useSession } from '../../state/session';
import { color, type } from '../../design/tokens';
import { strings } from '../../design/strings';
import { PRESSABLE } from '../../design/interaction';

type Mode = 'signin' | 'signup' | 'reset';

const titleStyle = { ...type.display, color: color.textPrimary, letterSpacing: 4 };
const taglineStyle = { ...type.body, color: color.textSecondary };
const verseStyle = { ...type.body, color: color.sageText, fontFamily: 'var(--font-display), Georgia, serif' };
const headingStyle = { ...type.title, color: color.textPrimary };
const bodyStyle = { ...type.body, color: color.textSecondary };
const labelStyle = { ...type.caption, color: color.textSecondary };
const inputTextStyle = { ...type.body, color: color.textPrimary };
const primaryTextStyle = { ...type.label, color: color.ink, fontWeight: 600 as const };
const linkStyle = { ...type.label, color: color.sageText };
const linkSubtleStyle = { ...type.caption, color: color.textMuted };
// Real red, not the muted mood-state plum — an auth failure is an actual
// error, not a feelings display, and needs to read clearly distinct from
// the sage-green info text below it.
const errorStyle = { ...type.caption, color: color.destructive, fontWeight: 600 as const };
const infoStyle = { ...type.caption, color: color.sageText };

export default function AuthPage() {
  const { setUser } = useSession();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const [resetSent, setResetSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const formRef = useRef<HTMLFormElement>(null);

  /**
   * Reads a field straight off the DOM instead of trusting React state.
   * Chrome/Edge's "suggest a strong password" autofill sometimes sets the
   * input's value without firing a change event React can see, so state can
   * go stale while the field visibly (and correctly) holds the generated
   * password — submitting the stale state then fails backend validation.
   * The live DOM value is always what's actually about to be submitted.
   */
  const liveValue = (fieldName: string, fallback: string): string => {
    const el = formRef.current?.elements.namedItem(fieldName);
    return el instanceof HTMLInputElement ? el.value : fallback;
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
      const liveEmail = liveValue('email', email);
      const livePassword = liveValue('password', password);
      const res =
        mode === 'signup'
          ? await api.register({
              name: liveValue('name', name),
              email: liveEmail,
              password: livePassword,
              timezone: tz,
            })
          : await api.login({ email: liveEmail, password: livePassword });
      setUser(res.user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : strings.common.error);
    } finally {
      setBusy(false);
    }
  };

  const magic = async () => {
    setError(null);
    try {
      await api.requestMagicLink(liveValue('email', email));
      setMagicSent(true);
    } catch {
      setMagicSent(true); // never reveal whether the email exists
    }
  };

  const enterReset = () => {
    setError(null);
    setResetSent(false);
    setResetCode('');
    setNewPassword('');
    setMode('reset');
  };

  const requestReset = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.requestPasswordReset(liveValue('email', email));
    } catch {
      // never reveal whether the email exists
    } finally {
      setResetSent(true);
      setBusy(false);
    }
  };

  const confirmReset = async () => {
    setError(null);
    setBusy(true);
    try {
      const code = liveValue('resetCode', resetCode).trim();
      const pw = liveValue('newPassword', newPassword);
      const res = await api.confirmPasswordReset(code, pw);
      setUser(res.user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : strings.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full">
      {/* Full-bleed at every viewport size — the old "hidden md:block" split
          meant mobile visitors (most of them) never saw this at all and got
          a flat panel instead. Fixed so it holds still as the form scrolls
          over it on short viewports. */}
      <div
        aria-hidden
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/background2.avif')" }}
      />
      {/* Scrim: transparent over the photo's left/top so it still reads as
          a picture, deepening toward the bottom-right where the form sits —
          the contrast that makes the card the obvious thing to look at,
          on a phone-width screen just as much as a desktop one. Painting
          order here comes from DOM order (photo, then scrim, then content)
          rather than z-index — negative z-index on a fixed root-level
          element ends up composited behind the canvas background in some
          engines, which silently hid this whole layer. Mixed from
          --color-bg rather than a hardcoded dark rgba so it deepens toward
          whichever theme's card is actually sitting on top of it (near-black
          in dark mode, warm cream in light mode) instead of always fading to
          black behind a bright card. */}
      <div
        aria-hidden
        className="fixed inset-0"
        style={{
          background:
            'linear-gradient(125deg, color-mix(in srgb, var(--color-bg) 25%, transparent) 0%, color-mix(in srgb, var(--color-bg) 70%, transparent) 42%, color-mix(in srgb, var(--color-bg) 95%, transparent) 68%)',
        }}
      />
      <div className="relative z-10 flex min-h-screen items-center justify-center overflow-y-auto p-lg">
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === 'reset') void (resetSent ? confirmReset() : requestReset());
            else void submit();
          }}
          className="animate-fade-in-up flex w-full max-w-md flex-col gap-md rounded-lg p-lg shadow-lg backdrop-blur-md md:p-xl"
          style={{
            // Tailwind's opacity-modifier classes (bg-surface/85) can't blend
            // alpha correctly once these tokens resolve through CSS
            // variables — color-mix() does the same "frosted" effect
            // directly, and stays theme-reactive for free.
            backgroundColor: 'color-mix(in srgb, var(--color-surface) 85%, transparent)',
            borderWidth: 1,
            borderColor: 'color-mix(in srgb, var(--color-border) 60%, transparent)',
          }}
        >
          <div className="mb-sm flex flex-col gap-sm">
            <h1 style={titleStyle}>
              <span aria-hidden style={{ marginRight: 8 }}>
                🌿
              </span>
              {strings.app.name}
            </h1>
            <p style={taglineStyle}>{strings.app.tagline}</p>
          </div>

          <p style={bodyStyle}>{strings.auth.pitchBody}</p>

          <p style={verseStyle} className="mb-sm border-l-2 border-sage py-xs pl-md italic">
            {strings.auth.verse}
          </p>

          {mode === 'reset' ? (
            <>
              <h2 style={headingStyle}>{strings.auth.resetTitle}</h2>
              <p style={bodyStyle}>{resetSent ? strings.auth.resetSent : strings.auth.resetBody}</p>

              <Field
                name="email"
                label={strings.auth.email}
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
                disabled={resetSent}
              />

              {resetSent ? (
                <>
                  <Field
                    name="resetCode"
                    label={strings.auth.resetCode}
                    value={resetCode}
                    onChange={setResetCode}
                  />
                  <Field
                    name="newPassword"
                    label={strings.auth.newPassword}
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={setNewPassword}
                  />
                </>
              ) : null}

              {error ? <p style={errorStyle}>{error}</p> : null}

              <button
                type="submit"
                disabled={busy}
                className={`mt-sm rounded-md bg-sage p-md text-center shadow-sm disabled:opacity-60 ${PRESSABLE}`}
              >
                <span style={primaryTextStyle}>
                  {resetSent ? strings.auth.resetPasswordCta : strings.auth.sendResetCode}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`py-sm text-center ${PRESSABLE}`}
              >
                <span style={linkStyle}>{strings.auth.backToSignIn}</span>
              </button>
            </>
          ) : (
            <>
              <h2 style={headingStyle}>{mode === 'signup' ? strings.auth.signUpTitle : strings.auth.signInTitle}</h2>

              {mode === 'signup' && (
                <Field
                  name="name"
                  label={strings.auth.name}
                  value={name}
                  onChange={setName}
                  autoComplete="name"
                />
              )}
              <Field
                name="email"
                label={strings.auth.email}
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
              />
              <Field
                name="password"
                label={strings.auth.password}
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={setPassword}
              />

              {mode === 'signin' ? (
                <button type="button" onClick={enterReset} className={`text-right ${PRESSABLE}`}>
                  <span style={linkSubtleStyle}>{strings.auth.forgotPassword}</span>
                </button>
              ) : null}

              {error ? <p style={errorStyle}>{error}</p> : null}
              {magicSent ? <p style={infoStyle}>Check your email for a sign-in link.</p> : null}

              <button
                type="submit"
                disabled={busy}
                className={`mt-sm rounded-md bg-sage p-md text-center shadow-sm disabled:opacity-60 ${PRESSABLE}`}
              >
                <span style={primaryTextStyle}>{mode === 'signup' ? strings.auth.signUp : strings.auth.signIn}</span>
              </button>

              <button type="button" onClick={magic} className={`py-sm text-center ${PRESSABLE}`}>
                <span style={linkStyle}>{strings.auth.magicLink}</span>
              </button>

              <button
                type="button"
                onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                className={`py-sm text-center ${PRESSABLE}`}
              >
                <span style={linkStyle}>
                  {mode === 'signup' ? strings.auth.toggleToSignIn : strings.auth.toggleToSignUp}
                </span>
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  value,
  onChange,
  type: inputType = 'text',
  autoComplete,
  disabled,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-xs">
      <span style={labelStyle}>{label}</span>
      <input
        name={name}
        type={inputType}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={inputTextStyle}
        className="rounded-md border border-border bg-surface p-md placeholder:text-textMuted disabled:opacity-60"
      />
    </label>
  );
}
