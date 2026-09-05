// Plan 21 Phase 5: the 1:1 (and group) DM thread screen.
//
// Consumes the shared chat kit (MessageList / ChatComposer / MessageActionsSheet)
// and the real @mylife/sync DM send path via useSync(). Honest by construction:
// the per-message delivery line is derived ONLY from real dm_delivery rows (a park
// result or a verified signed receipt), never a timer; "Delivered"/"Read" appear
// only when a receipt row backs them. Edit and Reply are omitted (the DM protocol
// exposes neither a supersede-edit queue method nor a parentId), so nothing is
// faked. Delete-for-everyone is a real DM_SHRED with an honest drain-boundary
// confirm; Report writes a local dm_reports row; Block is a real local revocation.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Image as RNImage,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { decodeBase64 } from 'tweetnacl-util';
import {
  ArrowLeft,
  FileText,
  MoreVertical,
  Phone,
  UserPlus,
  Video,
  X,
} from 'lucide-react-native';
import {
  bytesToHex,
  ensureBlobPolicy,
  generateSyncRandomBytes,
  type DmMessageAttachment,
  type DmMessageEvent,
  type DmGroupMember,
} from '@mylife/sync';
import {
  ChatComposer,
  MessageActionsSheet,
  MessageList,
  type ChatKitMessage,
  type MentionCandidate,
} from '../../components/chat';
import { Button, HonestNotice } from '../../components/kit';
import { formatBytes, type MkColors, MK_RADIUS, shortHex } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import { useIdentity } from '../../providers/IdentityProvider';
import { useNode } from '../../providers/NodeProvider';
import { DM_PERSON_LINKS_SCOPE } from '../../data/person-identity-core';
import { isSamePerson, resolvePersonName } from '../../data/person-view-core';
import { useSync } from '../../providers/SyncProvider';
import { useCall } from '../../providers/CallProvider';
import { ExpoBlobStore } from '../../data/expo-blob-store';
import { effectiveRelayUrl } from '../../data/effective-relay';
import {
  deleteDmMessageRow,
  getDmConversation,
  getDmDelivery,
  getDmReadState,
  listDmMessages,
  listDmOwnDevices,
  listDmParticipants,
  setDmConversationArchived,
  setDmReadState,
  type DmConversationRow,
  type DmParticipantRow,
} from '../../data/dm-core';
import {
  computeDmReceiptsToEmit,
  dmDeliveryLabel,
  dmRetryAvailable,
  mapDmEventToKit,
  shouldStartDmRetry,
  summarizeDmDelivery,
  DM_EMPTY_THREAD_STATE,
} from '../../data/dm-view-core';
import { startCallFailureCopy } from '../../data/call-log-core';

const DM_MODULE_ID = 'dm';
const MAX_DM_BODY = 100_000;

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function makeAttachmentId(hash: string): string {
  return `att_${hash.slice(0, 16)}_${Date.now().toString(36)}_${bytesToHex(generateSyncRandomBytes(4))}`;
}

const EMPTY_MENTIONS: readonly MentionCandidate[] = Object.freeze([]);

