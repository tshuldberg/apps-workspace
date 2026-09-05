// Pure weather formatting utilities using WMO weather codes.

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

const WMO_ICONS: Record<number, string> = {
  0: '\u2600\uFE0F',      // sunny
  1: '\uD83C\uDF24\uFE0F', // mostly sunny
  2: '\u26C5',             // partly cloudy
  3: '\u2601\uFE0F',      // cloudy
  45: '\uD83C\uDF2B\uFE0F', // fog
  48: '\uD83C\uDF2B\uFE0F', // fog
  51: '\uD83C\uDF26\uFE0F', // drizzle
  53: '\uD83C\uDF26\uFE0F', // drizzle
  55: '\uD83C\uDF27\uFE0F', // rain
  56: '\uD83C\uDF28\uFE0F', // freezing
  57: '\uD83C\uDF28\uFE0F', // freezing
  61: '\uD83C\uDF27\uFE0F', // rain
  63: '\uD83C\uDF27\uFE0F', // rain
  65: '\uD83C\uDF27\uFE0F', // heavy rain
  66: '\uD83C\uDF28\uFE0F', // freezing rain
  67: '\uD83C\uDF28\uFE0F', // freezing rain
  71: '\uD83C\uDF28\uFE0F', // snow
  73: '\uD83C\uDF28\uFE0F', // snow
  75: '\u2744\uFE0F',     // heavy snow
  77: '\u2744\uFE0F',     // snow grains
  80: '\uD83C\uDF26\uFE0F', // showers
  81: '\uD83C\uDF27\uFE0F', // showers
  82: '\u26C8\uFE0F',     // violent showers
  85: '\uD83C\uDF28\uFE0F', // snow showers
  86: '\u2744\uFE0F',     // heavy snow showers
  95: '\u26C8\uFE0F',     // thunderstorm
  96: '\u26C8\uFE0F',     // thunderstorm + hail
  99: '\u26C8\uFE0F',     // thunderstorm + heavy hail
};

const CARDINAL_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/**
 * Map a WMO weather code to a human-readable description.
 */
export function weatherDescription(wmoCode: number): string {
  return WMO_DESCRIPTIONS[wmoCode] ?? 'Unknown';
}

/**
 * Map a WMO weather code to an emoji icon.
 */
export function weatherIcon(wmoCode: number): string {
  return WMO_ICONS[wmoCode] ?? '\u2753'; // question mark
}

/**
 * Format a temperature in Celsius.
 */
export function formatTemperature(celsius: number): string {
  return `${Math.round(celsius)}\u00B0C`;
}

/**
 * Format wind speed with cardinal direction.
 */
export function formatWindSpeed(kmh: number, directionDeg: number): string {
  const index = Math.round(directionDeg / 45) % 8;
  const cardinal = CARDINAL_DIRECTIONS[index];
  return `${Math.round(kmh)} km/h ${cardinal}`;
}

/**
 * Round coordinates to 2 decimal places for cache key purposes.
 */
export function roundCoordinates(
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
  };
}

/**
 * Check if a weather cache entry is still valid based on fetchedAt and TTL.
 * Default TTL is 60 minutes.
 */
export function isWeatherCacheValid(
  fetchedAt: string,
  ttlMinutes = 60,
): boolean {
  const fetchedTime = new Date(fetchedAt).getTime();
  if (isNaN(fetchedTime)) return false;
  const now = Date.now();
  const ttlMs = ttlMinutes * 60 * 1000;
  return now - fetchedTime < ttlMs;
}

/**
 * Rough dry-air lapse rate estimate for trailhead to summit comparisons.
 */
export function temperatureAtElevation(
  baseTempCelsius: number,
  elevationDeltaMeters: number,
): number {
  return baseTempCelsius - (elevationDeltaMeters / 1000) * 6.5;
}

/**
 * Human-readable relative age for cached weather timestamps.
 */
export function formatRelativeTime(
  timestamp: string,
  nowMs = Date.now(),
): string {
  const target = new Date(timestamp).getTime();

  if (Number.isNaN(target)) {
    return 'just now';
  }

  const diffMs = Math.max(nowMs - target, 0);
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) {
    return 'just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
