import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  CertificationInputSchema,
  createCertification,
} from '@mylife/classes';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { uuid } from '../../../../lib/uuid';
import { CLASSES_ACCENT } from '../../_ui';

export default function AddCertificationScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [category, setCategory] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [credentialUrl, setCredentialUrl] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [reminderDays, setReminderDays] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Credential name cannot be empty.');
      return;
    }
    const parsed = CertificationInputSchema.safeParse({
      name: name.trim(),
      issuer: issuer.trim() || null,
      category: category.trim() || null,
      credential_id: credentialId.trim() || null,
      credential_url: credentialUrl.trim() || null,
      issued_at: issuedAt.trim() || null,
      expires_at: expiresAt.trim() || null,
      renewal_reminder_days: reminderDays ? Number(reminderDays) : null,
      notes_md: notes.trim() || null,
    });
    if (!parsed.success) {
      Alert.alert(
        'Invalid input',
        parsed.error.issues[0]?.message ?? 'Check fields.',
      );
      return;
    }
    setSaving(true);
    try {
      createCertification(db, uuid(), parsed.data);
      router.back();
    } catch (err) {
      Alert.alert('Save failed', String(err));
      setSaving(false);
    }
  }, [
    db,
    name,
    issuer,
    category,
    credentialId,
    credentialUrl,
    issuedAt,
    expiresAt,
    reminderDays,
    notes,
    router,
  ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="Identity">
        <Card style={styles.card}>
          <Field label="Name">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="AWS Solutions Architect"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </Field>
          <Field label="Issuer">
            <TextInput
              value={issuer}
              onChangeText={setIssuer}
              placeholder="Amazon Web Services"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </Field>
          <Field label="Category">
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder="Cloud, Finance, Language…"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </Field>
        </Card>
      </Section>

      <Section title="Validity">
        <Card style={styles.card}>
          <View style={styles.row2}>
            <Field label="Issued (YYYY-MM-DD)" style={{ flex: 1 }}>
              <TextInput
                value={issuedAt}
                onChangeText={setIssuedAt}
                placeholder="2025-03-15"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                style={styles.input}
              />
            </Field>
            <Field label="Expires (YYYY-MM-DD)" style={{ flex: 1 }}>
              <TextInput
                value={expiresAt}
                onChangeText={setExpiresAt}
                placeholder="2028-03-15"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                style={styles.input}
              />
            </Field>
          </View>
          <Field label="Renewal reminder (days before)">
            <TextInput
              value={reminderDays}
              onChangeText={setReminderDays}
              placeholder="60"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              style={styles.input}
            />
          </Field>
        </Card>
      </Section>

      <Section title="Verification">
        <Card style={styles.card}>
          <Field label="Credential ID">
            <TextInput
              value={credentialId}
              onChangeText={setCredentialId}
              placeholder="ABC123"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              style={styles.input}
            />
          </Field>
          <Field label="Verification URL">
            <TextInput
              value={credentialUrl}
              onChangeText={setCredentialUrl}
              placeholder="https://verify.aws.com/…"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              style={styles.input}
            />
          </Field>
        </Card>
      </Section>

      <Section title="Notes">
        <Card style={styles.card}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Why this matters, prep notes, retake plan…"
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[styles.input, styles.notesInput]}
          />
        </Card>
      </Section>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: CLASSES_ACCENT }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
            {saving ? 'Saving…' : 'Save credential'}
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnLabel}>Cancel</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  card: { gap: spacing.sm },
  fieldLabel: { letterSpacing: 0.6, fontWeight: '700' },
  input: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 15,
  },
  notesInput: { minHeight: 100, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryBtnLabel: { fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryBtnLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
});
