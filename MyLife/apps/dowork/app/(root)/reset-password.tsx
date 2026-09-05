// Password reset. Reached from a recovery email deep link after
// auth-callback establishes the recovery session. Sets the new password
// through supabase.auth.updateUser and returns to the app.

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { KeyRound, ShieldCheck } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { WorkoutRouteHeader } from './phase3-kit';
import { updatePassword } from './data/account';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from './theme/tokens';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const cloud = useDoWorkCloud();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = useCallback(() => {
    void (async () => {
      if (!cloud.supabase) {
        setError('Cloud is not configured, so the password cannot be changed on this build.');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const result = await updatePassword(cloud.supabase, password);
        if (!result.ok) {
          setError(result.error ?? 'Could not update the password. Try again.');
          return;
        }
        setDone(true);
        setPassword('');
        setConfirm('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update the password. Try again.');
      } finally {
        setBusy(false);
      }
    })();
  }, [cloud.supabase, password, confirm]);

  if (done) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <WorkoutRouteHeader title="Password" overline="Account" onBack={() => router.back()} />
        <View style={styles.doneBody}>
          <View style={styles.iconCircle}>
            <ShieldCheck size={28} color={DW_ACCENT} />
          </View>
          <Text style={styles.title}>Password updated</Text>
          <Text style={styles.bodyText}>
            You are signed in with your new password on this device.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.86 }]}
            onPress={() => router.replace('/(root)/(tabs)')}
            accessibilityRole="button"
            accessibilityLabel="Continue to DoWork"
          >
            <Text style={styles.primaryLabel}>Continue</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const canSubmit = !busy && password.length >= 8 && confirm.length >= 8;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutRouteHeader title="Password" overline="Account" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.iconCircle}>
          <KeyRound size={26} color={DW_ACCENT} />
        </View>
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.bodyText}>
          Choose a new password for {cloud.user?.email ?? 'your account'}. At least 8 characters.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>New password</Text>
          <TextInput
            style={styles.textInput}
            value={password}
            onChangeText={setPassword}
            placeholder="New password"
            placeholderTextColor={DW_TEXT.disabled}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            secureTextEntry
            editable={!busy}
            accessibilityLabel="New password"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.textInput}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat the new password"
            placeholderTextColor={DW_TEXT.disabled}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            secureTextEntry
            editable={!busy}
            accessibilityLabel="Confirm new password"
          />
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && { opacity: 0.86 },
            !canSubmit && { opacity: 0.5 },
          ]}
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Save new password"
        >
          {busy ? (
            <ActivityIndicator color={DW_ON_ACCENT} />
          ) : (
            <Text style={styles.primaryLabel}>Save new password</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DW_SURFACES.base,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 48,
    gap: 14,
    alignItems: 'stretch',
  },
  doneBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 14,
    alignItems: 'center',
  },
  iconCircle: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
    marginBottom: 4,
  },
  title: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 26,
    color: DW_TEXT.primary,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  bodyText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  field: {
    gap: 6,
    marginTop: 6,
  },
  label: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.secondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: WK_FONTS.medium,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  errorCard: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderColor: 'rgba(255, 107, 107, 0.32)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  errorText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    color: '#FF8B7A',
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: DW_ACCENT,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  primaryLabel: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_ON_ACCENT,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
