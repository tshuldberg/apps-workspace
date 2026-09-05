import { getMoonPhase, getMoonSign, getZodiacSign, getTarotCardOfDay } from './astro';
import type { MoonPhase, ZodiacSign } from '../types';
import type { JournalMood } from './interpretations';
import { JOURNAL_MOODS } from './interpretations';

// ── Types ────────────────────────────────────────────────────────────

export interface AstrologicalContext {
  date: string;
  moonPhase: MoonPhase;
  moonSign: ZodiacSign;
  sunSign: ZodiacSign;
  retrogradePlanets: string[];
  tarotCardName: string | null;
}

export interface JournalPattern {
  description: string;
  supportingEntries: number;
  confidence: 'low' | 'medium' | 'high';
  condition: string;
  mood: string;
}

// ── Public API ───────────────────────────────────────────────────────

export function captureAstrologicalContext(
  date: string,
  retrogradePlanets: string[] = [],
  includeTarot: boolean = true,
): AstrologicalContext {
  const moonPhase = getMoonPhase(date);
  const moonSign = getMoonSign(date);
  const sunSign = getZodiacSign(date);
  const tarotCard = includeTarot ? getTarotCardOfDay(date) : null;

  return {
    date,
    moonPhase,
    moonSign,
    sunSign,
    retrogradePlanets,
    tarotCardName: tarotCard?.name ?? null,
  };
}

export function isValidMood(mood: string): mood is JournalMood {
  return (JOURNAL_MOODS as readonly string[]).includes(mood);
}

export function validateJournalContent(content: string): { valid: boolean; error: string | null } {
  const trimmed = content.trim();
  if (trimmed.length === 0) return { valid: false, error: 'Content cannot be empty.' };
  if (trimmed.length > 5000) return { valid: false, error: 'Content exceeds 5,000 character limit.' };
  return { valid: true, error: null };
}

interface MoodEntry {
  mood: string | null;
  moonPhase: string;
  moonSign: string;
  retrogradePlanets: string | null;
}

export function detectPatterns(entries: MoodEntry[]): JournalPattern[] {
  if (entries.length < 30) return [];

  const patterns: JournalPattern[] = [];
  const entriesWithMood = entries.filter((e) => e.mood !== null);
  if (entriesWithMood.length < 10) return [];

  // Overall mood distribution
  const overallMoodCounts: Record<string, number> = {};
  for (const e of entriesWithMood) {
    overallMoodCounts[e.mood!] = (overallMoodCounts[e.mood!] ?? 0) + 1;
  }

  // Group by moon phase
  const byMoonPhase: Record<string, MoodEntry[]> = {};
  for (const e of entriesWithMood) {
    const key = e.moonPhase;
    if (!byMoonPhase[key]) byMoonPhase[key] = [];
    byMoonPhase[key].push(e);
  }

  for (const [phase, group] of Object.entries(byMoonPhase)) {
    if (group.length < 5) continue;
    const groupMoodCounts: Record<string, number> = {};
    for (const e of group) groupMoodCounts[e.mood!] = (groupMoodCounts[e.mood!] ?? 0) + 1;

    for (const [mood, count] of Object.entries(groupMoodCounts)) {
      const groupRate = count / group.length;
      const overallRate = (overallMoodCounts[mood] ?? 0) / entriesWithMood.length;
      if (overallRate > 0 && groupRate >= overallRate * 1.5) {
        patterns.push({
          description: `"${mood}" appears ${Math.round(groupRate * 100)}% of the time during ${phase.replace(/_/g, ' ')}`,
          supportingEntries: group.length,
          confidence: group.length >= 10 ? 'high' : group.length >= 7 ? 'medium' : 'low',
          condition: phase,
          mood,
        });
      }
    }
  }

  // Group by retrograde
  const retroEntries = entriesWithMood.filter(
    (e) => e.retrogradePlanets && e.retrogradePlanets !== '[]',
  );
  if (retroEntries.length >= 5) {
    const retroMoodCounts: Record<string, number> = {};
    for (const e of retroEntries) retroMoodCounts[e.mood!] = (retroMoodCounts[e.mood!] ?? 0) + 1;

    for (const [mood, count] of Object.entries(retroMoodCounts)) {
      const groupRate = count / retroEntries.length;
      const overallRate = (overallMoodCounts[mood] ?? 0) / entriesWithMood.length;
      if (overallRate > 0 && groupRate >= overallRate * 1.5) {
        patterns.push({
          description: `"${mood}" appears ${Math.round(groupRate * 100)}% of the time during retrogrades`,
          supportingEntries: retroEntries.length,
          confidence: retroEntries.length >= 10 ? 'high' : retroEntries.length >= 7 ? 'medium' : 'low',
          condition: 'retrograde',
          mood,
        });
      }
    }
  }

  return patterns.sort((a, b) => {
    const confOrder = { high: 0, medium: 1, low: 2 };
    if (confOrder[a.confidence] !== confOrder[b.confidence]) {
      return confOrder[a.confidence] - confOrder[b.confidence];
    }
    return b.supportingEntries - a.supportingEntries;
  });
}
