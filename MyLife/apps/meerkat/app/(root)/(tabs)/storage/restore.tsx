// Restore from a backup (Plan 41 WP-41B3). The wizard drives the REAL staged
// restore controller: pick a destination, list its complete backups, open the
// chosen backup's manifest with your recovery key, show the REQUIRED exact
// restore summary and the identity replacement warning, then stage every chunk
// (verify-before-write) and activate atomically. A wrong key, corrupt chunk,
// integrity failure, or migration failure cannot touch the active database; the
// terminal state shows the true typed reason and reassures that current data was
// left untouched.

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createRestorePlan,
  listRemoteBackups,
  openBackupManifest,
  parseRecoveryKey,
  type BackupManifest,
} from '@mylife/sync';
import type { RestoreControllerState } from '@mylife/sync/src/storage/restore-controller';
import { Button, HonestNotice, SectionHeader } from '../../components/kit';
import { StorageHeader, toneColor } from '../../components/StorageKit';
import { useStorage } from '../../providers/StorageProvider';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import { getSetting } from '../../data/db';
import {
  STORAGE_RESTORE_COPY,
  STORAGE_UI_COPY,
  buildBackupLine,
  buildRestoreProgressViewModel,
  buildRestoreSummaryViewModel,
  buildStorageHubViewModel,
  type RestoreStepLine,
  type RestoreSummaryViewModel,
  type StorageDestinationSummary,
} from '../../data/storage-destinations/storage-ui-core';
import { backupLocatorSettingKey } from '../../data/storage-destinations/local-backup-run';
import { createAdapterRestoreSource, readBackupManifestEnvelope } from '../../data/storage-destinations/local-restore-source';
import { runMobileLocalRestore } from '../../data/local-restore';
import {
  consumeRemoteBackupDiscovery,
  type RestoreDiscoveryChoice,
} from '../../data/storage-destinations/restore-orchestrator-core';
import { MK_MONO, MK_RADIUS, formatBytes, type MkColors } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';

type Phase = 'pick' | 'summary' | 'running';

interface WizardBackupChoice extends RestoreDiscoveryChoice {
  destinationLabel: string;
  objectCount: number | null;
  encryptedBytes: number;
  trackedComplete: boolean;
}

