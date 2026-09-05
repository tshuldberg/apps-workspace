import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createWishlistItem,
  listGiftPeople,
  searchSizesByBrand,
  type Category,
  type GiftPerson,
  type Priority,
  type Size,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { PRIORITY_COLOR, SHOP_ACCENT } from '../_ui';

const CATEGORIES: Category[] = [
  'tech', 'clothing', 'books', 'home', 'kitchen',
  'gaming', 'music', 'sports', 'gifts', 'hobby', 'other',
];
const PRIORITIES: Priority[] = ['need', 'want', 'someday', 'dream'];

function parseCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function AddWishlistItemScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ listId: string }>();
  const listId = Array.isArray(params.listId) ? params.listId[0] : params.listId;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [priority, setPriority] = useState<Priority>('want');
  const [price, setPrice] = useState('');
  const [rangeLow, setRangeLow] = useState('');
  const [rangeHigh, setRangeHigh] = useState('');
  const [url, setUrl] = useState('');
  const [store, setStore] = useState('');
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');
  const [sizeNotes, setSizeNotes] = useState('');
  const [occasionTag, setOccasionTag] = useState('');
  const [giftForPersonId, setGiftForPersonId] = useState<string | null>(null);
  const [showSizeLookup, setShowSizeLookup] = useState(false);

  const giftPeople = useMemo<GiftPerson[]>(() => {
    try {
      return listGiftPeople(db);
    } catch {
      return [];
    }
  }, [db]);

  const sizeMatches = useMemo<Size[]>(() => {
    if (!showSizeLookup) return [];
    const query = brand.trim();
    if (!query) return [];
    try {
      return searchSizesByBrand(db, query);
    } catch {
      return [];
    }
  }, [db, brand, showSizeLookup]);

  if (!listId) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Missing list id</Text>
      </View>
    );
  }

  const handleAdd = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Enter an item name.');
      return;
    }
    try {
      createWishlistItem(db, {
        listId,
        name: name.trim(),
        category,
        priority,
        priceCents: parseCents(price),
        priceRangeLow: parseCents(rangeLow),
        priceRangeHigh: parseCents(rangeHigh),
        url: url.trim() || null,
        store: store.trim() || null,
        brand: brand.trim() || null,
        notesMd: notes.trim() || null,
        sizeNotes: sizeNotes.trim() || null,
        occasionTag: occasionTag.trim() || null,
        giftForPersonId: giftForPersonId,
      });
      router.back();
    } catch {
      Alert.alert('Error', "Couldn't add item.");
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add item</Text>

      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="What do you want?"
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.pillRow}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.pill, category === c && styles.pillActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.pillText, category === c && styles.pillTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Priority</Text>
      <View style={styles.pillRow}>
        {PRIORITIES.map((p) => (
          <Pressable
            key={p}
            style={[
              styles.pill,
              priority === p && { backgroundColor: PRIORITY_COLOR[p], borderColor: PRIORITY_COLOR[p] },
            ]}
            onPress={() => setPriority(p)}
          >
            <Text style={[styles.pillText, priority === p && styles.pillTextActive]}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Price (USD)</Text>
      <TextInput
        style={styles.input}
        placeholder="49.99"
        placeholderTextColor={colors.textSecondary}
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
      />

      <View style={styles.rangeRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Range low</Text>
          <TextInput
            style={styles.input}
            placeholder="20"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            value={rangeLow}
            onChangeText={setRangeLow}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Range high</Text>
          <TextInput
            style={styles.input}
            placeholder="80"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            value={rangeHigh}
            onChangeText={setRangeHigh}
          />
        </View>
      </View>

      <Text style={styles.label}>URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        value={url}
        onChangeText={setUrl}
      />

      <View style={styles.rangeRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Store</Text>
          <TextInput
            style={styles.input}
            placeholder="Amazon"
            placeholderTextColor={colors.textSecondary}
            value={store}
            onChangeText={setStore}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Brand</Text>
          <TextInput
            style={styles.input}
            placeholder="Apple"
            placeholderTextColor={colors.textSecondary}
            value={brand}
            onChangeText={setBrand}
          />
        </View>
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        placeholder="Why you want it, reminders, alternatives…"
        placeholderTextColor={colors.textSecondary}
        multiline
        value={notes}
        onChangeText={setNotes}
      />

      <View style={styles.sizeLabelRow}>
        <Text style={styles.label}>Size notes</Text>
        <Pressable
          onPress={() => setShowSizeLookup((s) => !s)}
          hitSlop={8}
        >
          <Text style={styles.sizeLookupLink}>
            {showSizeLookup ? 'Hide lookup' : 'Size lookup'}
          </Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.input}
        placeholder="M, 10.5, 30x32…"
        placeholderTextColor={colors.textSecondary}
        value={sizeNotes}
        onChangeText={setSizeNotes}
      />
      {showSizeLookup ? (
        <View style={styles.lookupPanel}>
          {brand.trim().length === 0 ? (
            <Text style={styles.lookupHint}>
              Fill in a brand above to see your stored sizes.
            </Text>
          ) : sizeMatches.length === 0 ? (
            <Text style={styles.lookupHint}>
              No stored sizes for "{brand.trim()}". Save sizes from Settings to
              surface them here.
            </Text>
          ) : (
            sizeMatches.slice(0, 12).map((s) => (
              <Pressable
                key={s.id}
                style={styles.lookupRow}
                onPress={() => setSizeNotes(s.sizeValue)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.lookupBrand}>
                    {s.brand} · {s.type}
                  </Text>
                  {s.fitNotes ? (
                    <Text style={styles.lookupNotes} numberOfLines={1}>
                      {s.fitNotes}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.lookupSize}>{s.sizeValue}</Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      <Text style={styles.label}>Occasion tag</Text>
      <TextInput
        style={styles.input}
        placeholder="birthday, housewarming…"
        placeholderTextColor={colors.textSecondary}
        value={occasionTag}
        onChangeText={setOccasionTag}
      />

      {giftPeople.length > 0 ? (
        <>
          <Text style={styles.label}>Gift for (optional)</Text>
          <View style={styles.pillRow}>
            <Pressable
              style={[styles.pill, giftForPersonId === null && styles.pillActive]}
              onPress={() => setGiftForPersonId(null)}
            >
              <Text
                style={[
                  styles.pillText,
                  giftForPersonId === null && styles.pillTextActive,
                ]}
              >
                no one
              </Text>
            </Pressable>
            {giftPeople.map((p) => (
              <Pressable
                key={p.id}
                style={[
                  styles.pill,
                  giftForPersonId === p.id && styles.pillActive,
                ]}
                onPress={() => setGiftForPersonId(p.id)}
              >
                <Text
                  style={[
                    styles.pillText,
                    giftForPersonId === p.id && styles.pillTextActive,
                  ]}
                >
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Pressable style={styles.primaryButton} onPress={handleAdd}>
        <Text style={styles.primaryButtonText}>Add to wishlist</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 180, gap: 10 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 },
  input: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: SHOP_ACCENT, borderColor: SHOP_ACCENT },
  pillText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  pillTextActive: { color: '#0E0E13' },
  rangeRow: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
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
  sizeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sizeLookupLink: {
    color: SHOP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
  },
  lookupPanel: {
    gap: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lookupHint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lookupBrand: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  lookupNotes: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  lookupSize: { color: SHOP_ACCENT, fontSize: 15, fontWeight: '800' },
});
