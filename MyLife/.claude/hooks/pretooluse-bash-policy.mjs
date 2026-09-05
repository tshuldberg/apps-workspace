#!/usr/bin/env node

import { emitHookDecision, readHookPayload } from './_shared.mjs';

const READ_ONLY_ARCHIVE_PATTERN = /\b(cat|sed|rg|find|ls|git\s+status|git\s+diff|git\s+log)\b/i;

function extractCommand(payload) {
  return payload.tool_input?.command
    || payload.tool_input?.cmd
    || payload.command
    || '';
}

function commandTouchesArchive(command) {
  return /(^|\s)(archive\/|\/Users\/trey\/Desktop\/Apps\/MyLife\/archive\/)/.test(command);
}

function blockedReason(command) {
  const normalized = command.trim();

  if (!normalized) {
    return null;
  }

  if (/\bgit\s+reset\s+--hard\b/.test(normalized)) {
    return 'Blocked dangerous git reset. Use non-destructive git commands in this repo.';
  }

  if (/\bgit\s+checkout\s+--\b/.test(normalized)) {
    return 'Blocked destructive git checkout of tracked files. Do not discard worktree changes through Bash.';
  }

  if (/\bgit\s+clean\b.*\s-f/.test(normalized)) {
    return 'Blocked git clean with force. This repo carries unrelated worktree changes and ignored artifacts.';
  }

  if (/\b(curl|wget)\b[^|]*\|\s*(bash|sh)\b/.test(normalized)) {
    return 'Blocked remote shell pipe. Download and inspect scripts before execution.';
  }

  if (commandTouchesArchive(normalized) && !READ_ONLY_ARCHIVE_PATTERN.test(normalized)) {
    return 'Blocked write-capable Bash command against archive/. Archived standalone directories are not active edit targets.';
  }

  return null;
}

const payload = await readHookPayload();
const command = extractCommand(payload);
const reason = blockedReason(command);

if (reason) {
  emitHookDecision('block', reason);
}
