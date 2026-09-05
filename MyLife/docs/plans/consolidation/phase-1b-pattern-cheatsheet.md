---
status: ACTIVE
date: 2026-04-19
phase: 1b-wave-a
parent: docs/plans/consolidation/phase-1b-handoff.md
---

# Phase 1b Pattern Cheat Sheet — Adapter Module Template

A precise how-to for implementation agents. Each adapter module (`shared/attachments/`, `shared/tags/`, `shared/places/`) follows this exact pattern.

---

## Directory Shape

```
packages/db/src/shared/<entity>/
├── types.ts              # Zod schemas + TS type inferences
├── operations.ts         # CRUD functions (async where platformOps involved, sync otherwise)
├── index.ts              # Barrel export
└── __tests__/
    └── operations.test.ts
```

**Key principle:** No internal helper files. All logic inline in `operations.ts`; helper functions declared below main exports at the file bottom.

---

## Minimal `types.ts` Skeleton

```typescript
import { z } from 'zod';

/**
 * Zod schema for <Entity>. Includes all DB-stored fields.
 * Non-nullable strings use z.string().datetime() for ISO timestamps;
 * regular strings use z.string().
 * Optional fields (nulls in DB) use .nullable() (not .optional()).
 */
export const AttachmentSchema = z.object({
  id: z.string(),
  uri: z.string(),
  mime: z.string(),
  sha256: z.string().nullable(),
  bytes: z.number().nullable(),
  thumbUri: z.string().nullable(),
  caption: z.string().nullable(),
  takenAt: z.string().nullable(),         // ISO 8601 or null
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  createdAt: z.string(),                  // ISO 8601, always present
  updatedAt: z.string(),                  // ISO 8601, always present
});

export type Attachment = z.infer<typeof AttachmentSchema>;

/**
 * Input schema for create operations. Omits id, createdAt, updatedAt.
 * Use .optional() for fields that are not required on input.
 */
export const CreateAttachmentInputSchema = z.object({
  uri: z.string(),
  mime: z.string(),
  sha256: z.string().optional(),
  bytes: z.number().optional(),
  thumbUri: z.string().optional(),
  caption: z.string().optional(),
  takenAt: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export type CreateAttachmentInput = z.infer<typeof CreateAttachmentInputSchema>;

// Similar for AttachmentLink, LinkAttachmentInput, etc.
```

**Naming convention:** `<Entity>Schema` for the full row, `Create<Entity>InputSchema` for input-only schemas. Datetimes are always `z.string()` (ISO-8601 serialized); they come from `datetime('now')` in SQL or `new Date().toISOString()` in JS.

---

## Minimal `operations.ts` Skeleton

```typescript
import { randomUUID } from 'crypto';
import type { DatabaseAdapter } from '../../adapter';
import { AttachmentSchema, type Attachment, type CreateAttachmentInput } from './types';

// ---------------------------------------------------------------------------
// Helper type (internal row matching DB columns)
// ---------------------------------------------------------------------------

interface AttachmentRow {
  id: string;
  uri: string;
  mime: string;
  sha256: string | null;
  bytes: number | null;
  thumb_uri: string | null;
  caption: string | null;
  taken_at: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
}

/** Convert DB row to TS type (snake_case -> camelCase). */
function rowToAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    uri: row.uri,
    mime: row.mime,
    sha256: row.sha256,
    bytes: row.bytes,
    thumbUri: row.thumb_uri,
    caption: row.caption,
    takenAt: row.taken_at,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a new attachment record.
 * Auto-generates ID and timestamps via SQL defaults.
 * Returns the full Attachment with all metadata.
 */
export function createAttachment(
  db: DatabaseAdapter,
  input: CreateAttachmentInput,
): Attachment {
  const id = randomUUID();
  
  db.execute(
    `INSERT INTO hub_attachments (
       id, uri, mime, sha256, bytes, thumb_uri, caption, taken_at, lat, lng
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.uri,
      input.mime,
      input.sha256 ?? null,
      input.bytes ?? null,
      input.thumbUri ?? null,
      input.caption ?? null,
      input.takenAt ?? null,
      input.lat ?? null,
      input.lng ?? null,
    ],
  );

  // Re-query to get computed timestamps and validate
  const rows = db.query<AttachmentRow>(
    `SELECT * FROM hub_attachments WHERE id = ?`,
    [id],
  );
  
  if (rows.length === 0) throw new Error(`Failed to create attachment ${id}`);
  return rowToAttachment(rows[0]!);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function getAttachment(
  db: DatabaseAdapter,
  id: string,
): Attachment | null {
  const rows = db.query<AttachmentRow>(
    `SELECT * FROM hub_attachments WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToAttachment(rows[0]!) : null;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete attachment and all its links (CASCADE handles via FK).
 */
export function deleteAttachment(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM hub_attachments WHERE id = ?`, [id]);
}

