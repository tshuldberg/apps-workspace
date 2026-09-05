import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  calculateReturnDeadline,
  createPhoto,
  createPurchase,
  getWishlistItemById,
  markAsPurchased,
  updateSatisfaction,
  type Category,
  type PaymentMethod,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LogPurchaseScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ wishlistItemId?: string }>();
  const wishlistItemId = Array.isArray(params.wishlistItemId)
    ? params.wishlistItemId[0]
    : params.wishlistItemId;

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [price, setPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [store, setStore] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [brand, setBrand] = useState('');
  const [url, setUrl] = useState('');
  const [isImpulse, setIsImpulse] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [productUri, setProductUri] = useState<string | null>(null);
  const [researchNotes, setResearchNotes] = useState('');
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [policyDays, setPolicyDays] = useState('30');
  const [manualDeadline, setManualDeadline] = useState('');

  // Pre-fill from wishlist item.
  useEffect(() => {
    if (!wishlistItemId) return;
    try {
      const item = getWishlistItemById(db, wishlistItemId);
      if (!item) return;
      setName(item.name);
      setCategory(item.category);
      if (item.priceCents != null) {
        setPrice((item.priceCents / 100).toFixed(2));
      }
      if (item.brand) setBrand(item.brand);
      if (item.store) setStore(item.store);
      if (item.url) setUrl(item.url);
    } catch {
      // ignore
    }
  }, [db, wishlistItemId]);

  const computedDeadline = useMemo(() => {
    if (manualDeadline.trim()) return manualDeadline.trim();
    const days = Number(policyDays);
    if (!isFinite(days) || days <= 0) return null;
    try {
      return calculateReturnDeadline(purchaseDate, days);
    } catch {
      return null;
    }
  }, [purchaseDate, policyDays, manualDeadline]);

  const canSave = name.trim().length > 0 && parseCents(price) != null && purchaseDate.length > 0;

  async function pickReceipt(fromCamera: boolean): Promise<string | null> {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission required', 'Enable photo access to attach a receipt.');
        return null;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.6, mediaTypes: ImagePicker.MediaTypeOptions.Images })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (result.canceled) return null;
      const asset = result.assets?.[0];
      return asset?.uri ?? null;
    } catch {
      return null;
    }
  }

  const handleSave = () => {
    const priceCents = parseCents(price);
    if (!name.trim() || priceCents == null || !purchaseDate) {
      Alert.alert('Required', 'Name, price, and purchase date are required.');
      return;
    }

    try {
      // Persist photos first if picked.
      let receiptPhotoId: string | null = null;
      let photoId: string | null = null;
      if (receiptUri) {
        const p = createPhoto(db, {
          kind: 'receipt',
          localUri: receiptUri,
        });
        receiptPhotoId = p.id;
      }
      if (productUri) {
        const p = createPhoto(db, {
          kind: 'product',
          localUri: productUri,
        });
        photoId = p.id;
      }

      const purchase = createPurchase(db, {
        name: name.trim(),
        category,
        priceCents,
        purchaseDate,
        store: store.trim() || null,
        paymentMethod,
        brand: brand.trim() || null,
        url: url.trim() || null,
        receiptPhotoId,
        photoId,
        isImpulse,
        researchNotesMd: researchNotes.trim() || null,
        returnDeadline: manualDeadline.trim() || null,
        policyDays: manualDeadline.trim() ? undefined : Number(policyDays) || undefined,
        wishlistItemId: wishlistItemId ?? null,
        satisfactionInitial: satisfaction ?? null,
      });

      if (satisfaction != null) {
        updateSatisfaction(db, purchase.id, 'initial', satisfaction);
      }

      if (wishlistItemId) {
        try {
          markAsPurchased(db, wishlistItemId, {
            purchaseId: purchase.id,
            purchasedAt: new Date().toISOString(),
          });
        } catch { /* best effort */ }
      }

      router.replace(`/(shop)/purchase/${purchase.id}`);
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
      <View style={styles.stepperRow}>
        {[1, 2, 3, 4, 5, 6, 7].map((s) => (
          <View
            key={s}
            style={[styles.stepperDot, step >= s && styles.stepperDotActive]}
          />
        ))}
      </View>

      {step === 1 ? (
        <View style={styles.panel}>
          <Text style={styles.title}>What did you buy?</Text>
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder="AirPods Pro"
            placeholderTextColor={colors.textSecondary}
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
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.panel}>
          <Text style={styles.title}>Price, store, payment</Text>
          <Text style={styles.label}>Price (USD) *</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="49.99"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Purchase date *</Text>
          <TextInput
            style={styles.input}
            value={purchaseDate}
            onChangeText={setPurchaseDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.label}>Store</Text>
          <TextInput
            style={styles.input}
            value={store}
            onChangeText={setStore}
            placeholder="Apple, Amazon, Target…"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.label}>Brand</Text>
          <TextInput
            style={styles.input}
            value={brand}
            onChangeText={setBrand}
            placeholder="Apple"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.label}>Payment method</Text>
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
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.panel}>
          <Text style={styles.title}>Impulse or planned?</Text>
          <Text style={styles.helper}>
            Tag if this was unplanned. Helps track regret rate over time.
          </Text>
          <View style={styles.pillRow}>
            <Pressable
              style={[styles.bigToggle, !isImpulse && styles.bigToggleActive]}
              onPress={() => setIsImpulse(false)}
            >
              <Text style={[styles.bigToggleText, !isImpulse && styles.bigToggleTextActive]}>
                Planned
              </Text>
            </Pressable>
            <Pressable
              style={[styles.bigToggle, isImpulse && styles.bigToggleActive]}
              onPress={() => setIsImpulse(true)}
            >
              <Text style={[styles.bigToggleText, isImpulse && styles.bigToggleTextActive]}>
                Impulse
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === 4 ? (
        <View style={styles.panel}>
          <Text style={styles.title}>Receipt photo</Text>
          <Text style={styles.helper}>Optional. Stored locally — never uploaded.</Text>
          {receiptUri ? (
            <Image source={{ uri: receiptUri }} style={styles.photoPreview} />
          ) : null}
          <View style={styles.pillRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={async () => {
                const uri = await pickReceipt(true);
                if (uri) setReceiptUri(uri);
              }}
            >
              <Text style={styles.secondaryButtonText}>Camera</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={async () => {
                const uri = await pickReceipt(false);
                if (uri) setReceiptUri(uri);
              }}
            >
              <Text style={styles.secondaryButtonText}>Library</Text>
            </Pressable>
            {receiptUri ? (
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setReceiptUri(null)}
              >
                <Text style={styles.secondaryButtonText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.title}>Product photo</Text>
          {productUri ? (
            <Image source={{ uri: productUri }} style={styles.photoPreview} />
          ) : null}
          <View style={styles.pillRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={async () => {
                const uri = await pickReceipt(true);
                if (uri) setProductUri(uri);
              }}
            >
              <Text style={styles.secondaryButtonText}>Camera</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={async () => {
                const uri = await pickReceipt(false);
                if (uri) setProductUri(uri);
              }}
            >
              <Text style={styles.secondaryButtonText}>Library</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === 5 ? (
        <View style={styles.panel}>
          <Text style={styles.title}>Research notes</Text>
          <Text style={styles.helper}>What did you compare? Why this one?</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={researchNotes}
            onChangeText={setResearchNotes}
            placeholder="Compared with… decided because…"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
          <Text style={styles.label}>URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
        </View>
      ) : null}

      {step === 6 ? (
        <View style={styles.panel}>
          <Text style={styles.title}>How do you feel about it?</Text>
          <Text style={styles.helper}>Initial rating — you can update at 30 and 90 days.</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                style={styles.starButton}
                onPress={() => setSatisfaction(n === satisfaction ? null : n)}
              >
                <Text style={[styles.starChar, (satisfaction ?? 0) >= n && styles.starCharActive]}>
                  {'★'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {step === 7 ? (
        <View style={styles.panel}>
          <Text style={styles.title}>Return deadline</Text>
          <Text style={styles.helper}>
            We'll auto-calculate from policy days, or enter a specific date.
          </Text>
          <Text style={styles.label}>Policy days</Text>
          <TextInput
            style={styles.input}
            value={policyDays}
            onChangeText={setPolicyDays}
            keyboardType="number-pad"
            placeholder="30"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.label}>Or specific deadline (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={manualDeadline}
            onChangeText={setManualDeadline}
            placeholder="2026-05-30"
            placeholderTextColor={colors.textSecondary}
          />
          {computedDeadline ? (
            <Text style={styles.computedDeadline}>Return by {computedDeadline}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.navRow}>
        {step > 1 ? (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setStep((s) => Math.max(1, s - 1))}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        )}
        {step < 7 ? (
          <Pressable
            style={styles.primaryButton}
            onPress={() => setStep((s) => Math.min(7, s + 1))}
          >
            <Text style={styles.primaryButtonText}>Next</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={styles.primaryButtonText}>Save purchase</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 180, gap: 14 },
  stepperRow: { flexDirection: 'row', gap: 6 },
  stepperDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stepperDotActive: { backgroundColor: SHOP_ACCENT },
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  helper: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
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
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
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
  bigToggle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bigToggleActive: { backgroundColor: SHOP_ACCENT, borderColor: SHOP_ACCENT },
  bigToggleText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  bigToggleTextActive: { color: '#0E0E13' },
  starsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  starButton: { padding: 6 },
  starChar: { fontSize: 38, color: 'rgba(255,255,255,0.2)' },
  starCharActive: { color: SHOP_ACCENT },
  computedDeadline: {
    color: SHOP_ACCENT,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  photoPreview: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: surfaceTiers.low,
  },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
