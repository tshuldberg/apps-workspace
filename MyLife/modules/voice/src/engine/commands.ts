/**
 * Command matching engine for voice commands.
 * Matches spoken phrases against registered commands with variable slot extraction.
 */

export interface CommandTemplate {
  phrase: string;
  action: string;
  moduleTarget: string;
  params: string | null;
}

export interface MatchResult {
  commandId: string;
  phrase: string;
  action: string;
  moduleTarget: string | null;
  params: string | null;
  confidence: number;
  extractedSlots: Record<string, string>;
}

interface MatchCandidate {
  id: string;
  phrase: string;
  action: string;
  moduleTarget: string | null;
  params: string | null;
  priority: number;
  isEnabled: boolean;
}

/**
 * Normalize a phrase for matching: lowercase, trim, strip non-alphanumeric (except spaces).
 */
export function normalizePhrase(phrase: string): string {
  return phrase
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Convert a command phrase with variable slots into a regex pattern.
 * Slots like [amount] or [item] become named capture groups.
 */
export function phraseToRegex(phrase: string): RegExp {
  // Extract slot positions before normalizing (normalizePhrase strips brackets and underscores)
  let withPlaceholders = phrase;
  const slotNames: string[] = [];
  withPlaceholders = withPlaceholders.replace(/\[(\w+)\]/g, (_match, name: string) => {
    slotNames.push(name);
    return `xslotx${slotNames.length - 1}x`;
  });

  const normalized = normalizePhrase(withPlaceholders);
  // Restore slot placeholders as named capture groups
  let pattern = normalized;
  for (let i = 0; i < slotNames.length; i++) {
    pattern = pattern.replace(
      `xslotx${i}x`,
      `(?<${slotNames[i]}>\\S+(?:\\s+\\S+)*)`,
    );
  }
  return new RegExp(`^${pattern}$`, 'i');
}

/**
 * Check if a command phrase has variable slots.
 */
export function hasVariableSlots(phrase: string): boolean {
  return /\[\w+\]/.test(phrase);
}

/**
 * Match a spoken phrase against a list of registered commands.
 * Returns the best match or null if no match found.
 *
 * Matching rules:
 * - Case-insensitive, normalized comparison
 * - Longer phrases take priority (more specific)
 * - Priority field breaks ties
 * - Disabled commands are excluded
 * - Variable slots are extracted into the result
 */
export function matchCommand(
  spokenPhrase: string,
  commands: MatchCandidate[],
): MatchResult | null {
  const normalized = normalizePhrase(spokenPhrase);
  if (!normalized) return null;

  const enabledCommands = commands.filter((c) => c.isEnabled);
  if (enabledCommands.length === 0) return null;

  let bestMatch: MatchResult | null = null;
  let bestScore = -1;

  for (const cmd of enabledCommands) {
    const cmdNormalized = normalizePhrase(cmd.phrase);
    let confidence = 0;
    let extractedSlots: Record<string, string> = {};

    if (hasVariableSlots(cmd.phrase)) {
      // Try regex match for phrases with slots
      const regex = phraseToRegex(cmd.phrase);
      const match = regex.exec(normalized);
      if (match) {
        confidence = 0.9; // Slightly lower confidence for slot matches
        extractedSlots = { ...(match.groups ?? {}) };
      } else {
        continue;
      }
    } else {
      // Exact match for phrases without slots
      if (normalized === cmdNormalized) {
        confidence = 1.0;
      } else {
        continue;
      }
    }

    // Score: longer phrases preferred, then priority, then confidence
    const phraseLength = cmdNormalized.split(' ').length;
    const score = phraseLength * 100 + cmd.priority * 10 + confidence;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        commandId: cmd.id,
        phrase: cmd.phrase,
        action: cmd.action,
        moduleTarget: cmd.moduleTarget,
        params: cmd.params,
        confidence,
        extractedSlots,
      };
    }
  }

  return bestMatch;
}

/** Preset command templates grouped by module. */
export const PRESET_TEMPLATES: CommandTemplate[] = [
  { phrase: 'Start fasting', action: 'start_fast', moduleTarget: 'fast', params: null },
  { phrase: 'End my fast', action: 'end_fast', moduleTarget: 'fast', params: null },
  { phrase: 'Add expense [amount]', action: 'add_expense', moduleTarget: 'budget', params: null },
  { phrase: 'Add [item] to shopping list', action: 'add_shopping_item', moduleTarget: 'recipes', params: null },
  { phrase: 'Log mood [rating]', action: 'log_mood', moduleTarget: 'mood', params: null },
  { phrase: 'Mark [habit] done', action: 'complete_habit', moduleTarget: 'habits', params: null },
  { phrase: 'Took my [medication]', action: 'log_medication', moduleTarget: 'meds', params: null },
  { phrase: 'New journal entry', action: 'create_entry', moduleTarget: 'journal', params: null },
  { phrase: 'Quick note [text]', action: 'create_note', moduleTarget: 'notes', params: null },
  { phrase: 'Start workout', action: 'start_workout', moduleTarget: 'workouts', params: null },
];
