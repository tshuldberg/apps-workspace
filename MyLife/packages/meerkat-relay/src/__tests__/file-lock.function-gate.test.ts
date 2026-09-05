import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withExclusiveFileLock } from '../file-lock';

describe('file lock function gate', () => {
  it('serializes critical sections sharing one lock path', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-lock-'));
    const order: string[] = [];
    await Promise.all([
      withExclusiveFileLock(path.join(dir, 'row.lock'), async () => {
        order.push('a-start');
        await new Promise((resolve) => setTimeout(resolve, 30));
        order.push('a-end');
      }),
      withExclusiveFileLock(path.join(dir, 'row.lock'), async () => {
        order.push('b-start');
        order.push('b-end');
      }),
    ]);
    expect([
      ['a-start', 'a-end', 'b-start', 'b-end'],
      ['b-start', 'b-end', 'a-start', 'a-end'],
    ]).toContainEqual(order);
  });

  it('keeps a live writer beyond the stale threshold and never lets it delete the next lease', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-lock-live-'));
    const lockFile = path.join(dir, 'row.lock');
    const order: string[] = [];
    await Promise.all([
      withExclusiveFileLock(lockFile, async () => {
        order.push('slow-start');
        await new Promise((resolve) => setTimeout(resolve, 140));
        order.push('slow-end');
      }, { staleMs: 45, timeoutMs: 1_000 }),
      new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          void withExclusiveFileLock(lockFile, async () => {
            order.push('next-start');
            await new Promise((done) => setTimeout(done, 30));
            order.push('next-end');
          }, { staleMs: 45, timeoutMs: 1_000 }).then(() => resolve(), reject);
        }, 10);
      }),
    ]);
    expect(order).toEqual(['slow-start', 'slow-end', 'next-start', 'next-end']);
  });
});
