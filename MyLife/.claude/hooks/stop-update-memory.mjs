#!/usr/bin/env node

/**
 * Stop hook: appends a session breadcrumb to memory.md.
 *
 * Guarantees at least a minimal record exists even if Claude
 * forgot to update memory.md or capture to Open Brain.
 * Writes: date, branch, commit count since last breadcrumb,
 * and git diff stat.
 *
 * Dedup guards (in order):
 * 1. Minute-precision sentinel: skip if this exact minute already logged.
 * 2. No-op guard: skip if there's no commit and no uncommitted diff.
 * 3. Same-commit guard: skip if the most recent auto-logged row already
 *    references the current HEAD commit hash, even in a later minute.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  currentGitBranch,
  diffStat,
  projectRoot,
  readHookPayload,
  safeRun,
} from './_shared.mjs';
import { buildBreadcrumb, extractCommitHash, insertBreadcrumb, shouldSkip } from './lib/stop-memory-core.mjs';

const payload = await readHookPayload();
const rootDir = projectRoot(payload);
const memoryPath = path.join(rootDir, 'memory.md');

// Only run if memory.md exists
if (!fs.existsSync(memoryPath)) {
  process.exit(0);
}

const branch = currentGitBranch(rootDir);
const now = new Date();
const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
const timeStr = now.toISOString().slice(11, 16); // HH:MM

// Get the last commit message for context
const lastCommit = safeRun(rootDir, 'git', ['log', '--oneline', '-1']);
const currentCommitHash = extractCommitHash(lastCommit);

// Get diff stat for uncommitted work
const diff = diffStat(rootDir);
const hasDiff = diff && diff !== '(no unstaged diff)';

// Read current memory.md to check for duplicate breadcrumbs
const currentMemory = fs.readFileSync(memoryPath, 'utf8');

// Build the sentinel: date + time (minute precision) to avoid duplicate writes
// from rapid Stop events (e.g. user sends multiple messages)
const sentinel = `<!-- stop-hook:${dateStr}T${timeStr} -->`;

if (shouldSkip({ memoryContent: currentMemory, sentinel, currentCommitHash, hasDiff, lastCommit })) {
  process.exit(0);
}

const breadcrumb = buildBreadcrumb({ dateStr, lastCommit, hasDiff, branch, sentinel });
const updatedMemory = insertBreadcrumb(currentMemory, breadcrumb);

if (updatedMemory !== null) {
  fs.writeFileSync(memoryPath, updatedMemory, 'utf8');
}
