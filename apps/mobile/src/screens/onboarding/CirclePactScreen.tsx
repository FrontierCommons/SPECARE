import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { api, ApiError } from '../../api/client';
import { Touchable } from '../../components/Touchable';
import { color, radius, space, type } from '../../design/tokens';
import { strings } from '../../design/strings';

/**
 * The covenant gate. No circle content is reachable until the member agrees.
 * The pact IS the product's values in one sentence.
 */
export function CirclePactScreen({
  circleId,
  onAgreed,
}: {
  circleId: string;
  onAgreed: () => void;
}) {
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
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{strings.pact.title}</Text>
      <Text style={styles.covenant}>{strings.pact.body}</Text>
      <Text style={styles.subtext}>{strings.pact.subtext}</Text>

      <Touchable
        onPress={() => setChecked((c) => !c)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View style={styles.checkboxRow}>
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
            {checked ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>{strings.pact.checkboxLabel}</Text>
        </View>
      </Touchable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Touchable
        style={[styles.primary, !checked && styles.primaryDisabled]}
        onPress={agree}
        disabled={busy || !checked}
        accessibilityRole="button"
      >
        <Text style={styles.primaryText}>{strings.pact.agree}</Text>
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg, padding: space.xl, justifyContent: 'center', gap: space.lg },
  eyebrow: { ...type.caption, color: color.sage, letterSpacing: 2, textTransform: 'uppercase' },
  covenant: { ...type.display, color: color.textPrimary, fontSize: 26, lineHeight: 38 },
  subtext: { ...type.body, color: color.textSecondary },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: color.sage, borderColor: color.sage },
  checkmark: { color: color.bg, fontWeight: '700', fontSize: 14 },
  checkboxLabel: { ...type.body, color: color.textSecondary, flex: 1 },
  primary: { backgroundColor: color.sage, borderRadius: radius.md, padding: space.md, alignItems: 'center' },
  primaryDisabled: { backgroundColor: color.border },
  primaryText: { ...type.label, color: color.bg, fontWeight: '600' },
  error: { ...type.caption, color: color.statePit },
});

export default CirclePactScreen;
