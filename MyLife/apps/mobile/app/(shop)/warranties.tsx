import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  getDaysUntilExpiry,
  getWarrantyStatus,
  listWarranties,
  type Warranty,
  type WarrantyStatus,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { SHOP_ACCENT } from './_ui';

const STATUS_ORDER: WarrantyStatus[] = [
  'expiring-soon',
  'active',
  'claimed',
  'expired',
];

const COVERAGE_COLOR: Record<string, string> = {
  manufacturer: '#8BCFF0',
  extended: '#A78BFA',
  protection: SHOP_ACCENT,
};

function formatMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return 'today';
  if (days === 1) return '1d left';
  return `${days}d left`;
}

export default function ShopWarrantiesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const warranties = useMemo<Warranty[]>(() => {
    try {
      return listWarranties(db);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, tick]);

  const grouped = useMemo(() => {
    const map = new Map<WarrantyStatus, Warranty[]>();
    for (const key of STATUS_ORDER) map.set(key, []);
    for (const w of warranties) {
      const status = getWarrantyStatus(w);
      map.get(status)!.push(w);
    }
    for (const key of STATUS_ORDER) {
      map.get(key)!.sort((a, b) => a.expiryDate - b.expiryDate);
    }
    return map;
  }, [warranties]);

  const sections: Array<{
    status: WarrantyStatus;
    label: string;
    color: string;
  }> = [
    { status: 'expiring-soon', label: 'Expiring soon', color: '#FFB877' },
    { status: 'active', label: 'Active', color: SHOP_ACCENT },
    { status: 'claimed', label: 'Claimed', color: '#8BCFF0' },
    { status: 'expired', label: 'Expired', color: 'rgba(255,255,255,0.4)' },
  ];

  const total = warranties.length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Warranties</Text>
        <Text style={styles.title}>
          {total === 0 ? 'Track your first warranty' : 'Warranty vault'}
        </Text>
        <Text style={styles.subtitle}>
          Never miss an expiration or return window. Coverage lives locally, alerts
          fire before the deadline.
        </Text>
      </View>

      {total === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing tracked yet</Text>
          <Text style={styles.emptyBody}>
            Add a warranty and MyShop will flag expiring coverage and help you file
            claims when things break.
          </Text>
        </View>
      ) : (
        sections.map(({ status, label, color }) => {
          const list = grouped.get(status) ?? [];
          if (list.length === 0) return null;
          return (
            <View key={status} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: color }]} />
                <Text style={styles.sectionLabel}>{label}</Text>
                <Text style={styles.sectionCount}>{list.length}</Text>
              </View>
              {list.map((w) => {
                const days = getDaysUntilExpiry(w.expiryDate);
                const coverageColor =
                  COVERAGE_COLOR[w.coverageType] ?? colors.textSecondary;
                return (
                  <Pressable
                    key={w.id}
                    style={[
                      styles.card,
                      status === 'expired' && styles.cardDim,
                    ]}
                    onPress={() => router.push(`/(shop)/warranty/${w.id}`)}
                  >
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {w.itemName}
                      </Text>
                      <Text style={[styles.coverageBadge, { color: coverageColor, borderColor: coverageColor }]}>
                        {w.coverageType}
                      </Text>
                    </View>
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.meta}>exp {formatMs(w.expiryDate)}</Text>
                      <Text style={styles.metaDot}>·</Text>
                      <Text style={[styles.meta, status === 'expiring-soon' && styles.metaWarn]}>
                        {status === 'claimed' ? 'claim filed' : daysLabel(days)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })
      )}

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push('/(shop)/warranty/add')}
      >
        <Text style={styles.primaryButtonText}>Add a warranty</Text>
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
    gap: 14,
  },
  header: {
    gap: 8,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SHOP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  section: { gap: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionCount: {
    marginLeft: 'auto',
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    gap: 6,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDim: { opacity: 0.55 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  cardName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  coverageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  meta: { color: colors.textSecondary, fontSize: 12 },
  metaWarn: { color: '#FFB877', fontWeight: '700' },
  metaDot: { color: colors.textSecondary, fontSize: 12 },
  emptyCard: {
    gap: 6,
    padding: 20,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  primaryButton: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
});
