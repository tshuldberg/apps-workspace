// Destination detail (Plan 41 WP-41B3). Health card with a real manual refresh
// (drives router.checkHealth), quota, verified object count, this destination's
// jobs and backups, and the actions: verify now, migrate (explicit move job),
// and disconnect (revoke) with the EXACT consequences. Every figure is a folded
// row; the disconnect copy states credentials are removed and, where the adapter
// supports it, offers the keep-or-delete-remote choice.

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, HonestNotice, SectionHeader } from '../../../components/kit';
import { JobRow, QuotaBar, StatusChip, StorageHeader } from '../../../components/StorageKit';
import { useStorage } from '../../../providers/StorageProvider';
import {
  STORAGE_UI_COPY,
  buildDestinationDetailViewModel,
  type StorageBackupLine,
} from '../../../data/storage-destinations/storage-ui-core';
import { MK_RADIUS, formatBytes, type MkColors } from '../../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../../providers/AppThemeProvider';
import * as Crypto from 'expo-crypto';
import {
  changePrimaryDestination,
  rotateStorageCredential,
  serializeS3Credentials,
  serializeWebdavCredentials,
  listStorageDestinations,
  listStorageObjects,
  planRepairJob,
  runRepairJob,
  type MoveExistingBackupsProgress,
} from '@mylife/sync';
import { useMeerkatDatabase } from '../../../providers/DatabaseProvider';
import {
  createMobileStorageCredentialRef,
  deleteMobileStorageSecret,
  writeMobileStorageSecret,
} from '../../../data/storage-destinations/credential-store';

