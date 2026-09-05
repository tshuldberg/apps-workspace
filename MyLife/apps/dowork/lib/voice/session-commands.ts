// Hands-free voice parser for the live workout session screen. Mirrors the
// player parser (`@mylife/workouts` parsePlayerCommand) in shape: a phrase table
// sorted longest-first, a spoken-number extractor for weight/reps, and a
// tail-guard so long gym chatter with no command near the end is ignored.
// Kept framework-free so it is unit-testable without a renderer; the session
// screen maps each action onto its existing handlers (handleCompleteSet etc.).

export type SessionVoiceAction =
  | { kind: 'complete_set' }
  | { kind: 'skip_rest' }
  | { kind: 'next_exercise' }
  | { kind: 'previous_exercise' }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'set_weight'; value: number }
  | { kind: 'set_reps'; value: number };

export interface SessionVoiceMatch {
  action: SessionVoiceAction;
  confidence: number; // 1.0 exact phrase match, 0.8 contained match
  raw: string;
}

type PhraseDef =
  | { type: 'complete_set' }
  | { type: 'skip_rest' }
  | { type: 'next_exercise' }
  | { type: 'previous_exercise' }
  | { type: 'pause' }
  | { type: 'resume' };

// Static phrases (no captured number). Number-bearing commands (weight / reps)
// are matched separately below so they can pull a magnitude out of the phrase.
const PHRASES: ReadonlyArray<{ phrase: string; def: PhraseDef }> = [
  { phrase: 'previous exercise', def: { type: 'previous_exercise' } },
  { phrase: 'last exercise', def: { type: 'previous_exercise' } },
  { phrase: 'go back', def: { type: 'previous_exercise' } },
  { phrase: 'previous', def: { type: 'previous_exercise' } },
  { phrase: 'next exercise', def: { type: 'next_exercise' } },
  { phrase: 'skip exercise', def: { type: 'next_exercise' } },
  { phrase: 'next', def: { type: 'next_exercise' } },
  { phrase: 'skip rest', def: { type: 'skip_rest' } },
  { phrase: 'done resting', def: { type: 'skip_rest' } },
  { phrase: 'skip the rest', def: { type: 'skip_rest' } },
  { phrase: 'end rest', def: { type: 'skip_rest' } },
  { phrase: 'mark complete', def: { type: 'complete_set' } },
  { phrase: 'set complete', def: { type: 'complete_set' } },
  { phrase: 'complete set', def: { type: 'complete_set' } },
  { phrase: 'complete', def: { type: 'complete_set' } },
  { phrase: 'log it', def: { type: 'complete_set' } },
  { phrase: 'log set', def: { type: 'complete_set' } },
  { phrase: 'done', def: { type: 'complete_set' } },
  { phrase: 'keep going', def: { type: 'resume' } },
  { phrase: 'resume', def: { type: 'resume' } },
  { phrase: 'continue', def: { type: 'resume' } },
  { phrase: 'unpause', def: { type: 'resume' } },
  { phrase: 'play', def: { type: 'resume' } },
  { phrase: 'hold on', def: { type: 'pause' } },
  { phrase: 'pause', def: { type: 'pause' } },
  { phrase: 'stop', def: { type: 'pause' } },
];

// Longest phrase first so a superstring phrase ("skip the rest") always beats
// its shorter neighbours ("skip rest") and ambiguity resolves deterministically.
const SORTED_PHRASES = [...PHRASES].sort((a, b) => b.phrase.length - a.phrase.length);

const PHRASE_REGEXPS: ReadonlyArray<{ regex: RegExp; def: PhraseDef; phrase: string }> =
  SORTED_PHRASES.map(({ phrase, def }) => ({
    regex: new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    def,
    phrase,
  }));

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

// Compound ("forty five") must precede the bare tens, and longer single words
// precede their prefixes, so alternation captures the fullest number token.
const NUMBER_TOKEN =
  '(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\\s-](?:one|two|three|four|five|six|seven|eight|nine)' +
  '|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred' +
  '|nineteen|eighteen|seventeen|sixteen|fifteen|fourteen|thirteen|twelve|eleven|ten' +
  '|nine|eight|seven|six|five|four|three|two|one' +
  '|\\d+(?:\\.\\d+)?';

function tokenToNumber(token: string): number | null {
  const compound = token.match(
    /^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](one|two|three|four|five|six|seven|eight|nine)$/,
  );
  if (compound) return WORD_NUMBERS[compound[1]] + WORD_NUMBERS[compound[2]];
  if (token in WORD_NUMBERS) return WORD_NUMBERS[token];
  if (/^\d+(?:\.\d+)?$/.test(token)) return Number.parseFloat(token);
  return null;
}

