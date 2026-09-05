import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';
import { usePolls } from '../../hooks/rsvp/use-polls';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.rsvp;

export default function PollsScreen() {
  const { selectedEventId, selectedEvent } = useRsvpContext();
  const { polls, votesById, loading, error, refresh, create, vote, close } = usePolls(selectedEventId ?? undefined);
  const [refreshing, setRefreshing] = useState(false);

  // Create poll form
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => requestAnimationFrame(r));
    refresh();
    setRefreshing(false);
  }, [refresh]);

  if (!selectedEventId || !selectedEvent) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>{'\uD83D\uDCCA'}</Text>
        <Text variant="subheading">No event selected</Text>
        <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
          Select an event from the Events tab to view or create polls.
        </Text>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text variant="subheading" color={colors.danger}>Error loading polls</Text>
        <Text variant="body" color={colors.textSecondary}>{error.message}</Text>
        <Pressable style={styles.retryButton} onPress={refresh}>
          <Text variant="label" color={ACCENT}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const handleCreate = () => {
    const q = question.trim();
    const a = optionA.trim();
    const b = optionB.trim();
    if (!q || !a || !b) return;

    const options = [
      { id: uuid(), label: a },
      { id: uuid(), label: b },
    ];
    const c = optionC.trim();
    if (c) options.push({ id: uuid(), label: c });

    create({ question: q, options, multipleChoice: false });
    setQuestion('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setShowCreate(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />
      }
    >
      <Text variant="caption" color={colors.textTertiary}>{selectedEvent.title}</Text>

      {/* Create Poll Toggle */}
      {selectedEvent.allowPolls ? (
        <Pressable
          style={styles.createToggle}
          onPress={() => setShowCreate(!showCreate)}
        >
          <Text variant="label" color={ACCENT}>
            {showCreate ? 'Cancel' : '+ New Poll'}
          </Text>
        </Pressable>
      ) : (
        <Card style={styles.disabledNotice}>
          <Text variant="caption" color={colors.textTertiary}>Polls are disabled for this event.</Text>
        </Card>
      )}

      {/* Create Poll Form */}
      {showCreate ? (
        <Card style={styles.formCard}>
          <TextInput
            style={styles.input}
            value={question}
            onChangeText={setQuestion}
            placeholder="Poll question"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={optionA}
            onChangeText={setOptionA}
            placeholder="Option A"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={optionB}
            onChangeText={setOptionB}
            placeholder="Option B"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={optionC}
            onChangeText={setOptionC}
            placeholder="Option C (optional)"
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable style={styles.createButton} onPress={handleCreate}>
            <Text variant="label" color={colors.background}>Create Poll</Text>
          </Pressable>
        </Card>
      ) : null}

      {/* Empty State */}
      {polls.length === 0 && !showCreate ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>{'\uD83D\uDCCA'}</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            No polls yet. Create one to let your guests vote.
          </Text>
        </Card>
      ) : null}

      {/* Poll Cards */}
      {polls.map((poll) => {
        const votes = votesById.get(poll.id) ?? [];
        const totalVotes = votes.length;

        return (
          <Card key={poll.id} style={styles.pollCard}>
            <View style={styles.pollHeader}>
              <Text variant="body" style={{ fontWeight: '600', flex: 1 }}>{poll.question}</Text>
              {poll.isOpen ? (
                <View style={styles.openBadge}>
                  <Text variant="caption" color={colors.success}>Open</Text>
                </View>
              ) : (
                <View style={styles.closedBadge}>
                  <Text variant="caption" color={colors.textTertiary}>Closed</Text>
                </View>
              )}
            </View>

            {/* Options with vote counts */}
            {poll.options.map((option) => {
              const optionVotes = votes.filter((v) => v.optionId === option.id).length;
              const pct = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;

              return (
                <Pressable
                  key={option.id}
                  style={styles.optionRow}
                  onPress={() => {
                    if (poll.isOpen) {
                      vote(poll.id, { optionId: option.id, guestName: 'Host' });
                    }
                  }}
                  disabled={!poll.isOpen}
                >
                  <View style={[styles.optionBar, { width: `${Math.max(pct, 2)}%` }]} />
                  <View style={styles.optionContent}>
                    <Text variant="body">{option.label}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {optionVotes} vote{optionVotes !== 1 ? 's' : ''} ({pct}%)
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            <View style={styles.pollFooter}>
              <Text variant="caption" color={colors.textTertiary}>
                {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
              </Text>
              {poll.isOpen ? (
                <Pressable style={styles.closeButton} onPress={() => close(poll.id)}>
                  <Text variant="caption" color={colors.danger}>Close Poll</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 48 },
  createToggle: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  disabledNotice: { paddingVertical: spacing.sm },
  formCard: { gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    fontSize: 15,
  },
  createButton: {
    borderRadius: 8,
    backgroundColor: ACCENT,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  pollCard: { gap: spacing.sm },
  pollHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  openBadge: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  closedBadge: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  optionRow: {
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    position: 'relative',
  },
  optionBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.glass,
    borderRadius: 8,
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  pollFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  retryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
});
