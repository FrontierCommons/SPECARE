import React, { useState } from 'react';
import { View, Text, ScrollView, Switch, StyleSheet } from 'react-native';
import type { CheckInFrequency } from '@sper/shared-types';
import { useSession } from '../state/session';
import { useUpdateProfile } from '../api/hooks';
import { Avatar } from '../components/Avatar';
import { Touchable } from '../components/Touchable';
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
  const { user, setUser, signOut } = useSession();
  const updateProfile = useUpdateProfile();
  const [showPact, setShowPact] = useState(false);

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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{strings.settings.title}</Text>

      <View style={styles.profileCard}>
        <Avatar name={user.name} avatarUrl={user.avatar_url} size={56} />
        <View style={styles.profileText}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
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
          <Text style={styles.rowValue}>{user.timezone}</Text>
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
                onPress={() => setFrequency(f.value)}
                style={[styles.segment, active && styles.segmentActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{f.label}</Text>
              </Touchable>
            );
          })}
        </View>
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

      <Touchable style={styles.signOut} onPress={signOut} accessibilityRole="button">
        <Text style={styles.signOutText}>{strings.settings.signOut}</Text>
      </Touchable>

      <Text style={styles.version}>{strings.settings.version}</Text>
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
  signOutText: { ...type.label, color: color.statePit },
  version: { ...type.caption, color: color.textMuted, textAlign: 'center' },
});

export default SettingsScreen;
