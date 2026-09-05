# 2026-09-02 crash recovery: what the panic cost, and closing the hole that caused it

/ Session type: incident recovery. Branches touched: `fix/meerkat-orphan-watchdog`
(new, off `main`), `feature/meerkat-plan59-for-everyone`,
`feature/meerkat-review-followthrough`.

## What happened

The machine kernel-panicked at 18:20:12 with
`watchdog timeout: no checkins from watchdogd in 90 seconds`, the signature of
total memory and swap starvation. Ghostty and Chrome were the visible symptom,
not the cause: they were the processes competing for the last of the memory.

**Root cause: 536 orphaned Meerkat service binaries** (402
`meerkat-public-directory-node`, 134 `meerkat-verification-service`, 2
`meerkat-relay-server`), all re-parented to init, accumulated across nine
worktrees, some 24 days old, holding roughly 10 GB resident and driving swap to
56 GB of 57 GB.

The relay suite spawns real bins as child processes
(`src/__tests__/service-health-bin.test.ts` and siblings). Their `afterEach`
reaps those children, but `afterEach` only runs on a normal exit. Every OOM
kill, `pkill`, closed terminal, or agent session ending mid-run left the children
alive with nothing to send the SIGINT or SIGTERM a bin needs in order to stop.
The population only ever grew.

The session that died had already diagnosed this and written the reaper. The
panic beat it: the reaper never ran, and the reboot cleared the processes
instead.

## What was actually lost

Nothing in git. Every commit on every branch survived, and every uncommitted
edit was still on disk. The real loss was about fifteen minutes of in-flight
work plus the fix that would have prevented the crash:

| Item | State found | Outcome |
|---|---|---|
| `_orphan-watchdog` (the actual fix) | never written | rebuilt, `05d6d2bf` |
| Reaper `--kill` run | never executed | reboot did it; script committed `518bab5a` |
| Review Set 5 web hardening | 25 files, uncommitted, web suite green | verified + committed `8fa61644` |
| Mobile gate on Set 5 | interrupted mid-run (likely the run that tipped the machine) | completed, 2015 passed |
| Plan 59 S7 copy sweep | half done: window selectable, copy still said 48 hours | finished, `d8ab14b6` |
| Plan 59 S5 log paragraph + error row | uncommitted | recovered as written, `61dc725d` |
| `errors_log.md` incident row | missing | added |

Sessions in MMO, FlashCards, TrainWithRyan, and the Apps-root job kit had all
reached clean stopping points hours earlier; their dirty files date to August and
are unrelated.

## The fix

`packages/meerkat-relay/src/orphan-watchdog.ts`. A bin records its `ppid` at
startup and polls. A CHANGED ppid is the orphaning event itself (POSIX re-parents
an orphan to init), so the bin raises SIGTERM on its own process and its existing
`shutdown()` path runs: clean server close, store flush, exit 0. A hard exit
backstops a shutdown that hangs.

**It cannot kill a production service.** It arms only when the initial ppid is
greater than 1, so every production shape is either unarmed or correct to stop:

- container with the service as PID 1 (Fly, plain Docker): ppid 0, never arms
- systemd unit, or a container under an init shim: ppid 1, never arms
- Compose or a supervisor: arms, and there a dead supervisor means the service
  genuinely is orphaned

`MEERKAT_DISABLE_ORPHAN_WATCHDOG=1` opts out entirely.

