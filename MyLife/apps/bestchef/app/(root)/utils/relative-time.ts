/**
 * Locale-aware relative time (plan 33 Phase 3.3).
 *
 * The cloud viewmodels carry English-abbreviated timeAgo strings ("2h") as
 * a fallback; screens localize from the raw timestamp instead by feeding
 * these parts into the i18n context's formatRelativeTime
 * (Intl.RelativeTimeFormat under the app language).
 */

export interface RelativeTimeParts {
  /** Negative for the past, as Intl.RelativeTimeFormat expects. */
  value: number;
  unit: Intl.RelativeTimeFormatUnit;
  /** True when the moment is under a minute ago: render t('now') instead. */
  isNow: boolean;
}

export function relativeTimeParts(
  from: Date | string,
  now: Date = new Date(),
): RelativeTimeParts {
  const fromMs = from instanceof Date ? from.getTime() : new Date(from).getTime();
  if (!Number.isFinite(fromMs)) return { value: 0, unit: 'second', isNow: true };
  const diffSecs = Math.max(0, Math.floor((now.getTime() - fromMs) / 1000));
  if (diffSecs < 60) return { value: 0, unit: 'second', isNow: true };
  const mins = Math.floor(diffSecs / 60);
  if (mins < 60) return { value: -mins, unit: 'minute', isNow: false };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { value: -hours, unit: 'hour', isNow: false };
  const days = Math.floor(hours / 24);
  if (days < 7) return { value: -days, unit: 'day', isNow: false };
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return { value: -weeks, unit: 'week', isNow: false };
  if (days < 365) {
    // Clamp so 360-364 days reads "11 months ago", never "0 years ago".
    return { value: -Math.min(11, Math.floor(days / 30)), unit: 'month', isNow: false };
  }
  return { value: -Math.floor(days / 365), unit: 'year', isNow: false };
}
