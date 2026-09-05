import type { StateStoreId } from './model';

/**
 * Per-store descriptor: the durable identity of one state store on both
 * backends. It names the PostgreSQL schema/table and natural-key columns (used
 * by the direct-read enumerator and the dedicated importer insert path) and the
 * SERVICE ROOT the File adapter lives under (used to resolve the on-disk path
 * from the CLI's per-root flags). One store descriptor is the single place the
 * table name, key columns, and file root are declared, so the enumerator,
 * importer, and digest stay aligned.
 */

/**
 * Which per-service data-dir root a File store lives under. The service bins use
 * DIFFERENT default roots (community-node vs persona-service vs directory-node
 * vs hosted-service vs verification-service), and some stores live under a
 * NAMED SUBDIRECTORY of that root. The CLI resolves each root independently and
 * never assumes one directory covers every store.
 */
export type StateServiceRoot =
  | 'community'
  | 'persona'
  | 'directory'
  | 'hosted'
  | 'humanity';

export interface StateStoreDescriptor {
  id: StateStoreId;
  schema: string;
  table: string;
  /** Ordered natural-key columns; the identity tuple is these columns as text. */
  keyColumns: readonly string[];
  /**
   * The jsonb column holding the durable body, when the table has one. Stores
   * whose entire record is its key columns (revocations, blocked-personas,
   * submit windows, reference edges) set this to null.
   */
  payloadColumn: string | null;
  /** The service root whose data-dir the File adapter reads from. */
  serviceRoot: StateServiceRoot;
  /** Named subdirectory under the service root, when the bin nests the store. */
  fileSubdir: string | null;
  /** One-line note on the file on-disk layout, for the enumerator doc trail. */
  fileLayout: string;
}

