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

const snapshot = [
  '# PreCompact Snapshot',
  '',
  `- Timestamp: ${timestamp}`,
  `- Branch: ${currentGitBranch(rootDir)}`,
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

writeRuntimeSnapshot(rootDir, 'precompact-latest.md', snapshot);
appendRuntimeLog(rootDir, 'precompact-log.md', `${snapshot}\n---\n\n`);
