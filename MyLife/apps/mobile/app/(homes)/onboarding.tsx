import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  createProperty, getDefaultSchedules, createSchedule,
  type PropertyType, type OwnershipType,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;

const OWNERSHIP_OPTIONS: { value: OwnershipType; label: string; icon: string }[] = [
  { value: 'own', label: 'I Own', icon: '🏠' },
  { value: 'rent', label: 'I Rent', icon: '🔑' },
];

const TYPE_OPTIONS: { value: PropertyType; label: string; icon: string }[] = [
  { value: 'house', label: 'House', icon: '🏡' },
  { value: 'condo', label: 'Condo', icon: '🏢' },
  { value: 'apartment', label: 'Apartment', icon: '🏬' },
  { value: 'townhouse', label: 'Townhouse', icon: '🏘️' },
  { value: 'other', label: 'Other', icon: '🏗️' },
];

export default function OnboardingScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [ownership, setOwnership] = useState<OwnershipType>('own');
  const [propertyType, setPropertyType] = useState<PropertyType>('house');
  const [name, setName] = useState('My Home');
  const [address, setAddress] = useState('');

  const handleFinish = () => {
    try {
      const id = uuid();
      createProperty(db, id, {
        name: name.trim() || 'My Home',
        address: address.trim() || undefined,
        propertyType,
        ownershipType: ownership,
      });

      // Bulk create default maintenance schedules
      const presets = getDefaultSchedules(propertyType, ownership);
      for (const preset of presets) {
        const schedId = uuid();
        const nextDue = new Date();
        nextDue.setMonth(nextDue.getMonth() + preset.intervalMonths);
        createSchedule(db, schedId, {
          propertyId: id,
          taskType: preset.taskType,
          intervalMonths: preset.intervalMonths,
          seasonPreference: preset.seasonPreference,
          nextDueDate: nextDue.toISOString().slice(0, 10),
        });
      }

      router.replace('/(homes)/');
    } catch {
      Alert.alert('Error', 'Failed to set up your property. Please try again.');
    }
  };

  if (step === 1) {
    return (
      <View style={styles.container}>
        <Text style={styles.stepTitle}>Do you own or rent?</Text>
        <View style={styles.optionGrid}>
          {OWNERSHIP_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.bigCard, ownership === opt.value && styles.bigCardActive]}
              onPress={() => { setOwnership(opt.value); setStep(2); }}
            >
              <Text style={styles.bigIcon}>{opt.icon}</Text>
              <Text variant="subheading" color={ownership === opt.value ? colors.background : colors.text}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => router.replace('/(homes)/')}>
          <Text variant="caption" color={colors.textSecondary}>I'll set this up later</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 2) {
    return (
      <View style={styles.container}>
        <Text style={styles.stepTitle}>What kind of place?</Text>
        <View style={styles.typeGrid}>
          {TYPE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.typeCard, propertyType === opt.value && styles.typeCardActive]}
              onPress={() => { setPropertyType(opt.value); setStep(3); }}
            >
              <Text style={styles.typeIcon}>{opt.icon}</Text>
              <Text variant="label" color={propertyType === opt.value ? colors.background : colors.text}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setStep(1)}>
          <Text variant="caption" color={colors.textSecondary}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Name your home</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="My Home"
        placeholderTextColor={colors.textTertiary}
        autoFocus
      />
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="Address (optional)"
        placeholderTextColor={colors.textTertiary}
      />
      <Pressable style={styles.primaryButton} onPress={handleFinish}>
        <Text variant="label" color={colors.background}>Get Started</Text>
      </Pressable>
      <Pressable onPress={() => setStep(2)}>
        <Text variant="caption" color={colors.textSecondary}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.lg, gap: spacing.lg,
  },
  stepTitle: {
    fontSize: 28, fontWeight: '700', color: colors.text, textAlign: 'center',
    fontFamily: 'Inter',
  },
  optionGrid: { flexDirection: 'row', gap: spacing.md, width: '100%' },
  bigCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl,
    borderWidth: 2, borderColor: colors.glassBorder, gap: spacing.sm,
  },
  bigCardActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  bigIcon: { fontSize: 48 },
  typeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
    width: '100%', justifyContent: 'center',
  },
  typeCard: {
    width: '45%', backgroundColor: colors.surface, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg,
    borderWidth: 2, borderColor: colors.glassBorder, gap: spacing.sm,
  },
  typeCardActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  typeIcon: { fontSize: 36 },
  input: {
    width: '100%', borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: 'rgba(255,255,255,0.06)',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12, width: '100%',
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
