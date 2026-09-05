#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  emitHookDecision,
  findNearestPackageDir,
  hasTypecheckScript,
  normalizePath,
  projectRoot,
  readHookPayload,
  summarizeCommandError,
} from './_shared.mjs';

const TYPECHECK_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const CODE_SCOPES = [/^apps\//, /^modules\//, /^packages\//, /^My[A-Z]/];

function extractFilePath(payload) {
  return payload.tool_input?.file_path
    || payload.file_path
    || payload.tool_input?.path
    || null;
}

function isTypecheckedCodePath(rootDir, absPath) {
  const relPath = path.relative(rootDir, absPath).replace(/\\/g, '/');
  return CODE_SCOPES.some((pattern) => pattern.test(relPath));
}

function findDebugViolation(source) {
  if (/\bconsole\.(log|debug)\s*\(/.test(source)) {
    return 'console.log / console.debug detected';
  }

  if (/\bdebugger\b/.test(source)) {
    return 'debugger statement detected';
  }

  return null;
}

const payload = await readHookPayload();
const rootDir = projectRoot(payload);
const filePath = extractFilePath(payload);
const absPath = normalizePath(rootDir, filePath);

if (!absPath || !fs.existsSync(absPath)) {
  process.exit(0);
}

if (!TYPECHECK_EXTENSIONS.has(path.extname(absPath).toLowerCase())) {
  process.exit(0);
}

if (!isTypecheckedCodePath(rootDir, absPath)) {
  process.exit(0);
}

const source = fs.readFileSync(absPath, 'utf8');
const debugViolation = findDebugViolation(source);
if (debugViolation) {
  emitHookDecision('block', `${debugViolation} in ${path.relative(rootDir, absPath)}. Remove debug-only code before continuing.`);
  process.exit(0);
}

const packageDir = findNearestPackageDir(rootDir, absPath);
if (!packageDir || !hasTypecheckScript(packageDir)) {
  process.exit(0);
}

try {
  execFileSync('pnpm', ['--dir', packageDir, 'run', 'typecheck'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
} catch (error) {
  const summary = summarizeCommandError(error);
  const packageLabel = path.relative(rootDir, packageDir) || '.';
  emitHookDecision(
    'block',
    `Targeted typecheck failed for ${packageLabel} after editing ${path.relative(rootDir, absPath)}.\n${summary}`,
  );
}
