/**
 * Metadata-only hosted storage lifecycle for Plan 44.
 *
 * PostgreSQL owns quota, reservations, object references, and manifests. Object
 * bytes never cross this contract or enter PostgreSQL. A production object-store
 * adapter issues upload targets, observes immutable object metadata, and deletes
 * versions; the metadata store commits only observations that match a live fence.
 */

export type HostedStorageReservationState =
  | 'reserved'
  | 'staged'
  | 'activated'
  | 'released'
  | 'expired'
  | 'failed';

export interface HostedStoragePolicy {
  policyVersion: number;
  maxObjectBytes: number;
  maxObjectCount: number;
  maxConcurrentReservations: number;
  reservationTtlSeconds: number;
  retentionDays: number;
}

export interface HostedStorageTenant {
  subjectId: string;
  capBytes: number;
  reservedBytes: number;
  committedBytes: number;
  lifecycleVersion: number;
  updatedAt: string;
  policy: HostedStoragePolicy;
}

export interface HostedStorageReservation {
  reservationId: string;
  subjectId: string;
  contentId: string;
  blockIndex: number;
  objectKey: string;
  checksum: string;
  sizeBytes: number;
  state: HostedStorageReservationState;
  fencingToken: number;
  lifecycleVersion: number;
  expiresAt: string;
  stagedAt: string | null;
  activatedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HostedStorageObject {
  subjectId: string;
  contentId: string;
  blockIndex: number;
  objectKey: string;
  checksum: string;
  sizeBytes: number;
  versionId: string;
  lifecycleVersion: number;
  createdAt: string;
  deletedAt: string | null;
}

export interface HostedSeederManifest {
  subjectId: string;
  contentId: string;
  manifest: Record<string, unknown>;
  isPinned: boolean;
  autoDeleteAt: string | null;
  lifecycleVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface HostedObjectObservation {
  objectKey: string;
  checksum: string;
  sizeBytes: number;
  versionId: string;
}

export interface HostedObjectDeletionReceipt {
  objectKey: string;
  versionId: string;
  deleted: boolean;
}

export interface HostedObjectUploadTarget {
  objectKey: string;
  method: 'PUT';
  url: string;
  headers: Readonly<Record<string, string>>;
  expiresAt: string;
  fencingToken: number;
}

/**
 * Real external byte boundary. Upload targets transfer bytes directly to object
 * storage. Metadata transitions consume only stat/delete observations.
 */
export interface HostedStorageObjectStore {
  createUploadTarget(input: {
    objectKey: string;
    checksum: string;
    sizeBytes: number;
    fencingToken: number;
    expiresAt: string;
  }): Promise<HostedObjectUploadTarget>;
  observeObject(objectKey: string, versionId?: string): Promise<HostedObjectObservation | null>;
  deleteObject(input: {
    objectKey: string;
    versionId: string;
  }): Promise<HostedObjectDeletionReceipt>;
}

export interface ProvisionHostedStorageTenantInput {
  subjectId: string;
  capBytes: number;
  policy: HostedStoragePolicy;
}

export type ProvisionHostedStorageTenantResult =
  | { status: 'created' | 'updated' | 'replayed'; tenant: HostedStorageTenant }
  | { status: 'conflict' | 'cap_below_usage' };

export interface ReserveHostedStorageInput {
  reservationId: string;
  subjectId: string;
  contentId: string;
  blockIndex: number;
  objectKey: string;
  checksum: string;
  sizeBytes: number;
}

export type ReserveHostedStorageResult =
  | { status: 'reserved' | 'replayed'; reservation: HostedStorageReservation }
  | { status: 'already_active'; object: HostedStorageObject }
  | {
    status:
      | 'tenant_missing'
      | 'conflict'
      | 'quota_exceeded'
      | 'object_too_large'
      | 'object_limit'
      | 'reservation_limit';
  };

export interface HostedStorageTransitionInput {
  reservationId: string;
  fencingToken: number;
  observation?: HostedObjectObservation;
  deletion?: HostedObjectDeletionReceipt;
}

export type HostedStorageTransitionResult =
  | {
    status: 'staged' | 'activated' | 'released' | 'expired' | 'failed' | 'replayed';
    reservation: HostedStorageReservation;
    object?: HostedStorageObject;
  }
  | {
    status:
      | 'not_found'
      | 'stale_fence'
      | 'invalid_state'
      | 'metadata_mismatch'
      | 'object_conflict'
      | 'delete_not_confirmed';
  };

export interface HostedStorageReservationCursor {
  createdAt: string;
  reservationId: string;
}

export interface HostedStorageReconciliationCursor {
  expiresAt: string;
  reservationId: string;
}

export interface HostedStorageObjectCursor {
  contentId: string;
  blockIndex: number;
}

export interface HostedStorageManifestExpiryCursor {
  autoDeleteAt: string;
  subjectId: string;
  contentId: string;
}

export interface HostedStoragePage<T, Cursor> {
  items: T[];
  nextCursor: Cursor | null;
}

export interface PutHostedSeederManifestInput {
  subjectId: string;
  contentId: string;
  manifest: Record<string, unknown>;
  isPinned: boolean;
  expectedLifecycleVersion: number | null;
}

export type PutHostedSeederManifestResult =
  | { status: 'inserted' | 'updated' | 'replayed'; manifest: HostedSeederManifest }
  | { status: 'tenant_missing' | 'conflict' };

export interface HostedStorageLegacyReadiness {
  legacyObjects: number;
  legacyBytes: number;
}

export interface HostedStorageApiUploadBlock {
  subjectId: string;
  objectId: string;
  blockIndex: number;
  totalBlocks: number;
  blockHash: string;
  sizeBytes: number;
  createdAt: string;
}

export interface HostedStorageApiUpload {
  subjectId: string;
  objectId: string;
  totalBlocks: number;
  blocks: HostedStorageApiUploadBlock[];
}

export interface RecordHostedStorageApiUploadBlockInput {
  subjectId: string;
  objectId: string;
  blockIndex: number;
  totalBlocks: number;
  blockHash: string;
  sizeBytes: number;
}

export type RecordHostedStorageApiUploadBlockResult =
  | { status: 'inserted' | 'replayed'; block: HostedStorageApiUploadBlock }
  | { status: 'tenant_missing' | 'conflict' };

export interface HostedStorageApiObject {
  subjectId: string;
  objectId: string;
  encryptedBytes: number;
  ciphertextHash: string;
  dataClass: string;
  totalBlocks: number;
  version: string;
  createdAt: string;
}

export interface CompleteHostedStorageApiObjectInput {
  subjectId: string;
  objectId: string;
  encryptedBytes: number;
  ciphertextHash: string;
  dataClass: string;
  totalBlocks: number;
  version: string;
}

export type CompleteHostedStorageApiObjectResult =
  | { status: 'completed' | 'replayed'; object: HostedStorageApiObject }
  | { status: 'tenant_missing' | 'upload_missing' | 'upload_incomplete' | 'conflict' };

export interface HostedStorageApiObjectCursor {
  createdAt: string;
  objectId: string;
}

export interface HostedStorageApiObjectDeleteResult {
  objectRows: number;
  uploadBlockRows: number;
  backupRows: number;
}

export interface HostedStorageBackupLocator {
  subjectId: string;
  formatVersion: number;
  backupId: string;
  encryptedManifestHash: string;
  createdAt: string;
  manifestObjectId: string;
}

export interface PutHostedStorageBackupLocatorInput {
  subjectId: string;
  formatVersion: number;
  backupId: string;
  encryptedManifestHash: string;
  createdAt: string;
  manifestObjectId: string;
}

export type PutHostedStorageBackupLocatorResult =
  | { status: 'inserted' | 'replayed'; locator: HostedStorageBackupLocator }
  | { status: 'tenant_missing' | 'manifest_object_missing' | 'conflict' };

export interface HostedStorageBackupCursor {
  createdAt: string;
  backupId: string;
}

export interface HostedStorageApiTenantDeleteResult {
  tenantRows: number;
  policyRows: number;
  objectRows: number;
  uploadBlockRows: number;
  backupRows: number;
  storageObjectRows: number;
  reservationRows: number;
  seederManifestRows: number;
}

export interface HostedStorageMetadataStore {
  getLegacyReadiness(): Promise<HostedStorageLegacyReadiness>;
  provisionTenant(
    input: ProvisionHostedStorageTenantInput,
  ): Promise<ProvisionHostedStorageTenantResult>;
  getTenant(subjectId: string): Promise<HostedStorageTenant | null>;
  reserve(input: ReserveHostedStorageInput): Promise<ReserveHostedStorageResult>;
  stage(input: HostedStorageTransitionInput): Promise<HostedStorageTransitionResult>;
  activate(input: HostedStorageTransitionInput): Promise<HostedStorageTransitionResult>;
  release(input: HostedStorageTransitionInput): Promise<HostedStorageTransitionResult>;
  fail(input: HostedStorageTransitionInput): Promise<HostedStorageTransitionResult>;
  expireDue(limit: number): Promise<HostedStorageReservation[]>;
  getReservation(reservationId: string): Promise<HostedStorageReservation | null>;
  listReservations(input: {
    subjectId: string;
    after?: HostedStorageReservationCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageReservation, HostedStorageReservationCursor>>;
  listReconciliation(input: {
    after?: HostedStorageReconciliationCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageReservation, HostedStorageReconciliationCursor>>;
  getObject(
    subjectId: string,
    contentId: string,
    blockIndex: number,
  ): Promise<HostedStorageObject | null>;
  listObjects(input: {
    subjectId: string;
    after?: HostedStorageObjectCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageObject, HostedStorageObjectCursor>>;
  putManifest(input: PutHostedSeederManifestInput): Promise<PutHostedSeederManifestResult>;
  getManifest(subjectId: string, contentId: string): Promise<HostedSeederManifest | null>;
  listExpiredManifests(input: {
    after?: HostedStorageManifestExpiryCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedSeederManifest, HostedStorageManifestExpiryCursor>>;
  deleteManifest(
    subjectId: string,
    contentId: string,
    expectedLifecycleVersion: number,
  ): Promise<'deleted' | 'not_found' | 'conflict'>;
  recordApiUploadBlock(
    input: RecordHostedStorageApiUploadBlockInput,
  ): Promise<RecordHostedStorageApiUploadBlockResult>;
  getApiUpload(subjectId: string, objectId: string): Promise<HostedStorageApiUpload | null>;
  completeApiObject(
    input: CompleteHostedStorageApiObjectInput,
  ): Promise<CompleteHostedStorageApiObjectResult>;
  getApiObject(subjectId: string, objectId: string): Promise<HostedStorageApiObject | null>;
  listApiObjects(input: {
    subjectId: string;
    after?: HostedStorageApiObjectCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageApiObject, HostedStorageApiObjectCursor>>;
  deleteApiObject(
    subjectId: string,
    objectId: string,
  ): Promise<HostedStorageApiObjectDeleteResult>;
  putBackupLocator(
    input: PutHostedStorageBackupLocatorInput,
  ): Promise<PutHostedStorageBackupLocatorResult>;
  listBackupLocators(input: {
    subjectId: string;
    after?: HostedStorageBackupCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageBackupLocator, HostedStorageBackupCursor>>;
  deleteApiTenant(subjectId: string): Promise<HostedStorageApiTenantDeleteResult>;
}

interface MemoryTenantRecord extends HostedStorageTenant {}

const objectIdentity = (subjectId: string, contentId: string, blockIndex: number): string =>
  `${subjectId}\u0000${contentId}\u0000${blockIndex}`;
const manifestIdentity = (subjectId: string, contentId: string): string =>
  `${subjectId}\u0000${contentId}`;
const apiUploadBlockIdentity = (subjectId: string, objectId: string, blockIndex: number): string =>
  `${subjectId}\u0000${objectId}\u0000${blockIndex}`;
const apiObjectIdentity = (subjectId: string, objectId: string): string =>
  `${subjectId}\u0000${objectId}`;
const backupIdentity = (subjectId: string, backupId: string): string =>
  `${subjectId}\u0000${backupId}`;

function sameReservationInput(
  reservation: HostedStorageReservation,
  input: ReserveHostedStorageInput,
): boolean {
  return reservation.subjectId === input.subjectId
    && reservation.contentId === input.contentId
    && reservation.blockIndex === input.blockIndex
    && reservation.objectKey === input.objectKey
    && reservation.checksum === input.checksum
    && reservation.sizeBytes === input.sizeBytes;
}

function sameObservation(
  reservation: HostedStorageReservation,
  observation: HostedObjectObservation | undefined,
): observation is HostedObjectObservation {
  return !!observation
    && observation.objectKey === reservation.objectKey
    && observation.checksum === reservation.checksum
    && observation.sizeBytes === reservation.sizeBytes
    && typeof observation.versionId === 'string'
    && observation.versionId.length > 0;
}

function confirmsDeletion(
  object: HostedStorageObject,
  deletion: HostedObjectDeletionReceipt | undefined,
): deletion is HostedObjectDeletionReceipt {
  return !!deletion
    && deletion.deleted
    && deletion.objectKey === object.objectKey
    && deletion.versionId === object.versionId;
}

function cloneManifest(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

/** Reference implementation used by conformance tests and ephemeral deployments. */
export class InMemoryHostedStorageMetadataStore implements HostedStorageMetadataStore {
  private readonly tenants = new Map<string, MemoryTenantRecord>();
  private readonly reservations = new Map<string, HostedStorageReservation>();
  private readonly objects = new Map<string, HostedStorageObject>();
  private readonly manifests = new Map<string, HostedSeederManifest>();
  private readonly apiUploadBlocks = new Map<string, HostedStorageApiUploadBlock>();
  private readonly apiObjects = new Map<string, HostedStorageApiObject>();
  private readonly backupLocators = new Map<string, HostedStorageBackupLocator>();
  private lockTail: Promise<void> = Promise.resolve();

  constructor(private readonly now: () => number = () => Date.now()) {}

  private withLock<T>(operation: () => Promise<T> | T): Promise<T> {
    const run = this.lockTail.then(operation, operation);
    this.lockTail = run.then(() => undefined, () => undefined);
    return run;
  }

  private iso(): string {
    return new Date(this.now()).toISOString();
  }

  async getLegacyReadiness(): Promise<HostedStorageLegacyReadiness> {
    return { legacyObjects: 0, legacyBytes: 0 };
  }

  async provisionTenant(
    input: ProvisionHostedStorageTenantInput,
  ): Promise<ProvisionHostedStorageTenantResult> {
    return this.withLock(() => {
      const existing = this.tenants.get(input.subjectId);
      if (!existing) {
        const created: MemoryTenantRecord = {
          subjectId: input.subjectId,
          capBytes: input.capBytes,
          reservedBytes: 0,
          committedBytes: 0,
          lifecycleVersion: 1,
          updatedAt: this.iso(),
          policy: { ...input.policy },
        };
        this.tenants.set(input.subjectId, created);
        return { status: 'created', tenant: { ...created, policy: { ...created.policy } } };
      }
      const same = existing.capBytes === input.capBytes
        && JSON.stringify(existing.policy) === JSON.stringify(input.policy);
      if (input.policy.policyVersion < existing.policy.policyVersion) return { status: 'conflict' };
      if (input.capBytes < existing.reservedBytes + existing.committedBytes) {
        return { status: 'cap_below_usage' };
      }
      if (input.policy.policyVersion === existing.policy.policyVersion && !same) {
        return { status: 'conflict' };
      }
      if (same) return { status: 'replayed', tenant: { ...existing, policy: { ...existing.policy } } };
      existing.capBytes = input.capBytes;
      existing.policy = { ...input.policy };
      existing.lifecycleVersion += 1;
      existing.updatedAt = this.iso();
      return { status: 'updated', tenant: { ...existing, policy: { ...existing.policy } } };
    });
  }

  async getTenant(subjectId: string): Promise<HostedStorageTenant | null> {
    const tenant = this.tenants.get(subjectId);
    return tenant ? { ...tenant, policy: { ...tenant.policy } } : null;
  }

  async reserve(input: ReserveHostedStorageInput): Promise<ReserveHostedStorageResult> {
    return this.withLock(async () => {
      await this.expireSubject(input.subjectId);
      const existing = this.reservations.get(input.reservationId);
      if (existing) {
        return sameReservationInput(existing, input)
          ? { status: 'replayed', reservation: { ...existing } }
          : { status: 'conflict' };
      }
      const tenant = this.tenants.get(input.subjectId);
      if (!tenant) return { status: 'tenant_missing' };
      const existingObject = this.objects.get(objectIdentity(
        input.subjectId,
        input.contentId,
        input.blockIndex,
      ));
      if (existingObject && existingObject.deletedAt === null) {
        return existingObject.checksum === input.checksum
          && existingObject.sizeBytes === input.sizeBytes
          ? { status: 'already_active', object: { ...existingObject } }
          : { status: 'conflict' };
      }
      const activeReservations = [...this.reservations.values()].filter((reservation) =>
        reservation.subjectId === input.subjectId
        && (reservation.state === 'reserved' || reservation.state === 'staged'));
      if (activeReservations.some((reservation) =>
        reservation.contentId === input.contentId && reservation.blockIndex === input.blockIndex)) {
        return { status: 'conflict' };
      }
      if (input.sizeBytes > tenant.policy.maxObjectBytes) return { status: 'object_too_large' };
      if (activeReservations.length >= tenant.policy.maxConcurrentReservations) {
        return { status: 'reservation_limit' };
      }
      const activeObjects = [...this.objects.values()].filter((object) =>
        object.subjectId === input.subjectId && object.deletedAt === null).length;
      if (activeObjects + activeReservations.length >= tenant.policy.maxObjectCount) {
        return { status: 'object_limit' };
      }
      if (tenant.reservedBytes + tenant.committedBytes + input.sizeBytes > tenant.capBytes) {
        return { status: 'quota_exceeded' };
      }
      tenant.lifecycleVersion += 1;
      tenant.reservedBytes += input.sizeBytes;
      tenant.updatedAt = this.iso();
      const createdAt = this.iso();
      const reservation: HostedStorageReservation = {
        ...input,
        state: 'reserved',
        fencingToken: tenant.lifecycleVersion,
        lifecycleVersion: 1,
        expiresAt: new Date(
          this.now() + tenant.policy.reservationTtlSeconds * 1000,
        ).toISOString(),
        stagedAt: null,
        activatedAt: null,
        releasedAt: null,
        createdAt,
        updatedAt: createdAt,
      };
      this.reservations.set(input.reservationId, reservation);
      return { status: 'reserved', reservation: { ...reservation } };
    });
  }

  async stage(input: HostedStorageTransitionInput): Promise<HostedStorageTransitionResult> {
    return this.withLock(async () => {
      const reservation = this.reservations.get(input.reservationId);
      if (!reservation) return { status: 'not_found' };
      if (reservation.fencingToken !== input.fencingToken) return { status: 'stale_fence' };
      if (reservation.state === 'staged') {
        return sameObservation(reservation, input.observation)
          ? { status: 'replayed', reservation: { ...reservation } }
          : { status: 'metadata_mismatch' };
      }
      if (reservation.state !== 'reserved') return { status: 'invalid_state' };
      if (Date.parse(reservation.expiresAt) <= this.now()) {
        await this.expireReservation(reservation);
        return { status: 'expired', reservation: { ...reservation } };
      }
      if (!sameObservation(reservation, input.observation)) return { status: 'metadata_mismatch' };
      reservation.state = 'staged';
      reservation.stagedAt = this.iso();
      reservation.updatedAt = reservation.stagedAt;
      reservation.lifecycleVersion += 1;
      return { status: 'staged', reservation: { ...reservation } };
    });
  }

  async activate(input: HostedStorageTransitionInput): Promise<HostedStorageTransitionResult> {
    return this.withLock(async () => {
      const reservation = this.reservations.get(input.reservationId);
      if (!reservation) return { status: 'not_found' };
      if (reservation.fencingToken !== input.fencingToken) return { status: 'stale_fence' };
      const identity = objectIdentity(
        reservation.subjectId,
        reservation.contentId,
        reservation.blockIndex,
      );
      if (reservation.state === 'activated') {
        const object = this.objects.get(identity);
        return object && sameObservation(reservation, input.observation)
          && object.versionId === input.observation.versionId
          ? { status: 'replayed', reservation: { ...reservation }, object: { ...object } }
          : { status: 'metadata_mismatch' };
      }
      if (reservation.state !== 'staged') return { status: 'invalid_state' };
      if (Date.parse(reservation.expiresAt) <= this.now()) {
        await this.expireReservation(reservation);
        return { status: 'expired', reservation: { ...reservation } };
      }
      if (!sameObservation(reservation, input.observation)) return { status: 'metadata_mismatch' };
      const objectKeyConflict = [...this.objects.values()].some((object) =>
        object.objectKey === reservation.objectKey
        && objectIdentity(object.subjectId, object.contentId, object.blockIndex) !== identity);
      if (objectKeyConflict) return { status: 'object_conflict' };
      const tenant = this.tenants.get(reservation.subjectId)!;
      const existingObject = this.objects.get(identity);
      const now = this.iso();
      const object: HostedStorageObject = {
        subjectId: reservation.subjectId,
        contentId: reservation.contentId,
        blockIndex: reservation.blockIndex,
        objectKey: reservation.objectKey,
        checksum: reservation.checksum,
        sizeBytes: reservation.sizeBytes,
        versionId: input.observation.versionId,
        lifecycleVersion: (existingObject?.lifecycleVersion ?? 0) + 1,
        createdAt: existingObject?.createdAt ?? now,
        deletedAt: null,
      };
      this.objects.set(identity, object);
      tenant.reservedBytes -= reservation.sizeBytes;
      tenant.committedBytes += reservation.sizeBytes;
      tenant.lifecycleVersion += 1;
      tenant.updatedAt = now;
      reservation.state = 'activated';
      reservation.activatedAt = now;
      reservation.updatedAt = now;
      reservation.lifecycleVersion += 1;
      return { status: 'activated', reservation: { ...reservation }, object: { ...object } };
    });
  }

  async release(input: HostedStorageTransitionInput): Promise<HostedStorageTransitionResult> {
    return this.finish(input, 'released');
  }

  async fail(input: HostedStorageTransitionInput): Promise<HostedStorageTransitionResult> {
    return this.finish(input, 'failed');
  }

  private finish(
    input: HostedStorageTransitionInput,
    state: 'released' | 'failed',
  ): Promise<HostedStorageTransitionResult> {
    return this.withLock(() => {
      const reservation = this.reservations.get(input.reservationId);
      if (!reservation) return { status: 'not_found' };
      if (reservation.fencingToken !== input.fencingToken) return { status: 'stale_fence' };
      if (reservation.state === state) return { status: 'replayed', reservation: { ...reservation } };
      if (reservation.state === 'released' || reservation.state === 'failed' || reservation.state === 'expired') {
        return { status: 'invalid_state' };
      }
      const tenant = this.tenants.get(reservation.subjectId)!;
      if (reservation.state === 'activated') {
        const object = this.objects.get(objectIdentity(
          reservation.subjectId,
          reservation.contentId,
          reservation.blockIndex,
        ));
        if (!object || object.deletedAt !== null || !confirmsDeletion(object, input.deletion)) {
          return { status: 'delete_not_confirmed' };
        }
        object.deletedAt = this.iso();
        object.lifecycleVersion += 1;
        tenant.committedBytes -= reservation.sizeBytes;
      } else {
        tenant.reservedBytes -= reservation.sizeBytes;
      }
      const now = this.iso();
      tenant.lifecycleVersion += 1;
      tenant.updatedAt = now;
      reservation.state = state;
      reservation.releasedAt = now;
      reservation.updatedAt = now;
      reservation.lifecycleVersion += 1;
      return { status: state, reservation: { ...reservation } };
    });
  }

  async expireDue(limit: number): Promise<HostedStorageReservation[]> {
    return this.withLock(async () => {
      const due = [...this.reservations.values()]
        .filter((reservation) =>
          (reservation.state === 'reserved' || reservation.state === 'staged')
          && Date.parse(reservation.expiresAt) <= this.now())
        .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)
          || a.reservationId.localeCompare(b.reservationId))
        .slice(0, limit);
      for (const reservation of due) await this.expireReservation(reservation);
      return due.map((reservation) => ({ ...reservation }));
    });
  }

  private async expireSubject(subjectId: string): Promise<void> {
    const due = [...this.reservations.values()].filter((reservation) =>
      reservation.subjectId === subjectId
      && (reservation.state === 'reserved' || reservation.state === 'staged')
      && Date.parse(reservation.expiresAt) <= this.now());
    for (const reservation of due) await this.expireReservation(reservation);
  }

  private async expireReservation(reservation: HostedStorageReservation): Promise<void> {
    const tenant = this.tenants.get(reservation.subjectId);
    if (tenant) {
      tenant.reservedBytes -= reservation.sizeBytes;
      tenant.lifecycleVersion += 1;
      tenant.updatedAt = this.iso();
    }
    reservation.state = 'expired';
    reservation.releasedAt = this.iso();
    reservation.updatedAt = reservation.releasedAt;
    reservation.lifecycleVersion += 1;
  }

  async getReservation(reservationId: string): Promise<HostedStorageReservation | null> {
    const reservation = this.reservations.get(reservationId);
    return reservation ? { ...reservation } : null;
  }

  async listReservations(input: {
    subjectId: string;
    after?: HostedStorageReservationCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageReservation, HostedStorageReservationCursor>> {
    const records = [...this.reservations.values()]
      .filter((reservation) => reservation.subjectId === input.subjectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)
        || b.reservationId.localeCompare(a.reservationId))
      .filter((reservation) => !input.after
        || reservation.createdAt < input.after.createdAt
        || (reservation.createdAt === input.after.createdAt
          && reservation.reservationId < input.after.reservationId));
    const items = records.slice(0, input.limit).map((record) => ({ ...record }));
    const last = items.at(-1);
    return {
      items,
      nextCursor: records.length > items.length && last
        ? { createdAt: last.createdAt, reservationId: last.reservationId }
        : null,
    };
  }

  async listReconciliation(input: {
    after?: HostedStorageReconciliationCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageReservation, HostedStorageReconciliationCursor>> {
    const records = [...this.reservations.values()]
      .filter((reservation) => reservation.state === 'staged'
        && Date.parse(reservation.expiresAt) > this.now())
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)
        || a.reservationId.localeCompare(b.reservationId))
      .filter((reservation) => !input.after
        || reservation.expiresAt > input.after.expiresAt
        || (reservation.expiresAt === input.after.expiresAt
          && reservation.reservationId > input.after.reservationId));
    const items = records.slice(0, input.limit).map((record) => ({ ...record }));
    const last = items.at(-1);
    return {
      items,
      nextCursor: records.length > items.length && last
        ? { expiresAt: last.expiresAt, reservationId: last.reservationId }
        : null,
    };
  }

  async getObject(
    subjectId: string,
    contentId: string,
    blockIndex: number,
  ): Promise<HostedStorageObject | null> {
    const object = this.objects.get(objectIdentity(subjectId, contentId, blockIndex));
    return object && object.deletedAt === null ? { ...object } : null;
  }

  async listObjects(input: {
    subjectId: string;
    after?: HostedStorageObjectCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageObject, HostedStorageObjectCursor>> {
    const records = [...this.objects.values()]
      .filter((object) => object.subjectId === input.subjectId && object.deletedAt === null)
      .sort((a, b) => a.contentId.localeCompare(b.contentId) || a.blockIndex - b.blockIndex)
      .filter((object) => !input.after
        || object.contentId > input.after.contentId
        || (object.contentId === input.after.contentId && object.blockIndex > input.after.blockIndex));
    const items = records.slice(0, input.limit).map((record) => ({ ...record }));
    const last = items.at(-1);
    return {
      items,
      nextCursor: records.length > items.length && last
        ? { contentId: last.contentId, blockIndex: last.blockIndex }
        : null,
    };
  }

  async putManifest(input: PutHostedSeederManifestInput): Promise<PutHostedSeederManifestResult> {
    return this.withLock(() => {
      const tenant = this.tenants.get(input.subjectId);
      if (!tenant) return { status: 'tenant_missing' };
      const identity = manifestIdentity(input.subjectId, input.contentId);
      const existing = this.manifests.get(identity);
      if (!existing) {
        if (input.expectedLifecycleVersion !== null) return { status: 'conflict' };
        const now = this.iso();
        const manifest: HostedSeederManifest = {
          subjectId: input.subjectId,
          contentId: input.contentId,
          manifest: cloneManifest(input.manifest),
          isPinned: input.isPinned,
          autoDeleteAt: input.isPinned ? null : new Date(
            this.now() + tenant.policy.retentionDays * 24 * 60 * 60 * 1000,
          ).toISOString(),
          lifecycleVersion: 1,
          createdAt: now,
          updatedAt: now,
        };
        this.manifests.set(identity, manifest);
        return { status: 'inserted', manifest: { ...manifest, manifest: cloneManifest(manifest.manifest) } };
      }
      const same = JSON.stringify(existing.manifest) === JSON.stringify(input.manifest)
        && existing.isPinned === input.isPinned;
      if (input.expectedLifecycleVersion !== existing.lifecycleVersion) return { status: 'conflict' };
      if (same) {
        return { status: 'replayed', manifest: { ...existing, manifest: cloneManifest(existing.manifest) } };
      }
      existing.manifest = cloneManifest(input.manifest);
      existing.isPinned = input.isPinned;
      existing.autoDeleteAt = input.isPinned ? null : new Date(
        this.now() + tenant.policy.retentionDays * 24 * 60 * 60 * 1000,
      ).toISOString();
      existing.lifecycleVersion += 1;
      existing.updatedAt = this.iso();
      return { status: 'updated', manifest: { ...existing, manifest: cloneManifest(existing.manifest) } };
    });
  }

  async getManifest(subjectId: string, contentId: string): Promise<HostedSeederManifest | null> {
    const manifest = this.manifests.get(manifestIdentity(subjectId, contentId));
    return manifest ? { ...manifest, manifest: cloneManifest(manifest.manifest) } : null;
  }

  async listExpiredManifests(input: {
    after?: HostedStorageManifestExpiryCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedSeederManifest, HostedStorageManifestExpiryCursor>> {
    const records = [...this.manifests.values()]
      .filter((manifest) => !manifest.isPinned
        && manifest.autoDeleteAt !== null
        && Date.parse(manifest.autoDeleteAt) <= this.now())
      .sort((a, b) => a.autoDeleteAt!.localeCompare(b.autoDeleteAt!)
        || a.subjectId.localeCompare(b.subjectId)
        || a.contentId.localeCompare(b.contentId))
      .filter((manifest) => !input.after
        || manifest.autoDeleteAt! > input.after.autoDeleteAt
        || (manifest.autoDeleteAt === input.after.autoDeleteAt
          && (manifest.subjectId > input.after.subjectId
            || (manifest.subjectId === input.after.subjectId
              && manifest.contentId > input.after.contentId))));
    const items = records.slice(0, input.limit).map((record) => ({
      ...record,
      manifest: cloneManifest(record.manifest),
    }));
    const last = items.at(-1);
    return {
      items,
      nextCursor: records.length > items.length && last && last.autoDeleteAt
        ? {
          autoDeleteAt: last.autoDeleteAt,
          subjectId: last.subjectId,
          contentId: last.contentId,
        }
        : null,
    };
  }

  async deleteManifest(
    subjectId: string,
    contentId: string,
    expectedLifecycleVersion: number,
  ): Promise<'deleted' | 'not_found' | 'conflict'> {
    return this.withLock(() => {
      const identity = manifestIdentity(subjectId, contentId);
      const manifest = this.manifests.get(identity);
      if (!manifest) return 'not_found';
      if (manifest.lifecycleVersion !== expectedLifecycleVersion) return 'conflict';
      this.manifests.delete(identity);
      return 'deleted';
    });
  }

  recordApiUploadBlock(
    input: RecordHostedStorageApiUploadBlockInput,
  ): Promise<RecordHostedStorageApiUploadBlockResult> {
    return this.withLock(() => {
      if (!this.tenants.has(input.subjectId)) return { status: 'tenant_missing' };
      const identity = apiUploadBlockIdentity(input.subjectId, input.objectId, input.blockIndex);
      const existing = this.apiUploadBlocks.get(identity);
      if (existing) {
        return existing.totalBlocks === input.totalBlocks
          && existing.blockHash === input.blockHash
          && existing.sizeBytes === input.sizeBytes
          ? { status: 'replayed', block: { ...existing } }
          : { status: 'conflict' };
      }
      if (this.apiObjects.has(apiObjectIdentity(input.subjectId, input.objectId))) {
        return { status: 'conflict' };
      }
      const uploadConflict = [...this.apiUploadBlocks.values()].some((block) =>
        block.subjectId === input.subjectId
        && block.objectId === input.objectId
        && block.totalBlocks !== input.totalBlocks);
      if (uploadConflict) return { status: 'conflict' };
      const block: HostedStorageApiUploadBlock = {
        ...input,
        createdAt: this.iso(),
      };
      this.apiUploadBlocks.set(identity, block);
      return { status: 'inserted', block: { ...block } };
    });
  }

  async getApiUpload(subjectId: string, objectId: string): Promise<HostedStorageApiUpload | null> {
    const blocks = [...this.apiUploadBlocks.values()]
      .filter((block) => block.subjectId === subjectId && block.objectId === objectId)
      .sort((a, b) => a.blockIndex - b.blockIndex)
      .map((block) => ({ ...block }));
    const first = blocks[0];
    return first ? { subjectId, objectId, totalBlocks: first.totalBlocks, blocks } : null;
  }

  completeApiObject(
    input: CompleteHostedStorageApiObjectInput,
  ): Promise<CompleteHostedStorageApiObjectResult> {
    return this.withLock(async () => {
      if (!this.tenants.has(input.subjectId)) return { status: 'tenant_missing' };
      const identity = apiObjectIdentity(input.subjectId, input.objectId);
      const existing = this.apiObjects.get(identity);
      if (existing) {
        const same = existing.encryptedBytes === input.encryptedBytes
          && existing.ciphertextHash === input.ciphertextHash
          && existing.dataClass === input.dataClass
          && existing.totalBlocks === input.totalBlocks;
        return same
          ? { status: 'replayed', object: { ...existing } }
          : { status: 'conflict' };
      }
      const upload = await this.getApiUpload(input.subjectId, input.objectId);
      if (!upload) return { status: 'upload_missing' };
      const dense = upload.totalBlocks === input.totalBlocks
        && upload.blocks.length === input.totalBlocks
        && upload.blocks.every((block, index) => block.blockIndex === index)
        && upload.blocks.reduce((total, block) => total + block.sizeBytes, 0) === input.encryptedBytes;
      if (!dense) return { status: 'upload_incomplete' };
      const object: HostedStorageApiObject = {
        ...input,
        createdAt: this.iso(),
      };
      this.apiObjects.set(identity, object);
      return { status: 'completed', object: { ...object } };
    });
  }

  async getApiObject(subjectId: string, objectId: string): Promise<HostedStorageApiObject | null> {
    const object = this.apiObjects.get(apiObjectIdentity(subjectId, objectId));
    return object ? { ...object } : null;
  }

  async listApiObjects(input: {
    subjectId: string;
    after?: HostedStorageApiObjectCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageApiObject, HostedStorageApiObjectCursor>> {
    const records = [...this.apiObjects.values()]
      .filter((object) => object.subjectId === input.subjectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)
        || a.objectId.localeCompare(b.objectId))
      .filter((object) => !input.after
        || object.createdAt > input.after.createdAt
        || (object.createdAt === input.after.createdAt
          && object.objectId > input.after.objectId));
    const items = records.slice(0, input.limit).map((object) => ({ ...object }));
    const last = items.at(-1);
    return {
      items,
      nextCursor: records.length > items.length && last
        ? { createdAt: last.createdAt, objectId: last.objectId }
        : null,
    };
  }

  deleteApiObject(
    subjectId: string,
    objectId: string,
  ): Promise<HostedStorageApiObjectDeleteResult> {
    return this.withLock(() => {
      const objectKey = apiObjectIdentity(subjectId, objectId);
      const objectRows = this.apiObjects.delete(objectKey) ? 1 : 0;
      let uploadBlockRows = 0;
      for (const [key, block] of this.apiUploadBlocks) {
        if (block.subjectId !== subjectId || block.objectId !== objectId) continue;
        this.apiUploadBlocks.delete(key);
        uploadBlockRows += 1;
      }
      let backupRows = 0;
      for (const [key, locator] of this.backupLocators) {
        if (locator.subjectId !== subjectId || locator.manifestObjectId !== objectId) continue;
        this.backupLocators.delete(key);
        backupRows += 1;
      }
      return { objectRows, uploadBlockRows, backupRows };
    });
  }

  putBackupLocator(
    input: PutHostedStorageBackupLocatorInput,
  ): Promise<PutHostedStorageBackupLocatorResult> {
    return this.withLock(() => {
      if (!this.tenants.has(input.subjectId)) return { status: 'tenant_missing' };
      const manifest = this.apiObjects.get(apiObjectIdentity(input.subjectId, input.manifestObjectId));
      if (!manifest || manifest.ciphertextHash !== input.encryptedManifestHash) {
        return { status: 'manifest_object_missing' };
      }
      const identity = backupIdentity(input.subjectId, input.backupId);
      const existing = this.backupLocators.get(identity);
      if (existing) {
        const same = existing.formatVersion === input.formatVersion
          && existing.encryptedManifestHash === input.encryptedManifestHash
          && existing.createdAt === input.createdAt
          && existing.manifestObjectId === input.manifestObjectId;
        return same
          ? { status: 'replayed', locator: { ...existing } }
          : { status: 'conflict' };
      }
      const locator: HostedStorageBackupLocator = { ...input };
      this.backupLocators.set(identity, locator);
      return { status: 'inserted', locator: { ...locator } };
    });
  }

  async listBackupLocators(input: {
    subjectId: string;
    after?: HostedStorageBackupCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageBackupLocator, HostedStorageBackupCursor>> {
    const records = [...this.backupLocators.values()]
      .filter((locator) => locator.subjectId === input.subjectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)
        || a.backupId.localeCompare(b.backupId))
      .filter((locator) => !input.after
        || locator.createdAt > input.after.createdAt
        || (locator.createdAt === input.after.createdAt
          && locator.backupId > input.after.backupId));
    const items = records.slice(0, input.limit).map((locator) => ({ ...locator }));
    const last = items.at(-1);
    return {
      items,
      nextCursor: records.length > items.length && last
        ? { createdAt: last.createdAt, backupId: last.backupId }
        : null,
    };
  }

  deleteApiTenant(subjectId: string): Promise<HostedStorageApiTenantDeleteResult> {
    return this.withLock(() => {
      const tenantRows = this.tenants.has(subjectId) ? 1 : 0;
      const result: HostedStorageApiTenantDeleteResult = {
        tenantRows,
        policyRows: tenantRows,
        objectRows: 0,
        uploadBlockRows: 0,
        backupRows: 0,
        storageObjectRows: 0,
        reservationRows: 0,
        seederManifestRows: 0,
      };
      for (const [key, object] of this.apiObjects) {
        if (object.subjectId === subjectId) {
          this.apiObjects.delete(key);
          result.objectRows += 1;
        }
      }
      for (const [key, block] of this.apiUploadBlocks) {
        if (block.subjectId === subjectId) {
          this.apiUploadBlocks.delete(key);
          result.uploadBlockRows += 1;
        }
      }
      for (const [key, locator] of this.backupLocators) {
        if (locator.subjectId === subjectId) {
          this.backupLocators.delete(key);
          result.backupRows += 1;
        }
      }
      for (const [key, object] of this.objects) {
        if (object.subjectId === subjectId) {
          this.objects.delete(key);
          result.storageObjectRows += 1;
        }
      }
      for (const [key, reservation] of this.reservations) {
        if (reservation.subjectId === subjectId) {
          this.reservations.delete(key);
          result.reservationRows += 1;
        }
      }
      for (const [key, manifest] of this.manifests) {
        if (manifest.subjectId === subjectId) {
          this.manifests.delete(key);
          result.seederManifestRows += 1;
        }
      }
      this.tenants.delete(subjectId);
      return result;
    });
  }
}
