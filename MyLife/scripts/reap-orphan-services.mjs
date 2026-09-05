#!/usr/bin/env node
/**
 * Reap orphaned Meerkat service processes.
 *
 * WHY THIS EXISTS (2026-09-02 memory exhaustion incident)
 * -------------------------------------------------------
 * The relay test suite boots real service binaries as child processes
 * (`src/__tests__/service-health-bin.test.ts` and siblings spawn
 * `node tsx bin/meerkat-*.mjs`). Those tests kill their children in `afterEach`,
 * which works when a run finishes normally. It does NOT work when the runner
 * dies abnormally: an out-of-memory kill, a `pkill`, a closed terminal, or an
 * agent session terminating mid-run. The spawned services survive, get
 * re-parented to launchd (ppid 1), and never exit, because a bin only shuts down
 * on SIGINT or SIGTERM and nothing sends one.
 *
 * They then accumulate silently across every worktree. On 2026-09-02 the machine
 * held 536 such orphans (402 public-directory-node, 134 verification-service)
 * across nine worktrees, some 24 days old, holding about 10 GB resident and
 * driving swap to 56 GB of 57 GB before macOS reported "system has run out of
 * application memory".
 *
 * The primary fix is `bin/_orphan-watchdog.mjs`, which makes a bin exit on its
 * own once its parent dies. This script is the SAFETY NET for processes started
 * before that landed, and for any future path that escapes the watchdog.
 *
 * SAFETY
 * ------
 * Only kills a process when EVERY condition holds:
 *   1. It is orphaned (ppid === 1), so nothing is supervising it.
 *   2. Its command line runs `packages/meerkat-relay/bin/meerkat-*.mjs` from a
 *      repo CHECKOUT. The full workspace path is required, not just the bin
 *      name, so a service running from an install or image path is never a
 *      candidate however it was started.
 *   3. It is older than `--min-age-minutes` (default 10), so a service booting
 *      right now is never touched.
 * A production deployment is not affected: those run in containers or under a
 * supervisor from a different path, and this only ever matches repo checkouts.
 *
 * The pure selection logic is exported and locked by
 * scripts/__tests__/reap-orphan-services.test.ts: for a script that kills
 * processes, "which rows match" is the part that must not drift.
 *
 * USAGE
 *   node scripts/reap-orphan-services.mjs            # dry run, prints a table
 *   node scripts/reap-orphan-services.mjs --kill     # actually terminate
 *   node scripts/reap-orphan-services.mjs --kill --min-age-minutes 60
 *   node scripts/reap-orphan-services.mjs --json     # machine-readable
 *
 * Sends SIGTERM first (the bins have a clean shutdown path), waits, then SIGKILL
 * for anything still alive.
 */

import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const KILL = argv.includes('--kill');
const JSON_OUT = argv.includes('--json');
const ageFlagIndex = argv.indexOf('--min-age-minutes');
const MIN_AGE_MINUTES = ageFlagIndex === -1 ? 10 : Number(argv[ageFlagIndex + 1]);

/** `ps` etime is [[dd-]hh:]mm:ss. Returns whole minutes. */
export function parseEtimeMinutes(etime) {
  const [left, seconds] = etime.includes(':') ? [etime.slice(0, etime.lastIndexOf(':')), etime.slice(etime.lastIndexOf(':') + 1)] : ['0', etime];
  void seconds;
  let days = 0;
  let rest = left;
  if (rest.includes('-')) {
    const [d, r] = rest.split('-');
    days = Number(d);
    rest = r;
  }
  const parts = rest.split(':').map(Number);
  const hours = parts.length === 2 ? parts[0] : 0;
  const minutes = parts.length === 2 ? parts[1] : parts[0];
  return days * 1440 + hours * 60 + minutes;
}

/**
 * The bin name if this command line runs a service binary FROM A REPO CHECKOUT,
 * else null. The workspace path is part of the match on purpose (safety
 * condition 2): matching a bare `meerkat-*.mjs` anywhere on the filesystem would
 * make an installed or containerised service a candidate.
 */
export function serviceBinName(command) {
  const match = /\/packages\/meerkat-relay\/bin\/(meerkat-[a-z0-9-]+)\.mjs(\s|$)/.exec(command);
  return match ? match[1] : null;
}

