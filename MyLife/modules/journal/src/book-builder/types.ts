import { z } from 'zod';

export const CoverTemplateSchema = z.enum([
  'minimalist', 'photo', 'classic', 'modern', 'nature',
]);
export type CoverTemplate = z.infer<typeof CoverTemplateSchema>;

export const BodyFontSchema = z.enum([
  'georgia', 'merriweather', 'open_sans', 'source_code_pro',
]);
export type BodyFont = z.infer<typeof BodyFontSchema>;

export const PageSizeSchema = z.enum(['6x9', '5.5x8.5', '8.5x11']);
export type PageSize = z.infer<typeof PageSizeSchema>;

export const BookConfigSchema = z.object({
  title: z.string().min(1).max(100),
  subtitle: z.string().max(200).nullable().default(null),
  author: z.string().min(1).max(100),
  coverTemplate: CoverTemplateSchema,
  coverImageUri: z.string().nullable().default(null),
  bodyFont: BodyFontSchema,
  pageSize: PageSizeSchema,
  entryIds: z.array(z.string()).min(1).max(500),
  includePhotos: z.boolean().default(true),
  includeMoodTags: z.boolean().default(true),
  includeMetadata: z.boolean().default(true),
});
export type BookConfig = z.infer<typeof BookConfigSchema>;

export interface PageDimensions {
  widthPt: number;
  heightPt: number;
}

export interface PageMargins {
  innerPt: number;
  outerPt: number;
  topPt: number;
  bottomPt: number;
}

export interface BookEstimate {
  entryCount: number;
  estimatedPages: number;
  estimatedImagePages: number;
  estimatedTextPages: number;
}

export const MAX_ENTRIES_PER_BOOK = 500;
export const WORDS_PER_PAGE = 250;
