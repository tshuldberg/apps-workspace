#!/usr/bin/env node
/**
 * Idempotent seeder + verifier for BestChef's `bc_job_config` rows (audit M9).
 *
 * Every scheduled worker (rankings refresh, account deletion, media purge,
 * vote-proof moderation, media screening, URL re-sign, push fanout) reads its
 * function URL and secret from `bc_job_config` at call time. A missing row is
 * NOT an error, it is a silent no-op (see migrations 20260610000001,
 * 20260704000002, 20260711000005, 20260711000009, 20260711000010): the cron job
 * fires on schedule, finds its config row absent, and returns immediately.
 * Nothing pages anyone. This
 * script exists so every environment bring-up seeds every required row from
 * one command, and so `--verify` can gate a prod deploy on
 * `bc_job_health().healthy`.
 *
 * Required bc_job_config rows (source: bc_run_*_worker functions read
 * exactly these keys; confirmed against the four migrations above):
 *   functions_base_url                    (shared by every worker)
 *   account_deletion_worker_secret        (bc_run_account_deletion_worker)
 *   media_purge_worker_secret             (bc_run_media_purge_worker)
 *   vote_proof_moderation_worker_secret   (bc_run_vote_proof_moderation_worker)
 *   media_screening_worker_secret         (bc_run_media_screening_worker)
 *   url_resign_worker_secret              (bc_run_url_resign_worker)
 *   push_fanout_worker_secret             (bc_run_push_fanout_worker)
 *
 * Env vars (all required for a real run; --dry-run only needs the Supabase
 * pair so it can still validate connectivity intent):
 *   SUPABASE_URL                          Project URL, e.g. https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY             Service-role key (never anon/publishable)
 *   BESTCHEF_FUNCTIONS_BASE_URL           e.g. https://<ref>.supabase.co/functions/v1
 *   BESTCHEF_ACCOUNT_DELETION_WORKER_SECRET
 *   BESTCHEF_MEDIA_PURGE_WORKER_SECRET
 *   BESTCHEF_VOTE_PROOF_MODERATION_WORKER_SECRET
 *   BESTCHEF_MEDIA_SCREENING_WORKER_SECRET
 *   BESTCHEF_URL_RESIGN_WORKER_SECRET
 *   BESTCHEF_PUSH_FANOUT_WORKER_SECRET
 *
 * Modes:
 *   node scripts/seed-bc-job-config.mjs                # upsert all rows from env
 *   node scripts/seed-bc-job-config.mjs --dry-run       # print planned changes, write nothing
 *   node scripts/seed-bc-job-config.mjs --verify        # call bc_job_health(), exit nonzero unless healthy=true
 *   node scripts/seed-bc-job-config.mjs --verify --dry-run  # verify only, skip seeding entirely
 *
 * Exit codes: 0 on success, 1 on missing env / write failure / unhealthy verify.
 */

import { createClient } from '@supabase/supabase-js';

const REQUIRED_ROWS = [
  {
    key: 'functions_base_url',
    envVar: 'BESTCHEF_FUNCTIONS_BASE_URL',
    usedBy: 'all workers',
  },
  {
    key: 'account_deletion_worker_secret',
    envVar: 'BESTCHEF_ACCOUNT_DELETION_WORKER_SECRET',
    usedBy: 'bc_run_account_deletion_worker',
  },
  {
    key: 'media_purge_worker_secret',
    envVar: 'BESTCHEF_MEDIA_PURGE_WORKER_SECRET',
    usedBy: 'bc_run_media_purge_worker',
  },
  {
    key: 'vote_proof_moderation_worker_secret',
    envVar: 'BESTCHEF_VOTE_PROOF_MODERATION_WORKER_SECRET',
    usedBy: 'bc_run_vote_proof_moderation_worker',
  },
  {
    key: 'media_screening_worker_secret',
    envVar: 'BESTCHEF_MEDIA_SCREENING_WORKER_SECRET',
    usedBy: 'bc_run_media_screening_worker',
  },
  {
    key: 'url_resign_worker_secret',
    envVar: 'BESTCHEF_URL_RESIGN_WORKER_SECRET',
    usedBy: 'bc_run_url_resign_worker',
  },
  {
    key: 'push_fanout_worker_secret',
    envVar: 'BESTCHEF_PUSH_FANOUT_WORKER_SECRET',
    usedBy: 'bc_run_push_fanout_worker',
  },
];

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    verify: argv.includes('--verify'),
  };
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function collectRequiredRowValues() {
  const missing = [];
  const rows = [];
  for (const row of REQUIRED_ROWS) {
    const value = process.env[row.envVar]?.trim();
    if (!value) {
      missing.push(row.envVar);
      continue;
    }
    rows.push({ key: row.key, value, usedBy: row.usedBy });
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required env var${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
    );
  }
  return rows;
}

function createSupabaseClient() {
  const url = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchExistingConfig(supabase) {
  const { data, error } = await supabase.from('bc_job_config').select('key, value');
  if (error) {
    throw new Error(`Failed to read bc_job_config: ${error.message}`);
  }
  return new Map((data ?? []).map((row) => [row.key, row.value]));
}

async function seedConfig({ dryRun }) {
  const rows = collectRequiredRowValues();
  const supabase = createSupabaseClient();
  const existing = await fetchExistingConfig(supabase);

  const plan = rows.map((row) => {
    const current = existing.get(row.key);
    let action;
    if (current === undefined) {
      action = 'created';
    } else if (current !== row.value) {
      action = 'updated';
    } else {
      action = 'unchanged';
    }
    return { ...row, action };
  });

  if (dryRun) {
    console.log('[dry-run] bc_job_config plan (no writes performed):');
    for (const row of plan) {
      console.log(`  ${row.action.padEnd(9)} ${row.key}  (used by: ${row.usedBy})`);
    }
    return plan;
  }

  for (const row of plan) {
    if (row.action === 'unchanged') continue;
    const { error } = await supabase
      .from('bc_job_config')
      .upsert({ key: row.key, value: row.value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) {
      throw new Error(`Failed to upsert bc_job_config.${row.key}: ${error.message}`);
    }
  }

  console.log('bc_job_config seed summary:');
  for (const row of plan) {
    console.log(`  ${row.action.padEnd(9)} ${row.key}  (used by: ${row.usedBy})`);
  }
  return plan;
}

async function verifyJobHealth() {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc('bc_job_health');
  if (error) {
    throw new Error(`bc_job_health() call failed: ${error.message}`);
  }
  const health = data ?? {};
  console.log('bc_job_health():', JSON.stringify(health, null, 2));
  if (health.healthy !== true) {
    throw new Error('bc_job_health().healthy is not true; see the payload above for the failing checks.');
  }
  console.log('bc_job_health(): healthy=true');
  return health;
}

async function main() {
  const { dryRun, verify } = parseArgs(process.argv.slice(2));

  if (!(verify && dryRun)) {
    await seedConfig({ dryRun });
  } else {
    console.log('[dry-run + verify] skipping seed writes, running verification only.');
  }

  if (verify) {
    await verifyJobHealth();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
