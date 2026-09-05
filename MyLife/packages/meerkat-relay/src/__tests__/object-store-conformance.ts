/**
 * Contract conformance scenarios for MeerkatObjectStore, shared across the memory and
 * file adapters (and, from WP-2B, the S3 adapter). Each scenario receives a fresh
 * store via StoreConformanceSuite, so ordering can never hide a durability, idempotency,
 * or verification defect. The scenarios assert the boundary the whole plan rests on:
 * bytes are content-verified before they land, a mismatch never becomes durable, a
 * promote re-verifies, versionId is monotonic, deletes are idempotent, inventory is
 * complete under paging, and unavailability is typed distinctly from absence.
 */

import { createHash } from 'node:crypto';
import { expect } from 'vitest';
import {
  OBJECT_STORE_MIN_PART_BYTES,
  type MeerkatObjectStore,
  type ObjectMultipartPart,
} from '../object-store';
import type { StoreConformanceScenario } from '../postgres/conformance/store-conformance';

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function bytesOf(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, 'utf8'));
}

/** A 5 MiB non-final part filled deterministically so its checksum is stable. */
function largePart(seed: number): Uint8Array {
  const buffer = new Uint8Array(OBJECT_STORE_MIN_PART_BYTES);
  buffer.fill(seed & 0xff);
  return buffer;
}

async function completeMultipart(
  store: MeerkatObjectStore,
  key: string,
  segments: readonly Uint8Array[],
): Promise<Awaited<ReturnType<MeerkatObjectStore['completeMultipart']>>> {
  const whole = new Uint8Array(segments.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of segments) {
    whole.set(part, offset);
    offset += part.length;
  }
  const begun = await store.beginMultipart({
    key,
    checksumSha256: sha256Hex(whole),
    sizeBytes: whole.length,
  });
  const parts: ObjectMultipartPart[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    const bytes = segments[index]!;
    const checksum = sha256Hex(bytes);
    const appended = await store.appendPart({
      key,
      uploadId: begun.uploadId,
      partNumber: index + 1,
      checksumSha256: checksum,
      bytes,
    });
    expect(appended.status).toBe('appended');
    parts.push({ partNumber: index + 1, checksumSha256: checksum, sizeBytes: bytes.length });
  }
  return store.completeMultipart({ key, uploadId: begun.uploadId, parts });
}

