import type { SupabaseClient } from '@supabase/supabase-js';
import type { Forecast, SwellComponent, TidePoint, BuoyReading, Narrative, ConditionColor, WindLabel } from '../types';

// ---------------------------------------------------------------------------
// Row types (Supabase snake_case)
// ---------------------------------------------------------------------------

interface ForecastRow {
  id: string;
  spot_id: string;
  forecast_time: string;
  wave_height_min_ft: number;
  wave_height_max_ft: number;
  wave_height_label: string | null;
  rating: number;
  condition_color: string;
  wind_speed_kts: number;
  wind_gust_kts: number;
  wind_direction_degrees: number;
  wind_label: string | null;
  energy_kj: number;
  consistency_score: number;
  water_temp_f: number | null;
  air_temp_f: number | null;
  model_run: string;
  created_at: string;
  swell_components?: SwellRow[];
}

interface SwellRow {
  id: string;
  height_ft: number;
  period_seconds: number;
  direction_degrees: number;
  direction_label: string;
  component_order: number;
}

function mapSwell(row: SwellRow): SwellComponent {
  return {
    heightFt: row.height_ft,
    periodSeconds: row.period_seconds,
    directionDegrees: row.direction_degrees,
    directionLabel: row.direction_label,
    componentOrder: row.component_order,
  };
}

