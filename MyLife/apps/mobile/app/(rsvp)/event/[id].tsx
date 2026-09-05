import { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Card, Text, EmptyState, LoadingState, colors, spacing } from '@mylife/ui';
import { useEvent } from '../../../hooks/rsvp/use-events';
import { useGuests } from '../../../hooks/rsvp/use-guests';
import { usePolls } from '../../../hooks/rsvp/use-polls';
import { useFeed } from '../../../hooks/rsvp/use-feed';
import { useRsvpContext } from '../../../components/rsvp/RsvpContext';
import { useDatabase } from '../../../components/DatabaseProvider';
import { getEventAnalytics, deleteEvent, type EventAnalytics } from '@mylife/rsvp';

const ACCENT = colors.modules.rsvp;

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card style={styles.statCard}>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </Card>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="subheading">{title}</Text>
      {count !== undefined ? (
        <View style={styles.countBadge}>
          <Text variant="caption" color={ACCENT}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const { selectEvent, refreshEvents } = useRsvpContext();
  const { event, summary, loading } = useEvent(id);
  const { invites, rsvps } = useGuests(id);
  const { polls } = usePolls(id);
  const { announcements, comments, photos } = useFeed(id);

  const analytics = useMemo<EventAnalytics | null>(() => {
    if (!id) return null;
    try { return getEventAnalytics(db, id); } catch { return null; }
  }, [db, id]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Event',
      'This will permanently delete this event and all its data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEvent(db, id);
            refreshEvents();
            router.back();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Event', headerBackTitle: 'Events' }} />
        <View style={styles.center}>
          <LoadingState rows={5} />
        </View>
      </>
    );
  }

  if (!event) {
    return (
      <>
        <Stack.Screen options={{ title: 'Event', headerBackTitle: 'Events' }} />
        <View style={styles.center}>
          <EmptyState
            icon={'\uD83D\uDE36'}
            title="Event not found"
            message="This event may have been deleted."
          />
        </View>
      </>
    );
  }

  const isPast = new Date(event.startAt) < new Date();

  return (
    <>
      <Stack.Screen options={{ title: event.title, headerBackTitle: 'Events' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Event Header */}
        <Card style={styles.headerCard}>
          <Text variant="heading" numberOfLines={2}>{event.title}</Text>
          {event.description ? (
            <Text variant="body" color={colors.textSecondary}>{event.description}</Text>
          ) : null}
          <View style={styles.metaRow}>
            <Text variant="caption" color={colors.textSecondary}>
              {'\uD83D\uDCC5'} {new Date(event.startAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              {'\uD83D\uDD52'} {new Date(event.startAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              {event.endAt ? ` - ${new Date(event.endAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}
            </Text>
          </View>
          {event.locationName ? (
            <Text variant="caption" color={colors.textSecondary}>
              {'\uD83D\uDCCD'} {event.locationName}
              {event.locationAddress ? ` - ${event.locationAddress}` : ''}
            </Text>
          ) : null}
          {isPast ? (
            <View style={styles.pastBanner}>
              <Text variant="caption" color={colors.textTertiary}>This event has passed</Text>
            </View>
          ) : null}
        </Card>

        {/* RSVP Stats */}
        {summary ? (
          <>
            <SectionHeader title="RSVPs" />
            <View style={styles.statsGrid}>
              <StatCard label="Going" value={String(summary.going)} color={colors.success} />
              <StatCard label="Maybe" value={String(summary.maybe)} color={colors.warning} />
              <StatCard label="Declined" value={String(summary.declined)} color={colors.danger} />
              <StatCard label="Waitlisted" value={String(summary.waitlisted)} />
              <StatCard label="Checked In" value={String(summary.checkedIn)} color={ACCENT} />
              <StatCard label="Plus Ones" value={String(summary.plusOnes)} />
            </View>
          </>
        ) : null}

        {/* Analytics */}
        {analytics ? (
          <Card style={styles.analyticsCard}>
            <Text variant="label" color={colors.textTertiary}>ANALYTICS</Text>
            <View style={styles.analyticsRow}>
              <Text variant="body">Response Rate</Text>
              <Text variant="body" color={ACCENT}>{Math.round(analytics.responseRate * 100)}%</Text>
            </View>
            <View style={styles.analyticsRow}>
              <Text variant="body">Total Responses</Text>
              <Text variant="body">{analytics.responses}</Text>
            </View>
          </Card>
        ) : null}

        {/* Quick Stats Row */}
        <Card>
          <Text variant="label" color={colors.textTertiary}>ACTIVITY</Text>
          <View style={styles.activityGrid}>
            <ActivityStat icon={'\uD83D\uDC65'} label="Invites" count={invites.length} />
            <ActivityStat icon={'\uD83D\uDCCA'} label="Polls" count={polls.length} />
            <ActivityStat icon={'\uD83D\uDCE2'} label="Announcements" count={announcements.length} />
            <ActivityStat icon={'\uD83D\uDCAC'} label="Comments" count={comments.length} />
            <ActivityStat icon={'\uD83D\uDCF7'} label="Photos" count={photos.length} />
          </View>
        </Card>

        {/* Guest Preview */}
        {rsvps.length > 0 ? (
          <Card>
            <SectionHeader title="Recent RSVPs" count={rsvps.length} />
            {rsvps.slice(0, 5).map((rsvp) => (
              <View key={rsvp.id} style={styles.guestRow}>
                <View style={styles.guestInfo}>
                  <Text variant="body">{rsvp.guestName}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {rsvp.response}{rsvp.plusOnesCount > 0 ? ` +${rsvp.plusOnesCount}` : ''}
                    {rsvp.checkedInAt ? ' (checked in)' : ''}
                  </Text>
                </View>
                <ResponseBadge response={rsvp.response} />
              </View>
            ))}
          </Card>
        ) : null}

        {/* Event Settings */}
        <Card>
          <Text variant="label" color={colors.textTertiary}>EVENT SETTINGS</Text>
          <SettingRow label="Visibility" value={event.visibility} />
          <SettingRow label="Requires Approval" value={event.requiresApproval ? 'Yes' : 'No'} />
          <SettingRow label="Plus Ones" value={event.allowPlusOnes ? 'Allowed' : 'Disabled'} />
          <SettingRow label="Max Guests" value={event.maxGuests ? String(event.maxGuests) : 'Unlimited'} />
          <SettingRow label="Waitlist" value={event.waitlistEnabled ? 'Enabled' : 'Disabled'} />
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={styles.selectButton}
            onPress={() => {
              selectEvent(event.id);
              router.back();
            }}
          >
            <Text variant="label" color={colors.background}>Set as Active Event</Text>
          </Pressable>
          {!isPast ? (
            <Pressable
              style={styles.checkInButton}
              onPress={() => {
                selectEvent(event.id);
                router.push('/(rsvp)/check-in');
              }}
            >
              <Text variant="label" color={ACCENT}>Open Check-In</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text variant="label" color={colors.danger}>Delete Event</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

function ResponseBadge({ response }: { response: string }) {
  const colorMap: Record<string, string> = {
    going: colors.success,
    maybe: colors.warning,
    declined: colors.danger,
    waitlisted: colors.textTertiary,
  };
  return (
    <View style={[styles.responseBadge, { borderColor: colorMap[response] ?? colors.border }]}>
      <Text variant="caption" color={colorMap[response] ?? colors.textSecondary}>
        {response}
      </Text>
    </View>
  );
}

function ActivityStat({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <View style={styles.activityStat}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <Text style={styles.activityCount}>{count}</Text>
    </View>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <Text variant="body" color={colors.textSecondary}>{label}</Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  headerCard: { gap: spacing.sm },
  metaRow: { gap: 4 },
  pastBanner: {
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { width: '31%', minWidth: 96, gap: spacing.xs },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  analyticsCard: { gap: spacing.sm },
  analyticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countBadge: {
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  activityStat: { alignItems: 'center', gap: 2, minWidth: 56 },
  activityCount: { fontSize: 16, fontWeight: '700', color: ACCENT },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  guestInfo: { flex: 1, gap: 1 },
  responseBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actions: { gap: spacing.sm },
  selectButton: {
    borderRadius: 10,
    backgroundColor: ACCENT,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  checkInButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ACCENT,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  deleteButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
});
