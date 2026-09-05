import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  CertificationUpdateSchema,
  deleteCertification,
  getCertification,
  updateCertification,
  type CertificationRow,
} from '@mylife/classes';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { CLASSES_ACCENT } from '../../_ui';
import {
  Pill,
  bucketCertExpiry,
  expiryColor,
  expiryLabel,
  formatDate,
} from '../_ui';

export default function CertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [cert, setCert] = useState<CertificationRow | null>(() =>
    id ? getCertification(db, id) : null,
  );
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cert?.name ?? '');
  const [issuer, setIssuer] = useState(cert?.issuer ?? '');
  const [category, setCategory] = useState(cert?.category ?? '');
  const [credentialId, setCredentialId] = useState(cert?.credential_id ?? '');
  const [credentialUrl, setCredentialUrl] = useState(cert?.credential_url ?? '');
  const [issuedAt, setIssuedAt] = useState(cert?.issued_at ?? '');
  const [expiresAt, setExpiresAt] = useState(cert?.expires_at ?? '');
  const [reminderDays, setReminderDays] = useState(
    cert?.renewal_reminder_days != null
      ? String(cert.renewal_reminder_days)
      : '',
  );
  const [notes, setNotes] = useState(cert?.notes_md ?? '');

  useEffect(() => {
    if (id) {
      const c = getCertification(db, id);
      setCert(c);
      if (c) {
        setName(c.name);
        setIssuer(c.issuer ?? '');
        setCategory(c.category ?? '');
        setCredentialId(c.credential_id ?? '');
        setCredentialUrl(c.credential_url ?? '');
        setIssuedAt(c.issued_at ?? '');
        setExpiresAt(c.expires_at ?? '');
        setReminderDays(
          c.renewal_reminder_days != null
            ? String(c.renewal_reminder_days)
            : '',
        );
        setNotes(c.notes_md ?? '');
      }
    }
  }, [db, id]);

  const handleSave = useCallback(() => {
    if (!cert) return;
    const parsed = CertificationUpdateSchema.safeParse({
      name: name.trim() || cert.name,
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
    try {
      updateCertification(db, cert.id, parsed.data);
      const fresh = getCertification(db, cert.id);
      setCert(fresh);
      setEditing(false);
    } catch (err) {
      Alert.alert('Save failed', String(err));
    }
  }, [
    cert,
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
  ]);

  const handleDelete = useCallback(() => {
    if (!cert) return;
    Alert.alert('Delete credential?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteCertification(db, cert.id);
            router.back();
          } catch (err) {
            Alert.alert('Delete failed', String(err));
          }
        },
      },
    ]);
  }, [cert, db, router]);

  if (!cert) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={{ title: 'Credential' }} />
        <Text variant="body" color={colors.textSecondary}>
          Credential not found.
        </Text>
      </View>
    );
  }

  const bucket = bucketCertExpiry(cert.expires_at);
  const color = expiryColor(bucket);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: cert.name }} />

      {editing ? (
        <>
          <Section title="Edit credential">
            <Card style={styles.card}>
              <Field label="Name">
                <TextInput value={name} onChangeText={setName} style={styles.input} />
              </Field>
              <Field label="Issuer">
                <TextInput value={issuer} onChangeText={setIssuer} style={styles.input} />
              </Field>
              <Field label="Category">
                <TextInput
                  value={category}
                  onChangeText={setCategory}
                  style={styles.input}
                />
              </Field>
              <View style={styles.row2}>
                <Field label="Issued" style={{ flex: 1 }}>
                  <TextInput
                    value={issuedAt}
                    onChangeText={setIssuedAt}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </Field>
                <Field label="Expires" style={{ flex: 1 }}>
                  <TextInput
                    value={expiresAt}
                    onChangeText={setExpiresAt}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </Field>
              </View>
              <Field label="Reminder (days before)">
                <TextInput
                  value={reminderDays}
                  onChangeText={setReminderDays}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </Field>
              <Field label="Credential ID">
                <TextInput
                  value={credentialId}
                  onChangeText={setCredentialId}
                  autoCapitalize="none"
                  style={styles.input}
                />
              </Field>
              <Field label="Verification URL">
                <TextInput
                  value={credentialUrl}
                  onChangeText={setCredentialUrl}
                  autoCapitalize="none"
                  style={styles.input}
                />
              </Field>
              <Field label="Notes">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  style={[styles.input, styles.notesInput]}
                />
              </Field>
            </Card>
          </Section>
          <View style={styles.actions}>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: CLASSES_ACCENT }]}
              onPress={handleSave}
            >
              <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
                Save changes
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => setEditing(false)}
            >
              <Text style={styles.secondaryBtnLabel}>Cancel</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Section title="Credential">
            <Card style={styles.card}>
              <Text style={styles.title}>{cert.name}</Text>
              {cert.issuer ? (
                <Text variant="caption" color={colors.textSecondary}>
                  {cert.issuer}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Pill
                  label={expiryLabel(cert.expires_at)}
                  color={color}
                  borderColor={color}
                />
                {cert.category ? <Pill label={cert.category} /> : null}
              </View>
            </Card>
          </Section>

          <Section title="Details">
            <Card style={styles.card}>
              <Row label="Issued" value={formatDate(cert.issued_at)} />
              <Row label="Expires" value={formatDate(cert.expires_at)} />
              <Row
                label="Reminder"
                value={
                  cert.renewal_reminder_days != null
                    ? `${cert.renewal_reminder_days} days before`
                    : '—'
                }
              />
              {cert.credential_id ? (
                <Row label="Credential ID" value={cert.credential_id} />
              ) : null}
              {cert.credential_url ? (
                <Row label="URL" value={cert.credential_url} />
              ) : null}
            </Card>
          </Section>

          {cert.notes_md ? (
            <Section title="Notes">
              <Card style={styles.card}>
                <Text variant="body" color={colors.text}>
                  {cert.notes_md}
                </Text>
              </Card>
            </Section>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: CLASSES_ACCENT }]}
              onPress={() => setEditing(true)}
            >
              <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
                Edit credential
              </Text>
            </Pressable>
            <Pressable style={styles.dangerBtn} onPress={handleDelete}>
              <Text style={styles.dangerBtnLabel}>Delete</Text>
            </Pressable>
          </View>
        </>
      )}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { justifyContent: 'center', alignItems: 'center' },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  card: { gap: spacing.sm },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
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
  dangerBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFB4AB',
    backgroundColor: 'transparent',
  },
  dangerBtnLabel: { fontSize: 14, fontWeight: '700', color: '#FFB4AB' },
});
