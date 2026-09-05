// Back up now (Plan 41 WP-41B3). Drives a REAL backup: a consistent SQLite
// snapshot, streamed through the Backup Format v1 encoder, written to the chosen
// destination through a router backup job whose completion is gated on real
// read-back / checksum verification (NC-41.2, AC-41.3). Live progress reflects
// the writing and verifying phases from the job row. The history below shows
// each backup's state VERBATIM: a non-complete backup is never shown as done.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import {
  exportRecoverableIdentity,
  hexToBytes,
  parseRecoveryKey,
  sealRecovery,
  parseStorageScheduleConfig,
  updateStorageScheduleConfig,
} from '@mylife/sync';
import type { BackupSigningIdentity } from '@mylife/sync/src/storage/backup-format';
import { Button, HonestNotice, SectionHeader } from '../../components/kit';
import { StatusChip, StorageHeader } from '../../components/StorageKit';
import { useStorage } from '../../providers/StorageProvider';
import { useIdentity } from '../../providers/IdentityProvider';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import {
  STORAGE_UI_COPY,
  buildBackupLine,
  buildStorageHubViewModel,
  type StorageBackupLine,
  type StorageDestinationSummary,
} from '../../data/storage-destinations/storage-ui-core';
import {
  backupLocatorSettingKey,
  runLocalDatabaseBackup,
  type BackupRunProgress,
} from '../../data/storage-destinations/local-backup-run';
import { setSetting } from '../../data/db';
import { MK_MONO, MK_RADIUS, formatBytes, type MkColors } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';
import {
  createMobileStorageCredentialRef,
  deleteMobileStorageSecret,
  readMobileStorageSecret,
  writeMobileStorageSecret,
} from '../../data/storage-destinations/credential-store';
import { readStorageScheduleDecisions } from '../../data/storage-destinations/storage-scheduler-run';
import { registerBackgroundSync } from '../../data/background-task-registration';
import { ExpoBlobStore } from '../../data/expo-blob-store';

const BACKUP_SCHEMA_VERSION = 1;
const APP_VERSION = '1.0.0';

