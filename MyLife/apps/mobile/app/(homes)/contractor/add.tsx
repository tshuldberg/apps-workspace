import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import { createContractor, getContractor, updateContractor, type Specialty } from '@mylife/homes';

const ACCENT = colors.modules.homes;
const SPECIALTIES: Specialty[] = [
  'plumbing', 'electrical', 'hvac', 'roofing', 'painting',
  'landscaping', 'cleaning', 'pest_control', 'general', 'other',
];

export default function AddContractorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [specialty, setSpecialty] = useState<Specialty>('general');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [rating, setRating] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (id) {
      const c = getContractor(db, id);
      if (c) {
        setName(c.name); setCompany(c.company ?? ''); setSpecialty(c.specialty);
        setPhone(c.phone ?? ''); setEmail(c.email ?? ''); setWebsite(c.website ?? '');
        setAddress(c.address ?? ''); setRating(c.rating?.toString() ?? ''); setNotes(c.notes ?? '');
      }
    }
  }, [id, db]);

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Required', 'Name is required.'); return; }
    const r = Number(rating);
    const data = {
      name: name.trim(), company: company.trim() || undefined, specialty,
      phone: phone.trim() || undefined, email: email.trim() || undefined,
      website: website.trim() || undefined, address: address.trim() || undefined,
      rating: r >= 1 && r <= 5 ? r : undefined, notes: notes.trim() || undefined,
    };
    if (isEdit && id) { updateContractor(db, id, data); }
    else { createContractor(db, uuid(), data); }
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{isEdit ? 'Edit Contractor' : 'Add Contractor'}</Text>

      <Text variant="label" color={colors.textSecondary}>Name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Company</Text>
      <TextInput style={styles.input} value={company} onChangeText={setCompany} placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Specialty</Text>
      <View style={styles.chipRow}>
        {SPECIALTIES.map((s) => (
          <Pressable key={s} style={[styles.chip, specialty === s && styles.chipActive]}
            onPress={() => setSpecialty(s)}>
            <Text variant="label" color={specialty === s ? colors.background : colors.textSecondary} style={{ fontSize: 11 }}>
              {s.replace(/_/g, ' ')}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary}>Phone</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Website</Text>
      <TextInput style={styles.input} value={website} onChangeText={setWebsite} autoCapitalize="none" placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Address</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Rating (1-5)</Text>
      <TextInput style={styles.input} value={rating} onChangeText={setRating} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Notes</Text>
      <TextInput style={[styles.input, { minHeight: 80 }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={colors.textTertiary} />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text variant="label" color={colors.background}>{isEdit ? 'Save' : 'Add Contractor'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: colors.text, backgroundColor: 'rgba(255,255,255,0.06)' },
  chipRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.glassStrong, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: ACCENT },
  saveButton: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.md },
});
