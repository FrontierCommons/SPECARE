import React, { useState } from 'react';
import { View, Text, ScrollView, Switch, StyleSheet } from 'react-native';
import type { CheckInFrequency } from '@sper/shared-types';
import { useSession } from '../state/session';
import { useUpdateProfile } from '../api/hooks';
import { Avatar } from '../components/Avatar';
import { Touchable } from '../components/Touchable';
import { ConfirmModal } from '../components/ConfirmModal';
import { TutorialModal } from '../components/TutorialModal';
import { pickAndResizeAvatar } from '../lib/resizeImage';
import { humanizeTimezone } from '../lib/timezones';
import { nextPromptAt, formatPromptTime } from '../lib/time';
import { color, elevation, radius, space, type } from '../design/tokens';
import { strings } from '../design/strings';

const FREQUENCIES: { value: CheckInFrequency; label: string }[] = [
  { value: 'once', label: strings.settings.frequencyOnce },
  { value: 'twice', label: strings.settings.frequencyTwice },
  { value: 'thrice', label: strings.settings.frequencyThrice },
];

/**
 * Everything that isn't the daily rhythm lives here: who you are, whether the
 * nudge is on, and the door out — of the account, not of the circle (that
 * stays a deliberate, separate action on My Circle).
 */
export function SettingsScreen() {
  const { user, setUser, signOut, deleteAccount } = useSession();
  const updateProfile = useUpdateProfile();
  const [showPact, setShowPact] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [pendingFrequency, setPendingFrequency] = useState<CheckInFrequency | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);

  if (!user) return null;

  const togglePause = (paused: boolean) => {
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

  const pickPhoto = async () => {
    setPhotoError(false);
    try {
      const dataUrl = await pickAndResizeAvatar();
      if (dataUrl) setPendingPhoto(dataUrl); // canceled or permission denied otherwise
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
      await deleteAccount(); // the root navigator switches to Auth once the session clears
    } catch {
      setDeleting(false);
      setDeleteError(true);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{strings.settings.title}</Text>

      <View style={styles.profileCard}>
        <Touchable onPress={() => void pickPhoto()} accessibilityRole="button" accessibilityLabel={strings.settings.changePhoto}>
          <Avatar name={user.name} avatarUrl={user.avatar_url} size={56} />
        </Touchable>
        <View style={styles.profileText}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <Touchable onPress={() => void pickPhoto()} accessibilityRole="button">
            <Text style={styles.changePhoto}>{strings.settings.changePhoto}</Text>
          </Touchable>
          {photoError ? <Text style={styles.errorText}>{strings.settings.photoFailed}</Text> : null}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{strings.settings.pauseNudge}</Text>
            <Text style={styles.rowBody}>{strings.settings.notificationsBody}</Text>
          </View>
          <Switch
            value={user.notifications_paused}
            onValueChange={togglePause}
            trackColor={{ true: color.sage, false: color.border }}
            thumbColor={color.textPrimary}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{strings.settings.timezone}</Text>
          <Text style={styles.rowValue}>{humanizeTimezone(user.timezone)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.rowLabel}>{strings.settings.frequency}</Text>
        <Text style={styles.rowBody}>{strings.settings.frequencyBody}</Text>
        <View style={styles.segmented}>
          {FREQUENCIES.map((f) => {
            const active = user.checkin_frequency === f.value;
            return (
              <Touchable
                key={f.value}
                onPress={() => !active && setPendingFrequency(f.value)}
                style={[styles.segment, active && styles.segmentActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{f.label}</Text>
              </Touchable>
            );
          })}
        </View>
        <Text style={styles.nextReminder}>
          {strings.settings.nextReminder(
            formatPromptTime(nextPromptAt(user.last_checkin_at ?? user.created_at, user.checkin_frequency)),
          )}
        </Text>
      </View>

      <Touchable style={styles.linkRow} onPress={() => setShowPact((v) => !v)} accessibilityRole="button">
        <Text style={styles.linkText}>{strings.settings.viewPact}</Text>
        <Text style={styles.chevron}>{showPact ? '︿' : '﹀'}</Text>
      </Touchable>
      {showPact ? (
        <View style={styles.pactBox}>
          <Text style={styles.pactText}>{strings.pact.body}</Text>
        </View>
      ) : null}

      <Touchable style={styles.linkRow} onPress={() => setShowTutorial(true)} accessibilityRole="button">
        <Text style={styles.linkText}>{strings.settings.tutorial}</Text>
      </Touchable>

      <Touchable style={styles.signOut} onPress={signOut} accessibilityRole="button">
        <Text style={styles.signOutText}>{strings.settings.signOut}</Text>
      </Touchable>

      <Touchable style={styles.deleteAccount} onPress={() => setShowDeleteConfirm(true)} accessibilityRole="button">
        <Text style={styles.deleteAccountText}>{strings.settings.deleteAccount}</Text>
      </Touchable>
      {deleteError ? <Text style={[styles.errorText, styles.centerText]}>{strings.settings.deleteAccountFailed}</Text> : null}

      <Text style={styles.version}>{strings.settings.version}</Text>

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

      {showTutorial ? (
        <TutorialModal onSkip={() => setShowTutorial(false)} onFinish={() => setShowTutorial(false)} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.lg, gap: space.md },
  title: { ...type.display, color: color.textPrimary },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space.md,
    ...elevation.sm,
  },
  profileText: { gap: 2 },
  name: { ...type.heading, color: color.textPrimary },
  email: { ...type.caption, color: color.textMuted },
  changePhoto: { ...type.caption, color: color.sage, marginTop: 2 },
  errorText: { ...type.caption, color: color.destructive },
  centerText: { textAlign: 'center' },
  section: { backgroundColor: color.surface, borderRadius: radius.md, padding: space.md, ...elevation.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...type.label, color: color.textPrimary },
  rowBody: { ...type.caption, color: color.textMuted },
  rowValue: { ...type.body, color: color.sage },
  segmented: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  segment: {
    flex: 1,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: color.surfaceRaised, borderColor: color.sage },
  segmentText: { ...type.caption, color: color.textSecondary, textAlign: 'center' },
  segmentTextActive: { color: color.sage, fontWeight: '600' },
  nextReminder: { ...type.caption, color: color.textMuted, marginTop: space.sm },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  linkText: { ...type.label, color: color.sage },
  chevron: { color: color.sage },
  pactBox: {
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: -space.sm,
  },
  pactText: { ...type.body, color: color.textSecondary },
  signOut: { padding: space.md, alignItems: 'center', marginTop: space.lg },
  signOutText: { ...type.label, color: color.textPrimary },
  deleteAccount: { padding: space.md, alignItems: 'center' },
  deleteAccountText: { ...type.label, color: color.destructive, fontWeight: '600' },
  version: { ...type.caption, color: color.textMuted, textAlign: 'center' },
});

export default SettingsScreen;