export default function BackupScreen(): React.ReactElement {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { diagnostics, router: storageRouter, registry, payloadStore, refresh } = useStorage();
  const { identity } = useIdentity();
  const db = useMeerkatDatabase();
  const blobStore = useMemo(() => new ExpoBlobStore(db), [db]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const vm = useMemo(() => buildStorageHubViewModel(diagnostics), [diagnostics]);
  // A backup can be written only to a destination that is available for writes.
  const targets = useMemo(
    () => vm.destinations.filter((d) => d.chip.state === 'ready'),
    [vm.destinations],
  );
  const backups = useMemo(
    () => diagnostics.backups.map(buildBackupLine),
    [diagnostics.backups],
  );

  const [recoveryKey, setRecoveryKey] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<BackupRunProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleIntervalHours, setScheduleIntervalHours] = useState(24);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Stale-selection repair: a selected destination that lost readiness (health
  // flip, revoke) must not stay the backup target; fall back to the first
  // still-ready one instead of writing to a non-ready destination.
  const destinationId = (selectedId && targets.some((t) => t.id === selectedId))
    ? selectedId
    : targets[0]?.id ?? null;
  const schedulePolicy = diagnostics.policies.find((policy) => policy.dataClass === 'sqlite_snapshot');
  const scheduleConfig = useMemo(
    () => schedulePolicy ? parseStorageScheduleConfig(schedulePolicy.retentionJson) : null,
    [schedulePolicy],
  );
  const scheduleDecision = readStorageScheduleDecisions(db)
    .find((decision) => decision.dataClass === 'sqlite_snapshot') ?? null;

  useEffect(() => {
    if (scheduleConfig) setScheduleIntervalHours(scheduleConfig.intervalHours);
  }, [scheduleConfig]);

  // Synchronous single-flight: two fast taps land before the running re-render
  // and would start two overlapping backup jobs against one destination.
  const runInFlightRef = useRef(false);
  const runBackupNow = useCallback((backupRecoveryKey: string, backupDestinationId: string) => {
    if (runInFlightRef.current) return;
    const recoveryBytes = parseRecoveryKey(backupRecoveryKey.trim());
    if (!recoveryBytes) {
      setResult({ ok: false, text: 'That recovery key is not valid. It starts with MKR1.' });
      return;
    }
    runInFlightRef.current = true;
    setRunning(true);
    setResult(null);
    setProgress(null);
    void (async () => {
      let signing: BackupSigningIdentity | null = null;
      try {
        const policy = storageRouter.getPolicy('sqlite_snapshot');
        const destinationIds = new Set([backupDestinationId]);
        if (policy?.primary_destination_id === backupDestinationId && policy.mirror_destination_id) {
          destinationIds.add(policy.mirror_destination_id);
        }
        for (const id of destinationIds) {
          const destination = storageRouter.getDestination(id);
          const adapter = destination ? registry.resolveRouterDestination(destination) : null;
          if (!destination || !adapter) {
            if (id === backupDestinationId) throw new Error('The selected destination is unavailable.');
            continue;
          }
          if (destination.credential_ref) {
            const authorization = await adapter.authorize({
              kind: destination.credential_ref.startsWith('broker://oauth/')
                ? 'broker_vault' : 'stored_credential',
              credentialRef: destination.credential_ref,
            });
            if (authorization.kind !== 'authorized' && id === backupDestinationId) {
              throw new Error('The destination needs to be reconnected.');
            }
          }
        }
        await storageRouter.checkHealth(backupDestinationId, { refresh: true });
        const recoverable = exportRecoverableIdentity(identity);
        signing = {
          deviceId: identity.publicKey,
          publicKey: hexToBytes(recoverable.publicKey),
          secretKey: hexToBytes(recoverable.signingPrivateKeyHex),
        };
        const backupId = `backup-${Crypto.randomUUID()}`;
        const outcome = await runLocalDatabaseBackup({
          db,
          router: storageRouter,
          destinationId: backupDestinationId,
          backupId,
          schemaVersion: BACKUP_SCHEMA_VERSION,
          payloadStore,
          blobStore,
          encoderInput: {
            recoveryKey: backupRecoveryKey.trim(),
            backupId,
            createdAt: new Date().toISOString(),
            schemaVersion: BACKUP_SCHEMA_VERSION,
            migrationVersion: BACKUP_SCHEMA_VERSION,
            appVersion: APP_VERSION,
            dataClassVersions: {},
            sealedRecoveryBundle: sealRecovery(recoverable, recoveryBytes),
            signingIdentity: signing,
          },
          onProgress: setProgress,
        });
        if (outcome.complete) {
          // Persist the non-secret locator so a restore on this device can open
          // the manifest for this backup. It carries no key material.
          setSetting(db, backupLocatorSettingKey(backupDestinationId, backupId), outcome.locatorJson);
        }
        setResult(outcome.complete
          ? outcome.mirror?.error
            ? { ok: false, text: `Primary backup verified. The mirror copy did not finish: ${outcome.mirror.error}. The primary remains complete.` }
            : { ok: true, text: 'Backup complete. Every primary and mirror object verified.' }
          : { ok: false, text: `Backup did not finish verifying (${outcome.job.state}). Nothing is marked backed up until it does.` });
      } catch (error) {
        setResult({ ok: false, text: error instanceof Error ? error.message : 'The backup could not be completed.' });
      } finally {
        // Zero the secret key bytes we assembled for the encoder.
        signing?.secretKey.fill(0);
        recoveryBytes.fill(0);
        refresh();
        runInFlightRef.current = false;
        setRunning(false);
      }
    })();
  }, [blobStore, db, identity, storageRouter, registry, payloadStore, refresh]);

  const onBackupNow = useCallback(() => {
    if (destinationId) runBackupNow(recoveryKey, destinationId);
  }, [destinationId, recoveryKey, runBackupNow]);

  const onEnableSchedule = useCallback(() => {
    if (!destinationId) return;
    const recoveryBytes = parseRecoveryKey(recoveryKey.trim());
    if (!recoveryBytes) {
      setResult({ ok: false, text: 'Enter a valid recovery key before enabling scheduled backups.' });
      return;
    }
    recoveryBytes.fill(0);
    setScheduleBusy(true);
    setResult(null);
    void (async () => {
      const existing = storageRouter.getPolicy('sqlite_snapshot');
      const previous = existing ? parseStorageScheduleConfig(existing.retention_json) : null;
      if (existing && previous === null) {
        throw new Error('The existing retention policy is invalid. Scheduling was not changed.');
      }
      const keyRef = previous?.recoveryKeyRef
        ?? createMobileStorageCredentialRef(`schedule-${destinationId}`);
      const createdRef = previous?.recoveryKeyRef === null || previous?.recoveryKeyRef === undefined;
      try {
        await writeMobileStorageSecret(keyRef, recoveryKey.trim());
        if (existing) {
          storageRouter.setPolicy({
            ...existing,
            primary_destination_id: destinationId,
            retention_json: updateStorageScheduleConfig(existing.retention_json, {
              enabled: true,
              intervalHours: scheduleIntervalHours,
              recoveryKeyRef: keyRef,
            }),
          });
        } else {
          storageRouter.setPolicy({
            dataClass: 'sqlite_snapshot',
            primaryDestinationId: destinationId,
            localCacheBytes: 0,
            retention: {
              keepLast: 7,
              maxAgeDays: 30,
              schedule: {
                enabled: true,
                intervalHours: scheduleIntervalHours,
                recoveryKeyRef: keyRef,
              },
            },
          });
        }
        const registration = await registerBackgroundSync();
        setResult(registration.registered
          ? { ok: true, text: 'Scheduled backups are enabled. The OS decides when the best-effort task runs.' }
          : { ok: false, text: `The schedule is saved, but OS scheduling is unavailable here. ${registration.reason ?? 'Use Back up now.'}` });
      } catch (error) {
        if (createdRef) await deleteMobileStorageSecret(keyRef).catch(() => undefined);
        throw error;
      } finally {
        refresh();
      }
    })().catch((error: unknown) => {
      setResult({ ok: false, text: error instanceof Error ? error.message : 'The schedule could not be saved.' });
    }).finally(() => setScheduleBusy(false));
  }, [destinationId, recoveryKey, refresh, scheduleIntervalHours, storageRouter]);

  const onDisableSchedule = useCallback(() => {
    const existing = storageRouter.getPolicy('sqlite_snapshot');
    if (!existing) return;
    const previous = parseStorageScheduleConfig(existing.retention_json);
    if (!previous) {
      setResult({ ok: false, text: 'The existing retention policy is invalid. Scheduling was not changed.' });
      return;
    }
    setScheduleBusy(true);
    try {
      storageRouter.setPolicy({
        ...existing,
        retention_json: updateStorageScheduleConfig(existing.retention_json, {
          enabled: false,
          intervalHours: previous.intervalHours,
          recoveryKeyRef: null,
        }),
      });
      void (previous.recoveryKeyRef
        ? deleteMobileStorageSecret(previous.recoveryKeyRef)
        : Promise.resolve()).then(() => {
        setResult({ ok: true, text: 'Scheduled backups are off. No last-run time was changed.' });
      }).catch((error: unknown) => {
        setResult({ ok: false, text: error instanceof Error ? error.message : 'The saved schedule key could not be deleted.' });
      }).finally(() => {
        refresh();
        setScheduleBusy(false);
      });
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : 'The schedule could not be disabled.' });
      setScheduleBusy(false);
    }
  }, [refresh, storageRouter]);

  const onRunScheduledNow = useCallback(() => {
    const keyRef = scheduleConfig?.recoveryKeyRef;
    const targetId = schedulePolicy?.primary.id ?? null;
    if (!keyRef || !targetId) {
      setResult({ ok: false, text: 'The scheduled recovery key or destination is unavailable.' });
      return;
    }
    void readMobileStorageSecret(keyRef).then((key) => {
      if (!key) {
        setResult({ ok: false, text: 'The scheduled recovery key is unavailable.' });
        return;
      }
      runBackupNow(key, targetId);
    }).catch((error: unknown) => {
      setResult({ ok: false, text: error instanceof Error ? error.message : 'The scheduled recovery key is unavailable.' });
    });
  }, [runBackupNow, scheduleConfig?.recoveryKeyRef, schedulePolicy?.primary.id]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }]}
    >
      <StorageHeader title="Back up now" subtitle="Write an encrypted copy to a destination" />

      {targets.length === 0 ? (
        <View style={styles.panel}>
          <Text style={styles.emptyBody}>
            No destination is ready to receive a backup. Connect and verify a destination first.
          </Text>
        </View>
      ) : (
        <View style={styles.panel}>
          <SectionHeader title="Destination" hint="Where this backup will be written" />
          {targets.map((target) => (
            <TargetRow
              key={target.id}
              target={target}
              selected={target.id === destinationId}
              onSelect={() => setSelectedId(target.id)}
            />
          ))}

          <SectionHeader title="Recovery key" hint="Your backup is encrypted with your recovery key" />
          <TextInput
            style={styles.input}
            value={recoveryKey}
            onChangeText={setRecoveryKey}
            placeholder="MKR1-XXXXX-XXXXX-..."
            placeholderTextColor={c.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Recovery key"
          />

          {progress ? (
            <View style={styles.progress}>
              <StatusChip label={phaseLabel(progress.phase)} tone={phaseTone(progress.phase)} />
              <Text style={styles.progressText}>
                {progress.totalBytes > 0
                  ? `${formatBytes(progress.completedBytes)} of ${formatBytes(progress.totalBytes)}`
                  : `${progress.completedObjects} of ${progress.totalObjects} objects`}
              </Text>
            </View>
          ) : null}

          <Button
            title={running ? 'Backing up...' : 'Back up now'}
            onPress={onBackupNow}
            disabled={running || !destinationId || recoveryKey.trim().length === 0}
          />
          <SectionHeader title="Scheduled backups" hint="Best effort; the OS decides the actual run time" />
          <Text style={styles.scheduleText}>{scheduleDecisionText(scheduleDecision)}</Text>
          <View style={styles.intervalRow}>
            {[6, 24, 168].map((hours) => (
              <Button
                key={hours}
                title={hours === 6 ? '6 hours' : hours === 24 ? 'Daily' : 'Weekly'}
                variant={scheduleIntervalHours === hours ? 'primary' : 'secondary'}
                onPress={() => setScheduleIntervalHours(hours)}
                disabled={scheduleBusy}
              />
            ))}
          </View>
          <Button
            title={scheduleBusy
              ? 'Saving schedule...'
              : scheduleConfig?.enabled ? 'Turn off scheduled backups' : 'Enable scheduled backups'}
            variant="secondary"
            onPress={scheduleConfig?.enabled ? onDisableSchedule : onEnableSchedule}
            disabled={scheduleBusy || (!scheduleConfig?.enabled && (!destinationId || !recoveryKey.trim()))}
          />
          <Button
            title="Run scheduled backup now"
            variant="secondary"
            onPress={onRunScheduledNow}
            disabled={running || !scheduleConfig?.enabled}
          />
          <HonestNotice text="The recovery key for scheduled backups is stored in this device’s secure storage. OS scheduling requires a development or production build with the native background-task modules. Back up now remains available on every build." />
          {result ? (
            <Text style={[styles.resultText, { color: result.ok ? c.success : c.danger }]}>{result.text}</Text>
          ) : null}
          <HonestNotice text={STORAGE_UI_COPY.notBackedUpUntilVerified} />
        </View>
      )}

      <View style={styles.panel}>
        <SectionHeader title="Backup history" />
        {backups.length === 0 ? (
          <Text style={styles.emptyBody}>No backup has been written yet.</Text>
        ) : (
          backups.map((backup) => <HistoryRow key={`${backup.backupId}:${backup.destinationId}`} backup={backup} />)
        )}
      </View>
    </ScrollView>
  );
}

