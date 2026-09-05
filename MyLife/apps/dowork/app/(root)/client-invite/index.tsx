// Manual client-invite code entry (fallback when the deep link is not tapped).
//
// Redeems through the same security-definer RPC and lands the client in their
// trainer space. Invalid / expired / already-claimed codes surface honestly.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WK_FONTS } from '@mylife/workouts';
import { useDoWorkCloud } from '../providers/DoWorkCloudProvider';
import { isAnonymousSession } from '../data/auth-session';
import { redeemClientInvite } from '../data/cloud-coaching';
import {
  CoachingHeader,
  CoachingScreen,
  Card,
  PrimaryButton,
} from '../components/coaching/coaching-kit';
import { DW_BORDER, DW_SURFACES, DW_TEXT } from '../theme/tokens';

const CODE_LENGTH = 12;

export default function ClientInviteEntryScreen() {
  const router = useRouter();
  const { supabase, isReady, refreshIdentity } = useDoWorkCloud();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter the invite code your trainer gave you.');
      return;
    }
    if (!supabase) {
      setError('Joining needs a cloud connection. Check your network and try again.');
      return;
    }
    if (await isAnonymousSession(supabase)) {
      setNeedsEmail(true);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await redeemClientInvite(supabase, trimmed);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refreshIdentity();
    router.replace('/(root)/my-trainer?welcome=1');
  };

  return (
    <CoachingScreen>
      <CoachingHeader title="Enter invite code" />
      <View style={styles.body}>
        <Text style={styles.intro}>
          Your trainer shares a 12-character code. Enter it here to open your coaching space.
        </Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, CODE_LENGTH))}
          placeholder="ABCDEFGH2345"
          placeholderTextColor={DW_TEXT.disabled}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={CODE_LENGTH}
          accessibilityLabel="Invite code"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {needsEmail ? (
          <Card style={styles.noticeCard}>
            <Text style={styles.noticeText}>
              Email sign-in is required before joining this trainer so your coaching link can be
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
          </Card>
        ) : null}

        <PrimaryButton
          label={busy ? 'Joining…' : 'Join'}
          onPress={handleJoin}
          busy={busy}
          disabled={needsEmail}
        />
      </View>
    </CoachingScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 16,
    gap: 16,
  },
  intro: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    lineHeight: 20,
  },
  input: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: WK_FONTS.extraBold,
    fontSize: 22,
    letterSpacing: 4,
    color: DW_TEXT.primary,
    textAlign: 'center',
  },
  error: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: '#FF9A9A',
    textAlign: 'center',
  },
  noticeCard: {
    marginHorizontal: 0,
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
});
