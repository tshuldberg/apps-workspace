import type { DatabaseAdapter } from '@mylife/db';
import { z } from 'zod';
import {
  CreateProjectInputSchema,
  CreateProjectRecordSchema,
  CreateProjectStatusSchema,
  ListCreateProjectsInputSchema,
  UpdateCreateProjectInputSchema,
  type CreateProjectInput,
  type CreateProjectRecord,
  type CreateProjectStatus,
  type ListCreateProjectsInput,
  type UpdateCreateProjectInput,
} from '../../models/schemas';
import {
  normalizeNullableText,
  parseStringArray,
  serializeStringArray,
} from './shared';

interface ProjectRow {
  id: string;
  title: string;
  type: string;
  description_md: string | null;
  status: string;
  priority: number | null;
  deadline: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  tools_used: string | null;
  collaborators: string | null;
  outcome_notes: string | null;
  published_url: string | null;
  satisfaction_rating: number | null;
  cover_photo_id: string | null;
  inspiration_refs: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const ProjectHoursSchema = z.number().finite().nonnegative();

function getDefaultSortDirection(
  sortBy: ListCreateProjectsInput['sort_by'],
): 'ASC' | 'DESC' {
  switch (sortBy) {
    case 'deadline':
    case 'title':
      return 'ASC';
    case 'priority':
    case 'created_at':
    case 'updated_at':
    default:
      return 'DESC';
  }
}

function withStatusDates(
  status: CreateProjectStatus,
  startedAt: string | null,
  completedAt: string | null,
  now: string,
): { startedAt: string | null; completedAt: string | null } {
  return {
    startedAt:
      status === 'in_progress' && startedAt == null ? now : startedAt,
    completedAt:
      status === 'complete' && completedAt == null ? now : completedAt,
  };
}

function deserializeProject(row: ProjectRow): CreateProjectRecord {
  return CreateProjectRecordSchema.parse({
    id: row.id,
    title: row.title,
    type: row.type,
    description_md: row.description_md,
    status: row.status,
    priority: row.priority ?? 0,
    deadline: row.deadline,
    estimated_hours: row.estimated_hours,
    actual_hours: row.actual_hours ?? 0,
    tools_used: parseStringArray(row.tools_used),
    collaborators: parseStringArray(row.collaborators),
    outcome_notes: row.outcome_notes,
    published_url: row.published_url,
    satisfaction_rating: row.satisfaction_rating,
    cover_photo_id: row.cover_photo_id,
    inspiration_refs: parseStringArray(row.inspiration_refs),
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

export function createProject(
  db: DatabaseAdapter,
  id: string,
  input: CreateProjectInput,
): CreateProjectRecord {
  const parsed = CreateProjectInputSchema.parse(input);
  const now = new Date().toISOString();
  const status = parsed.status ?? 'idea';
  const statusDates = withStatusDates(
    status,
    normalizeNullableText(parsed.started_at),
    normalizeNullableText(parsed.completed_at),
    now,
  );

  const project = CreateProjectRecordSchema.parse({
    id,
    title: parsed.title,
    type: parsed.type,
    description_md: normalizeNullableText(parsed.description_md),
    status,
    priority: parsed.priority ?? 0,
    deadline: normalizeNullableText(parsed.deadline),
    estimated_hours: parsed.estimated_hours ?? null,
    actual_hours: parsed.actual_hours ?? 0,
    tools_used: parsed.tools_used ?? [],
    collaborators: parsed.collaborators ?? [],
    outcome_notes: normalizeNullableText(parsed.outcome_notes),
    published_url: normalizeNullableText(parsed.published_url),
    satisfaction_rating: parsed.satisfaction_rating ?? null,
    cover_photo_id: normalizeNullableText(parsed.cover_photo_id),
    inspiration_refs: parsed.inspiration_refs ?? [],
    started_at: statusDates.startedAt,
    completed_at: statusDates.completedAt,
    created_at: now,
    updated_at: now,
  });

  db.execute(
    `INSERT INTO ct_projects (
      id, title, type, description_md, status, priority, deadline,
      estimated_hours, actual_hours, tools_used, collaborators, outcome_notes,
      published_url, satisfaction_rating, cover_photo_id, inspiration_refs,
      started_at, completed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project.id,
      project.title,
      project.type,
      project.description_md,
      project.status,
      project.priority,
      project.deadline,
      project.estimated_hours,
      project.actual_hours,
      serializeStringArray(project.tools_used),
      serializeStringArray(project.collaborators),
      project.outcome_notes,
      project.published_url,
      project.satisfaction_rating,
      project.cover_photo_id,
      serializeStringArray(project.inspiration_refs),
      project.started_at,
      project.completed_at,
      project.created_at,
      project.updated_at,
    ],
  );

  return project;
}

export function getProject(
  db: DatabaseAdapter,
  id: string,
): CreateProjectRecord | null {
  const rows = db.query<ProjectRow>(
    `SELECT * FROM ct_projects WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? deserializeProject(rows[0]) : null;
}

export function updateProject(
  db: DatabaseAdapter,
  id: string,
  updates: UpdateCreateProjectInput,
): CreateProjectRecord | null {
  const parsed = UpdateCreateProjectInputSchema.parse(updates);
  const existing = getProject(db, id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];
  const now = new Date().toISOString();

  if (parsed.title !== undefined) {
    fields.push('title = ?');
    values.push(parsed.title);
  }
  if (parsed.type !== undefined) {
    fields.push('type = ?');
    values.push(parsed.type);
  }
  if (parsed.description_md !== undefined) {
    fields.push('description_md = ?');
    values.push(normalizeNullableText(parsed.description_md));
  }
  if (parsed.status !== undefined) {
    fields.push('status = ?');
    values.push(parsed.status);
  }
  if (parsed.priority !== undefined) {
    fields.push('priority = ?');
    values.push(parsed.priority);
  }
  if (parsed.deadline !== undefined) {
    fields.push('deadline = ?');
    values.push(normalizeNullableText(parsed.deadline));
  }
  if (parsed.estimated_hours !== undefined) {
    fields.push('estimated_hours = ?');
    values.push(parsed.estimated_hours);
  }
  if (parsed.actual_hours !== undefined) {
    fields.push('actual_hours = ?');
    values.push(parsed.actual_hours);
  }
  if (parsed.tools_used !== undefined) {
    fields.push('tools_used = ?');
    values.push(serializeStringArray(parsed.tools_used));
  }
  if (parsed.collaborators !== undefined) {
    fields.push('collaborators = ?');
    values.push(serializeStringArray(parsed.collaborators));
  }
  if (parsed.outcome_notes !== undefined) {
    fields.push('outcome_notes = ?');
    values.push(normalizeNullableText(parsed.outcome_notes));
  }
  if (parsed.published_url !== undefined) {
    fields.push('published_url = ?');
    values.push(normalizeNullableText(parsed.published_url));
  }
  if (parsed.satisfaction_rating !== undefined) {
    fields.push('satisfaction_rating = ?');
    values.push(parsed.satisfaction_rating);
  }
  if (parsed.cover_photo_id !== undefined) {
    fields.push('cover_photo_id = ?');
    values.push(normalizeNullableText(parsed.cover_photo_id));
  }
  if (parsed.inspiration_refs !== undefined) {
    fields.push('inspiration_refs = ?');
    values.push(serializeStringArray(parsed.inspiration_refs));
  }
  if (parsed.started_at !== undefined) {
    fields.push('started_at = ?');
    values.push(normalizeNullableText(parsed.started_at));
  }
  if (parsed.completed_at !== undefined) {
    fields.push('completed_at = ?');
    values.push(normalizeNullableText(parsed.completed_at));
  }

  if (
    parsed.status === 'in_progress' &&
    existing.started_at == null &&
    parsed.started_at === undefined
  ) {
    fields.push('started_at = ?');
    values.push(now);
  }

  if (
    parsed.status === 'complete' &&
    existing.completed_at == null &&
    parsed.completed_at === undefined
  ) {
    fields.push('completed_at = ?');
    values.push(now);
  }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(now);

  db.execute(
    `UPDATE ct_projects SET ${fields.join(', ')} WHERE id = ?`,
    [...values, id],
  );

  return getProject(db, id);
}

export function deleteProject(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM ct_projects WHERE id = ?`, [id]);
}

export function listProjects(
  db: DatabaseAdapter,
  filters?: ListCreateProjectsInput,
): CreateProjectRecord[] {
  const parsed = ListCreateProjectsInputSchema.parse(filters ?? {});
  const where: string[] = [];
  const params: unknown[] = [];

  if (parsed.status) {
    where.push('p.status = ?');
    params.push(parsed.status);
  }

  if (parsed.type) {
    where.push('p.type = ?');
    params.push(parsed.type);
  }

  if (parsed.search) {
    where.push('LOWER(p.title) LIKE ?');
    params.push(`%${parsed.search.toLowerCase()}%`);
  }

  let sql = 'SELECT p.* FROM ct_projects p';
  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }

  const sortBy = parsed.sort_by ?? 'updated_at';
  const sortDir = parsed.sort_dir ?? getDefaultSortDirection(sortBy);

  if (sortBy === 'deadline') {
    sql += ` ORDER BY CASE WHEN p.deadline IS NULL THEN 1 ELSE 0 END ASC, p.deadline ${sortDir}, p.updated_at DESC`;
  } else if (sortBy === 'title') {
    sql += ` ORDER BY p.title COLLATE NOCASE ${sortDir}, p.updated_at DESC`;
  } else {
    sql += ` ORDER BY p.${sortBy} ${sortDir}, p.updated_at DESC`;
  }

  sql += ' LIMIT ?';
  params.push(parsed.limit ?? 200);

  if (parsed.offset !== undefined) {
    sql += ' OFFSET ?';
    params.push(parsed.offset);
  }

  return db.query<ProjectRow>(sql, params).map(deserializeProject);
}

export function updateProjectStatus(
  db: DatabaseAdapter,
  id: string,
  status: CreateProjectStatus,
): CreateProjectRecord | null {
  CreateProjectStatusSchema.parse(status);
  return updateProject(db, id, { status });
}

export function addProjectHours(
  db: DatabaseAdapter,
  id: string,
  hours: number,
): CreateProjectRecord | null {
  const parsed = ProjectHoursSchema.parse(hours);
  if (parsed === 0) return getProject(db, id);

  db.execute(
    `UPDATE ct_projects
     SET actual_hours = COALESCE(actual_hours, 0) + ?, updated_at = ?
     WHERE id = ?`,
    [parsed, new Date().toISOString(), id],
  );

  return getProject(db, id);
}

export function recalcProjectActualHours(
  db: DatabaseAdapter,
  projectId: string,
): number {
  const row = db.query<{ total: number | null }>(
    `SELECT COALESCE(SUM(hours_spent), 0) AS total
     FROM ct_progress_entries
     WHERE project_id = ?`,
    [projectId],
  )[0];
  const total = row?.total ?? 0;

  db.execute(
    `UPDATE ct_projects
     SET actual_hours = ?, updated_at = ?
     WHERE id = ?`,
    [total, new Date().toISOString(), projectId],
  );

  return total;
}
