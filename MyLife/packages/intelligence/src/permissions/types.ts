/**
 * AI permission types and constants.
 *
 * Two-tier permission model:
 * 1. Per-module toggle (simple): canRead / canWrite per (userId, moduleId)
 * 2. Per-table granular (advanced): fine-grained canRead / canWrite per table
 *
 * Default: ALL modules OFF for every user. Users must explicitly opt in.
 *
 * Schema owned by `@mylife/db` (see `packages/db/src/hub-schema.ts`):
 *   hub_ai_permissions (user_id, module_id, can_read, can_write, granular_mode, updated_at)
 *   hub_ai_table_permissions (user_id, module_id, table_name, can_read, can_write, updated_at)
 */

import { z } from 'zod';

/**
 * Default user id for single-user local installs.
 * Multi-user / multi-device setups will pass explicit user ids; the default
 * keeps single-user callers (e.g. the query engine) backwards-compatible.
 */
export const DEFAULT_USER_ID = 'local';

/** Module-level AI permission record. */
export const AIPermissionSchema = z.object({
  userId: z.string().min(1),
  moduleId: z.string().min(1),
  canRead: z.boolean(),
  canWrite: z.boolean(),
  granularMode: z.boolean(),
  updatedAt: z.string().optional(),
});
export type AIPermission = z.infer<typeof AIPermissionSchema>;

/** Table-level AI permission record (only consulted when granularMode = true). */
export const AITablePermissionSchema = z.object({
  userId: z.string().min(1),
  moduleId: z.string().min(1),
  tableName: z.string().min(1),
  canRead: z.boolean(),
  canWrite: z.boolean(),
  updatedAt: z.string().optional(),
});
export type AITablePermission = z.infer<typeof AITablePermissionSchema>;

/** Capability mode for read/write-aware queries. */
export type PermissionMode = 'read' | 'write';
