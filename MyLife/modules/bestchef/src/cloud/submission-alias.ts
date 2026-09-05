/**
 * Submission alias bridge for beta clients.
 *
 * The standalone app still has local/demo ids such as `s1` and
 * `local-...`. This bridge resolves those ids to real hosted
 * `bc_submissions` rows without loosening core submission RLS.
 */

import { err, getBestChefClient, ok, type BestChefResult } from './client';
import { getDishBySlug } from './dish-taxonomy';
import { normalizePublicMediaUrl } from './public-data-policy';
import { normalizeUgcLanguage } from './submission';

const SUBMISSION_ALIAS_PATTERN = /^(demo|local):[A-Za-z0-9_-]{1,80}$/;

/** Input used to create a hosted submission when an alias has not been seen. */
export interface EnsureSubmissionAliasInput {
  alias: string;
  profileId: string;
  dishSlug: string;
  title: string;
  description?: string | null;
  ingredients: string[];
  steps: string[];
  tags?: string[];
  photoUrl?: string | null;
  /** Author's app language tag, lowercase (plan 33 Phase 2.5). */
  language?: string | null;
}

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

function isValidSubmissionAlias(alias: string): boolean {
  return SUBMISSION_ALIAS_PATTERN.test(alias);
}

async function deleteDraftSubmission(
  submissionId: string | null,
  snapshotId: string | null,
): Promise<void> {
  if (submissionId) {
    await from('bc_submissions').delete().eq('id', submissionId);
  }
  if (snapshotId) {
    await from('bc_recipe_snapshots').delete().eq('id', snapshotId);
  }
}

/** Returns the hosted submission id for a local/demo alias, when one exists. */
export async function getSubmissionIdForAlias(
  alias: string,
): Promise<BestChefResult<string | null>> {
  if (!isValidSubmissionAlias(alias)) {
    return err('Submission alias is invalid.');
  }

  const { data, error: dbErr } = await from('bc_submission_aliases')
    .select('submission_id')
    .eq('alias', alias)
    .maybeSingle();

  if (dbErr) return err(dbErr.message);
  return ok((data?.submission_id as string | undefined) ?? null);
}

/**
 * Idempotently creates a hosted submission for a local/demo alias.
 *
 * If another client created the alias first, this returns the existing
 * hosted submission id and cleans up the losing draft row.
 */
export async function ensureSubmissionAlias(
  input: EnsureSubmissionAliasInput,
): Promise<BestChefResult<string>> {
  if (!isValidSubmissionAlias(input.alias)) {
    return err('Submission alias is invalid.');
  }

  const existing = await getSubmissionIdForAlias(input.alias);
  if (!existing.ok) return err(existing.error);
  if (existing.data) return ok(existing.data);

  const dishResult = await getDishBySlug(input.dishSlug);
  if (!dishResult.ok) return err(dishResult.error);

  let snapshotId: string | null = null;
  let submissionId: string | null = null;

  const { data: snapshot, error: snapshotErr } = await from('bc_recipe_snapshots')
    .insert({
      original_local_recipe_id: input.alias,
      profile_id: input.profileId,
      title: input.title,
      description: input.description ?? null,
      ingredients_json: input.ingredients,
      steps_json: input.steps,
      tags: input.tags && input.tags.length > 0 ? input.tags : null,
      language: normalizeUgcLanguage(input.language),
    })
    .select('id')
    .single();

  if (snapshotErr) return err(snapshotErr.message);
  snapshotId = snapshot.id as string;

  const { data: submission, error: submissionErr } = await from('bc_submissions')
    .insert({
      dish_id: dishResult.data.dish.id,
      recipe_snapshot_id: snapshotId,
      profile_id: input.profileId,
      photo_url: normalizePublicMediaUrl(input.photoUrl),
      language: normalizeUgcLanguage(input.language),
    })
    .select('id')
    .single();

  if (submissionErr) {
    await deleteDraftSubmission(null, snapshotId);
    return err(submissionErr.message);
  }
  submissionId = submission.id as string;

  const { error: aliasErr } = await from('bc_submission_aliases')
    .insert({
      alias: input.alias,
      submission_id: submissionId,
      created_by_profile_id: input.profileId,
    });

  if (!aliasErr) return ok(submissionId);

  const raced = await getSubmissionIdForAlias(input.alias);
  await deleteDraftSubmission(submissionId, snapshotId);

  if (raced.ok && raced.data) return ok(raced.data);
  return err(aliasErr.message);
}
