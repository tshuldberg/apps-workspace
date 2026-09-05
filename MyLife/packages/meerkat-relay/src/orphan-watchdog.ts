/**
 * Parent-death watchdog for every long-running Meerkat service binary.
 *
 * WHY THIS EXISTS (2026-09-02 memory exhaustion incident)
 * -------------------------------------------------------
 * The relay test suite boots real service binaries as child processes
 * (`service-health-bin.test.ts` and siblings spawn `node tsx bin/meerkat-*.mjs`).
 * Those tests kill their children in `afterEach`, which works when a run ends
 * normally. It does NOT work when the runner dies abnormally: an out-of-memory
 * kill, a `pkill`, a closed terminal, or an agent session terminating mid-run.
 * The spawned service then survives, is re-parented to init, and never exits,
 * because a bin only shuts down on SIGINT or SIGTERM and nothing sends one.
 *
 * They accumulate silently across every worktree. On 2026-09-02 the machine
 * held 536 such orphans (402 public-directory-node, 134 verification-service,
 * 2 relay-server) across nine worktrees, some 24 days old, holding about 10 GB
 * resident and driving swap to 56 GB of 57 GB until the kernel watchdog panicked
 * the machine.
 *
 * WHAT IT DOES
 * ------------
 * At install time the watchdog records `process.ppid`. It then polls, and the
 * moment the reported ppid CHANGES it knows the original parent is gone: POSIX
 * re-parents an orphan to init, so a changed ppid is the orphaning event itself.
 * It raises SIGTERM on its own process, which runs the bin's existing
 * `shutdown('SIGTERM')` path (clean server close, store flush, exit 0). If the
 * process is somehow still alive after the grace window it exits hard.
 *
 * WHY IT CANNOT KILL A PRODUCTION SERVICE
 * ---------------------------------------
 * It ARMS ONLY when the initial ppid is greater than 1, meaning a real parent
 * process is supervising this one. Every production shape is therefore either
 * unarmed or correct to stop:
 *
 *   - Container with the service as PID 1 (Fly, plain Docker): ppid is 0.
 *     Never arms.
 *   - Container under an init shim (tini, docker --init) and systemd units:
 *     ppid is 1. Never arms.
 *   - Compose or a supervisor (pm2, a shell wrapper): ppid is a real pid, so it
 *     arms. If that supervisor dies the service IS orphaned, and exiting is the
 *     correct move: the supervisor restarts it, or the container is being torn
 *     down anyway.
 *
 * `MEERKAT_DISABLE_ORPHAN_WATCHDOG=1` opts out entirely, for a deployment that
 * deliberately double-forks and expects to outlive its spawner.
 */

/** EX_SOFTWARE from sysexits, matching the process guards' deliberate-exit code. */
export const ORPHAN_WATCHDOG_EXIT_CODE = 70;

/** How often the ppid is re-read. Cheap: one integer read, no syscall fan-out. */
export const DEFAULT_ORPHAN_POLL_MS = 5_000;

/**
 * How long the bin's own SIGTERM shutdown gets before the watchdog exits hard.
 * Generous, because a store flush on a slow disk is a legitimate reason to take
 * a while, and a clean exit is always preferable to a severed one.
 */
export const DEFAULT_ORPHAN_GRACE_MS = 10_000;

/** Env var that disables the watchdog outright. */
export const ORPHAN_WATCHDOG_DISABLE_ENV = 'MEERKAT_DISABLE_ORPHAN_WATCHDOG';

/** Env var overriding the poll interval (tests, and a slow supervisor). */
export const ORPHAN_WATCHDOG_INTERVAL_ENV = 'MEERKAT_ORPHAN_WATCHDOG_INTERVAL_MS';

export type OrphanWatchdogEvent = {
  event: 'orphaned';
  /** The ppid recorded when the watchdog armed. */
  parentPid: number;
  /** The ppid observed now (init, or whatever adopted this process). */
  currentPid: number;
  /** What the watchdog does next. */
  action: 'sigterm';
  /** Milliseconds the clean shutdown gets before a hard exit. */
  graceMs: number;
};

/** The subset of `process` the watchdog touches, injectable for tests. */
export interface OrphanWatchdogTarget {
  readonly pid: number;
  readonly ppid: number;
  kill(pid: number, signal: string): unknown;
  exit(code?: number): never | void;
}

