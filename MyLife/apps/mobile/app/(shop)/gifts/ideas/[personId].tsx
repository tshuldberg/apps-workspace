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
  createWishlistItem,
  getGiftPersonById,
  listItemsByGiftForPerson,
  listWishlists,
  type GiftPerson,
  type WishlistItem,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../../_ui';

export default function GiftIdeasScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ personId?: string }>();
  const personId = Array.isArray(params.personId) ? params.personId[0] : params.personId;

  const [tick, setTick] = useState(0);
  const [idea, setIdea] = useState('');

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const person = useMemo<GiftPerson | null>(() => {
    if (!personId) return null;
    try {
      return getGiftPersonById(db, personId);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, personId, tick]);

  const items = useMemo<WishlistItem[]>(() => {
    if (!personId) return [];
    try {
      return listItemsByGiftForPerson(db, personId);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, personId, tick]);

  const handleSave = () => {
    const trimmed = idea.trim();
    if (!trimmed || !personId) return;
    try {
      const lists = listWishlists(db);
      const listId = lists[0]?.id;
      if (!listId) {
        Alert.alert(
          'No wishlist yet',
          'Create a wishlist first from the Wishlist tab.',
        );
        return;
      }
      createWishlistItem(db, {
        listId,
        name: trimmed,
        category: 'gifts',
        priority: 'want',
        giftForPersonId: personId,
      });
      setIdea('');
      setTick((t) => t + 1);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save.');
    }
  };

  if (!person) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Person not found</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Gift ideas</Text>
        <Text style={styles.title}>{person.name}</Text>
        <Text style={styles.subtitle}>
          {items.length} ideas saved. Tap one to open in your wishlist.
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No ideas yet</Text>
          <Text style={styles.emptyBody}>
            Save quick ideas as they come to you. They land in your wishlist
            tagged for {person.name}.
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <Pressable
            key={item.id}
            style={styles.row}
            onPress={() => router.push(`/(shop)/wishlist/item/${item.id}`)}
          >
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.name}
            </Text>
            {item.notesMd ? (
              <Text style={styles.rowMeta} numberOfLines={2}>
                {item.notesMd}
              </Text>
            ) : null}
            <View style={styles.rowFooter}>
              <Text style={styles.rowMeta}>{item.priority}</Text>
              {item.isPurchased ? (
                <Text style={styles.rowPurchased}>purchased</Text>
              ) : null}
            </View>
          </Pressable>
        ))
      )}

      <View style={styles.panel}>
        <Text style={styles.label}>Quick save idea</Text>
        <TextInput
          style={styles.input}
          value={idea}
          onChangeText={setIdea}
          placeholder="Vintage vinyl, hiking pack..."
          placeholderTextColor={colors.textSecondary}
          onSubmitEditing={handleSave}
          returnKeyType="done"
        />
        <Pressable style={styles.primaryButton} onPress={handleSave}>
          <Text style={styles.primaryButtonText}>Save idea</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 180,
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
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 13 },
  emptyCard: {
    gap: 6,
    padding: 18,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  row: {
    gap: 6,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: colors.textSecondary, fontSize: 12 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowPurchased: {
    color: SHOP_ACCENT,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
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
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 14, fontWeight: '800' },
});
