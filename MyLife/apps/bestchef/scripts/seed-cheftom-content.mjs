#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');
const recipesPath = resolve(appRoot, 'app/(root)/data/cheftom-seed-recipes.json');

const SOURCE_URL =
  'https://www.foodnetwork.com/recipes/photos/foodnetwork-top-50-most-saved-recipes';
const SOURCE_ATTRIBUTION =
  'Food Network top 50 most-saved recipes page, used as title/ranking inspiration. Recipe detail is BestChef editorial baseline content.';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

function requireEnv(key) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function readRecipes() {
  return JSON.parse(readFileSync(recipesPath, 'utf8'));
}

function missingColumnName(error) {
  const message = error?.message ?? '';
  const match = message.match(/Could not find the '([^']+)' column/);
  return match?.[1] ?? null;
}

function isServerControlledSubmissionUpdateError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Server-controlled submission fields cannot be changed directly');
}

async function runWithMissingColumnFallback(makeRequest, payload) {
  const nextPayload = { ...payload };
  const removedColumns = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await makeRequest(nextPayload);
    if (!result.error) {
      return { result, removedColumns };
    }

    const missing = missingColumnName(result.error);
    if (!missing || !(missing in nextPayload)) {
      throw new Error(result.error.message);
    }

    delete nextPayload[missing];
    removedColumns.push(missing);
  }

  throw new Error('Too many missing-column retries while writing seed content.');
}

async function getOrCreateChefTomProfile(supabase) {
  const existing = await supabase
    .from('social_profiles')
    .select('id, user_id')
    .eq('handle', 'cheftom')
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) return existing.data.id;

  let userId = process.env.BESTCHEF_CHEFTOM_USER_ID?.trim() ?? '';
  if (!userId) {
    const email = process.env.BESTCHEF_CHEFTOM_EMAIL ?? 'cheftom@bestchef.local';
    const created = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        display_name: 'ChefTom',
        bestchef_seed: true,
      },
    });
    if (created.error) {
      throw new Error(
        `Unable to create ChefTom auth user: ${created.error.message}. ` +
          'If the email already exists, set BESTCHEF_CHEFTOM_USER_ID and rerun.',
      );
    }
    userId = created.data.user.id;
  }

  const profile = await supabase
    .from('social_profiles')
    .insert({
      user_id: userId,
      handle: 'cheftom',
      display_name: 'ChefTom',
      bio: 'Editorial seed chef for BestChef baseline content.',
      privacy_settings: {
        discoverable: true,
        showModules: false,
        showStreaks: false,
        openFollows: false,
        moduleSettings: [],
      },
      enabled_modules: ['bestchef'],
    })
    .select('id')
    .single();

  if (profile.error) throw new Error(profile.error.message);
  return profile.data.id;
}

async function getOrCreateDish(supabase, recipe) {
  const existing = await supabase
    .from('bc_dishes')
    .select('id')
    .eq('slug', recipe.dishSlug)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) {
    const { result } = await runWithMissingColumnFallback(
      (payload) => supabase
        .from('bc_dishes')
        .update(payload)
        .eq('id', existing.data.id),
      {
        name: recipe.dishName,
        category: recipe.category,
        cuisine: recipe.cuisine,
        region: recipe.region,
        description: recipe.description,
        status: 'active',
      },
    );
    if (result.error) throw new Error(result.error.message);
    return existing.data.id;
  }

  const { result: created } = await runWithMissingColumnFallback(
    (payload) => supabase
      .from('bc_dishes')
      .insert(payload)
      .select('id')
      .single(),
    {
      name: recipe.dishName,
      slug: recipe.dishSlug,
      category: recipe.category,
      cuisine: recipe.cuisine,
      region: recipe.region,
      description: recipe.description,
      status: 'active',
    },
  );

  if (created.error) throw new Error(created.error.message);
  return created.data.id;
}

