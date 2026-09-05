import type { SurgePrediction, SurgeFactor } from './types';

export interface SurgeInputs {
  dayOfWeek: number; // 0-6
  hour: number;
  weatherCondition: 'clear' | 'cloudy' | 'rain' | 'snow' | 'extreme';
  temperature: number; // Fahrenheit
  hasLocalEvent: boolean;
  eventName?: string;
  historicalAvgWalkIns: number;
  currentWaitlistSize: number;
}

const WEATHER_IMPACT: Record<string, number> = {
  clear: 0.1,
  cloudy: 0,
  rain: -0.2,
  snow: -0.4,
  extreme: -0.6,
};

const DAY_MULTIPLIER = [0.7, 0.8, 0.85, 0.9, 1.2, 1.4, 1.1]; // Sun-Sat

export function predictSurge(inputs: SurgeInputs): SurgePrediction {
  const factors: SurgeFactor[] = [];
  let probability = 0.5;

  // Day of week factor
  const dayMult = DAY_MULTIPLIER[inputs.dayOfWeek];
  probability *= dayMult;
  factors.push({ name: 'Day of week', impact: dayMult - 1, value: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][inputs.dayOfWeek] });

  // Weather factor
  const weatherImpact = WEATHER_IMPACT[inputs.weatherCondition] ?? 0;
  probability += weatherImpact * 0.3;
  factors.push({ name: 'Weather', impact: weatherImpact, value: inputs.weatherCondition });

  // Peak hours (6-8pm)
  const isPeakHour = inputs.hour >= 18 && inputs.hour <= 20;
  if (isPeakHour) {
    probability += 0.15;
    factors.push({ name: 'Peak hours', impact: 0.15, value: `${inputs.hour}:00` });
  }

  // Local event
  if (inputs.hasLocalEvent) {
    probability += 0.2;
    factors.push({ name: 'Local event', impact: 0.2, value: inputs.eventName ?? 'Nearby event' });
  }

  // Normalize
  probability = Math.max(0, Math.min(1, probability));
  const expectedWalkIns = Math.round(inputs.historicalAvgWalkIns * probability * 2);

  return {
    probability,
    expectedWalkIns,
    factors,
    predictedAt: new Date().toISOString(),
    windowMinutes: 30,
  };
}
