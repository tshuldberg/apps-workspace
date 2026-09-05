'use server';

import { actionRedirects, type ActionRedirects } from '@/lib/actions-shared';
import { requireModerator } from '@/lib/auth';
import { isTranslationStatus, normalizeDishLocale } from '@/lib/dish-locales';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * Editorial dish-translation writes (plan 33 Phase 2.3). Direct table
 * upserts are the designed write path here (RLS: bc_is_admin only); the
 * unique (dish_id, locale) key makes the upsert deterministic and
 * updated_by carries moderator attribution.
 */

function respondFor(dishId: string, query: string): ActionRedirects {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  params.set('dish', dishId);
  return actionRedirects(`/dishes?${params.toString()}`);
}

export async function upsertDishTranslation(formData: FormData): Promise<void> {
  const moderatorEmail = await requireModerator();
  const dishId = String(formData.get('dishId') ?? '').trim();
  const query = String(formData.get('q') ?? '').trim();
  const respond: ActionRedirects = respondFor(dishId, query);

  const locale = normalizeDishLocale(String(formData.get('locale') ?? ''));
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const status = String(formData.get('status') ?? 'approved').trim();

  if (!dishId) respond.fail('invalid_input');
  if (!locale) respond.fail('invalid_locale');
  if (!name || name.length > 200) respond.fail('invalid_name');
  if (description.length > 2000) respond.fail('invalid_description');
  if (!isTranslationStatus(status)) respond.fail('invalid_status');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bc_dish_translations')
    .upsert(
      {
        dish_id: dishId,
        locale,
        name,
        description: description || null,
        status,
        source: 'editorial',
        updated_by: moderatorEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'dish_id,locale' },
    )
    .select('id');
  if (error || !data || data.length !== 1) {
    console.error(
      `bestchef-console: dish translation upsert failed (${dishId}/${locale})${
        error ? `: ${error.message}` : ''
      }`,
    );
    respond.fail('translation_upsert_failed');
  }
  respond.done('translation_saved');
}

export async function deleteDishTranslation(formData: FormData): Promise<void> {
  await requireModerator();
  const dishId = String(formData.get('dishId') ?? '').trim();
  const query = String(formData.get('q') ?? '').trim();
  const respond: ActionRedirects = respondFor(dishId, query);

  const locale = normalizeDishLocale(String(formData.get('locale') ?? ''));
  if (!dishId || !locale) respond.fail('invalid_input');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bc_dish_translations')
    .delete()
    .eq('dish_id', dishId)
    .eq('locale', locale)
    .select('id');
  if (error || !data || data.length !== 1) respond.fail('translation_delete_failed');
  respond.done('translation_deleted');
}
