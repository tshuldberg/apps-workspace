/**
 * Life Chapters engine.
 *
 * Pure functions for life event labels, response suggestions, and city grouping.
 */

// ── Response suggestions ──────────────────────────────────────────

const SUGGESTIONS: Record<string, string> = {
  move: 'Let them know you\'re thinking of them in the new place.',
  job: 'Congratulate them! Ask what excited them about the role.',
  baby: 'Send your warmest congratulations and ask how they\'re doing.',
  engaged: 'Celebrate with them! Ask to hear the proposal story.',
  married: 'Send your love and congratulations on the big day.',
  graduated: 'Congratulate their achievement! Ask what\'s next.',
  other: 'Reach out and acknowledge this milestone.',
};

export function getResponseSuggestion(eventType: string): string {
  return SUGGESTIONS[eventType] ?? SUGGESTIONS.other;
}

// ── City grouping ─────────────────────────────────────────────────

export function getCityGroups(
  people: Array<{ id: string; display_name: string; city: string | null }>,
): Map<string, Array<{ id: string; display_name: string }>> {
  const groups = new Map<string, Array<{ id: string; display_name: string }>>();

  for (const person of people) {
    if (!person.city) continue;
    const city = person.city.trim();
    if (!city) continue;

    if (!groups.has(city)) {
      groups.set(city, []);
    }
    groups.get(city)!.push({ id: person.id, display_name: person.display_name });
  }

  return groups;
}

// ── Event type labels ─────────────────────────────────────────────

const LABELS: Record<string, string> = {
  move: 'Moved cities',
  job: 'New job',
  baby: 'Had a baby',
  engaged: 'Got engaged',
  married: 'Got married',
  graduated: 'Graduated',
  other: 'Life update',
};

export function formatLifeEventLabel(type: string): string {
  return LABELS[type] ?? LABELS.other;
}

// ── Event type icons ──────────────────────────────────────────────

const ICONS: Record<string, string> = {
  move: '\uD83C\uDFE0',      // 🏠
  job: '\uD83D\uDCBC',       // 💼
  baby: '\uD83D\uDC76',      // 👶
  engaged: '\uD83D\uDC8D',   // 💍
  married: '\uD83D\uDC92',   // 💒
  graduated: '\uD83C\uDF93', // 🎓
  other: '\u2728',           // ✨
};

export function getLifeEventIcon(type: string): string {
  return ICONS[type] ?? ICONS.other;
}
