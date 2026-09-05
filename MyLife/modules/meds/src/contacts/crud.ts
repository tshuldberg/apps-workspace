import type { DatabaseAdapter } from '@mylife/db';
import type { Contact, CreateContactInput, ContactType } from '../models/contact';

function rowToContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as ContactType,
    specialty: (row.specialty as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    address: (row.address as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createContact(
  db: DatabaseAdapter,
  id: string,
  input: CreateContactInput,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO md_contacts
      (id, name, type, specialty, phone, email, address, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.type ?? 'doctor',
      input.specialty ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.address ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );
}

export function getContacts(
  db: DatabaseAdapter,
  opts?: { type?: ContactType; limit?: number },
): Contact[] {
  const limit = opts?.limit ?? 500;

  if (opts?.type) {
    return db
      .query<Record<string, unknown>>(
        'SELECT * FROM md_contacts WHERE type = ? ORDER BY name ASC LIMIT ?',
        [opts.type, limit],
      )
      .map(rowToContact);
  }

  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM md_contacts ORDER BY type ASC, name ASC LIMIT ?',
      [limit],
    )
    .map(rowToContact);
}

export function getContactById(db: DatabaseAdapter, id: string): Contact | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM md_contacts WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToContact(rows[0]) : null;
}

export function updateContact(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<CreateContactInput>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push('name = ?');
    params.push(updates.name);
  }
  if (updates.type !== undefined) {
    sets.push('type = ?');
    params.push(updates.type);
  }
  if (updates.specialty !== undefined) {
    sets.push('specialty = ?');
    params.push(updates.specialty || null);
  }
  if (updates.phone !== undefined) {
    sets.push('phone = ?');
    params.push(updates.phone || null);
  }
  if (updates.email !== undefined) {
    sets.push('email = ?');
    params.push(updates.email || null);
  }
  if (updates.address !== undefined) {
    sets.push('address = ?');
    params.push(updates.address || null);
  }
  if (updates.notes !== undefined) {
    sets.push('notes = ?');
    params.push(updates.notes || null);
  }

  if (sets.length === 0) {
    return;
  }

  sets.push('updated_at = ?');
  params.push(new Date().toISOString(), id);
  db.execute(`UPDATE md_contacts SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteContact(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM md_contacts WHERE id = ?', [id]);
}
