import type { DatabaseAdapter } from '@mylife/db';
import type { Room, RoomType } from '../types';

function rowToRoom(row: Record<string, unknown>): Room {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    name: row.name as string,
    roomType: row.room_type as RoomType,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

export function createRoom(
  db: DatabaseAdapter,
  id: string,
  input: {
    propertyId: string;
    name: string;
    roomType?: RoomType;
    sortOrder?: number;
  },
): Room {
  const now = new Date().toISOString();
  const roomType = input.roomType ?? 'other';
  const sortOrder = input.sortOrder ?? 0;

  db.execute(
    `INSERT INTO hm_rooms (
      id, property_id, name, room_type, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.propertyId, input.name, roomType, sortOrder, now],
  );

  return {
    id,
    propertyId: input.propertyId,
    name: input.name,
    roomType,
    sortOrder,
    createdAt: now,
  };
}

export function getRoom(
  db: DatabaseAdapter,
  id: string,
): Room | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hm_rooms WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToRoom(rows[0]) : null;
}

export function getRoomsForProperty(
  db: DatabaseAdapter,
  propertyId: string,
): Room[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_rooms WHERE property_id = ? ORDER BY sort_order ASC LIMIT 200',
      [propertyId],
    )
    .map(rowToRoom);
}

export function updateRoom(
  db: DatabaseAdapter,
  id: string,
  input: Partial<{
    name: string;
    roomType: RoomType;
    sortOrder: number;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
  if (input.roomType !== undefined) { sets.push('room_type = ?'); params.push(input.roomType); }
  if (input.sortOrder !== undefined) { sets.push('sort_order = ?'); params.push(input.sortOrder); }

  if (sets.length === 0) return;

  params.push(id);

  db.execute(
    `UPDATE hm_rooms SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}

export function deleteRoom(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_rooms WHERE id = ?', [id]);
}
