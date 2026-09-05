import { describe, expect, it } from 'vitest';
import {
  encodeBackup,
  openBackupManifest,
  verifyAndDecryptBackupChunk,
  verifyBackupIdentityChunk,
  type EncodedBackup,
  type OpenBackupManifestResult,
} from '../backup-format';
import {
  createRestoreController,
  createRestorePlan,
  reduceRestoreController,
  type RestoreControllerState,
  type RestorePlan,
} from '../restore-controller';
import { VECTOR_BACKUP_INPUT, VECTOR_RECOVERY_KEY } from '../test-vectors';
import { encodeRecoveryKey } from '../../node/recovery-key';

interface RestoreFixture {
  encoded: EncodedBackup;
  opened: Extract<OpenBackupManifestResult, { ok: true }>;
  plan: RestorePlan;
}

function fixture(): RestoreFixture {
  const encoded = encodeBackup(VECTOR_BACKUP_INPUT);
  const opened = openBackupManifest(
    encoded.locatorJson,
    encoded.manifest.envelope,
    VECTOR_RECOVERY_KEY,
  );
  if (!opened.ok) throw opened.error;
  return {
    encoded,
    opened,
    plan: createRestorePlan(opened.manifest, { mode: 'complete' }),
  };
}

function enterManifestOpen(plan: RestorePlan): RestoreControllerState {
  let state = createRestoreController(plan);
  state = reduceRestoreController(state, {
    type: 'destination_selected',
    destinationId: 'drive',
  });
  return reduceRestoreController(state, {
    type: 'locators_listed',
    backupIds: [plan.backupId],
  });
}

function chunkEnvelope(
  encoded: EncodedBackup,
  requirement: RestorePlan['requiredChunks'][number],
): Uint8Array {
  const target = requirement.target;
  if (target.kind === 'database') {
    const chunk = encoded.databaseChunks[target.index];
    if (chunk === undefined) throw new Error('database fixture chunk is missing');
    return chunk.envelope;
  }
  const chunk = encoded.objectChunks.find((candidate) => (
    candidate.objectId === target.objectId
    && candidate.index === target.index
  ));
  if (chunk === undefined) throw new Error('object fixture chunk is missing');
  return chunk.envelope;
}

function advanceToStaged(value: RestoreFixture): RestoreControllerState {
  let state = enterManifestOpen(value.plan);
  state = reduceRestoreController(state, {
    type: 'manifest_open_result',
    result: value.opened,
  });
  try {
    for (const requirement of value.plan.requiredChunks) {
      state = reduceRestoreController(state, {
        type: 'chunk_verification_result',
        chunkId: requirement.chunkId,
        result: verifyAndDecryptBackupChunk(
          value.opened.backupRootKey,
          value.opened.manifest,
          requirement.target,
          chunkEnvelope(value.encoded, requirement),
        ),
      });
    }
    const identityChunk = value.encoded.identityChunk;
    if (identityChunk === null) throw new Error('identity fixture chunk is missing');
    state = reduceRestoreController(state, {
      type: 'identity_bundle_result',
      result: verifyBackupIdentityChunk(value.opened.manifest, identityChunk.envelope),
    });
    return state;
  } finally {
    value.opened.backupRootKey.fill(0);
  }
}

function advanceToAwaitingActivation(value: RestoreFixture): RestoreControllerState {
  let state = advanceToStaged(value);
  state = reduceRestoreController(state, {
    type: 'integrity_check_result',
    passed: true,
    report: 'ok',
  });
  state = reduceRestoreController(state, {
    type: 'identity_consistency_result',
    consistent: true,
    report: 'keypair matches',
  });
  return reduceRestoreController(state, {
    type: 'migration_rehearsal_result',
    passed: true,
    report: 'migrations pass',
  });
}

describe('createRestorePlan', () => {
  it('builds database-only and objects-only plans with dependency warnings', () => {
    // Arrange
    const value = fixture();

    // Act
    const databaseOnly = createRestorePlan(value.opened.manifest, { mode: 'database_only' });
    const objectsOnly = createRestorePlan(value.opened.manifest, { mode: 'objects_only' });
    value.opened.backupRootKey.fill(0);

    // Assert
    expect(databaseOnly.requiredChunks.every((chunk) => chunk.target.kind === 'database')).toBe(true);
    expect(databaseOnly.warnings.map((warning) => warning.code)).toContain('objects_not_selected');
    expect(objectsOnly.requiredChunks.every((chunk) => chunk.target.kind === 'object')).toBe(true);
    expect(objectsOnly.warnings.map((warning) => warning.code)).toContain('database_not_selected');
  });
});

