#!/usr/bin/env node

import {
  appendRuntimeLog,
  currentGitBranch,
  diffStat,
  formatTimestamp,
  projectRoot,
  readHookPayload,
  shortGitStatus,
  writeRuntimeSnapshot,
} from './_shared.mjs';

const payload = await readHookPayload();
const rootDir = projectRoot(payload);
const timestamp = formatTimestamp();

const stopReason = payload.stop_reason || payload.reason || 'response_complete';
const snapshot = [
  '# Stop Snapshot',
  '',
  `- Timestamp: ${timestamp}`,
  `- Branch: ${currentGitBranch(rootDir)}`,
  `- Reason: ${stopReason}`,
  '',
  '## Git Status',
  '```text',
  shortGitStatus(rootDir),
  '```',
  '',
  '## Diff Stat',
  '```text',
  diffStat(rootDir),
  '```',
  '',
].join('\n');

writeRuntimeSnapshot(rootDir, 'stop-latest.md', snapshot);
appendRuntimeLog(rootDir, 'stop-log.md', `${snapshot}\n---\n\n`);
