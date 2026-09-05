import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  channelArchived,
  discardShareIntake,
  getSharePayloads,
  listCommunities,
  listShareIntakes,
  type ChannelMessageAttachment,
  type ShareIntakeRow,
  type SharePayloadRow,
} from '@mylife/sync';
import { Button, HonestNotice, SectionHeader } from '../components/kit';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useChatActions } from '../providers/ChatProvider';
import { useNode } from '../providers/NodeProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { useSync } from '../providers/SyncProvider';
import { ExpoBlobStore } from '../data/expo-blob-store';
import { runShareIntakeSweep } from '../data/share-intake-native';
import {
  availableShareDestinations,
  isShareIntakeSent,
  routeStagedShare,
  routeStagedShareToDm,
  type ChannelSendFn,
  type DmSendFn,
  type ShareRouteTarget,
} from '../data/share-route';
import { buildFriendRows } from '../data/friends-core';
import { ensureDirectConversation } from '../data/dm-view-core';
import { ingestFromShareIntake } from '../data/library-store-core';
import {
  getPersonalWorkspaceId,
  listLibrarySummaries,
  type LibrarySummary,
} from '../data/library-hub-core';
import { LIBRARY_STRINGS } from '../data/library-view-core';
import { formatBytes, type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

interface InboxItem {
  intake: ShareIntakeRow;
  payloads: SharePayloadRow[];
  sent: boolean;
}

function payloadSummary(payload: SharePayloadRow): string {
  if (payload.kind === 'text' || payload.kind === 'url') {
    const value = payload.text_value ?? '';
    return value.length > 80 ? `${value.slice(0, 80)}...` : value;
  }
  const name = payload.filename ?? payload.kind;
  const size = payload.byte_length != null ? ` · ${formatBytes(payload.byte_length)}` : '';
  return `${name}${size}`;
}

export default function ShareInboxScreen() {
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { sendMessage } = useChatActions();
  const { store } = useNode();
  const { identity } = useIdentity();
  const {
    recordLocalChange,
    queueDmMessage,
    pairedDevices,
    isPeerSasVerified,
    isPeerRevoked,
  } = useSync();

  const [revision, setRevision] = useState(0);
  // Which item + which action is in flight, so only the tapped button reads busy.
  const [busy, setBusy] = useState<{ id: string; action: 'channel' | 'files' | 'dm' | 'library' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState<InboxItem | null>(null);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  // Reached via the OS-share deep link this can be the stack's only route; back
  // needs a fallback or the chevron silently does nothing.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(root)/(tabs)');
  }, [router]);

  const blobStore = useMemo(() => new ExpoBlobStore(db), [db]);
  const personalWorkspaceId = useMemo(
    () => getPersonalWorkspaceId(db, identity.publicKey),
    [db, identity.publicKey],
  );
  const personalLibraries = useMemo(
    () => {
      void revision;
      return personalWorkspaceId ? listLibrarySummaries(db, personalWorkspaceId) : [];
    },
    [db, personalWorkspaceId, revision],
  );

  const saveToLibrary = useCallback(
    async (item: InboxItem, summary: LibrarySummary) => {
      if (!personalWorkspaceId) return;
      setSaveTarget(null);
      setBusy({ id: item.intake.id, action: 'library' });
      setError(null);
      try {
        await ingestFromShareIntake(
          db,
          store,
          identity,
          { intakeId: item.intake.id, channelId: summary.config.channelId, workspaceId: personalWorkspaceId },
          (hash) => blobStore.get(hash),
          { recordChange: recordLocalChange },
        );
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save this item to a library.');
      } finally {
        setBusy(null);
      }
    },
    [db, store, identity, personalWorkspaceId, blobStore, recordLocalChange, refresh],
  );
  const destinations = availableShareDestinations();

  // Archived channels are read-only everywhere, so they are never offered as
  // send targets here (an external intake picker is a write entry point too).
  const communities = useMemo(
    () =>
      listCommunities(db).map((community) => ({
        id: community.communityId,
        name: community.descriptor.name,
        channels: community.descriptor.channels.filter((channel) => !channelArchived(channel)),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, revision],
  );

  const [target, setTarget] = useState<{ communityId: string; channelId: string } | null>(null);
  // Keep the target valid: pick a default when none is set, and repair it when
  // the referenced community/channel no longer exists (a stale target would
  // otherwise route into a channel that is gone).
  useEffect(() => {
    const community = communities.find((c) => c.id === target?.communityId);
    if (target && community && community.channels.some((ch) => ch.id === target.channelId)) return;
    const first = communities[0];
    const firstChannel = first?.channels[0];
    setTarget(first && firstChannel ? { communityId: first.id, channelId: firstChannel.id } : null);
  }, [communities, target]);

  // Plan 40 R1: trusted, unblocked friends are the DM share recipients.
  const dmRecipients = useMemo(
    () => buildFriendRows(pairedDevices, { isPeerSasVerified, isPeerRevoked })
      .filter((friend) => friend.trustState !== 'blocked'),
    [pairedDevices, isPeerSasVerified, isPeerRevoked],
  );
  const [dmRecipientId, setDmRecipientId] = useState<string | null>(null);
  useEffect(() => {
    if (dmRecipientId && dmRecipients.some((friend) => friend.deviceId === dmRecipientId)) return;
    setDmRecipientId(dmRecipients[0]?.deviceId ?? null);
  }, [dmRecipients, dmRecipientId]);

  const items = useMemo<InboxItem[]>(() => {
    return listShareIntakes(db, ['staged', 'reviewing', 'routed']).map((intake) => ({
      intake,
      payloads: getSharePayloads(db, intake.id),
      sent: isShareIntakeSent(db, intake),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, revision]);

  // Foreground cleanup: remove expired/discarded staged items + unpin orphaned
  // bytes. Runs once on mount; safe to re-run.
  useEffect(() => {
    void runShareIntakeSweep(db).then(refresh).catch(() => undefined);
  }, [db, refresh]);

  const send: ChannelSendFn = useCallback(
    (communityId, channelId, body, attachments) => {
      const result = sendMessage(communityId, channelId, body, attachments);
      return result.ok ? { ok: true, messageId: result.event.id } : { ok: false, error: result.error };
    },
    [sendMessage],
  );

  const buildAttachment = useCallback(
    async (payload: SharePayloadRow): Promise<ChannelMessageAttachment | null> => {
      if (!payload.blob_hash) return null;
      if (!(await blobStore.has(payload.blob_hash))) return null;
      return {
        id: `att_${payload.blob_hash.slice(0, 16)}_${Date.now().toString(36)}`,
        blobHash: payload.blob_hash,
        name: payload.filename ?? 'shared-file',
        mimeType: payload.mime ?? 'application/octet-stream',
        size: payload.byte_length ?? 0,
      };
    },
    [blobStore],
  );

  // Plan 40 R1: send a staged share to a DM thread THROUGH the real DM provider.
  // ensureDirectConversation gives (or creates) the thread; queueDmMessage writes
  // the signed local echo. share-route marks the intake routed only on that real
  // message id, so a failure leaves it staged + retryable.
  const sendDm: DmSendFn = useCallback(
    async (conversationId, body, attachments) => {
      try {
        const result = await queueDmMessage(conversationId, body, attachments);
        return { ok: true, messageId: result.event.id };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Could not send this message.' };
      }
    },
    [queueDmMessage],
  );

  const routeToDm = useCallback(
    async (item: InboxItem) => {
      setError(null);
      const recipient = pairedDevices.find((device) => device.deviceId === dmRecipientId);
      if (!recipient || !recipient.dhPublicKey) {
        setError('Choose a friend to send this to.');
        return;
      }
      setBusy({ id: item.intake.id, action: 'dm' });
      try {
        const conversationId = ensureDirectConversation(db, identity, {
          deviceId: recipient.deviceId,
          dhPublicKey: recipient.dhPublicKey,
        });
        const result = await routeStagedShareToDm({
          db,
          item: item.intake,
          conversationId,
          sendDm,
          buildAttachment,
        });
        if (!result.ok) setError(result.error);
        refresh();
      } catch (err) {
        // A thrown step (blob presence check, conversation setup) must surface;
        // the intake stays staged and retryable.
        setError(err instanceof Error ? err.message : 'Could not send this item.');
      } finally {
        setBusy(null);
      }
    },
    [db, identity, dmRecipientId, pairedDevices, sendDm, buildAttachment, refresh],
  );

  const route = useCallback(
    async (item: InboxItem, kind: 'channel' | 'files') => {
      setError(null);
      if (!target) {
        setError('Join or create a community first, then choose a channel to send to.');
        return;
      }
      setBusy({ id: item.intake.id, action: kind });
      try {
        const routeTarget: ShareRouteTarget = { kind, communityId: target.communityId, channelId: target.channelId };
        const result = await routeStagedShare({
          db,
          item: item.intake,
          target: routeTarget,
          send,
          buildAttachment,
        });
        if (!result.ok) setError(result.error);
        refresh();
      } catch (err) {
        // A thrown step must surface; the intake stays staged and retryable.
        setError(err instanceof Error ? err.message : 'Could not send this item.');
      } finally {
        setBusy(null);
      }
    },
    [db, target, send, buildAttachment, refresh],
  );

  const discard = useCallback(
    (item: InboxItem) => {
      discardShareIntake(db, item.intake.id);
      refresh();
    },
    [db, refresh],
  );

  const activeCommunity = communities.find((community) => community.id === target?.communityId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }]}
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Shared with Meerkat</Text>
      </View>

      <HonestNotice text="Items other apps share to Meerkat land here on THIS device only. Nothing is sent until you route it to a channel; a share is never delivered until a real message exists." />

      {communities.length > 0 ? (
        <View style={styles.panel}>
          <SectionHeader title="Send to" hint="Pick a community and channel" />
          <View style={styles.chipRow}>
            {communities.map((community) => {
              const active = community.id === target?.communityId;
              return (
                <Pressable
                  key={community.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setTarget({ communityId: community.id, channelId: community.channels[0]?.id ?? '' })}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{community.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {activeCommunity ? (
            <View style={styles.chipRow}>
              {activeCommunity.channels.map((channel) => {
                const active = channel.id === target?.channelId;
                return (
                  <Pressable
                    key={channel.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setTarget({ communityId: activeCommunity.id, channelId: channel.id })}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>#{channel.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.emptyText}>
            Join or create a community first. A shared item can only be routed into a channel you belong to.
          </Text>
        </View>
      )}

      {destinations.includes('dm') && dmRecipients.length > 0 ? (
        <View style={styles.panel}>
          <SectionHeader title="Send to a person" hint="Pick a friend to direct-message" />
          <View style={styles.chipRow}>
            {dmRecipients.map((friend) => {
              const active = friend.deviceId === dmRecipientId;
              return (
                <Pressable
                  key={friend.deviceId}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setDmRecipientId(friend.deviceId)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{friend.displayName}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.panel, styles.errorPanel]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {items.length === 0 ? (
        <View style={styles.panel}>
          <Text style={styles.emptyText}>
            Nothing shared yet. Use another app&apos;s Share sheet and pick Meerkat to stage an item here.
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.intake.id} style={styles.panel}>
            {item.payloads.map((payload) => (
              <View key={payload.id} style={styles.payloadRow}>
                <Text style={styles.payloadKind}>{payload.kind}</Text>
                <Text style={styles.payloadSummary} numberOfLines={2}>
                  {payloadSummary(payload)}
                </Text>
              </View>
            ))}

            {item.sent ? (
              <View style={styles.sentBadge}>
                <Text style={styles.sentText}>
                  {item.intake.destination === 'dm'
                    ? 'Sent as a direct message'
                    : `Sent${item.intake.destination ? ` to ${item.intake.destination}` : ''}`}
                </Text>
              </View>
            ) : (
              <View style={styles.actionRow}>
                {destinations.includes('channel') ? (
                  <Button
                    title={busy?.id === item.intake.id && busy.action === 'channel' ? 'Sending...' : 'Send to channel'}
                    onPress={() => { void route(item, 'channel'); }}
                    disabled={busy !== null || target === null}
                  />
                ) : null}
                {destinations.includes('files') ? (
                  <Button
                    title={busy?.id === item.intake.id && busy.action === 'files' ? 'Adding...' : 'Add to files'}
                    variant="secondary"
                    onPress={() => { void route(item, 'files'); }}
                    disabled={busy !== null || target === null}
                  />
                ) : null}
                {destinations.includes('dm') ? (
                  <Button
                    title={busy?.id === item.intake.id && busy.action === 'dm' ? 'Sending...' : 'Send to person'}
                    variant="secondary"
                    onPress={() => { void routeToDm(item); }}
                    disabled={busy !== null || dmRecipients.length === 0}
                  />
                ) : null}
                {item.payloads.some((payload) => payload.blob_hash) ? (
                  <Button
                    title={busy?.id === item.intake.id && busy.action === 'library' ? 'Saving...' : LIBRARY_STRINGS.saveToLibrary}
                    variant="secondary"
                    onPress={() => {
                      if (personalLibraries.length === 0) { router.push('/library'); return; }
                      setSaveTarget(item);
                    }}
                    disabled={busy !== null}
                  />
                ) : null}
                <Button
                  title="Discard"
                  variant="secondary"
                  onPress={() => discard(item)}
                  disabled={busy !== null}
                />
              </View>
            )}
          </View>
        ))
      )}

      <LibraryPickerModal
        visible={saveTarget !== null}
        libraries={personalLibraries}
        onClose={() => setSaveTarget(null)}
        onPick={(summary) => { if (saveTarget) void saveToLibrary(saveTarget, summary); }}
      />
    </ScrollView>
  );
}

function LibraryPickerModal({
  visible,
  libraries,
  onClose,
  onPick,
}: {
  visible: boolean;
  libraries: LibrarySummary[];
  onClose: () => void;
  onPick: (summary: LibrarySummary) => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.pickerTitle}>{LIBRARY_STRINGS.saveToLibrary}</Text>
          {libraries.map((summary) => (
            <Pressable key={summary.config.id} style={styles.pickerRow} onPress={() => onPick(summary)}>
              <Text style={styles.pickerRowText}>{summary.name}</Text>
              <Text style={styles.pickerRowMeta}>{summary.itemCount} {summary.itemCount === 1 ? 'item' : 'items'}</Text>
            </Pressable>
          ))}
          <Text style={[styles.emptyText, { color: c.textSecondary, marginTop: 6 }]}>
            The file is sealed into your chosen library on this device. Staging it here never sent it anywhere.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12 },
  header: { gap: 6 },
  back: { color: c.accent, fontSize: 15, fontWeight: '600' },
  title: { color: c.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 14,
    gap: 10,
  },
  errorPanel: { backgroundColor: c.dangerSoft, borderColor: c.danger },
  errorText: { color: c.danger, fontSize: 13, lineHeight: 18 },
  emptyText: { color: c.textSecondary, fontSize: 14, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderColor: c.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: `${c.accent}1F`, borderColor: c.accent },
  chipText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: c.accent },
  payloadRow: { gap: 2 },
  payloadKind: { color: c.textTertiary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  payloadSummary: { color: c.text, fontSize: 14, lineHeight: 19 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  sentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: c.successSoft,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sentText: { color: c.success, fontSize: 12, fontWeight: '700' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    padding: 20,
    gap: 4,
  },
  pickerTitle: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  pickerRowText: { color: c.text, fontSize: 15, fontWeight: '600' },
  pickerRowMeta: { color: c.textTertiary, fontSize: 12.5 },
});
