import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DmcaIntakeService,
  InMemoryDmcaIntakeStore,
  type DmcaIntakeStore,
} from '../dmca-intake';
import { FileDmcaIntakeStore } from '../dmca-intake-store-file';
import {
  InMemoryNcmecReportQueueStore,
  type NcmecReportQueueStore,
  type NcmecReportRecord,
} from '../ncmec-queue';
import { FileNcmecReportQueueStore } from '../ncmec-queue-store-file';
import {
  InMemoryOperatorConsoleStore,
  type OperatorConsoleStore,
  type OperatorTriageDecisionInput,
} from '../operator-console';
import { FileOperatorConsoleStore } from '../operator-console-store-file';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(label: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), `meerkat-${label}-`));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.rm(directory, { recursive: true, force: true })));
});

interface SharedStorePair<Store> {
  first: Store;
  second: Store;
}

const operatorFactories: Array<{
  name: string;
  create: () => Promise<SharedStorePair<OperatorConsoleStore>>;
}> = [
  {
    name: 'memory',
    create: async () => {
      const store = new InMemoryOperatorConsoleStore();
      return { first: store, second: store };
    },
  },
  {
    name: 'file',
    create: async () => {
      const directory = await temporaryDirectory('operator-conformance');
      return {
        first: new FileOperatorConsoleStore(directory),
        second: new FileOperatorConsoleStore(directory),
      };
    },
  },
];

function triageDecision(
  reportKey: string,
  status: 'reviewed' | 'dismissed',
  reason: string,
): OperatorTriageDecisionInput {
  return {
    audit: {
      at: '2026-07-10T12:00:00.000Z',
      actorKeyHex: 'ab'.repeat(32),
      action: status === 'reviewed' ? 'report_reviewed' : 'report_dismissed',
      target: { reportKey },
      reason,
      outcome: 'ok',
    },
    triage: {
      reportKey,
      status,
      decidedAt: '2026-07-10T12:00:00.000Z',
      note: reason,
    },
  };
}

for (const factory of operatorFactories) {
  describe(`${factory.name} operator console store conformance`, () => {
    it('atomically links each triage decision to its immutable audit row', async () => {
      // Arrange
      const { first } = await factory.create();
      const reportKey = '01'.repeat(32);

      // Act
      const result = await first.recordTriageDecision(
        triageDecision(reportKey, 'reviewed', 'confirmed'),
      );
      result.audit.target.reportKey = 'mutated';
      result.triage.note = 'mutated';

      // Assert
      const [audit] = await first.listAudit(10);
      const triage = await first.getTriage(reportKey);
      expect(audit?.target.reportKey).toBe(reportKey);
      expect(triage?.note).toBe('confirmed');
      expect(triage?.auditSeq).toBe(audit?.seq);
    });

    it('serializes concurrent decisions across store instances without orphaned triage', async () => {
      // Arrange
      const { first, second } = await factory.create();
      const reportKey = '02'.repeat(32);

      // Act
      await Promise.all([
        first.recordTriageDecision(triageDecision(reportKey, 'reviewed', 'first')),
        second.recordTriageDecision(triageDecision(reportKey, 'dismissed', 'second')),
      ]);

      // Assert
      const audit = await first.listAudit(10);
      const triage = await second.getTriage(reportKey);
      expect(audit).toHaveLength(2);
      expect(new Set(audit.map((row) => row.seq)).size).toBe(2);
      const linked = audit.find((row) => row.seq === triage?.auditSeq);
      expect(linked).toBeDefined();
      expect(linked?.reason).toBe(triage?.note);
      expect(linked?.action).toBe(
        triage?.status === 'reviewed' ? 'report_reviewed' : 'report_dismissed',
      );
    });
  });
}

const ncmecFactories: Array<{
  name: string;
  create: () => Promise<SharedStorePair<NcmecReportQueueStore>>;
}> = [
  {
    name: 'memory',
    create: async () => {
      const store = new InMemoryNcmecReportQueueStore();
      return { first: store, second: store };
    },
  },
  {
    name: 'file',
    create: async () => {
      const directory = await temporaryDirectory('ncmec-conformance');
      return {
        first: new FileNcmecReportQueueStore(directory),
        second: new FileNcmecReportQueueStore(directory),
      };
    },
  },
];

function ncmecRecord(index: number): NcmecReportRecord {
  return {
    id: index.toString(16).padStart(64, '0'),
    source: 'operator_report',
    detectedAt: new Date(Date.UTC(2026, 6, 10, 12, 0, index)).toISOString(),
    publicationId: 'publication',
    postId: `post-${index}`,
    reportKey: (index + 100).toString(16).padStart(64, '0'),
    reason: 'csam',
    status: 'queued',
  };
}

