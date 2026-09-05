// FileIndexRequestButton: the live "Request" control for a REMOVED row in the
// per-community Files index (Plan 23 D.1). It drives the SAME real request/park
// flow as the in-channel AttachmentCard (queueFileRequestByFields -> sealed
// FILE_REQUEST over the pair-private mailbox), reflecting only the real
// cm_file_requests row state. No "coming in a later update" copy; if a row
// genuinely cannot be requested, the caller renders nothing (button absent).
//
// Honesty: the button is interactive ONLY when a real request is possible (the
// author is a paired, non-revoked member and a relay is configured). Otherwise
// it stays disabled with the honest reason. A 'requested' line appears only
// after a real park; presence (not this row) is the source of truth for restore.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { useSync } from '../providers/SyncProvider';
import { getSetting } from '../data/db';
import { RELAY_URL_SETTING_KEY } from '../data/sync-core';
import { getOutgoingRequestForAttachment } from '../data/file-request-core';
import {
  deriveRequestAgainAvailability,
  deriveRequestAgainView,
  REQUEST_AGAIN_LABEL,
  requestQueueFailureMessage,
  type RequestAgainStatus,
} from '../data/attachment-card-state';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export interface FileIndexRequestTarget {
  communityId: string;
  channelId: string;
  messageId: string;
  attachmentId: string;
  blobHash: string;
  authorDeviceId: string;
  name: string;
}

export function FileIndexRequestButton({
  target,
  onRestored,
}: {
  target: FileIndexRequestTarget;
  /** Called after a best-effort foreground drain so the index can re-check presence. */
  onRestored?: () => void;
}): React.ReactElement | null {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { queueFileRequestByFields, runForegroundDrain, pairedDevices, isPeerRevoked } = useSync();

  const [requestStatus, setRequestStatus] = useState<RequestAgainStatus>('none');
  const [detail, setDetail] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const reload = useCallback(() => {
    const row = getOutgoingRequestForAttachment(db, target.communityId, target.channelId, target.attachmentId);
    if (!row) {
      setRequestStatus('none');
      setDetail(null);
      return;
    }
    setDetail(row.detail ?? null);
    setRequestStatus(
      row.status === 'requested' || row.status === 'approved'
        ? 'requested'
        : row.status === 'restored'
          ? 'restored'
          : row.status === 'declined'
            ? 'declined'
            : row.status === 'failed'
              ? 'failed'
              : 'none',
    );
  }, [db, target.communityId, target.channelId, target.attachmentId]);

  useEffect(() => { reload(); }, [reload]);

  const authorPaired = useMemo(
    () => pairedDevices.some((peer) => (
      peer.deviceId === target.authorDeviceId && peer.isActive && !isPeerRevoked(peer.deviceId)
    )),
    [pairedDevices, target.authorDeviceId, isPeerRevoked],
  );
  const relayConfigured = useMemo(
    () => !!getSetting(db, RELAY_URL_SETTING_KEY)?.trim().startsWith('ws'),
    [db],
  );
  const availability = deriveRequestAgainAvailability({
    isOwnMessage: target.authorDeviceId === identity.publicKey,
    authorPaired,
    relayConfigured,
  });

  const status: RequestAgainStatus = requesting ? 'requesting' : requestStatus;
  const view = deriveRequestAgainView(status, detail);

  const request = useCallback(() => {
    void (async () => {
      setRequesting(true);
      try {
        const result = await queueFileRequestByFields({
          communityId: target.communityId,
          channelId: target.channelId,
          messageId: target.messageId,
          attachmentId: target.attachmentId,
          blobHash: target.blobHash,
          ownerDeviceId: target.authorDeviceId,
        });
        if (!result.ok) {
          setDetail(requestQueueFailureMessage(result.reason));
          setRequestStatus('failed');
        } else {
          reload();
          void runForegroundDrain().then(() => onRestored?.()).catch(() => undefined);
        }
      } catch (err) {
        // queueFileRequestByFields can throw (sealing/blob reads); without this
        // catch the rejection vanished while `finally` reset busy = a dead tap.
        setDetail(err instanceof Error ? err.message : 'Could not send that request.');
        setRequestStatus('failed');
      } finally {
        setRequesting(false);
      }
    })();
  }, [queueFileRequestByFields, target, reload, runForegroundDrain, onRestored]);

  // If a request can never be made for this row, render nothing (button absent) -
  // never a fake-disabled "later" affordance. The one exception: keep showing a
  // live status line for an in-flight/answered request even if availability later
  // changes, so the user still sees the honest outcome.
  if (!availability.canRequest && status === 'none') {
    return null;
  }

  const busy = view.busy;
  const label = busy ? 'Requesting…' : REQUEST_AGAIN_LABEL;
  const disabled = busy || !availability.canRequest;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${REQUEST_AGAIN_LABEL} ${target.name}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={request}
        style={({ pressed }) => [
          styles.btn,
          availability.canRequest ? styles.btnSolid : styles.btnDisabled,
          pressed && availability.canRequest && styles.pressed,
        ]}
      >
        <Text style={[styles.btnText, availability.canRequest ? styles.btnSolidText : styles.btnDisabledText]}>
          {label}
        </Text>
      </Pressable>
      {view.message ? (
        <Text
          style={[
            styles.statusLine,
            view.tone === 'success' && { color: c.success },
            view.tone === 'error' && { color: c.danger },
          ]}
          numberOfLines={2}
        >
          {view.message}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  wrap: { alignItems: 'flex-end', gap: 3, maxWidth: 160 },
  btn: {
    borderRadius: MK_RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnSolid: { backgroundColor: c.accent, borderColor: c.accent },
  btnDisabled: { backgroundColor: c.surface, borderColor: c.border, opacity: 0.6 },
  btnText: { fontSize: 11.5, fontWeight: '700' },
  btnSolidText: { color: c.onAccent },
  btnDisabledText: { color: c.textTertiary },
  statusLine: { color: c.textSecondary, fontSize: 10.5, lineHeight: 14, textAlign: 'right' },
  pressed: { opacity: 0.7 },
});
