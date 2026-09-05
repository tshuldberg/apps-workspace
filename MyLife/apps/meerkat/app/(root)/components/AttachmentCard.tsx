// AttachmentCard: the in-channel file card (Phase 1 of Files & Sharing).
//
// One received attachment, with View / Save to... / Remove and a dashed
// placeholder after a local removal. Extracted out of the channel screen so
// Phases 2/3 touch a small surface and the logic is testable (the pure decisions
// live in data/attachment-card-state.ts; presence + removal IO live in
// ExpoBlobStore + blob-store-core).
//
// Honesty boundary (Critical):
//   - "on this device" vs "removed" is derived LIVE from blobStore.has() every
//     mount/refresh, never a stored flag and never written onto the signed,
//     immutable attachment metadata.
//   - Save reuses the existing saveContent path verbatim (file-save.ts verified
//     write). No new save logic.
//   - Remove is LOCAL-ONLY: blobStore.removeLocal frees only this device's bytes
//     (ref-count aware, verified after delete). It records no cm_ event, calls no
//     recordLocalChange, and queues no mailbox message.
//   - The freed-space figure uses the signed attachment.size, not on-disk bytes.
//   - "Request again" (Phase 3) is LIVE: it seals + parks a real FILE_REQUEST to
//     the message author over the pair-private mailbox and reflects the real
//     cm_file_requests row state. It is interactive ONLY when a request is truly
//     possible (paired author + relay), and the card flips back to the real file
//     via live presence (ExpoBlobStore.has), never a guessed state.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image as RNImage, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { FileText } from 'lucide-react-native';
import { type ChannelMessageAttachment, type ChannelMessageEvent } from '@mylife/sync';
import { formatBytes, type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { useNode } from '../providers/NodeProvider';
import { useSync } from '../providers/SyncProvider';
import { ExpoBlobStore } from '../data/expo-blob-store';
import { getSetting } from '../data/db';
import { RELAY_URL_SETTING_KEY } from '../data/sync-core';
import {
  getOutgoingRequestForAttachment,
  type FileRequestRow,
} from '../data/file-request-core';
import {
  REQUEST_AGAIN_LABEL,
  deriveAttachmentCardMode,
  deriveRequestAgainAvailability,
  deriveRequestAgainView,
  presentMetaLabel,
  requestQueueFailureMessage,
  summarizeRemoveResult,
  type RemoveFeedback,
  type RequestAgainStatus,
} from '../data/attachment-card-state';
import {
  communityFileReportTarget,
  isCommunityContentReportHidden,
  reportCommunityContent,
} from '../data/community-safety';

type AttachmentSaveStatus =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'saved'; location: 'files-app' | 'saf-folder' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; reason: string };

