import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

interface FileLockLease {
  owner: string;
  pid: number;
  createdAt: number;
}

async function readLease(lockFile: string): Promise<FileLockLease | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(lockFile, 'utf8')) as Partial<FileLockLease>;
    return typeof parsed.owner === 'string' && typeof parsed.pid === 'number'
      && typeof parsed.createdAt === 'number'
      ? parsed as FileLockLease
      : null;
  } catch {
    return null;
  }
}

export async function withExclusiveFileLock<T>(
  lockFile: string,
  operation: () => Promise<T>,
  options: { timeoutMs?: number; staleMs?: number } = {},
): Promise<T> {
  await fs.mkdir(path.dirname(lockFile), { recursive: true });
  const deadline = Date.now() + (options.timeoutMs ?? 5_000);
  const staleMs = options.staleMs ?? 30_000;
  const owner = randomUUID();
  let handle: Awaited<ReturnType<typeof fs.open>> | null = null;

  while (!handle) {
    try {
      handle = await fs.open(lockFile, 'wx', 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const stat = await fs.stat(lockFile).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > staleMs) {
        const observed = await readLease(lockFile);
        if (!observed) {
          throw new Error(`Refusing to steal an unreadable file lock: ${path.basename(lockFile)}`);
        }
        const quarantine = `${lockFile}.stale.${observed.owner}.${randomUUID()}`;
        try {
          await fs.rename(lockFile, quarantine);
        } catch (renameError) {
          if ((renameError as NodeJS.ErrnoException).code === 'ENOENT') continue;
          throw renameError;
        }
        const moved = await readLease(quarantine);
        if (moved?.owner !== observed.owner) {
          await fs.rename(quarantine, lockFile).catch(() => {});
          continue;
        }
        await fs.rm(quarantine, { force: true });
        continue;
      }
      if (Date.now() >= deadline) throw new Error(`Timed out acquiring file lock: ${path.basename(lockFile)}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  const lease: FileLockLease = { owner, pid: process.pid, createdAt: Date.now() };
  await handle.writeFile(JSON.stringify(lease));
  const heartbeatMs = Math.max(10, Math.floor(staleMs / 3));
  const heartbeat = setInterval(() => {
    void handle?.utimes(new Date(), new Date()).catch(() => {});
  }, heartbeatMs);
  heartbeat.unref();

  try {
    return await operation();
  } finally {
    clearInterval(heartbeat);
    await handle.close();
    const current = await readLease(lockFile);
    if (current?.owner === owner) await fs.rm(lockFile, { force: true });
  }
}
