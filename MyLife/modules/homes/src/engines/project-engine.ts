import type { Project, ProjectPhase } from '../types';

export interface ProjectSummary {
  totalPhases: number;
  completedPhases: number;
  progressPercent: number;
  budgetCents: number;
  actualCostCents: number;
  isOverBudget: boolean;
}

export interface BudgetVsActual {
  budgetCents: number;
  actualCostCents: number;
  remainingCents: number;
  percentUsed: number;
}

export interface PhaseProgress {
  pending: number;
  inProgress: number;
  completed: number;
  skipped: number;
}

export function getProjectSummary(
  project: Project,
  phases: ProjectPhase[],
): ProjectSummary {
  const totalPhases = phases.length;
  const completedPhases = phases.filter((p) => p.status === 'completed').length;
  const progressPercent =
    totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

  return {
    totalPhases,
    completedPhases,
    progressPercent,
    budgetCents: project.budgetCents,
    actualCostCents: project.actualCostCents,
    isOverBudget: project.actualCostCents > project.budgetCents,
  };
}

export function getBudgetVsActual(project: Project): BudgetVsActual {
  const remainingCents = project.budgetCents - project.actualCostCents;
  const percentUsed =
    project.budgetCents > 0
      ? Math.round((project.actualCostCents / project.budgetCents) * 100)
      : 0;

  return {
    budgetCents: project.budgetCents,
    actualCostCents: project.actualCostCents,
    remainingCents,
    percentUsed,
  };
}

export function getPhaseProgress(phases: ProjectPhase[]): PhaseProgress {
  let pending = 0;
  let inProgress = 0;
  let completed = 0;
  let skipped = 0;

  for (const phase of phases) {
    switch (phase.status) {
      case 'pending':
        pending++;
        break;
      case 'in_progress':
        inProgress++;
        break;
      case 'completed':
        completed++;
        break;
      case 'skipped':
        skipped++;
        break;
    }
  }

  return { pending, inProgress, completed, skipped };
}

export function getActiveProjectCount(projects: Project[]): number {
  return projects.filter(
    (p) => p.status === 'planning' || p.status === 'in_progress',
  ).length;
}