// Note: No update() exported for attachments per spec.
```

**Key patterns:**
- Use `randomUUID()` from Node's `crypto` module for IDs
- All operations are **sync** (no async unless `platformOps` argument present like in `backup/`)
- SQL uses prepared statements with `?` placeholders; never string interpolation
- `datetime('now')` is invoked **in SQL** via DEFAULT, not in JS
- Return types are always re-queried by ID to ensure computed defaults are captured
- No validation with `.parse()` at function start; callers are responsible for input shape

---

## Minimal `__tests__/operations.test.ts` Skeleton

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHubTestDatabase } from '../../test-utils';
import type { InMemoryTestDatabase } from '../../test-utils';
import {
  createAttachment,
  getAttachment,
  deleteAttachment,
  linkAttachment,
  getAttachmentsFor,
} from '../operations';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  // createHubTestDatabase() already:
  // - Creates an in-memory SQLite DB
  // - Sets PRAGMA foreign_keys = ON (CRITICAL for CASCADE tests)
  // - Calls createHubTables() to set up hub schema
  testDb = createHubTestDatabase();
});

afterEach(() => {
  testDb.close();
});

describe('Attachment CRUD', () => {
  it('creates an attachment with auto-generated ID and timestamps', () => {
    const result = createAttachment(testDb.adapter, {
      uri: 'file:///photos/test.jpg',
      mime: 'image/jpeg',
    });

    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/); // UUID v4 format
    expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
    expect(result.uri).toBe('file:///photos/test.jpg');
  });

  it('retrieves an attachment by ID', () => {
    const created = createAttachment(testDb.adapter, {
      uri: 'file:///photos/test.jpg',
      mime: 'image/jpeg',
      caption: 'Test photo',
    });

    const fetched = getAttachment(testDb.adapter, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.caption).toBe('Test photo');
  });

  it('deletes attachment and cascades to links (FK test)', () => {
    const att = createAttachment(testDb.adapter, {
      uri: 'file:///test.jpg',
      mime: 'image/jpeg',
    });
    
    // Assuming linkAttachment() is implemented
    linkAttachment(testDb.adapter, {
      attachmentId: att.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-123',
    });

    // Delete attachment
    deleteAttachment(testDb.adapter, att.id);

    // Verify attachment and links are gone
    expect(getAttachment(testDb.adapter, att.id)).toBeNull();
    
    const links = testDb.adapter.query<{ attachment_id: string }>(
      `SELECT * FROM hub_attachment_links WHERE attachment_id = ?`,
      [att.id],
    );
    expect(links.length).toBe(0); // FK CASCADE cleaned up
  });
});
```

**Test setup:**
- Use `createHubTestDatabase()` from `../test-utils` — it sets `PRAGMA foreign_keys = ON` automatically
- Always verify FK CASCADE behavior if the table has FKs
- Use Vitest `describe/it/expect` (already in repo)
- No need for special DB init; the helper does `createHubTables()`

---

## Barrel Exports (`index.ts`)

