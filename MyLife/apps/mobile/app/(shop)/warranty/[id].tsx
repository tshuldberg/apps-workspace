import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  deleteWarranty,
  getDaysUntilExpiry,
  getPurchaseById,
  getWarrantyById,
  getWarrantyStatus,
  type Purchase,
  type Warranty,
  type WarrantyStatus,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

const STATUS_COLOR: Record<WarrantyStatus, string> = {
  active: SHOP_ACCENT,
  'expiring-soon': '#FFB877',
  expired: 'rgba(255,255,255,0.5)',
  claimed: '#8BCFF0',
};

const STATUS_LABEL: Record<WarrantyStatus, string> = {
  active: 'Active',
  'expiring-soon': 'Expiring soon',
  expired: 'Expired',
  claimed: 'Claim filed',
};

function formatMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function WarrantyDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [tick, setTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const warranty = useMemo<Warranty | null>(() => {
    if (!id) return null;
    try {
      return getWarrantyById(db, id);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, id, tick]);

  const linkedPurchase = useMemo<Purchase | null>(() => {
    if (!warranty?.purchaseId) return null;
    try {
      return getPurchaseById(db, warranty.purchaseId);
    } catch {
      return null;
    }
  }, [db, warranty]);

  if (!warranty) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Warranty not found</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const status = getWarrantyStatus(warranty);
  const days = getDaysUntilExpiry(warranty.expiryDate);

  const handleDelete = () => {
    Alert.alert(
      'Delete warranty?',
      `Remove "${warranty.itemName}" from your warranty vault?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteWarranty(db, warranty.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{warranty.coverageType}</Text>
        <Text style={styles.title}>{warranty.itemName}</Text>
        <View style={styles.badgeRow}>
          <Text
            style={[
              styles.statusBadge,
              { color: STATUS_COLOR[status], borderColor: STATUS_COLOR[status] },
            ]}
          >
            {STATUS_LABEL[status]}
          </Text>
          {status !== 'claimed' && status !== 'expired' ? (
            <Text style={styles.daysLabel}>
              {days >= 0 ? `${days}d until expiry` : `expired ${Math.abs(days)}d ago`}
            </Text>
          ) : null}
        </View>
      </View>

      {linkedPurchase ? (
        <Pressable
          style={styles.linkedCard}
          onPress={() => router.push(`/(shop)/purchase/${linkedPurchase.id}`)}
        >
          <Text style={styles.sectionTitle}>Linked purchase</Text>
          <Text style={styles.linkedName}>{linkedPurchase.name}</Text>
          <Text style={styles.linkedMeta}>
            {linkedPurchase.purchaseDate.slice(0, 10)}
            {linkedPurchase.store ? ` · ${linkedPurchase.store}` : ''}
            {` · ${formatCents(linkedPurchase.priceCents)}`}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.detailCard}>
        <DetailRow label="Start" value={formatMs(warranty.startDate)} />
        <DetailRow label="Expiry" value={formatMs(warranty.expiryDate)} />
        <DetailRow
          label="Reminder"
          value={`${warranty.reminderDaysBefore}d before expiry`}
        />
        <DetailRow label="Serial" value={warranty.serialNumber} />
        <DetailRow
          label="Registration"
          value={warranty.registrationNumber}
        />
      </View>

      {warranty.coverageDetailsMd ? (
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Coverage details</Text>
          <Text style={styles.paragraph}>{warranty.coverageDetailsMd}</Text>
        </View>
      ) : null}

      {warranty.claimFiled ? (
        <View style={styles.claimCard}>
          <Text style={styles.sectionTitle}>Claim history</Text>
          <Text style={styles.paragraph}>
            {warranty.claimNotes ?? 'Claim filed. No notes recorded.'}
          </Text>
          <Text style={styles.claimMeta}>
            Filed {new Date(warranty.updatedAt).toISOString().slice(0, 10)}
          </Text>
        </View>
      ) : (
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push(`/(shop)/warranty/claim/${warranty.id}`)}
        >
          <Text style={styles.primaryButtonText}>File a claim</Text>
        </Pressable>
      )}

      <Pressable style={styles.dangerButton} onPress={handleDelete}>
        <Text style={styles.dangerButtonText}>Delete warranty</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 12,
  },
  header: {
    gap: 6,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SHOP_ACCENT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  daysLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  linkedCard: {
    gap: 4,
    padding: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkedName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  linkedMeta: { color: colors.textSecondary, fontSize: 12 },
  detailCard: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: colors.textSecondary, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  paragraph: { color: colors.text, fontSize: 14, lineHeight: 20 },
  claimCard: {
    gap: 6,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(139,207,240,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139,207,240,0.28)',
  },
  claimMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  dangerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  dangerButtonText: { color: '#FF6B6B', fontSize: 14, fontWeight: '700' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
