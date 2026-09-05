// A stand-in for a long-running service bin: installs the orphan watchdog,
// handles SIGTERM the way every service bin does, and otherwise holds the event
// loop open forever.
//
// It reports through a FILE, never stdout. Its parent is killed mid-test, and a
// piped stdout would break at exactly that moment; an EPIPE death would look
// like the watchdog working while proving nothing.
import { appendFileSync } from 'node:fs';

import { installOrphanWatchdog } from '../../orphan-watchdog.ts';

const statusPath = process.argv[2];
const record = (line) => appendFileSync(statusPath, `${JSON.stringify(line)}\n`);

installOrphanWatchdog({
  log: record,
  intervalMs: 150,
  graceMs: 5_000,
});

// The same shape every service bin uses: SIGTERM runs the clean shutdown.
process.on('SIGTERM', () => {
  record({ event: 'sigterm_received' });
  process.exit(0);
});

record({ event: 'child_ready', pid: process.pid, ppid: process.ppid });

// Hold the loop open, the way a listening server does.
setInterval(() => {}, 1_000);