export default function DestinationDetailScreen(): React.ReactElement {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const destinationId = Array.isArray(id) ? id[0] : id;
  const { diagnostics, router: storageRouter, registry, refresh } = useStorage();
  const db = useMeerkatDatabase();
  const [checking, setChecking] = useState(false);
  const [managing, setManaging] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  // Synchronous single-flight across the mutating actions (migrate, repair,
  // rotate, disconnect): two fast taps land before the busy re-render.
  const actionInFlightRef = React.useRef(false);
  const [manageResult, setManageResult] = useState<string | null>(null);
  const [moveProgress, setMoveProgress] = useState<MoveExistingBackupsProgress | null>(null);
  const [credentialOne, setCredentialOne] = useState('');
  const [credentialTwo, setCredentialTwo] = useState('');
  const [credentialThree, setCredentialThree] = useState('');

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const supportsRemoteDelete = useMemo(() => {
    const destination = storageRouter.getDestination(destinationId ?? '');
    if (!destination) return false;
    const adapter = registry.resolveRouterDestination(destination);
    return adapter !== null;
  }, [storageRouter, registry, destinationId]);

  const vm = useMemo(
    () => (destinationId
      ? buildDestinationDetailViewModel({ diagnostics, destinationId, supportsRemoteDelete })
      : null),
    [diagnostics, destinationId, supportsRemoteDelete],
  );

  const onCheckHealth = useCallback(() => {
    if (!destinationId) return;
    setChecking(true);
    void (async () => {
      try {
        const destination = storageRouter.getDestination(destinationId);
        const adapter = destination ? registry.resolveRouterDestination(destination) : null;
        if (destination?.credential_ref && adapter) {
          const authorization = await adapter.authorize({
            kind: destination.credential_ref.startsWith('broker://oauth/')
              ? 'broker_vault' : 'stored_credential',
            credentialRef: destination.credential_ref,
          });
          if (authorization.kind !== 'authorized') throw new Error('This destination needs to be reconnected.');
        }
        await storageRouter.checkHealth(destinationId, { refresh: true });
      } catch (error) {
        Alert.alert('Health check', error instanceof Error ? error.message : 'Could not check this destination.');
      } finally {
        refresh();
        setChecking(false);
      }
    })();
  }, [destinationId, storageRouter, registry, refresh]);

  const onDisconnect = useCallback(() => {
    if (!destinationId) return;
    const doRevoke = (deleteRemoteData: boolean): void => {
      if (actionInFlightRef.current) return;
      actionInFlightRef.current = true;
      setDisconnecting(true);
      void (async () => {
        let revoked = false;
        try {
          const destination = storageRouter.getDestination(destinationId);
          const adapter = destination ? registry.resolveRouterDestination(destination) : null;
          if (adapter) {
            if (deleteRemoteData && destination?.credential_ref) {
              const authorization = await adapter.authorize({
                kind: destination.credential_ref.startsWith('broker://oauth/')
                  ? 'broker_vault' : 'stored_credential',
                credentialRef: destination.credential_ref,
              });
              if (authorization.kind !== 'authorized') throw new Error('This destination needs to be reconnected before remote data can be deleted.');
            }
            await adapter.revoke({ deleteRemoteData });
          }
          storageRouter.updateDestinationState(destinationId, 'revoked');
          registry.invalidate(destinationId);
          revoked = true;
        } catch (error) {
          Alert.alert('Disconnect', error instanceof Error ? error.message : 'Could not disconnect this destination. Nothing was disconnected.');
        } finally {
          refresh();
          actionInFlightRef.current = false;
          setDisconnecting(false);
          // Leave the screen only after a REAL revoke; a failed disconnect must
          // not navigate away under the error alert as if it succeeded.
          if (revoked) {
            if (router.canGoBack()) router.back();
            else router.replace('/storage');
          }
        }
      })();
    };
    if (supportsRemoteDelete) {
      Alert.alert(
        'Disconnect this destination',
        `${STORAGE_UI_COPY.disconnectConsequence}\n\nKeep the encrypted copies stored there, or delete them too?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Keep remote data', onPress: () => doRevoke(false) },
          { text: 'Delete remote data', style: 'destructive', onPress: () => doRevoke(true) },
        ],
      );
    } else {
      Alert.alert(
        'Disconnect this destination',
        STORAGE_UI_COPY.disconnectConsequence,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disconnect', style: 'destructive', onPress: () => doRevoke(false) },
        ],
      );
    }
  }, [destinationId, storageRouter, registry, supportsRemoteDelete, refresh]);

  const runDestinationChange = useCallback((targetId: string, moveExisting: boolean) => {
    if (!destinationId) return;
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setManaging(true);
    setManageResult(null);
    setMoveProgress(null);
    void changePrimaryDestination({
      db,
      router: storageRouter,
      sourceDestinationId: destinationId,
      targetDestinationId: targetId,
      moveExisting,
      resolveAdapter: registry.resolveRouterDestination,
      onProgress: setMoveProgress,
    }).then((report) => {
      setManageResult(report.move === null
        ? 'Future writes now use the selected destination. Existing copies stayed where they are.'
        : `${report.move.moved} backup${report.move.moved === 1 ? '' : 's'} moved; ${report.move.failed + report.move.skipped} need attention.`);
    }).catch((error: unknown) => {
      setManageResult(error instanceof Error ? error.message : 'Could not change the primary destination.');
    }).finally(() => {
      refresh();
      actionInFlightRef.current = false;
      setManaging(false);
    });
  }, [db, destinationId, registry.resolveRouterDestination, storageRouter, refresh]);

  const onMigrate = useCallback(() => {
    const targets = storageRouter.listDestinations()
      .filter((destination) => destination.id !== destinationId
        && (destination.state === 'ready' || destination.state === 'degraded'));
    if (targets.length === 0) {
      Alert.alert('Move data', 'Connect and verify another destination first.');
      return;
    }
    Alert.alert(
      'Choose the new primary destination',
      STORAGE_UI_COPY.migrateExplanation,
      [
        ...targets.map((target) => ({
          text: target.label,
          onPress: () => Alert.alert(
            `Use ${target.label}`,
            'Choose whether to change future writes only or also move every existing verified backup.',
            [
              { text: 'Cancel', style: 'cancel' as const },
              { text: 'Future writes only', onPress: () => runDestinationChange(target.id, false) },
              { text: 'Move existing too', onPress: () => runDestinationChange(target.id, true) },
            ],
          ),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }, [destinationId, runDestinationChange, storageRouter]);

  const onRotateCredentials = useCallback(() => {
    if (!destinationId) return;
    const destination = storageRouter.getDestination(destinationId);
    if (!destination || (destination.kind !== 'webdav' && destination.kind !== 's3')) return;
    const newRef = createMobileStorageCredentialRef(destination.id);
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setManaging(true);
    setManageResult(null);
    void (async () => {
      try {
        const secret = destination.kind === 'webdav'
          ? serializeWebdavCredentials({ username: credentialOne.trim(), password: credentialTwo })
          : serializeS3Credentials({
            accessKeyId: credentialOne.trim(), secretAccessKey: credentialTwo,
            ...(credentialThree.trim() ? { sessionToken: credentialThree.trim() } : {}),
          });
        await writeMobileStorageSecret(newRef, secret);
        const report = await rotateStorageCredential({
          db,
          destinationId,
          newCredentialRef: newRef,
          authorizationKind: 'stored_credential',
          invalidateAdapter: registry.invalidate,
          resolveAdapter: registry.resolveRouterDestination,
          resumeJob: async (jobId) => {
            storageRouter.resumeJob(jobId);
            await storageRouter.runJob(jobId);
          },
          deleteCredential: deleteMobileStorageSecret,
          now: () => new Date().toISOString(),
          probeNonce: Crypto.randomUUID(),
        });
        if (!report.credentialSwapped) await deleteMobileStorageSecret(newRef).catch(() => undefined);
        setManageResult(report.complete
          ? `Credentials updated. ${report.resumedJobIds.length} paused job${report.resumedJobIds.length === 1 ? '' : 's'} resumed.`
          : `Credential update needs attention: ${report.errorCode ?? 'health probe failed'}.`);
        setCredentialTwo('');
        setCredentialThree('');
      } catch (error) {
        await deleteMobileStorageSecret(newRef).catch(() => undefined);
        setManageResult(error instanceof Error ? error.message : 'Credential update failed.');
      } finally {
        refresh();
        actionInFlightRef.current = false;
        setManaging(false);
      }
    })();
  }, [credentialOne, credentialThree, credentialTwo, db, destinationId, refresh,
    registry.invalidate, registry.resolveRouterDestination, storageRouter]);

  const onRepair = useCallback(() => {
    if (!destinationId) return;
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setManaging(true);
    setManageResult(null);
    void (async () => {
      try {
        const destinations = listStorageDestinations(db);
        for (const destination of destinations) {
          const adapter = registry.resolveRouterDestination(destination);
          if (!adapter) continue;
          const authorization = await adapter.authorize(destination.credential_ref ? {
            kind: destination.credential_ref.startsWith('broker://oauth/')
              ? 'broker_vault' : 'stored_credential',
            credentialRef: destination.credential_ref,
          } : { kind: 'interactive' });
          if (authorization.kind !== 'authorized') registry.invalidate(destination.id);
        }
        const report = await runRepairJob({
          db,
          plan: planRepairJob({
            objects: listStorageObjects(db),
            destinations,
            targetDestinationId: destinationId,
          }),
          resolveAdapter: (targetId) => {
            const destination = storageRouter.getDestination(targetId);
            return destination ? registry.resolveRouterDestination(destination) : null;
          },
          now: () => new Date().toISOString(),
          random: Crypto.randomUUID,
        });
        setManageResult(`Repair checked ${report.planned} object${report.planned === 1 ? '' : 's'}: ${report.repaired} repaired, ${report.failed} failed, ${report.impossible} had no usable verified copy, and ${report.backupsReverified} backup record${report.backupsReverified === 1 ? '' : 's'} returned to complete.`);
      } catch (error) {
        setManageResult(error instanceof Error ? error.message : 'Repair could not run.');
      } finally {
        refresh();
        actionInFlightRef.current = false;
        setManaging(false);
      }
    })();
  }, [db, destinationId, refresh, registry, storageRouter]);

  if (!vm) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        <StorageHeader title="Destination" />
        <View style={styles.panel}>
          <Text style={styles.emptyBody}>This destination is no longer available.</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }]}
    >
      <StorageHeader title={vm.label} subtitle={vm.name} />

      <View style={styles.panel}>
        <View style={styles.healthTop}>
          <SectionHeader title="Health" />
          <StatusChip label={vm.chip.label} tone={vm.chip.tone} />
        </View>
        <Text style={styles.blurb}>{vm.blurb}</Text>
        <QuotaBar quota={vm.quota} />
        <View style={styles.statRow}>
          <Stat label="Verified" value={String(vm.verifiedObjects)} />
          <Stat label="Objects" value={String(vm.totalObjects)} />
          <Stat label="Need attention" value={String(vm.unhealthyObjects)} tone={vm.unhealthyObjects > 0 ? c.warning : undefined} />
        </View>
        {vm.lastVerificationAt ? (
          <Text style={styles.meta}>Last verified: {vm.lastVerificationAt}</Text>
        ) : (
          <Text style={styles.meta}>No object has been verified here yet.</Text>
        )}
        {vm.healthCheckedAt ? <Text style={styles.meta}>Last checked: {vm.healthCheckedAt}</Text> : null}
        <Button title={checking ? 'Checking...' : 'Verify now'} variant="secondary" onPress={onCheckHealth} disabled={checking} />
      </View>

      {vm.activeJobs.length > 0 ? (
        <View style={styles.panel}>
          <SectionHeader title="Jobs" />
          {vm.activeJobs.map((job) => <JobRow key={job.id} job={job} />)}
        </View>
      ) : null}

      <View style={styles.panel}>
        <SectionHeader title="Backups here" />
        {vm.backups.length === 0 ? (
          <Text style={styles.emptyBody}>No backup has been written to this destination yet.</Text>
        ) : (
          vm.backups.map((backup) => <BackupRow key={`${backup.backupId}:${backup.destinationId}`} backup={backup} />)
        )}
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Manage" />
        <Button title={managing ? 'Working...' : 'Move data to another destination'} variant="secondary" onPress={onMigrate} disabled={managing} />
        <Button title={managing ? 'Working...' : 'Repair missing objects'} variant="secondary" onPress={onRepair} disabled={managing || vm.unhealthyObjects === 0} />
        {moveProgress ? (
          <Text style={styles.meta}>
            Move progress: {moveProgress.completed} of {moveProgress.total} backups checked; {moveProgress.moved} moved, {moveProgress.failed} failed, {moveProgress.skipped} skipped.
          </Text>
        ) : null}
        {vm.kind === 'webdav' || vm.kind === 's3' ? (
          <View style={styles.credentialForm}>
            <Text style={styles.formTitle}>Update credentials</Text>
            <TextInput style={styles.input} value={credentialOne} onChangeText={setCredentialOne} placeholder={vm.kind === 'webdav' ? 'Username' : 'Access key ID'} autoCapitalize="none" autoCorrect={false} />
            <TextInput style={styles.input} value={credentialTwo} onChangeText={setCredentialTwo} placeholder={vm.kind === 'webdav' ? 'Password' : 'Secret access key'} secureTextEntry autoCapitalize="none" autoCorrect={false} />
            {vm.kind === 's3' ? <TextInput style={styles.input} value={credentialThree} onChangeText={setCredentialThree} placeholder="Session token, if required" secureTextEntry autoCapitalize="none" autoCorrect={false} /> : null}
            <Button title={managing ? 'Verifying...' : 'Update and verify'} variant="secondary" onPress={onRotateCredentials} disabled={managing || !credentialOne.trim() || !credentialTwo} />
          </View>
        ) : null}
        {manageResult ? <Text style={styles.meta}>{manageResult}</Text> : null}
        <Button
          title={disconnecting ? 'Disconnecting...' : 'Disconnect'}
          variant="danger"
          onPress={onDisconnect}
          disabled={disconnecting || managing}
        />
        <HonestNotice text={STORAGE_UI_COPY.migrateExplanation} />
      </View>
    </ScrollView>
  );
}

function BackupRow({ backup }: { backup: StorageBackupLine }): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.backupRow}>
      <View style={styles.backupText}>
        <Text style={styles.backupId} numberOfLines={1}>{backup.backupId}</Text>
        <Text style={styles.meta}>
          {backup.objectCount} objects · {formatBytes(backup.encryptedBytes)}
          {backup.completedAt ? ` · ${backup.completedAt}` : ''}
        </Text>
      </View>
      <StatusChip label={backup.stateLabel} tone={backup.tone} />
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  healthTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blurb: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: c.accent, fontSize: 18, fontWeight: '800' },
  statLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '600' },
  meta: { color: c.textTertiary, fontSize: 12 },
  emptyBody: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
  credentialForm: { gap: 10 },
  formTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 44,
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    color: c.text,
  },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backupText: { flex: 1, minWidth: 0, gap: 2 },
  backupId: { color: c.text, fontSize: 13, fontWeight: '600' },
});
