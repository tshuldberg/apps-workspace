import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createDescriptorKill,
  createPublication,
  createPublicAbuseReport,
  generateDeviceIdentity,
  type SignedPublicAbuseReport,
} from '@mylife/sync';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FileCommunityDescriptorStore,
  FileKillStore,
  FilePublicationStore,
  FileReportStore,
  InMemoryCommunityDescriptorStore,
  InMemoryKillStore,
  InMemoryPublicationStore,
  InMemoryReportStore,
  type CommunityDescriptorStore,
  type KillStore,
  type PublicationStore,
  type ReportStore,
  type StoredPublication,
} from '../../community-node';
import { PostgresKillStore } from '../stores/community-stores';
import { PostgresStoreUnavailableError, type PostgresStoreContext } from '../store-context';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-community-store-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.rm(directory, { recursive: true, force: true })));
});

async function expectDescriptorClaimContract(store: CommunityDescriptorStore): Promise<void> {
  expect(await store.claimRevision('community-a', 1, 'hash-a')).toBe('inserted');
  expect(await store.claimRevision('community-a', 1, 'hash-a')).toBe('idempotent');
  expect(await store.claimRevision('community-a', 1, 'hash-b')).toBe('conflict');
  expect(await store.claimRevision('community-a', 0, 'hash-old')).toBe('stale');
  expect(await store.claimRevision('community-a', 2, 'hash-c')).toBe('inserted');
  expect(await store.getHighestRevision('community-a')).toEqual({
    revision: 2,
    descriptorHash: 'hash-c',
  });
}

async function expectPublicationReplaceContract(store: PublicationStore): Promise<void> {
  const owner = generateDeviceIdentity('publication-owner');
  const first = createPublication(owner, {
    kind: 'community',
    communityId: 'community-a',
    title: 'First',
    description: 'first publication',
    category: 'technology',
    contentId: 'content-a',
    publicKeyHex: 'ab'.repeat(32),
    now: '2026-07-10T00:00:00.000Z',
  });
  const record: StoredPublication = { signed: first, snapshots: [] };
  await store.withPublicationWriteLock(first.descriptor.publicationId, async () => {
    expect(await store.replace(first.descriptor.publicationId, null, record)).toBe('inserted');
  });
  expect(await store.replace(first.descriptor.publicationId, null, record)).toBe('conflict');
  expect((await store.get(first.descriptor.publicationId))?.signed.signature).toBe(first.signature);
}

async function expectKillContract(store: KillStore): Promise<void> {
  const authority = generateDeviceIdentity('kill-authority');
  expect(await store.isKilled('community-a')).toBe(false);
  await store.recordKill(createDescriptorKill(
    authority,
    'community-a',
    'policy',
    '2026-07-10T00:00:00.000Z',
  ));
  expect(await store.isKilled('community-a')).toBe(true);
  expect(await store.loadKilledCommunityIds()).toContain('community-a');
}

function reports(count: number): SignedPublicAbuseReport[] {
  return Array.from({ length: count }, (_, index) => createPublicAbuseReport(
    generateDeviceIdentity(`reporter-${index}`),
    {
      publicationId: 'publication-a',
      targetKind: 'post',
      targetId: `post-${index}`,
      reason: index === count - 1 ? 'csam' : 'spam',
      reportedAt: new Date(Date.UTC(2026, 6, 10, 0, 0, index)).toISOString(),
    },
  ));
}

async function expectReportCapContract(store: ReportStore): Promise<void> {
  for (const report of reports(6)) {
    await store.appendCapped('publication-a', report, 3);
  }
  const stored = await store.get('publication-a');
  expect(stored).toHaveLength(3);
  expect(stored?.some((report) => report.report.reason === 'csam')).toBe(true);
}

describe('community mutable-store conformance', () => {
  it('shares descriptor claim outcomes across memory and file stores', async () => {
    await expectDescriptorClaimContract(new InMemoryCommunityDescriptorStore());
    await expectDescriptorClaimContract(new FileCommunityDescriptorStore(await temporaryDirectory()));
  });

  it('serializes conflicting descriptor claims across file-store processes', async () => {
    const directory = await temporaryDirectory();
    const first = new FileCommunityDescriptorStore(directory);
    const second = new FileCommunityDescriptorStore(directory);
    const outcomes = await Promise.all([
      first.claimRevision('community-race', 1, 'hash-a'),
      second.claimRevision('community-race', 1, 'hash-b'),
    ]);
    expect(outcomes.sort()).toEqual(['conflict', 'inserted']);
  });

  it('shares publication replacement semantics across memory and file stores', async () => {
    await expectPublicationReplaceContract(new InMemoryPublicationStore());
    await expectPublicationReplaceContract(new FilePublicationStore(await temporaryDirectory()));
  });

  it('reads kills live and caps report appends across memory and file stores', async () => {
    await expectKillContract(new InMemoryKillStore());
    await expectKillContract(new FileKillStore(await temporaryDirectory()));
    await expectReportCapContract(new InMemoryReportStore());
    await expectReportCapContract(new FileReportStore(await temporaryDirectory()));
  });

  it('keeps concurrent file report appends within the shared cap', async () => {
    const directory = await temporaryDirectory();
    const first = new FileReportStore(directory);
    const second = new FileReportStore(directory);
    await Promise.all(reports(20).map((report, index) =>
      (index % 2 === 0 ? first : second).appendCapped('publication-a', report, 5)));
    const stored = await first.get('publication-a');
    expect(stored).toHaveLength(5);
    expect(stored?.some((report) => report.report.reason === 'csam')).toBe(true);
  });

  it('maps database failures to explicit unavailable errors', async () => {
    const context = {
      query: async () => { throw new Error('database offline'); },
    } as unknown as PostgresStoreContext;
    await expect(new PostgresKillStore(context).isKilled('community-a')).rejects.toBeInstanceOf(
      PostgresStoreUnavailableError,
    );
  });
});
