'use server';

import { actionRedirects, type ActionRedirects } from '@/lib/actions-shared';
import { requireModerator } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-admin';

const respond: ActionRedirects = actionRedirects('/');

/**
 * Every lever update asserts exactly one row was touched (review finding:
 * supabase-js returns error:null on a zero-row match, so a missing control
 * row would otherwise make an emergency kill switch silently no-op while
 * the console reports success).
 */

/** Freeze/unfreeze rate-limited social writes (bc_action_controls). */
export async function setActionKillSwitch(formData: FormData): Promise<void> {
  await requireModerator();
  const enable = String(formData.get('value') ?? '') === 'on';
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bc_action_controls')
    .update({ kill_switch: enable, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select('id');
  if (error || !data || data.length !== 1) {
    console.error(
      `bestchef-console: bc_action_controls update matched ${data?.length ?? 0} rows${
        error ? `: ${error.message}` : ''
      }`,
    );
    respond.fail('kill_switch_update_failed');
  }
  respond.done(enable ? 'actions_frozen' : 'actions_unfrozen');
}

/** Freeze/unfreeze provider-calling edge functions (bc_provider_controls). */
export async function setProviderKillSwitch(formData: FormData): Promise<void> {
  await requireModerator();
  const enable = String(formData.get('value') ?? '') === 'on';
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bc_provider_controls')
    .update({ kill_switch: enable, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select('id');
  if (error || !data || data.length !== 1) {
    console.error(
      `bestchef-console: bc_provider_controls update matched ${data?.length ?? 0} rows${
        error ? `: ${error.message}` : ''
      }`,
    );
    respond.fail('provider_switch_update_failed');
  }
  respond.done(enable ? 'providers_frozen' : 'providers_unfrozen');
}

/** Edit one durable action cap (bc_action_limits row). */
export async function updateActionLimit(formData: FormData): Promise<void> {
  await requireModerator();
  const action = String(formData.get('action') ?? '').trim();
  const maxCount = Number.parseInt(String(formData.get('maxCount') ?? ''), 10);
  const windowSeconds = Number.parseInt(String(formData.get('windowSeconds') ?? ''), 10);
  const enabled = formData.get('enabled') === 'on';

  if (!action || !Number.isInteger(maxCount) || maxCount < 0) respond.fail('invalid_limit');
  if (!Number.isInteger(windowSeconds) || windowSeconds <= 0) respond.fail('invalid_limit');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bc_action_limits')
    .update({
      max_count: maxCount,
      window_seconds: windowSeconds,
      enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('action', action)
    .select('action');
  if (error || !data || data.length !== 1) {
    console.error(
      `bestchef-console: bc_action_limits update for '${action}' matched ${data?.length ?? 0} rows${
        error ? `: ${error.message}` : ''
      }`,
    );
    respond.fail('limit_update_failed');
  }
  respond.done('limit_updated');
}