function mapForecast(row: ForecastRow): Forecast {
  return {
    id: row.id,
    spotId: row.spot_id,
    forecastTime: row.forecast_time,
    waveHeightMinFt: row.wave_height_min_ft,
    waveHeightMaxFt: row.wave_height_max_ft,
    waveHeightLabel: row.wave_height_label ?? undefined,
    rating: row.rating,
    conditionColor: row.condition_color as ConditionColor,
    windSpeedKts: row.wind_speed_kts,
    windGustKts: row.wind_gust_kts,
    windDirectionDegrees: row.wind_direction_degrees,
    windLabel: (row.wind_label as WindLabel) ?? undefined,
    energyKj: row.energy_kj,
    consistencyScore: row.consistency_score,
    waterTempF: row.water_temp_f ?? undefined,
    airTempF: row.air_temp_f ?? undefined,
    modelRun: row.model_run,
    modelName: 'gfs',
    swellComponents: (row.swell_components ?? []).map(mapSwell),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function cloudGetSpotForecast(
  client: SupabaseClient,
  spotId: string,
  days: number = 7,
): Promise<Forecast[]> {
  const { data: latest } = await client
    .from('forecasts')
    .select('forecast_time')
    .eq('spot_id', spotId)
    .order('forecast_time', { ascending: false })
    .limit(1)
    .single();

  if (!latest) return [];

  const end = new Date(latest.forecast_time as string);
  const start = new Date(end.getTime() - days * 86_400_000);

  const { data, error } = await client
    .from('forecasts')
    .select('*, swell_components(*)')
    .eq('spot_id', spotId)
    .gte('forecast_time', start.toISOString())
    .lte('forecast_time', end.toISOString())
    .order('forecast_time');

  if (error) throw error;
  return (data as ForecastRow[]).map(mapForecast);
}

export async function cloudGetTides(
  client: SupabaseClient,
  stationId: string,
  startDate: string,
  endDate: string,
): Promise<TidePoint[]> {
  const { data, error } = await client
    .from('tides')
    .select('*')
    .eq('station_id', stationId)
    .gte('timestamp', startDate)
    .lte('timestamp', endDate)
    .order('timestamp');

  if (error) throw error;
  return (data ?? []).map(
    (row: Record<string, unknown>): TidePoint => ({
      timestamp: row.timestamp as string,
      heightFt: row.height_ft as number,
      type: row.type as 'high' | 'low' | 'intermediate',
    }),
  );
}

export async function cloudGetLatestBuoyReading(
  client: SupabaseClient,
  buoyId: string,
): Promise<BuoyReading | null> {
  const { data, error } = await client
    .from('buoy_readings')
    .select('*')
    .eq('buoy_id', buoyId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    buoyId: data.buoy_id as string,
    timestamp: data.timestamp as string,
    waveHeightFt: data.wave_height_ft as number | undefined,
    dominantPeriodSeconds: data.dominant_period_s as number | undefined,
    averagePeriodSeconds: data.avg_period_s as number | undefined,
    waveDirectionDegrees: data.wave_direction_deg as number | undefined,
    waterTempF: data.water_temp_f as number | undefined,
    airTempF: data.air_temp_f as number | undefined,
    windSpeedKts: data.wind_speed_kts as number | undefined,
    windDirectionDegrees: data.wind_direction_deg as number | undefined,
  };
}

export async function cloudGetRecentBuoyReadings(
  client: SupabaseClient,
  buoyId: string,
  hours: number = 6,
): Promise<BuoyReading[]> {
  const { data: latest } = await client
    .from('buoy_readings')
    .select('timestamp')
    .eq('buoy_id', buoyId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  if (!latest) return [];

  const end = new Date(latest.timestamp as string);
  const start = new Date(end.getTime() - hours * 3_600_000);

  const { data, error } = await client
    .from('buoy_readings')
    .select('*')
    .eq('buoy_id', buoyId)
    .gte('timestamp', start.toISOString())
    .lte('timestamp', end.toISOString())
    .order('timestamp');

  if (error) throw error;
  return (data ?? []).map(
    (row: Record<string, unknown>): BuoyReading => ({
      buoyId: row.buoy_id as string,
      timestamp: row.timestamp as string,
      waveHeightFt: row.wave_height_ft as number | undefined,
      dominantPeriodSeconds: row.dominant_period_s as number | undefined,
      averagePeriodSeconds: row.avg_period_s as number | undefined,
      waveDirectionDegrees: row.wave_direction_deg as number | undefined,
      waterTempF: row.water_temp_f as number | undefined,
      airTempF: row.air_temp_f as number | undefined,
      windSpeedKts: row.wind_speed_kts as number | undefined,
      windDirectionDegrees: row.wind_direction_deg as number | undefined,
    }),
  );
}

export async function cloudGetSpotNarrative(
  client: SupabaseClient,
  spotId: string,
  date: string,
): Promise<Narrative | null> {
  const { data, error } = await client
    .from('narratives')
    .select('*')
    .eq('spot_id', spotId)
    .eq('forecast_date', date)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id as string,
    spotId: data.spot_id as string | undefined,
    region: data.region as string | undefined,
    forecastDate: data.forecast_date as string,
    summary: data.summary as string,
    body: data.body as string,
    generatedAt: data.generated_at as string,
    helpfulVotes: (data.helpful_votes as number) ?? 0,
    unhelpfulVotes: (data.unhelpful_votes as number) ?? 0,
  };
}

export async function cloudGetRegionNarrative(
  client: SupabaseClient,
  region: string,
  date: string,
): Promise<Narrative | null> {
  const { data, error } = await client
    .from('narratives')
    .select('*')
    .eq('region', region)
    .eq('forecast_date', date)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id as string,
    spotId: data.spot_id as string | undefined,
    region: data.region as string | undefined,
    forecastDate: data.forecast_date as string,
    summary: data.summary as string,
    body: data.body as string,
    generatedAt: data.generated_at as string,
    helpfulVotes: (data.helpful_votes as number) ?? 0,
    unhelpfulVotes: (data.unhelpful_votes as number) ?? 0,
  };
}

export async function cloudVoteOnNarrative(
  client: SupabaseClient,
  narrativeId: string,
  helpful: boolean,
): Promise<void> {
  const column = helpful ? 'helpful_votes' : 'unhelpful_votes';

  const { error } = await client.rpc('increment_narrative_vote', {
    narrative_id: narrativeId,
    vote_column: column,
  });

  if (error) {
    // Fallback: fetch + increment
    const { data, error: fetchError } = await client
      .from('narratives')
      .select(column)
      .eq('id', narrativeId)
      .single();
    if (fetchError) throw fetchError;

    const current = ((data as Record<string, number>)?.[column] ?? 0) + 1;
    const { error: updateError } = await client
      .from('narratives')
      .update({ [column]: current })
      .eq('id', narrativeId);
    if (updateError) throw updateError;
  }
}
