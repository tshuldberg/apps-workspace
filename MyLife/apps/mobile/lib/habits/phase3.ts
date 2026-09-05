import {
  calculateBillableAmount,
  formatCurrency,
  generateCSV,
  generateTimeReport,
  type FocusSession,
  type Habit,
  type Project,
  type TimeReport,
  type TimedSession,
} from '@mylife/habits';

export type HabitsPhase3PeriodKey = 'today' | 'week' | 'month' | 'custom';

export type HabitsPhase3Range = {
  start: string;
  end: string;
  label: string;
};

export type FocusDayPoint = {
  date: string;
  label: string;
  totalSeconds: number;
};

export type FocusHourBucket = {
  hour: number;
  totalSeconds: number;
};

export type FocusSummary = {
  totalSeconds: number;
  sessionCount: number;
  completedCount: number;
  averageSeconds: number;
  longestSessionSeconds: number;
  bestDay: FocusDayPoint | null;
};

export type ProjectSummary = {
  project: Project;
  habit: Habit | null;
  color: string;
  totalSeconds: number;
  billableCents: number;
  entryCount: number;
  isActive: boolean;
  lastEntryAt: string | null;
};

export type TimeEntryView = {
  session: TimedSession;
  project: Project | null;
  habit: Habit | null;
  color: string;
  totalSeconds: number;
  amountLabel: string | null;
  startedAtLabel: string;
  durationLabel: string;
  isActive: boolean;
};

const PROJECT_FALLBACK_COLORS = [
  '#8B5CF6',
  '#A78BFA',
  '#FFD60A',
  '#30D158',
  '#FFB877',
  '#8BCFF0',
  '#FFB4AB',
  '#84CC16',
] as const;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function toDateKey(input: string | Date): string {
  if (input instanceof Date) {
    return input.toISOString().slice(0, 10);
  }

  return input.slice(0, 10);
}

function shiftDate(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function getPhase3Range(
  period: HabitsPhase3PeriodKey,
  now: Date = new Date(),
  custom?: Partial<HabitsPhase3Range>,
): HabitsPhase3Range {
  const end = toDateKey(now);

  if (period === 'custom' && custom?.start && custom.end) {
    return {
      start: custom.start,
      end: custom.end,
      label: 'Custom',
    };
  }

  if (period === 'today') {
    return { start: end, end, label: 'Today' };
  }

  if (period === 'month') {
    return {
      start: toDateKey(shiftDate(now, -29)),
      end,
      label: 'This Month',
    };
  }

  return {
    start: toDateKey(shiftDate(now, -6)),
    end,
    label: 'This Week',
  };
}

export function isDateInRange(iso: string, range: HabitsPhase3Range): boolean {
  const key = toDateKey(iso);
  return key >= range.start && key <= range.end;
}

export function getSessionDurationSeconds(session: TimedSession, now: number = Date.now()): number {
  if (session.durationSeconds > 0) {
    return session.durationSeconds;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(session.startedAt).getTime()) / 1000),
  );
  return elapsedSeconds;
}

export function getActiveTimedSession(sessions: TimedSession[]): TimedSession | null {
  return sessions.find((session) => session.durationSeconds === 0 && !session.completed) ?? null;
}

export function formatCompactDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours <= 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatStopwatch(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatTimerLabel(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function formatStartedAtLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function calculateFocusStreakDays(
  sessions: FocusSession[],
  now: Date = new Date(),
): number {
  const sessionDays = new Set(
    sessions
      .filter((session) => session.totalFocusSeconds > 0)
      .map((session) => toDateKey(session.startedAt)),
  );

  let streak = 0;
  let cursor = new Date(now);

  while (sessionDays.has(toDateKey(cursor))) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }

  return streak;
}

export function buildFocusDailySeries(
  sessions: FocusSession[],
  range: HabitsPhase3Range,
  now: Date = new Date(),
): FocusDayPoint[] {
  const startDate = new Date(`${range.start}T00:00:00`);
  const endDate = new Date(`${range.end}T00:00:00`);
  const totals = new Map<string, number>();

  for (const session of sessions) {
    if (!isDateInRange(session.startedAt, range)) {
      continue;
    }

    const key = toDateKey(session.startedAt);
    totals.set(key, (totals.get(key) ?? 0) + session.totalFocusSeconds);
  }

  const points: FocusDayPoint[] = [];
  for (let cursor = new Date(startDate); cursor <= endDate; cursor = shiftDate(cursor, 1)) {
    const date = toDateKey(cursor);
    points.push({
      date,
      label:
        range.label === 'This Month'
          ? `${cursor.getDate()}`
          : cursor.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1),
      totalSeconds: totals.get(date) ?? 0,
    });
  }

  if (points.length === 0) {
    points.push({
      date: toDateKey(now),
      label: 'T',
      totalSeconds: 0,
    });
  }

  return points;
}

export function buildFocusHourBuckets(
  sessions: FocusSession[],
  range: HabitsPhase3Range,
): FocusHourBucket[] {
  const totals = Array.from({ length: 24 }, () => 0);

  for (const session of sessions) {
    if (!isDateInRange(session.startedAt, range)) {
      continue;
    }

    const hour = new Date(session.startedAt).getHours();
    totals[hour] += session.totalFocusSeconds;
  }

  return totals.map((totalSeconds, hour) => ({ hour, totalSeconds }));
}

