import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { Card, Text, EmptyState, LoadingState, ErrorState, colors, spacing } from '@mylife/ui';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';
import { useGuests } from '../../hooks/rsvp/use-guests';

const ACCENT = colors.modules.rsvp;

type GuestTab = 'invites' | 'rsvps' | 'cohosts';

export default function GuestsScreen() {
  const { selectedEventId, selectedEvent } = useRsvpContext();
  const {
    invites, rsvps, cohosts, loading, error, refresh,
    addInvite, addCohost, approve, waitlist, removeInvite, checkIn, removeCohost,
  } = useGuests(selectedEventId ?? undefined);

  const [activeTab, setActiveTab] = useState<GuestTab>('invites');
  const [refreshing, setRefreshing] = useState(false);

  // Invite form
  const [inviteName, setInviteName] = useState('');
  const [inviteContact, setInviteContact] = useState('');
  const [plusOneLimit, setPlusOneLimit] = useState('0');

  // Cohost form
  const [cohostName, setCohostName] = useState('');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => requestAnimationFrame(r));
    refresh();
    setRefreshing(false);
  }, [refresh]);

  // No event selected
  if (!selectedEventId || !selectedEvent) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon={'\uD83D\uDC65'}
          title="No event selected"
          message="Select an event from the Events tab to manage guests."
        />
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <LoadingState rows={4} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <ErrorState message="Error loading guests" onRetry={refresh} />
      </View>
    );
  }

  const handleAddInvite = () => {
    const name = inviteName.trim();
    if (!name) return;
    addInvite({
      inviteeName: name,
      inviteeContact: inviteContact.trim() || undefined,
      inviteeType: inviteContact.includes('@') ? 'email' : 'link',
      plusOneLimit: Math.max(0, Number(plusOneLimit) || 0),
      status: 'invited',
    });
    setInviteName('');
    setInviteContact('');
    setPlusOneLimit('0');
  };

  const handleAddCohost = () => {
    const name = cohostName.trim();
    if (!name) return;
    addCohost({ name, role: 'Cohost' });
    setCohostName('');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />
      }
    >
      {/* Event context */}
      <Text variant="caption" color={colors.textTertiary}>
        {selectedEvent.title}
      </Text>

      {/* Sub-tabs */}
      <View style={styles.tabRow}>
        {(['invites', 'rsvps', 'cohosts'] as const).map((tab) => {
          const count = tab === 'invites' ? invites.length : tab === 'rsvps' ? rsvps.length : cohosts.length;
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.subTab, active && styles.subTabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text variant="caption" color={active ? colors.background : colors.textSecondary}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Invites Tab */}
      {activeTab === 'invites' ? (
        <>
          <Card style={styles.formCard}>
            <Text variant="label" color={colors.textTertiary}>ADD INVITE</Text>
            <TextInput
              style={styles.input}
              value={inviteName}
              onChangeText={setInviteName}
              placeholder="Guest name"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={styles.input}
              value={inviteContact}
              onChangeText={setInviteContact}
              placeholder="Email or phone (optional)"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={plusOneLimit}
                onChangeText={setPlusOneLimit}
                placeholder="+1 limit"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />
              <Pressable style={styles.addButton} onPress={handleAddInvite}>
                <Text variant="label" color={colors.background}>Add</Text>
              </Pressable>
            </View>
          </Card>

          {invites.length === 0 ? (
            <EmptyState
              icon={'\uD83D\uDCE8'}
              title="No invites yet"
              message="Add guests above."
            />
          ) : (
            invites.map((invite) => (
              <Card key={invite.id} style={styles.guestCard}>
                <View style={styles.guestHeader}>
                  <View style={styles.guestInfo}>
                    <Text variant="body" style={{ fontWeight: '600' }}>{invite.inviteeName}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {invite.status} {invite.plusOneLimit > 0 ? `(+${invite.plusOneLimit})` : ''}
                    </Text>
                    {invite.inviteeContact ? (
                      <Text variant="caption" color={colors.textTertiary}>{invite.inviteeContact}</Text>
                    ) : null}
                  </View>
                  <StatusBadge status={invite.status} />
                </View>
                <View style={styles.actionRow}>
                  {invite.status === 'requested' ? (
                    <Pressable style={styles.actionButton} onPress={() => approve(invite.id)}>
                      <Text variant="caption" color={colors.success}>Approve</Text>
                    </Pressable>
                  ) : null}
                  {invite.status !== 'waitlisted' ? (
                    <Pressable style={styles.actionButton} onPress={() => waitlist(invite.id)}>
                      <Text variant="caption" color={colors.warning}>Waitlist</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={styles.actionButton}
                    onPress={() =>
                      Alert.alert('Remove Invite', `Remove ${invite.inviteeName}?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => removeInvite(invite.id) },
                      ])
                    }
                  >
                    <Text variant="caption" color={colors.danger}>Remove</Text>
                  </Pressable>
                </View>
              </Card>
            ))
          )}
        </>
      ) : null}

      {/* RSVPs Tab */}
      {activeTab === 'rsvps' ? (
        <>
          {rsvps.length === 0 ? (
            <EmptyState
              icon={'\u2709\uFE0F'}
              title="No RSVPs yet"
              message="Share your event to start collecting responses."
            />
          ) : (
            rsvps.map((rsvp) => (
              <Card key={rsvp.id} style={styles.guestCard}>
                <View style={styles.guestHeader}>
                  <View style={styles.guestInfo}>
                    <Text variant="body" style={{ fontWeight: '600' }}>{rsvp.guestName}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {rsvp.response}{rsvp.plusOnesCount > 0 ? ` +${rsvp.plusOnesCount}` : ''}
                    </Text>
                    <Text variant="caption" color={colors.textTertiary}>
                      {new Date(rsvp.respondedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <ResponseBadge response={rsvp.response} />
                </View>
                {!rsvp.checkedInAt ? (
                  <Pressable style={styles.checkInButton} onPress={() => checkIn(rsvp.id)}>
                    <Text variant="caption" color={ACCENT}>Check In</Text>
                  </Pressable>
                ) : (
                  <Text variant="caption" color={colors.success}>Checked in</Text>
                )}
              </Card>
            ))
          )}
        </>
      ) : null}

      {/* Cohosts Tab */}
      {activeTab === 'cohosts' ? (
        <>
          <Card style={styles.formCard}>
            <Text variant="label" color={colors.textTertiary}>ADD COHOST</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={cohostName}
                onChangeText={setCohostName}
                placeholder="Cohost name"
                placeholderTextColor={colors.textTertiary}
              />
              <Pressable style={styles.addButton} onPress={handleAddCohost}>
                <Text variant="label" color={colors.background}>Add</Text>
              </Pressable>
            </View>
          </Card>

          {cohosts.length === 0 ? (
            <EmptyState
              icon={'\uD83D\uDC65'}
              title="No co-hosts"
              message="Add someone to help manage this event."
            />
          ) : (
            cohosts.map((cohost) => (
              <Card key={cohost.id} style={styles.guestCard}>
                <View style={styles.guestHeader}>
                  <View style={styles.guestInfo}>
                    <Text variant="body" style={{ fontWeight: '600' }}>{cohost.name}</Text>
                    {cohost.role ? (
                      <Text variant="caption" color={colors.textSecondary}>{cohost.role}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() =>
                      Alert.alert('Remove Co-host', `Remove ${cohost.name}?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => removeCohost(cohost.id) },
                      ])
                    }
                  >
                    <Text variant="caption" color={colors.danger}>Remove</Text>
                  </Pressable>
                </View>
              </Card>
            ))
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    invited: ACCENT,
    requested: colors.warning,
    approved: colors.success,
    declined: colors.danger,
    waitlisted: colors.textTertiary,
  };
  return (
    <View style={[styles.badge, { borderColor: colorMap[status] ?? colors.border }]}>
      <Text variant="caption" color={colorMap[status] ?? colors.textSecondary}>{status}</Text>
    </View>
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
    <View style={[styles.badge, { borderColor: colorMap[response] ?? colors.border }]}>
      <Text variant="caption" color={colorMap[response] ?? colors.textSecondary}>{response}</Text>
    </View>
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
  tabRow: { flexDirection: 'row', gap: spacing.sm },
  subTab: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    alignItems: 'center',
  },
  subTabActive: { borderColor: ACCENT, backgroundColor: ACCENT },
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
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  addButton: {
    borderRadius: 8,
    backgroundColor: ACCENT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  guestCard: { gap: spacing.xs },
  guestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guestInfo: { flex: 1, gap: 1 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  actionButton: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  checkInButton: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
