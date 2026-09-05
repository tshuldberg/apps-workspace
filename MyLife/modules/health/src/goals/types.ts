export type GoalDomain =
  | 'fasting'
  | 'weight'
  | 'steps'
  | 'sleep'
  | 'adherence'
  | 'water'
  | 'vitals'
  | 'custom';

export type GoalPeriod = 'daily' | 'weekly' | 'monthly';
export type GoalDirection = 'at_least' | 'at_most' | 'exactly';

export interface HealthGoal {
  id: string;
  domain: GoalDomain;
  metric: string;
  target_value: number;
  unit: string | null;
  period: GoalPeriod;
  direction: GoalDirection;
  label: string | null;
  is_active: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalInput {
  domain: GoalDomain;
  metric: string;
  target_value: number;
  unit?: string;
  period?: GoalPeriod;
  direction?: GoalDirection;
  label?: string;
  start_date?: string;
  end_date?: string;
}

export interface GoalProgress {
  id: string;
  goal_id: string;
  period_start: string;
  period_end: string;
  current_value: number;
  target_value: number;
  completed: number;
  created_at: string;
}
