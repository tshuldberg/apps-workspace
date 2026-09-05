import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { icons } from 'lucide-react-native';
import {
  DisclosureCallout,
  PaymentGlassCard,
  StatusBadge,
  TimelineStepper,
  buildPaymentsRemittanceTrackingViewModel,
} from '@mylife/payments';
import { colors } from '@mylife/ui';
import { REMITTANCE_RECIPIENT } from '../_remittanceDemo';

const BackIcon = icons.ChevronLeft;

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? 'remit_sam_0424' : value ?? 'remit_sam_0424';
}

export default function PaymentsRemittanceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const remittanceId = firstParam(params.id);
  const tracking = useMemo(
    () => buildPaymentsRemittanceTrackingViewModel({
      remittanceId,
      recipient: REMITTANCE_RECIPIENT,
      status: 'sent',
      createdAt: '2026-04-24T16:00:00.000Z',
      lockedAt: '2026-04-24T16:01:00.000Z',
    }),
    [remittanceId],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <BackIcon size={20} color="#F5FBF8" strokeWidth={2} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Remittance</Text>
          <Text style={styles.subtitle}>{tracking.recipient.displayName}</Text>
        </View>
      </View>

      <PaymentGlassCard eyebrow="Tracking" title={tracking.headline}>
        <View style={styles.badgeRow}>
          <StatusBadge tone="info" label={tracking.status} />
          <StatusBadge tone="success" label={tracking.recipient.countryCode} />
        </View>
        <TimelineStepper steps={tracking.timeline} />
      </PaymentGlassCard>

      <DisclosureCallout disclosure={tracking.disclosure} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: 18, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  headerText: { flex: 1, gap: 4 },
  title: { color: '#F5FBF8', fontSize: 30, fontWeight: '700' },
  subtitle: { color: 'rgba(245,251,248,0.68)', fontSize: 15, lineHeight: 21 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
