'use server';

import { Buffer } from 'node:buffer';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  CreateProgressMoodSchema,
  CreateProjectTypeSchema,
  CreateProjectStatusSchema,
  createPhoto,
  createProgressEntry,
  createProject,
  deletePhoto,
  deleteProject,
  updateProject,
  updateProjectStatus,
  type CreateProgressEntryInput,
  type CreateProjectInput,
  type UpdateCreateProjectInput,
} from '@mylife/create';
import { getCreateDb } from './data';

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function readOptionalNumber(
  formData: FormData,
  key: string,
): number | undefined {
  const raw = readString(formData, key);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readBoolean(formData: FormData, key: string): boolean {
  return formData.get(key) !== null;
}

function normalizeProgressDateInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T12:00:00.000Z`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid progress date');
  }

  return parsed.toISOString();
}

function readCreateProgressPayload(
  formData: FormData,
  photoIds: string[],
): CreateProgressEntryInput {
  const projectId = readString(formData, 'project_id');
  if (!projectId) throw new Error('Missing project id');

  const milestone = readBoolean(formData, 'milestone');
  const milestoneName = readString(formData, 'milestone_name');
  const mood = readString(formData, 'mood');
  const notes = readString(formData, 'notes_md');
  const roadblock = readString(formData, 'roadblock');
  const breakthrough = readString(formData, 'breakthrough');
  const hoursSpent = readOptionalNumber(formData, 'hours_spent');

  if (hoursSpent === undefined) {
    throw new Error('Hours spent is required');
  }
  if (milestone && !milestoneName) {
    throw new Error('Milestone name is required when the milestone toggle is on');
  }

  return {
    project_id: projectId,
    date: normalizeProgressDateInput(readString(formData, 'date')),
    notes_md: notes || undefined,
    hours_spent: hoursSpent,
    mood: mood ? CreateProgressMoodSchema.parse(mood) : undefined,
    milestone,
    milestone_name: milestone ? milestoneName : undefined,
    roadblock: roadblock || undefined,
    breakthrough: breakthrough || undefined,
    photo_ids: photoIds,
  };
}

function readCreateProjectPayload(formData: FormData): CreateProjectInput {
  const description = readString(formData, 'description_md');
  const deadline = readString(formData, 'deadline');
  const estimatedHours = readOptionalNumber(formData, 'estimated_hours');
  const publishedUrl = readString(formData, 'published_url');
  const coverPhotoId = readString(formData, 'cover_photo_id');
  const outcomeNotes = readString(formData, 'outcome_notes');

  return {
    title: readString(formData, 'title'),
    type: CreateProjectTypeSchema.parse(readString(formData, 'type')),
    status: CreateProjectStatusSchema.parse(readString(formData, 'status')),
    description_md: description || undefined,
    priority: readOptionalNumber(formData, 'priority') ?? 0,
    deadline: deadline || undefined,
    estimated_hours: estimatedHours,
    tools_used: splitList(readString(formData, 'tools_used')),
    collaborators: splitList(readString(formData, 'collaborators')),
    published_url: publishedUrl || undefined,
    inspiration_refs: splitList(readString(formData, 'inspiration_refs')),
    cover_photo_id: coverPhotoId || undefined,
    outcome_notes: outcomeNotes || undefined,
  };
}

function readUpdateProjectPayload(formData: FormData): UpdateCreateProjectInput {
  const description = readString(formData, 'description_md');
  const deadline = readString(formData, 'deadline');
  const estimatedHours = readOptionalNumber(formData, 'estimated_hours');
  const publishedUrl = readString(formData, 'published_url');
  const coverPhotoId = readString(formData, 'cover_photo_id');
  const outcomeNotes = readString(formData, 'outcome_notes');

  return {
    title: readString(formData, 'title'),
    type: CreateProjectTypeSchema.parse(readString(formData, 'type')),
    status: CreateProjectStatusSchema.parse(readString(formData, 'status')),
    description_md: description || null,
    priority: readOptionalNumber(formData, 'priority') ?? 0,
    deadline: deadline || null,
    estimated_hours: estimatedHours ?? null,
    tools_used: splitList(readString(formData, 'tools_used')),
    collaborators: splitList(readString(formData, 'collaborators')),
    published_url: publishedUrl || null,
    inspiration_refs: splitList(readString(formData, 'inspiration_refs')),
    cover_photo_id: coverPhotoId || null,
    outcome_notes: outcomeNotes || null,
  };
}

function createProjectId(): string {
  return `crt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createProgressId(): string {
  return `ctpr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createPhotoId(): string {
  return `ctph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function revalidateCreatePaths(id?: string) {
  revalidatePath('/create');
  if (!id) return;
  revalidatePath(`/create/project/${id}`);
  revalidatePath(`/create/project/${id}/edit`);
  revalidatePath(`/create/project/${id}/log`);
}

function isFileValue(value: FormDataEntryValue): value is File {
  return (
    typeof value !== 'string' &&
    typeof value.arrayBuffer === 'function' &&
    typeof value.size === 'number'
  );
}

async function toDataUrl(file: File): Promise<string> {
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  return `data:${file.type || 'image/jpeg'};base64,${base64}`;
}

async function persistProgressPhotos(
  db: ReturnType<typeof getCreateDb>,
  formData: FormData,
  projectId: string,
): Promise<string[]> {
  const files = formData.getAll('photos').filter(isFileValue).filter((file) => file.size > 0);
  const photoRefs = splitList(readString(formData, 'photo_refs'));
  const createdPhotoIds: string[] = [];
  const totalRequested = files.length + photoRefs.length;

  if (totalRequested > 6) {
    throw new Error('Progress logs support up to 6 photos');
  }

  for (const ref of photoRefs) {
    const id = createPhotoId();
    createPhoto(db, id, {
      project_id: projectId,
      kind: 'process',
      local_uri: ref,
    });
    createdPhotoIds.push(id);
  }

  for (const file of files) {
    if (file.type && !file.type.startsWith('image/')) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }
    if (file.size > 3 * 1024 * 1024) {
      throw new Error(`Photo "${file.name}" exceeds the 3 MB limit`);
    }

    const id = createPhotoId();
    createPhoto(db, id, {
      project_id: projectId,
      kind: 'process',
      local_uri: await toDataUrl(file),
      caption: file.name || undefined,
    });
    createdPhotoIds.push(id);
  }

  return createdPhotoIds;
}

export async function createProjectAction(formData: FormData) {
  const id = createProjectId();
  createProject(getCreateDb(), id, readCreateProjectPayload(formData));
  revalidateCreatePaths(id);
  redirect(`/create/project/${id}`);
}

export async function updateProjectAction(formData: FormData) {
  const id = readString(formData, 'id');
  if (!id) throw new Error('Missing project id');
  updateProject(getCreateDb(), id, readUpdateProjectPayload(formData));
  revalidateCreatePaths(id);
  redirect(`/create/project/${id}`);
}

export async function deleteProjectAction(formData: FormData) {
  const id = readString(formData, 'id');
  if (!id) throw new Error('Missing project id');
  deleteProject(getCreateDb(), id);
  revalidateCreatePaths();
  redirect('/create');
}

export async function updateProjectStatusAction(formData: FormData) {
  const id = readString(formData, 'id');
  if (!id) throw new Error('Missing project id');
  const status = CreateProjectStatusSchema.parse(readString(formData, 'status'));
  updateProjectStatus(getCreateDb(), id, status);
  revalidateCreatePaths(id);
}

export async function createProgressEntryAction(formData: FormData) {
  const projectId = readString(formData, 'project_id');
  if (!projectId) throw new Error('Missing project id');

  const db = getCreateDb();
  const createdPhotoIds: string[] = [];

  try {
    createdPhotoIds.push(...(await persistProgressPhotos(db, formData, projectId)));
    createProgressEntry(
      db,
      createProgressId(),
      readCreateProgressPayload(formData, createdPhotoIds),
    );
  } catch (error) {
    for (const id of createdPhotoIds) {
      deletePhoto(db, id);
    }
    throw error;
  }

  revalidateCreatePaths(projectId);
  redirect(`/create/project/${projectId}`);
}
