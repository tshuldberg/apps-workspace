import type { TimeEntry, ProjectReport, TimeReport } from '../types';

export function calculateBillableAmount(durationSeconds: number, hourlyRateCents: number): number {
  return Math.round((durationSeconds / 3600) * hourlyRateCents);
}

export function formatDuration(durationSeconds: number): string {
  return (durationSeconds / 3600).toFixed(2);
}

export function formatCurrency(amountCents: number, currency: string): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  const dollars = (amountCents / 100).toFixed(2);
  return `${symbol}${dollars}`;
}

export interface RawSessionEntry {
  habitId: string;
  startedAt: string;
  durationSeconds: number;
}

export interface ProjectInfo {
  habitId: string;
  projectName: string;
  clientName: string | null;
  hourlyRateCents: number;
  currency: string;
}

export function generateTimeReport(
  sessions: RawSessionEntry[],
  projects: ProjectInfo[],
  dateRange: { start: string; end: string },
): TimeReport {
  const projectMap = new Map<string, ProjectInfo>();
  for (const p of projects) {
    projectMap.set(p.habitId, p);
  }

  const grouped = new Map<string, { project: ProjectInfo; entries: TimeEntry[] }>();

  for (const session of sessions) {
    const date = session.startedAt.slice(0, 10);
    if (date < dateRange.start || date > dateRange.end) continue;

    const project = projectMap.get(session.habitId);
    if (!project) continue;

    if (!grouped.has(project.habitId)) {
      grouped.set(project.habitId, { project, entries: [] });
    }

    const entry: TimeEntry = {
      date,
      startTime: session.startedAt.slice(11, 16) || '00:00',
      durationSeconds: session.durationSeconds,
      durationHours: parseFloat((session.durationSeconds / 3600).toFixed(2)),
      amountCents: calculateBillableAmount(session.durationSeconds, project.hourlyRateCents),
    };
    grouped.get(project.habitId)!.entries.push(entry);
  }

  const projectReports: ProjectReport[] = [];
  let totalSeconds = 0;
  let totalAmountCents = 0;

  for (const { project, entries } of grouped.values()) {
    const projTotalSeconds = entries.reduce((sum, e) => sum + e.durationSeconds, 0);
    const projTotalAmount = entries.reduce((sum, e) => sum + e.amountCents, 0);
    totalSeconds += projTotalSeconds;
    totalAmountCents += projTotalAmount;

    projectReports.push({
      projectName: project.projectName,
      clientName: project.clientName,
      hourlyRateCents: project.hourlyRateCents,
      currency: project.currency,
      totalSeconds: projTotalSeconds,
      totalHours: parseFloat((projTotalSeconds / 3600).toFixed(2)),
      totalAmountCents: projTotalAmount,
      entries,
    });
  }

  return {
    dateRange,
    projects: projectReports,
    totalSeconds,
    totalHours: parseFloat((totalSeconds / 3600).toFixed(2)),
    totalAmountCents,
  };
}

export function generateCSV(report: TimeReport): string {
  const lines: string[] = ['Project,Client,Date,Start Time,Duration (hours),Hourly Rate,Amount'];

  for (const proj of report.projects) {
    const rate = formatCurrency(proj.hourlyRateCents, proj.currency);
    for (const entry of proj.entries) {
      const amount = formatCurrency(entry.amountCents, proj.currency);
      lines.push(`${csvEscape(proj.projectName)},${csvEscape(proj.clientName || '')},${entry.date},${entry.startTime},${entry.durationHours},${rate},${amount}`);
    }
  }

  const totalAmount = report.projects.length > 0
    ? formatCurrency(report.totalAmountCents, report.projects[0].currency)
    : formatCurrency(report.totalAmountCents, 'USD');
  lines.push(`TOTAL,,,${report.totalHours},,${totalAmount}`);

  return lines.join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
