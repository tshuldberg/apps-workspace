import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { listDmOwnDevices } from '../data/dm-core';
import {
  buildOwnDeviceLinkCandidates,
  readOwnDeviceLinkStatus,
  type OwnDeviceLinkCandidate,
  type OwnDeviceStatusTone,
} from '../data/dm-own-device-status';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { useSync } from '../providers/SyncProvider';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { Button, HonestNotice, SectionHeader } from './kit';
import { MK_MONO, MK_RADIUS, shortHex, type MkColors } from '../theme/tokens';

function toneColor(tone: OwnDeviceStatusTone, c: MkColors): string {
  switch (tone) {
    case 'success':
      return c.success;
    case 'warning':
      return c.warning;
    case 'idle':
      return c.textTertiary;
  }
}

export function OwnDeviceLinkCard({ compact = false }: { compact?: boolean }): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  const c = useAppThemeColors();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const {
    pairedDevices,
    isPeerSasVerified,
    isPeerRevoked,
    linkOwnDeviceAsPerson,
    unlinkOwnDeviceFromPerson,
    hasPendingPersonProposal,
    cancelPendingPersonProposals,
    rebuildOwnPersonGroup,
    pendingPersonRemovals,
    approvePersonRemoval,
    declinePersonRemoval,
    runForegroundDrain,
  } = useSync();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const bump = useCallback(() => setRevision((current) => current + 1), []);

  const ownDevices = useMemo(() => {
    void revision;
    return listDmOwnDevices(db);
  }, [db, revision]);
  const status = useMemo(
    () => {
      void revision;
      return readOwnDeviceLinkStatus(db, identity.publicKey);
    },
    [db, identity.publicKey, revision],
  );
  const candidates = useMemo(
    () => buildOwnDeviceLinkCandidates(pairedDevices, ownDevices, {
      isPeerSasVerified,
      isPeerRevoked,
      shortDeviceId: shortHex,
    }),
    [pairedDevices, ownDevices, isPeerSasVerified, isPeerRevoked],
  );

  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const onUnlink = useCallback((candidate: OwnDeviceLinkCandidate) => {
    if (unlinkingId !== null) return;
    Alert.alert(
      `Remove ${candidate.displayName} from your devices?`,
      'It stops counting as one of your devices, your other devices stop showing it as you, and a '
      + 'new key is generated that it does not have. Content it already holds stays on it. You can '
      + 'link it again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setUnlinkingId(candidate.deviceId);
            setNotice(null);
            void (async () => {
              try {
                const result = await unlinkOwnDeviceFromPerson(candidate.deviceId);
                // Round-3 MEDIUM-3: a removal that is still WAITING on another
                // device has changed nothing yet -- the device is still a member
                // under the same key, and the rotated key exists only inside the
                // pending confirmation. Saying "removed, new key generated" there
                // would be materially false about a lost or stolen device, so the
                // pending case says exactly what is true.
                if (result.ok && result.assembled) {
                  setNotice(`${candidate.displayName} was removed from your devices and a new key was generated.`);
                } else if (result.ok) {
                  setNotice(`${candidate.displayName} will be removed once your other device confirms; open Meerkat there and let it sync. Until then it is still one of your devices and the key has not changed.`);
                } else if (result.reason === 'proposal_pending') {
                  setNotice('A device-linking confirmation is already waiting. Cancel it below, then try again.');
                } else if (result.reason === 'conflicted') {
                  setNotice(`Could not remove ${candidate.displayName}: your devices disagree about which change came first, so nothing was changed. Use "Start my device group over" below.`);
                } else {
                  setNotice(`Could not remove ${candidate.displayName}. Nothing was changed.`);
                }
              } catch {
                // A thrown removal must not strand the row on "Removing…".
                setNotice(`Could not remove ${candidate.displayName}. Nothing was changed.`);
              } finally {
                setUnlinkingId(null);
                bump();
              }
            })();
          },
        },
      ],
    );
  }, [bump, unlinkOwnDeviceFromPerson, unlinkingId]);

  const onLink = useCallback((candidate: OwnDeviceLinkCandidate) => {
    if (!candidate.canLink) return;
    setNotice(null);
    void (async () => {
      try {
        // Plan 52 P1: linking also proposes the person group, so the two devices
        // present as ONE person. The link itself always lands; the ceremony
        // needs the other device to co-sign, so the notice says exactly that
        // rather than claiming the devices already read as one person.
        const result = await linkOwnDeviceAsPerson({
          deviceId: candidate.deviceId,
          identityAnchor: identity.publicKey,
          dhPublicKey: candidate.dhPublicKey,
          label: candidate.displayName,
        });
        const linked = `${candidate.displayName} is linked as one of your own devices on this device.`;
        if (result.ok && result.assembled) {
          setNotice(`${linked} They now show as one person.`);
        } else if (result.ok) {
          setNotice(`${linked} They will show as one person once that device confirms; open Meerkat there and let it sync.`);
        } else if (result.reason === 'proposal_pending') {
          setNotice(`${linked} A device-linking confirmation is already waiting on another device, so this one has not started yet. Use "Cancel the waiting confirmation" below, then link again.`);
        } else if (result.reason === 'conflicted') {
          setNotice(`${linked} Your devices disagree about which change came first, so they cannot be joined into one person. Use "Start my device group over" below.`);
        } else {
          setNotice(`${linked} They could not be joined into one person yet, so they still show separately.`);
        }
      } catch {
        setNotice(`Could not link ${candidate.displayName}. Nothing was changed.`);
      } finally {
        bump();
      }
    })();
  }, [bump, identity.publicKey, linkOwnDeviceAsPerson]);

  const onCancelPending = useCallback(() => {
    cancelPendingPersonProposals();
    setNotice('The waiting confirmation was cancelled. You can link a device again now.');
    bump();
  }, [bump, cancelPendingPersonProposals]);

  const approvals = useMemo(() => {
    void revision;
    return pendingPersonRemovals();
  }, [pendingPersonRemovals, revision]);

  const onApprove = useCallback((id: string) => {
    setNotice(null);
    void (async () => {
      try {
        const ok = await approvePersonRemoval(id);
        setNotice(ok
          ? 'You approved the removal. It completes once every one of your devices has agreed.'
          : 'That removal could not be approved, so nothing changed. Your devices may have moved on since it was asked.');
      } catch {
        setNotice('That removal could not be approved, so nothing changed.');
      } finally {
        bump();
      }
    })();
  }, [approvePersonRemoval, bump]);

  const onDecline = useCallback((id: string) => {
    declinePersonRemoval(id);
    setNotice('You declined that removal. Nothing was changed.');
    bump();
  }, [bump, declinePersonRemoval]);

  const onRebuild = useCallback(() => {
    Alert.alert(
      'Start your device group over on this device?',
      'This device forgets which devices are yours and generates a new key. Your other devices keep '
      + 'their own record until you do the same there, so you will need to link them again. Nothing '
      + 'you have written is deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start over',
          style: 'destructive',
          onPress: () => {
            rebuildOwnPersonGroup();
            setNotice('This device started its group over. Link your other devices again when you are ready.');
            bump();
          },
        },
      ],
    );
  }, [bump, rebuildOwnPersonGroup]);

  const onCheckMailbox = useCallback(() => {
    setBusy(true);
    setNotice(null);
    void (async () => {
      try {
        const result = await runForegroundDrain();
        if (result.appliedMessages > 0 || result.dmReceipts > 0) {
          setNotice(`Mailbox check applied ${result.appliedMessages} DM rows and ${result.dmReceipts} signed receipts.`);
        } else if (!result.ran) {
          setNotice('Mailbox check did not run because no connection server is configured.');
        } else {
          setNotice('Mailbox checked. No new messages or delivery updates were waiting.');
        }
        bump();
      } catch (err) {
        setNotice(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  }, [bump, runForegroundDrain]);

  const color = toneColor(status.tone, c);

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.headerRow}>
        <SectionHeader
          title="Own devices"
          hint="Link another paired device you own so DMs can mirror through the mailbox."
        />
        <View style={[styles.statusPill, { borderColor: color }]}>
          <Text style={[styles.statusPillText, { color }]}>{status.pillLabel}</Text>
        </View>
      </View>
      <Text style={styles.statusTitle}>{status.title}</Text>
      <Text style={styles.statusDetail}>{status.detail}</Text>

      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

      <View style={styles.candidateList}>
        {candidates.length === 0 ? (
          <Text style={styles.statusDetail}>Pair another device on Sync first, then return here to link it.</Text>
        ) : (
          candidates.map((candidate) => (
            <OwnDeviceCandidateRow
              key={candidate.deviceId}
              candidate={candidate}
              onLink={() => onLink(candidate)}
              onUnlink={() => onUnlink(candidate)}
              busy={unlinkingId === candidate.deviceId}
            />
          ))
        )}
      </View>

      {approvals.length > 0 ? (
        <View style={styles.pendingBox}>
          <Text style={styles.statusDetail}>
            {approvals.length === 1
              ? 'One of your devices is asking to remove a device from your devices.'
              : `Your devices are asking to remove devices ${approvals.length} times.`}
            {' '}
            This needs your approval here, because removing a device is not something one
            device should be able to do to another on its own.
          </Text>
          {approvals.map((approval) => (
            <View key={approval.id} style={styles.candidateRow}>
              <View style={styles.candidateText}>
                <Text style={styles.candidateName} numberOfLines={1}>
                  {`Remove ${approval.removes.map((id) => shortHex(id)).join(', ')}`}
                </Text>
                <Text style={styles.candidateMeta}>
                  {`asked by ${shortHex(approval.senderDeviceId)}`}
                </Text>
              </View>
              <Button title="Approve" variant="secondary" onPress={() => onApprove(approval.id)} />
              <Button title="Decline" variant="secondary" onPress={() => onDecline(approval.id)} />
            </View>
          ))}
        </View>
      ) : null}

      {hasPendingPersonProposal() ? (
        <View style={styles.pendingBox}>
          <Text style={styles.statusDetail}>
            A device-linking confirmation is waiting on another device. Open Meerkat there and let
            it sync, or cancel it here to start over.
          </Text>
          <Button
            title="Cancel the waiting confirmation"
            variant="secondary"
            onPress={onCancelPending}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          title={busy ? 'Checking...' : 'Check mailbox now'}
          variant="secondary"
          onPress={onCheckMailbox}
          disabled={busy}
        />
      </View>
      <View style={styles.pendingBox}>
        <Text style={styles.statusDetail}>
          If linking or removing a device stops working, reset the links on this device and link
          your devices again. Your messages are kept.
        </Text>
        <Button
          title="Start my device group over"
          variant="secondary"
          onPress={onRebuild}
        />
      </View>
      <HonestNotice text="Conversations are saved on this device. Link from both devices to receive copies on each. Updates appear when messages and delivery confirmations arrive." />
    </View>
  );
}

function OwnDeviceCandidateRow({
  candidate,
  onLink,
  onUnlink,
  busy,
}: {
  candidate: OwnDeviceLinkCandidate;
  onLink: () => void;
  onUnlink: () => void;
  busy: boolean;
}): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.candidateRow}>
      <View style={styles.candidateText}>
        <Text style={styles.candidateName} numberOfLines={1}>{candidate.displayName}</Text>
        <Text style={styles.candidateMeta}>{candidate.shortDeviceId}</Text>
        {candidate.disabledReason ? (
          <Text style={styles.candidateReason}>{candidate.disabledReason}</Text>
        ) : null}
      </View>
      {candidate.linked ? (
        // Plan 52: a lost, stolen, or retired device MUST be removable. This
        // rotates the person's group secret so the removed device cannot
        // derive future identifiers, records a tombstone so no later revision
        // can silently re-admit it, and revokes its own-device link.
        <Button
          title={busy ? 'Removing…' : 'Remove this device'}
          variant="danger"
          onPress={onUnlink}
          disabled={busy}
          style={styles.linkButton}
        />
      ) : (
        <Button
          title="Link this second device"
          variant="secondary"
          onPress={onLink}
          disabled={!candidate.canLink}
          style={styles.linkButton}
        />
      )}
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  compactCard: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  statusPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    maxWidth: 132,
  },
  statusPillText: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  statusTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
  statusDetail: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  noticeText: { color: c.info, fontSize: 13, lineHeight: 19 },
  pendingBox: { gap: 8, marginTop: 8 },
  candidateList: { gap: 8 },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.md,
    padding: 10,
  },
  candidateText: { flex: 1, minWidth: 0, gap: 2 },
  candidateName: { color: c.text, fontSize: 14, fontWeight: '800' },
  candidateMeta: { color: c.textTertiary, fontSize: 11, fontFamily: MK_MONO },
  candidateReason: { color: c.textSecondary, fontSize: 11.5, lineHeight: 16 },
  linkButton: { paddingHorizontal: 12, paddingVertical: 9, minWidth: 158 },
  actions: { alignItems: 'stretch' },
});
