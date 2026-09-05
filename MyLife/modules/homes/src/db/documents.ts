import type { DatabaseAdapter } from '@mylife/db';
import type { HomeDocument, DocCategory, FileType } from '../types';

function rowToDocument(row: Record<string, unknown>): HomeDocument {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    title: row.title as string,
    category: row.category as DocCategory,
    fileUri: row.file_uri as string,
    fileType: row.file_type as FileType,
    fileSizeBytes: row.file_size_bytes as number,
    expiryDate: (row.expiry_date as string) ?? null,
    notes: (row.notes as string) ?? null,
    tags: (row.tags as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createDocument(
  db: DatabaseAdapter,
  id: string,
  input: {
    propertyId: string;
    title: string;
    category: DocCategory;
    fileUri: string;
    fileType: FileType;
    fileSizeBytes: number;
    expiryDate?: string;
    notes?: string;
    tags?: string;
  },
): HomeDocument {
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO hm_documents (
      id, property_id, title, category, file_uri, file_type,
      file_size_bytes, expiry_date, notes, tags,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.propertyId,
      input.title,
      input.category,
      input.fileUri,
      input.fileType,
      input.fileSizeBytes,
      input.expiryDate ?? null,
      input.notes ?? null,
      input.tags ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    propertyId: input.propertyId,
    title: input.title,
    category: input.category,
    fileUri: input.fileUri,
    fileType: input.fileType,
    fileSizeBytes: input.fileSizeBytes,
    expiryDate: input.expiryDate ?? null,
    notes: input.notes ?? null,
    tags: input.tags ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getDocument(
  db: DatabaseAdapter,
  id: string,
): HomeDocument | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hm_documents WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToDocument(rows[0]) : null;
}

export function getDocumentsForProperty(
  db: DatabaseAdapter,
  propertyId: string,
  options?: { category?: DocCategory },
): HomeDocument[] {
  const conditions = ['property_id = ?'];
  const params: unknown[] = [propertyId];

  if (options?.category) {
    conditions.push('category = ?');
    params.push(options.category);
  }

  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM hm_documents WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 500`,
      params,
    )
    .map(rowToDocument);
}

export function updateDocument(
  db: DatabaseAdapter,
  id: string,
  input: Partial<{
    title: string;
    category: DocCategory;
    fileUri: string;
    fileType: FileType;
    fileSizeBytes: number;
    expiryDate: string | null;
    notes: string | null;
    tags: string | null;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title); }
  if (input.category !== undefined) { sets.push('category = ?'); params.push(input.category); }
  if (input.fileUri !== undefined) { sets.push('file_uri = ?'); params.push(input.fileUri); }
  if (input.fileType !== undefined) { sets.push('file_type = ?'); params.push(input.fileType); }
  if (input.fileSizeBytes !== undefined) { sets.push('file_size_bytes = ?'); params.push(input.fileSizeBytes); }
  if (input.expiryDate !== undefined) { sets.push('expiry_date = ?'); params.push(input.expiryDate); }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes); }
  if (input.tags !== undefined) { sets.push('tags = ?'); params.push(input.tags); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(
    `UPDATE hm_documents SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}

export function deleteDocument(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_documents WHERE id = ?', [id]);
}
