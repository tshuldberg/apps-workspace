import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export async function readHookPayload() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

export function projectRoot(payload = {}) {
  return process.env.CLAUDE_PROJECT_DIR
    || payload.cwd
    || process.cwd();
}

export function emitHookDecision(decision, reason) {
  process.stdout.write(`${JSON.stringify({ decision, reason })}\n`);
}

export function formatTimestamp(date = new Date()) {
  return date.toISOString();
}

export function ensureRuntimeMemoryDir(rootDir) {
  const runtimeDir = path.join(rootDir, '.claude', 'memory', 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });
  return runtimeDir;
}

export function writeRuntimeSnapshot(rootDir, filename, content) {
  const runtimeDir = ensureRuntimeMemoryDir(rootDir);
  fs.writeFileSync(path.join(runtimeDir, filename), content, 'utf8');
}

export function appendRuntimeLog(rootDir, filename, content) {
  const runtimeDir = ensureRuntimeMemoryDir(rootDir);
  fs.appendFileSync(path.join(runtimeDir, filename), content, 'utf8');
}

export function runCommand(rootDir, command, args) {
  return execFileSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function safeRun(rootDir, command, args) {
  try {
    return runCommand(rootDir, command, args).trim();
  } catch (error) {
    const stdout = typeof error.stdout === 'string' ? error.stdout : '';
    const stderr = typeof error.stderr === 'string' ? error.stderr : '';
    return [stdout, stderr].filter(Boolean).join('\n').trim();
  }
}

export function currentGitBranch(rootDir) {
  return safeRun(rootDir, 'git', ['rev-parse', '--abbrev-ref', 'HEAD']) || 'unknown';
}

export function shortGitStatus(rootDir) {
  const status = safeRun(rootDir, 'git', ['status', '--short']);
  return status || '(clean)';
}

export function diffStat(rootDir) {
  const diff = safeRun(rootDir, 'git', ['diff', '--stat', '--compact-summary']);
  return diff || '(no unstaged diff)';
}

export function normalizePath(rootDir, filePath) {
  if (!filePath) {
    return null;
  }

  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.join(rootDir, filePath);
}

export function findNearestPackageDir(rootDir, absPath) {
  let cursor = path.dirname(absPath);
  const root = path.resolve(rootDir);

  while (cursor.startsWith(root)) {
    const packageJson = path.join(cursor, 'package.json');
    if (fs.existsSync(packageJson)) {
      return cursor;
    }

    const next = path.dirname(cursor);
    if (next === cursor) {
      break;
    }
    cursor = next;
  }

  return null;
}

export function hasTypecheckScript(packageDir) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return Boolean(parsed.scripts?.typecheck);
  } catch {
    return false;
  }
}

export function summarizeCommandError(error, maxLines = 30) {
  const stdout = typeof error.stdout === 'string' ? error.stdout : '';
  const stderr = typeof error.stderr === 'string' ? error.stderr : '';
  const merged = [stdout, stderr]
    .filter(Boolean)
    .join('\n')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  return merged.slice(0, maxLines).join('\n');
}
