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

// --- 5b. Share Events ---

export const ShareVisibility = z.enum(['private', 'friends', 'public']);
export type ShareVisibility = z.infer<typeof ShareVisibility>;

export const ShareObjectType = z.enum(['book_rating', 'book_review', 'list_item', 'generic']);
export type ShareObjectType = z.infer<typeof ShareObjectType>;

export const ShareEventSchema = z.object({
  id,
  actor_user_id: z.string().min(1),
  object_type: ShareObjectType,
  object_id: z.string().min(1),
  visibility: ShareVisibility.default('private'),
  payload_json: z.string().default('{}'),
  created_at: timestamp,
  updated_at: timestamp,
});
export type ShareEvent = z.infer<typeof ShareEventSchema>;

export const ShareEventInsertSchema = ShareEventSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  payload_json: true,
  visibility: true,
});
export type ShareEventInsert = z.infer<typeof ShareEventInsertSchema>;

// --- 5c. Reader Documents ---

export const ReaderDocumentSource = z.enum(['upload', 'import', 'note']);
export type ReaderDocumentSource = z.infer<typeof ReaderDocumentSource>;

export const ReaderDocumentSchema = z.object({
  id,
  book_id: z.string().uuid().nullable(),
  title: z.string().min(1),
  author: z.string().nullable(),
  source_type: ReaderDocumentSource.default('upload'),
  mime_type: z.string().nullable(),
  file_name: z.string().nullable(),
  file_extension: z.string().nullable(),
  text_content: z.string(),
  content_hash: z.string().nullable(),
  total_chars: z.number().int().nonnegative(),
  total_words: z.number().int().nonnegative(),
  current_position: z.number().int().nonnegative(),
  progress_percent: z.number().min(0).max(100),
  last_opened_at: isoDatetime.nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});
export type ReaderDocument = z.infer<typeof ReaderDocumentSchema>;

export const ReaderDocumentInsertSchema = z.object({
  book_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  author: z.string().nullable().optional(),
  source_type: ReaderDocumentSource.default('upload'),
  mime_type: z.string().nullable().optional(),
  file_name: z.string().nullable().optional(),
  file_extension: z.string().nullable().optional(),
  text_content: z.string().min(1),
  content_hash: z.string().nullable().optional(),
  total_chars: z.number().int().nonnegative().optional(),
  total_words: z.number().int().nonnegative().optional(),
  current_position: z.number().int().nonnegative().optional(),
  progress_percent: z.number().min(0).max(100).optional(),
  last_opened_at: isoDatetime.nullable().optional(),
});
export type ReaderDocumentInsert = z.infer<typeof ReaderDocumentInsertSchema>;

export const ReaderNoteType = z.enum(['note', 'highlight', 'bookmark']);
export type ReaderNoteType = z.infer<typeof ReaderNoteType>;

export const ReaderDocumentNoteSchema = z.object({
  id,
  document_id: z.string().uuid(),
  note_type: ReaderNoteType.default('note'),
  selection_start: z.number().int().nonnegative(),
  selection_end: z.number().int().nonnegative(),
  selected_text: z.string().nullable(),
  note_text: z.string().nullable(),
  color: z.string().nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});
export type ReaderDocumentNote = z.infer<typeof ReaderDocumentNoteSchema>;

export const ReaderDocumentNoteInsertSchema = z.object({
  document_id: z.string().uuid(),
  note_type: ReaderNoteType.default('note'),
  selection_start: z.number().int().nonnegative(),
  selection_end: z.number().int().nonnegative(),
  selected_text: z.string().nullable().optional(),
  note_text: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});
export type ReaderDocumentNoteInsert = z.infer<typeof ReaderDocumentNoteInsertSchema>;

export const ReaderTheme = z.enum(['dark', 'sepia', 'light']);
export type ReaderTheme = z.infer<typeof ReaderTheme>;

export const ReaderDocumentPreferenceSchema = z.object({
  document_id: z.string().uuid(),
  font_size: z.number().int().min(12).max(48),
  line_height: z.number().min(1).max(3),
  font_family: z.string().min(1),
  theme: ReaderTheme.default('sepia'),
  margin_size: z.number().int().min(0).max(64),
  updated_at: timestamp,
});
export type ReaderDocumentPreference = z.infer<typeof ReaderDocumentPreferenceSchema>;

