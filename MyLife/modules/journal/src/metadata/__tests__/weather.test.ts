import { describe, expect, it } from 'vitest';
import { mapWeatherCode, parseWeatherResponse, buildWeatherUrl } from '../weather';
import { validateCoordinates, buildLocationData, formatPlaceName } from '../location';

describe('mapWeatherCode', () => {
  it('maps code 0 to Clear sky', () => {
    const result = mapWeatherCode(0);
    expect(result.description).toBe('Clear sky');
    expect(result.icon).toBe('☀️');
  });

  it('maps code 61 to Light rain', () => {
    const result = mapWeatherCode(61);
    expect(result.description).toBe('Light rain');
    expect(result.icon).toBe('🌧️');
  });

  it('maps code 95 to Thunderstorm', () => {
    const result = mapWeatherCode(95);
    expect(result.description).toBe('Thunderstorm');
    expect(result.icon).toBe('⛈️');
  });

  it('maps code 2 to Partly cloudy', () => {
    expect(mapWeatherCode(2).description).toBe('Partly cloudy');
  });

  it('maps code 71 to Light snow', () => {
    expect(mapWeatherCode(71).description).toBe('Light snow');
  });

  it('returns Unknown for unmapped codes', () => {
    const result = mapWeatherCode(999);
    expect(result.description).toBe('Unknown');
    expect(result.icon).toBe('🌡️');
  });
});

describe('parseWeatherResponse', () => {
  it('parses valid Open-Meteo response', () => {
    const json = {
      current_weather: {
        temperature: 18.5,
        weathercode: 2,
      },
    };
    const result = parseWeatherResponse(json);
    expect(result).toEqual({
      tempC: 18.5,
      description: 'Partly cloudy',
      icon: '⛅',
    });
  });

  it('returns null for missing current_weather', () => {
    expect(parseWeatherResponse({})).toBeNull();
  });

  it('returns null for null input', () => {
    expect(parseWeatherResponse(null)).toBeNull();
  });

  it('returns null for non-numeric temperature', () => {
    expect(parseWeatherResponse({ current_weather: { temperature: 'hot', weathercode: 0 } })).toBeNull();
  });

  it('returns null for non-numeric weathercode', () => {
    expect(parseWeatherResponse({ current_weather: { temperature: 20, weathercode: 'sunny' } })).toBeNull();
  });
});

describe('buildWeatherUrl', () => {
  it('builds correct API URL', () => {
    const url = buildWeatherUrl(37.7749, -122.4194);
    expect(url).toBe('https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current_weather=true');
  });
});

describe('validateCoordinates', () => {
  it('accepts valid coordinates', () => {
    expect(validateCoordinates(37.7749, -122.4194)).toBe(true);
    expect(validateCoordinates(0, 0)).toBe(true);
    expect(validateCoordinates(-90, -180)).toBe(true);
    expect(validateCoordinates(90, 180)).toBe(true);
  });

  it('rejects latitude outside -90 to 90', () => {
    expect(validateCoordinates(91, 0)).toBe(false);
    expect(validateCoordinates(-91, 0)).toBe(false);
  });

  it('rejects longitude outside -180 to 180', () => {
    expect(validateCoordinates(0, 181)).toBe(false);
    expect(validateCoordinates(0, -181)).toBe(false);
  });

  it('rejects NaN values', () => {
    expect(validateCoordinates(NaN, 0)).toBe(false);
    expect(validateCoordinates(0, NaN)).toBe(false);
  });
});

describe('buildLocationData', () => {
  it('builds location data from valid coordinates', () => {
    const result = buildLocationData(37.7749, -122.4194, 'San Francisco, CA', 'America/Los_Angeles');
    expect(result).toEqual({
      latitude: 37.7749,
      longitude: -122.4194,
      placeName: 'San Francisco, CA',
      timezone: 'America/Los_Angeles',
    });
  });

  it('returns null for invalid coordinates', () => {
    expect(buildLocationData(91, 0, null, null)).toBeNull();
  });

  it('handles null place name and timezone', () => {
    const result = buildLocationData(0, 0, null, null);
    expect(result?.placeName).toBeNull();
    expect(result?.timezone).toBeNull();
  });
});

describe('formatPlaceName', () => {
  it('formats city, region, country', () => {
    expect(formatPlaceName('San Francisco', 'CA', 'US')).toBe('San Francisco, CA, US');
  });

  it('formats city and region without country', () => {
    expect(formatPlaceName('San Francisco', 'CA', null)).toBe('San Francisco, CA');
  });

  it('formats city only', () => {
    expect(formatPlaceName('San Francisco', null, null)).toBe('San Francisco');
  });

  it('returns null for all null components', () => {
    expect(formatPlaceName(null, null, null)).toBeNull();
  });
});
