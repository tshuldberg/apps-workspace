import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import {
  createPublication,
  generateDeviceIdentity,
} from '@mylife/sync';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FilePublicationStore } from '../../community-node';
import { PostgresPublicationStore } from '../stores/community-stores';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import {
  shadowedStore,
  type ShadowEvent,
} from '../../shadow-state-comparator';
import { publicationStoreClassification } from '../../shadow-store-classifications';

/**
 * WP-3B live integration proof: one REAL store pair (file PRIMARY + PostgreSQL SHADOW)
 * driven through shadowed reads. It seeds the two backends OUT OF SYNC (the shadow is
 * missing one publication), reads through the wrapper, and asserts the comparator fires a
 * `divergence` event with BOUNDED summaries (digests, never the record body). Gated on a
 * live PostgreSQL URL plus the destructive opt-in, matching the community-stores suite.
 */

const adminConnectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = adminConnectionString && destructive ? describe.sequential : describe.skip;

/**
 * Wait (up to ~2s) for the fire-and-forget shadow work to push a matching event into the
 * sink. The shadow read is concurrent, so under full-suite DB contention a fixed microtask
 * flush is not enough; poll until the predicate matches or the deadline passes.
 */
async function waitForEvent(
  events: ShadowEvent[],
  match: (event: ShadowEvent) => boolean,
): Promise<ShadowEvent | undefined> {
  for (let i = 0; i < 200; i += 1) {
    const hit = events.find(match);
    if (hit) return hit;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return events.find(match);
}

function publicationFixture(title: string) {
  const owner = generateDeviceIdentity(`shadow-owner-${title}`);
  const signed = createPublication(owner, {
    kind: 'community',
    communityId: `community-${randomUUID()}`,
    title,
    description: 'shadow comparator fixture',
    category: 'technology',
    contentId: `content-${randomUUID()}`,
    publicKeyHex: 'ab'.repeat(32),
    now: '2026-07-10T00:00:00.000Z',
  });
  return { publicationId: signed.descriptor.publicationId, record: { signed, snapshots: [] } };
}

describePostgres('shadow comparator over a live file + PostgreSQL publications pair', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_shadow_${suffix}`;
  const adminPool = new Pool({ connectionString: adminConnectionString });
  adminPool.on('error', () => undefined);
  let pool: Pool;
  let context: PostgresStoreContext;
  let root: string;

  beforeAll(async () => {
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(adminConnectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: databaseUrl.toString(), max: 4 });
    pool.on('error', () => undefined);
    context = new PostgresStoreContext(pool);
    await runPostgresMigrations(pool);
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-shadow-live-'));
  });

  afterAll(async () => {
    await pool?.end();
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await adminPool.end();
    if (root) await fs.rm(root, { recursive: true, force: true });
  });

  it('agrees when both backends hold the same record and diverges when they do not', async () => {
    const events: ShadowEvent[] = [];
    const filePrimary = new FilePublicationStore(path.join(root, 'publications'));
    const postgresShadow = new PostgresPublicationStore(context);
    const wrapped = shadowedStore(filePrimary, postgresShadow, {
      store: 'community.publications',
      classification: publicationStoreClassification,
      sink: (event) => events.push(event),
      agreementSampleEvery: 1,
    });

    // In-sync record: write to BOTH backends through the wrapper (a write mirrors), then a
    // read agrees.
    const shared = publicationFixture('Shared');
    await wrapped.put(shared.publicationId, shared.record);
    // Wait for the mirrored write to actually land on the postgres shadow before reading.
    for (let i = 0; i < 50 && (await postgresShadow.get(shared.publicationId)) === null; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const readBack = await wrapped.get(shared.publicationId);
    expect(readBack?.signed.descriptor.title).toBe('Shared');

    // Seed a divergence: put a record on the file PRIMARY ONLY (bypassing the wrapper so the
    // shadow never sees it), so a read returns a value on primary and null on shadow.
    const primaryOnly = publicationFixture('PrimaryOnly');
    await filePrimary.put(primaryOnly.publicationId, primaryOnly.record);
    events.length = 0;
    const diverged = await wrapped.get(primaryOnly.publicationId);
    expect(diverged?.signed.descriptor.title).toBe('PrimaryOnly'); // primary result wins
    // Wait for the concurrent shadow read + compare to settle (poll under DB contention).
    const divergence = await waitForEvent(events, (event) => event.kind === 'divergence');
    expect(divergence).toBeDefined();
    if (divergence?.kind !== 'divergence') throw new Error('expected divergence');
    expect(divergence.store).toBe('community.publications');
    expect(divergence.method).toBe('get');
    // Bounded summaries: the primary has an object, the shadow is null; NEITHER carries the
    // publication body or the owner pubkey.
    expect(divergence.primarySummary.kind).toBe('object');
    expect(divergence.shadowSummary.kind).toBe('null');
    const serialized = JSON.stringify(divergence);
    expect(serialized).not.toContain('PrimaryOnly');
    expect(serialized).not.toContain(primaryOnly.publicationId);
  });

  it('reports a bounded list divergence when the two backends hold different rows', async () => {
    const events: ShadowEvent[] = [];
    // A dedicated file dir; the shadow reads the shared DB. The primary holds MORE rows than
    // the shadow can (the file dir is fresh), so list() diverges by digest deterministically.
    const filePrimary = new FilePublicationStore(path.join(root, `list-${randomUUID()}`));
    const postgresShadow = new PostgresPublicationStore(context);
    const wrapped = shadowedStore(filePrimary, postgresShadow, {
      store: 'community.publications',
      classification: publicationStoreClassification,
      sink: (event) => events.push(event),
    });

    // Seed the file primary with two records the shadow DB does not contain, then confirm the
    // two backends' list() results actually differ before driving the wrapper (no flakiness on
    // prior-test DB state: whatever the shadow holds, the primary holds a strict superset).
    for (const title of ['ListA', 'ListB']) {
      const fixture = publicationFixture(title);
      await filePrimary.put(fixture.publicationId, fixture.record);
    }
    const primaryList = await filePrimary.list();
    const shadowList = await postgresShadow.list();
    expect(primaryList.length).toBeGreaterThan(shadowList.length);

    await wrapped.list();
    const divergence = await waitForEvent(
      events,
      (event) => event.kind === 'divergence' && event.method === 'list',
    );
    expect(divergence).toBeDefined();
    if (divergence?.kind !== 'divergence') throw new Error('expected list divergence');
    expect(divergence.primarySummary.size).toBeGreaterThanOrEqual(2);
    expect(divergence.primarySummary.digest).not.toBe(divergence.shadowSummary.digest);
    // The digests are 16-hex-char bounded, never the array contents.
    expect(divergence.primarySummary.digest).toMatch(/^[0-9a-f]{16}$/);
  });
});
