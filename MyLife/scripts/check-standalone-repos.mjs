#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const gitmodulesPath = resolve(root, '.gitmodules');

if (!existsSync(gitmodulesPath)) {
  console.log('check-standalone-repos: skipped (.gitmodules not found)');
  process.exit(0);
}

const gitmodules = readFileSync(gitmodulesPath, 'utf8');
const entries = [];
let current = null;

for (const rawLine of gitmodules.split('\n')) {
  const line = rawLine.trim();
  const header = line.match(/^\[submodule "(.+)"\]$/);
  if (header) {
    if (current) entries.push(current);
    current = { name: header[1], path: '', url: '' };
    continue;
  }
  if (!current) continue;
  if (line.startsWith('path = ')) current.path = line.slice('path = '.length).trim();
  if (line.startsWith('url = ')) current.url = line.slice('url = '.length).trim();
}
if (current) entries.push(current);

if (entries.length === 0) {
  console.log('check-standalone-repos: skipped (no submodule entries found)');
  process.exit(0);
}

function run(cmd, args, opts = {}) {
  const out = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    ...opts,
  });
  return {
    ok: out.status === 0,
    status: out.status,
    stdout: (out.stdout || '').trim(),
    stderr: (out.stderr || '').trim(),
  };
}

let failures = 0;
let warnings = 0;

console.log('Standalone repo integrity check:\n');
for (const entry of entries) {
  const localPath = resolve(root, entry.path);
  if (!existsSync(localPath)) {
    failures += 1;
    console.error(`FAIL ${entry.name}: missing directory ${entry.path}`);
    continue;
  }

  if (!existsSync(resolve(localPath, '.git'))) {
    failures += 1;
    console.error(`FAIL ${entry.name}: ${entry.path} is missing its own .git entry`);
    continue;
  }

  const workTreeCheck = run('git', ['-C', localPath, 'rev-parse', '--is-inside-work-tree']);
  if (!workTreeCheck.ok || workTreeCheck.stdout !== 'true') {
    failures += 1;
    console.error(`FAIL ${entry.name}: ${entry.path} is not a git work tree`);
    continue;
  }

  const origin = run('git', ['-C', localPath, 'remote', 'get-url', 'origin']);
  if (!origin.ok || !origin.stdout) {
    failures += 1;
    console.error(`FAIL ${entry.name}: missing origin remote`);
    continue;
  }

  if (entry.url && origin.stdout !== entry.url) {
    warnings += 1;
    console.warn(`WARN ${entry.name}: origin (${origin.stdout}) differs from .gitmodules (${entry.url})`);
  }

  const remoteHead = run('git', ['ls-remote', origin.stdout, 'HEAD']);
  if (!remoteHead.ok || !remoteHead.stdout) {
    failures += 1;
    console.error(`FAIL ${entry.name}: cannot resolve remote HEAD for ${origin.stdout}`);
    continue;
  }

  const localHead = run('git', ['-C', localPath, 'rev-parse', 'HEAD']);
  const remoteSha = remoteHead.stdout.split('\t')[0];
  const localSha = localHead.ok ? localHead.stdout : '';

  if (localSha && remoteSha && localSha !== remoteSha) {
    warnings += 1;
    console.warn(`WARN ${entry.name}: local HEAD ${localSha.slice(0, 8)} differs from remote HEAD ${remoteSha.slice(0, 8)}`);
  } else {
    console.log(`OK   ${entry.name}: ${entry.path}`);
  }
}

// Informational scan for My* directories that are not in .gitmodules.
const trackedPaths = new Set(entries.map((entry) => entry.path));
const appDirs = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('My'))
  .map((entry) => entry.name)
  .sort();

for (const appDir of appDirs) {
  if (trackedPaths.has(appDir)) continue;
  if (!existsSync(resolve(root, appDir, '.git'))) {
    warnings += 1;
    console.warn(`WARN ${appDir}: directory exists but is not independently versioned (no local .git repo metadata)`);
  }
}

if (failures > 0) {
  console.error(`\ncheck-standalone-repos: ${failures} failure(s), ${warnings} warning(s)`);
  process.exit(1);
}

console.log(`\ncheck-standalone-repos: passed with ${warnings} warning(s)`);
