/**
 * Notes bridge: pure DTO builders + tag-substrate helpers for attaching
 * markdown notes to Manhattan pins and plans.
 *
 * Notes live in MyNotes; Manhattan never owns a note table. Linkage is carried
 * entirely on the shared hub tag substrate (hub_tags / hub_tag_bindings) via the
 * @mylife/db tag helpers. A note is "attached" to a pin/plan by binding a stable
 * entity tag label (entityTagLabel) to the note in MyNotes.
 */

import {
  type DatabaseAdapter,
  getOrCreateTag,
  bindTag,
  unbindTag,
  getTagsFor,
} from '@mylife/db';
import type { PinRow, PlanRow } from '../types';

const MODULE_ID = 'manhattan';

export interface ManhattanEntityNoteContext {
  entityId: string;
  entityType: 'pin' | 'plan';
  entityTitle: string;
  subtitle: string | null;
  tags: string[];
}

function slug(value: string | null | undefined): string | null {
  if (!value) return null;
  const out = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return out.length > 0 ? out : null;
}

/**
 * Build the static context a Notes screen needs when creating a note tied to a
 * pin: id, display name, neighborhood subtitle, and a stable tag set
 * (['pin', pin.id] plus the slugged neighborhood when present).
 */
export function buildPinNoteContext(
  pin: Pick<PinRow, 'id' | 'name' | 'neighborhood'>,
): ManhattanEntityNoteContext {
  const tags: string[] = ['pin', pin.id];
  const hood = slug(pin.neighborhood);
  if (hood) tags.push(hood);
  return {
    entityId: pin.id,
    entityType: 'pin',
    entityTitle: pin.name,
    subtitle: pin.neighborhood ?? null,
    tags,
  };
}

/**
 * Build the static context a Notes screen needs when creating a note tied to a
 * plan: id, title, start-date subtitle, and a stable tag set (['plan', plan.id]
 * plus the YYYY-MM-DD date slice of start_at when present).
 */
export function buildPlanNoteContext(
  plan: Pick<PlanRow, 'id' | 'title' | 'start_at'>,
): ManhattanEntityNoteContext {
  const tags: string[] = ['plan', plan.id];
  const day = plan.start_at ? plan.start_at.slice(0, 10) : null;
  if (day) tags.push(day);
  return {
    entityId: plan.id,
    entityType: 'plan',
    entityTitle: plan.title,
    subtitle: day,
    tags,
  };
}

/**
 * Stable label that links a note to a specific Manhattan entity, e.g.
 * 'mh-pin:<id>' / 'mh-plan:<id>'. Used as the canonical attachment tag.
 */
export function entityTagLabel(entityType: 'pin' | 'plan', id: string): string {
  return `mh-${entityType}:${id}`;
}

/**
 * Bind a set of tag labels to a Manhattan entity. getOrCreateTag + bindTag for
 * each (moduleId 'manhattan'). Idempotent per label. Returns the bound labels.
 */
export function setEntityTags(
  db: DatabaseAdapter,
  entityType: 'pin' | 'plan',
  entityId: string,
  labels: string[],
): string[] {
  const bound: string[] = [];
  for (const label of labels) {
    const tag = getOrCreateTag(db, label);
    bindTag(db, {
      tagId: tag.id,
      moduleId: MODULE_ID,
      entityType,
      entityId,
    });
    bound.push(tag.label);
  }
  return bound;
}

/** List the tag labels bound to a Manhattan entity, sorted alphabetically. */
export function getEntityTags(
  db: DatabaseAdapter,
  entityType: 'pin' | 'plan',
  entityId: string,
): string[] {
  return getTagsFor(db, { moduleId: MODULE_ID, entityType, entityId })
    .map((t) => t.label)
    .sort();
}

/**
 * Remove a single tag binding from a Manhattan entity. Idempotent. Uses
 * getOrCreateTag to resolve the tag id, so removing a never-seen label can
 * leave an orphan hub_tags row with no bindings; this is harmless (the shared
 * tag vocabulary tolerates unused labels) and never happens via the normal UI,
 * which only removes labels already shown as bound.
 */
export function removeEntityTag(
  db: DatabaseAdapter,
  entityType: 'pin' | 'plan',
  entityId: string,
  label: string,
): void {
  const tag = getOrCreateTag(db, label);
  unbindTag(db, {
    tagId: tag.id,
    moduleId: MODULE_ID,
    entityType,
    entityId,
  });
}
