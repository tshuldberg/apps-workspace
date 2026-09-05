import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Absolute path so a test can hand the script an empty PATH (to prove the
 * missing-tool branch) without also making the interpreter unfindable.
 */
const BASH = fs.existsSync('/bin/bash') ? '/bin/bash' : 'bash';

const SCRIPTS = {
  deploy: path.join(REPO_ROOT, 'scripts', 'mynews-deploy.sh'),
  rollback: path.join(REPO_ROOT, 'scripts', 'mynews-rollback.sh'),
  smoke: path.join(REPO_ROOT, 'scripts', 'mynews-smoke.sh'),
} as const;

/**
 * Fake-but-present credentials. Deliberately not real: a dry run must never
 * reach the network, so the values only have to be non-empty.
 */
const FAKE_CREDENTIALS = {
  SUPABASE_PROJECT_REF: 'fakeprojectref',
  SUPABASE_ACCESS_TOKEN: 'sbp_fake_access_token_for_dry_run',
  MYNEWS_FUNCTIONS_URL: 'https://fakeprojectref.supabase.co/functions/v1',
  MYNEWS_SMOKE_ANON_KEY: 'sb_publishable_fake_for_dry_run',
} as const;

/**
 * A PATH whose first entry shadows `supabase` and `curl` with shims that exit
 * 99 and print loudly. If a dry run actually invoked either tool, the script's
 * exit status would be 99 (or the shim banner would appear in output), so the
 * assertions below can prove the dry run stayed inert.
 */
const SHIM_EXIT_CODE = 99;
let shimDir = '';

beforeAll(() => {
  shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mynews-ops-shim-'));
  for (const tool of ['supabase', 'curl']) {
    const shim = path.join(shimDir, tool);
    fs.writeFileSync(
      shim,
      `#!/bin/sh\necho "SHIM_INVOKED ${tool} $*" >&2\nexit ${SHIM_EXIT_CODE}\n`,
      'utf8',
    );
    fs.chmodSync(shim, 0o755);
  }
});

afterAll(() => {
  if (shimDir) fs.rmSync(shimDir, { recursive: true, force: true });
});

interface RunOptions {
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  shimTools?: boolean;
}

function run(script: string, options: RunOptions = {}): SpawnSyncReturns<string> & { output: string } {
  const basePath = options.shimTools === false ? process.env.PATH : `${shimDir}:${process.env.PATH}`;
  const result = spawnSync(BASH, [script, ...(options.args ?? [])], {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    env: {
      // Scrubbed: nothing from the developer's shell leaks in except PATH and
      // HOME, so a locally exported SUPABASE_* cannot make a test pass.
      PATH: basePath ?? '/usr/bin:/bin',
      HOME: process.env.HOME ?? '/tmp',
      ...(options.env ?? {}),
    },
  });
  return Object.assign(result, { output: `${result.stdout ?? ''}${result.stderr ?? ''}` });
}

const SUCCESS_WORDING = [
  'DEPLOY PASSED',
  'ROLLBACK PASSED',
  'SMOKE PASSED',
  'PASS (',
  'deployed',
  'redeployed',
];

function expectNoSuccessWording(output: string): void {
  for (const phrase of SUCCESS_WORDING) {
    expect(output, `output must not claim success with "${phrase}"`).not.toContain(phrase);
  }
}

