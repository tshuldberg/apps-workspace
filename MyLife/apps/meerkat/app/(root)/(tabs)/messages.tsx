import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Check, Phone, Plus, ShieldCheck, Users, X } from 'lucide-react-native';
import { listCommunities, type DmGroupMember } from '@mylife/sync';
import { DM_PERSON_LINKS_SCOPE } from '../data/person-identity-core';
import { resolvePersonName } from '../data/person-view-core';
import { useSync } from '../providers/SyncProvider';
import { useCall } from '../providers/CallProvider';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { buildFriendRows, type FriendRow } from '../data/friends-core';
import { startCallFailureCopy } from '../data/call-log-core';
import { resolveFriendAvatarImage } from '../data/community-core';
import { Avatar } from '../components/Avatar';
import { OwnDeviceLinkCard } from '../components/OwnDeviceLinkCard';
import { buildPersonSheetModel } from '../data/messages-core';
import {
  getDmDelivery,
  getDmUnreadCount,
  listDmConversations,
  listDmMessages,
  listDmOwnDevices,
  listDmParticipants,
} from '../data/dm-core';
import {
  buildDmListRow,
  compareDmHlc,
  ensureDirectConversation,
  sortDmListRows,
  DM_NO_CONVERSATIONS_EMPTY_STATE,
  type DmListRow,
} from '../data/dm-view-core';
import { effectiveRelayUrl } from '../data/effective-relay';
import { Button, SectionHeader } from '../components/kit';
import { shortHex, type MkColors, MK_MONO, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export default function MessagesScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const {
    pairedDevices,
    isPeerSasVerified,
    isPeerRevoked,
    getPeerSas,
    confirmPeerSas,
    revokePeer,
    createDmGroup,
    runForegroundDrain,
    personLinks,
  } = useSync();
  const { canCallPeer, startCall } = useCall();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((r) => r + 1), []);

  const friends = useMemo(
    () => buildFriendRows(pairedDevices, { isPeerSasVerified, isPeerRevoked }),
    [pairedDevices, isPeerSasVerified, isPeerRevoked],
  );

  const selected = useMemo(
    () => friends.find((friend) => friend.deviceId === selectedDeviceId) ?? null,
    [friends, selectedDeviceId],
  );

  // Keep the last non-null row rendered while the person sheet Modal animates
  // out, so closing does not blank the sheet mid-dismissal.
  const lastSelectedRef = useRef<FriendRow | null>(null);
  if (selected) lastSelectedRef.current = selected;
  const displaySelected = selected ?? lastSelectedRef.current;

  // A person-sheet action that navigates or presents an Alert is QUEUED and runs
  // only after the sheet Modal has fully dismissed (the iOS dismiss/present and
  // dismiss/navigate race would otherwise freeze touches). Flushed from
  // onDismiss on iOS and from the visibility effect elsewhere, where Modal
  // children unmount the instant `visible` flips false and onDismiss never fires.
  const personPendingRef = useRef<(() => void) | null>(null);
  const flushPersonPending = useCallback(() => {
    const fn = personPendingRef.current;
    personPendingRef.current = null;
    fn?.();
  }, []);
  useEffect(() => {
    if (selected === null && Platform.OS !== 'ios') flushPersonPending();
  }, [selected, flushPersonPending]);

  // AC-6: a friend's signed community avatar for the People list (image -> initial
  // -> ?). A friend is not scoped to one community, so the first verified v2 avatar
  // among the communities they share is used; null falls back to the initial.
  const communityIds = useMemo(
    () => {
      void revision;
      return listCommunities(db).map((community) => community.communityId);
    },
    [db, revision],
  );
  const friendAvatars = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const friend of friends) {
      map.set(friend.deviceId, resolveFriendAvatarImage(db, communityIds, friend.deviceId));
    }
    return map;
  }, [friends, communityIds, db]);

  const relayConfigured = useMemo(() => {
    void revision;
    return effectiveRelayUrl(db).startsWith('ws');
  }, [db, revision]);

  // Plan 52 P4: resolve at PERSON granularity, so a peer's second device shows
  // that person's known name instead of a bare device id. Verified links only.
  const personLinkMap = useMemo(() => personLinks(DM_PERSON_LINKS_SCOPE), [personLinks]);
  const pairedNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const device of pairedDevices) {
      if (device.displayName) map.set(device.deviceId, device.displayName);
    }
    return map;
  }, [pairedDevices]);

  const peerName = useCallback(
    (deviceId: string): string => resolvePersonName(
      personLinkMap,
      deviceId,
      pairedNameMap,
      shortHex(deviceId),
    ),
    [personLinkMap, pairedNameMap],
  );

  // Real conversation rows from the device-local dm_ store. No fake chats: an
  // empty store renders the honest empty state. The last-outgoing chip and unread
  // count come from real dm_ rows only.
  const conversationRows = useMemo<DmListRow[]>(() => {
    void revision;
    // My own linked mirror devices are excluded from a row's honest delivery chip
    // so a group chip never counts my own second device (Plan 21 Phase 10 item 5).
    const ownDeviceIds = new Set(listDmOwnDevices(db).map((d) => d.device_id));
    const rows = listDmConversations(db).map((conv) => {
      const messages = listDmMessages(db, conv.id);
      let last = messages[0] ?? null;
      for (const message of messages) {
        if (!last || compareDmHlc(message.hlc, last.hlc) > 0) last = message;
      }
      const participants = listDmParticipants(db, conv.id);
      const peer = participants.find((p) => p.is_self === 0);
      return buildDmListRow({
        conversationId: conv.id,
        kind: conv.kind,
        title: conv.title,
        updatedAt: conv.updated_at,
        selfDeviceId: identity.publicKey,
        peerName: peer ? peerName(peer.device_id) : 'Conversation',
        lastMessage: last,
        lastDelivery: last && last.authorDeviceId === identity.publicKey ? getDmDelivery(db, last.id) : [],
        ownDeviceIds,
        unreadCount: getDmUnreadCount(db, conv.id, identity.publicKey),
        memberCount: conv.kind === 'group' ? participants.length : null,
        relayConfigured,
      });
    });
    return sortDmListRows(rows);
  }, [db, identity.publicKey, peerName, relayConfigured, revision]);

  // Re-read conversations (and best-effort drain) whenever the tab regains focus,
  // so returning from a thread reflects new messages, receipts, and read state.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      bump();
      void (async () => {
        try {
          const result = await runForegroundDrain();
          if (!cancelled && result.appliedMessages > 0) bump();
        } catch {
          // Best-effort; the list still shows locally recorded conversations.
        }
      })();
      return () => { cancelled = true; };
    }, [bump, runForegroundDrain]),
  );

  const openAddFriend = useCallback(() => {
    router.push('/add-friend');
  }, [router]);

  const openConversation = useCallback(
    (conversationId: string) => {
      router.push({ pathname: '/dm/[conversationId]', params: { conversationId } });
    },
    [router],
  );

  // Runs AFTER the person sheet Modal has dismissed (queued): safe to write the
  // conversation row and navigate. A thrown db write surfaces honestly.
  const messageFriend = useCallback(
    (deviceId: string) => {
      personPendingRef.current = () => {
        const paired = pairedDevices.find((device) => device.deviceId === deviceId);
        if (!paired) return;
        try {
          const conversationId = ensureDirectConversation(db, identity, {
            deviceId: paired.deviceId,
            dhPublicKey: paired.dhPublicKey,
          });
          bump();
          openConversation(conversationId);
        } catch {
          Alert.alert('Could not open the chat', 'The conversation could not be created on this device.');
        }
      };
      setSelectedDeviceId(null);
    },
    [pairedDevices, db, identity, openConversation, bump],
  );

  // Re-entrancy guard: two fast Create taps must not mint two groups.
  const groupCreateInFlightRef = useRef(false);
  // Runs AFTER the group sheet Modal has dismissed (queued inside NewGroupSheet):
  // navigation and the failure Alert are both post-dismissal, so neither races
  // the closing Modal.
  const createGroup = useCallback(
    (title: string, deviceIds: string[]) => {
      const members: DmGroupMember[] = deviceIds
        .map((deviceId) => pairedDevices.find((device) => device.deviceId === deviceId))
        .filter((device): device is NonNullable<typeof device> => !!device)
        .map((device) => ({ deviceId: device.deviceId, dhPublicKey: device.dhPublicKey, role: 'member' as const }));
      if (members.length === 0) return;
      if (groupCreateInFlightRef.current) return;
      groupCreateInFlightRef.current = true;
      void (async () => {
        try {
          const result = await createDmGroup(title.trim() || 'Group', members);
          bump();
          openConversation(result.conversationId);
        } catch {
          Alert.alert('Could not create the group', 'Nothing was created. Try again.');
        } finally {
          groupCreateInFlightRef.current = false;
        }
      })();
    },
    [pairedDevices, createDmGroup, openConversation, bump],
  );

  const closeSheet = useCallback(() => setSelectedDeviceId(null), []);

  const markSafetyChecked = useCallback(
    (name: string, deviceId: string) => {
      const ok = confirmPeerSas(deviceId);
      Alert.alert(
        ok ? 'Safety code checked' : 'Safety code unavailable',
        ok
          ? `${name}'s safety code is marked checked on this device.`
          : 'Meerkat could not derive a safety code for this pairing.',
      );
    },
    [confirmPeerSas],
  );

  // Plan 25 WP-25G: place a real call from a People row. Rendered only when
  // canCallPeer is true (real media runtime + trusted pairing, NC-25.8).
  // QUEUED: startCall pushes the /call route synchronously and a failure ends in
  // an Alert, so it must run only after the person sheet has fully dismissed.
  const callFriend = useCallback(
    (deviceId: string, media: 'voice' | 'video') => {
      personPendingRef.current = () => {
        void (async () => {
          try {
            const result = await startCall(deviceId, media);
            if (!result.ok) {
              Alert.alert('Could not start the call', startCallFailureCopy(result.reason, 'app'));
            }
          } catch {
            Alert.alert('Could not start the call', startCallFailureCopy('unknown', 'app'));
          }
        })();
      };
      closeSheet();
    },
    [startCall, closeSheet],
  );

  const blockFriend = useCallback(
    (name: string, deviceId: string) => {
      Alert.alert(
        'Block friend',
        `Block ${name}? This records a real local revocation so this device can no longer connect with them here.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: () => {
              revokePeer(deviceId, 'blocked by user');
              closeSheet();
            },
          },
        ],
      );
    },
    [revokePeer, closeSheet],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Call history"
            onPress={() => router.push('/calls')}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          >
            <Phone size={19} color={c.accent} strokeWidth={2.1} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New group"
            onPress={() => setNewGroupOpen(true)}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          >
            <Users size={20} color={c.accent} strokeWidth={2.1} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add friend"
            onPress={openAddFriend}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Plus size={22} color={c.onAccent} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>
      <Text style={styles.subtitle}>Private, end-to-end encrypted chats and the people you trust</Text>

      <View style={styles.panel}>
        <SectionHeader title="Chats" hint="Private chats with friends and groups." />
        {conversationRows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{DM_NO_CONVERSATIONS_EMPTY_STATE}</Text>
          </View>
        ) : (
          conversationRows.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={`Open chat with ${row.title}${row.unreadCount > 0 ? `, ${row.unreadCount} unread` : ''}`}
              onPress={() => openConversation(row.id)}
              style={({ pressed }) => [styles.chatRow, pressed && styles.pressed]}
            >
              <View style={styles.chatAvatar}>
                <Text style={styles.chatAvatarText}>
                  {row.isGroup ? '#' : (row.title.trim().charAt(0).toUpperCase() || '?')}
                </Text>
              </View>
              <View style={styles.chatMain}>
                <View style={styles.chatTitleRow}>
                  <Text style={styles.chatName} numberOfLines={1}>
                    {row.title}{row.isGroup && row.memberCount ? ` · ${row.memberCount}` : ''}
                  </Text>
                  {row.unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{row.unreadCount > 99 ? '99+' : row.unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.chatPreview} numberOfLines={1}>{row.subtitle}</Text>
                {row.chip ? <Text style={styles.chatChip}>{row.chip}</Text> : null}
              </View>
            </Pressable>
          ))
        )}
      </View>

      <OwnDeviceLinkCard />

      <View style={styles.panel}>
        <SectionHeader title="People" hint="People you have connected with and chosen to trust." />
        {friends.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No people yet</Text>
            <Text style={styles.emptyText}>Tap the plus to add a friend by code or QR.</Text>
          </View>
        ) : (
          friends.map((friend) => (
            <Pressable
              key={friend.deviceId}
              accessibilityRole="button"
              accessibilityLabel={`Open ${friend.displayName}`}
              onPress={() => setSelectedDeviceId(friend.deviceId)}
              style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}
            >
              <Avatar
                imageBase64={friendAvatars.get(friend.deviceId) ?? null}
                initial={friend.displayName.trim().charAt(0).toUpperCase()}
                size={40}
              />
              <View style={styles.personMain}>
                <Text style={styles.personName} numberOfLines={1}>{friend.displayName}</Text>
                <Text style={styles.personMeta}>{friend.shortDeviceId}</Text>
              </View>
              <View style={pillStyle(styles, friend.trustState)}>
                <Text style={pillTextStyle(styles, friend.trustState)}>{friend.safetyLabel}</Text>
              </View>
            </Pressable>
          ))
        )}
      </View>

      <View style={{ height: insets.bottom + 96 }} />

      <Modal
        visible={selected !== null}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
        onDismiss={flushPersonPending}
      >
        <Pressable style={styles.backdrop} onPress={closeSheet} accessibilityLabel="Close" />
        {displaySelected ? (
          <PersonSheet
            row={displaySelected}
            sas={displaySelected.trustState === 'blocked' ? null : getPeerSas(displaySelected.deviceId)?.emoji ?? null}
            callable={displaySelected.trustState !== 'blocked' && canCallPeer(displaySelected.deviceId)}
            onMarkChecked={() => markSafetyChecked(displaySelected.displayName, displaySelected.deviceId)}
            onMessage={() => messageFriend(displaySelected.deviceId)}
            onVoiceCall={() => callFriend(displaySelected.deviceId, 'voice')}
            onVideoCall={() => callFriend(displaySelected.deviceId, 'video')}
            onBlock={() => blockFriend(displaySelected.displayName, displaySelected.deviceId)}
            onClose={closeSheet}
          />
        ) : null}
      </Modal>

      <NewGroupSheet
        visible={newGroupOpen}
        friends={friends}
        onClose={() => setNewGroupOpen(false)}
        onCreate={createGroup}
      />
    </ScrollView>
  );
}

function NewGroupSheet({
  visible,
  friends,
  onClose,
  onCreate,
}: {
  visible: boolean;
  friends: FriendRow[];
  onClose: () => void;
  onCreate: (title: string, deviceIds: string[]) => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fresh state per open, so a previous open's picks (possibly since-blocked
  // friends) never leak into the next group.
  useEffect(() => {
    if (visible) {
      setTitle('');
      setSelectedIds([]);
    }
  }, [visible]);

  // Only unblocked friends can join a group (a blocked pairing has no usable seal).
  const selectable = useMemo(() => friends.filter((friend) => friend.trustState !== 'blocked'), [friends]);

  const toggle = useCallback((deviceId: string) => {
    setSelectedIds((current) =>
      current.includes(deviceId) ? current.filter((id) => id !== deviceId) : [...current, deviceId],
    );
  }, []);

  // Create is QUEUED and runs only after this Modal has fully dismissed: the
  // create path navigates to the new thread (or presents a failure Alert), and
  // doing either while the Modal is mid-dismissal is the iOS freeze class.
  const pendingCreateRef = useRef<(() => void) | null>(null);
  const flushPendingCreate = useCallback(() => {
    const fn = pendingCreateRef.current;
    pendingCreateRef.current = null;
    fn?.();
  }, []);
  useEffect(() => {
    if (!visible && Platform.OS !== 'ios') flushPendingCreate();
  }, [visible, flushPendingCreate]);

  const canCreate = selectedIds.length >= 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={flushPendingCreate}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.sheetHandleRow}><View style={styles.sheetHandle} /></View>
        <Text style={styles.sheetName}>New group</Text>
        <TextInput
          style={styles.groupTitleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Group name (optional)"
          placeholderTextColor={c.textTertiary}
          accessibilityLabel="Group name"
        />
        <Text style={styles.groupPickHint}>
          {selectable.length === 0
            ? 'Pair a friend first to start a group.'
            : 'Choose the paired friends to include. A friend who is not paired cannot receive group messages.'}
        </Text>
        <ScrollView style={styles.groupPickList} keyboardShouldPersistTaps="handled">
          {selectable.map((friend) => {
            const checked = selectedIds.includes(friend.deviceId);
            return (
              <Pressable
                key={friend.deviceId}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={`Include ${friend.displayName}`}
                onPress={() => toggle(friend.deviceId)}
                style={({ pressed }) => [styles.groupPickRow, pressed && styles.pressed]}
              >
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked ? <Check size={14} color={c.onAccent} strokeWidth={3} /> : null}
                </View>
                <Text style={styles.groupPickName} numberOfLines={1}>{friend.displayName}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Button
          title={canCreate ? `Create group (${selectedIds.length})` : 'Choose at least one friend'}
          variant="primary"
          disabled={!canCreate}
          onPress={() => {
            const pickedTitle = title;
            const pickedIds = selectedIds;
            pendingCreateRef.current = () => onCreate(pickedTitle, pickedIds);
            onClose();
          }}
        />
      </View>
    </Modal>
  );
}

function PersonSheet({
  row,
  sas,
  callable,
  onMarkChecked,
  onMessage,
  onVoiceCall,
  onVideoCall,
  onBlock,
  onClose,
}: {
  row: FriendRow;
  sas: string[] | null;
  callable: boolean;
  onMarkChecked: () => void;
  onMessage: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onBlock: () => void;
  onClose: () => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const model = buildPersonSheetModel(row);

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.sheetHandleRow}>
        <View style={styles.sheetHandle} />
      </View>
      <View style={styles.sheetHeader}>
        <View style={styles.personMain}>
          <Text style={styles.sheetName} numberOfLines={1}>{model.displayName}</Text>
          <Text style={styles.personMeta}>{model.shortDeviceId}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
        >
          <X size={20} color={c.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={pillStyle(styles, model.trustState)}>
        <Text style={pillTextStyle(styles, model.trustState)}>{model.safetyLabel}</Text>
      </View>

      {sas ? (
        <View style={styles.sasBox}>
          <View style={styles.sasLabelRow}>
            <ShieldCheck size={16} color={c.accent} strokeWidth={2} />
            <Text style={styles.sasLabel}>Safety code</Text>
          </View>
          <Text style={styles.sasEmoji}>{sas.join('  ')}</Text>
          <Text style={styles.sasHint}>Compare these five emoji in person or on a call.</Text>
        </View>
      ) : null}

      {model.canMarkSafetyChecked ? (
        <Button title="Mark safety code checked" variant="secondary" onPress={onMarkChecked} />
      ) : null}

      <Button
        title="Message"
        variant="primary"
        disabled={!model.messageEnabled || model.trustState === 'blocked'}
        onPress={onMessage}
      />
      {callable ? (
        <>
          <Button title="Voice call" variant="secondary" onPress={onVoiceCall} />
          <Button title="Video call" variant="secondary" onPress={onVideoCall} />
        </>
      ) : null}
      {model.trustState === 'blocked' ? (
        <Text style={styles.disabledReason}>Unblock this person to message them.</Text>
      ) : null}

      {model.canBlock ? (
        <Button title="Block" variant="danger" onPress={onBlock} />
      ) : null}
    </View>
  );
}

function pillStyle(styles: ReturnType<typeof makeStyles>, trust: FriendRow['trustState']) {
  return trust === 'checked' ? styles.verifiedPill : trust === 'blocked' ? styles.blockedPill : styles.checkPill;
}

function pillTextStyle(styles: ReturnType<typeof makeStyles>, trust: FriendRow['trustState']) {
  return trust === 'checked' ? styles.verifiedPillText : trust === 'blocked' ? styles.blockedPillText : styles.checkPillText;
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: c.text, fontSize: 30, fontWeight: '800' },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
  },
  secondaryBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarText: { color: c.accentDim, fontSize: 16, fontWeight: '800' },
  chatMain: { flex: 1, minWidth: 0, gap: 2 },
  chatTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatName: { flex: 1, color: c.text, fontSize: 15, fontWeight: '800' },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { color: c.onAccent, fontSize: 11, fontWeight: '800' },
  chatPreview: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  chatChip: { color: c.textTertiary, fontSize: 11, fontWeight: '700' },
  groupTitleInput: {
    minHeight: 44,
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    color: c.text,
    fontSize: 15,
  },
  groupPickHint: { color: c.textSecondary, fontSize: 12.5, lineHeight: 18 },
  groupPickList: { maxHeight: 260 },
  groupPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: MK_RADIUS.sm,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: c.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: c.accent, borderColor: c.accent },
  groupPickName: { flex: 1, minWidth: 0, color: c.text, fontSize: 15, fontWeight: '600' },
  subtitle: { color: c.textSecondary, fontSize: 14, marginTop: -6 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  empty: { gap: 8, alignItems: 'flex-start' },
  emptyTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
  emptyText: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  personMain: { flex: 1, minWidth: 0, gap: 2 },
  personName: { color: c.text, fontSize: 15, fontWeight: '800' },
  personMeta: { color: c.textTertiary, fontSize: 11, fontFamily: MK_MONO },
  verifiedPill: {
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  verifiedPillText: { color: c.success, fontSize: 11, fontWeight: '800' },
  checkPill: {
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.surfaceHigh,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  checkPillText: { color: c.warning, fontSize: 11, fontWeight: '800' },
  blockedPill: {
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.dangerSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  blockedPillText: { color: c.danger, fontSize: 11, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  sheetHandleRow: { alignItems: 'center', marginTop: -6, marginBottom: 2 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetName: { color: c.text, fontSize: 20, fontWeight: '800' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  sasBox: {
    backgroundColor: c.surfaceHigh,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 12,
    gap: 6,
  },
  sasLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sasLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  sasEmoji: { color: c.text, fontSize: 26, textAlign: 'center' },
  sasHint: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
  disabledReason: { color: c.textSecondary, fontSize: 12.5, lineHeight: 18, marginTop: -4 },
  pressed: { opacity: 0.7 },
});
