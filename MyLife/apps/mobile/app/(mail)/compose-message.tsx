import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uuid } from '../../lib/uuid';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getAccounts,
  getContacts,
  getMessage,
  createMessage,
  createDraft,
  updateDraft,
  deleteDraft,
  autoComplete,
  generateInitials,
  getAvatarColor,
  canEncrypt,
  findOwnKey,
  getEncryptionKeys,
} from '@mylife/mail';
import type { MailContact } from '@mylife/mail';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

export default function ComposeScreen() {
  const params = useLocalSearchParams<{
    replyTo?: string;
    replyAll?: string;
    forward?: string;
    draftId?: string;
    prefill?: string;
  }>();
  const db = useDatabase();
  const router = useRouter();

  const accounts = useMemo(() => getAccounts(db), [db]);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? '');
  const contacts = useMemo(() => {
    if (!selectedAccountId) return [];
    return getContacts(db, selectedAccountId);
  }, [db, selectedAccountId]);

  const [toRecipients, setToRecipients] = useState<string[]>([]);
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [bccRecipients, setBccRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(params.prefill ?? '');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [toQuery, setToQuery] = useState('');
  const [ccQuery, setCcQuery] = useState('');
  const [bccQuery, setBccQuery] = useState('');
  const [autoCompleteResults, setAutoCompleteResults] = useState<MailContact[]>([]);
  const [activeField, setActiveField] = useState<'to' | 'cc' | 'bcc' | null>(null);
  const [draftId, setDraftId] = useState<string | null>(params.draftId ?? null);
  const [sending, setSending] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-fill for reply/forward
  useEffect(() => {
    const msgId = params.replyTo ?? params.replyAll ?? params.forward;
    if (!msgId) return;
    try {
      const msg = getMessage(db, msgId);
      if (!msg) return;

      if (params.replyTo) {
        setToRecipients([msg.from]);
        setSubject(`Re: ${msg.subject.replace(/^Re:\s*/i, '')}`);
        setBody(`\n\n---\nOn ${new Date(msg.receivedAt).toLocaleString()}, ${msg.from} wrote:\n${msg.body}`);
      } else if (params.replyAll) {
        const ownAccount = accounts.find((a) => a.id === msg.accountId);
        const ownEmail = ownAccount?.email;
        setToRecipients([msg.from]);
        setCcRecipients(msg.to.filter((e) => e !== msg.from && e !== ownEmail));
        setShowCc(true);
        setSubject(`Re: ${msg.subject.replace(/^Re:\s*/i, '')}`);
        setBody(`\n\n---\nOn ${new Date(msg.receivedAt).toLocaleString()}, ${msg.from} wrote:\n${msg.body}`);
      } else if (params.forward) {
        setSubject(`Fwd: ${msg.subject.replace(/^Fwd:\s*/i, '')}`);
        setBody(`\n\n--- Forwarded message ---\nFrom: ${msg.from}\nDate: ${new Date(msg.receivedAt).toLocaleString()}\nSubject: ${msg.subject}\n\n${msg.body}`);
      }
    } catch { /* ignored */ }
  }, [db, params.replyTo, params.replyAll, params.forward]);

  const saveDraft = useCallback(() => {
    if (!subject && !body && toRecipients.length === 0) return;
    try {
      if (draftId) {
        updateDraft(db, draftId, { subject, to: toRecipients, body });
      } else {
        const id = `draft_${uuid()}`;
        createDraft(db, id, { accountId: selectedAccountId, subject, to: toRecipients, body });
        setDraftId(id);
      }
    } catch { /* ignored */ }
  }, [db, draftId, selectedAccountId, subject, toRecipients, body]);

  // Auto-save draft every 30s
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      saveDraft();
    }, 30000);
    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [saveDraft]);

  // Autocomplete
  useEffect(() => {
    const query = activeField === 'to' ? toQuery : activeField === 'cc' ? ccQuery : bccQuery;
    if (!query.trim() || !activeField) { setAutoCompleteResults([]); return; }
    try {
      const results = autoComplete(query, contacts, 5);
      setAutoCompleteResults(results);
    } catch { setAutoCompleteResults([]); }
  }, [toQuery, ccQuery, bccQuery, activeField, contacts]);

  // Encryption check
  const encryptionKeys = useMemo(() => {
    if (!selectedAccountId) return [];
    try { return getEncryptionKeys(db, selectedAccountId); } catch { return []; }
  }, [db, selectedAccountId]);

  const ownKey = useMemo(() => findOwnKey(selectedAccountId, encryptionKeys), [selectedAccountId, encryptionKeys]);
  const encryptionReady = useMemo(() => {
    if (!ownKey || toRecipients.length === 0) return null;
    return canEncrypt(toRecipients, encryptionKeys);
  }, [ownKey, toRecipients, encryptionKeys]);

  const handleSelectContact = useCallback((email: string) => {
    if (activeField === 'to') {
      setToRecipients((prev) => prev.includes(email) ? prev : [...prev, email]);
      setToQuery('');
    } else if (activeField === 'cc') {
      setCcRecipients((prev) => prev.includes(email) ? prev : [...prev, email]);
      setCcQuery('');
    } else if (activeField === 'bcc') {
      setBccRecipients((prev) => prev.includes(email) ? prev : [...prev, email]);
      setBccQuery('');
    }
    setAutoCompleteResults([]);
    setActiveField(null);
  }, [activeField]);

  const handleCancel = useCallback(() => {
    if (subject || body || toRecipients.length > 0) {
      Alert.alert('Save Draft?', 'Your changes will be lost.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save Draft',
          onPress: () => { saveDraft(); router.back(); },
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            if (draftId) try { deleteDraft(db, draftId); } catch { /* ignored */ }
            router.back();
          },
        },
      ]);
    } else {
      router.back();
    }
  }, [subject, body, toRecipients, draftId, db, router, saveDraft]);

  const handleSend = useCallback(() => {
    if (toRecipients.length === 0 || sending) return;
    setSending(true);
    try {
      const id = `msg_${uuid()}`;
      createMessage(db, id, {
        accountId: selectedAccountId,
        from: accounts.find((a) => a.id === selectedAccountId)?.email ?? '',
        to: toRecipients,
        subject,
        body,
        folder: 'Sent',
      });
      if (draftId) try { deleteDraft(db, draftId); } catch { /* ignored */ }
      router.back();
    } catch (e) {
      Alert.alert('Send Failed', e instanceof Error ? e.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  }, [db, selectedAccountId, toRecipients, ccRecipients, bccRecipients, subject, body, draftId, sending, accounts, router]);

  const isValid = toRecipients.length > 0 && !sending;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleCancel}>
          <Text variant="body" color={ACCENT}>Cancel</Text>
        </Pressable>
        <Text variant="subheading" color={colors.text}>
          {draftId ? 'Draft' : 'Compose'}
        </Text>
        <Pressable
          style={[styles.sendBtn, { backgroundColor: isValid ? ACCENT : colors.surface }]}
          disabled={!isValid}
          onPress={handleSend}
        >
          <Text variant="caption" color={isValid ? colors.text : colors.textTertiary}>
            {sending ? 'Sending...' : 'Send'}
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.form} keyboardDismissMode="interactive">
        {/* Account picker */}
        {accounts.length > 1 && (
          <View style={styles.fieldRow}>
            <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>From</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountPicker}>
              {accounts.map((a) => (
                <Pressable
                  key={a.id}
                  style={[styles.accountChip, selectedAccountId === a.id && styles.accountChipActive]}
                  onPress={() => setSelectedAccountId(a.id)}
                >
                  <View style={[styles.accountDot, { backgroundColor: ACCENT }]} />
                  <Text variant="caption" color={selectedAccountId === a.id ? colors.text : colors.textSecondary}>
                    {a.email}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* To field */}
        <View style={styles.fieldRow}>
          <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>To</Text>
          <View style={styles.tokenField}>
            {toRecipients.map((email) => (
              <View key={email} style={styles.token}>
                <Text variant="caption" color={colors.text}>{email.split('@')[0]}</Text>
                <Pressable onPress={() => setToRecipients((p) => p.filter((e) => e !== email))}>
                  <Text variant="caption" color={colors.textTertiary}> x</Text>
                </Pressable>
              </View>
            ))}
            <TextInput
              style={styles.tokenInput}
              placeholder={toRecipients.length === 0 ? 'Add recipients...' : ''}
              placeholderTextColor={colors.textTertiary}
              value={toQuery}
              onChangeText={(t) => { setToQuery(t); setActiveField('to'); }}
              onFocus={() => setActiveField('to')}
            />
          </View>
        </View>

        {/* Autocomplete dropdown */}
        {autoCompleteResults.length > 0 && (
          <View style={styles.autocomplete}>
            {autoCompleteResults.map((c) => (
              <Pressable
                key={c.id}
                style={styles.autocompleteRow}
                onPress={() => handleSelectContact(c.email)}
              >
                <View style={[styles.acAvatar, { backgroundColor: getAvatarColor(c.email) }]}>
                  <Text style={styles.acAvatarText}>{generateInitials(c.displayName ?? c.email)}</Text>
                </View>
                <View style={styles.acInfo}>
                  <Text variant="body" color={colors.text}>{c.displayName ?? c.email}</Text>
                  <Text variant="caption" color={colors.textSecondary}>{c.email}</Text>
                </View>
                {c.isVip && <Text variant="caption" color={colors.warning}>VIP</Text>}
              </Pressable>
            ))}
          </View>
        )}

        {/* CC / BCC toggles */}
        {!showCc && (
          <Pressable onPress={() => setShowCc(true)} style={styles.addField}>
            <Text variant="caption" color={ACCENT}>Add CC</Text>
          </Pressable>
        )}
        {showCc && (
          <View style={styles.fieldRow}>
            <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>CC</Text>
            <View style={styles.tokenField}>
              {ccRecipients.map((email) => (
                <View key={email} style={styles.token}>
                  <Text variant="caption" color={colors.text}>{email.split('@')[0]}</Text>
                  <Pressable onPress={() => setCcRecipients((p) => p.filter((e) => e !== email))}>
                    <Text variant="caption" color={colors.textTertiary}> x</Text>
                  </Pressable>
                </View>
              ))}
              <TextInput
                style={styles.tokenInput}
                value={ccQuery}
                onChangeText={(t) => { setCcQuery(t); setActiveField('cc'); }}
                onFocus={() => setActiveField('cc')}
              />
            </View>
          </View>
        )}
        {!showBcc && showCc && (
          <Pressable onPress={() => setShowBcc(true)} style={styles.addField}>
            <Text variant="caption" color={ACCENT}>Add BCC</Text>
          </Pressable>
        )}
        {showBcc && (
          <View style={styles.fieldRow}>
            <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>BCC</Text>
            <View style={styles.tokenField}>
              {bccRecipients.map((email) => (
                <View key={email} style={styles.token}>
                  <Text variant="caption" color={colors.text}>{email.split('@')[0]}</Text>
                  <Pressable onPress={() => setBccRecipients((p) => p.filter((e) => e !== email))}>
                    <Text variant="caption" color={colors.textTertiary}> x</Text>
                  </Pressable>
                </View>
              ))}
              <TextInput
                style={styles.tokenInput}
                value={bccQuery}
                onChangeText={(t) => { setBccQuery(t); setActiveField('bcc'); }}
                onFocus={() => setActiveField('bcc')}
              />
            </View>
          </View>
        )}

        {/* Subject */}
        <View style={styles.fieldRow}>
          <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>Subject</Text>
          <TextInput
            style={styles.subjectInput}
            value={subject}
            onChangeText={setSubject}
            placeholder="Subject"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Encryption status */}
        {ownKey && toRecipients.length > 0 && (
          <Pressable
            style={[styles.encryptionBar, { backgroundColor: encryptionReady ? `${colors.success}1A` : `${colors.warning}1A` }]}
            onPress={() => router.push('/(mail)/encryption/')}
          >
            <Text variant="caption" color={encryptionReady ? colors.success : colors.warning}>
              {encryptionReady ? '🔒 Will be encrypted' : '⚠️ Cannot encrypt -- missing keys'}
            </Text>
          </Pressable>
        )}

        {/* Body */}
        <TextInput
          style={styles.bodyInput}
          value={body}
          onChangeText={setBody}
          placeholder="Write your message..."
          placeholderTextColor={colors.textTertiary}
          multiline
          textAlignVertical="top"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sendBtn: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 8 },
  form: { flex: 1 },
  fieldRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  fieldLabel: { width: 50, paddingTop: 4 },
  accountPicker: { flex: 1 },
  accountChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999,
    marginRight: spacing.xs, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  accountChipActive: { borderColor: ACCENT },
  accountDot: { width: 6, height: 6, borderRadius: 3 },
  tokenField: {
    flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center',
  },
  token: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1, borderColor: colors.border,
  },
  tokenInput: {
    flex: 1, minWidth: 100, color: colors.text, fontFamily: 'Inter', fontSize: 14,
    paddingVertical: 2,
  },
  autocomplete: {
    marginHorizontal: spacing.md, backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
  },
  autocompleteRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  acAvatar: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  acAvatarText: { color: colors.text, fontSize: 11, fontWeight: '600' },
  acInfo: { flex: 1 },
  addField: { paddingHorizontal: spacing.md + 50, paddingVertical: spacing.xs },
  subjectInput: {
    flex: 1, color: colors.text, fontFamily: 'Inter', fontSize: 16,
  },
  encryptionBar: {
    marginHorizontal: spacing.md, padding: spacing.sm, borderRadius: 8,
  },
  bodyInput: {
    flex: 1, minHeight: 200, color: colors.text, fontFamily: 'Inter', fontSize: 16,
    padding: spacing.md, lineHeight: 24,
  },
});