/** The repo checkout root the command line runs from, for reporting. */
export function checkoutRoot(command) {
  const match = /(\/[^\s]*?)\/packages\/meerkat-relay\/bin\/meerkat-/.exec(command);
  return match ? match[1] : 'unknown';
}

/**
 * Pure: turn `ps -Ao pid=,ppid=,etime=,rss=,command=` output into the rows this
 * script would act on. Every safety condition lives here, so the test suite can
 * assert exactly which processes are and are not candidates.
 */
export function selectCandidates(psOutput, minAgeMinutes) {
  const MIN_AGE_MINUTES = minAgeMinutes;
  const raw = psOutput;
  const out = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = /^(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, pid, ppid, etime, rss, command] = match;
    if (Number(ppid) !== 1) continue;
    const bin = serviceBinName(command);
    if (!bin) continue;
    const ageMinutes = parseEtimeMinutes(etime);
    if (ageMinutes < MIN_AGE_MINUTES) continue;
    out.push({
      pid: Number(pid),
      bin,
      ageMinutes,
      rssMb: Math.round(Number(rss) / 1024),
      checkout: checkoutRoot(command),
    });
  }
  return out;
}

function listCandidates() {
  const raw = execFileSync('ps', ['-Ao', 'pid=,ppid=,etime=,rss=,command='], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return selectCandidates(raw, MIN_AGE_MINUTES);
}

function formatAge(minutes) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}


/** The CLI. Guarded below so importing this module for tests runs nothing. */
async function main() {
  if (!Number.isFinite(MIN_AGE_MINUTES) || MIN_AGE_MINUTES < 0) {
    console.error('--min-age-minutes needs a non-negative number');
    process.exit(2);
  }
  const candidates = listCandidates();

  if (JSON_OUT) {
    console.log(JSON.stringify({ killed: KILL, minAgeMinutes: MIN_AGE_MINUTES, count: candidates.length, totalRssMb: candidates.reduce((s, c) => s + c.rssMb, 0), candidates }, null, 2));
  } else if (candidates.length === 0) {
    console.log(`No orphaned Meerkat service processes older than ${MIN_AGE_MINUTES}m. Nothing to reap.`);
  } else {
    const totalMb = candidates.reduce((s, c) => s + c.rssMb, 0);
    const byBin = new Map();
    for (const c of candidates) byBin.set(c.bin, (byBin.get(c.bin) ?? 0) + 1);
    const byCheckout = new Map();
    for (const c of candidates) byCheckout.set(c.checkout, (byCheckout.get(c.checkout) ?? 0) + 1);
    const oldest = candidates.reduce((a, b) => (a.ageMinutes > b.ageMinutes ? a : b));

    console.log(`${KILL ? 'Reaping' : 'Would reap'} ${candidates.length} orphaned Meerkat service processes`);
    console.log(`  resident memory   ${(totalMb / 1024).toFixed(2)} GB`);
    console.log(`  oldest            ${formatAge(oldest.ageMinutes)} (${oldest.bin})`);
    console.log(`  minimum age       ${MIN_AGE_MINUTES}m`);
    console.log('\nby binary:');
    for (const [bin, n] of [...byBin].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${bin}`);
    console.log('\nby checkout:');
    for (const [root, n] of [...byCheckout].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${root}`);
    if (!KILL) console.log('\nDry run. Re-run with --kill to terminate these.');
  }

  if (!KILL || candidates.length === 0) return;

  let termed = 0;
  for (const c of candidates) {
    try {
      process.kill(c.pid, 'SIGTERM');
      termed += 1;
    } catch {
      // Already gone between listing and killing; fine.
    }
  }
  await sleep(3000);

  let killed = 0;
  for (const c of candidates) {
    try {
      process.kill(c.pid, 0); // still alive?
      process.kill(c.pid, 'SIGKILL');
      killed += 1;
    } catch {
      // Exited on SIGTERM, which is the clean path.
    }
  }

  const remaining = listCandidates().length;
  // --json is a machine-readable contract: a trailing prose line would make
  // `--json --kill` emit something no parser can read.
  if (JSON_OUT) {
    console.log(JSON.stringify({ termed, killed, remaining }, null, 2));
  } else {
    console.log(`\nSIGTERM sent to ${termed}; SIGKILL needed for ${killed}. Orphans remaining: ${remaining}.`);
  }
}

// Only run when executed directly, never when imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
