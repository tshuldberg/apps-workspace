import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import type { DatabaseAdapter } from '@mylife/db';
import { SEED_PANTRY_STAPLES } from '@mylife/bestchef';
import type { SupabaseClient } from '@supabase/supabase-js';

export const BESTCHEF_LOCAL_ACCOUNT_TABLES = [
  'rc_receipt_import_lines',
  'rc_receipt_imports',
  'rc_unit_conversion_corrections',
  'rc_recipe_cook_history',
  'rc_recipe_grocery_flags',
  'rc_shopping_list_items',
  'rc_shopping_lists',
  'rc_saved_recipe_media',
  'rc_recipe_collections',
  'rc_collections',
  'rc_steps',
  'rc_recipe_tags',
  'rc_ingredients',
  'rc_meal_plan_items',
  'rc_meal_plans',
  'rc_pantry_batches',
  'rc_pantry_items',
  'rc_nutrition_data',
  'rc_food_confirmations',
  'rc_food_product_aliases',
  'rc_food_products',
  'rc_bestchef_votes',
  'rc_bestchef_submission_like_queue',
  'rc_bestchef_submission_likes',
  'rc_saved_submissions_cache',
  'rc_bestchef_comment_helpful',
  'rc_bestchef_comments',
  'rc_bestchef_reports',
  'rc_bestchef_blocks',
  'rc_bestchef_submissions',
  'rc_media_upload_jobs',
  'rc_bestchef_media_cache',
  'rc_local_vote_proofs',
  'rc_pending_submissions',
  'rc_pending_reports',
  'rc_chef_follows',
  'rc_follower_update_seeds',
  'rc_custom_themes',
  'rc_share_tokens',
  'rc_settings',
] as const;

export interface DeleteBestChefAccountOptions {
  supabase?: SupabaseClient | null;
  reason?: string;
}

export interface DeleteBestChefAccountResult {
  cloudDeletionRequested: boolean;
  cloudProfileDeleted: boolean;
  cloudSignedOut: boolean;
  localWiped: boolean;
  warnings: string[];
}

/**
 * Known SecureStore keys written by packages/sync under the
 * `com.bestchef.bestchef.sync` keychain service. SecureStore has no
 * enumeration API, so we maintain a best-effort list of references that
 * `@mylife/sync`'s secret store may have written. Unknown per-session refs
 * (ephemeral tokens) cannot be deleted here, so a fresh reinstall will clear
 * them. This is a documented limitation.
 */
const KNOWN_SYNC_SECRET_REFS = [
  'sync.identity.privateKey',
  'sync.identity.publicKey',
  'sync.workspace.personal.key',
  'sync.workspace.personal.id',
  'sync.bootstrap',
  'sync.device.id',
];

const SYNC_SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'com.bestchef.bestchef.sync',
};

function collectColumnUris(
  db: DatabaseAdapter,
  table: string,
  column: string,
): string[] {
  try {
    return db
      .query<Record<string, string | null>>(
        `SELECT ${column} FROM ${table} WHERE ${column} IS NOT NULL`,
      )
      .map((row) => row[column])
      .filter((value): value is string => Boolean(value));
  } catch {
    return [];
  }
}

function collectBatchPhotoUris(db: DatabaseAdapter): string[] {
  return collectJsonStringArrayColumnUris(db, 'rc_pantry_batches', 'photos_json');
}

