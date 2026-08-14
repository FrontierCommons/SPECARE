'use client';

import { useEffect, useRef, useState } from 'react';
import type { CheckInFrequency } from '@sper/shared-types';
import { useSession } from '../../../state/session';
import { useTheme, type Theme } from '../../../state/theme';
import { useUpdateProfile } from '../../../api/hooks';
import { Avatar } from '../../../components/Avatar';
import { TutorialModal } from '../../../components/TutorialModal';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { resizeImageToSquareDataUrl } from '../../../lib/resizeImage';
import { disablePushNotifications, enablePushNotifications, getPushStatus, type PushStatus } from '../../../lib/push';
import { formatPromptTime, nextPromptAt } from '../../../lib/time';
import { humanizeTimezone } from '../../../lib/timezones';
import { color, type } from '../../../design/tokens';
import { strings } from '../../../design/strings';
import { PRESSABLE } from '../../../design/interaction';

const FREQUENCIES: { value: CheckInFrequency; label: string }[] = [
  { value: 'once', label: strings.settings.frequencyOnce },
  { value: 'twice', label: strings.settings.frequencyTwice },
  { value: 'thrice', label: strings.settings.frequencyThrice },
];

const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark', label: strings.settings.themeDark },
  { value: 'light', label: strings.settings.themeLight },
];

const titleStyle = { ...type.display, color: color.textPrimary };
const nameStyle = { ...type.heading, color: color.textPrimary };
const emailStyle = { ...type.caption, color: color.textMuted };
const changePhotoStyle = { ...type.caption, color: color.sageText };
const rowLabelStyle = { ...type.label, color: color.textPrimary };
const rowBodyStyle = { ...type.caption, color: color.textMuted };
const rowValueStyle = { ...type.body, color: color.sageText };
const segmentTextStyle = { ...type.caption, color: color.textSecondary };
const segmentTextActiveStyle = { ...type.caption, color: color.sageText, fontWeight: 600 as const };
const linkTextStyle = { ...type.label, color: color.sageText };
const chevronStyle = { fontSize: 24, fontWeight: 700 as const, color: color.sageText };
const pactTextStyle = { ...type.body, color: color.textSecondary };
const signOutTextStyle = { ...type.label, color: color.textPrimary };
const deleteAccountTextStyle = { ...type.label, color: color.destructive, fontWeight: 600 as const };
const errorTextStyle = { ...type.caption, color: color.destructive };
const versionStyle = { ...type.caption, color: color.textMuted };

/**
 * Everything that isn't the daily rhythm lives here: who you are, whether the
 * nudge is on, and the door out — of the account, not of the circle (that
 * stays a deliberate, separate action on My Circle).
 */