function scheduleDecisionText(
  decision: ReturnType<typeof readStorageScheduleDecisions>[number] | null,
): string {
  if (decision === null) return 'Scheduled backups are off. No verified run has been recorded.';
  const last = decision.lastRunAt ? ` Last verified backup job: ${decision.lastRunAt}.` : ' No verified run has been recorded.';
  if (decision.reason === 'due') return `A backup is due now.${last}`;
  if (decision.reason === 'not_due') return `Next eligible run: ${decision.nextRunAt ?? 'unknown'}.${last}`;
  if (decision.reason === 'disabled') return `Scheduled backups are off.${last}`;
  return `Scheduled backup is paused: ${decision.reason.replaceAll('_', ' ')}.${last}`;
}

function phaseLabel(phase: BackupRunProgress['phase']): string {
  switch (phase) {
    case 'snapshotting':
      return 'Snapshotting';
    case 'encoding':
      return 'Encrypting';
    case 'writing':
      return 'Writing';
    case 'verifying':
      return 'Verifying';
    case 'complete':
      return 'Verified';
    case 'failed':
      return 'Failed';
  }
}

function phaseTone(phase: BackupRunProgress['phase']): 'info' | 'ok' | 'danger' {
  if (phase === 'complete') return 'ok';
  if (phase === 'failed') return 'danger';
  return 'info';
}