export default function DmThreadScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const params = useLocalSearchParams<{ conversationId: string }>();
  const conversationId = param(params.conversationId);
  const {
    queueDmMessage,
    queueDmReceipt,
    queueDmShred,
    reportDm,
    blockDmParticipant,
    dmGroupAddMember,
    dmGroupRemoveMember,
    runForegroundDrain,
    pairedDevices,
    isPeerRevoked,
    personLinks,
  } = useSync();
  const blobStore = useMemo(() => new ExpoBlobStore(db), [db]);

  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((r) => r + 1), []);
  const [draft, setDraft] = useState('');
  const [draftAttachments, setDraftAttachments] = useState<DmMessageAttachment[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [sending, setSending] = useState(false);
  // Synchronous re-entrancy guard for Retry (Fix 2): a state flag updates async,
  // so two fast taps could both pass the check and mint two messages. A ref flips
  // immediately, so the second tap is a real no-op.
  const retryInFlightRef = useRef(false);
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);

  // An overflow action that presents an Alert or another Modal (block confirm,
  // report notice, the group-info sheet) is QUEUED and runs only after the
  // overflow Modal has fully dismissed: presenting mid-dismissal is the iOS
  // freeze class. Flushed from onDismiss on iOS and from the visibility effect
  // elsewhere, where Modal children unmount as soon as `visible` flips false.
  const overflowPendingRef = useRef<(() => void) | null>(null);
  const flushOverflowPending = useCallback(() => {
    const fn = overflowPendingRef.current;
    overflowPendingRef.current = null;
    fn?.();
  }, []);
  useEffect(() => {
    if (!overflowOpen && Platform.OS !== 'ios') flushOverflowPending();
  }, [overflowOpen, flushOverflowPending]);

  // Deep-linkable screen: back needs a fallback or the chevron silently does
  // nothing when this thread is the stack's only route.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/messages');
  }, [router]);

  const relayConfigured = useMemo(() => {
    void revision;
    return effectiveRelayUrl(db).startsWith('ws');
  }, [db, revision]);

  const conversation = useMemo<DmConversationRow | null>(
    () => {
      void revision;
      return getDmConversation(db, conversationId);
    },
    [db, conversationId, revision],
  );
  const isGroup = conversation?.kind === 'group';

  const participants = useMemo<DmParticipantRow[]>(
    () => {
      void revision;
      return conversation ? listDmParticipants(db, conversationId) : [];
    },
    [db, conversationId, conversation, revision],
  );

  // A friendly name for a device id from trusted-local sources only (paired
  // friends + the participant roster). A name is never proof of identity.
  const pairedNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const device of pairedDevices) {
      if (device.displayName) map.set(device.deviceId, device.displayName);
    }
    return map;
  }, [pairedDevices]);

  // Plan 52 P4: verified DM-peer person links, so a message authored on one of
  // YOUR OWN linked devices reads as you, and a peer's linked devices read as
  // that one person instead of as strangers.
  const personLinkMap = useMemo(() => personLinks(DM_PERSON_LINKS_SCOPE), [personLinks]);

  const resolveName = useCallback(
    (deviceId: string): string => {
      if (isSamePerson(personLinkMap, deviceId, identity.publicKey)) return 'You';
      return resolvePersonName(personLinkMap, deviceId, pairedNames, shortHex(deviceId));
    },
    [identity.publicKey, pairedNames, personLinkMap],
  );

  const peerParticipant = useMemo(
    () => participants.find((p) => p.is_self === 0) ?? null,
    [participants],
  );
  const peerBlocked = peerParticipant ? isPeerRevoked(peerParticipant.device_id) : false;

  // Plan 25 WP-25G: 1:1 call entry points. Buttons render only when the real
  // media runtime is present AND the peer is a trusted pairing (NC-25.8: no
  // enabled call action in a build that cannot place a call).
  const { canCallPeer, startCall } = useCall();
  const callablePeerId = !isGroup && peerParticipant && !peerBlocked
    && canCallPeer(peerParticipant.device_id)
    ? peerParticipant.device_id
    : null;

  const placeCall = useCallback((media: 'voice' | 'video') => {
    if (!callablePeerId) return;
    void (async () => {
      try {
        const result = await startCall(callablePeerId, media);
        if (!result.ok) {
          Alert.alert('Could not start the call', startCallFailureCopy(result.reason, 'app'));
        }
      } catch {
        Alert.alert('Could not start the call', startCallFailureCopy('unknown', 'app'));
      }
    })();
  }, [callablePeerId, startCall]);

  const title = useMemo(() => {
    if (isGroup) return conversation?.title?.trim() || 'Group';
    if (peerParticipant) return resolveName(peerParticipant.device_id);
    return 'Conversation';
  }, [isGroup, conversation, peerParticipant, resolveName]);

  const subtitle = isGroup
    ? `${participants.length} member${participants.length === 1 ? '' : 's'}`
    : 'Private, end-to-end encrypted';

  const messages = useMemo<DmMessageEvent[]>(
    () => {
      void revision;
      return conversation ? listDmMessages(db, conversationId) : [];
    },
    [db, conversationId, conversation, revision],
  );

  const messagesById = useMemo(() => {
    const map = new Map<string, DmMessageEvent>();
    for (const event of messages) map.set(event.id, event);
    return map;
  }, [messages]);

  const kitMessages = useMemo<ChatKitMessage[]>(
    () => messages.map((event) => mapDmEventToKit(event, identity.publicKey)),
    [messages, identity.publicKey],
  );

  // Per-(my)-message delivery rows, for the honest receipt line. Peer messages
  // carry no outbound delivery state, so they are skipped.
  const deliveryById = useMemo(() => {
    void revision;
    const map = new Map<string, ReturnType<typeof getDmDelivery>>();
    for (const event of messages) {
      if (event.authorDeviceId !== identity.publicKey) continue;
      map.set(event.id, getDmDelivery(db, event.id));
    }
    return map;
  }, [db, messages, identity.publicKey, revision]);

  // This user's own linked mirror devices, excluded from the honest group
  // delivery counts so my own second device reading my message never shows as
  // "Read by 1" (Plan 21 Phase 10 item 5).
  const ownDeviceIds = useMemo(
    () => {
      void revision;
      return new Set(listDmOwnDevices(db).map((d) => d.device_id));
    },
    [db, revision],
  );

  const readState = useMemo(
    () => {
      void revision;
      return conversation ? getDmReadState(db, conversationId) : null;
    },
    [db, conversationId, conversation, revision],
  );

  const firstUnreadId = useMemo(() => {
    if (!readState) return null;
    const lastWall = readState.last_read_hlc_wall;
    const lastCounter = readState.last_read_hlc_counter;
    for (const event of messages) {
      if (event.authorDeviceId === identity.publicKey) continue;
      const newer = event.hlc.wall !== lastWall
        ? event.hlc.wall > lastWall
        : event.hlc.counter > lastCounter;
      if (newer) return event.id;
    }
    return null;
  }, [messages, readState, identity.publicKey]);

  const mentionCandidates = useMemo<MentionCandidate[]>(() => {
    if (!isGroup) return EMPTY_MENTIONS as MentionCandidate[];
    return participants
      .filter((p) => p.is_self === 0)
      .map((p) => ({ deviceId: p.device_id, name: resolveName(p.device_id) }));
  }, [isGroup, participants, resolveName]);

  // On focus: run a best-effort real drain (pulls inbound messages + receipts),
  // then emit the honest read/delivered receipts for newly-seen peer messages and
  // advance the local read marker. Never fabricates delivery; a no-relay drain is
  // a genuine no-op.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const result = await runForegroundDrain();
          if (cancelled) return;
          if (result.appliedMessages > 0) bump();
        } catch {
          // Best-effort: the thread still shows locally recorded state.
        }
        if (cancelled) return;
        const conv = getDmConversation(db, conversationId);
        if (!conv) return;
        const current = listDmMessages(db, conversationId);
        const rs = getDmReadState(db, conversationId);
        const { toEmit, nextLastRead } = computeDmReceiptsToEmit(
          current,
          identity.publicKey,
          { wall: rs.last_read_hlc_wall, counter: rs.last_read_hlc_counter },
          rs.read_receipts_enabled === 1,
          // Never park a read/delivered receipt back to a blocked/revoked author:
          // blocking must stop ALL outbound signal, including activity metadata.
          isPeerRevoked,
          // Never emit a receipt for a message one of my OWN linked devices
          // authored (a mirrored copy of my own message) - Fix 1 at the emit side.
          (deviceId) => ownDeviceIds.has(deviceId),
        );
        for (const receipt of toEmit) {
          try {
            await queueDmReceipt(conversationId, receipt.messageId, receipt.state);
          } catch {
            // A receipt that cannot park leaves the sender honestly at "Sent".
          }
        }
        if (nextLastRead) setDmReadState(db, conversationId, nextLastRead.wall, nextLastRead.counter);
        if (!cancelled && (toEmit.length > 0 || nextLastRead)) bump();
      })();
      return () => { cancelled = true; };
    }, [db, conversationId, identity.publicKey, runForegroundDrain, queueDmReceipt, isPeerRevoked, ownDeviceIds, bump]),
  );

  const pickAttachment = useCallback(() => {
    void (async () => {
      setAttachmentBusy(true);
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
          multiple: true,
        });
        if (result.canceled) return;
        const policy = ensureBlobPolicy(db, DM_MODULE_ID);
        const attachments: DmMessageAttachment[] = [];
        for (const asset of result.assets) {
          const info = await FileSystem.getInfoAsync(asset.uri);
          if (!info.exists || info.isDirectory) continue;
          const base64 = asset.base64 ?? await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const bytes = decodeBase64(base64);
          if (bytes.length > policy.maxBlobSizeBytes) {
            Alert.alert(
              'Attachment too large',
              `${asset.name} is ${formatBytes(bytes.length)}. Direct messages are capped at ${formatBytes(policy.maxBlobSizeBytes)} per file.`,
            );
            continue;
          }
          const stored = await blobStore.putLocal(bytes, {
            moduleId: DM_MODULE_ID,
            mimeType: asset.mimeType ?? 'application/octet-stream',
          });
          attachments.push({
            id: makeAttachmentId(stored.hash),
            blobHash: stored.hash,
            name: asset.name,
            mimeType: stored.mimeType,
            size: stored.size,
          });
        }
        if (attachments.length > 0) setDraftAttachments((current) => [...current, ...attachments]);
      } catch (error) {
        Alert.alert('Attachment failed', error instanceof Error ? error.message : String(error));
      } finally {
        setAttachmentBusy(false);
      }
    })();
  }, [blobStore, db]);

  const removeDraftAttachment = useCallback((id: string) => {
    setDraftAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }, []);

  const submitMessage = useCallback(async (body: string): Promise<void> => {
    if (body.length > MAX_DM_BODY) {
      Alert.alert('Message too long', 'Shorten this message and try again.');
      return;
    }
    const attachments = draftAttachments.length > 0 ? draftAttachments : undefined;
    setSending(true);
    // Fire the send: the core writes the local echo synchronously (optimistic),
    // so bumping now shows the new bubble as "Sending…" (no delivery row yet).
    const pending = queueDmMessage(conversationId, body, attachments);
    setDraft('');
    setDraftAttachments([]);
    bump();
    try {
      await pending;
    } catch {
      // The message is still a real local row; its honest state stays "Not sent".
    } finally {
      setSending(false);
      bump();
    }
  }, [conversationId, draftAttachments, queueDmMessage, bump]);

  // Retry a message whose send fully failed to park (item 3). Offered only when
  // dmRetryAvailable is true (state 'not_sent': no recipient reached 'parked'),
  // so the never-delivered local echo can be dropped and the REAL send path
  // re-run without duplicating a message anyone received. No auto-retry loop;
  // this fires only on an explicit tap, and state advances only on a real park.
  const retryMessage = useCallback((event: DmMessageEvent) => {
    // No-op if a retry (or send) is already in flight, so two fast taps cannot
    // mint two distinct messages (Fix 2). The ref is the synchronous guard.
    if (!shouldStartDmRetry(retryInFlightRef.current)) return;
    retryInFlightRef.current = true;
    void (async () => {
      const body = event.body;
      const attachments = (event.attachments ?? []).length > 0 ? event.attachments : undefined;
      setSending(true);
      // The failed echo never parked to anyone, so removing this local-only copy
      // loses nothing; re-run the same queueDmMessage path for a fresh attempt.
      deleteDmMessageRow(db, event.id);
      bump();
      try {
        await queueDmMessage(conversationId, body, attachments);
      } catch {
        // Still a real local row; its honest state stays "Not sent".
      } finally {
        retryInFlightRef.current = false;
        setSending(false);
        bump();
      }
    })();
  }, [db, conversationId, queueDmMessage, bump]);

  const confirmDelete = useCallback((messageId: string) => {
    Alert.alert(
      'Delete for everyone?',
      'This deletes your message on this device and asks each recipient to delete their copy. A device that never reconnects keeps its copy until the connection server drops the pending delete.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await queueDmShred(conversationId, [messageId]);
              } catch {
                Alert.alert('Could not delete', 'The delete did not complete on this device. Try again.');
              } finally {
                bump();
              }
            })();
          },
        },
      ],
    );
  }, [conversationId, queueDmShred, bump]);

  const reportMessage = useCallback((event: DmMessageEvent) => {
    Alert.alert(
      'Report this message?',
      'This records a local report for your own review. Nothing is sent to the other person.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            reportDm({
              conversationId,
              messageId: event.id,
              reportedDeviceId: event.authorDeviceId,
              reason: 'Reported from direct message',
            });
          },
        },
      ],
    );
  }, [conversationId, reportDm]);

  const onLongPressMessage = useCallback((id: string) => {
    const event = messagesById.get(id);
    if (!event) return;
    if (event.body.trim().length === 0 && (event.attachments ?? []).length === 0) return;
    setActionTargetId(id);
  }, [messagesById]);

  const onPressReaction = useCallback(() => {
    // DMs have no reaction protocol wired; the kit's reaction path is inert here.
  }, []);

  // QUEUED overflow actions: each presents an Alert, so it runs only after the
  // overflow Modal has fully dismissed.
  const confirmBlock = useCallback(() => {
    if (!peerParticipant) return;
    overflowPendingRef.current = () => {
      Alert.alert(
        'Block this person?',
        `Block ${resolveName(peerParticipant.device_id)}? This records a real local block so this device stops accepting and sending messages with them.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: () => {
              blockDmParticipant(peerParticipant.device_id, 'blocked from direct message');
              bump();
            },
          },
        ],
      );
    };
    setOverflowOpen(false);
  }, [peerParticipant, resolveName, blockDmParticipant, bump]);

  const reportPerson = useCallback(() => {
    if (!peerParticipant) return;
    overflowPendingRef.current = () => {
      reportDm({
        conversationId,
        reportedDeviceId: peerParticipant.device_id,
        reason: 'Reported person from direct message',
      });
      Alert.alert('Reported', 'A local report was recorded on this device. Nothing was sent.');
    };
    setOverflowOpen(false);
  }, [peerParticipant, conversationId, reportDm]);

  const renderAttachments = useCallback((kit: ChatKitMessage) => {
    const event = messagesById.get(kit.id);
    if (!event) return null;
    const attachments = event.attachments ?? [];
    const isMine = event.authorDeviceId === identity.publicKey;
    const kind = isGroup ? 'group' : 'direct';
    const summary = isMine
      ? summarizeDmDelivery(deliveryById.get(event.id) ?? [], kind, ownDeviceIds)
      : null;
    const receiptLine = summary ? dmDeliveryLabel(summary, kind, { relayConfigured }) : null;
    const canRetry = summary ? dmRetryAvailable(summary, isMine) : false;
    if (attachments.length === 0 && !receiptLine) return null;
    return (
      <View style={styles.attachmentsWrap}>
        {attachments.map((attachment) => (
          <DmAttachment key={attachment.id} attachment={attachment} blobStore={blobStore} />
        ))}
        {receiptLine ? (
          canRetry ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry sending this message"
              accessibilityState={{ disabled: sending }}
              disabled={sending}
              onPress={() => retryMessage(event)}
              style={({ pressed }) => [styles.retryRow, pressed && styles.pressed, sending && styles.disabled]}
            >
              <Text style={[styles.receiptLine, styles.receiptLineMine]}>{receiptLine}</Text>
              <Text style={styles.retryAction}>Retry</Text>
            </Pressable>
          ) : (
            <Text style={[styles.receiptLine, isMine && styles.receiptLineMine]}>{receiptLine}</Text>
          )
        ) : null}
      </View>
    );
  }, [messagesById, identity.publicKey, deliveryById, ownDeviceIds, isGroup, relayConfigured, styles, blobStore, retryMessage, sending]);

  if (!conversation) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.missingTitle}>Conversation unavailable</Text>
        <HonestNotice text="This device has no record of that conversation. Nothing is loaded from a fallback server." />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const actionEvent = actionTargetId ? messagesById.get(actionTargetId) ?? null : null;
  const actionIsMine = actionEvent ? actionEvent.authorDeviceId === identity.publicKey : false;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to messages"
          onPress={goBack}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <ArrowLeft size={20} color={c.text} strokeWidth={1.9} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.threadName} numberOfLines={1}>{title}</Text>
          <Text style={styles.threadSub} numberOfLines={1}>{subtitle}</Text>
        </View>
        {callablePeerId ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Voice call ${title}`}
              onPress={() => placeCall('voice')}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Phone size={18} color={c.text} strokeWidth={1.9} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Video call ${title}`}
              onPress={() => placeCall('video')}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Video size={18} color={c.text} strokeWidth={1.9} />
            </Pressable>
          </>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Conversation options"
          accessibilityState={{ expanded: overflowOpen }}
          onPress={() => setOverflowOpen(true)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <MoreVertical size={18} color={c.textSecondary} strokeWidth={1.9} />
        </Pressable>
      </View>

      {peerBlocked ? (
        <View style={styles.blockedBanner}>
          <Text style={styles.blockedBannerText}>
            You blocked this person. Unblock them from the People list to message again.
          </Text>
        </View>
      ) : null}

      <MessageList
        items={kitMessages}
        firstUnreadId={firstUnreadId}
        getAuthorName={resolveName}
        renderAttachments={renderAttachments}
        onLongPressMessage={onLongPressMessage}
        onPressReaction={onPressReaction}
        empty={(
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>No messages yet</Text>
            <Text style={styles.stateText}>{DM_EMPTY_THREAD_STATE}</Text>
          </View>
        )}
      />

      <View style={[styles.composerWrap, { paddingBottom: insets.bottom + 10 }]}>
        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          onSend={submitMessage}
          mentionCandidates={mentionCandidates}
          placeholder="Message"
          sendDisabled={sending || attachmentBusy || peerBlocked}
          allowAttachments={!peerBlocked}
          onPickAttachment={pickAttachment}
          attachmentBusy={attachmentBusy}
          attachmentsPresent={draftAttachments.length > 0}
          attachmentSlot={draftAttachments.length > 0 ? (
            <View style={styles.draftAttachments}>
              {draftAttachments.map((attachment) => (
                <View key={attachment.id} style={styles.draftAttachmentChip}>
                  <Text style={styles.draftAttachmentName} numberOfLines={1}>{attachment.name}</Text>
                  <Text style={styles.draftAttachmentMeta}>{formatBytes(attachment.size)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${attachment.name}`}
                    onPress={() => removeDraftAttachment(attachment.id)}
                    style={({ pressed }) => [styles.removeAttachmentButton, pressed && styles.pressed]}
                  >
                    <X size={13} color={c.textSecondary} strokeWidth={2.2} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        />
      </View>

      <MessageActionsSheet
        visible={actionTargetId !== null && actionEvent !== null}
        onClose={() => setActionTargetId(null)}
        canReact={false}
        canReply={false}
        canCopy={(actionEvent?.body.length ?? 0) > 0}
        canEdit={false}
        canDelete={actionIsMine}
        canReport={actionEvent !== null && !actionIsMine}
        onReact={() => undefined}
        onCopy={() => {
          if (!actionEvent?.body) return;
          Clipboard.setStringAsync(actionEvent.body).catch(() => {
            Alert.alert('Copy', 'Could not copy the text.');
          });
        }}
        onDelete={() => { if (actionEvent && actionIsMine) confirmDelete(actionEvent.id); }}
        onReport={() => { if (actionEvent) reportMessage(actionEvent); }}
      />

      <Modal
        visible={overflowOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setOverflowOpen(false)}
        onDismiss={flushOverflowPending}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close conversation options"
          style={styles.overflowBackdrop}
          onPress={() => setOverflowOpen(false)}
        >
          <Pressable style={[styles.overflowMenu, { top: insets.top + 52 }]} onPress={(event) => event.stopPropagation()}>
            {isGroup ? (
              <OverflowRow
                icon={<UserPlus size={17} color={c.text} strokeWidth={2} />}
                label="Group info"
                onPress={() => {
                  // The group-info sheet is a second Modal: open it only after
                  // this one has fully dismissed.
                  overflowPendingRef.current = () => setGroupInfoOpen(true);
                  setOverflowOpen(false);
                }}
              />
            ) : (
              <>
                <OverflowRow
                  icon={<FileText size={17} color={c.text} strokeWidth={2} />}
                  label="Report person"
                  onPress={reportPerson}
                />
                {!peerBlocked ? (
                  <OverflowRow
                    icon={<X size={17} color={c.danger} strokeWidth={2} />}
                    label="Block"
                    tone="danger"
                    onPress={confirmBlock}
                  />
                ) : null}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {isGroup ? (
        <GroupInfoSheet
          visible={groupInfoOpen}
          onClose={() => setGroupInfoOpen(false)}
          conversationId={conversationId}
          participants={participants}
          selfDeviceId={identity.publicKey}
          adminDeviceId={conversation.admin_device_id}
          resolveName={resolveName}
          pairedDevices={pairedDevices}
          isPeerRevoked={isPeerRevoked}
          dmGroupAddMember={dmGroupAddMember}
          dmGroupRemoveMember={dmGroupRemoveMember}
          onChanged={bump}
          onLeft={() => router.replace('/messages')}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

// One received DM attachment: live presence + View/Save. The over-cap re-request
// path is deferred (Plan 21 later phase), so an absent blob is stated honestly,
// never a dead "download" button.
function DmAttachment({
  attachment,
  blobStore,
}: {
  attachment: DmMessageAttachment;
  blobStore: ExpoBlobStore;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const { saveContent, chooseSaveDestination } = useNode();
  const isImage = attachment.mimeType.startsWith('image/');
  const [present, setPresent] = useState<boolean | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  // A thrown presence probe must not strand the card on "Checking this device…"
  // forever; it renders an honest could-not-check state instead.
  const [checkFailed, setCheckFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPresent(null);
    setPreviewUri(null);
    setCheckFailed(false);
    void (async () => {
      try {
        const has = await blobStore.has(attachment.blobHash);
        if (cancelled) return;
        setPresent(has);
        if (has && isImage) {
          const uri = await blobStore.previewDataUri(attachment.blobHash, attachment.mimeType);
          if (!cancelled) setPreviewUri(uri);
        }
      } catch {
        if (!cancelled) setCheckFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [attachment.blobHash, attachment.mimeType, blobStore, isImage]);

  const openAttachment = useCallback(() => {
    void (async () => {
      try {
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          Alert.alert('Sharing unavailable', 'This platform cannot open exported attachments.');
          return;
        }
        const exported = await blobStore.exportToCache(attachment.blobHash, attachment.name);
        if (!exported) {
          Alert.alert('Attachment not stored', 'This device has the file reference, but not the file bytes yet.');
          return;
        }
        await Sharing.shareAsync(exported, { mimeType: attachment.mimeType, dialogTitle: attachment.name });
      } catch {
        Alert.alert('Could not open', 'This attachment could not be opened on this device.');
      }
    })();
  }, [attachment.blobHash, attachment.mimeType, attachment.name, blobStore]);

  const saveAttachment = useCallback(() => {
    void (async () => {
      setSaveBusy(true);
      try {
        const bytes = await blobStore.get(attachment.blobHash);
        if (!bytes) {
          Alert.alert('Attachment not stored', 'This device has the file reference, but not the file bytes yet.');
          return;
        }
        let result = await saveContent({ bytes, name: attachment.name, mimeType: attachment.mimeType });
        if (result.kind === 'no-destination') {
          const chosen = await chooseSaveDestination();
          if (!chosen) return;
          result = await saveContent({ bytes, name: attachment.name, mimeType: attachment.mimeType });
        }
        if (result.kind === 'failed') Alert.alert('Could not save', result.reason);
      } catch {
        Alert.alert('Could not save', 'This attachment could not be saved on this device.');
      } finally {
        setSaveBusy(false);
      }
    })();
  }, [attachment.blobHash, attachment.name, attachment.mimeType, blobStore, saveContent, chooseSaveDestination]);

  if (checkFailed) {
    return (
      <View style={styles.attachmentGhost}>
        <FileText size={15} color={c.warning} strokeWidth={2} />
        <View style={styles.attachmentGhostText}>
          <Text style={styles.attachmentGhostName} numberOfLines={1}>{attachment.name}</Text>
          <Text style={styles.attachmentGhostSub} numberOfLines={2}>
            Could not check this device for the file. Reopen the chat to try again.
          </Text>
        </View>
      </View>
    );
  }

  if (present === false) {
    return (
      <View style={styles.attachmentGhost}>
        <FileText size={15} color={c.warning} strokeWidth={2} />
        <View style={styles.attachmentGhostText}>
          <Text style={styles.attachmentGhostName} numberOfLines={1}>{attachment.name}</Text>
          <Text style={styles.attachmentGhostSub} numberOfLines={2}>
            Not on this device yet. Large attachments are fetched on demand in a later update.
          </Text>
        </View>
      </View>
    );
  }

  const checking = present === null;
  return (
    <View style={styles.attachmentCardWrap}>
      <View style={styles.attachmentCard}>
        {isImage && previewUri ? (
          <RNImage source={{ uri: previewUri }} style={styles.attachmentImage} resizeMode="cover" />
        ) : (
          <View style={styles.attachmentIconBox}>
            <FileText size={16} color={c.textSecondary} strokeWidth={2} />
          </View>
        )}
        <View style={styles.attachmentTextCol}>
          <Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
          <Text style={styles.attachmentMeta} numberOfLines={1}>
            {checking ? 'Checking this device…' : formatBytes(attachment.size)}
          </Text>
        </View>
      </View>
      <View style={styles.attachmentActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${attachment.name}`}
          accessibilityState={{ disabled: checking }}
          disabled={checking}
          onPress={openAttachment}
          style={({ pressed }) => [styles.attachmentBtn, styles.attachmentBtnSolid, pressed && styles.pressed, checking && styles.disabled]}
        >
          <Text style={[styles.attachmentBtnText, styles.attachmentBtnSolidText]}>View</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Save ${attachment.name}`}
          accessibilityState={{ disabled: checking || saveBusy }}
          disabled={checking || saveBusy}
          onPress={saveAttachment}
          style={({ pressed }) => [styles.attachmentBtn, pressed && styles.pressed, (checking || saveBusy) && styles.disabled]}
        >
          <Text style={styles.attachmentBtnText}>{saveBusy ? 'Saving…' : 'Save to…'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function GroupInfoSheet({
  visible,
  onClose,
  conversationId,
  participants,
  selfDeviceId,
  adminDeviceId,
  resolveName,
  pairedDevices,
  isPeerRevoked,
  dmGroupAddMember,
  dmGroupRemoveMember,
  onChanged,
  onLeft,
}: {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  participants: DmParticipantRow[];
  selfDeviceId: string;
  adminDeviceId: string | null;
  resolveName: (deviceId: string) => string;
  pairedDevices: ReturnType<typeof useSync>['pairedDevices'];
  isPeerRevoked: (deviceId: string) => boolean;
  dmGroupAddMember: ReturnType<typeof useSync>['dmGroupAddMember'];
  dmGroupRemoveMember: ReturnType<typeof useSync>['dmGroupRemoveMember'];
  onChanged: () => void;
  /** Called AFTER this sheet has fully dismissed following a local leave. */
  onLeft: () => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const [busy, setBusy] = useState(false);
  const iAmAdmin = adminDeviceId === selfDeviceId;

  // Leaving navigates away, which must not race this Modal's dismissal: the
  // navigation is queued and flushed from onDismiss (iOS) or the visibility
  // effect (elsewhere, where Modal children unmount as soon as visible flips).
  const pendingRef = useRef<(() => void) | null>(null);
  const flushPending = useCallback(() => {
    const fn = pendingRef.current;
    pendingRef.current = null;
    fn?.();
  }, []);
  useEffect(() => {
    if (!visible && Platform.OS !== 'ios') flushPending();
  }, [visible, flushPending]);

  const memberIds = useMemo(() => new Set(participants.map((p) => p.device_id)), [participants]);
  const addable = useMemo(
    () => pairedDevices.filter((d) => d.isActive && !isPeerRevoked(d.deviceId) && !memberIds.has(d.deviceId)),
    [pairedDevices, isPeerRevoked, memberIds],
  );

  const addMember = useCallback((deviceId: string, dhPublicKey: string) => {
    void (async () => {
      setBusy(true);
      try {
        const member: DmGroupMember = { deviceId, dhPublicKey, role: 'member' };
        const result = await dmGroupAddMember(conversationId, member);
        if (!result.ok) Alert.alert('Could not add member', 'Only the group admin can change membership.');
        onChanged();
      } catch {
        Alert.alert('Could not add member', 'The change did not complete on this device. Nothing was changed.');
      } finally {
        setBusy(false);
      }
    })();
  }, [conversationId, dmGroupAddMember, onChanged]);

  const removeMember = useCallback((deviceId: string) => {
    Alert.alert(
      'Remove member?',
      'This rotates the group key so messages sent after removal cannot be read by this member.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                const result = await dmGroupRemoveMember(conversationId, deviceId);
                if (!result.ok) Alert.alert('Could not remove member', 'Only the group admin can change membership.');
                onChanged();
              } catch {
                Alert.alert('Could not remove member', 'The change did not complete on this device. Nothing was changed.');
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [conversationId, dmGroupRemoveMember, onChanged]);

  // Web-parity local leave: archives the conversation on THIS device only (there
  // is no network-wide leave protocol; the copy says so).
  const leaveGroup = useCallback(() => {
    Alert.alert(
      'Leave this group on this device?',
      'It disappears from your Messages here. The other members keep the conversation; there is no network-wide leave.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            try {
              setDmConversationArchived(db, conversationId, true);
            } catch {
              Alert.alert('Could not leave', 'Nothing was changed on this device.');
              return;
            }
            pendingRef.current = onLeft;
            onClose();
          },
        },
      ],
    );
  }, [db, conversationId, onLeft, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={flushPending}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close group info"
        style={styles.sheetBackdrop}
        onPress={onClose}
      >
        <Pressable style={[styles.groupSheet, { paddingBottom: insets.bottom + 20 }]} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandleRow}><View style={styles.sheetHandle} /></View>
          <Text style={styles.groupSheetTitle}>Members</Text>
          {participants.map((member) => {
            const isAdmin = member.device_id === adminDeviceId;
            const isSelf = member.device_id === selfDeviceId;
            return (
              <View key={member.device_id} style={styles.memberRow}>
                <View style={styles.memberMain}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {isSelf ? 'You' : resolveName(member.device_id)}
                  </Text>
                  <Text style={styles.memberMeta}>{isAdmin ? 'Admin' : 'Member'}</Text>
                </View>
                {iAmAdmin && !isSelf ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${resolveName(member.device_id)}`}
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => removeMember(member.device_id)}
                    style={({ pressed }) => [styles.memberRemoveBtn, pressed && styles.pressed, busy && styles.disabled]}
                  >
                    <Text style={styles.memberRemoveText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          {iAmAdmin ? (
            <>
              <Text style={styles.groupSheetSubtitle}>Add a paired friend</Text>
              {addable.length === 0 ? (
                <Text style={styles.groupEmptyText}>Everyone you have paired is already in this group.</Text>
              ) : (
                addable.map((device) => (
                  <Pressable
                    key={device.deviceId}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${device.displayName || shortHex(device.deviceId)}`}
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => addMember(device.deviceId, device.dhPublicKey)}
                    style={({ pressed }) => [styles.addRow, pressed && styles.pressed, busy && styles.disabled]}
                  >
                    <UserPlus size={16} color={c.accent} strokeWidth={2} />
                    <Text style={styles.addRowText} numberOfLines={1}>{device.displayName || shortHex(device.deviceId)}</Text>
                  </Pressable>
                ))
              )}
            </>
          ) : null}

          <HonestNotice text="Removing a member rotates the group key immediately. A new invite is delivered when the member's device next connects; Meerkat shows only the real signed group membership." />

          <Button title="Leave group" variant="danger" onPress={leaveGroup} disabled={busy} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function OverflowRow({
  icon,
  label,
  tone = 'default',
  onPress,
}: {
  icon: ReactNode;
  label: string;
  tone?: 'default' | 'danger';
  onPress: () => void;
}) {
  const styles = useMkStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.overflowRow, pressed && styles.overflowRowPressed]}
    >
      <View style={styles.overflowIcon}>{icon}</View>
      <Text style={[styles.overflowLabel, tone === 'danger' && styles.overflowLabelDanger]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: { padding: 16, justifyContent: 'center', gap: 14 },
  missingTitle: { color: c.text, fontSize: 22, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: c.surface,
  },
  headerText: { flex: 1, minWidth: 0 },
  threadName: { color: c.text, fontSize: 18, fontWeight: '800' },
  threadSub: { color: c.textSecondary, fontSize: 12, marginTop: 1 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: MK_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  blockedBanner: {
    backgroundColor: c.dangerSoft,
    borderColor: c.danger,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  blockedBannerText: { color: c.danger, fontSize: 12.5, lineHeight: 17, fontWeight: '700' },
  statePanel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 14,
    margin: 14,
    gap: 4,
  },
  stateTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  stateText: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  composerWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: c.surface,
    borderTopColor: c.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachmentsWrap: { gap: 6, marginTop: 2 },
  receiptLine: { color: c.textTertiary, fontSize: 11, fontWeight: '600' },
  receiptLineMine: { color: c.onAccent, opacity: 0.85 },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  retryAction: { color: c.onAccent, fontSize: 11.5, fontWeight: '800', textDecorationLine: 'underline' },
  draftAttachments: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  draftAttachmentChip: {
    maxWidth: '100%',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surfaceHigh,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 5,
  },
  draftAttachmentName: { maxWidth: 180, color: c.text, fontSize: 12, fontWeight: '700' },
  draftAttachmentMeta: { color: c.textTertiary, fontSize: 11 },
  removeAttachmentButton: {
    width: 24,
    height: 24,
    borderRadius: MK_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentCardWrap: { gap: 5 },
  attachmentCard: {
    minWidth: 200,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 2,
  },
  attachmentImage: { width: 68, height: 52, borderRadius: MK_RADIUS.sm, backgroundColor: c.surfaceHigh },
  attachmentIconBox: {
    width: 32,
    height: 32,
    borderRadius: MK_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  attachmentTextCol: { flex: 1, minWidth: 0, gap: 2 },
  attachmentName: { color: c.text, fontSize: 13, fontWeight: '700' },
  attachmentMeta: { color: c.textTertiary, fontSize: 11 },
  attachmentActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  attachmentBtn: {
    borderRadius: MK_RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  attachmentBtnText: { color: c.accentDim, fontSize: 11.5, fontWeight: '700' },
  attachmentBtnSolid: { backgroundColor: c.accent, borderColor: c.accent },
  attachmentBtnSolidText: { color: c.onAccent },
  attachmentGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.warning,
    borderRadius: MK_RADIUS.md,
    backgroundColor: c.warningSoft,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  attachmentGhostText: { flex: 1, minWidth: 0, gap: 2 },
  attachmentGhostName: { color: c.warning, fontSize: 13, fontWeight: '700' },
  attachmentGhostSub: { color: c.warning, fontSize: 11, lineHeight: 15, opacity: 0.85 },
  overflowBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)' },
  overflowMenu: {
    position: 'absolute',
    right: 12,
    minWidth: 200,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  overflowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  overflowRowPressed: { backgroundColor: c.surfaceHigh },
  overflowIcon: { width: 20, alignItems: 'center' },
  overflowLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
  overflowLabelDanger: { color: c.danger },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  groupSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 10,
  },
  sheetHandleRow: { alignItems: 'center', marginTop: -6, marginBottom: 2 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong },
  groupSheetTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  groupSheetSubtitle: { color: c.textSecondary, fontSize: 13, fontWeight: '800', marginTop: 6 },
  groupEmptyText: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  memberMain: { flex: 1, minWidth: 0, gap: 2 },
  memberName: { color: c.text, fontSize: 15, fontWeight: '700' },
  memberMeta: { color: c.textTertiary, fontSize: 11, fontWeight: '700' },
  memberRemoveBtn: {
    borderRadius: MK_RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.danger,
    backgroundColor: c.dangerSoft,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  memberRemoveText: { color: c.danger, fontSize: 12, fontWeight: '800' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addRowText: { flex: 1, minWidth: 0, color: c.text, fontSize: 14, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: c.surfaceHigh,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignSelf: 'flex-start',
  },
  secondaryButtonText: { color: c.text, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