async function getOrCreateSnapshot(supabase, profileId, recipe) {
  const localId = `cheftom:${recipe.id}`;
  const existing = await supabase
    .from('bc_recipe_snapshots')
    .select('id')
    .eq('profile_id', profileId)
    .eq('original_local_recipe_id', localId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const payload = {
    original_local_recipe_id: localId,
    profile_id: profileId,
    title: recipe.title,
    description: recipe.description,
    ingredients_json: recipe.ingredients,
    steps_json: recipe.steps,
    tags: ['editorial_seed', 'cheftom'],
    source_url: SOURCE_URL,
    source_attribution: SOURCE_ATTRIBUTION,
  };

  if (existing.data?.id) {
    const { result: updated } = await runWithMissingColumnFallback(
      (nextPayload) => supabase
        .from('bc_recipe_snapshots')
        .update(nextPayload)
        .eq('id', existing.data.id)
        .select('id')
        .single(),
      payload,
    );
    if (updated.error) throw new Error(updated.error.message);
    return updated.data.id;
  }

  const { result: created } = await runWithMissingColumnFallback(
    (nextPayload) => supabase
      .from('bc_recipe_snapshots')
      .insert(nextPayload)
      .select('id')
      .single(),
    payload,
  );
  if (created.error) throw new Error(created.error.message);
  return created.data.id;
}

async function deleteRetiredChefTomContent(supabase, profileId, recipes) {
  const currentLocalIds = new Set(recipes.map((recipe) => `cheftom:${recipe.id}`));
  const existing = await supabase
    .from('bc_recipe_snapshots')
    .select('id, original_local_recipe_id')
    .eq('profile_id', profileId)
    .like('original_local_recipe_id', 'cheftom:%');
  if (existing.error) throw new Error(existing.error.message);

  const retiredSnapshotIds = (existing.data ?? [])
    .filter((snapshot) => !currentLocalIds.has(snapshot.original_local_recipe_id))
    .map((snapshot) => snapshot.id);
  if (retiredSnapshotIds.length === 0) return;

  const deletedSubmissions = await supabase
    .from('bc_submissions')
    .delete()
    .eq('profile_id', profileId)
    .in('recipe_snapshot_id', retiredSnapshotIds);
  if (deletedSubmissions.error) throw new Error(deletedSubmissions.error.message);

  const deletedSnapshots = await supabase
    .from('bc_recipe_snapshots')
    .delete()
    .eq('profile_id', profileId)
    .in('id', retiredSnapshotIds);
  if (deletedSnapshots.error) throw new Error(deletedSnapshots.error.message);
}

async function upsertSubmission(supabase, profileId, dishId, snapshotId, recipe) {
  const existing = await supabase
    .from('bc_submissions')
    .select('id')
    .eq('profile_id', profileId)
    .eq('recipe_snapshot_id', snapshotId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const payload = {
    dish_id: dishId,
    recipe_snapshot_id: snapshotId,
    profile_id: profileId,
    photo_url: null,
    photo_verified: true,
    vote_score: recipe.voteScore,
    like_count: recipe.likeCount,
    rank: 1,
    moderation_status: 'approved',
    region: recipe.region,
    is_restaurant: false,
    upvote_count: recipe.upvoteCount,
    downvote_count: recipe.downvoteCount,
    reviewed_count: recipe.reviewedCount,
    tap_count: recipe.upvoteCount + recipe.downvoteCount,
  };

  async function insertSubmission() {
    const { result: created, removedColumns } = await runWithMissingColumnFallback(
      (nextPayload) => supabase
        .from('bc_submissions')
        .insert(nextPayload)
        .select('id')
        .single(),
      payload,
    );
    if (removedColumns.length > 0) {
      console.log(`Skipped unsupported bc_submissions columns: ${removedColumns.join(', ')}`);
    }
    if (created.error) throw new Error(created.error.message);
    return created.data.id;
  }

  if (existing.data?.id) {
    try {
      const { result: updated, removedColumns } = await runWithMissingColumnFallback(
        (nextPayload) => supabase
          .from('bc_submissions')
          .update(nextPayload)
          .eq('id', existing.data.id)
          .select('id')
          .single(),
        payload,
      );
      if (removedColumns.length > 0) {
        console.log(`Skipped unsupported bc_submissions columns: ${removedColumns.join(', ')}`);
      }
      if (updated.error) throw new Error(updated.error.message);
      return updated.data.id;
    } catch (error) {
      if (!isServerControlledSubmissionUpdateError(error)) throw error;

      const deleted = await supabase
        .from('bc_submissions')
        .delete()
        .eq('id', existing.data.id);
      if (deleted.error) throw new Error(deleted.error.message);
      return insertSubmission();
    }
  }

  return insertSubmission();
}

async function refreshDishSubmissionCount(supabase, dishId) {
  const counted = await supabase
    .from('bc_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('dish_id', dishId);
  if (counted.error) throw new Error(counted.error.message);

  const updated = await supabase
    .from('bc_dishes')
    .update({ submission_count: counted.count ?? 0 })
    .eq('id', dishId);
  if (updated.error) throw new Error(updated.error.message);
}

async function main() {
  loadEnvFile(resolve(appRoot, '.env.local'));
  loadEnvFile(resolve(appRoot, '.env'));

  const url = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const recipes = readRecipes();
  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const profileId = await getOrCreateChefTomProfile(supabase);
  await deleteRetiredChefTomContent(supabase, profileId, recipes);
  const dishIds = new Set();
  const submissionIds = [];

  for (const recipe of recipes) {
    const dishId = await getOrCreateDish(supabase, recipe);
    const snapshotId = await getOrCreateSnapshot(supabase, profileId, recipe);
    const submissionId = await upsertSubmission(
      supabase,
      profileId,
      dishId,
      snapshotId,
      recipe,
    );
    dishIds.add(dishId);
    submissionIds.push(submissionId);
  }

  for (const dishId of dishIds) {
    await refreshDishSubmissionCount(supabase, dishId);
  }

  console.log(`Seeded ChefTom profile ${profileId}.`);
  console.log(`Seeded ${submissionIds.length} BestChef recipe submissions.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
