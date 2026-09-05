import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getContacts,
  getAccounts,
  updateContact,
  toggleContactVip,
  deleteContact,
  generateInitials,
  getAvatarColor,
  findKeyForContact,
  getEncryptionKeys,
} from '@mylife/mail';
import type { MailContact, EncryptionKey } from '@mylife/mail';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<MailContact | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [contactKey, setContactKey] = useState<EncryptionKey | null>(null);

  const accounts = useMemo(() => getAccounts(db), [db]);

  const loadData = useCallback(() => {
    if (!id) return;
    try {
      for (const a of accounts) {
        const all = getContacts(db, a.id);
        const found = all.find((c) => c.id === id);
        if (found) {
          setContact(found);
          setDisplayName(found.displayName ?? '');
          setCompany(found.company ?? '');
          setPhone(found.phone ?? '');
          setNotes(found.notes ?? '');
          // Check encryption key
          const keys = getEncryptionKeys(db, a.id);
          const key = findKeyForContact(found.email, keys);
          setContactKey(key ?? null);
          break;
        }
      }
    } catch { /* ignored */ } finally { setLoading(false); }
  }, [db, id, accounts]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = useCallback(() => {
    if (!contact) return;
    try {
      updateContact(db, contact.id, {
        displayName: displayName || undefined,
        company: company || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
      });
      router.back();
    } catch { /* ignored */ }
  }, [db, contact, displayName, company, phone, notes, router]);

  const handleToggleVip = useCallback(() => {
    if (!contact) return;
    try { toggleContactVip(db, contact.id); loadData(); } catch { /* ignored */ }
  }, [db, contact, loadData]);

  const handleDelete = useCallback(() => {
    if (!contact) return;
    Alert.alert('Delete Contact', `Remove ${contact.displayName ?? contact.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { deleteContact(db, contact.id); router.back(); },
      },
    ]);
  }, [db, contact, router]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={styles.centered}>
        <Text variant="body" color={colors.danger}>Contact not found</Text>
      </View>
    );
  }

  const initials = generateInitials(contact.displayName ?? contact.email);
  const avatarColor = getAvatarColor(contact.email);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatarLarge, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text variant="caption" color={colors.textSecondary}>{contact.email}</Text>
      </View>

      {/* Edit fields */}
      <View style={styles.fieldGroup}>
        <FieldRow label="Name">
          <TextInput
            style={styles.fieldInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor={colors.textTertiary}
          />
        </FieldRow>
        <FieldRow label="Company">
          <TextInput
            style={styles.fieldInput}
            value={company}
            onChangeText={setCompany}
            placeholder="Company"
            placeholderTextColor={colors.textTertiary}
          />
        </FieldRow>
        <FieldRow label="Phone">
          <TextInput
            style={styles.fieldInput}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
          />
        </FieldRow>
        <FieldRow label="Notes">
          <TextInput
            style={[styles.fieldInput, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes..."
            placeholderTextColor={colors.textTertiary}
            multiline
          />
        </FieldRow>
      </View>

      {/* VIP toggle */}
      <View style={styles.toggleRow}>
        <Text variant="body" color={colors.text}>VIP Contact</Text>
        <Switch
          value={contact.isVip}
          onValueChange={handleToggleVip}
          trackColor={{ true: ACCENT, false: colors.border }}
        />
      </View>

      {/* Metadata */}
      <View style={styles.metaSection}>
        <Text variant="caption" color={colors.textTertiary}>
          Source: {contact.source} | Contacted {contact.frequency} times
        </Text>
        {contact.lastContactedAt && (
          <Text variant="caption" color={colors.textTertiary}>
            Last contacted: {new Date(contact.lastContactedAt).toLocaleDateString()}
          </Text>
        )}
      </View>

      {/* Encryption section */}
      {contactKey && (
        <View style={[styles.encSection, glass.card]}>
          <Text variant="subheading" color={colors.text}>Encryption Key</Text>
          <Text variant="caption" color={colors.textSecondary} style={styles.mono}>
            {contactKey.fingerprint}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            Type: {contactKey.keyType.toUpperCase()} | {contactKey.isRevoked ? 'Revoked' : contactKey.expiresAt ? `Expires ${new Date(contactKey.expiresAt).toLocaleDateString()}` : 'No expiry'}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: ACCENT }]}
          onPress={() => router.push({ pathname: '/(mail)/compose-message', params: { to: contact.email } })}
        >
          <Text variant="caption" color="#fff">Compose Email</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.saveBtn]} onPress={handleSave}>
          <Text variant="caption" color={ACCENT}>Save Changes</Text>
        </Pressable>
      </View>

      {/* Danger zone */}
      <Pressable style={styles.deleteBtn} onPress={handleDelete}>
        <Text variant="body" color={colors.danger}>Delete Contact</Text>
      </Pressable>
    </ScrollView>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldRow}>
      <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background,
  },
  avatarSection: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  fieldGroup: { gap: 0 },
  fieldRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  fieldLabel: { width: 70, paddingTop: 4 },
  fieldInput: {
    flex: 1, color: colors.text, fontFamily: 'Inter', fontSize: 16,
  },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  metaSection: { gap: spacing.xs },
  encSection: { padding: spacing.md, gap: spacing.xs },
  mono: { fontFamily: 'Courier', fontSize: 12 },
  actions: { gap: spacing.sm },
  actionBtn: {
    paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center',
  },
  saveBtn: { borderWidth: 1, borderColor: ACCENT },
  deleteBtn: {
    paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.md,
  },
});
