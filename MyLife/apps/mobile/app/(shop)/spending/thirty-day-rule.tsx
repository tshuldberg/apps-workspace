import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  addToWaitList,
  listAllWaitItems,
  markBought,
  markSkipped,
  getConversionRate,
  getTotalSavedBySkipping,
  getDaysRemaining,
  isReadyForDecision,
  type ThirtyDayRuleItem,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

function formatCents(cents: number): string {
  if (!cents) return '$0';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function parsePriceToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function ThirtyDayRuleScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const allItems: ThirtyDayRuleItem[] = useMemo(() => {
    try {
      return listAllWaitItems(db);
    } catch {
      return [];
    }
  }, [db, tick]);

  const waiting = useMemo(
    () => allItems.filter((i) => i.decision === 'waiting'),
    [allItems],
  );
  const conversion = useMemo(() => getConversionRate(allItems), [allItems]);
  const saved = useMemo(() => getTotalSavedBySkipping(allItems), [allItems]);

  const onAdd = () => {
    const trimmedName = name.trim();
    const cents = parsePriceToCents(price);
    if (!trimmedName || cents == null) {
      Alert.alert('Missing info', 'Enter an item name and a valid price.');
      return;
    }
    try {
      addToWaitList(db, {
        itemName: trimmedName,
        priceCents: cents,
        reasonMd: reason.trim() || null,
      });
      setName('');
      setPrice('');
      setReason('');
      setTick((t) => t + 1);
    } catch (err) {
      Alert.alert('Could not add', String(err));
    }
  };

  const onBuy = (id: string) => {
    markBought(db, id);
    setTick((t) => t + 1);
  };

  const onSkip = (id: string) => {
    markSkipped(db, id);
    setTick((t) => t + 1);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>30-day rule</Text>
        <Text style={styles.title}>Park it, then decide</Text>
        <Text style={styles.subtitle}>
          Wait 30 days before buying non-essentials. If you still want it, buy.
          Otherwise, skip and keep the cash.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>I want to buy...</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Item name"
          placeholderTextColor={colors.textSecondary}
        />
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="Price (e.g. 249.99)"
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          value={reason}
          onChangeText={setReason}
          placeholder="Why do you want this?"
          placeholderTextColor={colors.textSecondary}
          multiline
        />
        <Pressable style={styles.primary} onPress={onAdd}>
          <Text style={styles.primaryText}>+ Add to 30-day wait</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Waiting ({waiting.length})</Text>
        {waiting.length === 0 ? (
          <Text style={styles.empty}>
            Nothing waiting right now. Add an item above and see how you feel in 30 days.
          </Text>
        ) : (
          <View style={styles.waitList}>
            {waiting.map((item) => {
              const remaining = getDaysRemaining(
                { addedAt: item.addedAt },
                Date.now(),
              );
              const ready = isReadyForDecision(
                { addedAt: item.addedAt, decision: item.decision },
                Date.now(),
              );
              const badgeColor = ready ? SHOP_ACCENT : '#F59E0B';
              const badgeLabel = ready ? 'Ready to decide' : `${remaining} days left`;
              return (
                <View key={item.id} style={styles.waitItem}>
                  <View style={styles.waitHeader}>
                    <Text style={styles.waitName}>{item.itemName}</Text>
                    <View
                      style={[
                        styles.countdownBadge,
                        { backgroundColor: badgeColor + '22', borderColor: badgeColor },
                      ]}
                    >
                      <Text style={[styles.countdownText, { color: badgeColor }]}>
                        {badgeLabel}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.waitPrice}>{formatCents(item.priceCents)}</Text>
                  {item.reasonMd ? (
                    <Text style={styles.waitReason}>{item.reasonMd}</Text>
                  ) : null}
                  <View style={styles.waitActions}>
                    <Pressable
                      style={[styles.actionBtn, styles.buyBtn]}
                      onPress={() => onBuy(item.id)}
                    >
                      <Text style={styles.buyText}>Buy it</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, styles.passBtn]}
                      onPress={() => onSkip(item.id)}
                    >
                      <Text style={styles.passText}>Pass</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Conversion</Text>
          <Text style={styles.statValue}>
            {Math.round(conversion.conversionRate * 100)}%
          </Text>
          <Text style={styles.statMeta}>
            {conversion.bought} bought / {conversion.decided} decided
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Saved by skipping</Text>
          <Text style={[styles.statValue, { color: SHOP_ACCENT }]}>
            {formatCents(saved)}
          </Text>
          <Text style={styles.statMeta}>{conversion.skipped} items skipped</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 16 },
  hero: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
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
  title: { color: colors.text, fontSize: 26, fontWeight: '800', lineHeight: 32 },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
  },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: SHOP_ACCENT,
  },
  primaryText: { color: '#0E0E13', fontWeight: '800', fontSize: 15 },
  empty: { color: colors.textSecondary, fontSize: 13 },
  waitList: { gap: 12 },
  waitItem: {
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  waitHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  waitName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  waitPrice: { color: SHOP_ACCENT, fontSize: 13, fontWeight: '700' },
  waitReason: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  countdownBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  countdownText: { fontSize: 11, fontWeight: '800' },
  waitActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  buyBtn: { backgroundColor: SHOP_ACCENT, borderColor: SHOP_ACCENT },
  buyText: { color: '#0E0E13', fontWeight: '800', fontSize: 13 },
  passBtn: { backgroundColor: 'transparent', borderColor: colors.border },
  passText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    gap: 4,
    padding: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  statMeta: { color: colors.textSecondary, fontSize: 11 },
});
