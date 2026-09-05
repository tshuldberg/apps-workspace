import { v4 as uuidv4 } from 'uuid';
import type { DatabaseAdapter } from '@mylife/db';
import { EventInputSchema, type EventInput, type EventRow } from '../../types';
import type { NormalizedEvent } from '../../sources/types';

export function createEvent(db: DatabaseAdapter, input: EventInput): string {
  const data = EventInputSchema.parse(input);
  const id = data.id ?? uuidv4();
  db.execute(
    `INSERT INTO mh_events
      (id, source_id, external_id, title, description, venue_name, address, lat, lng,
       neighborhood, start_at, end_at, all_day, category, purchase_url, ticket_provider,
       image_url, price_min, price_max, is_free, saved)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      data.sourceId,
      data.externalId ?? null,
      data.title,
      data.description ?? null,
      data.venueName ?? null,
      data.address ?? null,
      data.lat ?? null,
      data.lng ?? null,
      data.neighborhood ?? null,
      data.startAt ?? null,
      data.endAt ?? null,
      data.allDay ? 1 : 0,
      data.category ?? null,
      data.purchaseUrl ?? null,
      data.ticketProvider ?? null,
      data.imageUrl ?? null,
      data.priceMin ?? null,
      data.priceMax ?? null,
      data.isFree ? 1 : 0,
      data.saved ? 1 : 0,
    ],
  );
  return id;
}

export function getEvents(db: DatabaseAdapter): EventRow[] {
  return db.query<EventRow>(
    `SELECT * FROM mh_events WHERE deleted_at IS NULL ORDER BY start_at ASC`,
  );
}

export function getEventById(db: DatabaseAdapter, id: string): EventRow | null {
  const rows = db.query<EventRow>(
    `SELECT * FROM mh_events WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

export function setEventSaved(db: DatabaseAdapter, id: string, saved: boolean): void {
  db.execute(
    `UPDATE mh_events SET saved = ?, updated_at = datetime('now') WHERE id = ?`,
    [saved ? 1 : 0, id],
  );
}

export function softDeleteEvent(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE mh_events SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [id],
  );
}

/**
 * Insert a NormalizedEvent from an external source, or update the existing row
 * when a (source_id, external_id) match is found. Returns the event id.
 */
export function upsertExternalEvent(db: DatabaseAdapter, e: NormalizedEvent): string {
  if (e.externalId != null) {
    const existing = db.query<{ id: string }>(
      `SELECT id FROM mh_events WHERE source_id = ? AND external_id = ?`,
      [e.sourceId, e.externalId],
    );
    const found = existing[0];
    if (found) {
      db.execute(
        `UPDATE mh_events SET
           title = ?, description = ?, venue_name = ?, address = ?, lat = ?, lng = ?,
           neighborhood = ?, start_at = ?, end_at = ?, all_day = ?, category = ?,
           purchase_url = ?, ticket_provider = ?, image_url = ?, price_min = ?,
           price_max = ?, is_free = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          e.title,
          e.description ?? null,
          e.venueName ?? null,
          e.address ?? null,
          e.lat ?? null,
          e.lng ?? null,
          e.neighborhood ?? null,
          e.startAt ?? null,
          e.endAt ?? null,
          e.allDay ? 1 : 0,
          e.category ?? null,
          e.purchaseUrl ?? null,
          e.ticketProvider ?? null,
          e.imageUrl ?? null,
          e.priceMin ?? null,
          e.priceMax ?? null,
          e.isFree ? 1 : 0,
          found.id,
        ],
      );
      return found.id;
    }
  }
  const id = uuidv4();
  db.execute(
    `INSERT INTO mh_events
      (id, source_id, external_id, title, description, venue_name, address, lat, lng,
       neighborhood, start_at, end_at, all_day, category, purchase_url, ticket_provider,
       image_url, price_min, price_max, is_free, saved)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      e.sourceId,
      e.externalId ?? null,
      e.title,
      e.description ?? null,
      e.venueName ?? null,
      e.address ?? null,
      e.lat ?? null,
      e.lng ?? null,
      e.neighborhood ?? null,
      e.startAt ?? null,
      e.endAt ?? null,
      e.allDay ? 1 : 0,
      e.category ?? null,
      e.purchaseUrl ?? null,
      e.ticketProvider ?? null,
      e.imageUrl ?? null,
      e.priceMin ?? null,
      e.priceMax ?? null,
      e.isFree ? 1 : 0,
      0,
    ],
  );
  return id;
}
