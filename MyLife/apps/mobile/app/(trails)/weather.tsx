import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import {
  GlassCard,
  MaterialSymbol,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  formatRelativeTime,
  formatTemperature,
  formatWindSpeed,
  getCachedWeather,
  getRecentConditions,
  getTrails,
  isWeatherCacheValid,
  temperatureAtElevation,
  weatherDescription,
  type Trail,
} from '@mylife/trails';
import { Text, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { TrailsChip, TrailsEmptyState, TrailsHero, TrailsScreen, TrailsSection } from './_ui';

type WeatherSymbolName =
  | 'sunny'
  | 'partly_cloudy_day'
  | 'cloud'
  | 'rainy'
  | 'thunderstorm';

type CurrentWeatherView = {
  temperature: number;
  description: string;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitationProbability: number;
  visibilityKm: number;
  uvIndex: number;
  code: number;
};

type HourlyWeatherView = {
  hour: string;
  temperature: number;
  precipitationProbability: number;
  code: number;
};

type DailyWeatherView = {
  day: string;
  high: number;
  low: number;
  precipitationProbability: number;
  code: number;
};

type AlertView = {
  title: string;
  body: string;
  tone: 'warning' | 'info' | 'stable';
  symbol: 'warning' | 'air' | 'cloud' | 'check_circle';
};

type HistoricalWeatherView = {
  averageHigh: number;
  averageLow: number;
  rainyDays: number;
  bestMonths: string;
};

type WeatherViewModel = {
  current: CurrentWeatherView;
  hourly: HourlyWeatherView[];
  daily: DailyWeatherView[];
  alerts: AlertView[];
  historical: HistoricalWeatherView;
  sunrise: string;
  sunset: string;
  trailheadTemp: number;
  summitTemp: number;
  ridgeWind: number;
  fetchedAt: string;
  source: 'cache' | 'modeled';
  stale: boolean;
};

const SEASONAL_BASE_TEMP = [3, 5, 7, 10, 13, 16, 19, 19, 17, 12, 7, 4];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function relativeTrailClimate(trail: Trail) {
  const region = (trail.region ?? '').toLowerCase();

  if (region.includes('coast') || region.includes('sur')) {
    return -2;
  }
  if (region.includes('desert') || region.includes('joshua') || region.includes('death valley')) {
    return 5;
  }
  if (region.includes('mammoth') || region.includes('tahoe') || region.includes('yosemite')) {
    return -1;
  }

  return 0;
}

function resolveWeatherCode(seed: number, conditions: string[]) {
  const normalized = conditions.map((value) => value.toLowerCase());

  if (normalized.some((value) => value.includes('snow') || value.includes('ice'))) {
    return 71;
  }
  if (normalized.some((value) => value.includes('mud') || value.includes('rain') || value.includes('wet'))) {
    return 61;
  }
  if (normalized.some((value) => value.includes('fog'))) {
    return 45;
  }
  if (seed % 7 === 0) {
    return 95;
  }
  if (seed % 3 === 0) {
    return 3;
  }

  return seed % 2 === 0 ? 2 : 0;
}

function weatherSymbol(code: number): WeatherSymbolName {
  if (code >= 95) {
    return 'thunderstorm';
  }
  if (code >= 51 && code <= 86) {
    return 'rainy';
  }
  if (code === 3 || code === 45 || code === 48) {
    return 'cloud';
  }
  if (code === 1 || code === 2) {
    return 'partly_cloudy_day';
  }
  return 'sunny';
}

function formatHourLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildDailyLabel(offset: number) {
  if (offset === 0) {
    return 'Today';
  }
  if (offset === 1) {
    return 'Tomorrow';
  }
  return DAY_LABELS[(new Date().getDay() + offset) % 7];
}

function parseCachedWeather(cacheJson: string): Partial<WeatherViewModel> | null {
  try {
    const raw = JSON.parse(cacheJson) as Record<string, unknown>;
    const hourlySourceRaw = raw.hourly as Record<string, unknown> | undefined;

    const currentSource = (raw.current as Record<string, unknown> | undefined)
      ?? (raw.current_weather as Record<string, unknown> | undefined)
      ?? raw;

    const currentTemperature = asNumber(
      currentSource.temperature
      ?? currentSource.temperature_2m
      ?? raw.temperature,
    );

    if (currentTemperature === null) {
      return null;
    }

    const code = asNumber(
      currentSource.code
      ?? currentSource.weatherCode
      ?? currentSource.weather_code
      ?? currentSource.weathercode,
    ) ?? 2;

    const humidity = asNumber(
      currentSource.humidity
      ?? currentSource.relative_humidity_2m
      ?? (Array.isArray(hourlySourceRaw?.relative_humidity_2m) ? hourlySourceRaw?.relative_humidity_2m[0] : null),
    ) ?? 58;

    const windSpeed = asNumber(
      currentSource.windSpeed
      ?? currentSource.wind_speed
      ?? currentSource.windspeed
      ?? currentSource.wind_speed_10m,
    ) ?? 14;

    const windDirection = asNumber(
      currentSource.windDirection
      ?? currentSource.wind_direction
      ?? currentSource.winddirection,
    ) ?? 180;

    const precipitationProbability = clamp(
      asNumber(
        currentSource.precipitationProbability
        ?? currentSource.precipitation_probability
        ?? (Array.isArray(hourlySourceRaw?.precipitation_probability) ? hourlySourceRaw?.precipitation_probability[0] : null),
      ) ?? 18,
      0,
      100,
    );

    const hourlySource = hourlySourceRaw;
    let hourly: HourlyWeatherView[] = [];
    if (Array.isArray(hourlySource)) {
      hourly = (hourlySource as Array<Record<string, unknown>>).slice(0, 12).map((entry, index) => ({
        hour: formatHourLabel(String(entry.hour ?? entry.time ?? `+${index + 1}h`)),
        temperature: asNumber(entry.temperature ?? entry.temperature_2m) ?? currentTemperature,
        precipitationProbability: clamp(asNumber(entry.precipitationProbability ?? entry.precipitation_probability) ?? precipitationProbability, 0, 100),
        code: asNumber(entry.code ?? entry.weather_code ?? entry.weathercode) ?? code,
      }));
    } else if (hourlySource) {
      const timeValues = Array.isArray(hourlySource.time) ? hourlySource.time : [];
      const tempValues = Array.isArray(hourlySource.temperature_2m) ? hourlySource.temperature_2m : [];
      const precipValues = Array.isArray(hourlySource.precipitation_probability) ? hourlySource.precipitation_probability : [];
      const codeValues = Array.isArray(hourlySource.weathercode)
        ? hourlySource.weathercode
        : Array.isArray(hourlySource.weather_code)
          ? hourlySource.weather_code
          : [];

      hourly = timeValues.slice(0, 12).map((value, index) => ({
        hour: formatHourLabel(String(value)),
        temperature: asNumber(tempValues[index]) ?? currentTemperature,
        precipitationProbability: clamp(asNumber(precipValues[index]) ?? precipitationProbability, 0, 100),
        code: asNumber(codeValues[index]) ?? code,
      }));
    }

    const dailySource = raw.daily as Record<string, unknown> | undefined;
    const dailyTime = Array.isArray(dailySource?.time) ? dailySource?.time : [];
    const dailyHigh = Array.isArray(dailySource?.temperature_2m_max) ? dailySource?.temperature_2m_max : [];
    const dailyLow = Array.isArray(dailySource?.temperature_2m_min) ? dailySource?.temperature_2m_min : [];
    const dailyPrecip = Array.isArray(dailySource?.precipitation_probability_max) ? dailySource?.precipitation_probability_max : [];
    const sunriseValues = Array.isArray(dailySource?.sunrise) ? dailySource?.sunrise : [];
    const sunsetValues = Array.isArray(dailySource?.sunset) ? dailySource?.sunset : [];
    const dailyCode = Array.isArray(dailySource?.weather_code)
      ? dailySource?.weather_code
      : Array.isArray(dailySource?.weathercode)
        ? dailySource?.weathercode
        : [];

    const daily = dailyTime.slice(0, 7).map((value, index) => ({
      day: buildDailyLabel(index),
      high: asNumber(dailyHigh[index]) ?? currentTemperature + 3,
      low: asNumber(dailyLow[index]) ?? currentTemperature - 5,
      precipitationProbability: clamp(asNumber(dailyPrecip[index]) ?? precipitationProbability, 0, 100),
      code: asNumber(dailyCode[index]) ?? code,
    }));

    return {
      current: {
        temperature: currentTemperature,
        description: weatherDescription(code),
        feelsLike: currentTemperature - windSpeed / 16,
        humidity,
        windSpeed,
        windDirection,
        precipitationProbability,
        visibilityKm: clamp(18 - precipitationProbability / 7, 2, 24),
        uvIndex: clamp(Math.round((currentTemperature + 12) / 4), 1, 10),
        code,
      },
      hourly,
      daily,
      sunrise: String(raw.sunrise ?? sunriseValues[0] ?? '06:12'),
      sunset: String(raw.sunset ?? sunsetValues[0] ?? '19:41'),
    };
  } catch {
    return null;
  }
}

function buildModeledWeather(trail: Trail, conditions: string[], cached: Partial<WeatherViewModel> | null, fetchedAt: string): WeatherViewModel {
  const now = new Date();
  const seed = hashSeed(`${trail.id}:${trail.region ?? 'local'}`);
  const baseCode = cached?.current?.code ?? resolveWeatherCode(seed, conditions);
  const baseTemp =
    cached?.current?.temperature
    ?? SEASONAL_BASE_TEMP[now.getMonth()]
    + relativeTrailClimate(trail)
    + (seed % 5 - 2)
    + (trail.difficulty === 'expert' ? -2 : trail.difficulty === 'easy' ? 1 : 0);

  const hourly = cached?.hourly?.length
    ? cached.hourly
    : Array.from({ length: 12 }, (_, index) => {
        const swing = Math.sin((index / 12) * Math.PI) * 4;
        const code = index > 7 && baseCode === 0 ? 1 : baseCode;

        return {
          hour: formatHourLabel(new Date(now.getTime() + index * 60 * 60 * 1000).toISOString()),
          temperature: Number((baseTemp + swing - index * 0.15).toFixed(1)),
          precipitationProbability: clamp((baseCode >= 61 ? 42 : 12) + index * 2 + (seed % 9), 4, 88),
          code,
        };
      });

  const daily = cached?.daily?.length
    ? cached.daily
    : Array.from({ length: 7 }, (_, index) => {
        const daySeed = (seed + index * 17) % 11;
        const high = Math.round(baseTemp + 3 + Math.sin(index * 0.8) * 3);
        const low = Math.round(high - 7 - (index % 2));
        const code = daySeed > 7 ? 61 : daySeed > 4 ? 3 : baseCode;

        return {
          day: buildDailyLabel(index),
          high,
          low,
          precipitationProbability: clamp((code >= 61 ? 46 : 18) + index * 4, 8, 92),
          code,
        };
      });

  const current = cached?.current ?? {
    temperature: Math.round(baseTemp),
    description: weatherDescription(baseCode),
    feelsLike: Math.round(baseTemp - 1),
    humidity: clamp(52 + (seed % 18), 38, 92),
    windSpeed: clamp(12 + (seed % 16), 8, 44),
    windDirection: (seed * 37) % 360,
    precipitationProbability: clamp(baseCode >= 61 ? 55 : 18, 0, 100),
    visibilityKm: clamp(baseCode >= 61 ? 6.5 : 18, 4, 24),
    uvIndex: clamp(Math.round((baseTemp + 10) / 4), 1, 9),
    code: baseCode,
  };

  const trailheadTemp = current.temperature;
  const summitTemp = Number(
    temperatureAtElevation(
      trailheadTemp,
      Math.max(trail.elevationGainMeters, 320),
    ).toFixed(1),
  );
  const ridgeWind = Math.round(current.windSpeed + trail.elevationGainMeters / 110);

  const alerts: AlertView[] = [];
  if (ridgeWind >= 35) {
    alerts.push({
      title: 'High Wind Warning',
      body: 'Exposed ridges will feel colder than the trailhead and gusts could affect balance near overlooks.',
      tone: 'warning',
      symbol: 'air',
    });
  }
  if (current.precipitationProbability >= 55) {
    alerts.push({
      title: 'Precipitation Window',
      body: 'Pack a shell layer and plan the steeper sections before the wettest part of the afternoon.',
      tone: 'info',
      symbol: 'cloud',
    });
  }
  if (conditions.length > 0) {
    alerts.push({
      title: 'Recent Trail Reports',
      body: conditions.map((value) => value.replace(/_/g, ' ')).join(', '),
      tone: 'info',
      symbol: 'warning',
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      title: 'Stable Window',
      body: 'No severe changes indicated right now. Conditions still cool noticeably with elevation.',
      tone: 'stable',
      symbol: 'check_circle',
    });
  }

  const historical: HistoricalWeatherView = {
    averageHigh: Math.round(baseTemp + 4),
    averageLow: Math.round(baseTemp - 5),
    rainyDays: Math.max(2, Math.round((current.precipitationProbability / 100) * 9)),
    bestMonths: now.getMonth() >= 4 && now.getMonth() <= 8 ? 'May to September' : 'Late spring and early fall',
  };

  return {
    current,
    hourly,
    daily,
    alerts,
    historical,
    sunrise: cached?.sunrise ?? '06:14 AM',
    sunset: cached?.sunset ?? '07:41 PM',
    trailheadTemp,
    summitTemp,
    ridgeWind,
    fetchedAt,
    source: cached ? 'cache' : 'modeled',
    stale: false,
  };
}

function buildWeatherModel(trail: Trail, conditions: string[], cacheJson: string | null, fetchedAt: string | null) {
  const cached = cacheJson ? parseCachedWeather(cacheJson) : null;
  const model = buildModeledWeather(trail, conditions, cached, fetchedAt ?? new Date().toISOString());
  const stale = fetchedAt ? !isWeatherCacheValid(fetchedAt, 60) : false;

  return {
    ...model,
    source: cached ? 'cache' : 'modeled',
    stale,
  };
}

function ForecastBars({ trailheadTemp, summitTemp }: { trailheadTemp: number; summitTemp: number }) {
  const midTemp = Number(((trailheadTemp + summitTemp) / 2).toFixed(1));
  const values = [trailheadTemp, midTemp, summitTemp];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = 30 + index * 130;
      const y = 112 - ((value - min) / range) * 64;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Svg height={136} width="100%" viewBox="0 0 320 136">
      <Defs>
        <SvgLinearGradient id="tempLine" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#84CC16" />
          <Stop offset="100%" stopColor="#FFB877" />
        </SvgLinearGradient>
      </Defs>
      <Rect x="16" y="16" width="288" height="104" rx="18" fill="rgba(255,255,255,0.03)" />
      <Path
        d={`M ${points}`}
        stroke="url(#tempLine)"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((value, index) => {
        const x = 30 + index * 130;
        const y = 112 - ((value - min) / range) * 64;
        return (
          <Circle
            key={`${value}-${index}`}
            cx={x}
            cy={y}
            r="6"
            fill={index === 2 ? '#FFB877' : '#84CC16'}
          />
        );
      })}
    </Svg>
  );
}

