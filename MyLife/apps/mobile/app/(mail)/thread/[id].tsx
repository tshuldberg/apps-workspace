import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getThread,
  getMessagesByThread,
  getContacts,
  getAccounts,
  getAttachmentsByMessage,
  getCalendarEventsByMessage,
  sortThreadMessages,
  buildThreadMetadata,
  resolveContact,
  generateInitials,
  getAvatarColor,
  formatFileSize,
  isPreviewableImage,
  isPdf,
  isPgpEncrypted,
  hasPgpSignature,
  markAsRead,
  muteThread,
  updateRsvpStatus,
} from '@mylife/mail';
import type { MailMessage, MailAttachment, CalendarEvent } from '@mylife/mail';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

export default function ThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [attachments, setAttachments] = useState<Record<string, MailAttachment[]>>({});
  const [events, setEvents] = useState<Record<string, CalendarEvent[]>>({});
  const [quickReply, setQuickReply] = useState('');
  const [threadMuted, setThreadMuted] = useState(false);

  const accounts = useMemo(() => getAccounts(db), [db]);
  const contacts = useMemo(() => {
    const all: import('@mylife/mail').MailContact[] = [];
    for (const a of accounts) all.push(...getContacts(db, a.id));
    return all;
  }, [db, accounts]);

  const loadData = useCallback(() => {
    if (!id) return;
    try {
      const thread = getThread(db, id);
      if (!thread) { setError('Thread not found'); setLoading(false); return; }
      setThreadMuted(thread.isMuted);

      const threadMessages = getMessagesByThread(db, id);
      const sorted = sortThreadMessages(threadMessages);
      setMessages(sorted);

      // Auto-expand latest message
      if (sorted.length > 0) {
        setExpandedIds(new Set([sorted[sorted.length - 1].id]));
      }

      // Load attachments and events for each message
      const attMap: Record<string, MailAttachment[]> = {};
      const evtMap: Record<string, CalendarEvent[]> = {};
      for (const m of sorted) {
        attMap[m.id] = getAttachmentsByMessage(db, m.id);
        evtMap[m.id] = getCalendarEventsByMessage(db, m.id);
        if (!m.isRead) markAsRead(db, m.id);
      }
      setAttachments(attMap);
      setEvents(evtMap);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load thread');
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useEffect(() => { loadData(); }, [loadData]);

  const thread = useMemo(() => {
    if (!id) return null;
    try { return getThread(db, id); } catch { return null; }
  }, [db, id]);

  const metadata = useMemo(() => buildThreadMetadata(messages), [messages]);

  const toggleExpand = useCallback((messageId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

  const handleMuteToggle = useCallback(() => {
    if (!id) return;
    try {
      muteThread(db, id, !threadMuted);
      setThreadMuted(!threadMuted);
    } catch { /* ignored */ }
  }, [db, id, threadMuted]);

  const handleRsvp = useCallback((eventId: string, status: 'accepted' | 'declined' | 'tentative') => {
    try {
      updateRsvpStatus(db, eventId, status);
      loadData();
    } catch { /* ignored */ }
  }, [db, loadData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  if (error || !thread) {
    return (
      <View style={styles.centered}>
        <View style={[styles.errorCard, glass.card]}>
          <Text variant="body" color={colors.danger}>{error ?? 'Thread not found'}</Text>
          <Pressable onPress={loadData}>
            <Text variant="caption" color={ACCENT}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header info */}
      <View style={styles.header}>
        <Text variant="subheading" color={colors.text} numberOfLines={2}>
          {thread.subject}
        </Text>
        <View style={styles.headerMeta}>
          <Text variant="caption" color={colors.textSecondary}>
            {metadata.participantEmails.length} participant{metadata.participantEmails.length !== 1 ? 's' : ''}
          </Text>
          <Pressable onPress={handleMuteToggle} hitSlop={8}>
            <Text variant="caption" color={threadMuted ? colors.textTertiary : colors.textSecondary}>
              {threadMuted ? '🔕 Muted' : '🔔'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.messageList} contentContainerStyle={styles.messageListContent}>
        {messages.map((msg) => {
          const isExpanded = expandedIds.has(msg.id);
          const contact = resolveContact(msg.from, contacts);
          const displayName = contact?.displayName ?? msg.from.split('@')[0];
          const initials = generateInitials(displayName);
          const avatarColor = getAvatarColor(msg.from);
          const msgAttachments = attachments[msg.id] ?? [];
          const msgEvents = events[msg.id] ?? [];
          const encrypted = isPgpEncrypted(msg.body);
          const signed = hasPgpSignature(msg.body);

          if (!isExpanded) {
            // Collapsed row
            return (
              <Pressable
                key={msg.id}
                style={styles.collapsedRow}
                onPress={() => toggleExpand(msg.id)}
              >
                <View style={[styles.avatarSmall, { backgroundColor: avatarColor }]}>
                  <Text style={styles.avatarSmallText}>{initials}</Text>
                </View>
                <View style={styles.collapsedContent}>
                  <Text variant="body" color={colors.textSecondary} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text variant="body" color={colors.textSecondary} numberOfLines={2}>
                    {msg.body.slice(0, 120)}
                  </Text>
                </View>
                <Text variant="caption" color={colors.textSecondary}>
                  {formatTimestamp(msg.receivedAt)}
                </Text>
              </Pressable>
            );
          }

          // Expanded message
          return (
            <Pressable
              key={msg.id}
              style={[styles.expandedCard, glass.card]}
              onPress={() => messages.length > 1 ? toggleExpand(msg.id) : undefined}
            >
              {/* Sender header */}
              <View style={styles.senderRow}>
                <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                  <Text variant="caption" color="#fff">{initials}</Text>
                </View>
                <View style={styles.senderInfo}>
                  <Text variant="subheading" color={colors.text}>{displayName}</Text>
                  <Text variant="caption" color={colors.textSecondary}>{msg.from}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    To: {msg.to.join(', ')}
                  </Text>
                </View>
              </View>

              <Text variant="caption" color={colors.textSecondary}>
                {new Date(msg.receivedAt).toLocaleString()}
              </Text>

              {/* Encryption badges */}
              {(encrypted || signed) && (
                <View style={styles.badgeRow}>
                  {encrypted && (
                    <View style={[styles.badge, { backgroundColor: 'rgba(48,209,88,0.15)' }]}>
                      <Text variant="caption" color={colors.success}>🔒 Encrypted</Text>
                    </View>
                  )}
                  {signed && (
                    <View style={[styles.badge, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                      <Text variant="caption" color={ACCENT}>🛡️ Signed</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Message body */}
              <Text variant="body" color={colors.text} style={styles.messageBody}>
                {msg.body}
              </Text>

              {/* Attachments */}
              {msgAttachments.length > 0 && (
                <View style={styles.attachmentSection}>
                  {msgAttachments.map((att) => (
                    <View key={att.id} style={styles.attachmentChip}>
                      <Text variant="caption" color={colors.textSecondary}>
                        {isPdf(att.mimeType) ? '📄' : isPreviewableImage(att.mimeType) ? '🖼️' : '📎'}{' '}
                        {att.filename} ({formatFileSize(att.sizeBytes)})
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Calendar events */}
              {msgEvents.map((evt) => (
                <View key={evt.id} style={[styles.eventCard, glass.strong]}>
                  <Text variant="subheading" color={colors.text}>{evt.title}</Text>
                  <Text variant="body" color={colors.textSecondary}>
                    {evt.isAllDay ? 'All Day' : `${new Date(evt.startTime).toLocaleString()} - ${new Date(evt.endTime).toLocaleTimeString()}`}
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
                          evt.rsvpStatus === status && styles.rsvpBtnActive,
                          evt.rsvpStatus === status && status === 'accepted' && { backgroundColor: 'rgba(48,209,88,0.2)' },
                          evt.rsvpStatus === status && status === 'declined' && { backgroundColor: 'rgba(255,69,58,0.2)' },
                          evt.rsvpStatus === status && status === 'tentative' && { backgroundColor: 'rgba(59,130,246,0.2)' },
                        ]}
                        onPress={() => handleRsvp(evt.id, status)}
                      >
                        <Text
                          variant="caption"
                          color={evt.rsvpStatus === status
                            ? status === 'accepted' ? colors.success : status === 'declined' ? colors.danger : ACCENT
                            : colors.textSecondary}
                        >
                          {status === 'accepted' ? 'Accept' : status === 'declined' ? 'Decline' : 'Tentative'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}

              {/* Action bar */}
              <View style={styles.actionBar}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push({ pathname: '/(mail)/compose-message', params: { replyTo: msg.id } })}
                >
                  <Text variant="caption" color={ACCENT}>Reply</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push({ pathname: '/(mail)/compose-message', params: { replyAll: msg.id } })}
                >
                  <Text variant="caption" color={ACCENT}>Reply All</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push({ pathname: '/(mail)/compose-message', params: { forward: msg.id } })}
                >
                  <Text variant="caption" color={ACCENT}>Forward</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Quick reply bar */}
      <View style={[styles.quickReply, glass.dock]}>
        <Pressable
          onPress={() => router.push({
            pathname: '/(mail)/compose-message',
            params: { replyTo: messages[messages.length - 1]?.id, prefill: quickReply },
          })}
          hitSlop={8}
        >
          <Text variant="caption" color={colors.textSecondary}>↗</Text>
        </Pressable>
        <TextInput
          style={styles.quickReplyInput}
          placeholder="Quick reply..."
          placeholderTextColor={colors.textTertiary}
          value={quickReply}
          onChangeText={setQuickReply}
          multiline
          maxLength={500}
        />
        <Pressable
          style={[styles.sendBtn, { backgroundColor: quickReply.trim() ? ACCENT : colors.surface }]}
          disabled={!quickReply.trim()}
        >
          <Text variant="caption" color={quickReply.trim() ? '#fff' : colors.textTertiary}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background, padding: spacing.lg,
  },
  errorCard: { padding: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  header: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerMeta: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: spacing.xs,
  },
  messageList: { flex: 1 },
  messageListContent: { padding: spacing.md, gap: spacing.sm, paddingBottom: 100 },
  collapsedRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  avatarSmall: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarSmallText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  collapsedContent: { flex: 1, gap: 2 },
  expandedCard: { padding: spacing.md, gap: spacing.sm },
  senderRow: { flexDirection: 'row', gap: spacing.sm },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  senderInfo: { flex: 1, gap: 2 },
  badgeRow: { flexDirection: 'row', gap: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6 },
  messageBody: { marginTop: spacing.xs },
  attachmentSection: { gap: spacing.xs },
  attachmentChip: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    backgroundColor: colors.surface, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  eventCard: { padding: spacing.md, gap: spacing.xs },
  rsvpRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  rsvpBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
  },
  rsvpBtnActive: { borderColor: 'transparent' },
  actionBar: {
    flexDirection: 'row', gap: spacing.md,
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionBtn: { paddingVertical: spacing.xs },
  quickReply: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.sm, gap: spacing.sm,
    margin: spacing.sm,
  },
  quickReplyInput: {
    flex: 1, color: colors.text, fontFamily: 'Inter', fontSize: 14,
    maxHeight: 80,
  },
  sendBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: 8,
  },
});
