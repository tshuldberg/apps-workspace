/**
 * Recipe remix engine -- fork/remix with attribution and lineage tracking.
 *
 * When a chef forks a recipe, the source RecipeSnapshot is duplicated with
 * optional modifications applied, and a bc_recipe_forks record links the
 * two snapshots for attribution and lineage traversal.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';
import type { RecipeSnapshot, RecipeFork } from './types';

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Row mappers ───────────────────────────────────────────────────────

function mapSnapshot(row: Record<string, unknown>): RecipeSnapshot {
  return {
    id: row.id as string,
    originalLocalRecipeId: (row.original_local_recipe_id as string) ?? null,
    profileId: row.profile_id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    servings: (row.servings as number) ?? null,
    prepTimeMins: (row.prep_time_mins as number) ?? null,
    cookTimeMins: (row.cook_time_mins as number) ?? null,
    totalTimeMins: (row.total_time_mins as number) ?? null,
    difficulty: (row.difficulty as string) ?? null,
    ingredientsJson: row.ingredients_json ?? null,
    stepsJson: row.steps_json ?? null,
    tags: (row.tags as string[]) ?? null,
    nutritionJson: row.nutrition_json ?? null,
    sourceUrl: (row.source_url as string) ?? null,
    sourceAttribution: (row.source_attribution as string) ?? null,
    createdAt: new Date(row.created_at as string),
  };
}

function mapFork(row: Record<string, unknown>): RecipeFork {
  return {
    id: row.id as string,
    sourceSnapshotId: row.source_snapshot_id as string,
    forkedByProfileId: row.forked_by_profile_id as string,
    forkedSnapshotId: row.forked_snapshot_id as string,
    createdAt: new Date(row.created_at as string),
  };
}

// ── Modification type ────────────────────────────────────────────────

export interface RecipeModifications {
  title?: string;
  description?: string;
  servings?: number;
  prepTimeMins?: number;
  cookTimeMins?: number;
  totalTimeMins?: number;
  difficulty?: string;
  ingredientsJson?: unknown;
  stepsJson?: unknown;
  tags?: string[];
}

// ── Fork operations ──────────────────────────────────────────────────

/**
 * Fork a recipe: duplicate the source snapshot with optional modifications,
 * then create a bc_recipe_forks record linking source to fork.
 */
export async function forkRecipe(
  sourceSnapshotId: string,
  forkedByProfileId: string,
  modifications?: RecipeModifications,
): Promise<BestChefResult<{ snapshot: RecipeSnapshot; fork: RecipeFork }>> {
  // 1. Read source snapshot
  const { data: sourceRow, error: sourceErr } = await from('bc_recipe_snapshots')
    .select('*')
    .eq('id', sourceSnapshotId)
    .single();

  if (sourceErr) return err(sourceErr.message);

  // 2. Build new snapshot with modifications applied
  const newSnapshotData: Record<string, unknown> = {
    original_local_recipe_id: null,
    profile_id: forkedByProfileId,
    title: modifications?.title ?? sourceRow.title,
    description: modifications?.description ?? sourceRow.description,
    servings: modifications?.servings ?? sourceRow.servings,
    prep_time_mins: modifications?.prepTimeMins ?? sourceRow.prep_time_mins,
    cook_time_mins: modifications?.cookTimeMins ?? sourceRow.cook_time_mins,
    total_time_mins: modifications?.totalTimeMins ?? sourceRow.total_time_mins,
    difficulty: modifications?.difficulty ?? sourceRow.difficulty,
    ingredients_json: modifications?.ingredientsJson
      ? JSON.stringify(modifications.ingredientsJson)
      : sourceRow.ingredients_json,
    steps_json: modifications?.stepsJson
      ? JSON.stringify(modifications.stepsJson)
      : sourceRow.steps_json,
    tags: modifications?.tags ?? sourceRow.tags,
    nutrition_json: sourceRow.nutrition_json,
    source_url: sourceRow.source_url,
    source_attribution: sourceRow.source_attribution,
  };

  const { data: snapRow, error: snapErr } = await from('bc_recipe_snapshots')
    .insert(newSnapshotData)
    .select()
    .single();

  if (snapErr) return err(snapErr.message);

  // 3. Create fork record
  const { data: forkRow, error: forkErr } = await from('bc_recipe_forks')
    .insert({
      source_snapshot_id: sourceSnapshotId,
      forked_by_profile_id: forkedByProfileId,
      forked_snapshot_id: snapRow.id,
    })
    .select()
    .single();

  if (forkErr) return err(forkErr.message);

  return ok({
    snapshot: mapSnapshot(snapRow),
    fork: mapFork(forkRow),
  });
}

// ── Read operations ──────────────────────────────────────────────────

export async function getForksOfRecipe(
  snapshotId: string,
): Promise<BestChefResult<RecipeFork[]>> {
  const { data, error: dbErr } = await from('bc_recipe_forks')
    .select('*')
    .eq('source_snapshot_id', snapshotId)
    .order('created_at', { ascending: false });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapFork));
}

