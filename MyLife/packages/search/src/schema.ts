/**
 * Search index schema.
 *
 * FTS5 virtual table for unified cross-module full-text search.
 * Uses porter stemmer + unicode61 tokenizer for good multilingual support.
 */

/** Create the hub_search_index FTS5 virtual table. */
export const CREATE_SEARCH_INDEX = `
CREATE VIRTUAL TABLE IF NOT EXISTS hub_search_index USING fts5(
  module_id,
  item_id,
  item_type,
  title,
  content,
  updated_at UNINDEXED,
  tokenize='porter unicode61'
);`;

/** Create a regular table to track per-module index state. */
export const CREATE_SEARCH_META = `
CREATE TABLE IF NOT EXISTS hub_search_meta (
  module_id TEXT PRIMARY KEY NOT NULL,
  indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
  item_count INTEGER NOT NULL DEFAULT 0
);`;

/** All search DDL statements. */
export const SEARCH_TABLES = [CREATE_SEARCH_INDEX, CREATE_SEARCH_META];
