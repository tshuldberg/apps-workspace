#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(SCRIPT_DIR, '..', 'app');
export const FIXTURE_IDENTIFIER = /\b(?:SAMPLE|DEMO)_[A-Z0-9_]*\b/g;
export const GATE_NAMES = ['shouldShowDemoContent', 'shouldUseDemoFixturesInDev'];
const LOCAL_GUARD_LOOKBACK_LINES = 4;

// These modules define fixture payloads. Declarations and fixture-data
// composition are not render/state usage; their consumers are checked below.
const FIXTURE_SOURCE_FILES = new Set([
  join(APP_ROOT, '(root)', 'data', 'demo.ts'),
  join(APP_ROOT, '(root)', 'data', 'demo-videos.ts'),
  join(APP_ROOT, '(root)', 'data', 'kitchen.ts'),
]);

// These helpers intentionally hide raw fixture identifiers from UI files.
// Consumer files must still call the matching gate so removing a screen-level
// submission/render guard cannot silently re-enable seeded state.
const GATED_FIXTURE_HELPERS = new Map([
  ['getInitialGroceryPhotoCandidates', 'shouldUseDemoFixturesInDev'],
  ['getInitialReceiptOcrText', 'shouldUseDemoFixturesInDev'],
  ['getInitialExpirationOcrText', 'shouldUseDemoFixturesInDev'],
  ['getRecipeIngredientsForDisplay', 'shouldShowDemoContent'],
  ['getRecipeStepsForDisplay', 'shouldShowDemoContent'],
]);

export function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      yield* walk(path);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry) || entry.endsWith('.d.ts')) continue;
    if (/\.test\.(ts|tsx)$/.test(entry)) continue;
    yield path;
  }
}

export function codeLines(source) {
  const lines = source.split('\n');
  let inBlockComment = false;
  let inImport = false;

  return lines.map((line) => {
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      return '';
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      return '';
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return '';

    if (!inImport && /^import\b/.test(trimmed)) inImport = true;
    if (inImport) {
      if (/;\s*$/.test(trimmed)) inImport = false;
      return '';
    }

    return line.replace(/\/\/.*$/, '');
  });
}

// Only a completed simple assignment (`const x = gate();`, statement ends
// right after the call, and the next line is not a ternary continuation)
// is a genuine boolean-alias definition. `const x = gate()` followed by a
// line starting with `?` is NOT an alias: the gate call there is the direct
// condition guarding whatever the ternary's truthy branch references, so
// it must be evaluated as a guard for that reference, not hidden behind a
// bogus alias for `x`. Both gateAliases and hasPositiveGateCall must agree
// on this shape, so they share this fragment and helper.
const ALIAS_ASSIGNMENT_TAIL = '\\(\\s*\\)\\s*;?\\s*$';
const TERNARY_CONTINUATION_LINE = /^\s*\?/;

function isTernaryContinuedOnNextLine(lines, lineIndex) {
  const next = lines[lineIndex + 1];
  return typeof next === 'string' && TERNARY_CONTINUATION_LINE.test(next);
}

export function gateAliases(lines) {
  const aliases = new Map();
  const pattern = new RegExp(
    `\\bconst\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(${GATE_NAMES.join('|')})\\s*${ALIAS_ASSIGNMENT_TAIL}`,
    'g',
  );
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (isTernaryContinuedOnNextLine(lines, lineIndex)) continue;
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(lines[lineIndex])) !== null) {
      aliases.set(match[1], match[2]);
    }
  }
  return aliases;
}

export function isDeclaredIdentifier(line, identifier, matchIndex) {
  const declarationHead = line.slice(0, matchIndex + identifier.length);
  const declaration = new RegExp(
    `(?:^|\\b)(?:const|let|var|function|class|interface|type)\\s+${identifier.replace(/[$]/g, '\\$&')}\\s*$`,
  );
  return declaration.test(declarationHead);
}

const EARLY_EXIT_STATEMENT = /\b(?:return|continue|break)\b/;
const ALIAS_DEFINITION_LINE = new RegExp(
  `\\bconst\\s+[A-Za-z_$][\\w$]*\\s*=\\s*(?:${GATE_NAMES.join('|')})\\s*${ALIAS_ASSIGNMENT_TAIL}`,
);

