'use client';

import { useState } from 'react';
import { api, ApiError } from '../../api/client';
import { useSession } from '../../state/session';
import { color, type } from '../../design/tokens';
import { strings } from '../../design/strings';

type Mode = 'signin' | 'signup' | 'reset';

const titleStyle = { ...type.display, color: color.textPrimary, letterSpacing: 4 };
const taglineStyle = { ...type.body, color: color.textSecondary };
const headingStyle = { ...type.title, color: color.textPrimary };
const bodyStyle = { ...type.body, color: color.textSecondary };
const labelStyle = { ...type.caption, color: color.textSecondary };
const inputTextStyle = { ...type.body, color: color.textPrimary };
const primaryTextStyle = { ...type.label, color: color.bg, fontWeight: 600 as const };
const linkStyle = { ...type.label, color: color.sage };
const linkSubtleStyle = { ...type.caption, color: color.textMuted };
const errorStyle = { ...type.caption, color: color.statePit };
const infoStyle = { ...type.caption, color: color.sage };

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

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
      const res =
        mode === 'signup'
          ? await api.register({ name, email, password, timezone: tz })
          : await api.login({ email, password });
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
      await api.requestMagicLink(email);
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
      await api.requestPasswordReset(email);
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
      const res = await api.confirmPasswordReset(resetCode.trim(), newPassword);
      setUser(res.user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : strings.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="relative min-h-screen bg-bg bg-cover bg-center"
      style={{ backgroundImage: "url('/images/background.jpg')" }}
    >
      {/* A light wash, not a dark one — brightens the photo instead of hiding it. */}
      <div className="absolute inset-0 bg-white opacity-[0.08]" />
      <div className="relative flex min-h-screen items-center justify-center overflow-y-auto p-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === 'reset') void (resetSent ? confirmReset() : requestReset());
            else void submit();
          }}
          className="flex w-full max-w-md flex-col gap-md"
        >
          <h1 style={titleStyle}>{strings.app.name}</h1>
          <p style={taglineStyle} className="mb-lg">
            {strings.app.tagline}
          </p>

          {mode === 'reset' ? (
            <>
              <h2 style={headingStyle}>{strings.auth.resetTitle}</h2>
              <p style={bodyStyle}>{resetSent ? strings.auth.resetSent : strings.auth.resetBody}</p>

              <Field
                label={strings.auth.email}
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
                disabled={resetSent}
              />

              {resetSent ? (
                <>
                  <Field label={strings.auth.resetCode} value={resetCode} onChange={setResetCode} />
                  <Field
                    label={strings.auth.newPassword}
                    type="password"
                    value={newPassword}
                    onChange={setNewPassword}
                  />
                </>
              ) : null}

              {error ? <p style={errorStyle}>{error}</p> : null}

              <button type="submit" disabled={busy} className="mt-sm rounded-md bg-sage p-md text-center">
                <span style={primaryTextStyle}>
                  {resetSent ? strings.auth.resetPasswordCta : strings.auth.sendResetCode}
                </span>
              </button>

              <button type="button" onClick={() => setMode('signin')} className="py-sm text-center">
                <span style={linkStyle}>{strings.auth.backToSignIn}</span>
              </button>
            </>
          ) : (
            <>
              <h2 style={headingStyle}>{mode === 'signup' ? strings.auth.signUpTitle : strings.auth.signInTitle}</h2>

              {mode === 'signup' && (
                <Field label={strings.auth.name} value={name} onChange={setName} autoComplete="name" />
              )}
              <Field
                label={strings.auth.email}
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
              />
              <Field
                label={strings.auth.password}
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={setPassword}
              />

              {mode === 'signin' ? (
                <button type="button" onClick={enterReset} className="text-right">
                  <span style={linkSubtleStyle}>{strings.auth.forgotPassword}</span>
                </button>
              ) : null}

              {error ? <p style={errorStyle}>{error}</p> : null}
              {magicSent ? <p style={infoStyle}>Check your email for a sign-in link.</p> : null}

              <button type="submit" disabled={busy} className="mt-sm rounded-md bg-sage p-md text-center">
                <span style={primaryTextStyle}>{mode === 'signup' ? strings.auth.signUp : strings.auth.signIn}</span>
              </button>

              <button type="button" onClick={magic} className="py-sm text-center">
                <span style={linkStyle}>{strings.auth.magicLink}</span>
              </button>

              <button
                type="button"
                onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                className="py-sm text-center"
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
  label,
  value,
  onChange,
  type: inputType = 'text',
  autoComplete,
  disabled,
}: {
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
