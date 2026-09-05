// ── Mood Integration ────────────────────────────────────────────────
// Correlates mood scores with social activity to surface insights like
// "Your mood averages 7.2 on social days vs 5.8 on solo days."

/** Result of social-mood correlation analysis. */
export interface SocialMoodCorrelation {
  /** Pearson-style directional indicator (-1 to 1 simplified). */
  correlation: number;
  /** Average mood score on days with hangouts. */
  socialDayAvg: number;
  /** Average mood score on days without hangouts. */
  nonSocialDayAvg: number;
  /** Human-readable insight string. */
  insight: string;
}

/**
 * Compare mood on hangout days vs non-hangout days.
 *
 * Pure function: no DB calls, no side effects.
 * Returns null if insufficient data (< 10 mood entries).
 */
export function calculateSocialMoodCorrelation(
  hangoutDates: string[],
  moodEntries: Array<{ date: string; score: number }>,
): SocialMoodCorrelation | null {
  if (moodEntries.length < 10) return null;

  // Normalize hangout dates to YYYY-MM-DD for comparison
  const hangoutSet = new Set(
    hangoutDates.map((d) => d.slice(0, 10)),
  );

  let socialSum = 0;
  let socialCount = 0;
  let nonSocialSum = 0;
  let nonSocialCount = 0;

  for (const entry of moodEntries) {
    const dateKey = entry.date.slice(0, 10);
    if (hangoutSet.has(dateKey)) {
      socialSum += entry.score;
      socialCount++;
    } else {
      nonSocialSum += entry.score;
      nonSocialCount++;
    }
  }

  // Need at least 1 entry in each bucket to compare
  if (socialCount === 0 || nonSocialCount === 0) return null;

  const socialDayAvg = Math.round((socialSum / socialCount) * 10) / 10;
  const nonSocialDayAvg = Math.round((nonSocialSum / nonSocialCount) * 10) / 10;

  // Simplified correlation: positive if social days score higher
  const diff = socialDayAvg - nonSocialDayAvg;
  const maxPossibleDiff = 10; // mood scale 0-10
  const correlation = Math.round((diff / maxPossibleDiff) * 100) / 100;

  const insight =
    diff > 0
      ? `Your mood averages ${socialDayAvg} on social days vs ${nonSocialDayAvg} on solo days`
      : diff < 0
        ? `Your mood averages ${nonSocialDayAvg} on solo days vs ${socialDayAvg} on social days`
        : `Your mood is similar on social and solo days (${socialDayAvg})`;

  return { correlation, socialDayAvg, nonSocialDayAvg, insight };
}
