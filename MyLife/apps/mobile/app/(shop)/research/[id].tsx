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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  deleteComparison,
  getComparisonById,
  linkComparisonToPurchase,
  listPurchases,
  type Comparison,
  type Purchase,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default function ComparisonDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tick, setTick] = useState(0);
  const [linkQuery, setLinkQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const comparison: Comparison | null = useMemo(() => {
    try {
      return id ? getComparisonById(db, id) : null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, id, tick]);

  const purchaseMatches: Purchase[] = useMemo(() => {
    const q = linkQuery.trim().toLowerCase();
    if (!q) return [];
    try {
      return listPurchases(db)
        .filter((p) => p.name.toLowerCase().includes(q))
        .slice(0, 8);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, linkQuery, tick]);

  if (!comparison) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Comparison not found.</Text>
      </View>
    );
  }

  const onLink = (purchaseId: string) => {
    try {
      linkComparisonToPurchase(db, comparison.id, purchaseId);
      setLinkQuery('');
      setTick((t) => t + 1);
    } catch (err) {
      Alert.alert('Could not link', String(err));
    }
  };

  const onDelete = () => {
    Alert.alert('Delete comparison?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteComparison(db, comparison.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{comparison.category}</Text>
        <Text style={styles.title}>{comparison.title}</Text>
        {comparison.winner ? (
          <View style={styles.winnerRow}>
            <Text style={styles.winnerLabel}>Winner</Text>
            <Text style={styles.winnerName}>{comparison.winner}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.itemsGrid}>
        {comparison.items.map((item, idx) => {
          const isWinner =
            comparison.winner != null && comparison.winner === item.name;
          return (
            <View
              key={`${item.name}-${idx}`}
              style={[styles.itemCard, isWinner && styles.itemCardWinner]}
            >
              <View style={styles.itemHead}>
                <Text style={styles.itemName}>{item.name}</Text>
                {isWinner ? (
                  <View style={styles.pickedBadge}>
                    <Text style={styles.pickedText}>Picked</Text>
                  </View>
                ) : null}
              </View>
              {item.priceCents != null || item.rating != null ? (
                <Text style={styles.itemMeta}>
                  {item.priceCents != null ? formatCents(item.priceCents) : ''}
                  {item.priceCents != null && item.rating != null ? ' · ' : ''}
                  {item.rating != null ? `${item.rating}/5` : ''}
                </Text>
              ) : null}
              {item.pros.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Pros</Text>
                  {item.pros.map((p, i) => (
                    <Text key={i} style={styles.proRow}>
                      + {p}
                    </Text>
                  ))}
                </View>
              ) : null}
              {item.cons.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Cons</Text>
                  {item.cons.map((c, i) => (
                    <Text key={i} style={styles.conRow}>
                      − {c}
                    </Text>
                  ))}
                </View>
              ) : null}
              {item.url ? <Text style={styles.url}>{item.url}</Text> : null}
            </View>
          );
        })}
      </View>

      {comparison.reasoningMd ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reasoning</Text>
          <Text style={styles.body}>{comparison.reasoningMd}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Link to a purchase</Text>
        {comparison.purchaseId ? (
          <Text style={styles.body}>
            Linked to purchase id {comparison.purchaseId}.
          </Text>
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={linkQuery}
              onChangeText={setLinkQuery}
              placeholder="Search purchases by name"
              placeholderTextColor={colors.textSecondary}
            />
            {purchaseMatches.length === 0 && linkQuery.trim().length > 0 ? (
              <Text style={styles.body}>No matching purchases.</Text>
            ) : null}
            {purchaseMatches.map((p) => (
              <Pressable
                key={p.id}
                style={styles.matchRow}
                onPress={() => onLink(p.id)}
              >
                <Text style={styles.matchName}>{p.name}</Text>
                <Text style={styles.matchMeta}>
                  {p.purchaseDate} · {formatCents(p.priceCents)}
                </Text>
              </Pressable>
            ))}
          </>
        )}
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.dangerBtn} onPress={onDelete}>
          <Text style={styles.dangerText}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 14 },
  empty: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
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
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  winnerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  winnerLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  winnerName: { color: SHOP_ACCENT, fontSize: 15, fontWeight: '800' },
  itemsGrid: { gap: 12 },
  itemCard: {
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemCardWinner: { borderColor: SHOP_ACCENT, borderWidth: 2 },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  pickedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: SHOP_ACCENT,
  },
  pickedText: { color: SHOP_ACCENT, fontSize: 11, fontWeight: '800' },
  itemMeta: { color: colors.textSecondary, fontSize: 13 },
  section: { gap: 4 },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  proRow: { color: colors.text, fontSize: 13, lineHeight: 19 },
  conRow: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  url: { color: SHOP_ACCENT, fontSize: 12 },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
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
  matchRow: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  matchName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  matchMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  dangerBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  dangerText: { color: '#EF4444', fontWeight: '800', fontSize: 13 },
});