export default function RestoreScreen(): React.ReactElement {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const { diagnostics, router: storageRouter, registry, refresh } = useStorage();

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const vm = useMemo(() => buildStorageHubViewModel(diagnostics), [diagnostics]);
  const trackedRestorable = useMemo(
    () => diagnostics.backups
      .filter((backup) => backup.state === 'complete')
      .map((backup) => ({
        backup: buildBackupLine(backup),
        destination: vm.destinations.find((d) => d.id === backup.destinationId) ?? null,
      }))
      .filter((row): row is { backup: typeof row.backup; destination: StorageDestinationSummary } => row.destination !== null),
    [diagnostics.backups, vm.destinations],
  );

  const [phase, setPhase] = useState<Phase>('pick');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [selected, setSelected] = useState<{ destinationId: string; backupId: string } | null>(null);
  const [summary, setSummary] = useState<RestoreSummaryViewModel | null>(null);
  const [restoreState, setRestoreState] = useState<RestoreControllerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remoteChoices, setRemoteChoices] = useState<RestoreDiscoveryChoice[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryIssue, setDiscoveryIssue] = useState<string | null>(null);
  const [discoveryRun, setDiscoveryRun] = useState(0);
  const latestDiscoveryRunRef = React.useRef(0);
  const manifestRef = React.useRef<BackupManifest | null>(null);
  const envelopeRef = React.useRef<Uint8Array | null>(null);
  const locatorRef = React.useRef<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    latestDiscoveryRunRef.current = discoveryRun;
    setDiscovering(true);
    setDiscoveryIssue(null);
    void (async () => {
      const choices: RestoreDiscoveryChoice[] = [];
      let issueCount = 0;
      for (const destination of storageRouter.listDestinations()) {
        if (destination.state !== 'ready' && destination.state !== 'degraded') continue;
        const adapter = registry.resolveRouterDestination(destination);
        if (adapter === null) continue;
        try {
          if (destination.credential_ref) {
            const authorization = await adapter.authorize({
              kind: destination.credential_ref.startsWith('broker://oauth/')
                ? 'broker_vault' : 'stored_credential',
              credentialRef: destination.credential_ref,
            });
            if (authorization.kind !== 'authorized') throw new Error('authorization_required');
          }
          const result = await listRemoteBackups(adapter);
          choices.push(...consumeRemoteBackupDiscovery(destination.id, result.backups));
          issueCount += result.issues.length;
        } catch {
          issueCount += 1;
        }
      }
      if (!active || latestDiscoveryRunRef.current !== discoveryRun) return;
      setRemoteChoices(choices);
      setDiscoveryIssue(issueCount > 0
        ? `${issueCount} remote backup ${issueCount === 1 ? 'record needs' : 'records need'} attention. Only valid locators with a present, hash-matching manifest are shown.`
        : null);
      setDiscovering(false);
    })();
    return () => { active = false; };
  }, [storageRouter, registry, discoveryRun]));

  const restorable = useMemo(() => {
    const choices = new Map<string, WizardBackupChoice>();
    for (const remote of remoteChoices) {
      const destination = vm.destinations.find((item) => item.id === remote.destinationId);
      if (destination === undefined) continue;
      choices.set(`${remote.destinationId}:${remote.backupId}`, {
        ...remote,
        destinationLabel: destination.label,
        objectCount: null,
        encryptedBytes: remote.manifestEncryptedBytes,
        trackedComplete: false,
      });
    }
    for (const { backup, destination } of trackedRestorable) {
      const key = `${backup.destinationId}:${backup.backupId}`;
      const discovered = choices.get(key);
      choices.set(key, discovered === undefined ? {
        destinationId: backup.destinationId,
        backupId: backup.backupId,
        createdAt: backup.completedAt ?? '',
        locatorJson: '',
        manifestObjectId: '',
        manifestEncryptedBytes: backup.encryptedBytes,
        destinationLabel: destination.label,
        objectCount: backup.objectCount,
        encryptedBytes: backup.encryptedBytes,
        trackedComplete: true,
      } : {
        ...discovered,
        objectCount: backup.objectCount,
        encryptedBytes: backup.encryptedBytes,
        trackedComplete: true,
      });
    }
    return [...choices.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [remoteChoices, trackedRestorable, vm.destinations]);

  // Open the chosen backup's manifest with the recovery key, then show the
  // required exact summary. A wrong key fails here, before any staging.
  const onPreview = useCallback((choice: WizardBackupChoice) => {
    const recoveryBytes = parseRecoveryKey(recoveryKey.trim());
    if (!recoveryBytes) {
      setError('That recovery key is not valid. It starts with MKR1.');
      return;
    }
    recoveryBytes.fill(0);
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const { destinationId, backupId } = choice;
        const destination = storageRouter.getDestination(destinationId);
        const adapter = destination ? registry.resolveRouterDestination(destination) : null;
        if (!adapter) throw new Error('This destination is not available on this device.');
        if (destination?.credential_ref) {
          const authorization = await adapter.authorize({
            kind: destination.credential_ref.startsWith('broker://oauth/')
              ? 'broker_vault' : 'stored_credential',
            credentialRef: destination.credential_ref,
          });
          if (authorization.kind !== 'authorized') throw new Error('This destination needs to be reconnected.');
        }
        const locatorJson = choice.locatorJson
          || getSetting(db, backupLocatorSettingKey(destinationId, backupId));
        if (!locatorJson) {
          throw new Error('This tracked backup has no discoverable locator. Refresh remote backups or reconnect its destination.');
        }
        const envelope = await readBackupManifestEnvelope(
          adapter,
          backupId,
          choice.manifestObjectId || undefined,
        );
        const opened = openBackupManifest(locatorJson, envelope, recoveryKey.trim());
        if (!opened.ok) {
          // Drop the transient root key material immediately.
          throw new Error(restoreOpenMessage(opened.error.code));
        }
        opened.backupRootKey.fill(0);
        const plan = createRestorePlan(opened.manifest, { mode: 'complete' });
        manifestRef.current = opened.manifest;
        envelopeRef.current = envelope;
        locatorRef.current = locatorJson;
        setSelected({ destinationId, backupId });
        setSummary(buildRestoreSummaryViewModel(plan));
        setRestoreState(null);
        setPhase('summary');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not open this backup.');
      } finally {
        setBusy(false);
      }
    })();
  }, [recoveryKey, db, storageRouter, registry]);

  // Synchronous single-flight: two fast taps land before the busy re-render
  // and would race two staged restores against one staging area.
  const restoreInFlightRef = React.useRef(false);
  const onRunRestore = useCallback(() => {
    if (restoreInFlightRef.current) return;
    if (!selected || !manifestRef.current || !envelopeRef.current || !locatorRef.current) return;
    restoreInFlightRef.current = true;
    setBusy(true);
    setError(null);
    setPhase('running');
    void (async () => {
      try {
        const destination = storageRouter.getDestination(selected.destinationId);
        const adapter = destination ? registry.resolveRouterDestination(destination) : null;
        if (!adapter) throw new Error('This destination is not available on this device.');
        const plan = createRestorePlan(manifestRef.current!, { mode: 'complete' });
        const outcome = await runMobileLocalRestore({
          plan,
          destinationId: selected.destinationId,
          locatorJson: locatorRef.current!,
          manifestEnvelope: envelopeRef.current!,
          recoveryKey: recoveryKey.trim(),
          source: createAdapterRestoreSource(adapter, plan.backupId),
          listedBackupIds: restorable.map((choice) => choice.backupId),
        });
        setRestoreState(outcome.state);
      } catch (err) {
        // A setup throw before the controller produced any state would strand
        // the screen on 'running' with no progress panel and no buttons; drop
        // back to the summary so the error renders next to a retry.
        setError(err instanceof Error ? err.message : 'The restore could not run. Your current data was not touched.');
        setPhase('summary');
      } finally {
        restoreInFlightRef.current = false;
        setBusy(false);
        refresh();
      }
    })();
  }, [selected, recoveryKey, storageRouter, registry, refresh, restorable]);

  const progress = restoreState ? buildRestoreProgressViewModel(restoreState) : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }]}
    >
      <StorageHeader title={STORAGE_RESTORE_COPY.wizardTitle} subtitle="Bring back your data from a verified backup" />

      {phase === 'pick' ? (
        <>
          <View style={styles.panel}>
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
          </View>

          <View style={styles.panel}>
            <SectionHeader title="Choose a backup" hint="Only discoverable backups with a verified manifest are shown" />
            <Text style={styles.meta}>{STORAGE_RESTORE_COPY.remoteDiscovery}</Text>
            <Button
              title={discovering ? 'Finding remote backups...' : 'Refresh remote backups'}
              variant="secondary"
              onPress={() => setDiscoveryRun((value) => value + 1)}
              disabled={discovering}
            />
            {restorable.length === 0 ? (
              <Text style={styles.emptyBody}>No complete backup is available to restore.</Text>
            ) : (
              restorable.map((choice) => (
                <BackupChoice
                  key={`${choice.destinationId}:${choice.backupId}`}
                  choice={choice}
                  busy={busy}
                  disabled={recoveryKey.trim().length === 0}
                  onSelect={() => onPreview(choice)}
                />
              ))
            )}
            {discoveryIssue ? <Text style={styles.error}>{discoveryIssue}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </>
      ) : null}

      {phase !== 'pick' && summary ? (
        <View style={styles.panel}>
          <SectionHeader title={STORAGE_RESTORE_COPY.summaryHeading} />
          {summary.rows.map((row) => (
            <View key={row.label} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{row.label}</Text>
              <Text style={styles.summaryDetail}>{row.detail}</Text>
            </View>
          ))}
          <Text style={styles.summaryMeta}>
            {summary.objectCount} objects · {formatBytes(summary.totalEncryptedBytes)} encrypted
          </Text>
          {summary.identityReplacementWarning ? (
            <View style={styles.warnCard}>
              <Text style={styles.warnText}>{summary.identityReplacementWarning}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === 'summary' ? (
        <View style={styles.panel}>
          <SectionHeader title={STORAGE_RESTORE_COPY.activationHeading} />
          <HonestNotice text={STORAGE_UI_COPY.restoreUntouchedOnFailure} />
          <Button title={busy ? 'Starting...' : 'Restore this backup'} onPress={onRunRestore} disabled={busy} />
          <Button title="Choose a different backup" variant="secondary" onPress={() => setPhase('pick')} disabled={busy} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}

      {phase === 'running' && progress ? (
        <View style={styles.panel}>
          <SectionHeader title="Restoring" />
          {progress.steps.map((step) => <StepRow key={step.stage} step={step} />)}
          <Text style={styles.summaryMeta}>
            {progress.verifiedChunkCount} of {progress.requiredChunkCount} chunks verified
          </Text>
          {progress.outcome === 'succeeded' ? (
            <ResultCard tone="ok" title={STORAGE_RESTORE_COPY.successTitle} body={progress.report ?? 'Restore complete.'} />
          ) : null}
          {progress.outcome === 'rolled_back' ? (
            <ResultCard tone="warn" title={STORAGE_RESTORE_COPY.rolledBackTitle} body={STORAGE_RESTORE_COPY.rolledBackBody} />
          ) : null}
          {progress.outcome === 'failed' ? (
            <ResultCard
              tone="danger"
              title={STORAGE_RESTORE_COPY.failedTitle}
              body={`${progress.failure?.message ?? 'Restore failed.'}${progress.failure?.chunkId ? `\nChunk: ${progress.failure.chunkId}` : ''}${progress.activeDataUntouched ? `\n${STORAGE_RESTORE_COPY.failedUntouched}` : ''}`}
            />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function restoreOpenMessage(code: string): string {
  switch (code) {
    case 'wrong_key':
      return 'The recovery key could not open this backup. Check for typos.';
    case 'bad_signature':
      return 'The backup manifest signature is invalid. It may be tampered.';
    case 'locator_mismatch':
      return 'The stored locator does not match this backup.';
    case 'unsupported_version':
      return 'This backup format version is not supported.';
    default:
      return 'This backup could not be opened.';
  }
}

function BackupChoice({
  choice,
  busy,
  disabled,
  onSelect,
}: {
  choice: WizardBackupChoice;
  busy: boolean;
  disabled: boolean;
  onSelect: () => void;
}): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.choiceRow}>
      <View style={styles.choiceText}>
        <Text style={styles.choiceId} numberOfLines={1}>{choice.backupId}</Text>
        <Text style={styles.meta}>
          {choice.destinationLabel}
          {choice.objectCount === null ? ' · Remote locator verified' : ` · ${choice.objectCount} objects`}
          {` · ${formatBytes(choice.encryptedBytes)}`}
          {choice.createdAt ? ` · ${choice.createdAt}` : ''}
        </Text>
      </View>
      <Button title="Open" variant="secondary" onPress={onSelect} disabled={busy || disabled} />
    </View>
  );
}

function StepRow({ step }: { step: RestoreStepLine }): React.ReactElement {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const color = step.tone === 'done'
    ? c.success
    : step.tone === 'active'
      ? c.info
      : step.tone === 'danger'
        ? c.danger
        : c.textTertiary;
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepDot, { backgroundColor: color }]} />
      <Text style={[styles.stepLabel, { color: step.tone === 'pending' ? c.textTertiary : c.text }]}>{step.label}</Text>
    </View>
  );
}

function ResultCard({ tone, title, body }: { tone: 'ok' | 'warn' | 'danger'; title: string; body: string }): React.ReactElement {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const edge = toneColor(tone, c);
  const tint = tone === 'ok' ? c.successSoft : tone === 'warn' ? c.warningSoft : c.dangerSoft;
  return (
    <View style={[styles.resultCard, { backgroundColor: tint, borderColor: edge }]}>
      <Text style={[styles.resultTitle, { color: edge }]}>{title}</Text>
      <Text style={styles.resultBody}>{body}</Text>
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
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  choiceText: { flex: 1, minWidth: 0, gap: 2 },
  choiceId: { color: c.text, fontSize: 13, fontWeight: '600' },
  meta: { color: c.textTertiary, fontSize: 12 },
  error: { color: c.danger, fontSize: 13, fontWeight: '600' },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 5,
  },
  summaryLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  summaryDetail: { flex: 1, textAlign: 'right', color: c.text, fontSize: 13 },
  summaryMeta: { color: c.textTertiary, fontSize: 12 },
  warnCard: {
    backgroundColor: c.warningSoft,
    borderColor: c.warning,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 12,
  },
  warnText: { color: c.warning, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  stepDot: { width: 10, height: 10, borderRadius: 5 },
  stepLabel: { fontSize: 14 },
  resultCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 12,
    gap: 4,
  },
  resultTitle: { fontSize: 15, fontWeight: '800' },
  resultBody: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
});
