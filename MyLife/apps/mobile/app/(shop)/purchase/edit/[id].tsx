import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getPurchaseById,
  updatePurchase,
  type Category,
  type PaymentMethod,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../../_ui';

const CATEGORIES: Category[] = [
  'tech', 'clothing', 'books', 'home', 'kitchen',
  'gaming', 'music', 'sports', 'gifts', 'hobby', 'other',
];

const PAYMENT_METHODS: PaymentMethod[] = [
  'credit_card', 'debit_card', 'cash', 'gift_card', 'financing', 'other',
];

function parseCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function EditPurchaseScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [price, setPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [store, setStore] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [brand, setBrand] = useState('');
  const [url, setUrl] = useState('');
  const [isImpulse, setIsImpulse] = useState(false);
  const [notes, setNotes] = useState('');
  const [returnDeadline, setReturnDeadline] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    try {
      const p = getPurchaseById(db, id);
      if (!p) return;
      setName(p.name);
      setCategory(p.category);
      setPrice((p.priceCents / 100).toFixed(2));
      setPurchaseDate(p.purchaseDate.slice(0, 10));
      setStore(p.store ?? '');
      setPaymentMethod(p.paymentMethod);
      setBrand(p.brand ?? '');
      setUrl(p.url ?? '');
      setIsImpulse(p.isImpulse);
      setNotes(p.notesMd ?? '');
      setReturnDeadline(p.returnDeadline?.slice(0, 10) ?? '');
      setLoaded(true);
    } catch {
      // ignore
    }
  }, [db, id]);

  if (!id || !loaded) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Loading…</Text>
      </View>
    );
  }

  const handleSave = () => {
    const priceCents = parseCents(price);
    if (!name.trim() || priceCents == null || !purchaseDate) {
      Alert.alert('Required', 'Name, price, and date are required.');
      return;
    }
    try {
      updatePurchase(db, id, {
        name: name.trim(),
        category,
        priceCents,
        purchaseDate,
        store: store.trim() || null,
        paymentMethod,
        brand: brand.trim() || null,
        url: url.trim() || null,
        isImpulse,
        notesMd: notes.trim() || null,
        returnDeadline: returnDeadline.trim() || null,
      });
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save.');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Edit purchase</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

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

      <Text style={styles.label}>Price (USD)</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Date</Text>
      <TextInput
        style={styles.input}
        value={purchaseDate}
        onChangeText={setPurchaseDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={styles.label}>Store</Text>
      <TextInput style={styles.input} value={store} onChangeText={setStore} />

      <Text style={styles.label}>Brand</Text>
      <TextInput style={styles.input} value={brand} onChangeText={setBrand} />

      <Text style={styles.label}>Payment</Text>
      <View style={styles.pillRow}>
        {PAYMENT_METHODS.map((m) => (
          <Pressable
            key={m}
            style={[styles.pill, paymentMethod === m && styles.pillActive]}
            onPress={() => setPaymentMethod(m === paymentMethod ? null : m)}
          >
            <Text style={[styles.pillText, paymentMethod === m && styles.pillTextActive]}>
              {m.replace('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>URL</Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Return deadline</Text>
      <TextInput
        style={styles.input}
        value={returnDeadline}
        onChangeText={setReturnDeadline}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Pressable
        style={[styles.pill, styles.impulseToggle, isImpulse && styles.pillActive]}
        onPress={() => setIsImpulse((v) => !v)}
      >
        <Text style={[styles.pillText, isImpulse && styles.pillTextActive]}>
          {isImpulse ? 'Impulse ✓' : 'Mark as impulse'}
        </Text>
      </Pressable>

      <Pressable style={styles.primaryButton} onPress={handleSave}>
        <Text style={styles.primaryButtonText}>Save changes</Text>
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
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  input: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },
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
  pillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  pillTextActive: { color: '#0E0E13' },
  impulseToggle: { alignSelf: 'flex-start', marginTop: 8 },
  primaryButton: {
    marginTop: 16,
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
