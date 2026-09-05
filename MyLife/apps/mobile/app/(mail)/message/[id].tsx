import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getMessage,
  getAccount,
  getAttachmentsByMessage,
  getCalendarEventsByMessage,
  resolveContact,
  generateInitials,
  getAvatarColor,
  formatFileSize,
  isPreviewableImage,
  isPdf,
  isPgpEncrypted,
  hasPgpSignature,
  markAsRead,
  toggleStar,
  moveToFolder,
  getAccounts,
  getContacts,
  updateRsvpStatus,
} from '@mylife/mail';
import type { MailMessage, MailAttachment, CalendarEvent } from '@mylife/mail';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

export default function MessageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [msgAttachments, setMsgAttachments] = useState<MailAttachment[]>([]);
  const [msgEvents, setMsgEvents] = useState<CalendarEvent[]>([]);

  const accounts = useMemo(() => getAccounts(db), [db]);
  const contacts = useMemo(() => {
    const all: import('@mylife/mail').MailContact[] = [];
    for (const a of accounts) all.push(...getContacts(db, a.id));
    return all;
  }, [db, accounts]);

  const loadData = useCallback(() => {
    if (!id) return;
    try {
      const msg = getMessage(db, id);
      if (!msg) { setError('Message not found'); setLoading(false); return; }
      setMessage(msg);
      if (!msg.isRead) markAsRead(db, msg.id);
      setMsgAttachments(getAttachmentsByMessage(db, msg.id));
      setMsgEvents(getCalendarEventsByMessage(db, msg.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load message');
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStar = useCallback(() => {
    if (!message) return;
    try { toggleStar(db, message.id); loadData(); } catch { /* ignored */ }
  }, [db, message, loadData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  if (error || !message) {
    return (
      <View style={styles.centered}>
        <View style={[styles.errorCard, glass.card]}>
          <Text variant="body" color={colors.danger}>{error ?? 'Message not found'}</Text>
          <Pressable onPress={loadData}>
            <Text variant="caption" color={ACCENT}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const contact = resolveContact(message.from, contacts);
  const displayName = contact?.displayName ?? message.from.split('@')[0];
  const initials = generateInitials(displayName);
  const avatarColor = getAvatarColor(message.from);
  const encrypted = isPgpEncrypted(message.body);
  const signed = hasPgpSignature(message.body);
  const inTrash = message.folder === 'Trash';

  let account: { email: string } | null = null;
  try { account = getAccount(db, message.accountId); } catch { /* ignored */ }

  return (
    <View style={styles.screen}>
      {inTrash && (
        <View style={styles.trashBanner}>
          <Text variant="caption" color={colors.danger}>Message in Trash</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {/* Subject */}
        <View style={styles.subjectRow}>
          <Text variant="heading" color={colors.text} style={styles.subject}>
            {message.subject}
          </Text>
          <Pressable onPress={handleStar} hitSlop={8}>
            <Text style={{ fontSize: 20 }}>{message.isStarred ? '⭐' : '☆'}</Text>
          </Pressable>
        </View>

        {/* Sender card */}
        <View style={styles.senderCard}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text variant="caption" color="#fff">{initials}</Text>
          </View>
          <View style={styles.senderInfo}>
            <View style={styles.senderNameRow}>
              <Text variant="subheading" color={colors.text}>{displayName}</Text>
              {contact?.isVip && (
                <Text variant="caption" color="#F59E0B">VIP</Text>
              )}
            </View>
            <Text variant="caption" color={colors.textSecondary}>{message.from}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {new Date(message.receivedAt).toLocaleString()}
            </Text>
            {account && (
              <View style={styles.accountBadge}>
                <View style={[styles.accountDot, { backgroundColor: ACCENT }]} />
                <Text variant="caption" color={colors.textSecondary}>{account.email}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Recipients */}
        <View style={styles.recipientSection}>
          <Text variant="caption" color={colors.textSecondary}>
            To: {message.to.join(', ')}
          </Text>
        </View>

        {/* Encryption status */}
        {(encrypted || signed) && (
          <View style={styles.encryptionRow}>
            {encrypted && (
              <View style={[styles.encBadge, { backgroundColor: 'rgba(48,209,88,0.1)' }]}>
                <Text variant="caption" color={colors.success}>🔒 End-to-end encrypted</Text>
              </View>
            )}
            {signed && (
              <View style={[styles.encBadge, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                <Text variant="caption" color={ACCENT}>🛡️ Digitally signed</Text>
              </View>
            )}
          </View>
        )}

        {/* Message body */}
        <Text variant="body" color={colors.text} style={styles.body}>
          {message.body}
        </Text>

        {/* Attachments */}
        {msgAttachments.length > 0 && (
          <View style={styles.attachSection}>
            <Text variant="label" color={colors.textTertiary}>
              Attachments ({msgAttachments.length})
            </Text>
            <View style={styles.attachGrid}>
              {msgAttachments.map((att) => (
                <View key={att.id} style={[styles.attachCard, glass.card]}>
                  <Text style={{ fontSize: 24 }}>
                    {isPreviewableImage(att.mimeType) ? '🖼️' : isPdf(att.mimeType) ? '📄' : '📎'}
                  </Text>
                  <Text variant="caption" color={colors.text} numberOfLines={1}>{att.filename}</Text>
                  <Text variant="caption" color={colors.textSecondary}>{formatFileSize(att.sizeBytes)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Calendar events */}
        {msgEvents.map((evt) => (
          <View key={evt.id} style={[styles.eventCard, glass.strong]}>
            <Text variant="subheading" color={colors.text}>{evt.title}</Text>
            <Text variant="body" color={colors.textSecondary}>
              {evt.isAllDay ? 'All Day' : `${new Date(evt.startTime).toLocaleString()}`}
            </Text>
            {evt.location && (
              <Text variant="caption" color={colors.textSecondary}>📍 {evt.location}</Text>
            )}
            <View style={styles.rsvpRow}>
              {(['accepted', 'tentative', 'declined'] as const).map((status) => (
                <Pressable
                  key={status}
                  style={[
                    styles.rsvpBtn,
                    evt.rsvpStatus === status && { backgroundColor: status === 'accepted' ? 'rgba(48,209,88,0.2)' : status === 'declined' ? 'rgba(255,69,58,0.2)' : 'rgba(59,130,246,0.2)' },
                  ]}
                  onPress={() => updateRsvpStatus(db, evt.id, status)}
                >
                  <Text variant="caption" color={evt.rsvpStatus === status ? (status === 'accepted' ? colors.success : status === 'declined' ? colors.danger : ACCENT) : colors.textSecondary}>
                    {status === 'accepted' ? 'Accept' : status === 'declined' ? 'Decline' : 'Tentative'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <Pressable
          style={styles.bottomAction}
          onPress={() => router.push({ pathname: '/(mail)/compose-message', params: { replyTo: message.id } })}
        >
          <Text variant="caption" color={ACCENT}>Reply</Text>
        </Pressable>
        <Pressable
          style={styles.bottomAction}
          onPress={() => router.push({ pathname: '/(mail)/compose-message', params: { replyAll: message.id } })}
        >
          <Text variant="caption" color={ACCENT}>Reply All</Text>
        </Pressable>
        <Pressable
          style={styles.bottomAction}
          onPress={() => router.push({ pathname: '/(mail)/compose-message', params: { forward: message.id } })}
        >
          <Text variant="caption" color={ACCENT}>Forward</Text>
        </Pressable>
        <Pressable
          style={styles.bottomAction}
          onPress={() => {
            if (!message) return;
            try { moveToFolder(db, message.id, 'Trash'); router.back(); } catch { /* ignored */ }
          }}
        >
          <Text variant="caption" color={colors.danger}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background, padding: spacing.lg,
  },
  errorCard: { padding: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  trashBanner: {
    backgroundColor: 'rgba(255,69,58,0.1)', padding: spacing.sm,
    alignItems: 'center',
  },
  content: { padding: spacing.md, paddingBottom: 80, gap: spacing.md },
  subjectRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  subject: { flex: 1, marginRight: spacing.sm },
  senderCard: { flexDirection: 'row', gap: spacing.sm },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  senderInfo: { flex: 1, gap: 2 },
  senderNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  accountBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  accountDot: { width: 6, height: 6, borderRadius: 3 },
  recipientSection: {
    paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  encryptionRow: { gap: spacing.xs },
  encBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  body: { lineHeight: 24 },
  attachSection: { gap: spacing.sm },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  attachCard: { padding: spacing.sm, gap: spacing.xs, minWidth: 100, alignItems: 'center' },
  eventCard: { padding: spacing.md, gap: spacing.xs },
  rsvpRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  rsvpBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
  },
  bottomBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  bottomAction: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
});
