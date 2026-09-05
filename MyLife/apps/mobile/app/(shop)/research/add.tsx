import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createComparison, type ComparisonItem } from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

interface DraftItem {
  name: string;
  prosText: string;
  consText: string;
  priceText: string;
  ratingText: string;
  url: string;
}

function blank(): DraftItem {
  return {
    name: '',
    prosText: '',
    consText: '',
    priceText: '',
    ratingText: '',
    url: '',
  };
}

function splitLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parsePriceCents(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseRating(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

export default function AddComparisonScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [winner, setWinner] = useState<string>('');
  const [drafts, setDrafts] = useState<DraftItem[]>([blank(), blank()]);

  const addItem = () => setDrafts((d) => [...d, blank()]);
  const removeItem = (i: number) =>
    setDrafts((d) => (d.length <= 1 ? d : d.filter((_, idx) => idx !== i)));
  const updateItem = (i: number, patch: Partial<DraftItem>) =>
    setDrafts((d) => d.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const onSave = () => {
    const trimmedTitle = title.trim();
    const trimmedCategory = category.trim();
    if (!trimmedTitle || !trimmedCategory) {
      Alert.alert('Missing info', 'Add a title and a category.');
      return;
    }
    const itemsClean: ComparisonItem[] = drafts
      .filter((d) => d.name.trim().length > 0)
      .map((d) => ({
        name: d.name.trim(),
        pros: splitLines(d.prosText),
        cons: splitLines(d.consText),
        priceCents: parsePriceCents(d.priceText),
        rating: parseRating(d.ratingText),
        url: d.url.trim() || null,
      }));
    if (itemsClean.length === 0) {
      Alert.alert('No options', 'Add at least one item to compare.');
      return;
    }
    const winnerNorm = winner.trim();
    const winnerOk =
      !winnerNorm || itemsClean.some((it) => it.name === winnerNorm);
    if (!winnerOk) {
      Alert.alert('Winner mismatch', 'Winner must match one of the item names.');
      return;
    }
    try {
      const created = createComparison(db, {
        title: trimmedTitle,
        category: trimmedCategory,
        items: itemsClean,
        winner: winnerNorm || null,
        reasoningMd: reasoning.trim() || null,
        decidedAt: winnerNorm ? Date.now() : null,
      });
      router.replace(`/(shop)/research/${created.id}`);
    } catch (err) {
      Alert.alert('Could not save', String(err));
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>New comparison</Text>
        <Text style={styles.title}>Lay out the options</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="WH-1000XM5 vs QC45"
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={styles.label}>Category</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="headphones"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {drafts.map((d, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.itemHeader}>
            <Text style={styles.cardTitle}>Option {i + 1}</Text>
            {drafts.length > 1 ? (
              <Pressable onPress={() => removeItem(i)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
          <TextInput
            style={styles.input}
            value={d.name}
            onChangeText={(v) => updateItem(i, { name: v })}
            placeholder="Item name"
            placeholderTextColor={colors.textSecondary}
          />
          <View style={styles.row2}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={d.priceText}
              onChangeText={(v) => updateItem(i, { priceText: v })}
              placeholder="Price (e.g. 399.99)"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={d.ratingText}
              onChangeText={(v) => updateItem(i, { ratingText: v })}
              placeholder="Rating 1-5"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
            />
          </View>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={d.prosText}
            onChangeText={(v) => updateItem(i, { prosText: v })}
            placeholder={'Pros (one per line)'}
            placeholderTextColor={colors.textSecondary}
            multiline
          />
          <TextInput
            style={[styles.input, styles.textarea]}
            value={d.consText}
            onChangeText={(v) => updateItem(i, { consText: v })}
            placeholder={'Cons (one per line)'}
            placeholderTextColor={colors.textSecondary}
            multiline
          />
          <TextInput
            style={styles.input}
            value={d.url}
            onChangeText={(v) => updateItem(i, { url: v })}
            placeholder="URL (optional)"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
        </View>
      ))}

      <Pressable style={styles.secondary} onPress={addItem}>
        <Text style={styles.secondaryText}>+ Add another option</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.label}>Winner (must match an item name)</Text>
        <TextInput
          style={styles.input}
          value={winner}
          onChangeText={setWinner}
          placeholder="Optional"
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={styles.label}>Reasoning</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={reasoning}
          onChangeText={setReasoning}
          placeholder="Why this option, in your own words..."
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </View>

      <Pressable style={styles.primary} onPress={onSave}>
        <Text style={styles.primaryText}>Save comparison</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 14 },
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
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  removeText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
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
  row2: { flexDirection: 'row', gap: 10 },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  secondary: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SHOP_ACCENT,
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  secondaryText: { color: SHOP_ACCENT, fontSize: 13, fontWeight: '800' },
});
