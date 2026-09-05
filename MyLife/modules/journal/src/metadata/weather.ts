import type { WeatherData } from './types';

/** WMO Weather interpretation codes (0-99) mapped to descriptions and emoji icons. */
const WMO_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: 'Clear sky', icon: '☀️' },
  1: { description: 'Mainly clear', icon: '🌤️' },
  2: { description: 'Partly cloudy', icon: '⛅' },
  3: { description: 'Overcast', icon: '☁️' },
  45: { description: 'Fog', icon: '🌫️' },
  48: { description: 'Depositing rime fog', icon: '🌫️' },
  51: { description: 'Light drizzle', icon: '🌦️' },
  53: { description: 'Moderate drizzle', icon: '🌦️' },
  55: { description: 'Dense drizzle', icon: '🌧️' },
  56: { description: 'Light freezing drizzle', icon: '🌧️' },
  57: { description: 'Dense freezing drizzle', icon: '🌧️' },
  61: { description: 'Light rain', icon: '🌧️' },
  63: { description: 'Moderate rain', icon: '🌧️' },
  65: { description: 'Heavy rain', icon: '🌧️' },
  66: { description: 'Light freezing rain', icon: '🌧️' },
  67: { description: 'Heavy freezing rain', icon: '🌧️' },
  71: { description: 'Light snow', icon: '🌨️' },
  73: { description: 'Moderate snow', icon: '🌨️' },
  75: { description: 'Heavy snow', icon: '❄️' },
  77: { description: 'Snow grains', icon: '❄️' },
  80: { description: 'Light showers', icon: '🌦️' },
  81: { description: 'Moderate showers', icon: '🌧️' },
  82: { description: 'Violent showers', icon: '🌧️' },
  85: { description: 'Light snow showers', icon: '🌨️' },
  86: { description: 'Heavy snow showers', icon: '❄️' },
  95: { description: 'Thunderstorm', icon: '⛈️' },
  96: { description: 'Thunderstorm with light hail', icon: '⛈️' },
  99: { description: 'Thunderstorm with heavy hail', icon: '⛈️' },
};

/**
 * Map a WMO weather code to a human-readable description and emoji icon.
 * Returns a fallback for unknown codes.
 */
export function mapWeatherCode(code: number): { description: string; icon: string } {
  return WMO_CODES[code] ?? { description: 'Unknown', icon: '🌡️' };
}

/**
 * Parse an Open-Meteo API response into WeatherData.
 * Expected response shape: { current_weather: { temperature: number, weathercode: number } }
 */
export function parseWeatherResponse(json: unknown): WeatherData | null {
  if (!json || typeof json !== 'object') {
    return null;
  }

  const data = json as Record<string, unknown>;
  const currentWeather = data.current_weather as Record<string, unknown> | undefined;

  if (!currentWeather || typeof currentWeather !== 'object') {
    return null;
  }

  const temperature = currentWeather.temperature;
  const weathercode = currentWeather.weathercode;

  if (typeof temperature !== 'number' || typeof weathercode !== 'number') {
    return null;
  }

  const mapped = mapWeatherCode(weathercode);
  return {
    tempC: temperature,
    description: mapped.description,
    icon: mapped.icon,
  };
}

/**
 * Build the Open-Meteo API URL for current weather at given coordinates.
 * This API is free, requires no API key, and receives only lat/lon (no user identity).
 */
export function buildWeatherUrl(latitude: number, longitude: number): string {
  return `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
}