// A reference to `name` is a positive guard for a later usage if either:
//   (a) it is called (or referenced) without a leading `!`, e.g.
//       `if (shouldShowDemoContent()) { render(SAMPLE_X) }`, or
//   (b) it is negated but an early-exit statement (return/continue/break)
//       appears between the negated reference and the usage line, e.g.
//       `if (!shouldShowDemoContent()) { return null; } ... render(SAMPLE_X)`.
//       There the negated check guards an early exit, so anything after it
//       in the same scope only runs when the gate is true.
// A negated reference with NO intervening early exit, e.g.
//   `if (!shouldShowDemoContent()) { render(SAMPLE_X) }`, is an inverted
// condition wrapping the fixture directly and must not satisfy the gate.
// A line that only DEFINES an alias (`const showDemoContent =
// shouldShowDemoContent();`) is not itself a guard for anything, even
// though it references the gate name positively; skip it so a later
// negated use of the alias is judged on its own merits.
export function hasPositiveGateCall(contextLines, usageLineOffset, name) {
  const callPattern = new RegExp(`(!\\s*)?\\b${name}\\b(?:\\s*\\()?`, 'g');
  for (let i = 0; i < contextLines.length; i += 1) {
    if (ALIAS_DEFINITION_LINE.test(contextLines[i]) && !isTernaryContinuedOnNextLine(contextLines, i)) continue;
    callPattern.lastIndex = 0;
    let match;
    while ((match = callPattern.exec(contextLines[i])) !== null) {
      if (!match[1]) return true;
      if (i >= usageLineOffset) continue;
      // Strictly between the negated line and the usage line, excluding
      // both endpoints: the usage line itself may contain `return` as part
      // of returning the fixture value, which is not an intervening exit.
      const between = contextLines.slice(i + 1, usageLineOffset).join('\n');
      if (EARLY_EXIT_STATEMENT.test(between)) return true;
    }
  }
  return false;
}

// File-wide variant: true if `name` is called anywhere in the file without
// a leading `!`. Used for helpers whose internal gating logic lives in a
// dedicated data-layer module; the consumer only needs to prove it wired
// the matching gate somewhere, not guard one specific line.
export function fileCallsGatePositively(source, name) {
  const callPattern = new RegExp(`(!\\s*)?\\b${name}\\s*\\(`, 'g');
  let match;
  while ((match = callPattern.exec(source)) !== null) {
    if (!match[1]) return true;
  }
  return false;
}

export function localGuardFor(lines, lineIndex, aliases) {
  const start = Math.max(0, lineIndex - LOCAL_GUARD_LOOKBACK_LINES);
  const end = Math.min(lines.length, lineIndex + 2);
  const contextLines = lines.slice(start, end);
  const usageLineOffset = lineIndex - start;
  for (const gate of GATE_NAMES) {
    if (hasPositiveGateCall(contextLines, usageLineOffset, gate)) return gate;
  }
  for (const [alias, gate] of aliases) {
    if (hasPositiveGateCall(contextLines, usageLineOffset, alias)) return gate;
  }
  return null;
}

export function shouldScanDirectFixtureIdentifiers(file, source) {
  if (FIXTURE_SOURCE_FILES.has(file)) return false;
  if (file.endsWith('.tsx')) return true;

  const dataSegment = `${sep}data${sep}`;
  if (!file.includes(dataSegment)) return true;
  return GATE_NAMES.some((gate) => source.includes(gate));
}

export function scanApp(appRoot) {
  const violations = [];
  let filesScanned = 0;
  let usageSitesChecked = 0;

  for (const file of walk(appRoot)) {
    const source = readFileSync(file, 'utf8');
    const lines = codeLines(source);
    const aliases = gateAliases(lines);
    const executableSource = lines.join('\n');
    filesScanned += 1;

    if (shouldScanDirectFixtureIdentifiers(file, source)) {
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        FIXTURE_IDENTIFIER.lastIndex = 0;
        let match;
        while ((match = FIXTURE_IDENTIFIER.exec(line)) !== null) {
          const identifier = match[0];
          if (isDeclaredIdentifier(line, identifier, match.index)) continue;
          usageSitesChecked += 1;
          if (localGuardFor(lines, lineIndex, aliases)) continue;
          violations.push({
            file,
            line: lineIndex + 1,
            subject: identifier,
            expectedGate: 'shouldShowDemoContent() or shouldUseDemoFixturesInDev()',
          });
        }
      }
    }

    for (const [helper, expectedGate] of GATED_FIXTURE_HELPERS) {
      const helperPattern = new RegExp(`\\b${helper}\\b`, 'g');
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        helperPattern.lastIndex = 0;
        let match;
        while ((match = helperPattern.exec(line)) !== null) {
          if (/\b(?:export\s+)?function\s*$/.test(line.slice(0, match.index))) continue;
          usageSitesChecked += 1;
          if (fileCallsGatePositively(executableSource, expectedGate)) continue;
          violations.push({
            file,
            line: lineIndex + 1,
            subject: `${helper}()`,
            expectedGate: `${expectedGate}()`,
          });
        }
      }
    }
  }

  return { violations, filesScanned, usageSitesChecked };
}

const isDirectRun =
  typeof process !== 'undefined' && process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());

if (isDirectRun) {
  const { violations, filesScanned, usageSitesChecked } = scanApp(APP_ROOT);

  if (violations.length > 0) {
    console.error(`No-ungated-fixtures gate: ${violations.length} violation(s)`);
    for (const violation of violations) {
      console.error(
        `  ${relative(process.cwd(), violation.file)}:${violation.line} ${violation.subject} lacks ${violation.expectedGate}`,
      );
    }
    process.exit(1);
  }

  console.log(
    `No-ungated-fixtures gate: clean (${filesScanned} files scanned, ${usageSitesChecked} fixture usage sites checked).`,
  );
}
