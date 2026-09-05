import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecordedHike } from '../types';

interface TrailHikeRow {
  id: string;
  user_id: string;
  local_hike_id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  distance_meters: number;
  elevation_gain_meters: number;
  elevation_loss_meters: number;
  pace_minutes_per_km: number | null;
  gpx_url: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

function mapHike(row: TrailHikeRow): RecordedHike {
  return {
    id: row.id,
    localId: row.local_hike_id,
    userId: row.user_id,
    name: row.name,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    durationSeconds: row.duration_seconds,
    distanceMeters: row.distance_meters,
    elevationGainMeters: row.elevation_gain_meters,
    elevationLossMeters: row.elevation_loss_meters,
    paceMinutesPerKm: row.pace_minutes_per_km ?? undefined,
    gpx: row.gpx_url ?? undefined,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function cloudSyncTrailHikeSummary(
  client: SupabaseClient,
  input: {
    userId: string;
    localHikeId: string;
    name: string;
    startedAt: string;
    endedAt?: string;
    durationSeconds: number;
    distanceMeters: number;
    elevationGainMeters: number;
    elevationLossMeters: number;
    paceMinutesPerKm?: number;
    gpxUrl?: string;
  },
): Promise<{ id: string }> {
  const { data, error } = await client
    .from('trail_hike_summaries')
    .upsert(
      {
        user_id: input.userId,
        local_hike_id: input.localHikeId,
        name: input.name,
        started_at: input.startedAt,
        ended_at: input.endedAt ?? null,
        duration_seconds: input.durationSeconds,
        distance_meters: input.distanceMeters,
        elevation_gain_meters: input.elevationGainMeters,
        elevation_loss_meters: input.elevationLossMeters,
        pace_minutes_per_km: input.paceMinutesPerKm ?? null,
        gpx_url: input.gpxUrl ?? null,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,local_hike_id' },
    )
    .select('id')
    .single();

  if (error) throw error;
  return { id: data.id as string };
}

export async function cloudGetTrailHikeSummaries(
  client: SupabaseClient,
  userId: string,
): Promise<RecordedHike[]> {
  const { data, error } = await client
    .from('trail_hike_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  if (error) throw error;
  return (data as TrailHikeRow[]).map(mapHike);
}
