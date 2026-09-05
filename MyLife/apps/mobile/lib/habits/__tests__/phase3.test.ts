import { describe, expect, it, vi } from 'vitest';
import type { FocusSession, Habit, Project, TimedSession } from '@mylife/habits';
import {
  buildFocusDailySeries,
  buildProjectSummaries,
  buildSimplePdfReport,
  buildTimeReportCsv,
  calculateFocusStreakDays,
  formatCompactDuration,
  formatStopwatch,
  getActiveTimedSession,
  getPhase3Range,
} from '../phase3';

vi.mock('@mylife/habits', () => ({
  calculateBillableAmount: (durationSeconds: number, hourlyRateCents: number) =>
    Math.round((durationSeconds / 3600) * hourlyRateCents),
  formatCurrency: (amountCents: number, currency: string) => {
    const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
    return `${symbol}${(amountCents / 100).toFixed(2)}`;
  },
  generateTimeReport: (
    sessions: Array<{ habitId: string; startedAt: string; durationSeconds: number }>,
    projects: Array<{ habitId: string; projectName: string; clientName: string | null; hourlyRateCents: number; currency: string }>,
    dateRange: { start: string; end: string },
  ) => {
    const projectMap = new Map(projects.map((project) => [project.habitId, project]));
    const grouped = new Map<
      string,
      {
        project: (typeof projects)[number];
        totalSeconds: number;
        totalAmountCents: number;
      }
    >();

    for (const session of sessions) {
      const date = session.startedAt.slice(0, 10);
      if (date < dateRange.start || date > dateRange.end) continue;
      const project = projectMap.get(session.habitId);
      if (!project) continue;

      const amount = Math.round((session.durationSeconds / 3600) * project.hourlyRateCents);
      const current = grouped.get(project.habitId) ?? {
        project,
        totalSeconds: 0,
        totalAmountCents: 0,
      };
      current.totalSeconds += session.durationSeconds;
      current.totalAmountCents += amount;
      grouped.set(project.habitId, current);
    }

    const projectReports = [...grouped.values()].map(({ project, totalSeconds, totalAmountCents }) => ({
      projectName: project.projectName,
      clientName: project.clientName,
      hourlyRateCents: project.hourlyRateCents,
      currency: project.currency,
      totalSeconds,
      totalHours: Number((totalSeconds / 3600).toFixed(2)),
      totalAmountCents,
      entries: [],
    }));
    const totalSeconds = projectReports.reduce((sum, project) => sum + project.totalSeconds, 0);
    const totalAmountCents = projectReports.reduce((sum, project) => sum + project.totalAmountCents, 0);

    return {
      dateRange,
      projects: projectReports,
      totalSeconds,
      totalHours: Number((totalSeconds / 3600).toFixed(2)),
      totalAmountCents,
    };
  },
  generateCSV: (report: {
    projects: Array<{ projectName: string; totalHours: number }>;
    totalHours: number;
  }) => {
    const rows = ['Project,Hours'];
    report.projects.forEach((project) => {
      rows.push(`${project.projectName},${project.totalHours}`);
    });
    rows.push(`TOTAL,${report.totalHours}`);
    return rows.join('\n');
  },
}));

const focusSessions: FocusSession[] = [
  {
    id: 'f1',
    habitId: 'habit-1',
    workDuration: 1500,
    breakDuration: 300,
    roundsTarget: 4,
    roundsCompleted: 4,
    totalFocusSeconds: 1500,
    totalBreakSeconds: 300,
    status: 'completed',
    startedAt: '2026-04-07T10:00:00.000Z',
    completedAt: '2026-04-07T10:30:00.000Z',
    createdAt: '2026-04-07T10:00:00.000Z',
  },
  {
    id: 'f2',
    habitId: 'habit-1',
    workDuration: 1500,
    breakDuration: 300,
    roundsTarget: 4,
    roundsCompleted: 2,
    totalFocusSeconds: 900,
    totalBreakSeconds: 120,
    status: 'completed',
    startedAt: '2026-04-06T08:00:00.000Z',
    completedAt: '2026-04-06T08:18:00.000Z',
    createdAt: '2026-04-06T08:00:00.000Z',
  },
];

const habits: Habit[] = [
  {
    id: 'habit-1',
    name: 'Deep Work',
    description: null,
    frequency: 'daily',
    targetCount: 1,
    icon: 'bolt',
    color: '#A78BFA',
    habitType: 'timed',
    timeOfDay: 'morning',
    specificDays: null,
    gracePeriod: 0,
    reminderTime: null,
    areaId: null,
    isArchived: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    startDate: null,
    endDate: null,
    sortOrder: 0,
  },
];

const projects: Project[] = [
  {
    id: 'project-1',
    habitId: 'habit-1',
    projectName: 'Client Work',
    clientName: 'Acme',
    hourlyRate: 7500,
    currency: 'USD',
    isActive: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
];

const timedSessions: TimedSession[] = [
  {
    id: 'session-1',
    habitId: 'habit-1',
    startedAt: '2026-04-07T09:00:00.000Z',
    durationSeconds: 3600,
    targetSeconds: 0,
    completed: true,
    createdAt: '2026-04-07T09:00:00.000Z',
  },
  {
    id: 'session-2',
    habitId: 'habit-1',
    startedAt: '2026-04-07T13:00:00.000Z',
    durationSeconds: 0,
    targetSeconds: 0,
    completed: false,
    createdAt: '2026-04-07T13:00:00.000Z',
  },
];

describe('habits phase3 helpers', () => {
  it('builds period ranges', () => {
    expect(getPhase3Range('today', new Date('2026-04-07T12:00:00.000Z'))).toEqual({
      start: '2026-04-07',
      end: '2026-04-07',
      label: 'Today',
    });
  });

  it('formats duration labels', () => {
    expect(formatCompactDuration(3900)).toBe('1h 5m');
    expect(formatStopwatch(3912)).toBe('01:05:12');
  });

  it('calculates focus streak days', () => {
    expect(calculateFocusStreakDays(focusSessions, new Date('2026-04-07T12:00:00.000Z'))).toBe(2);
  });

  it('builds focus day points', () => {
    const range = getPhase3Range('week', new Date('2026-04-07T12:00:00.000Z'));
    const points = buildFocusDailySeries(focusSessions, range, new Date('2026-04-07T12:00:00.000Z'));
    expect(points).toHaveLength(7);
    expect(points.at(-1)?.totalSeconds).toBe(1500);
  });

  it('finds the active timed session and project summary', () => {
    const active = getActiveTimedSession(timedSessions);
    expect(active?.id).toBe('session-2');

    const summaries = buildProjectSummaries(
      projects,
      habits,
      timedSessions,
      getPhase3Range('today', new Date('2026-04-07T12:00:00.000Z')),
      new Date('2026-04-07T14:00:00.000Z').getTime(),
    );

    expect(summaries[0]).toMatchObject({
      totalSeconds: 7200,
      billableCents: 15000,
      isActive: true,
    });
  });

  it('exports report csv and simple pdf', () => {
    const range = getPhase3Range('today', new Date('2026-04-07T12:00:00.000Z'));
    const csv = buildTimeReportCsv(
      projects,
      timedSessions,
      range,
      new Date('2026-04-07T14:00:00.000Z').getTime(),
    );
    expect(csv).toContain('Client Work');
    expect(csv).toContain('TOTAL');

    const pdf = buildSimplePdfReport('Time Tracking Report', ['Client Work', 'Total 2h']);
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('Time Tracking Report');
    expect(pdf).toContain('startxref');
  });
});
