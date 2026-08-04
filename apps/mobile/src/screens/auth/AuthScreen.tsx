import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
} from 'react-native';
import * as Localization from 'expo-localization';
import { api, ApiError } from '../../api/client';
import { useSession } from '../../state/session';
import { Touchable } from '../../components/Touchable';
import { color, radius, space, type } from '../../design/tokens';
import { strings } from '../../design/strings';

type Mode = 'signin' | 'signup' | 'reset';

export function AuthScreen() {
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
      const tz = Localization.getCalendars()[0]?.timeZone ?? 'UTC';
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
    <ImageBackground
      source={require('../../../assets/images/background.jpg')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.scrim} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="always">
          <Text style={styles.brand}>{strings.app.name}</Text>
        <Text style={styles.tagline}>{strings.app.tagline}</Text>

        {mode === 'reset' ? (
          <>
            <Text style={styles.title}>{strings.auth.resetTitle}</Text>
            <Text style={styles.body}>
              {resetSent ? strings.auth.resetSent : strings.auth.resetBody}
            </Text>

            <Field
              label={strings.auth.email}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!resetSent}
            />

            {resetSent ? (
              <>
                <Field label={strings.auth.resetCode} value={resetCode} onChangeText={setResetCode} />
                <Field
                  label={strings.auth.newPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Touchable
              style={styles.primary}
              onPress={resetSent ? confirmReset : requestReset}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>
                {resetSent ? strings.auth.resetPasswordCta : strings.auth.sendResetCode}
              </Text>
            </Touchable>

            <Touchable onPress={() => setMode('signin')} accessibilityRole="button">
              <Text style={styles.link}>{strings.auth.backToSignIn}</Text>
            </Touchable>
          </>
        ) : (
          <>
            <Text style={styles.title}>
              {mode === 'signup' ? strings.auth.signUpTitle : strings.auth.signInTitle}
            </Text>

            {mode === 'signup' && (
              <Field label={strings.auth.name} value={name} onChangeText={setName} autoCapitalize="words" />
            )}
            <Field
              label={strings.auth.email}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              label={strings.auth.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {mode === 'signin' ? (
              <Touchable onPress={enterReset} accessibilityRole="button">
                <Text style={styles.linkSubtle}>{strings.auth.forgotPassword}</Text>
              </Touchable>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {magicSent ? <Text style={styles.info}>Check your email for a sign-in link.</Text> : null}

            <Touchable style={styles.primary} onPress={submit} disabled={busy} accessibilityRole="button">
              <Text style={styles.primaryText}>
                {mode === 'signup' ? strings.auth.signUp : strings.auth.signIn}
              </Text>
            </Touchable>

            <Touchable onPress={magic} accessibilityRole="button">
              <Text style={styles.link}>{strings.auth.magicLink}</Text>
            </Touchable>

            <Touchable
              onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
              accessibilityRole="button"
            >
              <Text style={styles.link}>
                {mode === 'signup' ? strings.auth.toggleToSignIn : strings.auth.toggleToSignUp}
              </Text>
            </Touchable>
          </>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={color.textMuted}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: color.bg },
  // A light wash, not a dark one — brightens the photo instead of hiding it.
  // Text below has its own opaque surfaces where legibility matters.
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFFFF', opacity: 0.08 },
  flex: { flex: 1 },
  container: { padding: space.lg, gap: space.md, flexGrow: 1, justifyContent: 'center' },
  brand: { ...type.display, color: color.textPrimary, letterSpacing: 4 },
  tagline: { ...type.body, color: color.textSecondary, marginBottom: space.lg },
  title: { ...type.title, color: color.textPrimary, marginBottom: space.sm },
  body: { ...type.body, color: color.textSecondary, marginBottom: space.sm },
  field: { gap: space.xs },
  fieldLabel: { ...type.caption, color: color.textSecondary },
  input: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space.md,
    color: color.textPrimary,
    ...type.body,
    borderWidth: 1,
    borderColor: color.border,
  },
  primary: {
    backgroundColor: color.sage,
    borderRadius: radius.md,
    padding: space.md,
    alignItems: 'center',
    marginTop: space.sm,
  },
  primaryText: { ...type.label, color: color.bg, fontWeight: '600' },
  link: { ...type.label, color: color.sage, textAlign: 'center', paddingVertical: space.sm },
  linkSubtle: { ...type.caption, color: color.textMuted, textAlign: 'right' },
  error: { ...type.caption, color: color.statePit },
  info: { ...type.caption, color: color.sage },
});

export default AuthScreen;
