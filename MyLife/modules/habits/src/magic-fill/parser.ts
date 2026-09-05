import type { HabitType, Frequency, TimeOfDay, DayOfWeek } from '../types';

export interface MagicFillResult {
  name: string;
  habitType: HabitType;
  frequency: Frequency;
  specificDays: DayOfWeek[] | null;
  timeOfDay: TimeOfDay;
  targetCount: number;
  unit: string | null;
  confidence: number;
}

const DAY_PATTERNS: Record<string, DayOfWeek> = {
  mon: 'mon', monday: 'mon',
  tue: 'tue', tuesday: 'tue', tues: 'tue',
  wed: 'wed', wednesday: 'wed',
  thu: 'thu', thursday: 'thu', thurs: 'thu',
  fri: 'fri', friday: 'fri',
  sat: 'sat', saturday: 'sat',
  sun: 'sun', sunday: 'sun',
};

const TIME_PATTERNS: { pattern: RegExp; value: TimeOfDay }[] = [
  { pattern: /\b(?:morning|am|before\s+noon)\b/i, value: 'morning' },
  { pattern: /\b(?:afternoon|after\s+lunch|midday)\b/i, value: 'afternoon' },
  { pattern: /\b(?:evening|night|before\s+bed|pm)\b/i, value: 'evening' },
  { pattern: /\bat\s+\d{1,2}\s*(?:am)\b/i, value: 'morning' },
  { pattern: /\bat\s+\d{1,2}\s*(?:pm)\b/i, value: 'evening' },
];

