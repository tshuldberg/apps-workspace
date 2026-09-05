import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  createGift,
  listGiftPeople,
  type GiftOccasion,
  type GiftPerson,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

const OCCASIONS: GiftOccasion[] = [
  'birthday',
  'holiday',
  'graduation',
  'housewarming',
  'thank_you',
  'other',
];

function parseDateISO(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  return Number.isNaN(ts) ? null : ts;
}

export default function AddGiftScreen() {
  const db = useDatabase();
  const router = useRouter();

  const people = useMemo<GiftPerson[]>(() => {
    try {
      return listGiftPeople(db);
    } catch {
      return [];
    }
  }, [db]);

  const [personId, setPersonId] = useState<string | null>(
    people[0]?.id ?? null,
  );
  const [itemDescription, setItemDescription] = useState('');
  const [occasion, setOccasion] = useState<GiftOccasion>('birthday');
  const [amount, setAmount] = useState('');
  const [dateInput, setDateInput] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reactionNotes, setReactionNotes] = useState('');
  const [isGroupGift, setIsGroupGift] = useState(false);
  const [groupTotal, setGroupTotal] = useState('');
  const [myShare, setMyShare] = useState('');

  const canSave =
    personId !== null &&
    itemDescription.trim().length > 0 &&
    Number.isFinite(Number(amount)) &&
    Number(amount) >= 0 &&
    (!isGroupGift || (Number(myShare) >= 0 && Number.isFinite(Number(myShare))));

  const handleSave = () => {
    if (!canSave || !personId) {
      Alert.alert('Required', 'Pick a person, item, and amount.');
      return;
    }
    const person = people.find((p) => p.id === personId);
    if (!person) return;
    const giftDate = parseDateISO(dateInput) ?? Date.now();
    try {
      createGift(db, {
        personId,
        personName: person.name,
        itemDescription: itemDescription.trim(),
        occasion,
        amountCents: Math.round(Number(amount) * 100),
        giftDate,
        reactionNotes: reactionNotes.trim() || null,
        isGroupGift,
        groupTotalCents: isGroupGift
          ? Math.round(Number(groupTotal) * 100)
          : null,
        myShareCents: isGroupGift ? Math.round(Number(myShare) * 100) : null,
      });
      router.replace(`/(shop)/gifts/${personId}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save.');
    }
  };

  if (people.length === 0) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.title}>Add a person first</Text>
          <Text style={styles.muted}>
            You need at least one gift recipient tracked before logging a gift.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace('/(shop)/gifts/add-person')}
          >
            <Text style={styles.primaryButtonText}>Add a person</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.panel}>
        <Text style={styles.title}>Person</Text>
        <View style={styles.pillRow}>
          {people.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.pill, personId === p.id && styles.pillActive]}
              onPress={() => setPersonId(p.id)}
            >
              <Text
                style={[
                  styles.pillText,
                  personId === p.id && styles.pillTextActive,
                ]}
              >
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Gift</Text>
        <Text style={styles.label}>Item *</Text>
        <TextInput
          style={styles.input}
          value={itemDescription}
          onChangeText={setItemDescription}
          placeholder="Cashmere scarf"
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={styles.label}>Occasion *</Text>
        <View style={styles.pillRow}>
          {OCCASIONS.map((o) => (
            <Pressable
              key={o}
              style={[styles.pill, occasion === o && styles.pillActive]}
              onPress={() => setOccasion(o)}
            >
              <Text
                style={[styles.pillText, occasion === o && styles.pillTextActive]}
              >
                {o.replace('_', ' ')}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Amount ($) *</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="89.00"
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
        />
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={dateInput}
          onChangeText={setDateInput}
          placeholder="2026-04-21"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.panel}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Group gift</Text>
            <Text style={styles.muted}>
              Splits the cost with others. Your share counts toward budgets.
            </Text>
          </View>
          <Switch
            value={isGroupGift}
            onValueChange={setIsGroupGift}
            trackColor={{ true: SHOP_ACCENT, false: surfaceTiers.low }}
          />
        </View>
        {isGroupGift ? (
          <>
            <Text style={styles.label}>Group total ($)</Text>
            <TextInput
              style={styles.input}
              value={groupTotal}
              onChangeText={setGroupTotal}
              placeholder="300.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
            <Text style={styles.label}>My share ($) *</Text>
            <TextInput
              style={styles.input}
              value={myShare}
              onChangeText={setMyShare}
              placeholder="50.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </>
        ) : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Reaction notes</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={reactionNotes}
          onChangeText={setReactionNotes}
          placeholder="How did they react?"
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </View>

      <View style={styles.navRow}>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.primaryButtonText}>Save gift</Text>
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
    gap: 14,
  },
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
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
  pillText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  pillTextActive: { color: '#0E0E13' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
