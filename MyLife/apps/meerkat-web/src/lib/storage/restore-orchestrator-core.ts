import {
  BackupDecodeError,
  openBackupManifest,
  verifyAndDecryptBackupChunk,
  verifyBackupIdentityChunk,
} from '@mylife/sync/src/storage/backup-format';
import {
  createRestoreController,
  reduceRestoreController,
  type RestoreControllerEvent,
  type RestoreControllerState,
  type RestorePlan,
  type RestoreChunkRequirement,
} from '@mylife/sync/src/storage/restore-controller';
import type { RemoteBackupCandidate } from '@mylife/sync/src/storage/remote-backups';

const BACKUP_ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/u;

export interface RestoreDiscoveryChoice {
  destinationId: string;
  backupId: string;
  createdAt: string;
  locatorJson: string;
  manifestObjectId: string;
  manifestEncryptedBytes: number;
}

/** Converts provider discovery into the exact input the restore wizard opens. */
export function consumeRemoteBackupDiscovery(
  destinationId: string,
  backups: readonly RemoteBackupCandidate[],
): RestoreDiscoveryChoice[] {
  if (!BACKUP_ID_PATTERN.test(destinationId)) {
    throw new Error('The restore destination id is not safe.');
  }
  return backups.map((backup) => {
    assertSafeRestoreBackupId(backup.backupId);
    return {
      destinationId,
      backupId: backup.backupId,
      createdAt: backup.createdAt,
      locatorJson: backup.locatorJson,
      manifestObjectId: backup.manifestObjectId,
      manifestEncryptedBytes: backup.manifestEncryptedBytes,
    };
  });
}

export function assertSafeRestoreBackupId(backupId: string): void {
  if (!BACKUP_ID_PATTERN.test(backupId) || backupId === '.' || backupId === '..') {
    throw new Error('The restore backup id is not safe.');
  }
}

export interface RestoreEncryptedSource {
  readChunk(requirement: RestoreChunkRequirement): Promise<Uint8Array | null>;
  readIdentityChunk(): Promise<Uint8Array | null>;
}

export interface RestoreCheckResult {
  passed: boolean;
  report: string;
}

export type RestoreActivationResult =
  | {
    activated: true;
    report: string;
    rollbackRetained: boolean;
    hadPriorData: boolean;
  }
  | {
    activated: false;
    report: string;
    rollbackSucceeded: boolean;
    hadPriorData: boolean;
  };

export interface RestorePlatformDriver {
  resetStaging(plan: RestorePlan): Promise<void>;
  writeVerifiedChunk(requirement: RestoreChunkRequirement, plaintext: Uint8Array): Promise<void>;
  writeVerifiedIdentity?(sealedRecoveryBundle: string): Promise<void>;
  rebuildStagedDatabase(plan: RestorePlan): Promise<void>;
  checkStagedIntegrity(plan: RestorePlan): Promise<RestoreCheckResult>;
  rehearseStagedMigrations(plan: RestorePlan): Promise<RestoreCheckResult>;
  checkIdentityConsistency?(sealedRecoveryBundle: string): Promise<{
    consistent: boolean;
    report: string;
  }>;
  activate(plan: RestorePlan): Promise<RestoreActivationResult>;
}

export interface RunStagedRestoreInput {
  plan: RestorePlan;
  destinationId: string;
  locatorJson: string;
  manifestEnvelope: Uint8Array;
  recoveryKey: string;
  source: RestoreEncryptedSource;
  driver: RestorePlatformDriver;
  listedBackupIds?: readonly string[];
  onStateChange?(state: RestoreControllerState, event: RestoreControllerEvent): void;
}

export interface StagedRestoreExecutionResult {
  state: RestoreControllerState;
  activation: RestoreActivationResult | null;
}

function transition(
  state: RestoreControllerState,
  event: RestoreControllerEvent,
  onStateChange?: RunStagedRestoreInput['onStateChange'],
): RestoreControllerState {
  const next = reduceRestoreController(state, event);
  onStateChange?.(next, event);
  return next;
}

function fail(
  state: RestoreControllerState,
  code: 'missing_chunk' | 'staging_failed' | 'activation_failed',
  message: string,
  onStateChange?: RunStagedRestoreInput['onStateChange'],
  chunkId?: string,
): RestoreControllerState {
  return transition(state, {
    type: 'fail',
    reason: { code, message, ...(chunkId === undefined ? {} : { chunkId }) },
  }, onStateChange);
}

function failureMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function runStagedRestore(
  input: RunStagedRestoreInput,
): Promise<StagedRestoreExecutionResult> {
  assertSafeRestoreBackupId(input.plan.backupId);
  let state = createRestoreController(input.plan);
  let backupRootKey: Uint8Array | null = null;
  let sealedRecoveryBundle: string | null = null;

  try {
    try {
      await input.driver.resetStaging(input.plan);
    } catch (error) {
      state = fail(
        state,
        'staging_failed',
        failureMessage(error, 'Restore staging could not be prepared.'),
        input.onStateChange,
      );
      return { state, activation: null };
    }

    state = transition(state, {
      type: 'destination_selected',
      destinationId: input.destinationId,
    }, input.onStateChange);
    if (state.stage === 'failed') return { state, activation: null };

    state = transition(state, {
      type: 'locators_listed',
      backupIds: input.listedBackupIds ?? [input.plan.backupId],
      selectedBackupId: input.plan.backupId,
    }, input.onStateChange);
    if (state.stage === 'failed') return { state, activation: null };

    const opened = openBackupManifest(
      input.locatorJson,
      input.manifestEnvelope,
      input.recoveryKey,
    );
    if (opened.ok) backupRootKey = opened.backupRootKey;
    state = transition(state, { type: 'manifest_open_result', result: opened }, input.onStateChange);
    if (!opened.ok || state.stage === 'failed') return { state, activation: null };

    for (const requirement of input.plan.requiredChunks) {
      let envelope: Uint8Array | null;
      try {
        envelope = await input.source.readChunk(requirement);
      } catch (error) {
        state = fail(
          state,
          'staging_failed',
          failureMessage(error, 'A restore chunk could not be read.'),
          input.onStateChange,
          requirement.chunkId,
        );
        return { state, activation: null };
      }
      const verified = envelope === null
        ? {
          ok: false as const,
          error: new BackupDecodeError(
            'missing_chunk',
            'A required backup chunk is missing.',
            requirement.chunkId,
          ),
        }
        : verifyAndDecryptBackupChunk(
          opened.backupRootKey,
          opened.manifest,
          requirement.target,
          envelope,
        );
      if (!verified.ok) {
        state = transition(state, {
          type: 'chunk_verification_result',
          chunkId: requirement.chunkId,
          result: verified,
        }, input.onStateChange);
        return { state, activation: null };
      }
      try {
        await input.driver.writeVerifiedChunk(requirement, verified.plaintext);
        state = transition(state, {
          type: 'chunk_verification_result',
          chunkId: requirement.chunkId,
          result: verified,
        }, input.onStateChange);
      } catch (error) {
        state = fail(
          state,
          'staging_failed',
          failureMessage(error, 'A verified restore chunk could not be staged.'),
          input.onStateChange,
          requirement.chunkId,
        );
        return { state, activation: null };
      } finally {
        verified.plaintext.fill(0);
      }
    }

    if (input.plan.includesIdentity) {
      let identityEnvelope: Uint8Array | null;
      try {
        identityEnvelope = await input.source.readIdentityChunk();
      } catch (error) {
        state = fail(
          state,
          'staging_failed',
          failureMessage(error, 'The identity recovery chunk could not be read.'),
          input.onStateChange,
          input.plan.identityChunkId ?? undefined,
        );
        return { state, activation: null };
      }
      const verifiedIdentity = identityEnvelope === null
        ? {
          ok: false as const,
          error: new BackupDecodeError(
            'missing_chunk',
            'The identity recovery chunk is missing.',
            input.plan.identityChunkId ?? undefined,
          ),
        }
        : verifyBackupIdentityChunk(opened.manifest, identityEnvelope);
      if (verifiedIdentity.ok) {
        sealedRecoveryBundle = verifiedIdentity.sealedRecoveryBundle;
        try {
          await input.driver.writeVerifiedIdentity?.(sealedRecoveryBundle);
        } catch (error) {
          state = fail(
            state,
            'staging_failed',
            failureMessage(error, 'The verified identity recovery chunk could not be staged.'),
            input.onStateChange,
            input.plan.identityChunkId ?? undefined,
          );
          return { state, activation: null };
        }
      }
      state = transition(state, {
        type: 'identity_bundle_result',
        result: verifiedIdentity,
      }, input.onStateChange);
      if (!verifiedIdentity.ok || state.stage === 'failed') return { state, activation: null };
    }

    try {
      await input.driver.rebuildStagedDatabase(input.plan);
    } catch (error) {
      state = fail(
        state,
        'staging_failed',
        failureMessage(error, 'The verified database chunks could not be rebuilt.'),
        input.onStateChange,
      );
      return { state, activation: null };
    }

    let integrity: RestoreCheckResult;
    try {
      integrity = await input.driver.checkStagedIntegrity(input.plan);
    } catch (error) {
      integrity = { passed: false, report: failureMessage(error, 'integrity_check failed to run') };
    }
    state = transition(state, {
      type: 'integrity_check_result',
      passed: integrity.passed,
      report: integrity.report,
    }, input.onStateChange);
    if (state.stage === 'failed') return { state, activation: null };

    let rehearsal: RestoreCheckResult;
    try {
      rehearsal = await input.driver.rehearseStagedMigrations(input.plan);
    } catch (error) {
      rehearsal = { passed: false, report: failureMessage(error, 'migration rehearsal failed to run') };
    }
    state = transition(state, {
      type: 'migration_rehearsal_result',
      passed: rehearsal.passed,
      report: rehearsal.report,
    }, input.onStateChange);
    if (state.stage === 'failed') return { state, activation: null };

    if (input.plan.includesIdentity) {
      const identityCheck = input.driver.checkIdentityConsistency && sealedRecoveryBundle !== null
        ? await input.driver.checkIdentityConsistency(sealedRecoveryBundle)
        : { consistent: false, report: 'Identity consistency verification is unavailable.' };
      state = transition(state, {
        type: 'identity_consistency_result',
        consistent: identityCheck.consistent,
        report: identityCheck.report,
      }, input.onStateChange);
      if (state.stage === 'failed') return { state, activation: null };
    }

    let activation: RestoreActivationResult;
    try {
      activation = await input.driver.activate(input.plan);
    } catch (error) {
      const report = failureMessage(error, 'Restore activation failed before rollback could be confirmed.');
      state = transition(state, {
        type: 'activation_failed',
        report,
        rollbackSucceeded: false,
      }, input.onStateChange);
      return {
        state,
        activation: {
          activated: false,
          report,
          rollbackSucceeded: false,
          hadPriorData: false,
        },
      };
    }
    state = transition(state, {
      type: 'activation_result',
      activated: activation.activated,
      report: activation.report,
      ...(activation.activated ? {} : { rollbackSucceeded: activation.rollbackSucceeded }),
    }, input.onStateChange);
    return { state, activation };
  } finally {
    backupRootKey?.fill(0);
    sealedRecoveryBundle = null;
  }
}
