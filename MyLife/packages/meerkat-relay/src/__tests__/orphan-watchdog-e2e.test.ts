/**
 * The 2026-09-02 incident, reproduced as a test.
 *
 * Builds the real three-level tree the relay suite builds (runner -> worker ->
 * service), kills the middle abnormally, and asserts the leaf notices it was
 * orphaned and leaves through its own SIGTERM shutdown. Before the watchdog this
 * leaf survived forever; 536 of them are what exhausted the machine.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const here = fileURLToPath(new URL('.', import.meta.url));
const parentFixture = path.join(here, 'fixtures/orphan-watchdog-parent.mjs');
const childFixture = path.join(here, 'fixtures/orphan-watchdog-child.mjs');

const spawned: ChildProcess[] = [];
/** Process-group ids to tear down wholesale. See `killGroup`. */
const groups: number[] = [];
const strays: number[] = [];
const tempDirs: string[] = [];

/**
 * Kill an entire process group.
 *
 * Killing the pids this test knows about is NOT enough: `tsx` inserts a wrapper
 * process between every spawn and the program it runs, so the tree contains
 * processes this file never sees. An early version of this test leaked two 72 MB
 * wrappers per run, which is precisely the failure it exists to prevent. Each
 * parent is therefore spawned `detached`, making it a group leader, and cleanup
 * kills the whole group by negative pid.
 */
function killGroup(pgid: number): void {
  try { process.kill(-pgid, 'SIGKILL'); } catch { /* whole group already gone */ }
}

afterEach(async () => {
  for (const pgid of groups.splice(0)) killGroup(pgid);
  for (const child of spawned.splice(0)) {
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  for (const pid of strays.splice(0)) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone, which is the pass case */ }
  }
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

const sleep = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** True while the pid exists. Signal 0 checks liveness without delivering one. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await sleep(50);
  }
  throw new Error(`timed out after ${timeoutMs}ms waiting for ${label}`);
}

async function readEvents(statusPath: string): Promise<Array<Record<string, unknown>>> {
  let raw: string;
  try {
    raw = await fs.readFile(statusPath, 'utf8');
  } catch {
    return [];
  }
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('orphan watchdog, end to end', () => {
  it('a service whose parent is SIGKILLed shuts itself down cleanly', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-orphan-'));
    tempDirs.push(dir);
    const statusPath = path.join(dir, 'status.jsonl');

    // Plain node for the parent (it imports no TypeScript), so there is one
    // fewer wrapper in the tree. `detached` makes it a group leader so cleanup
    // can reap every descendant, wrappers included.
    const parent = spawn(process.execPath, [parentFixture, tsxCli, childFixture, statusPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    spawned.push(parent);
    if (parent.pid) groups.push(parent.pid);

    let stdout = '';
    parent.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });

    await waitFor(() => stdout.includes('child_spawned'), 30_000, 'the parent to spawn its child');

    // Ground truth comes from inside the watchdog process itself. `tsx` inserts
    // a wrapper process, so the pid this test spawned is not necessarily the
    // child's direct parent, and the watchdog watches its DIRECT parent.
    await waitFor(async () => (await readEvents(statusPath)).some((e) => e.event === 'child_ready'),
      30_000, 'the child to report ready');
    const ready = (await readEvents(statusPath)).find((e) => e.event === 'child_ready')!;
    const childPid = Number(ready.pid);
    const realParentPid = Number(ready.ppid);
    strays.push(childPid);

    expect(Number.isInteger(childPid)).toBe(true);
    // A real supervising parent, which is the only case the watchdog arms for.
    expect(realParentPid).toBeGreaterThan(1);
    expect(isAlive(childPid)).toBe(true);

    // The abnormal death: the direct parent gets no chance to clean up.
    process.kill(realParentPid, 'SIGKILL');
    parent.kill('SIGKILL');
    await waitFor(() => !isAlive(realParentPid), 10_000, 'the parent to die');

    // Before the watchdog, this is where the child became immortal.
    await waitFor(() => !isAlive(childPid), 30_000, 'the orphaned child to exit on its own');

    const events = await readEvents(statusPath);
    const orphaned = events.find((e) => e.event === 'orphaned');
    expect(orphaned).toBeDefined();
    expect(orphaned?.parentPid).toBe(realParentPid);
    expect(orphaned?.action).toBe('sigterm');
    // It left through the bin's own shutdown path, not through a broken pipe or
    // a hard exit. That distinction is the whole point of the watchdog.
    expect(events.some((e) => e.event === 'sigterm_received')).toBe(true);
  }, 90_000);

  it('does not fire while the parent stays alive', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-orphan-live-'));
    tempDirs.push(dir);
    const statusPath = path.join(dir, 'status.jsonl');

    // Plain node for the parent (it imports no TypeScript), so there is one
    // fewer wrapper in the tree. `detached` makes it a group leader so cleanup
    // can reap every descendant, wrappers included.
    const parent = spawn(process.execPath, [parentFixture, tsxCli, childFixture, statusPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    spawned.push(parent);
    if (parent.pid) groups.push(parent.pid);

    let stdout = '';
    parent.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    await waitFor(() => stdout.includes('child_spawned'), 30_000, 'the parent to spawn its child');

    await waitFor(async () => (await readEvents(statusPath)).some((e) => e.event === 'child_ready'),
      30_000, 'the child to report ready');
    const childPid = Number((await readEvents(statusPath)).find((e) => e.event === 'child_ready')!.pid);
    strays.push(childPid);

    // Many poll intervals (150ms each) with the parent healthy.
    await sleep(2_000);

    const events = await readEvents(statusPath);
    expect(events.some((e) => e.event === 'orphaned')).toBe(false);
    expect(isAlive(childPid)).toBe(true);
  }, 90_000);
});
