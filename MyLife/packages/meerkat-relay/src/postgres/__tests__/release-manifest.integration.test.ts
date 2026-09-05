import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresOperationsStore } from '../stores/operations-store';
import {
  canonicalizeManifest,
  verifyDeployAgainstManifest,
  parseReleaseManifest,
  type ReleaseManifest,
} from '../../release/release-manifest';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTests = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructiveTests ? describe.sequential : describe.skip;

const GIT_SHA = 'a'.repeat(40);
const DIGEST_A = `sha256:${'0'.repeat(64)}`;
const DIGEST_B = `sha256:${'1'.repeat(64)}`;

function buildManifest(): ReleaseManifest {
  return parseReleaseManifest({
    schemaVersion: 1,
    gitSha: GIT_SHA,
    images: [
      {
        name: 'relay',
        repository: 'ghcr.io/meerkat/relay',
        digest: DIGEST_A,
        sbomRef: 'ghcr.io/meerkat/relay:sbom',
        scanResultRef: 'ghcr.io/meerkat/relay:scan',
        attestationRef: 'ghcr.io/meerkat/relay:attest',
        signatureRef: 'ghcr.io/meerkat/relay:sig',
      },
    ],
    migrationRange: { lowest: 1, highest: 12 },
    configSchemaDigest: 'b'.repeat(64),
    mobileBuild: null,
    webArtifact: null,
    rollbackReleaseId: null,
  });
}

function digestFor(manifest: ReleaseManifest): string {
  return createHash('sha256').update(canonicalizeManifest(manifest), 'utf8').digest('hex');
}

describePostgres('release manifest record/approve/verify (live PostgreSQL)', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const scratchDb = `meerkat_test_release_${suffix}`;
  let adminPool: Pool;
  let scratchPool: Pool;
  let store: PostgresOperationsStore;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Release manifest integration requires a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${scratchDb}"`);
    const url = new URL(connectionString!);
    url.pathname = `/${scratchDb}`;
    scratchPool = new Pool({ connectionString: url.toString(), max: 4, statement_timeout: 30_000 });
    scratchPool.on('error', () => undefined);
    await runPostgresMigrations(scratchPool);
    store = new PostgresOperationsStore(new PostgresStoreContext(scratchPool));
  });

  afterAll(async () => {
    await scratchPool?.end().catch(() => undefined);
    await adminPool.query(`DROP DATABASE IF EXISTS "${scratchDb}" WITH (FORCE)`).catch(() => undefined);
    await adminPool.end().catch(() => undefined);
  });

  it('records, refuses a duplicate insert, approves once, and gates verification', async () => {
    const manifest = buildManifest();
    const releaseId = `release-${suffix}`;
    const manifestDigestHex = digestFor(manifest);

    // First insert lands.
    const inserted = await store.recordReleaseManifest({
      releaseId,
      gitSha: manifest.gitSha,
      manifest: manifest as unknown as Record<string, unknown>,
      manifestDigestHex,
    });
    expect(inserted).toBe(true);

    // A second insert of the same release id is a no-op: the durable row is immutable.
    const duplicate = await store.recordReleaseManifest({
      releaseId,
      gitSha: manifest.gitSha,
      manifest: { tampered: true },
      manifestDigestHex: 'f'.repeat(64),
    });
    expect(duplicate).toBe(false);
    const rowsBeforeApproval = await store.listReleaseManifests({ limit: 50 });
    const stored = rowsBeforeApproval.find((r) => r.releaseId === releaseId);
    expect(stored?.manifestDigestHex).toBe(manifestDigestHex);
    expect(stored?.manifest).toMatchObject({ schemaVersion: 1, gitSha: manifest.gitSha });
    expect(stored?.approvedAt).toBeNull();

    // Verification FAILS before approval: an unapproved manifest cannot gate a deploy.
    const preApproval = rowsBeforeApproval.find((r) => r.releaseId === releaseId);
    expect(preApproval?.approvedAt).toBeNull();

    // Approve with the correct expected version (1) succeeds.
    const version = await store.approveReleaseManifest(releaseId, 1);
    expect(version).toBe(2);

    // Re-approval is refused (CAS: version already advanced, approved_at set).
    expect(await store.approveReleaseManifest(releaseId, 1)).toBeNull();
    expect(await store.approveReleaseManifest(releaseId, 2)).toBeNull();

    // Now the manifest is approved: verification passes for the manifest's image.
    const approvedRows = await store.listReleaseManifests({ limit: 50 });
    const approved = approvedRows.find((r) => r.releaseId === releaseId);
    expect(approved?.approvedAt).not.toBeNull();
    const reparsed = parseReleaseManifest(approved!.manifest);
    expect(verifyDeployAgainstManifest(reparsed, [`ghcr.io/meerkat/relay@${DIGEST_A}`]).ok).toBe(true);

    // And FAILS for a tag-only or unknown-digest deploy ref.
    const tagOnly = verifyDeployAgainstManifest(reparsed, ['ghcr.io/meerkat/relay:latest']);
    expect(tagOnly.ok).toBe(false);
    expect(tagOnly.divergences[0]!.reason).toBe('tag_only_ref');
    const unknown = verifyDeployAgainstManifest(reparsed, [`ghcr.io/meerkat/relay@${DIGEST_B}`]);
    expect(unknown.ok).toBe(false);
    expect(unknown.divergences[0]!.reason).toBe('not_in_manifest');
  });

  it('refuses to approve an unknown release id', async () => {
    expect(await store.approveReleaseManifest(`missing-${suffix}`, 1)).toBeNull();
  });

  it('getReleaseManifest returns the durable row, and a post-record SQL edit is exposed by digest mismatch', async () => {
    const manifest = buildManifest();
    const releaseId = `release-tamper-${suffix}`;
    const manifestDigestHex = digestFor(manifest);
    await store.recordReleaseManifest({
      releaseId,
      gitSha: manifest.gitSha,
      manifest: manifest as unknown as Record<string, unknown>,
      manifestDigestHex,
    });
    const durable = await store.getReleaseManifest(releaseId);
    expect(durable?.manifestDigestHex).toBe(manifestDigestHex);
    expect(await store.getReleaseManifest(`missing-${suffix}`)).toBeNull();

    // A privileged SQL edit changes the stored jsonb but cannot forge the recorded
    // digest: recomputing the canonical digest (what --verify does) exposes it.
    await scratchPool.query(
      `UPDATE ops.release_manifests
         SET manifest = jsonb_set(manifest, '{images,0,digest}', to_jsonb($1::text))
       WHERE release_id = $2`,
      [DIGEST_B, releaseId],
    );
    const tampered = await store.getReleaseManifest(releaseId);
    const reparsed = parseReleaseManifest(tampered!.manifest);
    expect(digestFor(reparsed)).not.toBe(tampered!.manifestDigestHex);
  });
});
