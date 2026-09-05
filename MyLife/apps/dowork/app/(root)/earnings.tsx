// Trainer Studio earnings.
//
// Gated on the caller owning a dw_trainers row (same gate as studio.tsx). Reads
// the security-definer RPC dw_get_trainer_earnings() for the monthly gross, plus
// the trainer row for subscriber count and current tier price. Copy is honest:
// gross is the store price before Apple/Google take their cut, and the trainer's
// payout split is still being finalized (founder decision F4). dw_purchase_events
// is never read directly.

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { KeyRound } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import { getMyTrainerProfile, getTrainerPriceTier, type CloudTrainerProfile } from './data/cloud-trainers';
import { getTrainerEarnings, type TrainerEarningsMonth } from './data/cloud-subscriptions';
import { WorkoutRouteHeader } from './phase3-kit';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from './theme/tokens';

type Screen =
  | { state: 'loading' }
  | { state: 'unreachable'; message: string }
  | { state: 'cloud-off'; message?: string }
  | { state: 'not-trainer' }
  | { state: 'error'; message: string }
  | { state: 'ready'; trainer: CloudTrainerProfile; months: TrainerEarningsMonth[] };

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default function EarningsScreen() {
  const router = useRouter();
  const { supabase, userId, isReady, status, error, retryConnection } = useDoWorkCloud();
  const [screen, setScreen] = useState<Screen>({ state: 'loading' });

  const load = useCallback(async () => {
    if (!isReady) {
      setScreen({ state: 'loading' });
      return;
    }
    if (status === 'unreachable' || status === 'error') {
      setScreen({ state: 'unreachable', message: error ?? "Can't reach the server right now." });
      return;
    }
    if (status === 'unconfigured') {
      setScreen({ state: 'cloud-off', message: error ?? "Cloud features aren't configured in this build." });
      return;
    }
    if (!supabase || !userId) {
      setScreen({ state: 'cloud-off' });
      return;
    }
    const trainerResult = await getMyTrainerProfile(supabase, userId);
    if (!trainerResult.ok) {
      setScreen({ state: 'error', message: trainerResult.error });
      return;
    }
    if (!trainerResult.trainer) {
      setScreen({ state: 'not-trainer' });
      return;
    }
    const earningsResult = await getTrainerEarnings(supabase);
    if (!earningsResult.ok) {
      setScreen({ state: 'error', message: earningsResult.error });
      return;
    }
    setScreen({ state: 'ready', trainer: trainerResult.trainer, months: earningsResult.months });
  }, [error, isReady, status, supabase, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (screen.state === 'loading') {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={DW_ACCENT} />
        <Text style={styles.centeredText}>Loading your earnings…</Text>
      </View>
    );
  }

  if (
    screen.state === 'cloud-off' ||
    screen.state === 'not-trainer' ||
    screen.state === 'error' ||
    screen.state === 'unreachable'
  ) {
    const gateTitle =
      screen.state === 'unreachable'
        ? "Can't reach the server right now."
        : screen.state === 'cloud-off'
        ? 'Cloud connection needed'
        : screen.state === 'error'
          ? "Can't load earnings"
          : 'Trainer access is invite-only';
    const gateBody =
      screen.state === 'unreachable'
        ? screen.message
        : screen.state === 'cloud-off'
        ? screen.message ?? 'Earnings need a cloud connection. Reconnect and try again.'
        : screen.state === 'error'
          ? screen.message
          : 'Earnings are for DoWork trainers. Redeem an invite code to open your Studio.';
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <WorkoutRouteHeader title="Earnings" overline="Trainer Studio" onBack={() => router.back()} />
        <View style={styles.gate}>
          <View style={styles.gateIcon}>
            <KeyRound size={26} color={DW_ACCENT} />
          </View>
          <Text style={styles.gateTitle}>{gateTitle}</Text>
          <Text style={styles.gateBody}>{gateBody}</Text>
          <Pressable
            style={styles.gateButton}
            onPress={() => {
              if (screen.state === 'not-trainer') {
                router.push('/(root)/redeem-invite' as never);
              } else if (screen.state === 'unreachable') {
                setScreen({ state: 'loading' });
                void retryConnection();
              } else {
                void load();
              }
            }}
            accessibilityRole="button"
          >
            <Text style={styles.gateButtonText}>
              {screen.state === 'not-trainer' ? 'Redeem an invite' : 'Try again'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { trainer, months } = screen;
  const tier = getTrainerPriceTier(trainer.priceTier);
  const totalGross = months.reduce((sum, month) => sum + month.grossUsd, 0);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutRouteHeader title="Earnings" overline={`@${trainer.handle ?? 'trainer'}`} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{trainer.subscriberCount}</Text>
            <Text style={styles.summaryLabel}>
              {trainer.subscriberCount === 1 ? 'Subscriber' : 'Subscribers'}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{tier.label}</Text>
            <Text style={styles.summaryLabel}>Current price</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{formatUsd(totalGross)}</Text>
            <Text style={styles.summaryLabel}>Gross to date</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Monthly gross</Text>
        {months.length > 0 ? (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHead]}>
              <Text style={[styles.th, styles.colMonth]}>Month</Text>
              <Text style={[styles.th, styles.colEvents]}>Paid events</Text>
              <Text style={[styles.th, styles.colGross]}>Gross</Text>
            </View>
            {months.map((month) => (
              <View key={month.month} style={styles.tableRow}>
                <Text style={[styles.td, styles.colMonth]}>{formatMonth(month.month)}</Text>
                <Text style={[styles.tdMuted, styles.colEvents]}>{month.paidEvents}</Text>
                <Text style={[styles.td, styles.colGross]}>{formatUsd(month.grossUsd)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No paid subscriptions yet. Your monthly gross will appear here as subscribers join.
            </Text>
          </View>
        )}

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>How payouts work</Text>
          <Text style={styles.noteBody}>
            Gross is the subscription price before Apple or Google take their store cut (typically 15
            to 30 percent). Your payout share of the remaining net is being finalized and will show
            here once it&rsquo;s set.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DW_SURFACES.base,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DW_SURFACES.base,
    gap: 12,
  },
  centeredText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 60,
    gap: 16,
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  gateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
  },
  gateTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 22,
    color: DW_TEXT.primary,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  gateBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  gateButton: {
    marginTop: 8,
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  gateButtonText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_ON_ACCENT,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 4,
    alignItems: 'center',
  },
  summaryValue: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 20,
    color: DW_TEXT.primary,
    letterSpacing: -0.4,
  },
  summaryLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    color: DW_TEXT.tertiary,
    textAlign: 'center',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.secondary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  table: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomColor: DW_BORDER.subtle,
    borderBottomWidth: 1,
  },
  tableHead: {
    backgroundColor: DW_SURFACES.mid,
  },
  th: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    color: DW_TEXT.tertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  td: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_TEXT.primary,
  },
  tdMuted: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
  },
  colMonth: {
    flex: 1.4,
  },
  colEvents: {
    flex: 1,
    textAlign: 'center',
  },
  colGross: {
    flex: 1,
    textAlign: 'right',
  },
  emptyCard: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  emptyText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.tertiary,
    lineHeight: 21,
  },
  noteCard: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  noteTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_TEXT.primary,
  },
  noteBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    lineHeight: 20,
  },
});
