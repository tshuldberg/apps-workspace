import {
  getBreakthroughs,
  getProject,
  listMilestones,
  listProgressByProject,
  listProjects,
  type CreateProjectRecord,
  type CreateProjectSortBy,
  type CreateProjectStatus,
  type CreateProjectType,
} from '@mylife/create';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';

export interface CreateProjectsFilters {
  search?: string;
  status?: CreateProjectStatus;
  type?: CreateProjectType;
  sortBy?: CreateProjectSortBy;
}

function countDueSoon(projects: CreateProjectRecord[]): number {
  const today = new Date();
  const horizon = new Date();
  horizon.setDate(today.getDate() + 14);

  return projects.filter((project) => {
    if (!project.deadline) return false;
    if (project.status === 'complete' || project.status === 'archived') {
      return false;
    }
    const due = new Date(project.deadline);
    return due >= today && due <= horizon;
  }).length;
}

export function getCreateDb() {
  const db = getAdapter();
  ensureModuleMigrations('create');
  return db;
}

export function loadCreateProjectsView(filters?: CreateProjectsFilters) {
  const db = getCreateDb();
  const rows = listProjects(db, {
    search: filters?.search,
    status: filters?.status,
    type: filters?.type,
    sort_by: filters?.sortBy ?? 'updated_at',
    limit: 200,
  });
  const allRows = listProjects(db, { sort_by: 'updated_at', limit: 500 });

  return {
    rows,
    stats: {
      total: allRows.length,
      active: allRows.filter(
        (project) =>
          project.status !== 'complete' && project.status !== 'archived',
      ).length,
      dueSoon: countDueSoon(allRows),
      complete: allRows.filter((project) => project.status === 'complete')
        .length,
    },
  };
}

export function loadCreateProjectDetail(id: string) {
  const db = getCreateDb();
  const project = getProject(db, id);
  if (!project) return null;

  return {
    project,
    progress: listProgressByProject(db, id),
    milestones: listMilestones(db, id),
    breakthroughs: getBreakthroughs(db, id),
  };
}
