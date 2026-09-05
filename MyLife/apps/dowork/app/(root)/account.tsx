// Account sign-in. The one place a user attaches an identity to this device:
// email + password sign-in (used by App Review demo accounts and returning
// users on a new device), an email sign-in link alternative, and password
// recovery. Anonymous users are told honestly that signing in switches this
// device to that account while local workout data stays on the device.

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
import { CircleUserRound, MailCheck, ShieldCheck } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { WorkoutRouteHeader } from './phase3-kit';
import { friendlyError } from './data/friendly-errors';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from './theme/tokens';

type Busy = 'none' | 'password' | 'link' | 'recovery';

export default function AccountScreen() {
  const router = useRouter();
  const cloud = useDoWorkCloud();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<Busy>('none');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasEmailIdentity = Boolean(cloud.user?.email);

  const run = useCallback(
    async (
      kind: Busy,
      action: () => Promise<void>,
      successNotice: string | null,
      errorFallback: string,
    ) => {
      setBusy(kind);
      setError(null);
      setNotice(null);
      try {
        await action();
        setNotice(successNotice);
      } catch (e) {
        // Backend auth strings go through the friendly mapper; anything that
        // still smells technical becomes the action-specific fallback copy.
        setError(friendlyError(e instanceof Error ? e.message : null, errorFallback));
      } finally {
        setBusy('none');
      }
    },
    [],
  );

  const submitPassword = useCallback(() => {
    void run(
      'password',
      async () => {
        await cloud.signInWithPassword(email, password);
        await cloud.refreshIdentity();
        setPassword('');
      },
      'Signed in.',
      'Sign-in failed. Check your email and password and try again.',
    );
  }, [run, cloud, email, password]);

  const submitLink = useCallback(() => {
    void run(
      'link',
      async () => {
        await cloud.requestEmailLink(email);
      },
      'Check your email for the sign-in link.',
      'The sign-in link could not be sent. Check the address and try again.',
    );
  }, [run, cloud, email]);

  const submitRecovery = useCallback(() => {
    void run(
      'recovery',
      async () => {
        await cloud.requestPasswordRecovery(email);
      },
      'Check your email for the password reset link.',
      'The reset email could not be sent. Check the address and try again.',
    );
  }, [run, cloud, email]);

  if (!cloud.isConfigured) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <WorkoutRouteHeader title="Account" overline="Settings" onBack={() => router.back()} />
        <View style={styles.body}>
          <View style={styles.iconCircle}>
            <CircleUserRound size={28} color={DW_ACCENT} />
          </View>
          <Text style={styles.title}>Cloud is not configured</Text>
          <Text style={styles.bodyText}>
            This build has no cloud connection, so accounts are unavailable. Your workouts stay on
            this device.
          </Text>
        </View>
      </View>
    );
  }

  if (hasEmailIdentity) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <WorkoutRouteHeader title="Account" overline="Settings" onBack={() => router.back()} />
        <View style={styles.body}>
          <View style={styles.iconCircle}>
            <ShieldCheck size={28} color={DW_ACCENT} />
          </View>
          <Text style={styles.title}>Signed in</Text>
          <Text style={styles.bodyText}>
            You are signed in as {cloud.user?.email}
            {cloud.profile ? ` (@${cloud.profile.handle})` : ''}. Sign out from Settings to switch
            accounts.
          </Text>
        </View>
      </View>
    );
  }

  const submitting = busy !== 'none';
  const emailFilled = email.trim().length > 0;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutRouteHeader title="Account" overline="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.iconCircle}>
          <CircleUserRound size={26} color={DW_ACCENT} />
        </View>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.bodyText}>
          {cloud.isAnonymous
            ? 'Signing in switches this device to that account. Workouts logged on this device stay here.'
            : 'Sign in with your email to reach your trainer, subscriptions, and coaching.'}
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.textInput}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={DW_TEXT.disabled}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            editable={!submitting}
            accessibilityLabel="Email address"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.textInput}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={DW_TEXT.disabled}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            secureTextEntry
            editable={!submitting}
            accessibilityLabel="Password"
          />
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {notice ? (
          <View style={styles.noticeCard}>
            <MailCheck size={16} color={DW_ACCENT} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && { opacity: 0.86 },
            (submitting || !emailFilled || password.length === 0) && { opacity: 0.5 },
          ]}
          onPress={submitPassword}
          disabled={submitting || !emailFilled || password.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Sign in with password"
        >
          {busy === 'password' ? (
            <ActivityIndicator color={DW_ON_ACCENT} />
          ) : (
            <Text style={styles.primaryLabel}>Sign in</Text>
          )}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && { opacity: 0.86 },
            (submitting || !emailFilled) && { opacity: 0.5 },
          ]}
          onPress={submitLink}
          disabled={submitting || !emailFilled}
          accessibilityRole="button"
          accessibilityLabel="Email me a sign-in link"
        >
          {busy === 'link' ? (
            <ActivityIndicator color={DW_ACCENT} />
          ) : (
            <Text style={styles.secondaryLabel}>Email me a sign-in link</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.tertiaryButton, pressed && { opacity: 0.7 }]}
          onPress={submitRecovery}
          disabled={submitting || !emailFilled}
          accessibilityRole="button"
          accessibilityLabel="Forgot password"
        >
          {busy === 'recovery' ? (
            <ActivityIndicator color={DW_TEXT.secondary} size="small" />
          ) : (
            <Text
              style={[styles.tertiaryLabel, (submitting || !emailFilled) && { opacity: 0.5 }]}
            >
              Forgot password?
            </Text>
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
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${DW_ACCENT}14`,
    borderColor: `${DW_ACCENT}3D`,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  noticeText: {
    flex: 1,
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    color: DW_TEXT.primary,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: DW_ACCENT,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_ON_ACCENT,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: DW_BORDER.default,
  },
  dividerText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: DW_TEXT.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  secondaryButton: {
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DW_SURFACES.low,
  },
  secondaryLabel: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_TEXT.primary,
  },
  tertiaryButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  tertiaryLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    color: DW_TEXT.secondary,
    textDecorationLine: 'underline',
  },
});
