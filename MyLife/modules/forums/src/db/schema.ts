/**
 * SQLite cache tables for offline browsing.
 * These mirror a subset of the Supabase cloud schema for local reads.
 * Prefixed with fr_ to namespace within the shared SQLite file.
 */

export const CACHE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS fr_communities_cache (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    banner_url TEXT,
    community_type TEXT NOT NULL DEFAULT 'public',
    linked_module_id TEXT,
    member_count INTEGER NOT NULL DEFAULT 0,
    thread_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS fr_community_members_cache (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL REFERENCES fr_communities_cache(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    joined_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS fr_threads_cache (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL REFERENCES fr_communities_cache(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    is_pinned INTEGER NOT NULL DEFAULT 0,
    vote_score INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS fr_replies_cache (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES fr_threads_cache(id) ON DELETE CASCADE,
    parent_reply_id TEXT,
    author_id TEXT NOT NULL,
    body TEXT NOT NULL,
    vote_score INTEGER NOT NULL DEFAULT 0,
    depth INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS fr_bookmarks_cache (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS fr_tags_cache (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL REFERENCES fr_communities_cache(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

// ── V2: B+C Feature Cache Tables ───────────────────────────────────

export const V3_CACHE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS fr_votes_local (
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    PRIMARY KEY (target_type, target_id, profile_id)
  )`,
];

export const V3_CACHE_INDEXES: string[] = [];

export const V4_CACHE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS fr_activity_cache (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    actor_profile_id TEXT,
    actor_name TEXT NOT NULL,
    actor_trust_tier TEXT NOT NULL DEFAULT 'trusted',
    type TEXT NOT NULL,
    verb TEXT NOT NULL,
    context TEXT NOT NULL,
    detail TEXT,
    target_type TEXT NOT NULL,
    target_id TEXT,
    community_id TEXT,
    thread_id TEXT,
    conversation_id TEXT,
    target_profile_id TEXT,
    created_at TEXT NOT NULL,
    read_at TEXT,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

export const V4_CACHE_INDEXES: string[] = [
  'CREATE INDEX IF NOT EXISTS fr_activity_cache_profile_idx ON fr_activity_cache (profile_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS fr_activity_cache_type_idx ON fr_activity_cache (profile_id, type, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS fr_activity_cache_unread_idx ON fr_activity_cache (profile_id, read_at, created_at DESC)',
];

export const V2_CACHE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS fr_profiles_cache (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL UNIQUE,
    bio TEXT DEFAULT '',
    avatar_url TEXT,
    banner_url TEXT,
    status_text TEXT DEFAULT '',
    status_emoji TEXT DEFAULT '',
    location TEXT DEFAULT '',
    website_url TEXT,
    karma INTEGER NOT NULL DEFAULT 0,
    thread_count INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
    communities_joined INTEGER NOT NULL DEFAULT 0,
    is_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS fr_conversations_cache (
    id TEXT PRIMARY KEY,
    title TEXT,
    is_group INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    last_message_at TEXT,
    last_message_preview TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS fr_messages_cache (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    body TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT,
    is_edited INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'sent',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

export const V2_CACHE_INDEXES: string[] = [
  'CREATE INDEX IF NOT EXISTS fr_profiles_cache_username_idx ON fr_profiles_cache (username)',
  'CREATE INDEX IF NOT EXISTS fr_profiles_cache_karma_idx ON fr_profiles_cache (karma DESC)',
  'CREATE INDEX IF NOT EXISTS fr_conversations_cache_last_msg_idx ON fr_conversations_cache (last_message_at DESC)',
  'CREATE INDEX IF NOT EXISTS fr_messages_cache_conv_idx ON fr_messages_cache (conversation_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS fr_messages_cache_status_idx ON fr_messages_cache (status)',
];

export const CACHE_INDEXES: string[] = [
  'CREATE INDEX IF NOT EXISTS fr_communities_cache_name_idx ON fr_communities_cache (name)',
  'CREATE INDEX IF NOT EXISTS fr_communities_cache_type_idx ON fr_communities_cache (community_type)',
  'CREATE INDEX IF NOT EXISTS fr_members_cache_community_idx ON fr_community_members_cache (community_id)',
  'CREATE INDEX IF NOT EXISTS fr_members_cache_profile_idx ON fr_community_members_cache (profile_id)',
  'CREATE INDEX IF NOT EXISTS fr_threads_cache_community_idx ON fr_threads_cache (community_id)',
  'CREATE INDEX IF NOT EXISTS fr_threads_cache_author_idx ON fr_threads_cache (author_id)',
  'CREATE INDEX IF NOT EXISTS fr_threads_cache_created_idx ON fr_threads_cache (created_at DESC)',
  'CREATE INDEX IF NOT EXISTS fr_threads_cache_score_idx ON fr_threads_cache (vote_score DESC)',
  'CREATE INDEX IF NOT EXISTS fr_replies_cache_thread_idx ON fr_replies_cache (thread_id)',
  'CREATE INDEX IF NOT EXISTS fr_replies_cache_parent_idx ON fr_replies_cache (parent_reply_id)',
  'CREATE INDEX IF NOT EXISTS fr_bookmarks_cache_profile_idx ON fr_bookmarks_cache (profile_id)',
  'CREATE INDEX IF NOT EXISTS fr_tags_cache_community_idx ON fr_tags_cache (community_id)',
];
