/**
 * Hub-level migration for P2P sync and content distribution tables.
 *
 * This migration creates all sync_ and torrent_ tables.
 * Uses the Migration interface from @mylife/db.
 */

import type { Migration } from '@mylife/db';
import {
  ALL_P2P_TABLES,
} from './schema';

/**
 * Split multi-statement DDL constants into individual statements.
 * Some DDL constants (like indexes) contain multiple semicolon-separated statements.
 */
function splitStatements(ddl: string): string[] {
  return ddl
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s + ';');
}

export const SYNC_MIGRATION: Migration = {
  version: 1,
  description: 'Add P2P sync and content distribution tables',
  up: ALL_P2P_TABLES.flatMap(splitStatements),
  down: [
    'DROP TABLE IF EXISTS torrent_seeding_policy;',
    'DROP TABLE IF EXISTS torrent_payments;',
    'DROP TABLE IF EXISTS torrent_peers;',
    'DROP TABLE IF EXISTS torrent_pieces;',
    'DROP TABLE IF EXISTS torrent_seeding;',
    'DROP TABLE IF EXISTS torrent_downloads;',
    'DROP TABLE IF EXISTS torrent_published;',
    'DROP TABLE IF EXISTS sync_expiring_entities;',
    'DROP TABLE IF EXISTS sync_security_confirmations;',
    'DROP TABLE IF EXISTS sync_security_preferences;',
    'DROP TABLE IF EXISTS sync_share_log;',
    'DROP TABLE IF EXISTS sync_relay_tokens;',
    'DROP TABLE IF EXISTS sync_session_module_stats;',
    'DROP TABLE IF EXISTS sync_transport_preferences;',
    'DROP TABLE IF EXISTS sync_conflict_queue;',
    'DROP TABLE IF EXISTS sync_receipts;',
    'DROP TABLE IF EXISTS sync_tombstones;',
    'DROP TABLE IF EXISTS sync_entity_acl;',
    'DROP TABLE IF EXISTS sync_workspace_keys;',
    'DROP TABLE IF EXISTS sync_workspace_members;',
    'DROP TABLE IF EXISTS sync_workspaces;',
    'DROP TABLE IF EXISTS sync_sessions;',
    'DROP TABLE IF EXISTS sync_blob_policy;',
    'DROP TABLE IF EXISTS sync_blobs;',
    'DROP TABLE IF EXISTS sync_device_revocations;',
    'DROP TABLE IF EXISTS sync_peer_module_state;',
    'DROP TABLE IF EXISTS sync_change_log;',
    'DROP TABLE IF EXISTS sync_paired_devices;',
    'DROP TABLE IF EXISTS sync_device_identity;',
  ],
};
