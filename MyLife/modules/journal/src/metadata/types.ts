import { z } from 'zod';

export const LocationDataSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  placeName: z.string().nullable(),
  timezone: z.string().nullable(),
});
export type LocationData = z.infer<typeof LocationDataSchema>;

export const WeatherDataSchema = z.object({
  tempC: z.number(),
  description: z.string(),
  icon: z.string(),
});
export type WeatherData = z.infer<typeof WeatherDataSchema>;

export const EntryMetadataSchema = z.object({
  location: LocationDataSchema.nullable(),
  weather: WeatherDataSchema.nullable(),
});
export type EntryMetadata = z.infer<typeof EntryMetadataSchema>;

export interface MetadataSettings {
  locationEnabled: boolean;
  weatherEnabled: boolean;
}
