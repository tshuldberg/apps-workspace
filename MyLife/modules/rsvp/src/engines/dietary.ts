/**
 * Dietary preference engine for RSVP events.
 * Predefined options, answer parsing, and aggregation.
 */

export interface DietaryOption {
  id: string;
  label: string;
  category: 'diet' | 'allergy' | 'religious' | 'custom';
}

export interface DietaryAnswer {
  selections: string[];
  other: string | null;
}

export interface OtherEntry {
  guestName: string;
  text: string;
}

export interface DietarySummary {
  counts: Record<string, number>;
  otherEntries: OtherEntry[];
  totalRespondents: number;
  totalGuests: number;
}

/**
 * Predefined dietary options.
 * Labels come from this constant, not from the database.
 */
export const DIETARY_OPTIONS: DietaryOption[] = [
  { id: 'vegetarian', label: 'Vegetarian', category: 'diet' },
  { id: 'vegan', label: 'Vegan', category: 'diet' },
  { id: 'gluten_free', label: 'Gluten-Free', category: 'allergy' },
  { id: 'dairy_free', label: 'Dairy-Free', category: 'allergy' },
  { id: 'nut_allergy', label: 'Nut Allergy', category: 'allergy' },
  { id: 'shellfish_allergy', label: 'Shellfish Allergy', category: 'allergy' },
  { id: 'kosher', label: 'Kosher', category: 'religious' },
  { id: 'halal', label: 'Halal', category: 'religious' },
  { id: 'other', label: 'Other (specify)', category: 'custom' },
];

/**
 * Parse a dietary answer from the stored answer_json.
 * Returns empty selections and null other on invalid input.
 */
export function parseDietaryAnswer(answerJson: string | null | undefined): DietaryAnswer {
  if (!answerJson) return { selections: [], other: null };
  try {
    const parsed = JSON.parse(answerJson);
    return {
      selections: Array.isArray(parsed.selections) ? parsed.selections : [],
      other: typeof parsed.other === 'string' && parsed.other.length > 0
        ? parsed.other
        : null,
    };
  } catch {
    return { selections: [], other: null };
  }
}

/**
 * Format a dietary answer into JSON for storage.
 */
export function formatDietaryAnswer(answer: DietaryAnswer): string {
  return JSON.stringify({
    selections: answer.selections,
    other: answer.other,
  });
}

/**
 * Aggregate dietary responses from multiple guests.
 * Only includes responses from Going/Maybe guests (not Declined).
 */
export function aggregateDietaryResponses(
  responses: Array<{
    guestName: string;
    answerJson: string | null;
    rsvpResponse: string;
  }>,
  totalGuests: number,
): DietarySummary {
  const counts: Record<string, number> = {};
  const otherEntries: OtherEntry[] = [];
  let totalRespondents = 0;

  // Initialize counts for all predefined options
  for (const option of DIETARY_OPTIONS) {
    if (option.id !== 'other') {
      counts[option.id] = 0;
    }
  }

  for (const response of responses) {
    // Exclude declined guests from summary
    if (response.rsvpResponse === 'declined') continue;

    const answer = parseDietaryAnswer(response.answerJson);

    // Only count as respondent if they selected something or entered "other" text
    if (answer.selections.length === 0 && !answer.other) continue;

    totalRespondents++;

    for (const selection of answer.selections) {
      if (selection !== 'other') {
        counts[selection] = (counts[selection] ?? 0) + 1;
      }
    }

    if (answer.other) {
      otherEntries.push({
        guestName: response.guestName,
        text: answer.other,
      });
    }
  }

  return {
    counts,
    otherEntries,
    totalRespondents,
    totalGuests,
  };
}
