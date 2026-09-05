import type { DatabaseAdapter } from '@mylife/db';
import {
  BUILT_IN_PROGRAMS,
  getCurrentDay,
  getProgramDayPlan,
  isProgramComplete,
  resolveDailyTarget,
  type ProgramDayPlanItem,
} from '../challenges/engine';
import type { EnrollmentStatus, Program } from '../types';
import { createHabit, getHabits } from './crud';

const HABITS_ACCENT = '#8B5CF6';

export interface CreateProgramInput {
  name: string;
  description?: string;
  durationDays: number;
  schedule: number[];
  difficulty: string;
  isBuiltIn?: boolean;
  icon?: string;
}

export interface CreateEnrollmentInput {
  programId: string;
  habitId: string;
  startDate: string;
}

export interface EnrolledProgram {
  programId: string;
  habitIds: string[];
  startDate: string;
  currentDay: number;
  status: EnrollmentStatus;
  elapsedPercent: number;
  completionRate: number;
  completedDays: number;
}

export interface ProgramProgressDay {
  day: number;
  target: number | null;
  completed: boolean;
  items: ProgramDayPlanItem[];
}

export interface ProgramProgress {
  programId: string;
  habitIds: string[];
  startDate: string;
  currentDay: number;
  totalDays: number;
  status: EnrollmentStatus;
  elapsedPercent: number;
  completionRate: number;
  completedDays: number;
  streak: number;
  todayTarget: number | null;
  days: ProgramProgressDay[];
}