for (const factory of ncmecFactories) {
  describe(`${factory.name} NCMEC queue store conformance`, () => {
    it('claims disjoint bounded batches across concurrent exporters', async () => {
      // Arrange
      const { first, second } = await factory.create();
      for (let index = 1; index <= 8; index += 1) await first.enqueue(ncmecRecord(index));

      // Act
      const [firstClaims, secondClaims] = await Promise.all([
        first.claimQueuedForExport({ owner: 'exporter-a', limit: 4, leaseMs: 60_000, nowMs: 1_000 }),
        second.claimQueuedForExport({ owner: 'exporter-b', limit: 4, leaseMs: 60_000, nowMs: 1_000 }),
      ]);

      // Assert
      const firstIds = new Set(firstClaims.map((claim) => claim.record.id));
      const secondIds = new Set(secondClaims.map((claim) => claim.record.id));
      expect(firstClaims).toHaveLength(4);
      expect(secondClaims).toHaveLength(4);
      expect([...firstIds].some((id) => secondIds.has(id))).toBe(false);
      expect(new Set([...firstIds, ...secondIds]).size).toBe(8);
    });

    it('fences stale exporters after an expired claim is reclaimed', async () => {
      // Arrange
      const { first, second } = await factory.create();
      const record = await first.enqueue(ncmecRecord(20));
      const [stale] = await first.claimQueuedForExport({
        owner: 'stale-exporter',
        limit: 1,
        leaseMs: 10,
        nowMs: 1_000,
      });

      // Act
      const [current] = await second.claimQueuedForExport({
        owner: 'current-exporter',
        limit: 1,
        leaseMs: 10,
        nowMs: 1_011,
      });
      const staleCompletion = await first.completeExportClaims({
        owner: 'stale-exporter',
        claims: [{ id: record.id, fencingToken: stale!.fencingToken }],
        status: 'exported',
        nowMs: 1_011,
      });
      const currentCompletion = await second.completeExportClaims({
        owner: 'current-exporter',
        claims: [{ id: record.id, fencingToken: current!.fencingToken }],
        status: 'exported',
        nowMs: 1_011,
      });

      // Assert
      expect(current!.fencingToken).toBeGreaterThan(stale!.fencingToken);
      expect(staleCompletion).toBe(false);
      expect(currentCompletion).toBe(true);
      expect((await first.get(record.id))?.status).toBe('exported');
    });

    it('rejects oversized and unbounded evidence records before persistence', async () => {
      const { first } = await factory.create();
      await expect(Promise.resolve().then(() => first.enqueue({
        ...ncmecRecord(30),
        matchedBlobHashes: Array.from({ length: 257 }, (_, index) =>
          index.toString(16).padStart(64, '0')),
      }))).rejects.toThrow(/evidence hashes/u);
      await expect(Promise.resolve().then(() => first.enqueue({
        ...ncmecRecord(31),
        reason: 'x'.repeat(513),
      }))).rejects.toThrow(/evidence reference/u);
      expect(await first.counts()).toEqual({ queued: 0, exported: 0, filed: 0, escalated: 0, total: 0 });
    });
  });
}

const dmcaFactories: Array<{
  name: string;
  create: () => Promise<SharedStorePair<DmcaIntakeStore>>;
}> = [
  {
    name: 'memory',
    create: async () => {
      const store = new InMemoryDmcaIntakeStore();
      return { first: store, second: store };
    },
  },
  {
    name: 'file',
    create: async () => {
      const directory = await temporaryDirectory('dmca-conformance');
      return {
        first: new FileDmcaIntakeStore(directory),
        second: new FileDmcaIntakeStore(directory),
      };
    },
  },
];

const validClaim = {
  workDescription: 'Original photograph',
  claimedPostIds: ['post-a', 'post-b'],
  claimedUrls: [] as string[],
  claimant: {
    name: 'Claimant',
    email: 'claimant@example.com',
    address: '1 Main Street',
  },
  goodFaithStatement: true as const,
  accuracyStatement: true as const,
  signature: 'Claimant',
};

for (const factory of dmcaFactories) {
  describe(`${factory.name} DMCA store conformance`, () => {
    it('merges concurrent takedown mutations through versioned compare-and-set retries', async () => {
      // Arrange
      const { first, second } = await factory.create();
      const firstService = new DmcaIntakeService(first, { now: () => 1_752_148_800_000 });
      const secondService = new DmcaIntakeService(second, { now: () => 1_752_148_800_000 });
      const submitted = await firstService.submitClaim(validClaim);
      expect(submitted.ok).toBe(true);
      if (!submitted.ok) return;

      // Act
      await Promise.all([
        firstService.recordTakedown(submitted.record.id, ['post-a']),
        secondService.recordTakedown(submitted.record.id, ['post-b']),
      ]);

      // Assert
      const stored = await firstService.getClaim(submitted.record.id);
      expect(stored?.status).toBe('actioned');
      expect(stored?.actionedPostIds?.sort()).toEqual(['post-a', 'post-b']);
      expect(stored?.lifecycleVersion).toBe(3);
    });

    it('allows only one writer to apply the same expected lifecycle version', async () => {
      // Arrange
      const { first, second } = await factory.create();
      const service = new DmcaIntakeService(first, { now: () => 1_752_148_800_000 });
      const submitted = await service.submitClaim(validClaim);
      expect(submitted.ok).toBe(true);
      if (!submitted.ok) return;
      const expectedVersion = submitted.record.lifecycleVersion;

      // Act
      const results = await Promise.all([
        first.compareAndSetLifecycle({
          id: submitted.record.id,
          expectedVersion,
          lifecycle: { status: 'rejected' },
        }),
        second.compareAndSetLifecycle({
          id: submitted.record.id,
          expectedVersion,
          lifecycle: { status: 'actioned', actionedPostIds: ['post-a'] },
        }),
      ]);

      // Assert
      expect(results.filter((result) => result.status === 'applied')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'conflict')).toHaveLength(1);
      expect((await service.getClaim(submitted.record.id))?.lifecycleVersion).toBe(2);
    });
  });
}