```typescript
/**
 * Attachment system — unified photo/doc/voice store with polymorphic binding.
 */

// Types
export type {
  Attachment,
  CreateAttachmentInput,
  AttachmentLink,
  LinkAttachmentInput,
} from './types';

// Operations
export {
  createAttachment,
  getAttachment,
  deleteAttachment,
  linkAttachment,
  unlinkAttachment,
  getAttachmentsFor,
  getLinksForAttachment,
} from './operations';
```

Re-export types **and** operations (no schema constants needed unless encoding-critical).

The parent `packages/db/src/shared/index.ts` then aggregates:

```typescript
// Attachments
export type { Attachment, AttachmentLink, CreateAttachmentInput, LinkAttachmentInput } from './attachments';
export { createAttachment, getAttachment, deleteAttachment, linkAttachment, unlinkAttachment, getAttachmentsFor, getLinksForAttachment } from './attachments';

// Tags
export type { Tag, TagBinding, CreateTagInput, BindTagInput } from './tags';
export { createTag, getOrCreateTag, getTagById, searchTags, bindTag, unbindTag, getTagsFor, getEntitiesForTag } from './tags';

// Places
export type { Place, GpsTrack, CreatePlaceInput, CreateGpsTrackInput } from './places';
export { createPlace, getPlace, findNearbyPlaces, updatePlace, deletePlace, createGpsTrack, getGpsTrack, getGpsTracksFor } from './places';
```

The main `packages/db/src/index.ts` re-exports the shared barrel:

```typescript
export type {
  Attachment, AttachmentLink, CreateAttachmentInput, LinkAttachmentInput,
  Tag, TagBinding, CreateTagInput, BindTagInput,
  Place, GpsTrack, CreatePlaceInput, CreateGpsTrackInput,
} from './shared';
export {
  createAttachment, getAttachment, deleteAttachment, linkAttachment, unlinkAttachment, getAttachmentsFor, getLinksForAttachment,
  createTag, getOrCreateTag, getTagById, searchTags, bindTag, unbindTag, getTagsFor, getEntitiesForTag,
  createPlace, getPlace, findNearbyPlaces, updatePlace, deletePlace, createGpsTrack, getGpsTrack, getGpsTracksFor,
} from './shared';
```

(No new package.json export entry needed; the existing main entry point covers it.)

---

## Dependencies & Built-ins

**In `packages/db/package.json`:**
- `zod` ✓ already listed (`^3.24.0`)
- `crypto` — use Node's built-in `crypto.randomUUID()`; import as `import { randomUUID } from 'crypto'`
- No new npm packages required for attachments, tags, or backup patterns

**For places geohash computation:**
- **Recommendation:** Vendor a ~40-line geohash encode function inline in `packages/db/src/shared/places/helpers.ts` rather than add an npm dep
  - Geohashing is simple (bit-interleave lat/lng into a base-32 string)
  - Avoids npm bloat; repo already avoids `ngeohash` / `geohash-js`
  - Justification: single, self-contained use case; no external maintenance burden

Example helper skeleton:
```typescript
/**
 * Encode lat/lng to a geohash (precision 8 = ~19m accuracy, typical for nearby queries).
 */
export function encodeGeohash(lat: number, lng: number, precision: number = 8): string {
  // Bit-interleave normalized lat/lng into base-32 string
  // (Implementation: ~40 lines, standard algorithm)
  // Return string like "u33dc1g8"
}
```

**vitest** ✓ already in devDeps (`^3.0.0`)

---

## Quick Checklist per Adapter

- [ ] `types.ts`: Full schema + input schema with Zod, matching export names
- [ ] `operations.ts`: CRUD functions, row converter, ID gen via `randomUUID()`, no `.parse()` calls
- [ ] Test setup: `beforeEach` uses `createHubTestDatabase()`; FK pragma verified in CASCADE tests
- [ ] `index.ts`: Barrel re-exports types and operations
- [ ] No schema constants exported unless critical (places might export geohash helpers)
- [ ] SQL always parameterized (`?` placeholders)
- [ ] Timestamps from `datetime('now')` in SQL, never JS `new Date().toISOString()`

