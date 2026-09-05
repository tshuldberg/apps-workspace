import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MYNEWS_BOUNDS } from './bounds';

// Source-structural proof for the comment boundary and canonical bounds
// migration (plan 48 WP4). No live Postgres runs in CI, so these assertions
// pin the SQL text: the direct client comment insert must be closed (policy
// dropped + guard trigger), the service-role RPC must be the only writer and
// locked to service_role, and every CHECK must carry the SAME number the
// canonical TypeScript bounds carry. A bound changed in one place and not the
// other fails here.
const migration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260730000003_mynews_comment_boundary.sql'),
  'utf8',
);
const bootstrap = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260703000001_mynews_bootstrap.sql'),
  'utf8',
);

/**
 * Assert the migration contains `snippet` and that the match is NOT the prefix
 * of a longer number. A plain substring assertion cannot tell `... and 4000`
 * from a loosened `... and 40000`, which would let a bound be widened without
 * failing a single test.
 */
function expectBoundSql(snippet: string): void {
  const escaped = snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  expect(migration, snippet).toMatch(new RegExp(`${escaped}(?![0-9])`));
}

describe('20260730000003 comment boundary', () => {
  it('drops the client insert policy the bootstrap shipped', () => {
    // The bootstrap really did allow a direct client comment insert.
    expect(bootstrap).toContain('create policy nw_suggestion_events_actor_insert');
    expect(migration).toContain(
      'drop policy if exists nw_suggestion_events_actor_insert on public.nw_suggestion_events',
    );
  });

  it('adds a client-write guard trigger that blocks authenticated and anon inserts', () => {
    expect(migration).toContain('nw_suggestion_events_guard_client_insert');
    expect(migration).toContain("current_user in ('authenticated', 'anon')");
    expect(migration).toContain('before insert on public.nw_suggestion_events');
    expect(migration).toContain('nw_suggestion_events_insert_guard');
  });

  it('keeps public reads of a thread working (only the write door closes)', () => {
    expect(bootstrap).toContain('create policy nw_suggestion_events_public_select');
    expect(migration).not.toMatch(/(drop|alter)\s+policy[^\n]*nw_suggestion_events_public_select/i);
  });

  it('exposes the service-role comment RPC and locks it to service_role', () => {
    expect(migration).toContain('nw_insert_suggestion_comment');
    expect(migration).toContain('security definer');
    expect(migration).toContain(
      'grant execute on function public.nw_insert_suggestion_comment(uuid, uuid, text) to service_role',
    );
    expect(migration).toContain(
      'revoke all on function public.nw_insert_suggestion_comment(uuid, uuid, text) from anon, authenticated',
    );
  });

  it('returns typed outcomes from the RPC instead of raising', () => {
    for (const outcome of ["'bad-payload'", "'unknown-suggestion'", "'unknown-actor'", "'ok'"]) {
      expect(migration).toContain(`return ${outcome}`);
    }
  });

  it('indexes the per-actor comment window the throttle counts', () => {
    expect(migration).toContain('idx_nw_suggestion_events_actor_comments');
    expect(migration).toContain('on public.nw_suggestion_events (actor_id, created_at)');
    expect(migration).toContain("where action = 'comment'");
  });
});

