export type CreateProjectType =
  | 'art'
  | 'music'
  | 'video'
  | 'writing'
  | 'code'
  | 'craft'
  | 'photo'
  | 'design'
  | 'game_dev'
  | 'other';

export type CreateProjectStatus =
  | 'idea'
  | 'planning'
  | 'in_progress'
  | 'revising'
  | 'complete'
  | 'archived';

export interface CreateProjectSummary {
  id: string;
  title: string;
  type: CreateProjectType;
  status: CreateProjectStatus;
  updatedAt: string;
}

export type CreateSkillCategory =
  | 'visual'
  | 'audio'
  | 'writing'
  | 'code'
  | 'craft'
  | 'performance'
  | 'other';

export type CreateSkillProficiency =
  | 'beginner'
  | 'developing'
  | 'competent'
  | 'proficient'
  | 'expert';

export interface CreatePracticeSummary {
  date: string;
  medium: string;
  durationMinutes: number;
  flowState: boolean;
}

export interface CreateSkillSummary {
  id: string;
  name: string;
  category: CreateSkillCategory;
  proficiency: CreateSkillProficiency;
  hoursPracticed: number;
}

export interface CreatePortfolioPieceSummary {
  id: string;
  title: string;
  medium: string;
  yearCreated?: number | null;
  isShareable: boolean;
}
