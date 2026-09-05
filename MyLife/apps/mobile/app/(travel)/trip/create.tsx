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
import {
  createTrip,
  TripInsertSchema,
  type TripType,
} from '@mylife/travel';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from '../_ui';

const TRIP_TYPES: TripType[] = [
  'vacation',
  'business',
  'family',
  'solo',
  'road_trip',
  'backpacking',
];

function formatTypeLabel(type: TripType): string {
  return type.replace('_', ' ');
}

export default function CreateTripScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Give your trip a name to continue.');
      return;
    }

    const candidate = {
      name: trimmedName,
      destination_ids: destination.trim() ? [destination.trim()] : undefined,
      trip_type: tripType ?? undefined,
      start_date: startDate.trim() || undefined,
      end_date: endDate.trim() || undefined,
    };

    const parsed = TripInsertSchema.safeParse(candidate);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      Alert.alert('Check your inputs', first?.message ?? 'Invalid trip details.');
      return;
    }

    setSaving(true);
    try {
      const trip = createTrip(db, parsed.data);
      router.replace(`/(travel)/trip/${trip.id}`);
    } catch (err) {
      setSaving(false);
      Alert.alert('Could not create trip', 'Something went wrong. Please try again.');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>New Trip</Text>
      <Text style={styles.title}>Plan a new trip</Text>
      <Text style={styles.subtitle}>
        Name your trip, add a destination and dates. You can fill in itinerary
        and logistics later.
      </Text>

      <Text style={styles.label}>Trip name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Kyoto in the fall"
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <Text style={styles.label}>Destination</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Kyoto, Japan"
        placeholderTextColor={colors.textSecondary}
        value={destination}
        onChangeText={setDestination}
      />

      <View style={styles.row}>
        <View style={styles.halfCol}>
          <Text style={styles.label}>Start date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            value={startDate}
            onChangeText={setStartDate}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.halfCol}>
          <Text style={styles.label}>End date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            value={endDate}
            onChangeText={setEndDate}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <Text style={styles.label}>Vibe</Text>
      <View style={styles.pillRow}>
        <Pressable
          style={[styles.pill, tripType === null && styles.pillActive]}
          onPress={() => setTripType(null)}
        >
          <Text style={[styles.pillText, tripType === null && styles.pillTextActive]}>
            None
          </Text>
        </Pressable>
        {TRIP_TYPES.map((t) => (
          <Pressable
            key={t}
            style={[styles.pill, tripType === t && styles.pillActive]}
            onPress={() => setTripType(t)}
          >
            <Text style={[styles.pillText, tripType === t && styles.pillTextActive]}>
              {formatTypeLabel(t)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
        onPress={handleCreate}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>
          {saving ? 'Creating...' : 'Create trip'}
        </Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 12,
  },
  eyebrow: {
    color: TRAVEL_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  input: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCol: {
    flex: 1,
    gap: 6,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: TRAVEL_ACCENT, borderColor: TRAVEL_ACCENT },
  pillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  pillTextActive: { color: '#0E0E13' },
  primaryButton: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: TRAVEL_ACCENT,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
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
});
