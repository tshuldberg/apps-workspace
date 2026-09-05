import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserPin, SurfSession } from '../types';

// ---------------------------------------------------------------------------
// User Pins
// ---------------------------------------------------------------------------

export async function cloudCreateUserPin(
  client: SupabaseClient,
  input: {
    userId: string;
    latitude: number;
    longitude: number;
    name: string;
    notes?: string;
    isPublic?: boolean;
  },
): Promise<{ id: string }> {
  const { data, error } = await client
    .from('user_pins')
    .insert({
      user_id: input.userId,
      location: `SRID=4326;POINT(${input.longitude} ${input.latitude})`,
      name: input.name,
      notes: input.notes ?? null,
      is_public: input.isPublic ?? false,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { id: data.id as string };
}

export async function cloudGetUserPins(
  client: SupabaseClient,
  userId: string,
): Promise<UserPin[]> {
  const { data, error } = await client
    .from('user_pins')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(
    (row: Record<string, unknown>): UserPin => ({
      id: row.id as string,
      userId: row.user_id as string,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      name: row.name as string,
      notes: (row.notes as string) ?? undefined,
      isPublic: row.is_public as boolean,
      createdAt: row.created_at as string,
    }),
  );
}

export async function cloudDeleteUserPin(
  client: SupabaseClient,
  pinId: string,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from('user_pins')
    .delete()
    .eq('id', pinId)
    .eq('user_id', userId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Surf Sessions
// ---------------------------------------------------------------------------

export async function cloudCreateSurfSession(
  client: SupabaseClient,
  input: {
    userId: string;
    spotId?: string;
    sessionDate: string;
    durationMin: number;
    rating: number;
    notes?: string;
  },
): Promise<{ id: string }> {
  const { data, error } = await client
    .from('surf_sessions')
    .insert({
      user_id: input.userId,
      spot_id: input.spotId ?? null,
      session_date: input.sessionDate,
      duration_min: input.durationMin,
      rating: input.rating,
      notes: input.notes ?? null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { id: data.id as string };
}

export async function cloudGetSurfSessions(
  client: SupabaseClient,
  userId: string,
  spotId?: string,
): Promise<SurfSession[]> {
  let query = client
    .from('surf_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('session_date', { ascending: false });

  if (spotId) {
    query = query.eq('spot_id', spotId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map(
    (row: Record<string, unknown>): SurfSession => ({
      id: row.id as string,
      spotId: row.spot_id as string,
      sessionDate: row.session_date as string,
      durationMin: row.duration_min as number,
      rating: row.rating as number,
      notes: (row.notes as string) ?? undefined,
      createdAt: row.created_at as string,
    }),
  );
}

export async function cloudDeleteSurfSession(
  client: SupabaseClient,
  sessionId: string,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from('surf_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) throw error;
}
