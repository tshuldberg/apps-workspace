import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DmcaIntakeService } from '../../../dmca-intake';
import type { NcmecReportRecord } from '../../../ncmec-queue';
import type { OperatorTriageDecisionInput } from '../../../operator-console';
import { runPostgresMigrations } from '../../migrate';
import {
  PostgresStoreContext,
  PostgresStoreUnavailableError,
} from '../../store-context';
import { PostgresDmcaIntakeStore } from '../dmca-intake-store';
import { PostgresNcmecReportQueueStore } from '../ncmec-queue-store';
import { PostgresOperatorConsoleStore } from '../operator-console-store';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTests = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructiveTests
  ? describe.sequential
  : describe.skip;

function failingContext(): PostgresStoreContext {
  const failure = new Error('database unavailable');
  const pool = {
    query: async () => { throw failure; },
    connect: async () => { throw failure; },
  } as unknown as Pool;
  return new PostgresStoreContext(pool);
}

describe('PostgreSQL moderation outage mapping', () => {
  it('propagates operator store outages explicitly', async () => {
    // Arrange
    const store = new PostgresOperatorConsoleStore(failingContext());

    // Act and assert
    await expect(store.getTriage('01'.repeat(32)))
      .rejects.toBeInstanceOf(PostgresStoreUnavailableError);
  });

  it('propagates NCMEC store outages explicitly', async () => {
    // Arrange
    const store = new PostgresNcmecReportQueueStore(failingContext());

    // Act and assert
    await expect(store.get('02'.repeat(32)))
      .rejects.toBeInstanceOf(PostgresStoreUnavailableError);
  });

  it('propagates DMCA store outages explicitly', async () => {
    // Arrange
    const store = new PostgresDmcaIntakeStore(failingContext());

    // Act and assert
    await expect(store.get('03'.repeat(32)))
      .rejects.toBeInstanceOf(PostgresStoreUnavailableError);
  });
});