export const STATE_STORE_DESCRIPTORS: Readonly<Record<StateStoreId, StateStoreDescriptor>> = {
  'community.descriptor-revisions': {
    id: 'community.descriptor-revisions',
    schema: 'community',
    table: 'descriptor_revisions',
    keyColumns: ['community_id'],
    payloadColumn: null,
    serviceRoot: 'community',
    fileSubdir: 'descriptors',
    fileLayout: 'one {hex(communityId)}.rev.json per community holding {revision, descriptorHash}',
  },
  'community.publications': {
    id: 'community.publications',
    schema: 'community',
    table: 'publications',
    keyColumns: ['publication_id'],
    payloadColumn: 'payload',
    serviceRoot: 'community',
    fileSubdir: 'publications',
    fileLayout: 'one {hex(publicationId)}.pub.json per publication holding {signed, snapshots}',
  },
  'community.kills': {
    id: 'community.kills',
    schema: 'community',
    table: 'kills',
    keyColumns: ['community_id'],
    payloadColumn: 'payload',
    serviceRoot: 'community',
    fileSubdir: 'kills',
    fileLayout: 'one {hex(communityId)}.kill.json per killed community holding SignedDescriptorKill',
  },
  'community.reports': {
    id: 'community.reports',
    schema: 'community',
    table: 'reports',
    keyColumns: ['publication_id', 'report_key'],
    payloadColumn: 'payload',
    serviceRoot: 'community',
    fileSubdir: 'reports',
    fileLayout: 'one {hex(publicationId)}.reports.json per publication holding SignedPublicAbuseReport[]',
  },
  'community.public-posts': {
    id: 'community.public-posts',
    schema: 'community',
    table: 'public_posts',
    keyColumns: ['publication_id', 'post_id'],
    payloadColumn: 'payload',
    serviceRoot: 'community',
    fileSubdir: 'public-posts',
    fileLayout: 'one {hex(publicationId)}.posts.json per publication holding AcceptedPublicPost[]',
  },
  'community.public-post-tombstones': {
    id: 'community.public-post-tombstones',
    schema: 'community',
    table: 'public_post_tombstones',
    keyColumns: ['publication_id', 'post_id'],
    payloadColumn: 'payload',
    serviceRoot: 'community',
    fileSubdir: 'public-posts',
    fileLayout: 'one {hex(publicationId)}.post-tombstones.json per publication holding PublicPostTombstone[]',
  },
  'community.publication-freezes': {
    id: 'community.publication-freezes',
    schema: 'community',
    table: 'publication_freezes',
    keyColumns: ['publication_id'],
    payloadColumn: 'payload',
    serviceRoot: 'community',
    fileSubdir: 'public-posts',
    fileLayout: 'one {hex(publicationId)}.freeze.json per frozen publication holding PublicPostingFreeze',
  },
  'community.public-submit-windows': {
    id: 'community.public-submit-windows',
    schema: 'community',
    table: 'public_submit_windows',
    keyColumns: ['publication_id', 'persona_key'],
    payloadColumn: null,
    serviceRoot: 'community',
    fileSubdir: 'public-posts',
    fileLayout: 'one {hex(publicationId)}.flood.json per publication holding {personaKey: number[]} windows',
  },
  'community.blocked-personas': {
    id: 'community.blocked-personas',
    schema: 'community',
    table: 'blocked_personas',
    // Enforcement + identity key on the sha256 hash (Plan 44 WP-3D), matching the file marker.
    keyColumns: ['persona_pubkey_hash'],
    payloadColumn: null,
    serviceRoot: 'community',
    fileSubdir: 'public-posts',
    fileLayout: 'one {sha256(lower(personaPubkey))}.blocked marker under blocked-personas/',
  },
  'community.private-states': {
    id: 'community.private-states',
    schema: 'community',
    table: 'private_states',
    keyColumns: ['community_id'],
    payloadColumn: null,
    serviceRoot: 'community',
    fileSubdir: 'private-state',
    fileLayout: 'one {hex(communityId)}.private-state.json aggregate (descriptor + snapshots + tail)',
  },
  'directory.publications': {
    id: 'directory.publications',
    schema: 'directory',
    table: 'publications',
    keyColumns: ['publication_id'],
    payloadColumn: null,
    serviceRoot: 'directory',
    fileSubdir: 'publications',
    fileLayout: 'one {hex(publicationId)}.dirpub.json per publication holding {rec, rids, expiresAt}',
  },
  'directory.kills': {
    id: 'directory.kills',
    schema: 'directory',
    table: 'kills',
    keyColumns: ['community_id'],
    payloadColumn: 'payload',
    serviceRoot: 'directory',
    fileSubdir: 'kills',
    fileLayout: 'one {hex(communityId)}.kill.json per killed community (directory-node FileKillStore)',
  },
  'humanity.spent-tokens': {
    id: 'humanity.spent-tokens',
    schema: 'humanity',
    table: 'spent_tokens',
    keyColumns: ['token_hash'],
    payloadColumn: null,
    serviceRoot: 'humanity',
    fileSubdir: null,
    fileLayout: 'humanity-spend-ledger.json tokens map {tokenHash: {expiresAtMs}} (single ledger)',
  },
  'persona.records': {
    id: 'persona.records',
    schema: 'persona',
    table: 'records',
    keyColumns: ['alias'],
    payloadColumn: 'payload',
    serviceRoot: 'persona',
    fileSubdir: 'personas',
    fileLayout: 'one {alias}.json per persona under personas/ holding PersonaRecord',
  },
  'persona.alias-tombstones': {
    id: 'persona.alias-tombstones',
    schema: 'persona',
    table: 'alias_tombstones',
    keyColumns: ['alias'],
    payloadColumn: 'payload',
    serviceRoot: 'persona',
    fileSubdir: 'tombstones',
    fileLayout: 'one {alias}.json per released alias under tombstones/ holding AliasReleaseTombstone',
  },
  'persona.revocations': {
    id: 'persona.revocations',
    schema: 'persona',
    table: 'revocations',
    keyColumns: ['persona_pubkey'],
    payloadColumn: null,
    serviceRoot: 'persona',
    fileSubdir: 'revoked',
    fileLayout: 'one bare {pubkey} marker file under revoked/ (existence = revoked)',
  },
  'hosted.subscriptions': {
    id: 'hosted.subscriptions',
    schema: 'hosted',
    table: 'subscriptions',
    keyColumns: ['subject_id'],
    payloadColumn: 'payload',
    serviceRoot: 'hosted',
    fileSubdir: 'subscriptions',
    fileLayout: 'one {sha256(subjectId)}.json per subject holding MeerkatHostedSubscription',
  },
  'hosted.app-purchases': {
    id: 'hosted.app-purchases',
    schema: 'hosted',
    table: 'app_purchases',
    keyColumns: ['subject_id'],
    payloadColumn: 'payload',
    serviceRoot: 'hosted',
    fileSubdir: 'purchases',
    fileLayout: 'one {sha256(subjectId)}.json per subject holding MeerkatAppPurchase',
  },
  'hosted.app-persona-bindings': {
    id: 'hosted.app-persona-bindings',
    schema: 'hosted',
    table: 'app_persona_bindings',
    keyColumns: ['subject_id', 'persona_hash'],
    payloadColumn: null,
    serviceRoot: 'hosted',
    fileSubdir: 'persona-bindings',
    fileLayout: 'one {sha256(subjectId)}.subject.json per binding holding {subjectId, personaHash}',
  },
  'moderation.triage': {
    id: 'moderation.triage',
    schema: 'moderation',
    table: 'triage',
    keyColumns: ['report_key'],
    payloadColumn: 'payload',
    serviceRoot: 'community',
    fileSubdir: 'operator-console',
    fileLayout: 'triage.json map {reportKey: ReportTriageRow} (single atomic file)',
  },
  'moderation.operator-audit': {
    id: 'moderation.operator-audit',
    schema: 'moderation',
    table: 'operator_audit',
    keyColumns: ['seq'],
    payloadColumn: 'payload',
    serviceRoot: 'community',
    fileSubdir: 'operator-console',
    fileLayout: 'audit.log JSONL append-only, one OperatorAuditRow per line keyed by seq',
  },
  'moderation.ncmec-reports': {
    id: 'moderation.ncmec-reports',
    schema: 'moderation',
    table: 'ncmec_reports',
    keyColumns: ['report_id'],
    payloadColumn: 'payload',
    serviceRoot: 'community',
    fileSubdir: 'ncmec-queue',
    fileLayout: 'reports/{id}.json one-file-per-report envelope (direct dir scan, order.log ignored)',
  },
  'moderation.dmca-claims': {
    id: 'moderation.dmca-claims',
    schema: 'moderation',
    table: 'dmca_claims',
    keyColumns: ['claim_id'],
    payloadColumn: 'payload',
    serviceRoot: 'community',
    fileSubdir: 'dmca-intake',
    fileLayout: 'claims/{id}.json one-file-per-claim (direct dir scan, order.log ignored)',
  },
  'ops.object-reference-keys': {
    id: 'ops.object-reference-keys',
    schema: 'ops',
    table: 'object_reference_keys',
    keyColumns: ['object_key'],
    payloadColumn: null,
    serviceRoot: 'community',
    fileSubdir: 'object-reference',
    fileLayout: 'object-reference-ledger.json records map {objectKey: referrer[]} (keys with any edges)',
  },
  'ops.object-reference-edges': {
    id: 'ops.object-reference-edges',
    schema: 'ops',
    table: 'object_reference_edges',
    keyColumns: ['object_key', 'referrer'],
    payloadColumn: null,
    serviceRoot: 'community',
    fileSubdir: 'object-reference',
    fileLayout: 'object-reference-ledger.json records map expanded to one edge per (objectKey, referrer)',
  },
  'ops.object-deletion-jobs': {
    id: 'ops.object-deletion-jobs',
    schema: 'ops',
    table: 'object_deletion_jobs',
    keyColumns: ['object_key'],
    payloadColumn: null,
    serviceRoot: 'community',
    fileSubdir: 'object-deletion',
    fileLayout: 'object-deletion-jobs.json jobs map {objectKey: ObjectDeletionJob} (single ledger)',
  },
};
