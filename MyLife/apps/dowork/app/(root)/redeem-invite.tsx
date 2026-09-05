// Trainer invite redemption. A user enters the 12-character code they were
// given; the dowork-redeem-invite edge function (the only trainer-creation
// path) mints their dw_trainers row and the screen sends them to the Studio.
// Every failure (invalid / claimed / expired) is surfaced honestly.

import { useCallback, useEffect, useState } from 'react';
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
import { BadgeCheck, KeyRound, PartyPopper } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { WorkoutRouteHeader } from './phase3-kit';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import { isAnonymousSession } from './data/auth-session';
import { redeemTrainerInvite, type RedeemedTrainer } from './data/cloud-invites';
import { PushPrompt } from './components/PushPrompt';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from './theme/tokens';

type Phase =
  | { state: 'form' }
  | { state: 'submitting' }
  | { state: 'error'; message: string }
  | { state: 'done'; trainer: RedeemedTrainer };

export default function RedeemInviteScreen() {
  const router = useRouter();
  const { supabase, isReady, trainerProfile, refreshIdentity } = useDoWorkCloud();
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phase, setPhase] = useState<Phase>({ state: 'form' });
  const [needsEmail, setNeedsEmail] = useState(false);

  useEffect(() => {
    let active = true;
    if (!isReady || !supabase) {
      setNeedsEmail(false);
      return () => {
        active = false;
      };
    }
    void isAnonymousSession(supabase).then((anonymous) => {
      if (active) setNeedsEmail(anonymous);
    });
    return () => {
      active = false;
    };
  }, [isReady, supabase]);

  const submit = useCallback(async () => {
    if (!supabase) {
      setPhase({ state: 'error', message: 'Redeeming an invite needs a cloud connection.' });
      return;
    }
    if (await isAnonymousSession(supabase)) {
      setNeedsEmail(true);
      setPhase({ state: 'form' });
      return;
    }
    const trimmed = code.trim();
    if (!trimmed) {
      setPhase({ state: 'error', message: 'Enter your invite code to continue.' });
      return;
    }
    setPhase({ state: 'submitting' });
    const result = await redeemTrainerInvite(supabase, trimmed, displayName);
    if (!result.ok) {
      setPhase({ state: 'error', message: result.error });
      return;
    }
    await refreshIdentity();
    setPhase({ state: 'done', trainer: result.trainer });
  }, [supabase, code, displayName, refreshIdentity]);

  const goStudio = useCallback(() => {
    router.replace('/(root)/studio' as never);
  }, [router]);

  // Already a trainer: skip the form and point at the Studio.
  if (isReady && trainerProfile) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <WorkoutRouteHeader title="Trainer invite" overline="Onboarding" onBack={() => router.back()} />
        <View style={styles.body}>
          <View style={styles.iconCircle}>
            <BadgeCheck size={28} color={DW_ACCENT} />
          </View>
          <Text style={styles.title}>You&rsquo;re already a trainer</Text>
          <Text style={styles.bodyText}>
            Your Studio is open. Head there to upload videos and manage your profile.
          </Text>
          <Pressable style={styles.primaryButton} onPress={goStudio} accessibilityRole="button">
            <Text style={styles.primaryLabel}>Open your Studio</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase.state === 'done') {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.body}>
          <View style={styles.iconCircle}>
            <PartyPopper size={30} color={DW_ACCENT} />
          </View>
          <Text style={styles.title}>Welcome to DoWork</Text>
          <Text style={styles.bodyText}>
            Your trainer profile is live{phase.trainer.handle ? ` at @${phase.trainer.handle}` : ''}. Set up
            your Studio next: upload your library, write your headline, and pick your price tier.
          </Text>
          <Pressable style={styles.primaryButton} onPress={goStudio} accessibilityRole="button">
            <Text style={styles.primaryLabel}>Open your Studio</Text>
          </Pressable>
          <View style={styles.pushPrompt}>
            <PushPrompt />
          </View>
        </View>
      </View>
    );
  }

  const submitting = phase.state === 'submitting';

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutRouteHeader title="Trainer invite" overline="Onboarding" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.iconCircle}>
          <KeyRound size={26} color={DW_ACCENT} />
        </View>
        <Text style={styles.title}>Redeem your invite</Text>
        <Text style={styles.bodyText}>
          DoWork trainers join by invite. Enter the code you were given to open your Studio and
          publish your profile.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Invite code</Text>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(next) => setCode(next.toUpperCase())}
            placeholder="ABCD2345WXYZ"
            placeholderTextColor={DW_TEXT.disabled}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={16}
            editable={!submitting}
            accessibilityLabel="Invite code"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Display name (optional)</Text>
          <TextInput
            style={styles.textInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How your name appears on your profile"
            placeholderTextColor={DW_TEXT.disabled}
            autoCapitalize="words"
            editable={!submitting}
            accessibilityLabel="Display name"
          />
          <Text style={styles.hint}>Leave blank to use your existing DoWork profile name.</Text>
        </View>

        {phase.state === 'error' ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{phase.message}</Text>
          </View>
        ) : null}

        {needsEmail ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>
              Email sign-in is required before redeeming this invite so your trainer profile can be
              recovered on a new device.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.noticeButton, pressed && { opacity: 0.86 }]}
              onPress={() => router.push('/(root)/account' as never)}
              accessibilityRole="button"
              accessibilityLabel="Add email first"
            >
              <Text style={styles.noticeButtonText}>Add email first</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && { opacity: 0.86 },
            (submitting || !code.trim() || needsEmail) && { opacity: 0.5 },
          ]}
          onPress={() => void submit()}
          disabled={submitting || !code.trim() || needsEmail}
          accessibilityRole="button"
          accessibilityLabel="Redeem invite"
        >
          {submitting ? (
            <ActivityIndicator color={DW_ON_ACCENT} />
          ) : (
            <Text style={styles.primaryLabel}>Redeem invite</Text>
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
  codeInput: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    letterSpacing: 3,
    color: DW_TEXT.primary,
    textAlign: 'center',
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
  hint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
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
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  noticeText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    color: DW_TEXT.secondary,
    lineHeight: 20,
  },
  noticeButton: {
    alignSelf: 'flex-start',
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: DW_SURFACES.mid,
  },
  noticeButtonText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.primary,
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
  pushPrompt: {
    marginTop: 8,
  },
});