describePostgres('PostgreSQL moderation multi-instance integration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const isolatedDatabaseName = `meerkat_test_moderation_${suffix}`;
  let adminPool: Pool;
  let firstPool: Pool;
  let secondPool: Pool;
  let firstContext: PostgresStoreContext;
  let secondContext: PostgresStoreContext;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const database = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    const databaseName = database.rows[0]?.name ?? '';
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(databaseName)) {
      throw new Error('Moderation integration requires a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${isolatedDatabaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${isolatedDatabaseName}`;
    firstPool = new Pool({
      connectionString: databaseUrl.toString(),
      application_name: 'meerkat-moderation-integration-a',
      max: 4,
      statement_timeout: 30_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
    });
    firstPool.on('error', () => undefined);
    secondPool = new Pool({
      connectionString: databaseUrl.toString(),
      application_name: 'meerkat-moderation-integration-b',
      max: 4,
      statement_timeout: 30_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
    });
    secondPool.on('error', () => undefined);
    await runPostgresMigrations(firstPool);
    firstContext = new PostgresStoreContext(firstPool);
    secondContext = new PostgresStoreContext(secondPool);
  });

  beforeEach(async () => {
    await firstPool.query(`
      TRUNCATE TABLE moderation.triage,
        moderation.operator_audit,
        moderation.ncmec_reports,
        moderation.dmca_claims
      RESTART IDENTITY
    `);
  });

  afterAll(async () => {
    await Promise.all([firstPool.end(), secondPool.end()]);
    await adminPool.query(`DROP DATABASE IF EXISTS "${isolatedDatabaseName}" WITH (FORCE)`);
    await adminPool.end();
  });

  it('commits audit and triage together across competing operator instances', async () => {
    // Arrange
    const first = new PostgresOperatorConsoleStore(firstContext);
    const second = new PostgresOperatorConsoleStore(secondContext);
    const reportKey = '11'.repeat(32);
    const decision = (
      status: 'reviewed' | 'dismissed',
      reason: string,
    ): OperatorTriageDecisionInput => ({
      audit: {
        at: '2000-01-01T00:00:00.000Z',
        actorKeyHex: 'aa'.repeat(32),
        action: status === 'reviewed' ? 'report_reviewed' : 'report_dismissed',
        target: { reportKey },
        reason,
        outcome: 'ok',
      },
      triage: {
        reportKey,
        status,
        decidedAt: '2000-01-01T00:00:00.000Z',
        note: reason,
      },
    });

    // Act
    await Promise.all([
      first.recordTriageDecision(decision('reviewed', 'first')),
      second.recordTriageDecision(decision('dismissed', 'second')),
    ]);

    // Assert
    const audit = await first.listAudit(10);
    const triage = await second.getTriage(reportKey);
    expect(audit).toHaveLength(2);
    expect(new Set(audit.map((row) => row.seq)).size).toBe(2);
    const linked = audit.find((row) => row.seq === triage?.auditSeq);
    expect(linked?.reason).toBe(triage?.note);
    expect(Date.parse(linked!.at)).toBeGreaterThan(Date.parse('2026-01-01T00:00:00.000Z'));
  });

  it('gives competing NCMEC exporters disjoint fenced claims', async () => {
    // Arrange
    const first = new PostgresNcmecReportQueueStore(firstContext);
    const second = new PostgresNcmecReportQueueStore(secondContext);
    for (let index = 1; index <= 12; index += 1) {
      const record: NcmecReportRecord = {
        id: index.toString(16).padStart(64, '0'),
        source: 'operator_report',
        detectedAt: '2000-01-01T00:00:00.000Z',
        publicationId: 'publication',
        postId: `post-${index}`,
        reportKey: (index + 100).toString(16).padStart(64, '0'),
        reason: 'csam',
        status: 'queued',
      };
      await first.enqueue(record);
    }

    // Act
    const [firstClaims, secondClaims] = await Promise.all([
      first.claimQueuedForExport({ owner: 'postgres-a', limit: 10, leaseMs: 60_000, nowMs: 0 }),
      second.claimQueuedForExport({ owner: 'postgres-b', limit: 10, leaseMs: 60_000, nowMs: 0 }),
    ]);

    // Assert
    const firstIds = new Set(firstClaims.map((claim) => claim.record.id));
    const secondIds = new Set(secondClaims.map((claim) => claim.record.id));
    expect([...firstIds].some((id) => secondIds.has(id))).toBe(false);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(12);
    expect(await first.completeExportClaims({
      owner: 'postgres-a',
      claims: firstClaims.map((claim) => ({
        id: claim.record.id,
        fencingToken: claim.fencingToken,
      })),
      status: 'exported',
      nowMs: 0,
    })).toBe(true);
    expect(await second.completeExportClaims({
      owner: 'postgres-b',
      claims: secondClaims.map((claim) => ({
        id: claim.record.id,
        fencingToken: claim.fencingToken,
      })),
      status: 'exported',
      nowMs: 0,
    })).toBe(true);
    expect((await first.counts()).exported).toBe(12);
  });

  it('merges DMCA lifecycle races through CAS across two pools', async () => {
    // Arrange
    const first = new DmcaIntakeService(new PostgresDmcaIntakeStore(firstContext));
    const second = new DmcaIntakeService(new PostgresDmcaIntakeStore(secondContext));
    const submitted = await first.submitClaim({
      workDescription: 'Original photograph',
      claimedPostIds: ['post-a', 'post-b'],
      claimedUrls: [],
      claimant: {
        name: 'Claimant',
        email: 'claimant@example.com',
        address: '1 Main Street',
      },
      goodFaithStatement: true,
      accuracyStatement: true,
      signature: 'Claimant',
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    // Act
    await Promise.all([
      first.recordTakedown(submitted.record.id, ['post-a']),
      second.recordTakedown(submitted.record.id, ['post-b']),
    ]);

    // Assert
    const stored = await first.getClaim(submitted.record.id);
    expect(stored?.actionedPostIds?.sort()).toEqual(['post-a', 'post-b']);
    expect(stored?.lifecycleVersion).toBe(3);
    expect(Date.parse(stored!.receivedAt)).toBeGreaterThan(
      Date.parse('2026-01-01T00:00:00.000Z'),
    );
  });
});
