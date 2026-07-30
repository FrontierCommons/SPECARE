import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import * as Localization from 'expo-localization';
import { api } from '../../api/client';
import { useSession } from '../../state/session';
import { Touchable } from '../../components/Touchable';
import { timezoneOptions, labelForTimezone } from '../../lib/timezones';
import { color, radius, space, type } from '../../design/tokens';
import { strings } from '../../design/strings';

/**
 * Two distinct moments, not one screen with everything at once: first pick a
 * timezone, THEN — separately — see the note about what that means (the
 * daily nudge time). Confirming a pick also syncs it to the account, so
 * changing your mind here isn't stuck with whatever the device guessed.
 */
export function TimezoneScreen({ onNext }: { onNext: () => void }) {
  const { user, setUser } = useSession();
  const deviceTz = Localization.getCalendars()[0]?.timeZone ?? 'UTC';
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
      <View style={styles.container}>
        <Text style={styles.title}>{strings.onboarding.timezoneTitle}</Text>
        <View style={styles.tzChip}>
          <Text style={styles.tzText}>{labelForTimezone(confirmedTz, options)}</Text>
        </View>
        <Text style={styles.body}>{strings.onboarding.timezoneBody}</Text>
        <Touchable style={styles.primary} onPress={onNext} accessibilityRole="button">
          <Text style={styles.primaryText}>{strings.onboarding.looksRight}</Text>
        </Touchable>
        <Touchable onPress={() => setConfirmedTz(null)} accessibilityRole="button">
          <Text style={styles.link}>{strings.onboarding.changeTimezone}</Text>
        </Touchable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{strings.onboarding.timezoneTitle}</Text>
      <Text style={styles.body}>{strings.onboarding.timezonePrompt}</Text>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {options.map((z) => {
          const active = selected === z.value;
          return (
            <Touchable
              key={z.value}
              onPress={() => setSelected(z.value)}
              style={[styles.row, active && styles.rowActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.rowText, active && styles.rowTextActive]}>{z.label}</Text>
            </Touchable>
          );
        })}
      </ScrollView>

      <Touchable style={styles.primary} onPress={confirm} disabled={busy} accessibilityRole="button">
        <Text style={styles.primaryText}>{strings.onboarding.confirmTimezone}</Text>
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg, padding: space.lg, gap: space.md },
  title: { ...type.title, color: color.textPrimary },
  body: { ...type.body, color: color.textSecondary },
  list: { flex: 1 },
  listContent: { gap: space.xs, paddingVertical: space.xs },
  row: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  rowActive: { borderColor: color.sage, backgroundColor: color.surfaceRaised },
  rowText: { ...type.body, color: color.textSecondary },
  rowTextActive: { color: color.sage, fontWeight: '600' },
  tzChip: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: color.border,
    alignSelf: 'flex-start',
  },
  tzText: { ...type.heading, color: color.sage },
  primary: {
    backgroundColor: color.sage,
    borderRadius: radius.md,
    padding: space.md,
    alignItems: 'center',
    marginTop: space.md,
  },
  primaryText: { ...type.label, color: color.bg, fontWeight: '600' },
  link: { ...type.label, color: color.sage, textAlign: 'center', paddingVertical: space.sm },
});

export default TimezoneScreen;