export async function getForksByChef(
  profileId: string,
): Promise<BestChefResult<RecipeFork[]>> {
  const { data, error: dbErr } = await from('bc_recipe_forks')
    .select('*')
    .eq('forked_by_profile_id', profileId)
    .order('created_at', { ascending: false });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapFork));
}

export async function getForkCount(
  snapshotId: string,
): Promise<BestChefResult<number>> {
  const { count, error: dbErr } = await from('bc_recipe_forks')
    .select('*', { count: 'exact', head: true })
    .eq('source_snapshot_id', snapshotId);

  if (dbErr) return err(dbErr.message);
  return ok(count ?? 0);
}

export async function getSourceRecipe(
  forkId: string,
): Promise<BestChefResult<RecipeSnapshot>> {
  const { data: forkRow, error: forkErr } = await from('bc_recipe_forks')
    .select('*')
    .eq('id', forkId)
    .single();

  if (forkErr) return err(forkErr.message);

  const { data: snapRow, error: snapErr } = await from('bc_recipe_snapshots')
    .select('*')
    .eq('id', forkRow.source_snapshot_id)
    .single();

  if (snapErr) return err(snapErr.message);
  return ok(mapSnapshot(snapRow));
}

export async function isForked(
  snapshotId: string,
): Promise<BestChefResult<boolean>> {
  const { count, error: dbErr } = await from('bc_recipe_forks')
    .select('*', { count: 'exact', head: true })
    .eq('forked_snapshot_id', snapshotId);

  if (dbErr) return err(dbErr.message);
  return ok((count ?? 0) > 0);
}

/**
 * Trace the full fork chain from the original recipe to the given snapshot.
 * Returns an ordered array of snapshot IDs from the root original to the target.
 */
export async function getRecipeLineage(
  snapshotId: string,
): Promise<BestChefResult<string[]>> {
  // Load all forks to build a lookup from forkedSnapshotId -> sourceSnapshotId
  const { data, error: dbErr } = await from('bc_recipe_forks')
    .select('source_snapshot_id, forked_snapshot_id');

  if (dbErr) return err(dbErr.message);

  const parentOf = new Map<string, string>();
  for (const row of data ?? []) {
    parentOf.set(
      row.forked_snapshot_id as string,
      row.source_snapshot_id as string,
    );
  }

  // Walk up from snapshotId to root, guarding against cycles
  const chain: string[] = [snapshotId];
  const visited = new Set<string>([snapshotId]);
  let current = snapshotId;

  while (parentOf.has(current)) {
    const parent = parentOf.get(current)!;
    if (visited.has(parent)) break; // cycle guard
    visited.add(parent);
    chain.push(parent);
    current = parent;
  }

  // Reverse so index 0 is the original root
  chain.reverse();
  return ok(chain);
}

// ── Pure helpers ─────────────────────────────────────────────────────

export interface LineageNode {
  snapshotId: string;
  children: LineageNode[];
}

/**
 * Build a tree structure from flat fork records.
 * Nodes without a parent in the fork set become roots.
 */
export function buildLineageTree(forks: RecipeFork[]): LineageNode[] {
  const childrenOf = new Map<string, string[]>();
  const allForkedIds = new Set<string>();

  for (const fork of forks) {
    allForkedIds.add(fork.forkedSnapshotId);
    const existing = childrenOf.get(fork.sourceSnapshotId);
    if (existing) {
      existing.push(fork.forkedSnapshotId);
    } else {
      childrenOf.set(fork.sourceSnapshotId, [fork.forkedSnapshotId]);
    }
  }

  // Roots are source IDs that are not themselves forks
  const rootIds = new Set<string>();
  for (const fork of forks) {
    if (!allForkedIds.has(fork.sourceSnapshotId)) {
      rootIds.add(fork.sourceSnapshotId);
    }
  }

  function buildNode(snapshotId: string, visited: Set<string>): LineageNode {
    const children = childrenOf.get(snapshotId) ?? [];
    return {
      snapshotId,
      children: children
        .filter((id) => !visited.has(id))
        .map((id) => {
          const next = new Set(visited);
          next.add(id);
          return buildNode(id, next);
        }),
    };
  }

  return Array.from(rootIds).map((id) => buildNode(id, new Set([id])));
}

/**
 * Compute how many levels deep a snapshot is in the fork chain.
 * Returns 0 for a root (not a fork of anything).
 */
export function getLineageDepth(
  forks: RecipeFork[],
  snapshotId: string,
): number {
  const parentOf = new Map<string, string>();
  for (const fork of forks) {
    parentOf.set(fork.forkedSnapshotId, fork.sourceSnapshotId);
  }

  let depth = 0;
  let current = snapshotId;
  const visited = new Set<string>([current]);

  while (parentOf.has(current)) {
    const parent = parentOf.get(current)!;
    if (visited.has(parent)) break; // cycle guard
    visited.add(parent);
    current = parent;
    depth++;
  }

  return depth;
}