describe('restore controller evidence gates', () => {
  it('reaches awaiting_activation only after every required evidence gate passes', () => {
    // Arrange
    const value = fixture();

    // Act
    const state = advanceToAwaitingActivation(value);

    // Assert
    expect(state.stage).toBe('awaiting_activation');
    expect(Object.keys(state.verifiedChunks)).toHaveLength(value.plan.requiredChunks.length);
    expect(state.integrityCheck?.passed).toBe(true);
    expect(state.migrationRehearsal?.passed).toBe(true);
    expect(state.identityConsistency?.consistent).toBe(true);
  });

  it('fails on a corrupt chunk without reaching activation readiness', () => {
    // Arrange
    const value = fixture();
    let state = enterManifestOpen(value.plan);
    state = reduceRestoreController(state, { type: 'manifest_open_result', result: value.opened });
    const requirement = value.plan.requiredChunks[0];
    if (requirement === undefined) throw new Error('restore fixture has no chunks');
    const corrupt = chunkEnvelope(value.encoded, requirement).slice();
    corrupt[corrupt.length - 1] = (corrupt[corrupt.length - 1] ?? 0) ^ 0xff;

    // Act
    state = reduceRestoreController(state, {
      type: 'chunk_verification_result',
      chunkId: requirement.chunkId,
      result: verifyAndDecryptBackupChunk(
        value.opened.backupRootKey,
        value.opened.manifest,
        requirement.target,
        corrupt,
      ),
    });
    value.opened.backupRootKey.fill(0);

    // Assert
    expect(state.stage).toBe('failed');
    expect(state.failure?.code).toBe('corrupt_chunk');
    expect(state.activationReport).toBeNull();
  });

  it('fails on a wrong recovery key without reaching chunk verification', () => {
    // Arrange
    const value = fixture();
    let state = enterManifestOpen(value.plan);
    const wrongKey = encodeRecoveryKey(new Uint8Array(32).fill(0xff));
    const wrongResult = openBackupManifest(
      value.encoded.locatorJson,
      value.encoded.manifest.envelope,
      wrongKey,
    );

    // Act
    state = reduceRestoreController(state, { type: 'manifest_open_result', result: wrongResult });
    value.opened.backupRootKey.fill(0);

    // Assert
    expect(state.stage).toBe('failed');
    expect(state.failure?.code).toBe('wrong_key');
    expect(state.manifestSignature).toBeNull();
  });

  it('fails when SQLite integrity_check fails', () => {
    // Arrange
    const value = fixture();
    const staged = advanceToStaged(value);

    // Act
    const state = reduceRestoreController(staged, {
      type: 'integrity_check_result',
      passed: false,
      report: 'row 7 malformed',
    });

    // Assert
    expect(state.stage).toBe('failed');
    expect(state.failure).toMatchObject({
      code: 'integrity_check_failed',
      report: 'row 7 malformed',
    });
  });

  it('fails when migration rehearsal fails', () => {
    // Arrange
    const value = fixture();
    let state = advanceToStaged(value);
    state = reduceRestoreController(state, {
      type: 'integrity_check_result',
      passed: true,
      report: 'ok',
    });

    // Act
    state = reduceRestoreController(state, {
      type: 'migration_rehearsal_result',
      passed: false,
      report: 'migration 42 rejected',
    });

    // Assert
    expect(state.stage).toBe('failed');
    expect(state.failure).toMatchObject({
      code: 'migration_rehearsal_failed',
      report: 'migration 42 rejected',
    });
  });

  it('fails when recovered identity consistency is rejected', () => {
    // Arrange
    const value = fixture();
    let state = advanceToStaged(value);
    state = reduceRestoreController(state, {
      type: 'integrity_check_result',
      passed: true,
      report: 'ok',
    });

    // Act
    state = reduceRestoreController(state, {
      type: 'identity_consistency_result',
      consistent: false,
      report: 'public and private keys differ',
    });

    // Assert
    expect(state.stage).toBe('failed');
    expect(state.failure).toMatchObject({
      code: 'identity_inconsistent',
      report: 'public and private keys differ',
    });
  });

  it('enters rolled_back when activation fails and rollback succeeds', () => {
    // Arrange
    const value = fixture();
    const awaiting = advanceToAwaitingActivation(value);

    // Act
    const state = reduceRestoreController(awaiting, {
      type: 'activation_failed',
      report: 'boot verification failed; prior database restored',
      rollbackSucceeded: true,
    });

    // Assert
    expect(state.stage).toBe('rolled_back');
    expect(state.rollbackReport).toContain('prior database restored');
    expect(state.failure?.code).toBe('activation_failed');
  });
});
