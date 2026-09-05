import type { SupabaseClient } from '@supabase/supabase-js';
import type { SurfSpot, SpotGuide, Region, SkillLevel, Hazard } from '../types';

interface SpotRow {
  id: string;
  name: string;
  slug: string;
  region: string;
  spot_type: string;
  orientation_degrees: number;
  ideal_swell_dir_min: number | null;
  ideal_swell_dir_max: number | null;
  ideal_tide_low: number | null;
  ideal_tide_high: number | null;
  skill_level: string;
  crowd_factor: number | null;
  description: string | null;
  hazards: string[] | null;
  is_curated: boolean;
  created_at: string;
  updated_at: string;
  // PostGIS geography is returned as GeoJSON by Supabase
  location?: { type: string; coordinates: [number, number] };
}

function mapSpot(row: SpotRow): SurfSpot {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    region: row.region,
    breakType: row.spot_type === 'beach_break'
      ? 'beach'
      : row.spot_type === 'point_break'
        ? 'point'
        : row.spot_type === 'reef_break'
          ? 'reef'
          : 'other',
    waveHeightFt: 0,
    windKts: 0,
    tide: 'mid',
    swellDirection: 'W',
    isFavorite: false,
    lastUpdated: row.updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latitude: row.location?.coordinates[1] ?? undefined,
    longitude: row.location?.coordinates[0] ?? undefined,
    orientationDeg: row.orientation_degrees,
    skillLevel: row.skill_level as SkillLevel,
    hazards: (row.hazards ?? []) as Hazard[],
    idealSwellDirMin: row.ideal_swell_dir_min ?? undefined,
    idealSwellDirMax: row.ideal_swell_dir_max ?? undefined,
    idealTideLow: row.ideal_tide_low ?? undefined,
    idealTideHigh: row.ideal_tide_high ?? undefined,
    description: row.description ?? undefined,
    crowdFactor: row.crowd_factor ?? undefined,
  };
}

export async function cloudGetSpotsByRegion(
  client: SupabaseClient,
  region: Region,
): Promise<SurfSpot[]> {
  const { data, error } = await client
    .from('spots')
    .select('*')
    .eq('region', region)
    .order('name');

  if (error) throw error;
  return (data as SpotRow[]).map(mapSpot);
}

export async function cloudGetSpotBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<SurfSpot | null> {
  const { data, error } = await client
    .from('spots')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data ? mapSpot(data as SpotRow) : null;
}

export async function cloudGetNearbySpots(
  client: SupabaseClient,
  lat: number,
  lng: number,
  radiusKm: number = 50,
): Promise<SurfSpot[]> {
  const { data, error } = await client.rpc('nearby_spots', {
    lat,
    lng,
    radius_km: radiusKm,
  });

  if (error) throw error;
  return (data as SpotRow[]).map(mapSpot);
}

export async function cloudGetUserFavoriteSpots(
  client: SupabaseClient,
  userId: string,
): Promise<SurfSpot[]> {
  const { data, error } = await client
    .from('user_favorites')
    .select('spots(*)')
    .eq('user_id', userId)
    .order('position');

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) =>
    mapSpot(row.spots as SpotRow),
  );
}

export async function cloudGetSpotGuide(
  client: SupabaseClient,
  spotId: string,
): Promise<SpotGuide | null> {
  const { data, error } = await client
    .from('spot_guides')
    .select('*')
    .eq('spot_id', spotId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    spotId: data.spot_id as string,
    bestTideWindow: data.best_tide_window as string,
    bestSwellDirection: data.best_swell_direction as string,
    hazards: (data.hazards as string[]) ?? [],
    parkingNotes: data.parking_notes as string,
    crowdNotes: data.crowd_notes as string,
    localTips: data.local_tips as string,
    updatedAt: data.updated_at as string,
  };
}

export async function cloudToggleFavorite(
  client: SupabaseClient,
  userId: string,
  spotId: string,
): Promise<{ favorited: boolean }> {
  const { data: existing, error: checkError } = await client
    .from('user_favorites')
    .select('user_id')
    .eq('user_id', userId)
    .eq('spot_id', spotId)
    .maybeSingle();

  if (checkError) throw checkError;

  if (existing) {
    const { error } = await client
      .from('user_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('spot_id', spotId);
    if (error) throw error;
    return { favorited: false };
  }

  const { data: maxPos } = await client
    .from('user_favorites')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = ((maxPos?.position as number) ?? -1) + 1;

  const { error } = await client
    .from('user_favorites')
    .insert({ user_id: userId, spot_id: spotId, position: nextPosition });
  if (error) throw error;
  return { favorited: true };
}
