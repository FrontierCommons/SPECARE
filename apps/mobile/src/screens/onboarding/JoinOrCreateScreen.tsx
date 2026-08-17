import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { api, ApiError } from '../../api/client';
import { Touchable } from '../../components/Touchable';
import { useSession } from '../../state/session';
import { color, radius, space, type } from '../../design/tokens';
import { strings } from '../../design/strings';

/**
 * Fork in onboarding: create a circle (become its first member) or join an
 * existing one with a code. On success we hand the circle id up so the Pact
 * screen can gate entry.
 *
 * `showSkip` is only true for the top-level onboarding flow — a member
 * already reaching this screen to join a second circle (from My Circle)
 * has nothing to "defer."
 */
export function JoinOrCreateScreen({
  onJoined,
  showSkip,
}: {
  onJoined: (circleId: string) => void;
  showSkip?: boolean;
}) {
  const { markOnboardingDeferred } = useSession();
  const [mode, setMode] = useState<'create' | 'join'>('create');
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
    <View style={styles.container}>
      {showSkip ? (
        <Touchable style={styles.skip} onPress={() => void markOnboardingDeferred()} accessibilityRole="button">
          <Text style={styles.skipText}>{strings.onboarding.doLater}</Text>
        </Touchable>
      ) : null}
      <Text style={styles.title}>{strings.onboarding.joinTitle}</Text>
      <Text style={styles.body}>{strings.onboarding.joinBody}</Text>

      <View style={styles.tabs}>
        <Tab label={strings.onboarding.createCircle} active={mode === 'create'} onPress={() => setMode('create')} />
        <Tab label={strings.onboarding.joinCircle} active={mode === 'join'} onPress={() => setMode('join')} />
      </View>

      {mode === 'create' ? (
        <TextInput
          style={styles.input}
          placeholder={strings.onboarding.circleName}
          placeholderTextColor={color.textMuted}
          value={circleName}
          onChangeText={setCircleName}
        />
      ) : (
        <TextInput
          style={[styles.input, styles.code]}
          placeholder={strings.onboarding.code}
          placeholderTextColor={color.textMuted}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          maxLength={6}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Touchable style={styles.primary} onPress={go} disabled={busy} accessibilityRole="button">
        <Text style={styles.primaryText}>
          {mode === 'create' ? strings.onboarding.create : strings.onboarding.join}
        </Text>
      </Touchable>
    </View>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Touchable
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg, padding: space.lg, justifyContent: 'center', gap: space.md },
  skip: { position: 'absolute', top: space.lg, right: space.lg, padding: space.xs },
  skipText: { ...type.label, color: color.textMuted },
  title: { ...type.title, color: color.textPrimary },
  body: { ...type.body, color: color.textSecondary },
  tabs: { flexDirection: 'row', gap: space.sm, marginVertical: space.sm },
  tab: { flex: 1, padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, alignItems: 'center' },
  tabActive: { backgroundColor: color.surfaceRaised, borderColor: color.sage },
  tabText: { ...type.caption, color: color.textSecondary },
  tabTextActive: { color: color.textPrimary },
  input: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space.md,
    color: color.textPrimary,
    ...type.body,
    borderWidth: 1,
    borderColor: color.border,
  },
  code: { letterSpacing: 6, textAlign: 'center', fontSize: 22 },
  primary: { backgroundColor: color.sage, borderRadius: radius.md, padding: space.md, alignItems: 'center' },
  primaryText: { ...type.label, color: color.bg, fontWeight: '600' },
  error: { ...type.caption, color: color.statePit },
});

export default JoinOrCreateScreen;
