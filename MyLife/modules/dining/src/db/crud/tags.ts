/**
 * Tag CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { CreateTagSchema } from '../../models/schemas';
import type { Tag, CreateTagInput, TagKind } from '../../models/schemas';

export function createTag(
  db: DatabaseAdapter,
  id: string,
  input: CreateTagInput,
): Tag {
  const parsed = CreateTagSchema.parse(input);
  const now = new Date().toISOString();

  const tag: Tag = {
    id,
    name: parsed.name,
    color: parsed.color ?? null,
    kind: parsed.kind,
    created_at: now,
  };

  db.execute(
    `INSERT INTO dn_tags (id, name, color, kind, created_at) VALUES (?, ?, ?, ?, ?)`,
    [tag.id, tag.name, tag.color, tag.kind, tag.created_at],
  );

  return tag;
}

export function listTags(
  db: DatabaseAdapter,
  kind?: TagKind,
): Tag[] {
  if (kind) {
    return db.query<Tag>(
      `SELECT id, name, color, kind, created_at FROM dn_tags WHERE kind = ? ORDER BY name`,
      [kind],
    );
  }
  return db.query<Tag>(
    `SELECT id, name, color, kind, created_at FROM dn_tags ORDER BY name`,
  );
}

export function addTagToRestaurant(
  db: DatabaseAdapter,
  restaurantId: string,
  tagId: string,
): void {
  db.execute(
    `INSERT OR IGNORE INTO dn_restaurant_tags (restaurant_id, tag_id) VALUES (?, ?)`,
    [restaurantId, tagId],
  );
}

export function removeTagFromRestaurant(
  db: DatabaseAdapter,
  restaurantId: string,
  tagId: string,
): void {
  db.execute(
    `DELETE FROM dn_restaurant_tags WHERE restaurant_id = ? AND tag_id = ?`,
    [restaurantId, tagId],
  );
}

export function getTagsForRestaurant(
  db: DatabaseAdapter,
  restaurantId: string,
): Tag[] {
  return db.query<Tag>(
    `SELECT t.id, t.name, t.color, t.kind, t.created_at
     FROM dn_tags t
     INNER JOIN dn_restaurant_tags rt ON t.id = rt.tag_id
     WHERE rt.restaurant_id = ?
     ORDER BY t.name`,
    [restaurantId],
  );
}
