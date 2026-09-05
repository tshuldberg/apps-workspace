import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  createPerson,
  type PersonInput,
  type RelationshipType,
  type EnergyTag,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const SURFACE = '#2A292F';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

const RELATIONSHIP_OPTIONS: { key: RelationshipType; label: string }[] = [
  { key: 'friend', label: 'Friend' },
  { key: 'close_friend', label: 'Close friend' },
  { key: 'family', label: 'Family' },
  { key: 'partner', label: 'Partner' },
  { key: 'colleague', label: 'Colleague' },
  { key: 'acquaintance', label: 'Acquaintance' },
  { key: 'mentor', label: 'Mentor' },
  { key: 'neighbor', label: 'Neighbor' },
  { key: 'ex', label: 'Ex' },
];

const ENERGY_OPTIONS: { key: EnergyTag; label: string; color: string }[] = [
  { key: 'energizing', label: 'Energizing', color: '#10B981' },
  { key: 'neutral', label: 'Neutral', color: '#9F8E81' },
  { key: 'draining', label: 'Draining', color: '#EF4444' },
  { key: 'complicated', label: 'Complicated', color: '#F59E0B' },
];

export default function AddPersonScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [name, setName] = useState('');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('friend');
  const [howMet, setHowMet] = useState('');
  const [whereMet, setWhereMet] = useState('');
  const [whenMet, setWhenMet] = useState('');
  const [birthday, setBirthday] = useState('');
  const [city, setCity] = useState('');
  const [interestsText, setInterestsText] = useState('');
  const [energyTag, setEnergyTag] = useState<EnergyTag | null>(null);
  const [frequencyDays, setFrequencyDays] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Give this person a name to remember them by.');
      return;
    }

    setSaving(true);
    try {
      const interests = interestsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const input: PersonInput = {
        display_name: trimmedName,
        relationship_type: relationshipType,
        how_met: howMet.trim() || undefined,
        where_met: whereMet.trim() || undefined,
        when_met: whenMet.trim() || undefined,
        birthday: birthday.trim() || undefined,
        city: city.trim() || undefined,
        interests: interests.length > 0 ? interests : undefined,
        energy_tag: energyTag ?? undefined,
        frequency_goal_days: frequencyDays ? parseInt(frequencyDays, 10) || undefined : undefined,
      };

      const person = createPerson(db, input);
      router.replace({
        pathname: '/(friends)/person-detail',
        params: { id: person.id },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }, [db, router, name, relationshipType, howMet, whereMet, whenMet, birthday, city, interestsText, energyTag, frequencyDays]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backArrow}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Add a friend</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Who is this person?"
              placeholderTextColor="#9F8E81"
              style={styles.inputLarge}
              autoFocus
            />
          </View>

          {/* Relationship type */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Who is this person to you?</Text>
            <View style={styles.chipRow}>
              {RELATIONSHIP_OPTIONS.map((opt) => {
                const active = relationshipType === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setRelationshipType(opt.key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* How did you meet? */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>How did you meet?</Text>
            <TextInput
              value={howMet}
              onChangeText={setHowMet}
              placeholder="Through a friend, at work, online..."
              placeholderTextColor="#9F8E81"
              style={styles.input}
              multiline
            />
          </View>

          {/* Where and when */}
          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Where?</Text>
              <TextInput
                value={whereMet}
                onChangeText={setWhereMet}
                placeholder="City, venue..."
                placeholderTextColor="#9F8E81"
                style={styles.input}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>When?</Text>
              <TextInput
                value={whenMet}
                onChangeText={setWhenMet}
                placeholder="2024, last summer..."
                placeholderTextColor="#9F8E81"
                style={styles.input}
              />
            </View>
          </View>

          {/* Birthday */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Birthday</Text>
            <TextInput
              value={birthday}
              onChangeText={setBirthday}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9F8E81"
              style={styles.input}
            />
          </View>

          {/* City */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>City</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Where do they live?"
              placeholderTextColor="#9F8E81"
              style={styles.input}
            />
          </View>

          {/* Interests */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Interests</Text>
            <TextInput
              value={interestsText}
              onChangeText={setInterestsText}
              placeholder="hiking, cooking, music (comma-separated)"
              placeholderTextColor="#9F8E81"
              style={styles.input}
            />
          </View>

          {/* More options toggle */}
          <Pressable
            onPress={() => setShowMore(!showMore)}
            style={styles.moreToggle}
          >
            <Text style={styles.moreToggleText}>
              {showMore ? 'Less options' : 'More options'}
            </Text>
          </Pressable>

          {/* Hidden advanced options */}
          {showMore && (
            <>
              {/* Energy tag */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Energy</Text>
                <Text style={styles.fieldHint}>How does time with this person feel?</Text>
                <View style={styles.chipRow}>
                  {ENERGY_OPTIONS.map((opt) => {
                    const active = energyTag === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => setEnergyTag(active ? null : opt.key)}
                        style={[
                          styles.chip,
                          active && { backgroundColor: opt.color, borderColor: opt.color },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active && { color: '#FFFFFF' },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Frequency goal */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Catch-up goal</Text>
                <Text style={styles.fieldHint}>How often do you want to see them? (days)</Text>
                <TextInput
                  value={frequencyDays}
                  onChangeText={setFrequencyDays}
                  placeholder="e.g. 14"
                  placeholderTextColor="#9F8E81"
                  style={styles.input}
                  keyboardType="number-pad"
                />
              </View>
            </>
          )}

          {/* Save button */}
          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backArrow: {
    fontSize: 24,
    color: TEXT_PRIMARY,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 8,
  },
  fieldHint: {
    fontSize: 12,
    color: '#9F8E81',
    marginBottom: 8,
  },
  inputLarge: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  input: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  halfField: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  moreToggle: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  moreToggleText: {
    fontSize: 14,
    color: ACCENT,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
