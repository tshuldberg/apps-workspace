// Deep-link join target for dowork://client-invite/<CODE>.
//
// Auto-redeems the code in the URL through the security-definer RPC, then lands
// the client in their trainer space with a welcome state. Invalid / expired /
// already-claimed codes surface honestly with a manual-entry fallback. The
// client never selects dw_client_links by code; the RPC is the only join path.

import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDoWorkCloud } from '../providers/DoWorkCloudProvider';
import { isAnonymousSession } from '../data/auth-session';
import { redeemClientInvite } from '../data/cloud-coaching';
import {
  Card,
  CoachingHeader,
  CoachingScreen,
  ErrorBlock,
  LoadingBlock,
  PrimaryButton,
} from '../components/coaching/coaching-kit';
import { PushPrompt } from '../components/PushPrompt';
import { WK_FONTS } from '@mylife/workouts';
import { DW_TEXT } from '../theme/tokens';

export default function ClientInviteDeepLinkScreen() {
  const router = useRouter();
  const { supabase, isReady, refreshIdentity } = useDoWorkCloud();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = (params.code ?? '').trim();
  const [status, setStatus] = useState<'redeeming' | 'needs-email' | 'error' | 'done'>('redeeming');
  const [message, setMessage] = useState('');
  const attempted = useRef(false);

  const redeem = useCallback(async () => {
    if (!supabase) {
      setStatus('error');
      setMessage('Joining needs a cloud connection. Check your network and try again.');
      return;
    }
    if (await isAnonymousSession(supabase)) {
      setStatus('needs-email');
      setMessage('');
      return;
    }
    if (!code) {
      setStatus('error');
      setMessage('That invite link is missing its code.');
      return;
    }
    setStatus('redeeming');
    const result = await redeemClientInvite(supabase, code);
    if (!result.ok) {
      setStatus('error');
      setMessage(result.error);
      return;
    }
    await refreshIdentity();
    setStatus('done');
  }, [supabase, code, refreshIdentity]);

  useEffect(() => {
    if (!isReady) return;
    if (attempted.current) return;
    attempted.current = true;
    void redeem();
  }, [isReady, redeem]);

  if (status === 'done') {
    return (
      <CoachingScreen>
        <CoachingHeader title="You're in" />
        <View style={styles.doneWrap}>
          <Text style={styles.doneTitle}>You&rsquo;re connected</Text>
          <Text style={styles.hint}>
            Send your trainer a form check any time and get timestamped feedback back.
          </Text>
          <PushPrompt />
          <PrimaryButton
            label="Go to my trainer"
            onPress={() => router.replace('/(root)/my-trainer?welcome=1')}
          />
        </View>
      </CoachingScreen>
    );
  }

  return (
    <CoachingScreen>
      <CoachingHeader title="Join your trainer" />
      {status === 'redeeming' ? (
        <LoadingBlock label="Redeeming your invite…" />
      ) : status === 'needs-email' ? (
        <View style={styles.errorWrap}>
          <Card style={styles.noticeCard}>
            <Text style={styles.noticeText}>
              Email sign-in is required before joining this trainer so your coaching link can be
              recovered on a new device.
            </Text>
            <PrimaryButton
              label="Add email first"
              onPress={() => router.push('/(root)/account' as never)}
            />
          </Card>
          <PrimaryButton
            label="Enter code manually"
            onPress={() => router.replace('/(root)/client-invite')}
          />
        </View>
      ) : (
        <View style={styles.errorWrap}>
          <ErrorBlock message={message} onRetry={() => void redeem()} />
          <Text style={styles.hint}>
            Double-check the link, or enter the code by hand.
          </Text>
          <PrimaryButton
            label="Enter code manually"
            onPress={() => router.replace('/(root)/client-invite')}
          />
        </View>
      )}
    </CoachingScreen>
  );
}

const styles = StyleSheet.create({
  errorWrap: {
    gap: 14,
    paddingHorizontal: 16,
  },
  doneWrap: {
    gap: 14,
    paddingHorizontal: 16,
  },
  doneTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 22,
    color: DW_TEXT.primary,
    letterSpacing: -0.4,
  },
  hint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    lineHeight: 18,
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
});
