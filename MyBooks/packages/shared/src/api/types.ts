import { z } from 'zod';

// --- Open Library Search API ---

export const OLSearchDocSchema = z.object({
  key: z.string(), // e.g. "/works/OL45804W"
  title: z.string(),
  author_name: z.array(z.string()).optional(),
  author_key: z.array(z.string()).optional(),
  first_publish_year: z.number().optional(),
  isbn: z.array(z.string()).optional(),
  publisher: z.array(z.string()).optional(),
  number_of_pages_median: z.number().optional(),
  cover_i: z.number().optional(), // cover ID for constructing cover URL
  cover_edition_key: z.string().optional(), // edition OLID with best cover
  edition_key: z.array(z.string()).optional(),
  edition_count: z.number().optional(),
  language: z.array(z.string()).optional(),
  subject: z.array(z.string()).optional(),
  subtitle: z.string().optional(),
});

export type OLSearchDoc = z.infer<typeof OLSearchDocSchema>;

export const OLSearchResponseSchema = z.object({
  numFound: z.number(),
  start: z.number(),
  numFoundExact: z.boolean().optional(),
  docs: z.array(OLSearchDocSchema),
});

export type OLSearchResponse = z.infer<typeof OLSearchResponseSchema>;

// --- Open Library ISBN / Edition API ---

export const OLBookEditionSchema = z.object({
  key: z.string(), // e.g. "/books/OL7353617M"
  title: z.string(),
  subtitle: z.string().optional(),
  authors: z
    .array(z.object({ key: z.string() })) // e.g. [{ key: "/authors/OL34184A" }]
    .optional(),
  publishers: z.array(z.string()).optional(),
  publish_date: z.string().optional(),
  number_of_pages: z.number().optional(),
  isbn_10: z.array(z.string()).optional(),
  isbn_13: z.array(z.string()).optional(),
  covers: z.array(z.number()).optional(),
  works: z
    .array(z.object({ key: z.string() })) // e.g. [{ key: "/works/OL45804W" }]
    .optional(),
  subjects: z.array(z.string()).optional(),
  description: z
    .union([z.string(), z.object({ type: z.string(), value: z.string() })])
    .optional(),
  languages: z
    .array(z.object({ key: z.string() })) // e.g. [{ key: "/languages/eng" }]
    .optional(),
});

export type OLBookEdition = z.infer<typeof OLBookEditionSchema>;

// --- Open Library Works API ---

export const OLWorkSchema = z.object({
  key: z.string(), // e.g. "/works/OL45804W"
  title: z.string(),
  subtitle: z.string().optional(),
  authors: z
    .array(
      z.object({
        author: z.object({ key: z.string() }),
        type: z.object({ key: z.string() }).optional(),
      }),
    )
    .optional(),
  covers: z.array(z.number()).optional(),
  subjects: z.array(z.string()).optional(),
  subject_places: z.array(z.string()).optional(),
  subject_people: z.array(z.string()).optional(),
  subject_times: z.array(z.string()).optional(),
  description: z
    .union([z.string(), z.object({ type: z.string(), value: z.string() })])
    .optional(),
  first_publish_date: z.string().optional(),
});

export type OLWork = z.infer<typeof OLWorkSchema>;

// --- Open Library Authors API ---

export const OLAuthorSchema = z.object({
  key: z.string(), // e.g. "/authors/OL34184A"
  name: z.string(),
  personal_name: z.string().optional(),
  birth_date: z.string().optional(),
  death_date: z.string().optional(),
  bio: z
    .union([z.string(), z.object({ type: z.string(), value: z.string() })])
    .optional(),
  photos: z.array(z.number()).optional(),
  alternate_names: z.array(z.string()).optional(),
  links: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        type: z.object({ key: z.string() }).optional(),
      }),
    )
    .optional(),
});

export type OLAuthor = z.infer<typeof OLAuthorSchema>;

// --- Cover URL types ---

export type CoverSize = 'S' | 'M' | 'L';