describe('20260730000003 canonical bounds in SQL', () => {
  it('bounds the comment body with the canonical character range', () => {
    expect(migration).toContain('nw_suggestion_events_comment_body_check');
    expect(migration).toContain("jsonb_typeof(payload -> 'body') = 'string'");
    expectBoundSql(
      `char_length(payload ->> 'body') between ${MYNEWS_BOUNDS.COMMENT_MIN_CHARS} and ${MYNEWS_BOUNDS.COMMENT_MAX_CHARS}`,
    );
  });

  it('bounds the suggestion rationale, citations, and diff', () => {
    expectBoundSql(
      `check (char_length(rationale) between ${MYNEWS_BOUNDS.RATIONALE_MIN_CHARS} and ${MYNEWS_BOUNDS.RATIONALE_MAX_CHARS})`,
    );
    expect(migration).toContain('nw_edit_suggestions_citations_bounds');
    expect(migration).toContain('public.nw_citations_within_bounds(citations)');
    expect(migration).toContain('nw_edit_suggestions_diff_bounds');
    expect(migration).toContain('public.nw_diff_within_bounds(diff_json)');
  });

  it('carries the canonical citation numbers in the helper', () => {
    expectBoundSql(`jsonb_array_length(p_citations) > ${MYNEWS_BOUNDS.CITATIONS_MAX_ITEMS}`);
    expectBoundSql(`char_length(element #>> '{}') > ${MYNEWS_BOUNDS.URL_MAX_CHARS}`);
    expect(migration).toContain("element #>> '{}' not like 'https://%'");
  });

  it('carries the canonical diff numbers and the typed op kinds in the helper', () => {
    expectBoundSql(
      `char_length(p_diff #>> '{baseHash}') not between 1 and ${MYNEWS_BOUNDS.DIFF_BASE_HASH_MAX_CHARS}`,
    );
    expectBoundSql(`jsonb_array_length(p_diff -> 'ops') > ${MYNEWS_BOUNDS.DIFF_MAX_OPS}`);
    expectBoundSql(`octet_length(p_diff::text) > ${MYNEWS_BOUNDS.DIFF_MAX_BYTES}`);
    expectBoundSql(
      `jsonb_array_length(op -> 'baseBlocks') > ${MYNEWS_BOUNDS.DIFF_MAX_BLOCKS_PER_OP}`,
    );
    expectBoundSql(
      `jsonb_array_length(op -> 'newBlocks') > ${MYNEWS_BOUNDS.DIFF_MAX_BLOCKS_PER_OP}`,
    );
    expectBoundSql(`char_length(block #>> '{}') > ${MYNEWS_BOUNDS.DIFF_MAX_BLOCK_CHARS}`);
    expect(migration).toContain("not in ('replace', 'insert', 'delete')");
  });

  it('bounds the article revision text with the canonical numbers', () => {
    expectBoundSql(
      `check (char_length(headline) between ${MYNEWS_BOUNDS.HEADLINE_MIN_CHARS} and ${MYNEWS_BOUNDS.HEADLINE_MAX_CHARS})`,
    );
    expectBoundSql(`check (dek is null or char_length(dek) <= ${MYNEWS_BOUNDS.DEK_MAX_CHARS})`);
    // Bytes, not characters: the storage bound must be script-neutral.
    expectBoundSql(
      `check (octet_length(body_md) between ${MYNEWS_BOUNDS.BODY_MIN_BYTES} and ${MYNEWS_BOUNDS.BODY_MAX_BYTES})`,
    );
    expectBoundSql(`jsonb_array_length(changelog_json) <= ${MYNEWS_BOUNDS.CHANGELOG_MAX_ENTRIES}`);
  });

  it('bounds profile, journalist, and report free text', () => {
    expectBoundSql(`check (char_length(display_name) <= ${MYNEWS_BOUNDS.DISPLAY_NAME_MAX_CHARS})`);
    expectBoundSql(`check (char_length(bio) <= ${MYNEWS_BOUNDS.PROFILE_BIO_MAX_CHARS})`);
    expectBoundSql(
      `check (detail is null or char_length(detail) <= ${MYNEWS_BOUNDS.REPORT_DETAIL_MAX_CHARS})`,
    );
  });

  it('adds every constraint through a guarded existence check (re-runnable)', () => {
    const constraintNames = [
      'nw_suggestion_events_comment_body_check',
      'nw_edit_suggestions_rationale_bounds',
      'nw_edit_suggestions_citations_bounds',
      'nw_edit_suggestions_diff_bounds',
      'nw_article_revisions_headline_bounds',
      'nw_article_revisions_dek_bounds',
      'nw_article_revisions_body_bounds',
      'nw_article_revisions_changelog_bounds',
      'nw_profiles_display_name_bounds',
      'nw_journalists_bio_bounds',
      'nw_reports_detail_bounds',
    ];
    for (const name of constraintNames) {
      expect(migration, name).toContain(`where conname = '${name}'`);
      expect(migration, name).toContain(`add constraint ${name}`);
    }
  });

  it('declares the jsonb helpers immutable so a CHECK can call them', () => {
    const helpers = migration.split('create or replace function');
    for (const marker of ['nw_citations_within_bounds', 'nw_diff_within_bounds']) {
      const body = helpers.find((chunk) => chunk.startsWith(` public.${marker}`));
      expect(body, marker).toBeDefined();
      expect(body, marker).toContain('immutable');
      // plpgsql, not sql: Postgres does not guarantee AND/OR evaluation order,
      // and jsonb_array_length raises on a non-array, so the type guard has to
      // provably run first.
      expect(body, marker).toContain('language plpgsql');
    }
  });
});
