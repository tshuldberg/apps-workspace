#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const FORBIDDEN_STAGED_PATTERNS = [
  /^docs\/performance\/function-inventory\.(json|csv|md)$/,
  /^docs\/performance\/performance-remediation-plan\.md$/,
];
// Known large tracked binaries that are intentionally retained in-repo.
// Each entry must include a rationale comment. Add new entries only after
// product/eng review confirms hosting in-repo is the right call.
const ALLOWED_OVERSIZED_PATHS = new Set([
  // Investor-facing two-pager kept in-repo so investor-deck reviewers can
  // open the PDF without external hosting. Tracked alongside the deck source.
  "docs/investor-deck/MyLife-Two-Pager.pdf",
]);

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function listStagedFiles() {
  const output = execSync("git diff --cached --name-only --diff-filter=ACMR", {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(toPosix);
}

function listTrackedFiles() {
  const output = execSync("git ls-files", {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(toPosix);
}

function formatBytes(value) {
  const mb = value / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function checkForbiddenStaged(files) {
  return files.filter((file) => FORBIDDEN_STAGED_PATTERNS.some((pattern) => pattern.test(file)));
}

function checkOversizedTrackedFiles(files) {
  const oversized = [];
  for (const relPath of files) {
    if (ALLOWED_OVERSIZED_PATHS.has(relPath)) {
      continue;
    }

    const absPath = path.join(ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      continue;
    }

    const size = fs.statSync(absPath).size;
    if (size > MAX_FILE_SIZE_BYTES) {
      oversized.push({ path: relPath, size });
    }
  }

  return oversized.sort((a, b) => b.size - a.size);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  const staged = listStagedFiles();
  const forbiddenStaged = checkForbiddenStaged(staged);
  if (forbiddenStaged.length) {
    fail(
      [
        "Forbidden generated performance artifacts are staged:",
        ...forbiddenStaged.map((file) => `- ${file}`),
        "",
        "Regenerate into artifacts/perf-audit instead of docs/performance.",
      ].join("\n"),
    );
  }

  const oversized = checkOversizedTrackedFiles(listTrackedFiles());
  if (oversized.length) {
    fail(
      [
        `Tracked files exceed ${formatBytes(MAX_FILE_SIZE_BYTES)}:`,
        ...oversized.map((entry) => `- ${entry.path} (${formatBytes(entry.size)})`),
        "",
        "Move generated or heavy artifacts out of git history where possible.",
      ].join("\n"),
    );
  }

  console.log("Generated artifact guard passed.");
}

main();