describe.each([
  ['mynews-deploy.sh', SCRIPTS.deploy],
  ['mynews-rollback.sh', SCRIPTS.rollback],
  ['mynews-smoke.sh', SCRIPTS.smoke],
])('%s shared contract', (name, script) => {
  it('exists and is executable', () => {
    expect(fs.existsSync(script)).toBe(true);
    // eslint-disable-next-line no-bitwise
    expect(fs.statSync(script).mode & 0o111).toBeGreaterThan(0);
  });

  it('passes bash -n', () => {
    const result = spawnSync(BASH, ['-n', script], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  });

  it('--help exits 0', () => {
    const result = run(script, { args: ['--help'] });
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain('Usage: scripts/');
  });

  it('exits 2 with an empty environment and names every missing item', () => {
    const result = run(script);
    expect(result.status, result.output).toBe(2);
    expect(result.output).toContain('FAILED: cannot proceed without the credentials listed above');
    expectNoSuccessWording(result.output);
  });

  it('exits 2 on --dry-run with missing credentials', () => {
    const result = run(script, { args: ['--dry-run'] });
    expect(result.status, result.output).toBe(2);
    expect(result.output).toMatch(/^missing: /m);
    expect(result.output).toContain('FAILED: cannot proceed without the credentials listed above');
    expectNoSuccessWording(result.output);
  });

  it('never echoes a credential value', () => {
    const result = run(script, { args: ['--dry-run'], env: { ...FAKE_CREDENTIALS } });
    expect(result.output).not.toContain(FAKE_CREDENTIALS.SUPABASE_ACCESS_TOKEN);
    expect(result.output).not.toContain(FAKE_CREDENTIALS.MYNEWS_SMOKE_ANON_KEY);
  });
});

describe('mynews-deploy.sh', () => {
  it('names each missing credential in the "missing: NAME" form', () => {
    const result = run(SCRIPTS.deploy);
    expect(result.status).toBe(2);
    expect(result.output).toContain('missing: SUPABASE_PROJECT_REF (');
    expect(result.output).toContain('missing: SUPABASE_ACCESS_TOKEN (');
    expect(result.output).toContain('missing: MYNEWS_FUNCTIONS_URL (');
    expect(result.output).toContain('missing: MYNEWS_SMOKE_ANON_KEY (');
  });

  it('reports a missing supabase CLI as a missing tool', () => {
    const emptyBin = fs.mkdtempSync(path.join(os.tmpdir(), 'mynews-ops-nobin-'));
    try {
      const result = run(SCRIPTS.deploy, {
        env: { ...FAKE_CREDENTIALS, PATH: emptyBin },
        shimTools: false,
      });
      expect(result.status).toBe(2);
      expect(result.output).toContain(
        'missing: tool supabase (Supabase CLI, used to deploy edge functions)',
      );
    } finally {
      fs.rmSync(emptyBin, { recursive: true, force: true });
    }
  });

  it('--dry-run with credentials exits 0, prints dry-run lines, and invokes neither supabase nor curl', () => {
    const result = run(SCRIPTS.deploy, { args: ['--dry-run'], env: { ...FAKE_CREDENTIALS } });

    expect(result.status, result.output).toBe(0);
    expect(result.status).not.toBe(SHIM_EXIT_CODE);
    expect(result.output).not.toContain('SHIM_INVOKED');
    expect(result.stdout).toMatch(/^dry-run: /m);
    expect(result.stdout).toContain('dry-run: node scripts/gen-mynews-env-matrix.mjs --check');
    expect(result.stdout).toContain('dry-run: supabase db push --project-ref fakeprojectref');
    expect(result.stdout).toContain('dry-run: bash scripts/mynews-smoke.sh');
    expect(result.stdout).toContain('nothing was applied, deployed, or probed');

    // The env-matrix gate must come before the first mutation.
    const envCheckAt = result.stdout.indexOf('gen-mynews-env-matrix.mjs --check');
    const dbPushAt = result.stdout.indexOf('supabase db push');
    expect(envCheckAt).toBeGreaterThanOrEqual(0);
    expect(dbPushAt).toBeGreaterThan(envCheckAt);
  });

  it('derives the function list from supabase/functions instead of hardcoding it', () => {
    const result = run(SCRIPTS.deploy, { args: ['--dry-run'], env: { ...FAKE_CREDENTIALS } });
    const onDisk = fs
      .readdirSync(path.join(REPO_ROOT, 'supabase', 'functions'), { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name.startsWith('mynews-') &&
          fs.existsSync(path.join(REPO_ROOT, 'supabase', 'functions', entry.name, 'index.ts')),
      )
      .map((entry) => entry.name)
      .sort();

    expect(onDisk.length).toBeGreaterThan(0);
    for (const fn of onDisk) {
      expect(result.stdout).toContain(`dry-run: supabase functions deploy ${fn} `);
    }
    expect(result.stdout).toContain(`dry-run: ${onDisk.length} functions would be deployed`);
  });

  it('reports the verify_jwt value declared in supabase/config.toml', () => {
    const result = run(SCRIPTS.deploy, { args: ['--dry-run'], env: { ...FAKE_CREDENTIALS } });
    // Workers are declared verify_jwt = false because pg_cron sends no JWT.
    expect(result.stdout).toMatch(
      /dry-run: supabase functions deploy mynews-account-worker .*verify_jwt = false/,
    );
    // User-facing functions are not on that list, so the CLI default applies.
    expect(result.stdout).toMatch(
      /dry-run: supabase functions deploy mynews-publish .*verify_jwt = default\(true\)/,
    );
  });
});

describe('mynews-smoke.sh', () => {
  it('names each missing credential in the "missing: NAME" form', () => {
    const result = run(SCRIPTS.smoke);
    expect(result.status).toBe(2);
    expect(result.output).toContain('missing: MYNEWS_FUNCTIONS_URL (');
    expect(result.output).toContain('missing: MYNEWS_SMOKE_ANON_KEY (');
  });

  it('reports a missing curl as a missing tool', () => {
    const emptyBin = fs.mkdtempSync(path.join(os.tmpdir(), 'mynews-ops-nobin-'));
    try {
      const result = run(SCRIPTS.smoke, {
        env: { ...FAKE_CREDENTIALS, PATH: emptyBin },
        shimTools: false,
      });
      expect(result.status).toBe(2);
      expect(result.output).toContain('missing: tool curl (');
    } finally {
      fs.rmSync(emptyBin, { recursive: true, force: true });
    }
  });

  it('--dry-run with credentials exits 0 and sends no request', () => {
    const result = run(SCRIPTS.smoke, { args: ['--dry-run'], env: { ...FAKE_CREDENTIALS } });

    expect(result.status, result.output).toBe(0);
    expect(result.status).not.toBe(SHIM_EXIT_CODE);
    expect(result.output).not.toContain('SHIM_INVOKED');
    expect(result.stdout).toMatch(/^dry-run: /m);
    expect(result.stdout).toContain('dry-run: no request was sent and no file was written');
  });

  it('declares every required probe, including the negative gates', () => {
    const result = run(SCRIPTS.smoke, { args: ['--dry-run'], env: { ...FAKE_CREDENTIALS } });
    expect(result.stdout).toContain('probe mynews-health expects HTTP 200');
    expect(result.stdout).toContain('probe mynews-publish-jwt-gate expects HTTP 401');
    expect(result.stdout).toContain('probe mynews-report-jwt-gate expects HTTP 401');
    expect(result.stdout).toContain('probe mynews-account-worker-secret-gate expects HTTP 401 503');
  });
});

describe('mynews-rollback.sh', () => {
  it('exits 2 when --to is missing even with full credentials', () => {
    const result = run(SCRIPTS.rollback, { env: { ...FAKE_CREDENTIALS } });
    expect(result.status, result.output).toBe(2);
    expect(result.output).toContain(
      'missing: --to <git-ref> (commit, tag, or branch to deploy the edge functions from)',
    );
    expectNoSuccessWording(result.output);
  });

  it('exits 2 when --to has no value', () => {
    const result = run(SCRIPTS.rollback, { args: ['--to'], env: { ...FAKE_CREDENTIALS } });
    expect(result.status, result.output).toBe(2);
    expect(result.output).toContain('missing: --to <git-ref> (');
  });

  it('exits 2 for a bogus git ref', () => {
    const result = run(SCRIPTS.rollback, {
      args: ['--to', 'definitely-not-a-real-ref-9f3a2b', '--dry-run'],
      env: { ...FAKE_CREDENTIALS },
    });
    expect(result.status, result.output).toBe(2);
    expect(result.output).toContain('missing: an existing git ref for --to');
    expectNoSuccessWording(result.output);
  });

  it('states loudly at runtime that migrations are not automatically reversible', () => {
    const result = run(SCRIPTS.rollback, { args: ['--help'] });
    expect(result.stdout).toContain('DATABASE MIGRATIONS ARE NOT AUTOMATICALLY REVERSIBLE');
  });
});

/**
 * The rollback happy-path dry run needs a clean working tree, which the live
 * repo will not have while other agents are working in it. These tests run the
 * real script bytes inside a throwaway git repo that has the same layout.
 */
describe('ops scripts in a clean fixture repo', () => {
  let fixtureRoot = '';

  beforeAll(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mynews-rollback-repo-'));

    fs.mkdirSync(path.join(fixtureRoot, 'scripts'), { recursive: true });
    for (const script of Object.values(SCRIPTS)) {
      const target = path.join(fixtureRoot, 'scripts', path.basename(script));
      fs.copyFileSync(script, target);
      fs.chmodSync(target, 0o755);
    }
    fs.copyFileSync(
      path.join(REPO_ROOT, 'scripts', 'gen-mynews-env-matrix.mjs'),
      path.join(fixtureRoot, 'scripts', 'gen-mynews-env-matrix.mjs'),
    );
    fs.mkdirSync(path.join(fixtureRoot, 'apps', 'mynews', 'docs'), { recursive: true });

    const functionsDir = path.join(fixtureRoot, 'supabase', 'functions');
    for (const fn of ['mynews-publish', 'mynews-account-worker']) {
      fs.mkdirSync(path.join(functionsDir, fn), { recursive: true });
      fs.writeFileSync(path.join(functionsDir, fn, 'index.ts'), 'export default {};\n', 'utf8');
    }
    fs.mkdirSync(path.join(fixtureRoot, 'supabase', 'migrations'), { recursive: true });
    fs.writeFileSync(
      path.join(fixtureRoot, 'supabase', 'migrations', '20260101000001_fixture.sql'),
      'select 1;\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(fixtureRoot, 'supabase', 'config.toml'),
      '[functions.mynews-account-worker]\nverify_jwt = false\n',
      'utf8',
    );

    const git = (...args: string[]) => {
      const result = spawnSync('git', ['-C', fixtureRoot, ...args], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
    };
    git('init', '--quiet');
    git('config', 'user.email', 'fixture@example.invalid');
    git('config', 'user.name', 'Fixture');
    git('config', 'commit.gpgsign', 'false');
    git('add', '-A');
    git('commit', '--quiet', '--no-verify', '-m', 'fixture base');

    // A second commit that adds a migration, so HEAD has migration drift
    // relative to the first commit.
    fs.writeFileSync(
      path.join(fixtureRoot, 'supabase', 'migrations', '20260201000001_fixture_later.sql'),
      'select 2;\n',
      'utf8',
    );
    git('add', '-A');
    git('commit', '--quiet', '--no-verify', '-m', 'fixture adds a migration');
  });

  afterAll(() => {
    if (fixtureRoot) fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  function rollbackFixture(args: string[]) {
    return run(path.join(fixtureRoot, 'scripts', 'mynews-rollback.sh'), {
      args,
      env: { ...FAKE_CREDENTIALS },
      cwd: fixtureRoot,
    });
  }

  function deployFixture(args: string[]) {
    return run(path.join(fixtureRoot, 'scripts', 'mynews-deploy.sh'), {
      args,
      env: { ...FAKE_CREDENTIALS },
      cwd: fixtureRoot,
    });
  }

  const fixtureMatrixPath = () =>
    path.join(fixtureRoot, 'apps', 'mynews', 'docs', 'ENV_MATRIX.md');

  it('aborts a real deploy on a stale env matrix, before invoking supabase', () => {
    fs.writeFileSync(fixtureMatrixPath(), '# stale on purpose\n', 'utf8');

    const result = deployFixture([]);

    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('is stale');
    expect(result.output).toContain(
      'FAILED: the environment matrix is stale or has an unannotated variable',
    );
    // Proof it never reached the deploy: the supabase shim would have printed.
    expect(result.output).not.toContain('SHIM_INVOKED');
    expect(result.status).not.toBe(SHIM_EXIT_CODE);
    expectNoSuccessWording(result.output);
  });

  it('aborts a real deploy when the env matrix file is absent', () => {
    fs.rmSync(fixtureMatrixPath(), { force: true });

    const result = deployFixture([]);

    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('does not exist');
    expect(result.output).not.toContain('SHIM_INVOKED');
  });

  it('runs the env matrix gate first and only then reaches supabase link', () => {
    const generated = spawnSync(
      'node',
      [path.join(fixtureRoot, 'scripts', 'gen-mynews-env-matrix.mjs')],
      { encoding: 'utf8', cwd: fixtureRoot },
    );
    expect(generated.status, generated.stderr).toBe(0);

    const result = deployFixture([]);

    // The matrix gate passed, so the script advanced to the linking step and
    // failed there because the supabase shim exits 99.
    expect(result.output).toContain('step 1/5: verifying the environment matrix');
    expect(result.output).toContain('step 2/5: linking the Supabase CLI');
    expect(result.output).toContain('SHIM_INVOKED supabase link');
    expect(result.output).toContain('FAILED: supabase link did not succeed. Nothing was deployed.');
    expect(result.output).not.toContain('supabase db push');
    expect(result.status).toBe(1);
  });

  it('--dry-run with credentials and a clean tree exits 0 and invokes neither supabase nor curl', () => {
    const result = rollbackFixture(['--to', 'HEAD', '--dry-run']);

    expect(result.status, result.output).toBe(0);
    expect(result.status).not.toBe(SHIM_EXIT_CODE);
    expect(result.output).not.toContain('SHIM_INVOKED');
    expect(result.stdout).toMatch(/^dry-run: /m);
    expect(result.stdout).toContain('dry-run: supabase functions deploy mynews-publish');
    expect(result.stdout).toContain('dry-run: supabase functions deploy mynews-account-worker');
    expect(result.stdout).toContain('dry-run: no SQL would run, no migration would be reverted');
    expect(result.stdout).toContain('DATABASE MIGRATIONS ARE NOT AUTOMATICALLY REVERSIBLE');
  });

  it('refuses a target ref with migration drift until --i-have-a-database-plan is passed', () => {
    const withoutFlag = rollbackFixture(['--to', 'HEAD~1', '--dry-run']);
    expect(withoutFlag.status, withoutFlag.output).toBe(2);
    expect(withoutFlag.stdout).toContain('supabase/migrations/20260201000001_fixture_later.sql');
    expect(withoutFlag.output).toContain('this script cannot revert them');
    expect(withoutFlag.stdout).not.toContain('dry-run:');

    const withFlag = rollbackFixture([
      '--to',
      'HEAD~1',
      '--i-have-a-database-plan',
      '--dry-run',
    ]);
    expect(withFlag.status, withFlag.output).toBe(0);
    expect(withFlag.stdout).toContain('operator acknowledged the migration drift');
    expect(withFlag.stdout).toMatch(/^dry-run: /m);
  });

  it('exits 2 when the working tree is dirty', () => {
    const dirtyPath = path.join(fixtureRoot, 'supabase', 'migrations', '20260101000001_fixture.sql');
    const original = fs.readFileSync(dirtyPath, 'utf8');
    fs.writeFileSync(dirtyPath, `${original}-- dirty\n`, 'utf8');
    try {
      const result = rollbackFixture(['--to', 'HEAD', '--dry-run']);
      expect(result.status, result.output).toBe(2);
      expect(result.output).toContain('missing: a clean working tree');
      expect(result.stdout).not.toContain('dry-run:');
    } finally {
      fs.writeFileSync(dirtyPath, original, 'utf8');
    }
  });
});
