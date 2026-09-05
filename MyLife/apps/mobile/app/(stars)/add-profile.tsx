import { useEffect, useMemo, useState, useCallback } from 'react';
import { uuid } from '../../lib/uuid';
import { ScrollView, View, Pressable, StyleSheet, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  createBirthProfile,
  getBirthProfile,
  getMoonSign,
  getZodiacSign,
  updateBirthProfile,
} from '@mylife/stars';

const ACCENT = colors.modules.stars;

export default function AddProfileScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; mode?: string }>();
  const requestedId = typeof params.id === 'string' ? params.id : undefined;
  const mode = typeof params.mode === 'string' ? params.mode : undefined;
  const existingProfile = useMemo(
    () => (requestedId ? getBirthProfile(db, requestedId) : null),
    [db, requestedId],
  );
  const isEditing = existingProfile != null;
  const isFriendMode = mode === 'friend';

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!existingProfile) {
      return;
    }
    setName(existingProfile.name);
    setBirthDate(existingProfile.birthDate);
    setBirthTime(existingProfile.birthTime ?? '');
    setBirthPlace(existingProfile.birthPlace ?? '');
  }, [existingProfile]);

  const dateFormatValid = /^\d{4}-\d{2}-\d{2}$/.test(birthDate);
  const dateSemanticValid = dateFormatValid && !isNaN(new Date(birthDate + 'T00:00:00Z').getTime()) && new Date(birthDate + 'T00:00:00Z') <= new Date();
  const dateValid = dateFormatValid && dateSemanticValid;
  const nameValid = name.trim().length >= 1 && name.trim().length <= 100;
  const canSave = nameValid && dateValid;

  const handleSave = useCallback(() => {
    if (!canSave || isSaving) return;

    setIsSaving(true);
    try {
      const sunSign = getZodiacSign(birthDate);
      const moonSign = getMoonSign(birthDate);

      if (existingProfile) {
        updateBirthProfile(db, existingProfile.id, {
          name: name.trim(),
          birthDate,
          birthTime: birthTime.trim() || null,
          birthPlace: birthPlace.trim() || null,
          sunSign,
          moonSign,
        });
      } else {
        const id = uuid();
        createBirthProfile(db, id, {
          name: name.trim(),
          birthDate,
          birthTime: birthTime.trim() || null,
          birthPlace: birthPlace.trim() || null,
          sunSign,
          moonSign,
        });
      }

      router.back();
    } catch {
      setIsSaving(false);
      Alert.alert('Error', 'Failed to save profile. Check your date format.');
    }
  }, [canSave, isSaving, name, birthDate, birthTime, birthPlace, db, existingProfile, router]);

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Pressable onPress={handleCancel} hitSlop={12}>
          <Text variant="body" color={ACCENT}>Cancel</Text>
        </Pressable>
        <Text variant="subheading">
          {isEditing ? 'Edit Profile' : isFriendMode ? 'Add Friend' : 'Add Profile'}
        </Text>
        <Pressable onPress={handleSave} hitSlop={12}>
          <Text variant="body" color={canSave ? ACCENT : colors.textTertiary}>
            {isEditing ? 'Update' : 'Save'}
          </Text>
        </Pressable>
      </View>

      {isFriendMode ? (
        <Card style={styles.modeCard}>
          <Text variant="body" color={colors.textSecondary}>
            Friend profiles use the same private local storage as your own chart. Add anyone you want to compare without sending their data anywhere.
          </Text>
        </Card>
      ) : null}

      {/* Form */}
      <Card style={styles.formCard}>
        <Text variant="label" color={colors.textTertiary}>NAME *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={isFriendMode ? 'Friend name' : 'Your name'}
          placeholderTextColor={colors.textTertiary}
          autoFocus={!isEditing}
          maxLength={100}
        />

        <Text variant="label" color={colors.textTertiary}>BIRTH DATE *</Text>
        <TextInput
          style={styles.input}
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numbers-and-punctuation"
        />

        <Text variant="label" color={colors.textTertiary}>BIRTH TIME</Text>
        <TextInput
          style={styles.input}
          value={birthTime}
          onChangeText={setBirthTime}
          placeholder="HH:MM or Unknown"
          placeholderTextColor={colors.textTertiary}
        />

        <Text variant="label" color={colors.textTertiary}>BIRTH PLACE</Text>
        <TextInput
          style={styles.input}
          value={birthPlace}
          onChangeText={setBirthPlace}
          placeholder="City, State/Country"
          placeholderTextColor={colors.textTertiary}
        />
      </Card>

      {/* Computed signs preview */}
      <Card style={styles.signsCard}>
        <Text variant="label" color={colors.textTertiary}>COMPUTED SIGNS</Text>
        {dateValid ? (
          <View style={styles.signsGrid}>
            <SignPreview label="Sun" sign={getZodiacSign(birthDate)} />
            <SignPreview label="Moon" sign={getMoonSign(birthDate)} />
            <SignPreview label="Rising" sign={null} />
          </View>
        ) : (
          <Text variant="body" color={colors.textSecondary}>
            Signs will be calculated from your birth data
          </Text>
        )}
      </Card>
    </ScrollView>
  );
}

function SignPreview({ label, sign }: { label: string; sign: string | null }) {
  return (
    <View style={styles.signItem}>
      <Text variant="caption" color={colors.textTertiary}>{label}</Text>
      <Text variant="body" color={sign ? colors.text : colors.textTertiary}>
        {sign ? sign.charAt(0).toUpperCase() + sign.slice(1) : 'Unknown'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  modeCard: { gap: spacing.sm },
  formCard: { gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    fontSize: 16,
  },
  signsCard: { gap: spacing.sm },
  signsGrid: { flexDirection: 'row', gap: spacing.md },
  signItem: { flex: 1, gap: spacing.xs },
});