export function AttachmentCard({
  attachment,
  event,
}: {
  attachment: ChannelMessageAttachment;
  /** The signed message this attachment belongs to (author + id for requests). */
  event: ChannelMessageEvent;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { saveContent, chooseSaveDestination } = useNode();
  const { queueFileRequest, runForegroundDrain, pairedDevices, isPeerRevoked } = useSync();
  const blobStore = useMemo(() => new ExpoBlobStore(db), [db]);
  const isImage = attachment.mimeType.startsWith('image/');
  const reportTargetId = communityFileReportTarget({ channelId: event.channelId, attachmentId: attachment.id });

  // present === null => the has() check has not resolved (checking state).
  const [present, setPresent] = useState<boolean | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<AttachmentSaveStatus>({ kind: 'idle' });
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeFeedback, setRemoveFeedback] = useState<RemoveFeedback | null>(null);
  // The live request row (from cm_file_requests) + a transient 'requesting' flag
  // while a seal+park is in flight. Real state only; never an optimistic guess.
  const [requestRow, setRequestRow] = useState<FileRequestRow | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [safetyHidden, setSafetyHidden] = useState(() =>
    isCommunityContentReportHidden(db, event.communityId, 'file', reportTargetId),
  );

  // Live presence check (and image preview) on mount and whenever the blob hash
  // changes. Presence is never persisted; this is the single source of truth for
  // "on this device" vs the removed placeholder.
  // Reload the live outgoing request row for this attachment slot from the DB.
  const reloadRequestRow = useCallback(() => {
    setRequestRow(getOutgoingRequestForAttachment(
      db,
      event.communityId,
      event.channelId,
      attachment.id,
    ));
  }, [db, event.communityId, event.channelId, attachment.id]);

  const refreshPresence = useCallback(async () => {
    const has = await blobStore.has(attachment.blobHash);
    setPresent(has);
    if (has && isImage) {
      const uri = await blobStore.previewDataUri(attachment.blobHash, attachment.mimeType);
      setPreviewUri(uri);
    } else {
      setPreviewUri(null);
    }
    reloadRequestRow();
  }, [attachment.blobHash, attachment.mimeType, blobStore, isImage, reloadRequestRow]);

  useEffect(() => {
    let cancelled = false;
    setPresent(null);
    setPreviewUri(null);
    reloadRequestRow();
    void (async () => {
      const has = await blobStore.has(attachment.blobHash);
      if (cancelled) return;
      setPresent(has);
      if (has && isImage) {
        const uri = await blobStore.previewDataUri(attachment.blobHash, attachment.mimeType);
        if (!cancelled) setPreviewUri(uri);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachment.blobHash, attachment.mimeType, blobStore, isImage, reloadRequestRow]);

  const openAttachment = useCallback(() => {
    void (async () => {
      try {
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          Alert.alert('Sharing unavailable', 'This platform cannot open exported attachments from the app sandbox.');
          return;
        }
        const exported = await blobStore.exportToCache(attachment.blobHash, attachment.name);
        if (!exported) {
          Alert.alert('Attachment not stored', 'This device has the file reference, but not the file bytes yet.');
          await refreshPresence();
          return;
        }
        await Sharing.shareAsync(exported, {
          mimeType: attachment.mimeType,
          dialogTitle: attachment.name,
        });
      } catch (err) {
        // A thrown export/share died silently; surface it instead.
        Alert.alert('Could not open', err instanceof Error ? err.message : 'Could not open that file.');
      }
    })();
  }, [attachment.blobHash, attachment.mimeType, attachment.name, blobStore, refreshPresence]);

  // Save the verified blob bytes to a real OS destination. Identical to the prior
  // saveAttachment path: bytes come from blobStore.get (already-verified
  // plaintext); saveContent writes only to the OS folder / share sheet and
  // confirms the write before claiming success.
  const saveAttachment = useCallback(() => {
    void (async () => {
      setSaveStatus({ kind: 'busy' });
      try {
        // Inside the try: a thrown blob read used to strand the button on
        // "Saving…" forever with the rejection swallowed.
        const bytes = await blobStore.get(attachment.blobHash);
        if (!bytes) {
          setSaveStatus({ kind: 'failed', reason: 'This device has the file reference, but not the file bytes yet.' });
          await refreshPresence().catch(() => undefined);
          return;
        }
        let result = await saveContent({
          bytes,
          name: attachment.name,
          mimeType: attachment.mimeType,
        });
        if (result.kind === 'no-destination') {
          const chosen = await chooseSaveDestination();
          if (!chosen) {
            setSaveStatus({ kind: 'cancelled' });
            return;
          }
          result = await saveContent({
            bytes,
            name: attachment.name,
            mimeType: attachment.mimeType,
          });
        }
        if (result.kind === 'saved') {
          setSaveStatus({ kind: 'saved', location: result.location });
        } else if (result.kind === 'cancelled' || result.kind === 'no-destination') {
          setSaveStatus({ kind: 'cancelled' });
        } else {
          setSaveStatus({ kind: 'failed', reason: result.reason });
        }
      } catch (err) {
        setSaveStatus({ kind: 'failed', reason: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, [attachment.blobHash, attachment.name, attachment.mimeType, blobStore, saveContent, chooseSaveDestination, refreshPresence]);

  const performRemove = useCallback(() => {
    void (async () => {
      setRemoveBusy(true);
      try {
        const result = await blobStore.removeLocal(attachment.blobHash);
        const feedback = summarizeRemoveResult(result, attachment.size);
        setRemoveFeedback(feedback);
        // Re-derive presence from disk; never trust the action's own claim.
        await refreshPresence();
      } catch (err) {
        // Without this catch a thrown remove died silently while `finally`
        // reset busy = an idle-looking dead tap.
        Alert.alert('Could not remove', err instanceof Error ? err.message : 'Could not remove the local copy.');
      } finally {
        setRemoveBusy(false);
      }
    })();
  }, [attachment.blobHash, attachment.size, blobStore, refreshPresence]);

  const confirmRemove = useCallback(() => {
    Alert.alert(
      'Remove from this device?',
      `This frees ${formatBytes(attachment.size)} of local space and leaves a placeholder. The message stays, and nothing is removed for other members. Only your local copy is deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: performRemove },
      ],
    );
  }, [attachment.size, performRemove]);

  // Honest availability: only interactive for a paired, non-revoked author with
  // a relay configured. authorPaired is derived LIVE from the real paired list.
  const authorPaired = useMemo(
    () => pairedDevices.some((peer) => (
      peer.deviceId === event.authorDeviceId
      && peer.isActive
      && !isPeerRevoked(peer.deviceId)
    )),
    [pairedDevices, event.authorDeviceId, isPeerRevoked],
  );
  const relayConfigured = useMemo(
    () => !!getSetting(db, RELAY_URL_SETTING_KEY)?.trim().startsWith('ws'),
    [db],
  );
  const availability = deriveRequestAgainAvailability({
    isOwnMessage: event.authorDeviceId === identity.publicKey,
    authorPaired,
    relayConfigured,
  });

  // The live status drives the inline line. 'requesting' is the only transient
  // (in-flight) state; everything else comes from a real cm_file_requests row.
  const requestStatus: RequestAgainStatus = requesting
    ? 'requesting'
    : (requestRow?.status === 'requested'
        ? 'requested'
        : requestRow?.status === 'restored'
          ? 'restored'
          : requestRow?.status === 'declined'
            ? 'declined'
            : requestRow?.status === 'failed' || requestRow?.status === 'approved'
              ? (requestRow.status === 'approved' ? 'requested' : 'failed')
              : 'none');
  const requestView = deriveRequestAgainView(requestStatus, requestRow?.detail ?? null);

  const requestAgain = useCallback(() => {
    void (async () => {
      setRequesting(true);
      try {
        const result = await queueFileRequest(event, attachment);
        if (!result.ok) {
          // A real failure: surface the honest reason; no optimistic pending.
          Alert.alert('Could not request', requestQueueFailureMessage(result.reason));
        }
        // Reload the real row (written only on a successful park) and try a
        // best-effort foreground drain so an online owner's reply lands soon.
        reloadRequestRow();
        if (result.ok) void runForegroundDrain().then(() => refreshPresence()).catch(() => undefined);
      } catch (err) {
        // queueFileRequest can throw (sealing/blob reads); surface it honestly.
        Alert.alert('Could not request', err instanceof Error ? err.message : 'Could not send that request.');
      } finally {
        setRequesting(false);
      }
    })();
  }, [attachment, event, queueFileRequest, reloadRequestRow, runForegroundDrain, refreshPresence]);

  const reportFile = useCallback(() => {
    Alert.alert(
      'Report and hide file?',
      'This hides the file on this device and adds it to local owner review. It does not remove the file for other members.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            reportCommunityContent(db, {
              communityId: event.communityId,
              channelId: event.channelId,
              targetKind: 'file',
              targetId: reportTargetId,
              targetAuthorDeviceId: event.authorDeviceId,
              targetLabel: attachment.name,
              reason: 'Reported from file card',
            });
            setSafetyHidden(true);
          },
        },
      ],
    );
  }, [attachment.name, db, event.authorDeviceId, event.channelId, event.communityId, reportTargetId]);

  const mode = deriveAttachmentCardMode(present);

  if (safetyHidden) return null;

  if (mode === 'removed') {
    const buttonDisabled = !availability.canRequest || requestView.busy;
    const buttonLabel = requestView.busy ? 'Requesting…' : REQUEST_AGAIN_LABEL;
    return (
      <View style={styles.ghostFile}>
        <View style={styles.ghostHeader}>
          <View style={styles.ghostIconBox}>
            <FileText size={16} color={c.warning} strokeWidth={2} />
          </View>
          <View style={styles.ghostText}>
            <Text style={styles.ghostName} numberOfLines={1}>{attachment.name}</Text>
            <Text style={styles.ghostSub} numberOfLines={2}>
              {removeFeedback?.removed ? removeFeedback.message : 'Removed from this device'}
            </Text>
          </View>
        </View>
        <View style={styles.factions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              availability.canRequest
                ? `${REQUEST_AGAIN_LABEL} ${attachment.name}`
                : `${REQUEST_AGAIN_LABEL} ${attachment.name} (${availability.disabledReason ?? 'unavailable'})`
            }
            accessibilityState={{ disabled: buttonDisabled }}
            disabled={buttonDisabled}
            onPress={requestAgain}
            style={({ pressed }) => [
              styles.fbtn,
              availability.canRequest ? styles.fbtnSolid : styles.fbtnDisabled,
              pressed && availability.canRequest && styles.pressed,
            ]}
          >
            <Text style={[styles.fbtnText, availability.canRequest ? styles.fbtnSolidText : styles.fbtnDisabledText]}>
              {buttonLabel}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Report ${attachment.name}`}
            onPress={reportFile}
            style={({ pressed }) => [styles.fbtn, styles.fbtnWarn, pressed && styles.pressed]}
          >
            <Text style={[styles.fbtnText, styles.fbtnWarnText]}>Report</Text>
          </Pressable>
        </View>
        {requestView.message ? (
          <Text style={[
            styles.ghostStatus,
            requestView.tone === 'success' && { color: c.success },
            requestView.tone === 'error' && { color: c.danger },
          ]}>
            {requestView.message}
          </Text>
        ) : !availability.canRequest && availability.disabledReason ? (
          <Text style={styles.ghostStatus}>{availability.disabledReason}</Text>
        ) : null}
      </View>
    );
  }

  const checking = mode === 'checking';

  return (
    <View style={styles.attachmentRow}>
      <View style={styles.attachmentCard}>
        {isImage && previewUri ? (
          <RNImage source={{ uri: previewUri }} style={styles.attachmentImage} resizeMode="cover" />
        ) : (
          <View style={styles.attachmentIconBox}>
            <FileText size={17} color={c.textSecondary} strokeWidth={2} />
          </View>
        )}
        <View style={styles.attachmentText}>
          <Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
          <Text style={styles.attachmentMeta} numberOfLines={1}>
            {checking ? 'Checking this device…' : presentMetaLabel(attachment.size)}
          </Text>
        </View>
      </View>
      <View style={styles.factions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${attachment.name}`}
          accessibilityState={{ disabled: checking }}
          disabled={checking}
          onPress={openAttachment}
          style={({ pressed }) => [styles.fbtn, styles.fbtnSolid, pressed && styles.pressed, checking && styles.fbtnDisabled]}
        >
          <Text style={[styles.fbtnText, styles.fbtnSolidText]}>View</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Save ${attachment.name} to a folder`}
          accessibilityState={{ disabled: checking || saveStatus.kind === 'busy' }}
          disabled={checking || saveStatus.kind === 'busy'}
          onPress={saveAttachment}
          style={({ pressed }) => [styles.fbtn, pressed && styles.pressed, (checking || saveStatus.kind === 'busy') && styles.fbtnDisabled]}
        >
          <Text style={styles.fbtnText}>{saveStatus.kind === 'busy' ? 'Saving…' : 'Save to…'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${attachment.name} from this device`}
          accessibilityState={{ disabled: checking || removeBusy }}
          disabled={checking || removeBusy}
          onPress={confirmRemove}
          style={({ pressed }) => [styles.fbtn, styles.fbtnWarn, pressed && styles.pressed, (checking || removeBusy) && styles.fbtnDisabled]}
        >
          <Text style={[styles.fbtnText, styles.fbtnWarnText]}>{removeBusy ? 'Removing…' : 'Remove'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Report ${attachment.name}`}
          onPress={reportFile}
          style={({ pressed }) => [styles.fbtn, styles.fbtnWarn, pressed && styles.pressed]}
        >
          <Text style={[styles.fbtnText, styles.fbtnWarnText]}>Report</Text>
        </Pressable>
      </View>
      {saveStatus.kind === 'saved' ? (
        <Text style={styles.attachmentSaveStatus}>
          {saveStatus.location === 'saf-folder'
            ? 'Saved to your folder and verified on disk.'
            : 'Opened the iOS save sheet. Choose Files to finish saving.'}
        </Text>
      ) : null}
      {saveStatus.kind === 'cancelled' ? (
        <Text style={styles.attachmentSaveStatus}>Save cancelled. Nothing was written.</Text>
      ) : null}
      {saveStatus.kind === 'failed' ? (
        <Text style={[styles.attachmentSaveStatus, styles.attachmentSaveError]}>
          Could not save: {saveStatus.reason}
        </Text>
      ) : null}
      {removeFeedback && !removeFeedback.removed ? (
        <Text style={[
          styles.attachmentSaveStatus,
          removeFeedback.tone === 'error' && styles.attachmentSaveError,
        ]}>
          {removeFeedback.message}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  attachmentRow: { gap: 5 },
  attachmentCard: {
    minWidth: 210,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 4,
  },
  attachmentImage: {
    width: 72,
    height: 54,
    borderRadius: MK_RADIUS.sm,
    backgroundColor: c.surfaceHigh,
  },
  attachmentIconBox: {
    width: 34,
    height: 34,
    borderRadius: MK_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  attachmentText: { flex: 1, minWidth: 0, gap: 2 },
  attachmentName: { color: c.text, fontSize: 13, fontWeight: '700' },
  attachmentMeta: { color: c.textTertiary, fontSize: 11 },
  attachmentSaveStatus: { color: c.textTertiary, fontSize: 11, lineHeight: 15 },
  attachmentSaveError: { color: c.danger },
  // Action row (mockup .factions): View (solid), Save to... (neutral), Remove (warn).
  factions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  fbtn: {
    borderRadius: MK_RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  fbtnText: { color: c.accentDim, fontSize: 11.5, fontWeight: '700' },
  fbtnSolid: { backgroundColor: c.accent, borderColor: c.accent },
  fbtnSolidText: { color: c.onAccent },
  fbtnWarn: { borderColor: c.danger },
  fbtnWarnText: { color: c.danger },
  fbtnDisabled: { opacity: 0.45 },
  fbtnDisabledText: { color: c.textTertiary },
  ghostStatus: { color: c.warning, fontSize: 11, lineHeight: 15 },
  // Removed placeholder (mockup .ghost-file): dashed warning-tinted card.
  ghostFile: {
    maxWidth: '100%',
    minWidth: 210,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.warning,
    borderRadius: MK_RADIUS.md,
    backgroundColor: c.warningSoft,
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 8,
  },
  ghostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  ghostIconBox: {
    width: 30,
    height: 30,
    borderRadius: MK_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.warningSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.warning,
  },
  ghostText: { flex: 1, minWidth: 0, gap: 2 },
  ghostName: { color: c.warning, fontSize: 13, fontWeight: '700' },
  ghostSub: { color: c.warning, fontSize: 11, lineHeight: 15, opacity: 0.85 },
  pressed: { opacity: 0.7 },
});