function TargetRow({
  target,
  selected,
  onSelect,
}: {
  target: StorageDestinationSummary;
  selected: boolean;
  onSelect: () => void;
}): React.ReactElement {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <View style={[styles.targetRow, selected && { borderColor: c.accent }]}>
      <View style={styles.targetText}>
        <Text style={styles.targetLabel}>{target.label}</Text>
        <Text style={styles.meta}>{target.name}</Text>
      </View>
      <Button title={selected ? 'Selected' : 'Select'} variant={selected ? 'primary' : 'secondary'} onPress={onSelect} />
    </View>
  );
}

function HistoryRow({ backup }: { backup: StorageBackupLine }): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyText}>
        <Text style={styles.historyId} numberOfLines={1}>{backup.backupId}</Text>
        <Text style={styles.meta}>
          {backup.objectCount} objects · {formatBytes(backup.encryptedBytes)}
          {backup.completedAt ? ` · ${backup.completedAt}` : ''}
        </Text>
      </View>
      <StatusChip label={backup.stateLabel} tone={backup.tone} />
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
  emptyBody: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
  input: {
    minHeight: 46,
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.text,
    fontFamily: MK_MONO,
    fontSize: 13,
  },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressText: { color: c.textSecondary, fontSize: 13 },
  resultText: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  scheduleText: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  intervalRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderRadius: MK_RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  targetText: { flex: 1, minWidth: 0, gap: 2 },
  targetLabel: { color: c.text, fontSize: 14, fontWeight: '700' },
  meta: { color: c.textTertiary, fontSize: 12 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyText: { flex: 1, minWidth: 0, gap: 2 },
  historyId: { color: c.text, fontSize: 13, fontWeight: '600' },
});
