import { z } from 'zod';

// --- Reusable primitives ---

const id = z.string().uuid();
const timestamp = z.string().datetime();
const isoDatetime = z.string(); // ISO datetime string (flexible for imports)

// --- 1. Books ---

export const BookFormat = z.enum(['physical', 'ebook', 'audiobook']);
export type BookFormat = z.infer<typeof BookFormat>;

export const AddedSource = z.enum(['search', 'scan', 'manual', 'import_goodreads', 'import_storygraph']);
export type AddedSource = z.infer<typeof AddedSource>;

export const BookSchema = z.object({
  id,
  title: z.string().min(1),
  subtitle: z.string().nullable(),
  authors: z.string(), // JSON array stored as TEXT: ["Author Name", ...]
  isbn_10: z.string().nullable(),
  isbn_13: z.string().nullable(),
  open_library_id: z.string().nullable(),
  open_library_edition_id: z.string().nullable(),
  cover_url: z.string().nullable(),
  cover_cached_path: z.string().nullable(),
  publisher: z.string().nullable(),
  publish_year: z.number().int().nullable(),
  page_count: z.number().int().positive().nullable(),
  subjects: z.string().nullable(), // JSON array stored as TEXT: ["Fiction", ...]
  description: z.string().nullable(),
  language: z.string().default('en'),
  format: BookFormat.default('physical'),
  added_source: AddedSource.default('manual'),
  created_at: timestamp,
  updated_at: timestamp,
});
export type Book = z.infer<typeof BookSchema>;

export const BookInsertSchema = BookSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  subtitle: true,
  isbn_10: true,
  isbn_13: true,
  open_library_id: true,
  open_library_edition_id: true,
  cover_url: true,
  cover_cached_path: true,
  publisher: true,
  publish_year: true,
  page_count: true,
  subjects: true,
  description: true,
  language: true,
  format: true,
  added_source: true,
});
export type BookInsert = z.infer<typeof BookInsertSchema>;

// --- 2. Shelves ---

export const ShelfSchema = z.object({
  id,
  name: z.string().min(1),
  slug: z.string().min(1),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  is_system: z.number().int().min(0).max(1), // SQLite boolean
  sort_order: z.number().int().nonnegative(),
  book_count: z.number().int().nonnegative(),
  created_at: timestamp,
});
export type Shelf = z.infer<typeof ShelfSchema>;

export const ShelfInsertSchema = ShelfSchema.omit({
  id: true,
  created_at: true,
}).partial({
  icon: true,
  color: true,
  is_system: true,
  sort_order: true,
  book_count: true,
});
export type ShelfInsert = z.infer<typeof ShelfInsertSchema>;

// --- 3. Book-Shelf junction ---

export const BookShelfSchema = z.object({
  book_id: z.string().uuid(),
  shelf_id: z.string().uuid(),
  added_at: timestamp,
});
export type BookShelf = z.infer<typeof BookShelfSchema>;

export const BookShelfInsertSchema = BookShelfSchema.omit({
  added_at: true,
});
export type BookShelfInsert = z.infer<typeof BookShelfInsertSchema>;

// --- 4. Reading Sessions ---

export const ReadingStatus = z.enum(['want_to_read', 'reading', 'finished', 'dnf']);
export type ReadingStatus = z.infer<typeof ReadingStatus>;

export const ReadingSessionSchema = z.object({
  id,
  book_id: z.string().uuid(),
  started_at: isoDatetime.nullable(),
  finished_at: isoDatetime.nullable(),
  current_page: z.number().int().nonnegative(),
  status: ReadingStatus.default('want_to_read'),
  dnf_reason: z.string().nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});
export type ReadingSession = z.infer<typeof ReadingSessionSchema>;

export const ReadingSessionInsertSchema = ReadingSessionSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  started_at: true,
  finished_at: true,
  current_page: true,
  status: true,
  dnf_reason: true,
});
export type ReadingSessionInsert = z.infer<typeof ReadingSessionInsertSchema>;

// --- 5. Reviews ---

export const ReviewSchema = z.object({
  id,
  book_id: z.string().uuid(),
  session_id: z.string().uuid().nullable(),
  rating: z.number().min(0.5).max(5.0).multipleOf(0.5).nullable(),
  review_text: z.string().nullable(),
  favorite_quote: z.string().nullable(),
  is_favorite: z.number().int().min(0).max(1), // SQLite boolean
  created_at: timestamp,
  updated_at: timestamp,
});
export type Review = z.infer<typeof ReviewSchema>;

export const ReviewInsertSchema = ReviewSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  session_id: true,
  rating: true,
  review_text: true,
  favorite_quote: true,
  is_favorite: true,
});
export type ReviewInsert = z.infer<typeof ReviewInsertSchema>;

// --- 6. Tags ---

export const TagSchema = z.object({
  id,
  name: z.string().min(1),
  color: z.string().nullable(),
  usage_count: z.number().int().nonnegative(),
  created_at: timestamp,
});
export type Tag = z.infer<typeof TagSchema>;

export const TagInsertSchema = TagSchema.omit({
  id: true,
  created_at: true,
}).partial({
  color: true,
  usage_count: true,
});
export type TagInsert = z.infer<typeof TagInsertSchema>;

// --- 7. Book-Tag junction ---

export const BookTagSchema = z.object({
  book_id: z.string().uuid(),
  tag_id: z.string().uuid(),
});
export type BookTag = z.infer<typeof BookTagSchema>;

// --- 8. Reading Goals ---

export const ReadingGoalSchema = z.object({
  id,
  year: z.number().int().min(1900).max(2100),
  target_books: z.number().int().positive(),
  target_pages: z.number().int().positive().nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});
export type ReadingGoal = z.infer<typeof ReadingGoalSchema>;

export const ReadingGoalInsertSchema = ReadingGoalSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  target_pages: true,
});
export type ReadingGoalInsert = z.infer<typeof ReadingGoalInsertSchema>;

// --- 9. Open Library Cache ---

export const OLCacheSchema = z.object({
  isbn: z.string(),
  response_json: z.string(),
  cover_downloaded: z.number().int().min(0).max(1), // SQLite boolean
  fetched_at: timestamp,
});
export type OLCache = z.infer<typeof OLCacheSchema>;

export const OLCacheInsertSchema = OLCacheSchema.omit({
  fetched_at: true,
}).partial({
  cover_downloaded: true,
});
export type OLCacheInsert = z.infer<typeof OLCacheInsertSchema>;

// --- 10. Import Log ---

export const ImportSource = z.enum(['goodreads', 'storygraph']);
export type ImportSource = z.infer<typeof ImportSource>;

export const ImportLogSchema = z.object({
  id,
  source: ImportSource,
  filename: z.string().min(1),
  books_imported: z.number().int().nonnegative(),
  books_skipped: z.number().int().nonnegative(),
  errors: z.string().nullable(), // JSON array of error messages
  imported_at: timestamp,
});
export type ImportLog = z.infer<typeof ImportLogSchema>;

export const ImportLogInsertSchema = ImportLogSchema.omit({
  id: true,
  imported_at: true,
}).partial({
  books_imported: true,
  books_skipped: true,
  errors: true,
});
export type ImportLogInsert = z.infer<typeof ImportLogInsertSchema>;

// --- 11. Settings ---

export const SettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});
export type Setting = z.infer<typeof SettingSchema>;

// --- 12. Schema Version ---

export const SchemaVersionSchema = z.object({
  version: z.number().int().positive(),
  applied_at: timestamp,
});
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;