interface ProgramRow {
  id: string;
  name: string;
  description: string | null;
  duration_days: number;
  schedule: string;
  difficulty: string;
  is_built_in: number;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

interface ProgramEnrollmentRow {
  id: string;
  program_id: string;
  habit_id: string;
  start_date: string;
  current_day: number;
  status: EnrollmentStatus;
  created_at: string;
  updated_at: string;
}

function rowToProgram(row: ProgramRow): Program {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationDays: row.duration_days,
    schedule: JSON.parse(row.schedule) as number[],
    difficulty: row.difficulty as Program['difficulty'],
    isBuiltIn: row.is_built_in === 1,
    icon: row.icon,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEnrollment(row: ProgramEnrollmentRow) {
  return {
    id: row.id,
    programId: row.program_id,
    habitId: row.habit_id,
    startDate: row.start_date,
    currentDay: row.current_day,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function syncBuiltInPrograms(db: DatabaseAdapter) {
  const now = new Date().toISOString();
  db.transaction(() => {
    for (const program of BUILT_IN_PROGRAMS) {
      db.execute(
        `INSERT OR IGNORE INTO hb_programs (id, name, description, duration_days, schedule, difficulty, is_built_in, icon, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        [
          program.id,
          program.name,
          program.description,
          program.durationDays,
          JSON.stringify(program.schedule),
          program.difficulty,
          program.icon,
          now,
          now,
        ],
      );
    }
  });
}

function getAllEnrollmentRows(
  db: DatabaseAdapter,
  opts?: { programId?: string; status?: EnrollmentStatus },
) {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts?.programId) {
    where.push('program_id = ?');
    params.push(opts.programId);
  }

  if (opts?.status) {
    where.push('status = ?');
    params.push(opts.status);
  }

  const clause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';

  return db.query<ProgramEnrollmentRow>(
    `SELECT * FROM hb_program_enrollments${clause} ORDER BY start_date ASC, created_at ASC`,
    params,
  ).map(mapEnrollment);
}

function collectProgramActivityDates(
  db: DatabaseAdapter,
  habitIds: string[],
  startDate: string,
): string[] {
  if (habitIds.length === 0) {
    return [];
  }

  const placeholders = habitIds.map(() => '?').join(', ');
  const params: unknown[] = [
    ...habitIds,
    startDate,
    ...habitIds,
    startDate,
    ...habitIds,
    startDate,
  ];

  const rows = db.query<{ day: string }>(
    `SELECT DISTINCT DATE(activity_at) as day
     FROM (
       SELECT completed_at as activity_at
       FROM hb_completions
       WHERE habit_id IN (${placeholders}) AND DATE(completed_at) >= ?
       UNION ALL
       SELECT measured_at as activity_at
       FROM hb_measurements
       WHERE habit_id IN (${placeholders}) AND DATE(measured_at) >= ?
       UNION ALL
       SELECT started_at as activity_at
       FROM hb_timed_sessions
       WHERE habit_id IN (${placeholders}) AND completed = 1 AND DATE(started_at) >= ?
     )
     ORDER BY day ASC`,
    params,
  );

  return rows.map((row) => row.day);
}

function getBuiltInProgram(programId: string) {
  return BUILT_IN_PROGRAMS.find((program) => program.id === programId) ?? null;
}

function getBlueprintItems(programId: string) {
  const builtIn = getBuiltInProgram(programId);

  if (builtIn) {
    return builtIn.habitBlueprints;
  }

  return [{
    key: 'core',
    name: 'Program Habit',
    icon: '✨',
    description: 'Core daily action for this challenge.',
    habitType: 'standard' as const,
    timeOfDay: 'anytime' as const,
    baseTarget: 1,
  }];
}

function hasEnrollmentForHabit(db: DatabaseAdapter, habitId: string) {
  const rows = db.query<{ total: number }>(
    'SELECT COUNT(*) as total FROM hb_program_enrollments WHERE habit_id = ?',
    [habitId],
  );
  return (rows[0]?.total ?? 0) > 0;
}

function buildProgramProgress(
  db: DatabaseAdapter,
  program: Program,
  enrollments: ReturnType<typeof mapEnrollment>[],
): ProgramProgress {
  const startDate = enrollments[0]?.startDate ?? todayKey();
  const habitIds = unique(enrollments.map((enrollment) => enrollment.habitId));
  const currentDay = getCurrentDay(startDate, todayKey());
  const totalDays = program.durationDays;
  const hasActive = enrollments.some((enrollment) => enrollment.status === 'active');
  const hasCompleted = enrollments.some((enrollment) => enrollment.status === 'completed');
  const derivedStatus: EnrollmentStatus = hasActive
    ? (isProgramComplete(currentDay, totalDays) ? 'completed' : 'active')
    : hasCompleted
      ? 'completed'
      : 'abandoned';
  const activityDates = new Set(collectProgramActivityDates(db, habitIds, startDate));
  const elapsedDays = Math.max(1, Math.min(totalDays, currentDay));

  let completedDays = 0;
  const days: ProgramProgressDay[] = [];

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(`${startDate}T00:00:00`);
    date.setDate(date.getDate() + day - 1);
    const dayKey = date.toISOString().slice(0, 10);
    const completed = activityDates.has(dayKey);
    if (completed && day <= elapsedDays) {
      completedDays += 1;
    }

    days.push({
      day,
      target: resolveDailyTarget(program.schedule, day),
      completed,
      items: getBuiltInProgram(program.id)
        ? getProgramDayPlan(getBuiltInProgram(program.id)!, day)
        : [],
    });
  }

  let streak = 0;
  for (let offset = elapsedDays; offset >= 1; offset -= 1) {
    const date = new Date(`${startDate}T00:00:00`);
    date.setDate(date.getDate() + offset - 1);
    const dayKey = date.toISOString().slice(0, 10);
    if (!activityDates.has(dayKey)) break;
    streak += 1;
  }

  return {
    programId: program.id,
    habitIds,
    startDate,
    currentDay,
    totalDays,
    status: derivedStatus,
    elapsedPercent: Math.min(100, Math.round((Math.min(totalDays, Math.max(0, currentDay - 1)) / totalDays) * 100)),
    completionRate: Math.round((completedDays / elapsedDays) * 100),
    completedDays,
    streak,
    todayTarget: resolveDailyTarget(program.schedule, Math.min(currentDay, totalDays)),
    days,
  };
}

export function createProgram(db: DatabaseAdapter, id: string, input: CreateProgramInput): void {
  db.execute(
    `INSERT INTO hb_programs (id, name, description, duration_days, schedule, difficulty, is_built_in, icon)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.description ?? null,
      input.durationDays,
      JSON.stringify(input.schedule),
      input.difficulty,
      input.isBuiltIn ? 1 : 0,
      input.icon ?? null,
    ],
  );
}

export function getProgramById(db: DatabaseAdapter, id: string) {
  syncBuiltInPrograms(db);
  const rows = db.query<ProgramRow>('SELECT * FROM hb_programs WHERE id = ?', [id]);
  return rows.length > 0 ? rowToProgram(rows[0]) : null;
}

export function getAllPrograms(db: DatabaseAdapter) {
  syncBuiltInPrograms(db);
  return db.query<ProgramRow>(
    'SELECT * FROM hb_programs ORDER BY is_built_in DESC, name ASC',
  ).map(rowToProgram);
}

export function getPrograms(db: DatabaseAdapter) {
  return getAllPrograms(db);
}

export function getBuiltInPrograms(db: DatabaseAdapter) {
  syncBuiltInPrograms(db);
  return db.query<ProgramRow>(
    'SELECT * FROM hb_programs WHERE is_built_in = 1 ORDER BY name ASC',
  ).map(rowToProgram);
}

export function deleteProgram(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_programs WHERE id = ?', [id]);
}

export function createEnrollment(db: DatabaseAdapter, id: string, input: CreateEnrollmentInput): void {
  db.execute(
    `INSERT INTO hb_program_enrollments (id, program_id, habit_id, start_date)
     VALUES (?, ?, ?, ?)`,
    [id, input.programId, input.habitId, input.startDate],
  );
}

export function getActiveEnrollment(db: DatabaseAdapter, habitId: string) {
  const rows = db.query<ProgramEnrollmentRow>(
    "SELECT * FROM hb_program_enrollments WHERE habit_id = ? AND status = 'active'",
    [habitId],
  );
  return rows.length > 0 ? mapEnrollment(rows[0]) : null;
}

export function getAllActiveEnrollments(db: DatabaseAdapter) {
  return getAllEnrollmentRows(db, { status: 'active' });
}

export function getEnrolledPrograms(db: DatabaseAdapter) {
  const programs = new Map(getPrograms(db).map((program) => [program.id, program]));
  const grouped = new Map<string, ReturnType<typeof mapEnrollment>[]>();

  for (const enrollment of getAllEnrollmentRows(db)) {
    const bucket = grouped.get(enrollment.programId) ?? [];
    bucket.push(enrollment);
    grouped.set(enrollment.programId, bucket);
  }

  return [...grouped.entries()]
    .map(([programId, enrollments]) => {
      const program = programs.get(programId);
      if (!program) return null;

      const progress = buildProgramProgress(db, program, enrollments);
      const summary: EnrolledProgram = {
        programId,
        habitIds: progress.habitIds,
        startDate: progress.startDate,
        currentDay: progress.currentDay,
        status: progress.status,
        elapsedPercent: progress.elapsedPercent,
        completionRate: progress.completionRate,
        completedDays: progress.completedDays,
      };

      return summary;
    })
    .filter((summary): summary is EnrolledProgram => summary != null)
    .sort((left, right) => {
      if (left.status === right.status) {
        return right.startDate.localeCompare(left.startDate);
      }
      if (left.status === 'active') return -1;
      if (right.status === 'active') return 1;
      if (left.status === 'completed') return -1;
      if (right.status === 'completed') return 1;
      return 0;
    });
}

export function enrollInProgram(db: DatabaseAdapter, programId: string) {
  const program = getProgramById(db, programId);
  if (!program) {
    throw new Error('Program not found.');
  }

  const existing = getEnrolledPrograms(db).find(
    (enrollment) => enrollment.programId === programId && enrollment.status === 'active',
  );
  if (existing) {
    return existing;
  }

  const startDate = todayKey();
  const blueprints = getBlueprintItems(programId);
  const habits = getHabits(db, { isArchived: false });

  db.transaction(() => {
    for (const blueprint of blueprints) {
      const reusable = habits.find(
        (habit) => habit.name.toLowerCase() === blueprint.name.toLowerCase()
          && !hasEnrollmentForHabit(db, habit.id),
      );

      const habitId = reusable?.id ?? crypto.randomUUID();

      if (!reusable) {
        createHabit(db, habitId, {
          name: blueprint.name,
          description: `${program.name}: ${blueprint.description}`,
          habitType: blueprint.habitType,
          timeOfDay: blueprint.timeOfDay,
          targetCount: blueprint.baseTarget,
          icon: blueprint.icon,
          color: HABITS_ACCENT,
        });
        habits.push(getHabits(db, { isArchived: false }).find((habit) => habit.id === habitId)!);
      }

      createEnrollment(db, crypto.randomUUID(), {
        programId,
        habitId,
        startDate,
      });
    }
  });

  return getEnrolledPrograms(db).find(
    (enrollment) => enrollment.programId === programId && enrollment.status === 'active',
  ) ?? null;
}

export function unenrollFromProgram(db: DatabaseAdapter, programId: string) {
  const active = getAllEnrollmentRows(db, { programId, status: 'active' });
  if (active.length === 0) {
    return;
  }

  db.transaction(() => {
    for (const enrollment of active) {
      updateEnrollmentStatus(db, enrollment.id, 'abandoned');
    }
  });
}

export function getProgramProgress(db: DatabaseAdapter, programId: string) {
  const program = getProgramById(db, programId);
  if (!program) {
    return null;
  }

  const enrollments = getAllEnrollmentRows(db, { programId });
  if (enrollments.length === 0) {
    return null;
  }

  return buildProgramProgress(db, program, enrollments);
}

export function updateEnrollmentStatus(db: DatabaseAdapter, id: string, status: EnrollmentStatus): void {
  const now = new Date().toISOString();
  db.execute(
    'UPDATE hb_program_enrollments SET status = ?, updated_at = ? WHERE id = ?',
    [status, now, id],
  );
}

export function deleteEnrollment(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_program_enrollments WHERE id = ?', [id]);
}