Wired into all 15 long-running bins. The 9 one-shot CLIs exit on their own and
are deliberately left alone. A wiring lock enforces the rule by SHAPE ("every bin
with a SIGTERM handler installs the watchdog"), so a service bin written later is
covered the day it exists rather than depending on a remembered file count.

## Two real defects found while doing this

**1. The naive wiring broke the production container image.**
`bin/meerkat-relay-server.mjs` is the only bin that runs under plain `node`
against compiled CommonJS; the image build rewrites exactly ONE import line with
`sed`. A second local import survived unrewritten, so the relay booted, failed to
resolve a `.ts` path, and died before its first log line. Three tests went red
and caught it. The watchdog now rides the same single import (re-exported from
`server.ts`, deliberately not the `index.ts` barrel, which would drag
`@mylife/sync` into the slim image), and a new lock asserts the bin, the
Dockerfile sed, and the smoke harness all agree on that string.

**2. The reaper was looser than its own documented safety contract.** Its header
claimed it only matches a bin "from a checkout of this repo", but the matcher
accepted a bare `bin/meerkat-*.mjs` anywhere on the filesystem, so an installed
or containerised service was a candidate. It now requires the full
`packages/meerkat-relay/bin/` workspace path. `--json --kill` also emitted a JSON
document followed by a prose line, which no parser can read.

A third, smaller one: the first version of my own end-to-end test leaked two
72 MB `tsx` wrapper processes per run, which is precisely the bug class under
test. Cleanup now reaps by process group.

## Verification

Everything below was run, not inferred.

- The real `meerkat-public-directory-node` bin, booted under an intermediate
  parent, self-reaps about 400 ms after that parent is SIGKILLed.
- Full relay suite 1653 passed / 189 skipped, and **leaves zero orphans**.
- The reaper, against a genuine orphan created by double-fork: seen by the dry
  run, reaped by `--kill` via SIGTERM.
- Set 5 claims checked independently rather than taken from its report: deleting
  `public/_headers` really does fail parity closed
  (`FAIL apps/meerkat-web/public/_headers is missing`), and a live dev server
  really does return all four anti-framing headers.
- Mobile 2081 / 2015 (plan59 / review worktrees), web 1418 / 1341, all
  typechecks, `check-meerkat-parity`, and `gate:function:changed` green.

## The honesty bug in plan 59 S7

Worth calling out separately because it was user-facing.
`cd0ec581` made an invite's validity window selectable and wired the picker into
both surfaces' display copy correctly. What it never reached was
`buildCommunityInviteEnvelope`, the message a founder actually texts to someone,
which still hardcoded "The invite expires in 48 hours." So choosing 90 days
produced a genuinely signed 90-day link wrapped in a message promising 48 hours:
the link outlives its own instructions. Fixed, with a test asserting exactly ONE
window is ever named per message so a future option cannot be added and quietly
left unstated.

## Open items

- **S6 (glossary and copy pass) never ran.** No agent, no commits; S7 was
  dispatched ahead of it. **S8** (stranger test, battery, docs) is untouched. So
  plan 59 has two sections outstanding, not one.
- **The watchdog is on `main`'s line only.** The plan59 and review-followthrough
  branches predate it and carry their own divergent R4 guard implementation, so
  relay tests run in those worktrees still orphan until they merge `main`. Mobile
  and web suites there are safe (they spawn no bins); this was checked after
  every run in this session.
- **Founder action from Set 5:** if Meerkat web is deployed to a host that reads
  neither `public/_headers` nor the Vite config, the anti-framing headers must be
  set there. Exact per-host config and the `curl -sI` check are in
  `apps/meerkat-web/README.md` under "Serving the built app".
- Three unused-import warnings in `MeerkatProvider.tsx` are pre-existing at HEAD
  and left for the Set 11 hygiene pass.
- Untracked strays still present in the main checkout: `apps/meerkat/.claude/`
  and `apps/meerkat/errors_log.md`, both of which Set 11 says to delete.

## Commits

| SHA | Branch | What |
|---|---|---|
| `05d6d2bf` | `fix/meerkat-orphan-watchdog` | the watchdog, wired into 15 bins |
| `518bab5a` | `fix/meerkat-orphan-watchdog` | reaper hardened + tested, errors_log rows |
| `d8ab14b6` | `feature/meerkat-plan59-for-everyone` | S7 invite-window copy sweep |
| `61dc725d` | `feature/meerkat-plan59-for-everyone` | recovered S5 log paragraph + error row |
| `8fa61644` | `feature/meerkat-review-followthrough` | review Set 5 web hardening |