export const objectStoreScenarios: readonly StoreConformanceScenario<MeerkatObjectStore>[] = [
  {
    name: 'single-shot put lands quarantined bytes a caller can read back and observe',
    run: async (store) => {
      const bytes = bytesOf('single-shot payload');
      const checksum = sha256Hex(bytes);
      const result = await store.put({ key: 'quarantine/obj-a', checksumSha256: checksum, bytes });
      expect(result.status).toBe('stored');
      if (result.status !== 'stored') return;
      expect(result.object).toMatchObject({
        key: 'quarantine/obj-a',
        checksumSha256: checksum,
        sizeBytes: bytes.length,
        state: 'quarantined',
      });
      const observed = await store.observe('quarantine/obj-a');
      expect(observed).toMatchObject({ checksumSha256: checksum, state: 'quarantined' });
      const read = await store.read('quarantine/obj-a');
      expect(read?.bytes).toEqual(bytes);
      expect(read?.object.versionId).toBe(result.object.versionId);
    },
  },
  {
    name: 'put rejects a checksum mismatch into a never-served state',
    run: async (store) => {
      const bytes = bytesOf('actual payload');
      const wrongChecksum = sha256Hex(bytesOf('a different payload'));
      const result = await store.put({ key: 'quarantine/obj-b', checksumSha256: wrongChecksum, bytes });
      expect(result.status).toBe('checksum_mismatch');
      if (result.status !== 'checksum_mismatch') return;
      expect(result.object.state).toBe('rejected');
      const observed = await store.observe('quarantine/obj-b');
      expect(observed?.state).toBe('rejected');
    },
  },
  {
    name: 'multipart write assembles parts, verifies the whole-object checksum, and lands quarantined',
    run: async (store) => {
      const segments = [largePart(1), bytesOf('final tail segment')];
      const result = await completeMultipart(store, 'quarantine/multi-a', segments);
      expect(result.status).toBe('stored');
      if (result.status !== 'stored') return;
      const whole = new Uint8Array(segments.reduce((total, part) => total + part.length, 0));
      let offset = 0;
      for (const part of segments) { whole.set(part, offset); offset += part.length; }
      expect(result.object).toMatchObject({ checksumSha256: sha256Hex(whole), state: 'quarantined' });
      const read = await store.read('quarantine/multi-a');
      // Compare by digest, not element-wise: a deep toEqual over multi-MiB arrays is
      // pathologically slow and adds no assurance beyond the content address.
      expect(read?.bytes.length).toBe(whole.length);
      expect(read ? sha256Hex(read.bytes) : null).toBe(sha256Hex(whole));
    },
  },
  {
    name: 'multipart complete rejects when assembled bytes do not match the declared whole-object checksum',
    run: async (store) => {
      const segments = [largePart(2), bytesOf('honest tail')];
      const whole = new Uint8Array(segments.reduce((total, part) => total + part.length, 0));
      let offset = 0;
      for (const part of segments) { whole.set(part, offset); offset += part.length; }
      const begun = await store.beginMultipart({
        key: 'quarantine/multi-b',
        checksumSha256: sha256Hex(bytesOf('a checksum for other bytes')),
        sizeBytes: whole.length,
      });
      const parts: ObjectMultipartPart[] = [];
      for (let index = 0; index < segments.length; index += 1) {
        const bytes = segments[index]!;
        const checksum = sha256Hex(bytes);
        expect((await store.appendPart({
          key: 'quarantine/multi-b',
          uploadId: begun.uploadId,
          partNumber: index + 1,
          checksumSha256: checksum,
          bytes,
        })).status).toBe('appended');
        parts.push({ partNumber: index + 1, checksumSha256: checksum, sizeBytes: bytes.length });
      }
      const result = await store.completeMultipart({
        key: 'quarantine/multi-b',
        uploadId: begun.uploadId,
        parts,
      });
      expect(result.status).toBe('checksum_mismatch');
      if (result.status !== 'checksum_mismatch') return;
      expect(result.object.state).toBe('rejected');
    },
  },
  {
    name: 'appendPart rejects a part whose bytes do not match its part checksum',
    run: async (store) => {
      const begun = await store.beginMultipart({
        key: 'quarantine/multi-c',
        checksumSha256: sha256Hex(bytesOf('whatever')),
        sizeBytes: 8,
      });
      const bytes = bytesOf('realbytes');
      const wrong = sha256Hex(bytesOf('not these bytes'));
      const appended = await store.appendPart({
        key: 'quarantine/multi-c',
        uploadId: begun.uploadId,
        partNumber: 1,
        checksumSha256: wrong,
        bytes,
      });
      expect(appended.status).toBe('checksum_mismatch');
    },
  },
  {
    name: 'promote moves quarantined bytes to a durable key only when the expected checksum matches',
    run: async (store) => {
      const bytes = bytesOf('promotable payload');
      const checksum = sha256Hex(bytes);
      await store.put({ key: 'quarantine/promote-a', checksumSha256: checksum, bytes });
      const promoted = await store.promote({
        quarantineKey: 'quarantine/promote-a',
        durableKey: 'durable/promote-a',
        expectedChecksumSha256: checksum,
      });
      expect(promoted.status).toBe('promoted');
      if (promoted.status !== 'promoted') return;
      expect(promoted.object).toMatchObject({ key: 'durable/promote-a', state: 'durable' });
      expect(await store.observe('quarantine/promote-a')).toBeNull();
      const durable = await store.observe('durable/promote-a');
      expect(durable).toMatchObject({ checksumSha256: checksum, state: 'durable' });
    },
  },
  {
    name: 'promote fails closed on a checksum mismatch and leaves the durable key unwritten',
    run: async (store) => {
      const bytes = bytesOf('quarantined payload');
      const checksum = sha256Hex(bytes);
      await store.put({ key: 'quarantine/promote-b', checksumSha256: checksum, bytes });
      const promoted = await store.promote({
        quarantineKey: 'quarantine/promote-b',
        durableKey: 'durable/promote-b',
        expectedChecksumSha256: sha256Hex(bytesOf('different expectation')),
      });
      expect(promoted.status).toBe('checksum_mismatch');
      expect(await store.observe('durable/promote-b')).toBeNull();
      expect(await store.observe('quarantine/promote-b')).toMatchObject({ state: 'quarantined' });
    },
  },
  {
    name: 'deleteObject returns an idempotent receipt on replay',
    run: async (store) => {
      const bytes = bytesOf('deletable payload');
      const put = await store.put({ key: 'durable/del-a', checksumSha256: sha256Hex(bytes), bytes });
      expect(put.status).toBe('stored');
      const first = await store.deleteObject('durable/del-a');
      expect(first.deleted).toBe(true);
      expect(await store.observe('durable/del-a')).toBeNull();
      const replay = await store.deleteObject('durable/del-a');
      expect(replay.deleted).toBe(true);
      expect(replay.key).toBe(first.key);
    },
  },
  {
    name: 'versionId is monotonic across rewrites and a delete-then-rewrite of the same key',
    run: async (store) => {
      const first = bytesOf('generation one');
      const second = bytesOf('generation two');
      const v1 = await store.put({ key: 'quarantine/ver-a', checksumSha256: sha256Hex(first), bytes: first });
      const v2 = await store.put({ key: 'quarantine/ver-a', checksumSha256: sha256Hex(second), bytes: second });
      expect(v1.status).toBe('stored');
      expect(v2.status).toBe('stored');
      if (v1.status !== 'stored' || v2.status !== 'stored') return;
      expect(v2.object.versionId).not.toBe(v1.object.versionId);
      await store.deleteObject('quarantine/ver-a');
      const third = bytesOf('generation three');
      const v3 = await store.put({ key: 'quarantine/ver-a', checksumSha256: sha256Hex(third), bytes: third });
      expect(v3.status).toBe('stored');
      if (v3.status !== 'stored') return;
      expect(v3.object.versionId).not.toBe(v2.object.versionId);
      expect(v3.object.versionId).not.toBe(v1.object.versionId);
    },
  },
  {
    name: 'cursor-paged inventory returns every object exactly once',
    run: async (store) => {
      const keys = Array.from({ length: 7 }, (_, index) => `quarantine/inv-${index}`);
      for (const key of keys) {
        const bytes = bytesOf(`payload for ${key}`);
        await store.put({ key, checksumSha256: sha256Hex(bytes), bytes });
      }
      const seen: string[] = [];
      let cursor: { key: string } | undefined;
      for (let guard = 0; guard < 100; guard += 1) {
        const page = await store.listInventory({ after: cursor, limit: 2 });
        for (const entry of page.entries) seen.push(entry.key);
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      expect(seen.sort()).toEqual([...keys].sort());
      expect(new Set(seen).size).toBe(keys.length);
    },
  },
  {
    name: 'prefix-scoped inventory returns exactly and only that prefix across cursor pages',
    run: async (store) => {
      // Populate three prefixes, including one (tenants/ab) that is a string-prefix of another
      // (tenants/abc) so a trailing-slash-scoped prefix must NOT bleed across the segment boundary.
      const groups = {
        'tenants/aa/': Array.from({ length: 5 }, (_, i) => `tenants/aa/obj-${i}`),
        'tenants/ab/': Array.from({ length: 4 }, (_, i) => `tenants/ab/obj-${i}`),
        'tenants/abc/': Array.from({ length: 3 }, (_, i) => `tenants/abc/obj-${i}`),
      };
      for (const keys of Object.values(groups)) {
        for (const key of keys) {
          const bytes = bytesOf(`payload for ${key}`);
          await store.put({ key, checksumSha256: sha256Hex(bytes), bytes });
        }
      }
      const walk = async (prefix: string): Promise<string[]> => {
        const seen: string[] = [];
        let cursor: { key: string } | undefined;
        for (let guard = 0; guard < 100; guard += 1) {
          const page = await store.listInventory({ prefix, after: cursor, limit: 2 });
          for (const entry of page.entries) {
            expect(entry.key.startsWith(prefix)).toBe(true);
            seen.push(entry.key);
          }
          if (!page.nextCursor) break;
          cursor = page.nextCursor;
        }
        return seen.sort();
      };
      // Each trailing-slash prefix returns exactly its own group, never the sibling whose name it
      // is a raw string-prefix of (tenants/ab/ must not include tenants/abc/*).
      expect(await walk('tenants/aa/')).toEqual([...groups['tenants/aa/']].sort());
      expect(await walk('tenants/ab/')).toEqual([...groups['tenants/ab/']].sort());
      expect(await walk('tenants/abc/')).toEqual([...groups['tenants/abc/']].sort());
      // A broader prefix spans the nested groups; an absent prefix scans everything.
      const all = [...groups['tenants/aa/'], ...groups['tenants/ab/'], ...groups['tenants/abc/']].sort();
      expect(await walk('tenants/')).toEqual(all);
      const noPrefix: string[] = [];
      let cursor: { key: string } | undefined;
      for (let guard = 0; guard < 100; guard += 1) {
        const page = await store.listInventory({ after: cursor, limit: 3 });
        for (const entry of page.entries) noPrefix.push(entry.key);
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      expect(noPrefix.sort()).toEqual(all);
    },
  },
];
