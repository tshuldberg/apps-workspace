import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  createMessage,
  getMessagesByEvent,
  getMessageCount,
  getEvents,
} from '@mylife/rsvp';
import { Card, Text, EmptyState, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';

const ACCENT = colors.modules.rsvp;

const TEMPLATES = [
  { label: 'Reminder', text: 'Friendly reminder about our upcoming event!' },
  { label: 'Update', text: 'Quick update about the event details...' },
  { label: 'Thank You', text: 'Thank you for attending! It was wonderful to see everyone.' },
  { label: 'Directions', text: 'Here are the directions to the venue...' },
  { label: 'What to Bring', text: 'Please remember to bring...' },
];

export default function MessagingScreen() {
  const db = useDatabase();
  const { selectedEventId } = useRsvpContext();
  const [tick, setTick] = useState(0);
  const [messageText, setMessageText] = useState('');
  const [senderName, setSenderName] = useState('Host');

  const refresh = () => setTick((v) => v + 1);
  const events = useMemo(() => getEvents(db), [db, tick]);
  const eventId = selectedEventId ?? events[0]?.id ?? null;

  const messages = useMemo(
    () => (eventId ? getMessagesByEvent(db, eventId) : []),
    [db, eventId, tick],
  );

  const messageCount = useMemo(
    () => (eventId ? getMessageCount(db, eventId) : 0),
    [db, eventId, tick],
  );

  const handleSend = () => {
    if (!eventId || !messageText.trim()) return;
    const id = `msg_${Date.now()}`;
    createMessage(db, id, eventId, {
      senderName: senderName.trim() || 'Host',
      message: messageText.trim(),
      isHostMessage: true,
    });
    setMessageText('');
    refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!eventId ? (
        <EmptyState
          icon={'\uD83D\uDCE9'}
          title="No event selected"
          message="Select an event to send messages."
        />
      ) : (
        <>
          <Card>
            <Text variant="subheading">Guest Messages</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {messageCount} message{messageCount !== 1 ? 's' : ''}
            </Text>
          </Card>

          {/* Message templates */}
          <Card>
            <Text variant="subheading">Quick Templates</Text>
            <View style={styles.chipRow}>
              {TEMPLATES.map((t) => (
                <Pressable
                  key={t.label}
                  style={styles.chip}
                  onPress={() => setMessageText(t.text)}
                >
                  <Text variant="caption" color={colors.textSecondary}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          {/* Compose */}
          <Card>
            <Text variant="subheading">Compose Message</Text>
            <View style={styles.formGrid}>
              <TextInput
                style={styles.input}
                value={senderName}
                onChangeText={setSenderName}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
              />
              <TextInput
                style={[styles.input, styles.multiline]}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Type your message..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={4}
              />
              <Pressable style={styles.primaryButton} onPress={handleSend}>
                <Text variant="label" color={colors.background}>Send Message</Text>
              </Pressable>
            </View>
          </Card>

          {/* Message history */}
          <Card>
            <Text variant="subheading">Message History</Text>
            <View style={styles.list}>
              {messages.length === 0 ? (
                <EmptyState
                  icon={'\uD83D\uDCAC'}
                  title="No messages sent yet"
                  message="Send your first message above."
                />
              ) : (
                messages.map((msg) => (
                  <View key={msg.id} style={styles.messageRow}>
                    <View style={styles.messageMeta}>
                      <Text variant="body">{msg.senderName}</Text>
                      {msg.isHostMessage && (
                        <View style={[styles.badge, { backgroundColor: ACCENT }]}>
                          <Text variant="caption" color={colors.background}>HOST</Text>
                        </View>
                      )}
                      {msg.isPinned && (
                        <View style={[styles.badge, { backgroundColor: colors.warning }]}>
                          <Text variant="caption" color={colors.background}>PINNED</Text>
                        </View>
                      )}
                    </View>
                    <Text variant="caption" color={colors.text}>{msg.message}</Text>
                    <Text variant="caption" color={colors.textTertiary}>
                      {msg.createdAt.slice(0, 16).replace('T', ' ')}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  messageRow: {
    gap: 4, padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  messageMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: 999 },
  formGrid: { gap: spacing.sm, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: colors.surfaceElevated,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
