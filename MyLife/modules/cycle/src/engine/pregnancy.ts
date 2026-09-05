import type { PregnancyWeekInfo } from '../types';
import { PREGNANCY_WEEK_DATA } from '../data/pregnancy-weeks';

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate due date from last menstrual period using Naegele's rule.
 * Due date = LMP + 280 days.
 */
export function calculateDueDateFromLMP(lmpDate: string): string {
  return addDays(lmpDate, 280);
}

/**
 * Calculate due date from known conception date.
 * Due date = conception + 266 days.
 */
export function calculateDueDateFromConception(conceptionDate: string): string {
  return addDays(conceptionDate, 266);
}

/**
 * Calculate due date from IVF transfer date.
 * Due date = transfer + 266 days (adjusted by embryo age if needed,
 * but we use the simple formula for now).
 */
export function calculateDueDateFromTransfer(transferDate: string): string {
  return addDays(transferDate, 266);
}

/**
 * Calculate due date based on the start method and provided dates.
 */
export function calculateDueDate(
  startMethod: string,
  dates: {
    lastPeriodDate?: string;
    conceptionDate?: string;
    dueDate?: string;
    transferDate?: string;
  },
): string {
  switch (startMethod) {
    case 'last_period':
      if (!dates.lastPeriodDate) throw new Error('Last period date is required');
      return calculateDueDateFromLMP(dates.lastPeriodDate);
    case 'conception_date':
      if (!dates.conceptionDate) throw new Error('Conception date is required');
      return calculateDueDateFromConception(dates.conceptionDate);
    case 'due_date':
      if (!dates.dueDate) throw new Error('Due date is required');
      return dates.dueDate;
    case 'transfer_date':
      if (!dates.transferDate) throw new Error('Transfer date is required');
      return calculateDueDateFromTransfer(dates.transferDate);
    default:
      throw new Error(`Unknown start method: ${startMethod}`);
  }
}

/**
 * Get the LMP date from the due date (reverse Naegele's rule).
 * LMP = due date - 280 days.
 */
export function getLMPFromDueDate(dueDate: string): string {
  return addDays(dueDate, -280);
}

/**
 * Calculate the current week of pregnancy.
 * Week = floor((today - LMP) / 7) + 1
 * If no LMP is known, derive it from due date.
 */
export function getCurrentWeek(
  dueDate: string,
  today: string,
  lastPeriodDate?: string | null,
): number {
  const lmp = lastPeriodDate ?? getLMPFromDueDate(dueDate);
  const days = daysBetween(lmp, today);
  const week = Math.floor(days / 7) + 1;
  return Math.max(1, week);
}

/**
 * Get the current trimester based on week number.
 * Trimester 1: weeks 1-13
 * Trimester 2: weeks 14-27
 * Trimester 3: weeks 28+
 */
export function getCurrentTrimester(week: number): 1 | 2 | 3 {
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}

/**
 * Get the number of days until the due date.
 * Returns negative if past due.
 */
export function getDaysUntilDue(dueDate: string, today: string): number {
  return daysBetween(today, dueDate);
}

/**
 * Get pregnancy week info (baby size, development highlights).
 * Weeks 1-3 return "too early" info.
 * Weeks > 42 are capped at week 42.
 */
export function getPregnancyWeekInfo(week: number): PregnancyWeekInfo {
  if (week < 1) week = 1;

  if (week <= 3) {
    return {
      week,
      trimester: 1,
      babySize: 'Too early to measure',
      babySizeCm: 0,
      developmentHighlight: 'Fertilization and implantation are occurring',
    };
  }

  const cappedWeek = Math.min(week, 42);
  const data = PREGNANCY_WEEK_DATA.find((w: { week: number }) => w.week === cappedWeek);

  if (!data) {
    return {
      week: cappedWeek,
      trimester: getCurrentTrimester(cappedWeek),
      babySize: 'Full term',
      babySizeCm: 51,
      developmentHighlight: 'Your baby is fully developed and ready to be born',
    };
  }

  return {
    ...data,
    trimester: getCurrentTrimester(data.week),
  };
}

/**
 * Check if a pregnancy is past due (week > 40).
 */
export function isPastDue(dueDate: string, today: string): boolean {
  return daysBetween(today, dueDate) < 0;
}

/**
 * Format the pregnancy week display text.
 * Caps at "42+ weeks" for overdue pregnancies.
 */
export function formatWeekDisplay(week: number): string {
  if (week > 42) return '42+ weeks';
  return `Week ${week} of 40`;
}