export default function TrailsWeatherScreen() {
  const db = useDatabase();
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const trails = useMemo(() => getTrails(db, { limit: 40 }), [db, refreshTick]);

  const selectedTrail = useMemo(() => {
    if (trails.length === 0) {
      return null;
    }

    return trails.find((trail) => trail.id === selectedTrailId) ?? trails[0];
  }, [selectedTrailId, trails]);

  const recentConditions = useMemo(
    () => (selectedTrail ? getRecentConditions(db, selectedTrail.id) : []),
    [db, refreshTick, selectedTrail],
  );

  const weather = useMemo(() => {
    if (!selectedTrail) {
      return null;
    }

    const cache = getCachedWeather(db, selectedTrail.lat, selectedTrail.lng);
    return buildWeatherModel(
      selectedTrail,
      recentConditions,
      cache?.conditionsJson ?? null,
      cache?.fetchedAt ?? null,
    );
  }, [db, recentConditions, refreshTick, selectedTrail]);

  if (!selectedTrail || !weather) {
    return (
      <TrailsScreen>
        <TrailsSection eyebrow="Weather" title="Trail Weather">
          <TrailsEmptyState
            icon="🌦️"
            title="No trails available yet"
            copy="Save a trail first and the weather station will build a trailhead forecast with elevation-aware guidance."
          />
        </TrailsSection>
      </TrailsScreen>
    );
  }

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <TrailsScreen
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={TR_ACCENT_LIGHT}
        />
      )}
    >
      <TrailsHero
        title="Weather"
        subtitle={`Trailhead conditions and elevation-aware guidance for ${selectedTrail.name}.`}
      />

      <TrailsSection eyebrow="Selector" title="Location Focus">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRail}>
          {trails.slice(0, 8).map((trail) => (
            <TrailsChip
              key={trail.id}
              label={trail.name}
              active={trail.id === selectedTrail.id}
              onPress={() => setSelectedTrailId(trail.id)}
            />
          ))}
        </ScrollView>
      </TrailsSection>

      <GlassCard elevated style={styles.currentHero}>
        <View style={styles.currentTopRow}>
          <View style={styles.currentCopy}>
            <Text variant="caption" style={styles.eyebrow}>
              {weather.source === 'cache' ? 'cached forecast' : 'trail-derived outlook'}
            </Text>
            <View style={styles.temperatureRow}>
              <Text variant="heading" style={styles.temperatureValue}>
                {Math.round(weather.current.temperature)}°
              </Text>
              <Text variant="body" color={TR_TEXT_SECONDARY} style={styles.temperatureUnit}>
                C
              </Text>
            </View>
            <Text variant="body" style={styles.conditionText}>
              {weather.current.description}
            </Text>
            <Text variant="caption" color={TR_TEXT_TERTIARY}>
              {weather.stale
                ? `Offline fallback · updated ${formatRelativeTime(weather.fetchedAt)}`
                : `Updated ${formatRelativeTime(weather.fetchedAt)}`}
            </Text>
          </View>

          <View style={styles.iconStack}>
            <View style={styles.weatherIconWrap}>
              <MaterialSymbol
                name={weatherSymbol(weather.current.code)}
                size={48}
                color={TR_ACCENT_LIGHT}
                filled
              />
            </View>
            <Text variant="caption" color={TR_TEXT_SECONDARY}>
              Feels like {formatTemperature(weather.current.feelsLike)}
            </Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.metricPill}>
            <MaterialSymbol name="air" size={16} color={TR_ACCENT_LIGHT} />
            <View>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>Wind</Text>
              <Text variant="body" style={styles.metricValue}>
                {formatWindSpeed(weather.current.windSpeed, weather.current.windDirection)}
              </Text>
            </View>
          </View>
          <View style={styles.metricPill}>
            <MaterialSymbol name="opacity" size={16} color={TR_ACCENT_LIGHT} />
            <View>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>Humidity</Text>
              <Text variant="body" style={styles.metricValue}>
                {weather.current.humidity}%
              </Text>
            </View>
          </View>
          <View style={styles.metricPill}>
            <MaterialSymbol name="visibility" size={16} color={TR_ACCENT_LIGHT} />
            <View>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>Visibility</Text>
              <Text variant="body" style={styles.metricValue}>
                {weather.current.visibilityKm.toFixed(1)} km
              </Text>
            </View>
          </View>
          <View style={styles.metricPill}>
            <MaterialSymbol name="sunny" size={16} color={TR_ACCENT_LIGHT} />
            <View>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>UV Index</Text>
              <Text variant="body" style={styles.metricValue}>
                {weather.current.uvIndex}
              </Text>
            </View>
          </View>
        </View>
      </GlassCard>

      <TrailsSection eyebrow="Hourly" title="Next 12 Hours">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyRail}>
          {weather.hourly.map((entry) => (
            <GlassCard key={entry.hour} style={styles.hourCard}>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>
                {entry.hour}
              </Text>
              <MaterialSymbol
                name={weatherSymbol(entry.code)}
                size={22}
                color={entry.precipitationProbability >= 45 ? '#8BCFF0' : TR_ACCENT_LIGHT}
              />
              <View style={styles.hourBarTrack}>
                <View
                  style={[
                    styles.hourBarFill,
                    {
                      height: `${clamp(entry.temperature + 12, 18, 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text variant="body" style={styles.hourTemp}>
                {Math.round(entry.temperature)}°
              </Text>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>
                {entry.precipitationProbability}%
              </Text>
            </GlassCard>
          ))}
        </ScrollView>
      </TrailsSection>

      <TrailsSection eyebrow="Outlook" title="7-Day Forecast">
        <GlassCard style={styles.dailyCard}>
          {weather.daily.map((day) => (
            <View key={day.day} style={styles.dailyRow}>
              <View style={styles.dailyLead}>
                <MaterialSymbol
                  name={weatherSymbol(day.code)}
                  size={18}
                  color={day.precipitationProbability >= 45 ? '#8BCFF0' : TR_ACCENT_LIGHT}
                />
                <Text variant="body" style={styles.dailyName}>
                  {day.day}
                </Text>
              </View>
              <View style={styles.dailyTemps}>
                <Text variant="body" style={styles.dailyHigh}>
                  {Math.round(day.high)}°
                </Text>
                <Text variant="caption" color={TR_TEXT_TERTIARY}>
                  {Math.round(day.low)}°
                </Text>
              </View>
              <View style={styles.precipBarTrack}>
                <View
                  style={[
                    styles.precipBarFill,
                    { width: `${Math.max(day.precipitationProbability, 10)}%` },
                  ]}
                />
              </View>
              <Text variant="caption" color={TR_TEXT_TERTIARY} style={styles.precipCopy}>
                {day.precipitationProbability}%
              </Text>
            </View>
          ))}
        </GlassCard>
      </TrailsSection>

      <TrailsSection eyebrow="Elevation" title="Trail Weather Station">
        <GlassCard style={styles.stationCard}>
          <View style={styles.stationSummary}>
            <View style={styles.stationMetric}>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>Trailhead</Text>
              <Text variant="heading" style={styles.stationValue}>
                {formatTemperature(weather.trailheadTemp)}
              </Text>
            </View>
            <View style={styles.stationMetric}>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>Summit</Text>
              <Text variant="heading" style={styles.stationValue}>
                {formatTemperature(weather.summitTemp)}
              </Text>
            </View>
            <View style={styles.stationMetric}>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>Ridge Wind</Text>
              <Text variant="heading" style={styles.stationValue}>
                {weather.ridgeWind} km/h
              </Text>
            </View>
          </View>
          <ForecastBars trailheadTemp={weather.trailheadTemp} summitTemp={weather.summitTemp} />
          <Text variant="body" color={TR_TEXT_SECONDARY}>
            Expect a {Math.abs(Math.round(weather.trailheadTemp - weather.summitTemp))}° drop from trailhead to the summit. Ridge exposure peaks after noon with stronger crosswinds.
          </Text>
        </GlassCard>
      </TrailsSection>

      <TrailsSection eyebrow="Alerts" title="Region Notices">
        <View style={styles.alertList}>
          {weather.alerts.map((alert) => (
            <GlassCard
              key={alert.title}
              style={[
                styles.alertCard,
                alert.tone === 'warning'
                  ? styles.alertWarning
                  : alert.tone === 'stable'
                    ? styles.alertStable
                    : styles.alertInfo,
              ]}
            >
              <MaterialSymbol
                name={alert.symbol}
                size={18}
                color={alert.tone === 'warning' ? '#FFB4AB' : alert.tone === 'stable' ? '#30D158' : '#8BCFF0'}
              />
              <View style={{ flex: 1 }}>
                <Text variant="body" style={styles.alertTitle}>
                  {alert.title}
                </Text>
                <Text variant="caption" color={TR_TEXT_SECONDARY}>
                  {alert.body}
                </Text>
              </View>
            </GlassCard>
          ))}
        </View>
      </TrailsSection>

      <TrailsSection eyebrow="Seasonal" title="Historical Averages">
        <GlassCard style={styles.historyCard}>
          <View style={styles.historyStatRow}>
            <View style={styles.historyStat}>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>Average High</Text>
              <Text variant="heading" style={styles.historyValue}>
                {weather.historical.averageHigh}°
              </Text>
            </View>
            <View style={styles.historyStat}>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>Average Low</Text>
              <Text variant="heading" style={styles.historyValue}>
                {weather.historical.averageLow}°
              </Text>
            </View>
            <View style={styles.historyStat}>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>Rainy Days</Text>
              <Text variant="heading" style={styles.historyValue}>
                {weather.historical.rainyDays}
              </Text>
            </View>
          </View>
          <View style={styles.sunRow}>
            <View style={styles.sunPill}>
              <MaterialSymbol name="sunny" size={16} color={TR_ACCENT_LIGHT} />
              <Text variant="caption" color={TR_TEXT_SECONDARY}>
                Sunrise {weather.sunrise}
              </Text>
            </View>
            <View style={styles.sunPill}>
              <MaterialSymbol name="partly_cloudy_day" size={16} color={TR_ACCENT_LIGHT} />
              <Text variant="caption" color={TR_TEXT_SECONDARY}>
                Sunset {weather.sunset}
              </Text>
            </View>
          </View>
          <Text variant="body" color={TR_TEXT_SECONDARY}>
            Best months to visit: {weather.historical.bestMonths}
          </Text>
        </GlassCard>
      </TrailsSection>
    </TrailsScreen>
  );
}

const styles = StyleSheet.create({
  selectorRail: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  eyebrow: {
    color: TR_ACCENT_LIGHT,
    fontFamily: TR_FONTS.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  currentHero: {
    backgroundColor: 'rgba(18, 22, 16, 0.86)',
    gap: spacing.md,
  },
  currentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  currentCopy: {
    flex: 1,
    gap: 4,
  },
  temperatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  temperatureValue: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 56,
    lineHeight: 58,
    color: TR_TEXT,
  },
  temperatureUnit: {
    paddingBottom: 8,
  },
  conditionText: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.semiBold,
  },
  iconStack: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  weatherIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricPill: {
    width: '48%',
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricValue: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.semiBold,
  },
  hourlyRail: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  hourCard: {
    width: 88,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: TR_SURFACES.low,
  },
  hourBarTrack: {
    width: 6,
    height: 68,
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  hourBarFill: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  hourTemp: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.bold,
  },
  dailyCard: {
    gap: spacing.sm,
    backgroundColor: TR_SURFACES.low,
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dailyLead: {
    width: 108,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dailyName: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.semiBold,
  },
  dailyTemps: {
    width: 58,
    alignItems: 'flex-end',
  },
  dailyHigh: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.bold,
  },
  precipBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  precipBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#8BCFF0',
  },
  precipCopy: {
    width: 42,
    textAlign: 'right',
  },
  stationCard: {
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  stationSummary: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stationMetric: {
    flex: 1,
  },
  stationValue: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.bold,
  },
  alertList: {
    gap: spacing.sm,
  },
  alertCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  alertWarning: {
    backgroundColor: 'rgba(147,0,10,0.18)',
  },
  alertInfo: {
    backgroundColor: 'rgba(139,207,240,0.08)',
  },
  alertStable: {
    backgroundColor: 'rgba(48,209,88,0.08)',
  },
  alertTitle: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.semiBold,
  },
  historyCard: {
    gap: spacing.md,
    backgroundColor: TR_SURFACES.low,
  },
  historyStatRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  historyStat: {
    flex: 1,
  },
  historyValue: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.bold,
  },
  sunRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sunPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});
