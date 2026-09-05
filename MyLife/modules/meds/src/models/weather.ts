import { z } from 'zod';

export const WeatherSnapshotSchema = z.object({
  id: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  temperatureC: z.number().nullable(),
  humidityPercent: z.number().nullable(),
  pressureMb: z.number().nullable(),
  pressureChange3h: z.number().nullable(),
  windSpeedKmh: z.number().nullable(),
  weatherCode: z.number().int().nullable(),
  weatherDescription: z.string().nullable(),
  capturedAt: z.string(),
  createdAt: z.string(),
});
export type WeatherSnapshot = z.infer<typeof WeatherSnapshotSchema>;

export const CreateWeatherSnapshotInputSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  temperatureC: z.number().optional(),
  humidityPercent: z.number().optional(),
  pressureMb: z.number().optional(),
  pressureChange3h: z.number().optional(),
  windSpeedKmh: z.number().optional(),
  weatherCode: z.number().int().optional(),
  weatherDescription: z.string().optional(),
  capturedAt: z.string().optional(),
});
export type CreateWeatherSnapshotInput = z.infer<typeof CreateWeatherSnapshotInputSchema>;

export const WeatherSymptomLinkSchema = z.object({
  id: z.string(),
  weatherSnapshotId: z.string(),
  symptomLogId: z.string(),
  createdAt: z.string(),
});
export type WeatherSymptomLink = z.infer<typeof WeatherSymptomLinkSchema>;

export interface WeatherCorrelationResult {
  factor: 'pressure' | 'temperature' | 'humidity' | 'wind';
  coefficient: number;
  multiplier: number;
  sampleSize: number;
}

export interface WeatherTriggerProfile {
  topFactors: WeatherCorrelationResult[];
  description: string;
}
