import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  createProperty, getProperty, updateProperty,
  getDefaultSchedules, createSchedule,
  type PropertyType, type OwnershipType,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const PROP_TYPES: PropertyType[] = ['house', 'condo', 'apartment', 'townhouse', 'other'];
const OWN_TYPES: OwnershipType[] = ['own', 'rent'];

export default function AddPropertyScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [sqft, setSqft] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('house');
  const [ownershipType, setOwnershipType] = useState<OwnershipType>('own');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (id) {
      const existing = getProperty(db, id);
      if (existing) {
        setName(existing.name);
        setAddress(existing.address ?? '');
        setCity(existing.city ?? '');
        setState(existing.state ?? '');
        setYearBuilt(existing.yearBuilt?.toString() ?? '');
        setSqft(existing.sqft?.toString() ?? '');
        setPropertyType(existing.propertyType);
        setOwnershipType(existing.ownershipType);
        setNotes(existing.notes ?? '');
      }
    }
  }, [id, db]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Property name is required.');
      return;
    }

    try {
      const data = {
        name: name.trim(),
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        yearBuilt: yearBuilt ? Number(yearBuilt) : undefined,
        sqft: sqft ? Number(sqft) : undefined,
        propertyType,
        ownershipType,
        notes: notes.trim() || undefined,
      };

      if (isEdit && id) {
        updateProperty(db, id, data);
      } else {
        const newId = uuid();
        createProperty(db, newId, data);

        // Auto-create recommended maintenance schedules
        const presets = getDefaultSchedules(propertyType, ownershipType);
        for (const preset of presets) {
          const nextDue = new Date();
          nextDue.setMonth(nextDue.getMonth() + preset.intervalMonths);
          createSchedule(db, uuid(), {
            propertyId: newId,
            taskType: preset.taskType,
            intervalMonths: preset.intervalMonths,
            seasonPreference: preset.seasonPreference,
            nextDueDate: nextDue.toISOString().slice(0, 10),
          });
        }

        Alert.alert(
          'Property Added',
          `${presets.length} recommended maintenance tasks were created automatically. You can manage them in the Tasks tab.`,
        );
      }

      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save property. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{isEdit ? 'Edit Property' : 'Add Property'}</Text>

      <Text variant="label" color={colors.textSecondary}>Name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName}
        placeholder="My Home" placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Address</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress}
        placeholder="123 Main St" placeholderTextColor={colors.textTertiary} />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text variant="label" color={colors.textSecondary}>City</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity}
            placeholderTextColor={colors.textTertiary} />
        </View>
        <View style={{ width: 80 }}>
          <Text variant="label" color={colors.textSecondary}>State</Text>
          <TextInput style={styles.input} value={state} onChangeText={setState}
            autoCapitalize="characters" maxLength={2} placeholderTextColor={colors.textTertiary} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text variant="label" color={colors.textSecondary}>Year Built</Text>
          <TextInput style={styles.input} value={yearBuilt} onChangeText={setYearBuilt}
            keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
        </View>
        <View style={styles.flex1}>
          <Text variant="label" color={colors.textSecondary}>Sqft</Text>
          <TextInput style={styles.input} value={sqft} onChangeText={setSqft}
            keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
        </View>
      </View>

      <Text variant="label" color={colors.textSecondary}>Property Type</Text>
      <View style={styles.chipRow}>
        {PROP_TYPES.map((t) => (
          <Pressable key={t} style={[styles.chip, propertyType === t && styles.chipActive]}
            onPress={() => setPropertyType(t)}>
            <Text variant="label" color={propertyType === t ? colors.background : colors.textSecondary}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary}>Ownership</Text>
      <View style={styles.chipRow}>
        {OWN_TYPES.map((t) => (
          <Pressable key={t} style={[styles.chip, ownershipType === t && styles.chipActive]}
            onPress={() => setOwnershipType(t)}>
            <Text variant="label" color={ownershipType === t ? colors.background : colors.textSecondary}>
              {t === 'own' ? 'Owner' : 'Renter'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary}>Notes</Text>
      <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes}
        multiline numberOfLines={3} placeholderTextColor={colors.textTertiary} />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text variant="label" color={colors.background}>{isEdit ? 'Save Changes' : 'Add Property'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chip: {
    backgroundColor: colors.glassStrong, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  chipActive: { backgroundColor: ACCENT },
  saveButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.md,
  },
});
