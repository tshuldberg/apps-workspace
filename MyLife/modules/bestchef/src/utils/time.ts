export interface DurationLabels {
  min: string;
  hr: string;
  hrs: string;
}

const DEFAULT_LABELS: DurationLabels = { min: 'min', hr: 'hr', hrs: 'hrs' };

export function formatDuration(
  minutes: number | null,
  labels: DurationLabels = DEFAULT_LABELS,
): string {
  if (minutes === null || minutes <= 0) return '';

  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hrs === 0) return `${mins} ${labels.min}`;
  if (mins === 0) return hrs === 1 ? `1 ${labels.hr}` : `${hrs} ${labels.hrs}`;
  return `${hrs === 1 ? `1 ${labels.hr}` : `${hrs} ${labels.hrs}`} ${mins} ${labels.min}`;
}
