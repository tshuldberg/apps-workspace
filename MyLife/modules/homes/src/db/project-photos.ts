import type { DatabaseAdapter } from '@mylife/db';
import type { ProjectPhoto, PhotoType } from '../types';

function rowToProjectPhoto(row: Record<string, unknown>): ProjectPhoto {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    phaseId: (row.phase_id as string) ?? null,
    photoUri: row.photo_uri as string,
    caption: (row.caption as string) ?? null,
    photoType: row.photo_type as PhotoType,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

export function createProjectPhoto(
  db: DatabaseAdapter,
  id: string,
  input: {
    projectId: string;
    phaseId?: string;
    photoUri: string;
    caption?: string;
    photoType?: PhotoType;
    sortOrder?: number;
  },
): ProjectPhoto {
  const now = new Date().toISOString();
  const photoType = input.photoType ?? 'during';
  const sortOrder = input.sortOrder ?? 0;

  db.execute(
    `INSERT INTO hm_project_photos (
      id, project_id, phase_id, photo_uri, caption,
      photo_type, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.projectId,
      input.phaseId ?? null,
      input.photoUri,
      input.caption ?? null,
      photoType,
      sortOrder,
      now,
    ],
  );

  return {
    id,
    projectId: input.projectId,
    phaseId: input.phaseId ?? null,
    photoUri: input.photoUri,
    caption: input.caption ?? null,
    photoType,
    sortOrder,
    createdAt: now,
  };
}

export function getPhotosForProject(
  db: DatabaseAdapter,
  projectId: string,
): ProjectPhoto[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_project_photos WHERE project_id = ? ORDER BY sort_order ASC LIMIT 500',
      [projectId],
    )
    .map(rowToProjectPhoto);
}

export function getPhotosForPhase(
  db: DatabaseAdapter,
  phaseId: string,
): ProjectPhoto[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_project_photos WHERE phase_id = ? ORDER BY sort_order ASC LIMIT 500',
      [phaseId],
    )
    .map(rowToProjectPhoto);
}

export function deleteProjectPhoto(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_project_photos WHERE id = ?', [id]);
}