// "set weight to 185" / "weight 185" / "185 pounds". Reps mirror this with a
// "reps" anchor. A bare number is intentionally NOT matched: it is too easy to
// misfire on gym chatter, so a magnitude only lands when the domain word is said.
const WEIGHT_REGEXPS: ReadonlyArray<RegExp> = [
  new RegExp(`\\b(?:set\\s+)?weight(?:\\s+to)?\\s+(${NUMBER_TOKEN})\\b`, 'i'),
  new RegExp(`\\b(${NUMBER_TOKEN})\\s+(?:pounds?|lbs?|kilos?|kilograms?|kgs?)\\b`, 'i'),
];

const REPS_REGEXPS: ReadonlyArray<RegExp> = [
  new RegExp(`\\b(?:set\\s+)?reps?(?:\\s+to)?\\s+(${NUMBER_TOKEN})\\b`, 'i'),
  new RegExp(`\\b(${NUMBER_TOKEN})\\s+reps?\\b`, 'i'),
];

function matchNumberAction(normalized: string): SessionVoiceAction | null {
  for (const regex of WEIGHT_REGEXPS) {
    const found = normalized.match(regex);
    if (found) {
      const value = tokenToNumber(found[1]);
      if (value !== null && value > 0) return { kind: 'set_weight', value };
    }
  }
  for (const regex of REPS_REGEXPS) {
    const found = normalized.match(regex);
    if (found) {
      const value = tokenToNumber(found[1]);
      if (value !== null && value > 0) return { kind: 'set_reps', value };
    }
  }
  return null;
}

function buildAction(def: PhraseDef): SessionVoiceAction {
  switch (def.type) {
    case 'complete_set':
      return { kind: 'complete_set' };
    case 'skip_rest':
      return { kind: 'skip_rest' };
    case 'next_exercise':
      return { kind: 'next_exercise' };
    case 'previous_exercise':
      return { kind: 'previous_exercise' };
    case 'pause':
      return { kind: 'pause' };
    case 'resume':
      return { kind: 'resume' };
  }
}

function findLongestPhrase(text: string): { def: PhraseDef; phrase: string } | null {
  for (const entry of PHRASE_REGEXPS) {
    if (entry.regex.test(text)) return { def: entry.def, phrase: entry.phrase };
  }
  return null;
}

export function parseSessionCommand(transcript: string): SessionVoiceMatch | null {
  const normalized = transcript.toLowerCase().trim().replace(/\s+/g, ' ');
  if (!normalized) return null;

  // False-trigger guard: long gym chatter with no command near the end is
  // ignored (matches the player parser's tail guard). Number commands and
  // static phrases are both re-checked against the tail.
  const words = normalized.split(' ');
  const scope = words.length > 6 ? words.slice(-4).join(' ') : normalized;

  const numberAction = matchNumberAction(scope);
  if (numberAction) {
    return { action: numberAction, confidence: 0.8, raw: transcript };
  }

  const match = findLongestPhrase(scope);
  if (!match) return null;

  return {
    action: buildAction(match.def),
    confidence: normalized === match.phrase ? 1.0 : 0.8,
    raw: transcript,
  };
}

// Debounce key for the session grammar (useVoiceCoach's VoiceCoachGrammar.keyOf).
// Distinct commands differ by key so a new action fires immediately while a
// repeat of the same one is swallowed inside the debounce window; set_weight
// and set_reps additionally key on the spoken value so "reps 10" then "reps 12"
// both land instead of the second being swallowed as a repeat.
export function sessionCommandKey(match: SessionVoiceMatch): string {
  const action = match.action;
  switch (action.kind) {
    case 'set_weight':
      return `set_weight:${action.value}`;
    case 'set_reps':
      return `set_reps:${action.value}`;
    default:
      return action.kind;
  }
}

// Short toast label for an accepted command, mirroring describeCommand in
// voice-coach-core. For weight/reps the value is echoed so the toast is honest
// about what was set.
export function describeSessionCommand(action: SessionVoiceAction): string {
  switch (action.kind) {
    case 'complete_set':
      return 'Set complete';
    case 'skip_rest':
      return 'Rest skipped';
    case 'next_exercise':
      return 'Next exercise';
    case 'previous_exercise':
      return 'Previous exercise';
    case 'pause':
      return 'Paused';
    case 'resume':
      return 'Resumed';
    case 'set_weight':
      return `Weight ${action.value}`;
    case 'set_reps':
      return `Reps ${action.value}`;
  }
}

// Bias the recognizer toward the command vocabulary (same use as the player's
// getSupportedPlayerCommands). Includes the two number-command anchors.
export function getSupportedSessionCommands(): string[] {
  return [
    ...PHRASES.map((entry) => entry.phrase),
    'set weight to',
    'set reps to',
  ];
}
