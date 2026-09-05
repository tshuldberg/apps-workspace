import { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';
import { useGuests } from '../../hooks/rsvp/use-guests';

const ACCENT = colors.modules.rsvp;

export default function CheckInScreen() {
  const { selectedEventId, selectedEvent } = useRsvpContext();
  const { rsvps, loading, refresh, checkIn } = useGuests(selectedEventId ?? undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => requestAnimationFrame(r));
    refresh();
    setRefreshing(false);
  }, [refresh]);

  const goingGuests = useMemo(
    () => rsvps.filter((r) => r.response === 'going' || r.response === 'maybe'),
    [rsvps],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return goingGuests;
    const q = search.toLowerCase();
    return goingGuests.filter((r) => r.guestName.toLowerCase().includes(q));
  }, [goingGuests, search]);

  const checkedInCount = goingGuests
    .filter((r) => r.checkedInAt)
    .reduce((sum, r) => sum + 1 + r.plusOnesCount, 0);
  const totalExpected = goingGuests.reduce((sum, r) => sum + 1 + r.plusOnesCount, 0);

  if (!selectedEventId || !selectedEvent) {
    return (
      <>
        <Stack.Screen options={{ title: 'Check-In', headerBackTitle: 'Events' }} />
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>{'\u2705'}</Text>
          <Text variant="subheading">No event selected</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            Select an event to start checking in guests.
          </Text>
        </View>
      </>
    );
  }

  if (loading && !refreshing) {
    return (
      <>
        <Stack.Screen options={{ title: 'Check-In', headerBackTitle: 'Events' }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Check-In: ${selectedEvent.title}`, headerBackTitle: 'Back' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />
        }
      >
        {/* Progress */}
        <Card style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text variant="heading" color={ACCENT}>{checkedInCount}</Text>
            <Text variant="body" color={colors.textSecondary}>/ {totalExpected} checked in</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: totalExpected > 0 ? `${Math.round((checkedInCount / totalExpected) * 100)}%` : '0%' },
              ]}
            />
          </View>
        </Card>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search guests..."
          placeholderTextColor={colors.textTertiary}
        />

        {/* Empty State */}
        {goingGuests.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
              No confirmed guests yet. RSVPs will appear here when guests respond.
            </Text>
          </Card>
        ) : null}

        {/* Guest List */}
        {filtered.map((rsvp) => {
          const isCheckedIn = !!rsvp.checkedInAt;
          return (
            <Pressable
              key={rsvp.id}
              style={[styles.guestRow, isCheckedIn && styles.guestRowCheckedIn]}
              onPress={() => {
                if (!isCheckedIn) checkIn(rsvp.id);
              }}
              disabled={isCheckedIn}
            >
              <View style={styles.guestLeft}>
                <View style={[styles.checkCircle, isCheckedIn && styles.checkCircleChecked]}>
                  {isCheckedIn ? (
                    <Text style={styles.checkMark}>{'\u2713'}</Text>
                  ) : null}
                </View>
                <View style={styles.guestInfo}>
                  <Text variant="body" style={{ fontWeight: '600' }}>{rsvp.guestName}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {rsvp.response}{rsvp.plusOnesCount > 0 ? ` +${rsvp.plusOnesCount}` : ''}
                  </Text>
                </View>
              </View>
              {isCheckedIn ? (
                <Text variant="caption" color={colors.success}>
                  {new Date(rsvp.checkedInAt!).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </Text>
              ) : (
                <Text variant="caption" color={ACCENT}>Tap to check in</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </>
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
  progressCard: { alignItems: 'center', gap: spacing.sm },
  progressHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  progressBarBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 15,
  },
  emptyCard: { paddingVertical: spacing.lg },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  guestRowCheckedIn: {
    borderColor: colors.success,
    backgroundColor: `${colors.success}11`,
  },
  guestLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleChecked: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  checkMark: { color: colors.background, fontSize: 14, fontWeight: '700' },
  guestInfo: { flex: 1, gap: 1 },
});