export function summarizeFocusSessions(
  sessions: FocusSession[],
  range: HabitsPhase3Range,
  now: Date = new Date(),
): FocusSummary {
  const filtered = sessions.filter((session) => isDateInRange(session.startedAt, range));
  const totalSeconds = filtered.reduce((sum, session) => sum + session.totalFocusSeconds, 0);
  const completedCount = filtered.filter((session) => session.status === 'completed').length;
  const longestSessionSeconds = filtered.reduce(
    (best, session) => Math.max(best, session.totalFocusSeconds),
    0,
  );
  const points = buildFocusDailySeries(filtered, range, now);
  const bestDay = points.reduce<FocusDayPoint | null>((best, point) => {
    if (best == null || point.totalSeconds > best.totalSeconds) {
      return point;
    }
    return best;
  }, null);

  return {
    totalSeconds,
    sessionCount: filtered.length,
    completedCount,
    averageSeconds: filtered.length > 0 ? Math.round(totalSeconds / filtered.length) : 0,
    longestSessionSeconds,
    bestDay,
  };
}

export function resolveProjectColor(
  project: Project,
  habit: Habit | null,
  index: number,
): string {
  if (habit?.color) {
    return habit.color;
  }

  return PROJECT_FALLBACK_COLORS[index % PROJECT_FALLBACK_COLORS.length];
}

export function buildProjectSummaries(
  projects: Project[],
  habits: Habit[],
  sessions: TimedSession[],
  range: HabitsPhase3Range,
  now: number = Date.now(),
): ProjectSummary[] {
  const habitsById = new Map(habits.map((habit) => [habit.id, habit]));

  return projects
    .map((project, index) => {
      const habit = habitsById.get(project.habitId) ?? null;
      const projectSessions = sessions.filter(
        (session) => session.habitId === project.habitId && isDateInRange(session.startedAt, range),
      );
      const totalSeconds = projectSessions.reduce(
        (sum, session) => sum + getSessionDurationSeconds(session, now),
        0,
      );
      const billableCents = projectSessions.reduce(
        (sum, session) => sum + calculateBillableAmount(getSessionDurationSeconds(session, now), project.hourlyRate),
        0,
      );
      const active = projectSessions.some(
        (session) => session.durationSeconds === 0 && !session.completed,
      );

      return {
        project,
        habit,
        color: resolveProjectColor(project, habit, index),
        totalSeconds,
        billableCents,
        entryCount: projectSessions.length,
        isActive: active,
        lastEntryAt: projectSessions[0]?.startedAt ?? null,
      };
    })
    .sort((left, right) => right.totalSeconds - left.totalSeconds);
}

export function buildTimeEntries(
  projects: Project[],
  habits: Habit[],
  sessions: TimedSession[],
  range: HabitsPhase3Range,
  now: number = Date.now(),
): TimeEntryView[] {
  const projectsByHabit = new Map(projects.map((project) => [project.habitId, project]));
  const habitsById = new Map(habits.map((habit) => [habit.id, habit]));

  return sessions
    .filter((session) => isDateInRange(session.startedAt, range))
    .map((session) => {
      const project = projectsByHabit.get(session.habitId) ?? null;
      const habit = habitsById.get(session.habitId) ?? null;
      const totalSeconds = getSessionDurationSeconds(session, now);
      const billableCents =
        project != null ? calculateBillableAmount(totalSeconds, project.hourlyRate) : 0;

      return {
        session,
        project,
        habit,
        color: resolveProjectColor(project ?? {
          id: 'fallback',
          habitId: session.habitId,
          projectName: habit?.name ?? 'Unassigned',
          clientName: null,
          hourlyRate: 0,
          currency: 'USD',
          isActive: true,
          createdAt: '',
          updatedAt: '',
        }, habit, 0),
        totalSeconds,
        amountLabel:
          project != null && project.hourlyRate > 0
            ? formatCurrency(billableCents, project.currency)
            : null,
        startedAtLabel: formatStartedAtLabel(session.startedAt),
        durationLabel: formatStopwatch(totalSeconds),
        isActive: session.durationSeconds === 0 && !session.completed,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.session.startedAt).getTime() - new Date(left.session.startedAt).getTime(),
    );
}

export function buildTimeReportFromData(
  projects: Project[],
  sessions: TimedSession[],
  range: HabitsPhase3Range,
  now: number = Date.now(),
): TimeReport {
  return generateTimeReport(
    sessions.map((session) => ({
      habitId: session.habitId,
      startedAt: session.startedAt,
      durationSeconds: getSessionDurationSeconds(session, now),
    })),
    projects.map((project) => ({
      habitId: project.habitId,
      projectName: project.projectName,
      clientName: project.clientName,
      hourlyRateCents: project.hourlyRate,
      currency: project.currency,
    })),
    { start: range.start, end: range.end },
  );
}

export function buildTimeReportCsv(
  projects: Project[],
  sessions: TimedSession[],
  range: HabitsPhase3Range,
  now: number = Date.now(),
): string {
  return generateCSV(buildTimeReportFromData(projects, sessions, range, now));
}

function escapePdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function buildSimplePdfReport(title: string, lines: string[]): string {
  const safeLines = lines.slice(0, 42).map(escapePdfText);
  const titleLine = escapePdfText(title);
  const content = [
    'BT',
    '/F1 18 Tf',
    '50 772 Td',
    `(${titleLine}) Tj`,
    '0 -24 Td',
    '/F1 12 Tf',
    '14 TL',
    ...safeLines.map((line) => `(${line}) Tj T*`),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj',
    `4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}
