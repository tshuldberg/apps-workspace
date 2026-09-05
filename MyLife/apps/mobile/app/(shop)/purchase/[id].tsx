import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  calculateCostPerUse,
  calculateDueReviews,
  deletePurchase,
  getPhotoById,
  getPurchaseById,
  getUsageCount,
  getWorthItStatus,
  logUse,
  markReturned,
  updateSatisfaction,
  type Purchase,
  type ReviewPeriod,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function StarsRow({
  value,
  onChange,
  readOnly,
}: {
  value: number | null;
  onChange?: (n: number) => void;
  readOnly?: boolean;
}) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={readOnly}
          style={styles.starButton}
          onPress={() => onChange?.(n)}
        >
          <Text
            style={[styles.starChar, (value ?? 0) >= n && styles.starCharActive]}
          >
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function PurchaseDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [tick, setTick] = useState(0);
  const [returnReason, setReturnReason] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);

  useFocusEffect(useCallback(() => { setTick((t) => t + 1); }, []));

  const purchase = useMemo<Purchase | null>(() => {
    if (!id) return null;
    try {
      return getPurchaseById(db, id);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, id, tick]);

  const receiptUri = useMemo(() => {
    if (!purchase?.receiptPhotoId) return null;
    try {
      return getPhotoById(db, purchase.receiptPhotoId)?.localUri ?? null;
    } catch {
      return null;
    }
  }, [db, purchase]);

  const productUri = useMemo(() => {
    if (!purchase?.photoId) return null;
    try {
      return getPhotoById(db, purchase.photoId)?.localUri ?? null;
    } catch {
      return null;
    }
  }, [db, purchase]);

  const dueReviews = useMemo<ReviewPeriod[]>(() => {
    if (!purchase) return [];
    return calculateDueReviews([purchase]).map((d) => d.period);
  }, [purchase]);

  const usageCount = useMemo<number>(() => {
    if (!purchase) return 0;
    try {
      return getUsageCount(db, purchase.id);
    } catch {
      return 0;
    }
  }, [db, purchase, tick]);

  const costPerUseCents = purchase
    ? calculateCostPerUse(purchase.priceCents, usageCount)
    : 0;
  const worthItStatus = getWorthItStatus(costPerUseCents);
  const initialCpuCents = purchase
    ? calculateCostPerUse(purchase.priceCents, 1)
    : 0;

  if (!purchase) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Purchase not found</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert('Delete purchase?', `Remove "${purchase.name}" from your journal?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deletePurchase(db, purchase.id);
          router.back();
        },
      },
    ]);
  };

  const handleRateInitial = (n: number) => {
    updateSatisfaction(db, purchase.id, 'initial', n);
    setTick((t) => t + 1);
  };

  const handleRate30 = (n: number) => {
    updateSatisfaction(db, purchase.id, '30day', n);
    setTick((t) => t + 1);
  };

  const handleRate90 = (n: number) => {
    updateSatisfaction(db, purchase.id, '90day', n);
    setTick((t) => t + 1);
  };

  const handleMarkReturned = () => {
    markReturned(db, purchase.id, {
      returnReason: returnReason.trim() || null,
      returnedAt: new Date().toISOString(),
    });
    setShowReturnForm(false);
    setTick((t) => t + 1);
  };

  const handleLogUse = () => {
    logUse(db, { purchaseId: purchase.id });
    setTick((t) => t + 1);
  };

  const handleOpenUrl = async () => {
    if (purchase.url) {
      try {
        await Linking.openURL(purchase.url);
      } catch {
        // ignore link open failures
      }
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{purchase.category}</Text>
        <Text style={styles.title}>{purchase.name}</Text>
        <Text style={styles.price}>{formatCents(purchase.priceCents)}</Text>
        <View style={styles.badgeRow}>
          {purchase.isImpulse ? <Text style={styles.impulseBadge}>impulse</Text> : null}
          {purchase.returned ? <Text style={styles.returnedBadge}>returned</Text> : null}
        </View>
      </View>

      {dueReviews.length > 0 && !purchase.returned ? (
        <View style={styles.reviewPrompt}>
          <Text style={styles.reviewPromptTitle}>How do you feel about this now?</Text>
          <Text style={styles.reviewPromptBody}>
            {dueReviews.includes('30day')
              ? 'It\'s been at least 30 days. Rate your current satisfaction.'
              : 'It\'s been at least 90 days. How is this holding up?'}
          </Text>
          <StarsRow
            value={
              dueReviews.includes('30day')
                ? purchase.satisfaction30day
                : purchase.satisfaction90day
            }
            onChange={(n) => {
              if (dueReviews.includes('30day')) handleRate30(n);
              else handleRate90(n);
            }}
          />
        </View>
      ) : null}

      <View style={styles.detailCard}>
        <DetailRow label="Date" value={purchase.purchaseDate.slice(0, 10)} />
        <DetailRow label="Store" value={purchase.store} />
        <DetailRow label="Brand" value={purchase.brand} />
        <DetailRow label="Payment" value={purchase.paymentMethod?.replace('_', ' ') ?? null} />
        <DetailRow
          label="Return deadline"
          value={purchase.returnDeadline?.slice(0, 10) ?? null}
        />
      </View>

      <View style={styles.detailCard}>
        <View style={styles.cpuHeaderRow}>
          <Text style={styles.sectionTitle}>Cost-per-use</Text>
          {usageCount > 0 && worthItStatus === 'worth-it' ? (
            <Text style={styles.worthItBadge}>worth it</Text>
          ) : null}
          {usageCount > 0 && worthItStatus === 'approaching' ? (
            <Text style={styles.approachingBadge}>approaching</Text>
          ) : null}
        </View>
        <Text style={styles.cpuPrimary}>
          {usageCount > 0
            ? `${formatCents(Math.round(costPerUseCents))} per use`
            : 'No uses logged yet'}
        </Text>
        <Text style={styles.cpuMeta}>
          Used {usageCount} time{usageCount === 1 ? '' : 's'}
        </Text>
        {usageCount > 1 ? (
          <Text style={styles.cpuTrend}>
            Cost-per-use: {formatCents(Math.round(initialCpuCents))} →{' '}
            {formatCents(Math.round(costPerUseCents))} after {usageCount} uses
          </Text>
        ) : null}
        <Pressable
          style={styles.primaryButton}
          onPress={handleLogUse}
          accessibilityLabel="Log a use"
        >
          <Text style={styles.primaryButtonText}>Log a use</Text>
        </Pressable>
      </View>

      {receiptUri ? (
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Receipt</Text>
          <Image source={{ uri: receiptUri }} style={styles.photo} />
        </View>
      ) : null}

      {productUri ? (
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Product photo</Text>
          <Image source={{ uri: productUri }} style={styles.photo} />
        </View>
      ) : null}

      <View style={styles.detailCard}>
        <Text style={styles.sectionTitle}>Satisfaction</Text>
        <View style={styles.satGroup}>
          <Text style={styles.satLabel}>Initial</Text>
          <StarsRow value={purchase.satisfactionInitial} onChange={handleRateInitial} />
        </View>
        <View style={styles.satGroup}>
          <Text style={styles.satLabel}>30-day</Text>
          <StarsRow
            value={purchase.satisfaction30day}
            onChange={handleRate30}
          />
        </View>
        <View style={styles.satGroup}>
          <Text style={styles.satLabel}>90-day</Text>
          <StarsRow
            value={purchase.satisfaction90day}
            onChange={handleRate90}
          />
        </View>
      </View>

      {purchase.researchNotesMd ? (
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Research notes</Text>
          <Text style={styles.paragraph}>{purchase.researchNotesMd}</Text>
        </View>
      ) : null}

      {purchase.notesMd ? (
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.paragraph}>{purchase.notesMd}</Text>
        </View>
      ) : null}

      {purchase.returned ? (
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Return reason</Text>
          <Text style={styles.paragraph}>{purchase.returnReason || '—'}</Text>
        </View>
      ) : null}

      {purchase.url ? (
        <Pressable style={styles.secondaryButton} onPress={handleOpenUrl}>
          <Text style={styles.secondaryButtonText}>Open link</Text>
        </Pressable>
      ) : null}

      {!purchase.returned ? (
        showReturnForm ? (
          <View style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Why are you returning this?</Text>
            <TextInput
              style={styles.input}
              value={returnReason}
              onChangeText={setReturnReason}
              placeholder="Didn't fit, wrong color, changed my mind…"
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <View style={styles.rowBtn}>
              <Pressable style={styles.secondaryButton} onPress={() => setShowReturnForm(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={handleMarkReturned}>
                <Text style={styles.primaryButtonText}>Mark returned</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.secondaryButton} onPress={() => setShowReturnForm(true)}>
            <Text style={styles.secondaryButtonText}>Mark as returned</Text>
          </Pressable>
        )
      ) : null}

      <Pressable
        style={styles.secondaryButton}
        onPress={() => router.push(`/(shop)/purchase/edit/${purchase.id}`)}
      >
        <Text style={styles.secondaryButtonText}>Edit</Text>
      </Pressable>
      <Pressable style={styles.dangerButton} onPress={handleDelete}>
        <Text style={styles.dangerButtonText}>Delete purchase</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 12 },
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
  price: { color: SHOP_ACCENT, fontSize: 22, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  impulseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(239,68,68,0.14)',
    color: '#FF6B6B',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  returnedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  reviewPrompt: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  reviewPromptTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  reviewPromptBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
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
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  paragraph: { color: colors.text, fontSize: 14, lineHeight: 20 },
  photo: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    backgroundColor: surfaceTiers.lowest,
  },
  satGroup: { gap: 4 },
  satLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cpuHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cpuPrimary: { color: SHOP_ACCENT, fontSize: 20, fontWeight: '800' },
  cpuMeta: { color: colors.textSecondary, fontSize: 13 },
  cpuTrend: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  worthItBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.18)',
    color: SHOP_ACCENT,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  approachingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,184,119,0.16)',
    color: '#FFB877',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  starsRow: { flexDirection: 'row', gap: 4 },
  starButton: { padding: 2 },
  starChar: { fontSize: 28, color: 'rgba(255,255,255,0.2)' },
  starCharActive: { color: SHOP_ACCENT },
  input: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rowBtn: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  dangerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  dangerButtonText: { color: '#FF6B6B', fontSize: 14, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
