import type { AlertType } from '../models/caregiver';

/**
 * Generate an alert message for a missed dose.
 */
export function generateAlertMessage(
  patientName: string,
  medicationName: string,
  scheduledTime: string,
  alertType: AlertType,
): string {
  switch (alertType) {
    case 'missed_dose':
      return `${patientName} missed their ${scheduledTime} dose of ${medicationName}.`;
    case 'low_adherence':
      return `${patientName}'s adherence for ${medicationName} has dropped below the threshold this week.`;
    case 'low_supply':
      return `${patientName} is running low on ${medicationName}. Refill may be needed soon.`;
    case 'custom':
      return `Alert for ${patientName} regarding ${medicationName}.`;
  }
}

/**
 * Check if a dose has been missed beyond the configured delay window.
 */
export function shouldFireAlert(
  scheduledTime: string,
  delayMinutes: number,
  doseLogged: boolean,
  caregiverActive: boolean,
  now?: Date,
): boolean {
  if (!caregiverActive || doseLogged) return false;

  const scheduled = new Date(scheduledTime);
  const current = now ?? new Date();
  const diffMs = current.getTime() - scheduled.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes >= delayMinutes;
}

/**
 * Generate a weekly adherence summary for all caregiver-linked medications.
 */
export function generateWeeklySummary(
  patientName: string,
  medStats: Array<{ medName: string; adherenceRate: number; dosesLogged: number; dosesMissed: number }>,
): string {
  const lines = [
    `Weekly Medication Summary for ${patientName}`,
    `Period: Last 7 days`,
    '',
  ];

  for (const stat of medStats) {
    const pct = Math.round(stat.adherenceRate * 100);
    lines.push(`${stat.medName}: ${pct}% adherence (${stat.dosesLogged} taken, ${stat.dosesMissed} missed)`);
  }

  const overallRate = medStats.length > 0
    ? medStats.reduce((sum, s) => sum + s.adherenceRate, 0) / medStats.length
    : 0;
  lines.push('');
  lines.push(`Overall: ${Math.round(overallRate * 100)}%`);

  return lines.join('\n');
}