export interface OrphanWatchdogOptions {
  /** The bin's structured logger; receives one event when it fires. */
  log?: (event: OrphanWatchdogEvent) => void;
  /** Poll interval. Default 5s, or the interval env var when set. */
  intervalMs?: number;
  /** Grace given to the SIGTERM shutdown before a hard exit. Default 10s. */
  graceMs?: number;
  /** Exit code for the hard exit. Default 70. */
  exitCode?: number;
  /** Injectable process for tests. Default: the real `process`. */
  target?: OrphanWatchdogTarget;
  /** Injectable env for tests. Default: `process.env`. */
  env?: Record<string, string | undefined>;
  /** Injectable timers for tests. Default: the global timer functions. */
  setInterval?: (handler: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
  setTimeout?: (handler: () => void, ms: number) => unknown;
}

/**
 * Decide whether the watchdog should arm. Pure, so the production-safety
 * argument above is a testable claim rather than a comment.
 *
 * Returns a reason string when it should NOT arm, or null when it should.
 */
export function orphanWatchdogSkipReason(
  ppid: number,
  env: Record<string, string | undefined>,
): 'disabled_by_env' | 'no_supervising_parent' | null {
  if (env[ORPHAN_WATCHDOG_DISABLE_ENV] === '1') return 'disabled_by_env';
  // ppid 0 means this process IS the container's PID 1; ppid 1 means init or an
  // init shim adopted it at birth. Neither has a parent whose death could orphan
  // it, and both are the normal production shapes.
  if (!Number.isInteger(ppid) || ppid <= 1) return 'no_supervising_parent';
  return null;
}

/**
 * Read the poll interval, honoring the env override. A malformed or
 * non-positive value falls back to the default rather than disabling the poll.
 */
export function resolveOrphanPollMs(
  env: Record<string, string | undefined>,
  fallback = DEFAULT_ORPHAN_POLL_MS,
): number {
  const raw = env[ORPHAN_WATCHDOG_INTERVAL_ENV];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/**
 * Install the parent-death watchdog. Returns an uninstall function; calling it
 * is how a test (or a bin with its own lifecycle) stops the poll. Installing
 * when the watchdog should not arm is a no-op that returns a no-op, so every
 * caller can install unconditionally.
 */
export function installOrphanWatchdog(options: OrphanWatchdogOptions = {}): () => void {
  const target: OrphanWatchdogTarget = options.target ?? (process as unknown as OrphanWatchdogTarget);
  const env = options.env ?? process.env;
  if (orphanWatchdogSkipReason(target.ppid, env) !== null) return () => {};

  const parentPid = target.ppid;
  const intervalMs = options.intervalMs ?? resolveOrphanPollMs(env);
  const graceMs = options.graceMs ?? DEFAULT_ORPHAN_GRACE_MS;
  const exitCode = options.exitCode ?? ORPHAN_WATCHDOG_EXIT_CODE;
  const setIntervalFn = options.setInterval ?? ((handler, ms) => setInterval(handler, ms));
  const clearIntervalFn = options.clearInterval ?? ((handle) => clearInterval(handle as never));
  const setTimeoutFn = options.setTimeout ?? ((handler, ms) => setTimeout(handler, ms));

  let fired = false;
  let handle: unknown = null;

  const stop = (): void => {
    if (handle !== null) {
      clearIntervalFn(handle);
      handle = null;
    }
  };

  const check = (): void => {
    if (fired) return;
    const currentPid = target.ppid;
    if (currentPid === parentPid) return;
    fired = true;
    stop();
    try {
      options.log?.({
        event: 'orphaned',
        parentPid,
        currentPid,
        action: 'sigterm',
        graceMs,
      });
    } catch {
      // A logger failure must never keep an orphan alive.
    }
    // Reuse the bin's own SIGTERM handler so the shutdown is the clean one.
    try {
      target.kill(target.pid, 'SIGTERM');
    } catch {
      target.exit(exitCode);
      return;
    }
    // Backstop: if the clean shutdown hangs or the bin has no SIGTERM handler,
    // leave anyway. Unref'd so it can never be the reason the loop stays alive.
    const grace = setTimeoutFn(() => { target.exit(exitCode); }, graceMs);
    unref(grace);
  };

  handle = setIntervalFn(check, intervalMs);
  // Unref'd so a service that would otherwise be idle-and-done is never held
  // open by its own watchdog.
  unref(handle);

  return stop;
}

/** Call `unref()` when the timer handle has one (real timers do; fakes may not). */
function unref(handle: unknown): void {
  const candidate = handle as { unref?: () => void } | null;
  if (candidate && typeof candidate.unref === 'function') candidate.unref();
}
