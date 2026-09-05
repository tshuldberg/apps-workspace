import { v4 as uuidv4 } from 'uuid';
import type { DatabaseAdapter } from '@mylife/db';
import { FacetInputSchema, type FacetInput, type FacetRow, type FacetAxis } from '../../types';

export function addFacet(db: DatabaseAdapter, input: FacetInput): string {
  const data = FacetInputSchema.parse(input);
  const id = data.id ?? uuidv4();
  db.execute(
    `INSERT INTO mh_event_facets (id, event_id, axis, value) VALUES (?,?,?,?)`,
    [id, data.eventId, data.axis, data.value],
  );
  return id;
}

export function getFacets(db: DatabaseAdapter, eventId: string): FacetRow[] {
  return db.query<FacetRow>(
    `SELECT * FROM mh_event_facets WHERE event_id = ? ORDER BY axis ASC`,
    [eventId],
  );
}

export function getEventIdsByFacet(
  db: DatabaseAdapter,
  axis: FacetAxis,
  value: string,
): { event_id: string }[] {
  return db.query<{ event_id: string }>(
    `SELECT event_id FROM mh_event_facets WHERE axis = ? AND value = ?`,
    [axis, value],
  );
}

export function removeFacet(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM mh_event_facets WHERE id = ?`, [id]);
}

export function removeFacetsForEvent(db: DatabaseAdapter, eventId: string): void {
  db.execute(`DELETE FROM mh_event_facets WHERE event_id = ?`, [eventId]);
}
