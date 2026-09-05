// Prove the configured scanner detects a synthetic secret before trusting a clean scan.
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const executable = process.argv[2] ?? 'gitleaks';
const config = process.argv[3] ? resolve(process.argv[3]) : join(root, '.gitleaks.toml');
const fixture = mkdtempSync(join(tmpdir(), 'meerkat-secret-scanner-'));
try {
  const positive = join(fixture, 'positive');
  const negative = join(fixture, 'negative');
  mkdirSync(positive);
  mkdirSync(negative);
  const token = ['ghp', randomBytes(27).toString('base64').replaceAll('+', 'a').replaceAll('/', 'b')].join('_');
  writeFileSync(join(positive, 'canary.txt'), `token = "${token}"\n`);
  writeFileSync(join(negative, 'notes.txt'), 'No credentials in this fixture.\n');
  for (const [directory, expected] of [[positive, 1], [negative, 0]]) {
    const report = join(fixture, expected === 1 ? 'positive.json' : 'negative.json');
    const result = spawnSync(executable, ['dir', directory, '--config', config, '--redact=100',
      '--no-banner', '--report-format', 'json', '--report-path', report], { stdio: 'pipe', timeout: 30_000 });
    if (result.error || result.status !== expected) throw new Error(`Scanner exit ${result.status} did not match expected ${expected}.`);
    const findings = JSON.parse(readFileSync(report, 'utf8'));
    if (!Array.isArray(findings)) throw new Error('Scanner report is not a finding list.');
    if (expected === 1 && !findings.some((finding) => finding.RuleID === 'github-pat' && finding.File.endsWith('canary.txt'))) {
      throw new Error('Default GitHub token detector did not identify the synthetic canary.');
    }
    if (expected === 0 && findings.length !== 0) throw new Error('Clean control unexpectedly reported a secret.');
  }
  process.stdout.write('Meerkat secret scanner: positive and negative controls passed.\n');
} catch (error) {
  process.stderr.write(`Meerkat secret scanner failed: ${error instanceof Error ? error.message : 'invalid result'}\n`);
  process.exitCode = 1;
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