export const ReaderDocumentPreferenceInsertSchema = z.object({
  document_id: z.string().uuid(),
  font_size: z.number().int().min(12).max(48).optional(),
  line_height: z.number().min(1).max(3).optional(),
  font_family: z.string().min(1).optional(),
  theme: ReaderTheme.optional(),
  margin_size: z.number().int().min(0).max(64).optional(),
});
export type ReaderDocumentPreferenceInsert = z.infer<typeof ReaderDocumentPreferenceInsertSchema>;

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

// --- 13. Progress Updates ---

export const ProgressUpdateSchema = z.object({
  id,
  session_id: z.string().uuid(),
  book_id: z.string().uuid(),
  page_number: z.number().int().nonnegative().nullable(),
  percent_complete: z.number().min(0).max(100).nullable(),
  note: z.string().nullable(),
  created_at: timestamp,
});
export type ProgressUpdate = z.infer<typeof ProgressUpdateSchema>;

export const ProgressUpdateInsertSchema = ProgressUpdateSchema.omit({
  id: true,
  created_at: true,
}).partial({
  page_number: true,
  percent_complete: true,
  note: true,
});
export type ProgressUpdateInsert = z.infer<typeof ProgressUpdateInsertSchema>;

// --- 14. Timed Sessions ---

export const TimedSessionSchema = z.object({
  id,
  session_id: z.string().uuid(),
  book_id: z.string().uuid(),
  started_at: isoDatetime,
  ended_at: isoDatetime.nullable(),
  duration_ms: z.number().int().nonnegative().nullable(),
  start_page: z.number().int().nonnegative().nullable(),
  end_page: z.number().int().nonnegative().nullable(),
  pages_read: z.number().int().nonnegative().nullable(),
  pages_per_hour: z.number().nonnegative().nullable(),
  created_at: timestamp,
});
export type TimedSession = z.infer<typeof TimedSessionSchema>;

export const TimedSessionInsertSchema = TimedSessionSchema.omit({
  id: true,
  created_at: true,
}).partial({
  ended_at: true,
  duration_ms: true,
  start_page: true,
  end_page: true,
  pages_read: true,
  pages_per_hour: true,
});
export type TimedSessionInsert = z.infer<typeof TimedSessionInsertSchema>;

// --- 15. Series ---

export const SeriesSchema = z.object({
  id,
  name: z.string().min(1),
  description: z.string().nullable(),
  total_books: z.number().int().nonnegative().nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});
export type Series = z.infer<typeof SeriesSchema>;

export const SeriesInsertSchema = SeriesSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  description: true,
  total_books: true,
});
export type SeriesInsert = z.infer<typeof SeriesInsertSchema>;

// --- 16. Series Books ---

export const SeriesBookSchema = z.object({
  series_id: z.string().uuid(),
  book_id: z.string().uuid(),
  sort_order: z.number().int().nonnegative(),
  created_at: timestamp,
});
export type SeriesBook = z.infer<typeof SeriesBookSchema>;

export const SeriesBookInsertSchema = SeriesBookSchema.omit({
  created_at: true,
}).partial({
  sort_order: true,
});
export type SeriesBookInsert = z.infer<typeof SeriesBookInsertSchema>;

// --- 17. Mood Tags ---

export const MoodTagType = z.enum(['mood', 'pace', 'genre']);
export type MoodTagType = z.infer<typeof MoodTagType>;

export const MoodTagSchema = z.object({
  id,
  book_id: z.string().uuid(),
  tag_type: MoodTagType,
  value: z.string().min(1),
  created_at: timestamp,
});
export type MoodTag = z.infer<typeof MoodTagSchema>;

export const MoodTagInsertSchema = MoodTagSchema.omit({
  id: true,
  created_at: true,
});
export type MoodTagInsert = z.infer<typeof MoodTagInsertSchema>;

// --- 18. Content Warnings ---

export const ContentWarningSeverity = z.enum(['mild', 'moderate', 'severe']);
export type ContentWarningSeverity = z.infer<typeof ContentWarningSeverity>;

export const ContentWarningSchema = z.object({
  id,
  book_id: z.string().uuid(),
  warning: z.string().min(1),
  severity: ContentWarningSeverity.default('moderate'),
  created_at: timestamp,
});
export type ContentWarning = z.infer<typeof ContentWarningSchema>;

