#!/usr/bin/env node
/**
 * RTL directional-icon gate (plan 33 Phase 3.6).
 *
 * Semantically directional lucide icons (ArrowLeft/ArrowRight/
 * ChevronLeft/ChevronRight) keep their drawn direction under RTL, so a
 * raw usage points the wrong way for Arabic and Hebrew users. All
 * directional icons must render through the mirroring wrappers in
 * app/(root)/components/DirectionalIcons.tsx (BackArrow, ForwardArrow,
 * BackChevron, ForwardChevron).
 *
 * Also blocks new physical textAlign left/right in styles: use an
 * I18nManager.isRTL conditional (or center/auto) instead.
 *
 * Usage: node apps/bestchef/scripts/check-rtl-icons.mjs [--quiet]
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..', 'app');
const WRAPPER_SUFFIX = join('components', 'DirectionalIcons.tsx');
const quiet = process.argv.includes('--quiet');

const RAW_ICON_RE = /<(ArrowLeft|ArrowRight|ChevronLeft|ChevronRight)\b/;
// Physical alignment literal not wrapped in an isRTL conditional on the line.
const PHYSICAL_ALIGN_RE = /textAlign:\s*'(left|right)'/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue;
      yield* walk(p);
    } else if (name.endsWith('.tsx')) {
      yield p;
    }
  }
}

const failures = [];
for (const file of walk(APP_ROOT)) {
  if (file.endsWith(WRAPPER_SUFFIX)) continue;
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    const iconMatch = line.match(RAW_ICON_RE);
    if (iconMatch) {
      failures.push({
        file,
        line: i + 1,
        message: `raw <${iconMatch[1]}> must use the DirectionalIcons wrapper`,
      });
    }
    if (PHYSICAL_ALIGN_RE.test(line) && !line.includes('I18nManager.isRTL')) {
      failures.push({
        file,
        line: i + 1,
        message: "physical textAlign 'left'/'right' needs an I18nManager.isRTL conditional",
      });
    }
  });
}

if (failures.length > 0) {
  console.error(`RTL icon gate: ${failures.length} violation(s)\n`);
  for (const f of failures) {
    console.error(`  ${relative(join(__dirname, '..'), f.file)}:${f.line}  ${f.message}`);
  }
  process.exit(1);
}

if (!quiet) {
  console.log('RTL icon gate: clean (directional icons mirrored, no physical textAlign).');
} else {
  console.log('RTL icon gate: clean.');
}
