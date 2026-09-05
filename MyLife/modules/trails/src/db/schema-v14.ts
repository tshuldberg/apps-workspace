// ── V14: hub_places shadow pointer ────────────────────────────────────
//
// Adds a nullable TEXT column on tr_trails that stores the id of the
// corresponding row in hub_places (the Phase 1a canonical place store).
// Shadow-writes populate this column inside the same transaction that
// inserts/updates the local tr_trails row. NULL on pre-migration rows is
// acceptable; a later backfill migration will populate them.

export const ADD_HUB_PLACE_ID_V14 = [
  `ALTER TABLE tr_trails ADD COLUMN hub_place_id TEXT`,
];

export const V14_INDEXES: string[] = [];
