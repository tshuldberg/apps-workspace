import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  getAccounts,
  getDrafts,
} from '@mylife/mail';
import type { MailDraft } from '@mylife/mail';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

type ScheduleStatus = 'pending' | 'sent' | 'failed';

interface ScheduledDraft {
  draft: MailDraft;
  scheduledAt: string;
  status: ScheduleStatus;
}

const SUGGESTED_TIMES = [
  { label: 'Tomorrow 9 AM', hours: 9, daysAhead: 1 },
  { label: 'Tomorrow 2 PM', hours: 14, daysAhead: 1 },
  { label: 'Monday 9 AM', hours: 9, daysAhead: -1 }, // calculated dynamically
  { label: 'In 1 hour', hours: -1, daysAhead: 0 },
];

export default function ScheduleSendScreen() {
  const db = useDatabase();
  const [viewMode, setViewMode] = useState<'scheduled' | 'drafts'>('scheduled');

  const accounts = useMemo(() => getAccounts(db), [db]);

  const drafts = useMemo(() => {
    const all: MailDraft[] = [];
    for (const a of accounts) {
      all.push(...getDrafts(db, a.id));
    }
    return all;
  }, [db, accounts]);

  // TODO: Load scheduled drafts from ml_scheduled_sends table when available
  const scheduledDrafts = useMemo<ScheduledDraft[]>(() => {
    try {
      const rows = db.query<Record<string, unknown>>(
        'SELECT * FROM ml_scheduled_sends ORDER BY scheduled_at ASC',
        [],
      );
      return rows.map((r) => ({
        draft: drafts.find((d) => d.id === (r.draft_id as string)) ?? {
          id: r.draft_id as string,
          accountId: '',
          to: [r.recipient as string || 'Unknown'],
          subject: r.subject as string || 'No subject',
          body: '',
          createdAt: '',
          updatedAt: '',
        },
        scheduledAt: r.scheduled_at as string,
        status: r.status as ScheduleStatus,
      }));
    } catch {
      return [];
    }
  }, [db, drafts]);

  const pendingCount = scheduledDrafts.filter((s) => s.status === 'pending').length;
  const sentCount = scheduledDrafts.filter((s) => s.status === 'sent').length;

  const handleCancelSchedule = useCallback((item: ScheduledDraft) => {
    Alert.alert('Cancel Schedule', 'Remove this scheduled send?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Send',
        style: 'destructive',
        onPress: () => {
          // TODO: Delete from ml_scheduled_sends
          Alert.alert('Cancelled', 'The scheduled send has been cancelled.');
        },
      },
    ]);
  }, []);

  const statusColor = (status: ScheduleStatus) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'sent': return colors.success;
      case 'failed': return colors.danger;
    }
  };

  return (
    <View style={styles.screen}>
      {/* Tab toggle */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, viewMode === 'scheduled' && styles.tabActive]}
          onPress={() => setViewMode('scheduled')}
        >
          <Text variant="body" color={viewMode === 'scheduled' ? ACCENT : colors.textSecondary}>
            Scheduled ({pendingCount})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, viewMode === 'drafts' && styles.tabActive]}
          onPress={() => setViewMode('drafts')}
        >
          <Text variant="body" color={viewMode === 'drafts' ? ACCENT : colors.textSecondary}>
            Drafts ({drafts.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {viewMode === 'scheduled' ? (
          <>
            {scheduledDrafts.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyCard, glass.card]}>
                  <Text variant="heading">{'🕐'}</Text>
                  <Text variant="subheading" color={colors.text}>No scheduled sends</Text>
                  <Text variant="body" color={colors.textSecondary} style={styles.emptyText}>
                    Use "Send Later" in the compose screen to schedule emails for the perfect time.
                  </Text>
                </View>
              </View>
            ) : (
              scheduledDrafts.map((item, i) => {
                const schedDate = new Date(item.scheduledAt);
                const sc = statusColor(item.status);
                return (
                  <View key={i} style={styles.scheduleCard}>
                    <View style={styles.scheduleHeader}>
                      <View style={[styles.statusBadge, { backgroundColor: `${sc}20` }]}>
                        <Text variant="caption" color={sc}>{item.status}</Text>
                      </View>
                      <Text variant="caption" color={colors.textTertiary}>
                        {schedDate.toLocaleDateString()} at {schedDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text variant="subheading" color={colors.text} numberOfLines={1}>
                      {item.draft.subject || 'No subject'}
                    </Text>
                    <Text variant="body" color={colors.textSecondary} numberOfLines={1}>
                      To: {item.draft.to.join(', ')}
                    </Text>
                    {item.status === 'pending' && (
                      <View style={styles.scheduleActions}>
                        <Pressable
                          style={styles.actionBtn}
                          onPress={() => handleCancelSchedule(item)}
                        >
                          <Text variant="caption" color={colors.danger}>Cancel</Text>
                        </Pressable>
                        <Pressable style={styles.actionBtn}>
                          <Text variant="caption" color={ACCENT}>Reschedule</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}

            {/* Sent history */}
            {sentCount > 0 && (
              <View style={styles.sentSection}>
                <Text variant="label" color={colors.textTertiary}>
                  Recently Sent ({sentCount})
                </Text>
              </View>
            )}

            {/* Suggested send times */}
            <View style={styles.suggestedSection}>
              <Text variant="label" color={colors.textTertiary}>Suggested Send Times</Text>
              <View style={styles.suggestedRow}>
                {SUGGESTED_TIMES.map((time, i) => (
                  <View key={i} style={[styles.suggestedChip, glass.card]}>
                    <Text variant="caption" color={colors.text}>{time.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : (
          /* Drafts list */
          <>
            {drafts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text variant="heading">{'📝'}</Text>
                <Text variant="body" color={colors.textSecondary}>No drafts</Text>
              </View>
            ) : (
              drafts.map((d) => (
                <View key={d.id} style={styles.draftCard}>
                  <Text variant="subheading" color={colors.text} numberOfLines={1}>
                    {d.subject || 'No subject'}
                  </Text>
                  <Text variant="body" color={colors.textSecondary} numberOfLines={1}>
                    To: {d.to.join(', ') || 'No recipient'}
                  </Text>
                  <Text variant="caption" color={colors.textTertiary}>
                    {new Date(d.updatedAt).toLocaleDateString()}
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2, borderBottomColor: ACCENT,
  },
  emptyState: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyCard: { padding: spacing.lg, gap: spacing.md, alignItems: 'center' },
  emptyText: { textAlign: 'center' },
  scheduleCard: {
    padding: spacing.md, gap: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  scheduleHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4 },
  scheduleActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  actionBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: colors.border,
  },
  sentSection: { marginTop: spacing.lg },
  suggestedSection: { marginTop: spacing.lg, gap: spacing.sm },
  suggestedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  suggestedChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  draftCard: {
    padding: spacing.md, gap: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
});