export default function SettingsPage() {
  const { user, setUser, signOut, deleteAccount } = useSession();
  const { theme, setTheme } = useTheme();
  const updateProfile = useUpdateProfile();
  const [showPact, setShowPact] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [pendingFrequency, setPendingFrequency] = useState<CheckInFrequency | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus | 'checking'>('checking');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState(false);
  const [pushDisableError, setPushDisableError] = useState(false);

  useEffect(() => {
    void getPushStatus().then(setPushStatus);
  }, []);

  if (!user) return null;

  const nextReminderLabel = formatPromptTime(
    nextPromptAt(user.last_checkin_at ?? user.created_at, user.checkin_frequency),
  );

  const enablePush = async () => {
    setPushBusy(true);
    setPushError(false);
    try {
      await enablePushNotifications();
      setPushStatus('subscribed');
    } catch {
      setPushError(true);
      setPushStatus(await getPushStatus());
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    setPushBusy(true);
    setPushDisableError(false);
    try {
      await disablePushNotifications();
      setPushStatus(await getPushStatus());
    } catch {
      setPushDisableError(true);
    } finally {
      setPushBusy(false);
    }
  };

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

  const confirmFrequency = () => {
    if (pendingFrequency) setFrequency(pendingFrequency);
    setPendingFrequency(null);
  };

  const stagePhoto = async (file: File) => {
    setPhotoError(false);
    try {
      setPendingPhoto(await resizeImageToSquareDataUrl(file));
    } catch {
      setPhotoError(true);
    }
  };

  const confirmPhoto = () => {
    if (!pendingPhoto) return;
    const dataUrl = pendingPhoto;
    const previous = user.avatar_url;
    setUser({ ...user, avatar_url: dataUrl }); // optimistic
    updateProfile.mutate(
      { avatar_url: dataUrl },
      {
        onError: () => {
          setUser({ ...user, avatar_url: previous });
          setPhotoError(true);
        },
      },
    );
    setPendingPhoto(null);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError(false);
    try {
      await deleteAccount(); // RootGate redirects to /auth once the session clears
    } catch {
      setDeleting(false);
      setDeleteError(true);
    }
  };

  return (
    <div className="min-h-full bg-bg p-lg">
      <div className="flex flex-col gap-md">
        <h1 style={titleStyle}>{strings.settings.title}</h1>

        <div className="flex items-center gap-md rounded-md bg-surface p-md shadow-sm">
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label={strings.settings.changePhoto}
            className={PRESSABLE}
          >
            <Avatar name={user.name} avatarUrl={user.avatar_url} size={56} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void stagePhoto(file);
            }}
          />
          <div className="flex-1">
            <p style={nameStyle}>{user.name}</p>
            <p style={emailStyle}>{user.email}</p>
            <button onClick={() => fileInputRef.current?.click()} className={`mt-xs ${PRESSABLE}`}>
              <span style={changePhotoStyle}>{strings.settings.changePhoto}</span>
            </button>
            {photoError ? <p style={errorTextStyle}>{strings.settings.photoFailed}</p> : null}
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
            className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors ${PRESSABLE}`}
            style={{ backgroundColor: user.notifications_paused ? color.sage : color.border }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-all duration-200"
              style={{
                left: user.notifications_paused ? '22px' : '2px',
                // A stable near-white knob regardless of theme or track
                // color — like a physical switch, its own drop shadow (not
                // hue contrast against the track) is what keeps it legible
                // whether the track is sage-green or a light theme's tan
                // border color.
                backgroundColor: color.textOption,
              }}
            />
          </button>
        </div>

        {pushStatus !== 'unsupported' ? (
          <div className="flex items-center justify-between gap-md rounded-md bg-surface p-md shadow-sm">
            <div className="flex-1">
              <p style={rowLabelStyle}>{strings.settings.browserNotifications}</p>
              <p style={rowBodyStyle}>
                {pushStatus === 'denied'
                  ? strings.settings.browserNotificationsBlocked
                  : strings.settings.browserNotificationsBody}
              </p>
              {pushError ? <p style={errorTextStyle}>{strings.settings.browserNotificationsFailed}</p> : null}
              {pushDisableError ? (
                <p style={errorTextStyle}>{strings.settings.browserNotificationsDisableFailed}</p>
              ) : null}
            </div>
            {pushStatus === 'subscribed' ? (
              <div className="flex shrink-0 items-center gap-sm">
                <span style={rowValueStyle}>{strings.settings.browserNotificationsEnabled}</span>
                <button
                  onClick={() => void disablePush()}
                  disabled={pushBusy}
                  className={`rounded-md border border-border px-md py-sm disabled:opacity-50 ${PRESSABLE}`}
                >
                  <span style={linkTextStyle}>{strings.settings.disableBrowserNotifications}</span>
                </button>
              </div>
            ) : pushStatus === 'checking' ? null : (
              <button
                onClick={() => void enablePush()}
                disabled={pushBusy || pushStatus === 'denied'}
                className={`shrink-0 rounded-md border border-sage px-md py-sm disabled:opacity-50 ${PRESSABLE}`}
              >
                <span style={linkTextStyle}>{strings.settings.enableBrowserNotifications}</span>
              </button>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-md bg-surface p-md shadow-sm">
          <span style={rowLabelStyle}>{strings.settings.timezone}</span>
          <span style={rowValueStyle}>{humanizeTimezone(user.timezone)}</span>
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
                  onClick={() => !active && setPendingFrequency(f.value)}
                  aria-pressed={active}
                  className={`flex-1 rounded-md border py-sm text-center ${PRESSABLE} ${
                    active ? 'border-sage bg-surfaceRaised' : 'border-border'
                  }`}
                >
                  <span style={active ? segmentTextActiveStyle : segmentTextStyle}>{f.label}</span>
                </button>
              );
            })}
          </div>
          <p style={rowBodyStyle} className="mt-sm">
            {strings.settings.nextReminder(nextReminderLabel)}
          </p>
        </div>

        <div className="rounded-md bg-surface p-md shadow-sm">
          <p style={rowLabelStyle}>{strings.settings.appearance}</p>
          <p style={rowBodyStyle}>{strings.settings.appearanceBody}</p>
          <div className="mt-sm flex gap-sm">
            {THEMES.map((t) => {
              const active = theme === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  aria-pressed={active}
                  className={`flex-1 rounded-md border py-sm text-center ${PRESSABLE} ${
                    active ? 'border-sage bg-surfaceRaised' : 'border-border'
                  }`}
                >
                  <span style={active ? segmentTextActiveStyle : segmentTextStyle}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => setShowPact((v) => !v)}
          className={`flex items-center justify-between py-sm ${PRESSABLE}`}
        >
          <span style={linkTextStyle}>{strings.settings.viewPact}</span>
          <span style={chevronStyle}>{showPact ? '︿' : '﹀'}</span>
        </button>
        {showPact ? (
          <div className="-mt-sm rounded-md bg-surfaceRaised p-md">
            <p style={pactTextStyle}>{strings.pact.body}</p>
          </div>
        ) : null}

        <button
          onClick={() => setShowTutorial(true)}
          className={`flex items-center justify-between py-sm ${PRESSABLE}`}
        >
          <span style={linkTextStyle}>{strings.settings.tutorial}</span>
          <span style={chevronStyle}>﹀</span>
        </button>

        <button onClick={signOut} className={`mt-lg p-md text-center ${PRESSABLE}`}>
          <span style={signOutTextStyle}>{strings.settings.signOut}</span>
        </button>

        <button onClick={() => setShowDeleteConfirm(true)} className={`p-md text-center ${PRESSABLE}`}>
          <span style={deleteAccountTextStyle}>{strings.settings.deleteAccount}</span>
        </button>
        {deleteError ? <p style={errorTextStyle} className="text-center">{strings.settings.deleteAccountFailed}</p> : null}

        <p style={versionStyle} className="text-center">
          {strings.settings.version}
        </p>
      </div>

      {showTutorial ? (
        <TutorialModal onSkip={() => setShowTutorial(false)} onFinish={() => setShowTutorial(false)} />
      ) : null}

      <ConfirmModal
        open={pendingPhoto !== null}
        title={strings.settings.confirmPhotoTitle}
        body={strings.settings.confirmPhotoBody}
        previewImage={pendingPhoto ?? undefined}
        confirmLabel={strings.settings.confirmPhotoCta}
        onConfirm={confirmPhoto}
        onCancel={() => setPendingPhoto(null)}
      />

      <ConfirmModal
        open={pendingFrequency !== null}
        title={strings.settings.frequencyConfirmTitle}
        body={
          pendingFrequency
            ? strings.settings.frequencyConfirmBody(FREQUENCIES.find((f) => f.value === pendingFrequency)!.label)
            : ''
        }
        confirmLabel={strings.settings.frequencyConfirmCta}
        onConfirm={confirmFrequency}
        onCancel={() => setPendingFrequency(null)}
      />

      <ConfirmModal
        open={showDeleteConfirm}
        title={strings.settings.deleteAccountTitle}
        body={`${strings.settings.deleteAccountBody} ${strings.settings.deleteAccountHint(strings.settings.deleteAccountPhrase)}`}
        confirmLabel={strings.settings.deleteAccountCta}
        confirmPhrase={strings.settings.deleteAccountPhrase}
        danger
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
