/**
 * SOS/Panic grounding techniques and session utilities.
 */

import type { GroundingStep, SosStats, SosSession } from '../types';

// ---------------------------------------------------------------------------
// 5-4-3-2-1 Grounding Exercise
// ---------------------------------------------------------------------------

export const GROUNDING_STEPS: GroundingStep[] = [
  { count: 5, sense: 'see', prompt: 'Name 5 things you can see.' },
  { count: 4, sense: 'touch', prompt: 'Name 4 things you can touch.' },
  { count: 3, sense: 'hear', prompt: 'Name 3 things you can hear.' },
  { count: 2, sense: 'smell', prompt: 'Name 2 things you can smell.' },
  { count: 1, sense: 'taste', prompt: 'Name 1 thing you can taste.' },
];

export function getGroundingSteps(): GroundingStep[] {
  return GROUNDING_STEPS;
}

// ---------------------------------------------------------------------------
// Crisis Hotlines
// ---------------------------------------------------------------------------

export const CRISIS_HOTLINES = [
  { name: '988 Suicide & Crisis Lifeline', number: '988', type: 'call' as const },
  { name: 'Crisis Text Line', number: '741741', type: 'text' as const, instructions: 'Text HOME to 741741' },
];

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function getSosStats(sessions: SosSession[]): SosStats {
  if (sessions.length === 0) {
    return { totalSessions: 0, averageDurationSeconds: null, mostUsedTool: null };
  }

  // Average duration
  const withDuration = sessions.filter((s) => s.duration_seconds !== null);
  const averageDurationSeconds = withDuration.length > 0
    ? Math.round(withDuration.reduce((a, s) => a + s.duration_seconds!, 0) / withDuration.length)
    : null;

  // Most used tool
  const toolCounts = new Map<string, number>();
  for (const s of sessions) {
    if (s.tools_used) {
      try {
        const tools: string[] = JSON.parse(s.tools_used);
        for (const t of tools) {
          toolCounts.set(t, (toolCounts.get(t) ?? 0) + 1);
        }
      } catch {
        // Ignore malformed JSON
      }
    }
  }
  let mostUsedTool: string | null = null;
  let maxCount = 0;
  for (const [tool, count] of toolCounts) {
    if (count > maxCount) { maxCount = count; mostUsedTool = tool; }
  }

  return { totalSessions: sessions.length, averageDurationSeconds, mostUsedTool };
}