/** Collects URIs from a column holding a JSON array of plain strings, e.g. `["file://a", "file://b"]`. */
function collectJsonStringArrayColumnUris(
  db: DatabaseAdapter,
  table: string,
  column: string,
): string[] {
  try {
    const rows = db.query<Record<string, string | null>>(
      `SELECT ${column} FROM ${table} WHERE ${column} IS NOT NULL`,
    );
    return rows.flatMap((row) => {
      const raw = row[column];
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === 'string')
          : [];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

/** Collects URIs from a column holding a JSON array of `{ uri: string }` objects, e.g. rc_bestchef_submissions.videos_json. */
function collectJsonUriObjectArrayColumnUris(
  db: DatabaseAdapter,
  table: string,
  column: string,
): string[] {
  try {
    const rows = db.query<Record<string, string | null>>(
      `SELECT ${column} FROM ${table} WHERE ${column} IS NOT NULL`,
    );
    return rows.flatMap((row) => {
      const raw = row[column];
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed
          .map((entry) => (entry && typeof entry === 'object' ? (entry as { uri?: unknown }).uri : null))
          .filter((value): value is string => typeof value === 'string');
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function isLocalFileUri(value: string): boolean {
  const documentDirectory = FileSystem.documentDirectory;
  return value.startsWith('file://') || Boolean(documentDirectory && value.startsWith(documentDirectory));
}

function collectLocalAccountFiles(db: DatabaseAdapter): string[] {
  const candidates = [
    ...collectColumnUris(db, 'rc_media_upload_jobs', 'local_uri'),
    ...collectColumnUris(db, 'rc_media_upload_jobs', 'compressed_uri'),
    ...collectColumnUris(db, 'rc_bestchef_media_cache', 'local_uri'),
    ...collectColumnUris(db, 'rc_recipes', 'image_uri'),
    ...collectColumnUris(db, 'rc_pantry_items', 'photo_path'),
    ...collectColumnUris(db, 'rc_receipt_imports', 'photo_uri'),
    ...collectColumnUris(db, 'rc_saved_recipe_media', 'uri'),
    ...collectColumnUris(db, 'rc_local_vote_proofs', 'local_image_uri'),
    ...collectColumnUris(db, 'rc_bestchef_submissions', 'photo_uri'),
    ...collectBatchPhotoUris(db),
    ...collectJsonStringArrayColumnUris(db, 'rc_shopping_lists', 'media_uris_json'),
    ...collectJsonUriObjectArrayColumnUris(db, 'rc_bestchef_submissions', 'videos_json'),
  ];

  return [...new Set(candidates.filter(isLocalFileUri))];
}

async function deleteLocalFiles(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map(async (path) => {
      try {
        await FileSystem.deleteAsync(path, { idempotent: true });
      } catch (err) {
        console.warn(`[wipeAccount] failed to delete local file ${path}`, err);
      }
    }),
  );
}

function breakCircularLocalReferences(db: DatabaseAdapter): void {
  try {
    db.execute(`UPDATE rc_pantry_items SET product_id = NULL, nutrition_data_id = NULL`);
  } catch {}
  try {
    db.execute(`UPDATE rc_nutrition_data SET pantry_item_id = NULL`);
  } catch {}
}

function localTableExists(db: DatabaseAdapter, table: string): boolean {
  try {
    const rows = db.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
      [table],
    );
    return rows.length > 0;
  } catch {
    return true;
  }
}

function resetPantryStaples(db: DatabaseAdapter): void {
  if (!localTableExists(db, 'rc_pantry_staples')) return;

  try {
    db.transaction(() => {
      db.execute('DELETE FROM rc_pantry_staples');
      for (const statement of SEED_PANTRY_STAPLES) {
        db.execute(statement);
      }
    });
  } catch (err) {
    console.warn('[wipeAccount] failed to reset rc_pantry_staples', err);
  }
}

/**
 * Wipe all local BestChef user data, local media files, app settings, and
 * known SecureStore secrets under the sync keychain service.
 *
 * Note: ephemeral / session-scoped SecureStore entries cannot be enumerated.
 * A full wipe requires app reinstall for true secret erasure.
 */
export async function wipeAccount(db: DatabaseAdapter): Promise<void> {
  await deleteLocalFiles(collectLocalAccountFiles(db));
  breakCircularLocalReferences(db);

  for (const table of BESTCHEF_LOCAL_ACCOUNT_TABLES) {
    if (!localTableExists(db, table)) continue;
    try {
      db.execute(`DELETE FROM ${table}`);
    } catch (err) {
      console.warn(`[wipeAccount] failed to clear ${table}`, err);
    }
  }

  resetPantryStaples(db);

  await Promise.all(
    KNOWN_SYNC_SECRET_REFS.map(async (ref) => {
      try {
        await SecureStore.deleteItemAsync(ref, SYNC_SECURE_STORE_OPTIONS);
      } catch (err) {
        console.warn(`[wipeAccount] failed to delete secret ${ref}`, err);
      }
    }),
  );
}

export async function deleteBestChefAccount(
  db: DatabaseAdapter,
  options: DeleteBestChefAccountOptions = {},
): Promise<DeleteBestChefAccountResult> {
  const result: DeleteBestChefAccountResult = {
    cloudDeletionRequested: false,
    cloudProfileDeleted: false,
    cloudSignedOut: false,
    localWiped: false,
    warnings: [],
  };

  const supabase = options.supabase ?? null;
  if (supabase) {
    const userResult = await supabase.auth.getUser();
    const user = userResult.data.user;

    if (userResult.error) {
      result.warnings.push(userResult.error.message);
    }

    if (user) {
      const deletionRequest = await supabase.rpc('bc_request_account_deletion', {
        p_reason: options.reason ?? 'user_requested_delete_account',
        p_metadata: { source: 'bestchef_app' },
      });
      if (deletionRequest.error) {
        result.warnings.push(deletionRequest.error.message);
      } else {
        result.cloudDeletionRequested = true;
      }

      const profileDelete = await supabase
        .from('social_profiles')
        .delete()
        .eq('user_id', user.id);
      if (profileDelete.error) {
        result.warnings.push(profileDelete.error.message);
      } else {
        result.cloudProfileDeleted = true;
      }
    }

    const signOut = await supabase.auth.signOut({ scope: 'global' });
    if (signOut.error) {
      result.warnings.push(signOut.error.message);
    } else {
      result.cloudSignedOut = true;
    }
  }

  await wipeAccount(db);
  result.localWiped = true;
  return result;
}
