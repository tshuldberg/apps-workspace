#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { emitHookDecision, projectRoot, readHookPayload } from './_shared.mjs';

const ERRORS_LOG = 'errors_log.md';
const TABLE_HEADER = `# Errors Log

Running ledger of errors, bugs, and failures encountered during development. See \`CLAUDE.md\` > Error Log for rules.

| Date | Error / Symptom | Context (file, command, or module) | Resolution | Status |
|------|-----------------|------------------------------------|------------|--------|
`;

const SIGNATURES = [
  { label: 'Parity drift', pattern: /\b(check:parity|check:module-parity|check:passthrough-parity|check:workouts-parity)\b[^\n]*\b(fail|failed|mismatch|drift)/i },
  { label: 'EAS Build failure', pattern: /EAS Build (failed|error)|Build failed on (iOS|Android)/i },
  { label: 'TypeScript error', pattern: /error TS\d{3,5}:/ },
  { label: 'Vitest failure', pattern: /(^|\s)FAIL\s+.+\.(test|spec)\.(ts|tsx|js|jsx)/ },
  { label: 'Test suite failed', pattern: /Tests:\s+\d+ failed/i },
  { label: 'Next.js build failure', pattern: /Failed to compile\.?|Next\.js build failed/i },
  { label: 'Metro bundler crash', pattern: /Metro error|Unable to resolve module|Metro has encountered an error/i },
  { label: 'Migration error', pattern: /(SQLITE_ERROR|migration (failed|error)|schema mismatch)/i },
  { label: 'Husky / pre-commit failure', pattern: /husky - pre-commit (hook|script) failed|pre-commit hook failed/i },
  { label: 'pnpm install failure', pattern: /ERR_PNPM_\w+|peer dependencies|lockfile.*out of sync/i },
  { label: 'ESLint failure', pattern: /\u2716\s+\d+ problems? \(\d+ errors?/i },
];

const IGNORE_COMMAND_PATTERNS = [
  /errors_log\.md/,
  /posttooluse-error-logger\.mjs/,
  /^\s*echo\b/,
  /^\s*cat\b/,
  /^\s*head\b/,
  /^\s*tail\b/,
  /^\s*wc\b/,
  /^\s*ls\b/,
  /^\s*grep\b/,
  /\bgit log\b/,
  /\bgit diff\b/,
  /\bgit status\b/,
  /\bgit show\b/,
];

function extractCommand(payload) {
  return payload.tool_input?.command || payload.command || '';
}

function extractOutput(payload) {
  const response = payload.tool_response ?? payload.response ?? {};
  const parts = [
    response.stdout,
    response.stderr,
    response.output,
    typeof response === 'string' ? response : '',
    payload.tool_result?.stdout,
    payload.tool_result?.stderr,
  ];
  return parts.filter((value) => typeof value === 'string' && value.length > 0).join('\n');
}

function detectSignatures(output) {
  const hits = [];
  for (const { label, pattern } of SIGNATURES) {
    if (pattern.test(output)) {
      hits.push({ label, pattern });
    }
  }
  return hits;
}

function firstLineMatching(output, pattern) {
  const line = output.split(/\r?\n/).find((candidate) => pattern.test(candidate));
  return line ? line.trim() : '';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function truncate(value, max) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}\u2026`;
}

function ensureLogFile(rootDir) {
  const logPath = path.join(rootDir, ERRORS_LOG);
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, TABLE_HEADER, 'utf8');
  }
  return logPath;
}

function autoLogMarker(signature, command) {
  return `auto-logged: ${signature} / ${truncate(command, 60)}`;
}

function rowAlreadyLogged(logPath, signature, command) {
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    return content.includes(autoLogMarker(signature, command));
  } catch {
    return false;
  }
}

// Dedupe by symptom, not just signature+command: the same failure re-observed
// through a different command (or a TDD red-green loop) must not add a new row.
// CLAUDE.md > Error Log: "Update rather than duplicate."
function symptomAlreadyLogged(logPath, matchLine) {
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    return content.includes(escapeCell(truncate(matchLine, 160)));
  } catch {
    return false;
  }
}

function appendRow(logPath, { label, pattern }, command, output) {
  const matchLine = firstLineMatching(output, pattern) || label;
  const row = [
    today(),
    escapeCell(truncate(matchLine, 160)),
    escapeCell(`\`${truncate(command, 80)}\``),
    escapeCell(`Unresolved, ${autoLogMarker(label, command)}`),
    'Unresolved',
  ];

  const line = `| ${row.join(' | ')} |\n`;
  fs.appendFileSync(logPath, line, 'utf8');
}

async function main() {
  const payload = await readHookPayload();
  const toolName = payload.tool_name || payload.tool || '';
  if (toolName && toolName !== 'Bash') {
    emitHookDecision('approve', 'non-bash tool');
    return;
  }

  const command = extractCommand(payload);
  if (!command || IGNORE_COMMAND_PATTERNS.some((re) => re.test(command))) {
    emitHookDecision('approve', 'ignored command');
    return;
  }

  const output = extractOutput(payload);
  if (!output) {
    emitHookDecision('approve', 'no output');
    return;
  }

  const hits = detectSignatures(output);
  if (hits.length === 0) {
    emitHookDecision('approve', 'no failure signatures');
    return;
  }

  const rootDir = projectRoot(payload);
  const logPath = ensureLogFile(rootDir);

  const appended = [];
  for (const hit of hits) {
    if (rowAlreadyLogged(logPath, hit.label, command)) continue;
    const matchLine = firstLineMatching(output, hit.pattern) || hit.label;
    if (symptomAlreadyLogged(logPath, matchLine)) continue;
    appendRow(logPath, hit, command, output);
    appended.push(hit.label);
  }

  const reason = appended.length > 0
    ? `errors_log.md appended: ${appended.join(', ')}`
    : 'signatures already logged';
  emitHookDecision('approve', reason);
}

main().catch((error) => {
  emitHookDecision('approve', `error-logger hook failed: ${error.message}`);
});
