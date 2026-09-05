/**
 * FileCommunityDescriptorStore atomic-write acceptance (launch item 2).
 *
 * recordRevision must write the durable {revision, descriptorHash} file ATOMICALLY
 * (temp + rename), never a raw truncating fs.writeFile. A crash mid-write with the
 * old code could leave a torn/partial JSON; getHighestRevision then parse-fails to
 * null, the publish() downgrade guard resets, and an owner-signed OLDER roster could
 * re-grant a removed member after restart. These tests prove: (a) a recorded revision
 * survives a "restart" (fresh store, same dir); (b) no *.tmp file lingers (the rename
 * committed); (c) a pre-existing torn file heals the moment a valid revision is
 * recorded, and reads back intact after restart.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { FileCommunityDescriptorStore } from '../index';

const COMMUNITY = 'community-xyz';
let baseDir: string;

beforeEach(async () => {
  baseDir = path.join(os.tmpdir(), `descriptor-store-${randomUUID()}`);
  await fs.mkdir(baseDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(baseDir, { recursive: true, force: true });
});

describe('FileCommunityDescriptorStore atomic recordRevision', () => {
  it('records the highest revision durably across a restart', async () => {
    const store = new FileCommunityDescriptorStore(baseDir);
    await store.recordRevision(COMMUNITY, 2, 'hash-2');
    expect(await store.getHighestRevision(COMMUNITY)).toEqual({ revision: 2, descriptorHash: 'hash-2' });

    // Restart: a fresh store over the same DATA_DIR reads the committed value.
    const restarted = new FileCommunityDescriptorStore(baseDir);
    expect(await restarted.getHighestRevision(COMMUNITY)).toEqual({ revision: 2, descriptorHash: 'hash-2' });
  });

  it('is monotonic: a lower revision is ignored', async () => {
    const store = new FileCommunityDescriptorStore(baseDir);
    await store.recordRevision(COMMUNITY, 5, 'hash-5');
    await store.recordRevision(COMMUNITY, 3, 'hash-3'); // older -> ignored
    expect(await store.getHighestRevision(COMMUNITY)).toEqual({ revision: 5, descriptorHash: 'hash-5' });
  });

  it('leaves no lingering *.tmp file (the atomic rename committed)', async () => {
    const store = new FileCommunityDescriptorStore(baseDir);
    await store.recordRevision(COMMUNITY, 1, 'hash-1');
    await store.recordRevision(COMMUNITY, 2, 'hash-2');
    const names = await fs.readdir(baseDir);
    expect(names.some((n) => n.includes('.tmp'))).toBe(false);
    expect(names).toHaveLength(1); // exactly the committed rev file
  });

  it('heals a pre-existing torn/partial file and reads back intact after restart', async () => {
    const store = new FileCommunityDescriptorStore(baseDir);
    // A torn write from a crash under the OLD non-atomic code: truncated JSON.
    const file = path.join(baseDir, `${Buffer.from(COMMUNITY, 'utf8').toString('hex')}.rev.json`);
    await fs.writeFile(file, '{"revision":2,"descriptorHa', 'utf8');
    // The corrupt file parse-fails to null (the downgrade-guard reset the fix prevents).
    expect(await store.getHighestRevision(COMMUNITY)).toBeNull();

    // Recording a real revision atomically overwrites the torn file.
    await store.recordRevision(COMMUNITY, 4, 'hash-4');
    expect(await new FileCommunityDescriptorStore(baseDir).getHighestRevision(COMMUNITY)).toEqual({
      revision: 4,
      descriptorHash: 'hash-4',
    });
  });
});
