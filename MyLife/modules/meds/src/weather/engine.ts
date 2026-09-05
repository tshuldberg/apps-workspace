import type { WeatherCorrelationResult, WeatherTriggerProfile } from '../models/weather';

interface SymptomWithWeather {
  severity: number;
  pressure: number | null;
  temperature: number | null;
  humidity: number | null;
  wind: number | null;
}

/**
 * Compute Pearson correlation coefficient between two numeric arrays.
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Calculate weather-symptom correlations for each weather factor.
 */
export function calculateWeatherCorrelation(
  data: SymptomWithWeather[],
): WeatherCorrelationResult[] {
  if (data.length < 10) return [];

  const results: WeatherCorrelationResult[] = [];

  const factors: Array<{ key: 'pressure' | 'temperature' | 'humidity' | 'wind'; getter: (d: SymptomWithWeather) => number | null }> = [
    { key: 'pressure', getter: (d) => d.pressure },
    { key: 'temperature', getter: (d) => d.temperature },
    { key: 'humidity', getter: (d) => d.humidity },
    { key: 'wind', getter: (d) => d.wind },
  ];

  for (const { key, getter } of factors) {
    const pairs = data.filter((d) => getter(d) != null);
    if (pairs.length < 10) continue;

    const factorValues = pairs.map((d) => getter(d) as number);
    const factorSeverities = pairs.map((d) => d.severity);
    const coefficient = pearsonCorrelation(factorValues, factorSeverities);

    const medianFactor = median(factorValues);
    const aboveMedian = pairs.filter((_, i) => factorValues[i] > medianFactor);
    const belowMedian = pairs.filter((_, i) => factorValues[i] <= medianFactor);

    const avgAbove = aboveMedian.length > 0
      ? aboveMedian.reduce((s, d) => s + d.severity, 0) / aboveMedian.length
      : 0;
    const avgBelow = belowMedian.length > 0
      ? belowMedian.reduce((s, d) => s + d.severity, 0) / belowMedian.length
      : 0;
    const multiplier = avgBelow > 0 ? Math.round((avgAbove / avgBelow) * 10) / 10 : 1;

    results.push({
      factor: key,
      coefficient: Math.round(coefficient * 1000) / 1000,
      multiplier,
      sampleSize: pairs.length,
    });
  }

  return results.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
}

/**
 * Identify the user's weather trigger profile from correlation results.
 */
export function identifyTriggerProfile(
  correlations: WeatherCorrelationResult[],
): WeatherTriggerProfile | null {
  const significant = correlations.filter((c) => Math.abs(c.coefficient) > 0.2);
  if (significant.length === 0) return null;

  const top = significant[0];
  const factorNames: Record<string, string> = {
    pressure: 'barometric pressure', temperature: 'temperature',
    humidity: 'humidity', wind: 'wind speed',
  };
  const description = `Symptoms are ${top.multiplier}x more likely when ${factorNames[top.factor]} is ${top.coefficient > 0 ? 'higher' : 'lower'} than usual.`;

  return { topFactors: significant, description };
}

/**
 * Check if a forecast matches the user's trigger profile.
 */
export function shouldShowForecastAlert(
  profile: WeatherTriggerProfile | null,
  forecastPressure: number | null,
  currentPressure: number | null,
): boolean {
  if (!profile || profile.topFactors.length === 0) return false;
  const pressureFactor = profile.topFactors.find((f) => f.factor === 'pressure');
  if (!pressureFactor || forecastPressure == null || currentPressure == null) return false;

  const pressureDrop = currentPressure - forecastPressure;
  return pressureDrop > 5 && Math.abs(pressureFactor.coefficient) > 0.3;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