export const ContentWarningInsertSchema = ContentWarningSchema.omit({
  id: true,
  created_at: true,
}).partial({
  severity: true,
});
export type ContentWarningInsert = z.infer<typeof ContentWarningInsertSchema>;

// --- 19. Challenges ---

export const ChallengeType = z.enum(['books_count', 'pages_count', 'minutes_count', 'themed']);
export type ChallengeType = z.infer<typeof ChallengeType>;

export const ChallengeTargetUnit = z.enum(['books', 'pages', 'minutes']);
export type ChallengeTargetUnit = z.infer<typeof ChallengeTargetUnit>;

export const ChallengeTimeFrame = z.enum(['yearly', 'monthly', 'weekly', 'custom']);
export type ChallengeTimeFrame = z.infer<typeof ChallengeTimeFrame>;

export const ChallengeSchema = z.object({
  id,
  name: z.string().min(1),
  description: z.string().nullable(),
  challenge_type: ChallengeType,
  target_value: z.number().int().positive(),
  target_unit: ChallengeTargetUnit,
  time_frame: ChallengeTimeFrame,
  start_date: isoDatetime,
  end_date: isoDatetime,
  theme_prompt: z.string().nullable(),
  is_active: z.number().int().min(0).max(1),
  created_at: timestamp,
  updated_at: timestamp,
});
export type Challenge = z.infer<typeof ChallengeSchema>;

export const ChallengeInsertSchema = ChallengeSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  description: true,
  theme_prompt: true,
  is_active: true,
});
export type ChallengeInsert = z.infer<typeof ChallengeInsertSchema>;

// --- 20. Challenge Progress ---

export const ChallengeProgressSchema = z.object({
  id,
  challenge_id: z.string().uuid(),
  book_id: z.string().uuid().nullable(),
  session_id: z.string().uuid().nullable(),
  value_added: z.number().int().nonnegative(),
  note: z.string().nullable(),
  logged_at: timestamp,
});
export type ChallengeProgress = z.infer<typeof ChallengeProgressSchema>;

export const ChallengeProgressInsertSchema = ChallengeProgressSchema.omit({
  id: true,
  logged_at: true,
}).partial({
  book_id: true,
  session_id: true,
  note: true,
});
export type ChallengeProgressInsert = z.infer<typeof ChallengeProgressInsertSchema>;

// --- 21. Journal Entries ---

export const JournalEntrySchema = z.object({
  id,
  title: z.string().nullable(),
  content: z.string(),
  content_encrypted: z.number().int().min(0).max(1),
  encryption_salt: z.string().nullable(),
  encryption_iv: z.string().nullable(),
  word_count: z.number().int().nonnegative(),
  mood: z.string().nullable(),
  is_favorite: z.number().int().min(0).max(1),
  created_at: timestamp,
  updated_at: timestamp,
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const JournalEntryInsertSchema = JournalEntrySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  title: true,
  content_encrypted: true,
  encryption_salt: true,
  encryption_iv: true,
  word_count: true,
  mood: true,
  is_favorite: true,
});
export type JournalEntryInsert = z.infer<typeof JournalEntryInsertSchema>;

// --- 22. Journal Photos ---

export const JournalPhotoSchema = z.object({
  id,
  entry_id: z.string().uuid(),
  file_path: z.string().min(1),
  file_name: z.string().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  sort_order: z.number().int().nonnegative(),
  created_at: timestamp,
});
export type JournalPhoto = z.infer<typeof JournalPhotoSchema>;

export const JournalPhotoInsertSchema = JournalPhotoSchema.omit({
  id: true,
  created_at: true,
}).partial({
  file_name: true,
  width: true,
  height: true,
  sort_order: true,
});
export type JournalPhotoInsert = z.infer<typeof JournalPhotoInsertSchema>;

// --- 23. Journal Book Links ---

export const JournalBookLinkSchema = z.object({
  entry_id: z.string().uuid(),
  book_id: z.string().uuid(),
  created_at: timestamp,
});
export type JournalBookLink = z.infer<typeof JournalBookLinkSchema>;

export const JournalBookLinkInsertSchema = JournalBookLinkSchema.omit({
  created_at: true,
});
export type JournalBookLinkInsert = z.infer<typeof JournalBookLinkInsertSchema>;
