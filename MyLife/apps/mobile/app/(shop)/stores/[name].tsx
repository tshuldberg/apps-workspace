import { useCallback, useEffect, useState } from 'react';
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
  deleteStoreNote,
  getStoreNoteByName,
  upsertStoreNote,
  type StoreNote,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

export default function StoreNoteDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const storeName = decodeURIComponent(name ?? '');

  const [existing, setExisting] = useState<StoreNote | null>(null);
  const [returnsPolicy, setReturnsPolicy] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [rewardsNotes, setRewardsNotes] = useState('');

  const load = useCallback(() => {
    if (!storeName) return;
    try {
      const note = getStoreNoteByName(db, storeName);
      setExisting(note);
      setReturnsPolicy(note?.returnsPolicy ?? '');
      setShippingNotes(note?.shippingNotes ?? '');
      setRewardsNotes(note?.rewardsNotes ?? '');
    } catch {
      setExisting(null);
    }
  }, [db, storeName]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onSave = () => {
    if (!storeName.trim()) {
      Alert.alert('Missing name', 'Store name is required.');
      return;
    }
    try {
      upsertStoreNote(db, {
        storeName: storeName.trim(),
        returnsPolicy: returnsPolicy.trim() || null,
        shippingNotes: shippingNotes.trim() || null,
        rewardsNotes: rewardsNotes.trim() || null,
      });
      router.back();
    } catch (err) {
      Alert.alert('Could not save', String(err));
    }
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert('Delete store note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteStoreNote(db, existing.id);
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
        <Text style={styles.eyebrow}>Store note</Text>
        <Text style={styles.title}>{storeName}</Text>
        <Text style={styles.subtitle}>
          Stuff you want to remember next time you shop here.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Returns policy</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={returnsPolicy}
          onChangeText={setReturnsPolicy}
          placeholder="30 days with receipt, free in-store..."
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Shipping notes</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={shippingNotes}
          onChangeText={setShippingNotes}
          placeholder="Free over $50, ground takes 5 days..."
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Rewards notes</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={rewardsNotes}
          onChangeText={setRewardsNotes}
          placeholder="2x points on weekends, birthday $10..."
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </View>

      <Pressable style={styles.primary} onPress={onSave}>
        <Text style={styles.primaryText}>
          {existing ? 'Save changes' : 'Create store note'}
        </Text>
      </Pressable>

      {existing ? (
        <Pressable style={styles.dangerBtn} onPress={onDelete}>
          <Text style={styles.dangerText}>Delete</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 14 },
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
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
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
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  dangerBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  dangerText: { color: '#EF4444', fontWeight: '800', fontSize: 13 },
});