const NEGATION_PATTERNS = /\b(?:no|don'?t|stop|avoid|quit|never)\b/i;

// Duration: "15 min", "30 minutes", "1 hour", "45min", "1h", "1.5 hours"
const DURATION_PATTERN = /(\d+(?:\.\d+)?)\s*(?:h(?:ours?|rs?)?|min(?:utes?|s)?)/i;
const HOUR_MARKER = /(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?/i;

// Count: "8 glasses", "10000 steps", "3 sets"
const COUNT_PATTERN = /(\d+)\s+(glasses?|cups?|steps?|sets?|reps?|pages?|words?|liters?|litres?|oz|minutes?|items?|servings?)/i;

// Frequency: "daily", "every day", "3x/week", "4 times a week", "weekdays", "weekends"
const FREQ_DAILY = /\b(?:daily|every\s*day|each\s*day)\b/i;
const FREQ_WEEKLY = /\b(\d+)\s*(?:x|times?)\s*(?:\/|\s*(?:a|per)\s*)?\s*week\b/i;
const FREQ_WEEKDAYS = /\bweekdays?\b/i;
const FREQ_WEEKENDS = /\bweekends?\b/i;

function extractDays(input: string): DayOfWeek[] {
  const found: DayOfWeek[] = [];
  // Match "Mon/Wed/Fri" or "Mon Wed Fri" or "Monday, Wednesday"
  const words = input.toLowerCase().split(/[\s,/]+/);
  for (const w of words) {
    const day = DAY_PATTERNS[w];
    if (day && !found.includes(day)) found.push(day);
  }
  return found;
}

function stripPatterns(input: string, patterns: RegExp[]): string {
  let result = input;
  for (const p of patterns) {
    result = result.replace(p, '');
  }
  // Clean up extra whitespace
  return result.replace(/\s{2,}/g, ' ').trim();
}

export function parseMagicFill(input: string): MagicFillResult {
  if (!input.trim()) {
    return {
      name: '',
      habitType: 'standard',
      frequency: 'daily',
      specificDays: null,
      timeOfDay: 'anytime',
      targetCount: 1,
      unit: null,
      confidence: 0,
    };
  }

  let habitType: HabitType = 'standard';
  let frequency: Frequency = 'daily';
  let specificDays: DayOfWeek[] | null = null;
  let timeOfDay: TimeOfDay = 'anytime';
  let targetCount = 1;
  let unit: string | null = null;
  let fieldsExtracted = 0;

  const patternsToStrip: RegExp[] = [];

  // Check negation first
  if (NEGATION_PATTERNS.test(input)) {
    habitType = 'negative';
    fieldsExtracted++;
    patternsToStrip.push(NEGATION_PATTERNS);
  }

  // Extract duration (timed habit)
  const durationMatch = input.match(DURATION_PATTERN);
  if (durationMatch && habitType !== 'negative') {
    const hourMatch = input.match(HOUR_MARKER);
    if (hourMatch) {
      targetCount = Math.round(parseFloat(hourMatch[1]) * 3600);
    } else {
      targetCount = Math.round(parseFloat(durationMatch[1]) * 60);
    }
    habitType = 'timed';
    fieldsExtracted++;
    patternsToStrip.push(DURATION_PATTERN);
  }

  // Extract count (measurable habit)
  const countMatch = input.match(COUNT_PATTERN);
  if (countMatch && habitType === 'standard') {
    targetCount = parseInt(countMatch[1], 10);
    const rawUnit = countMatch[2].toLowerCase();
    // Simple singularization
    if (rawUnit.endsWith('sses')) unit = rawUnit.slice(0, -2); // glasses -> glass
    else if (rawUnit.endsWith('s') && !rawUnit.endsWith('ss')) unit = rawUnit.slice(0, -1);
    else unit = rawUnit;
    habitType = 'measurable';
    fieldsExtracted++;
    patternsToStrip.push(COUNT_PATTERN);
  }

  // Extract frequency
  if (FREQ_WEEKDAYS.test(input)) {
    frequency = 'specific_days';
    specificDays = ['mon', 'tue', 'wed', 'thu', 'fri'];
    fieldsExtracted++;
    patternsToStrip.push(FREQ_WEEKDAYS);
  } else if (FREQ_WEEKENDS.test(input)) {
    frequency = 'specific_days';
    specificDays = ['sat', 'sun'];
    fieldsExtracted++;
    patternsToStrip.push(FREQ_WEEKENDS);
  } else if (FREQ_WEEKLY.test(input)) {
    frequency = 'weekly';
    fieldsExtracted++;
    patternsToStrip.push(FREQ_WEEKLY);
  } else if (FREQ_DAILY.test(input)) {
    frequency = 'daily';
    fieldsExtracted++;
    patternsToStrip.push(FREQ_DAILY);
  } else {
    // Check for specific day names
    const days = extractDays(input);
    if (days.length > 0) {
      frequency = 'specific_days';
      specificDays = days;
      fieldsExtracted++;
      // Strip day names from the remaining text
      const dayRegex = new RegExp(`\\b(?:${Object.keys(DAY_PATTERNS).join('|')})\\b`, 'gi');
      patternsToStrip.push(dayRegex);
    }
  }

  // Extract time of day
  for (const tp of TIME_PATTERNS) {
    if (tp.pattern.test(input)) {
      timeOfDay = tp.value;
      fieldsExtracted++;
      patternsToStrip.push(tp.pattern);
      break;
    }
  }

  // Name = remaining text after stripping all matched patterns
  let name = stripPatterns(input, patternsToStrip);
  // Remove leading/trailing conjunctions and prepositions
  name = name.replace(/^(?:and|of|the|a|an|to|for|in|on|at|by)\s+/i, '').trim();
  name = name.replace(/\s+(?:of|the|a|an)$/i, '').trim();
  if (!name) name = input.trim();

  // Capitalize first letter
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  // Confidence: 0-1 based on fields extracted (max 4 extractable: type, freq, time, name-is-different)
  const maxFields = 4;
  const confidence = Math.min(fieldsExtracted / maxFields, 1);

  return {
    name,
    habitType,
    frequency,
    specificDays,
    timeOfDay,
    targetCount,
    unit,
    confidence,
  };
}
