/**
 * Cloud-backed named custom theme profiles (P15-C / F-029, F-030).
 *
 * Mirrors the local rc_custom_themes mirror but persists to bc_custom_themes
 * (Supabase, RLS owner-only). Used by Settings + Theme Editor to save, list,
 * rename, and delete a chef's named themes across devices.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { err, getBestChefClient, ok, type BestChefResult } from './client';

export interface CloudCustomTheme {
  id: string;
  userId: string;
  name: string;
  tokenOverrides: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCloudCustomThemeInput {
  name: string;
  tokenOverrides: unknown;
}

export interface UpdateCloudCustomThemeInput {
  id: string;
  name?: string;
  tokenOverrides?: unknown;
}

interface CustomThemeRow {
  id: string;
  user_id: string;
  name: string;
  token_overrides: unknown;
  created_at: string;
  updated_at: string;
}

function clientOrDefault(supabase?: SupabaseClient): SupabaseClient {
  return supabase ?? getBestChefClient();
}

function rowToTheme(row: CustomThemeRow): CloudCustomTheme {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    tokenOverrides: row.token_overrides,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCurrentUserId(client: SupabaseClient): Promise<BestChefResult<string>> {
  const { data, error } = await client.auth.getUser();
  if (error) return err(error.message ?? 'Auth lookup failed.');
  const uid = data.user?.id;
  if (!uid) return err('Not authenticated.');
  return ok(uid);
}

export async function listCloudCustomThemes(
  supabase?: SupabaseClient,
): Promise<BestChefResult<CloudCustomTheme[]>> {
  const client = clientOrDefault(supabase);
  const userResult = await getCurrentUserId(client);
  if (!userResult.ok) return err(userResult.error);
  const userId = userResult.data;

  const { data, error } = await client
    .from('bc_custom_themes')
    .select('id, user_id, name, token_overrides, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return err(error.message ?? 'Failed to list custom themes.');
  const rows = Array.isArray(data) ? (data as CustomThemeRow[]) : [];
  return ok(rows.map(rowToTheme));
}

export async function createCloudCustomTheme(
  input: CreateCloudCustomThemeInput,
  supabase?: SupabaseClient,
): Promise<BestChefResult<CloudCustomTheme>> {
  const trimmed = input.name.trim();
  if (!trimmed) return err('Custom theme name is required.');

  const client = clientOrDefault(supabase);
  const userResult = await getCurrentUserId(client);
  if (!userResult.ok) return err(userResult.error);
  const userId = userResult.data;

  const { data, error } = await client
    .from('bc_custom_themes')
    .insert({
      user_id: userId,
      name: trimmed,
      token_overrides: input.tokenOverrides ?? {},
    })
    .select('id, user_id, name, token_overrides, created_at, updated_at')
    .single();

  if (error) return err(error.message ?? 'Failed to save custom theme.');
  if (!data) return err('Failed to save custom theme.');
  return ok(rowToTheme(data as CustomThemeRow));
}

export async function updateCloudCustomTheme(
  input: UpdateCloudCustomThemeInput,
  supabase?: SupabaseClient,
): Promise<BestChefResult<CloudCustomTheme>> {
  if (!input.id) return err('Custom theme id is required.');

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) return err('Custom theme name is required.');
    updates.name = trimmed;
  }
  if (input.tokenOverrides !== undefined) {
    updates.token_overrides = input.tokenOverrides;
  }

  const client = clientOrDefault(supabase);
  const userResult = await getCurrentUserId(client);
  if (!userResult.ok) return err(userResult.error);
  const userId = userResult.data;

  const { data, error } = await client
    .from('bc_custom_themes')
    .update(updates)
    .eq('id', input.id)
    .eq('user_id', userId)
    .select('id, user_id, name, token_overrides, created_at, updated_at')
    .single();

  if (error) return err(error.message ?? 'Failed to update custom theme.');
  if (!data) return err('Custom theme not found.');
  return ok(rowToTheme(data as CustomThemeRow));
}

export async function deleteCloudCustomTheme(
  id: string,
  supabase?: SupabaseClient,
): Promise<BestChefResult<true>> {
  if (!id) return err('Custom theme id is required.');
  const client = clientOrDefault(supabase);
  const userResult = await getCurrentUserId(client);
  if (!userResult.ok) return err(userResult.error);
  const userId = userResult.data;

  const { error } = await client
    .from('bc_custom_themes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return err(error.message ?? 'Failed to delete custom theme.');
  return ok(true);
}
