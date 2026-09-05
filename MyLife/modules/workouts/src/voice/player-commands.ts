// Richer voice parser for hands-free video playback control (DoWork trainer player).
// Distinct from `../voice.ts` (`parseVoiceCommand`) which stays for compat; both are exported.

export type PlayerVoiceAction =
  | { kind: 'pause' }
  | { kind: 'play' }
  | { kind: 'seek'; deltaSeconds: number } // negative = back
  | { kind: 'restart' }
  | { kind: 'rate_step'; direction: 'down' | 'up' }
  | { kind: 'rate_set'; rate: number }
  | { kind: 'info'; query: 'current_exercise' | 'time_remaining' };

export interface PlayerVoiceMatch {
  action: PlayerVoiceAction;
  confidence: number; // 1.0 exact phrase match, 0.8 contained match
  raw: string;
}

export const PLAYER_RATE_LADDER = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

type PhraseDef =
  | { type: 'pause' }
  | { type: 'play' }
  | { type: 'restart' }
  | { type: 'rate_step'; direction: 'down' | 'up' }
  | { type: 'rate_set'; rate: number }
  | { type: 'seek'; sign: -1 | 1 }
  | { type: 'info'; query: 'current_exercise' | 'time_remaining' };

const PHRASES: ReadonlyArray<{ phrase: string; def: PhraseDef }> = [
  { phrase: 'slow it down', def: { type: 'rate_step', direction: 'down' } },
  { phrase: 'slow down', def: { type: 'rate_step', direction: 'down' } },
  { phrase: 'slower', def: { type: 'rate_step', direction: 'down' } },
  { phrase: 'speed it up', def: { type: 'rate_step', direction: 'up' } },
  { phrase: 'speed up', def: { type: 'rate_step', direction: 'up' } },
  { phrase: 'faster', def: { type: 'rate_step', direction: 'up' } },
  { phrase: 'normal speed', def: { type: 'rate_set', rate: 1 } },
  { phrase: 'regular speed', def: { type: 'rate_set', rate: 1 } },
  { phrase: 'full speed', def: { type: 'rate_set', rate: 1 } },
  { phrase: 'half speed', def: { type: 'rate_set', rate: 0.5 } },
  { phrase: 'back it up', def: { type: 'seek', sign: -1 } },
  { phrase: 'back up', def: { type: 'seek', sign: -1 } },
  { phrase: 'go back', def: { type: 'seek', sign: -1 } },
  { phrase: 'rewind', def: { type: 'seek', sign: -1 } },
  { phrase: 'skip forward', def: { type: 'seek', sign: 1 } },
  { phrase: 'skip ahead', def: { type: 'seek', sign: 1 } },
  { phrase: 'fast forward', def: { type: 'seek', sign: 1 } },
  { phrase: 'go forward', def: { type: 'seek', sign: 1 } },
  { phrase: 'pause', def: { type: 'pause' } },
  { phrase: 'stop', def: { type: 'pause' } },
  { phrase: 'hold on', def: { type: 'pause' } },
  { phrase: 'play', def: { type: 'play' } },
  { phrase: 'resume', def: { type: 'play' } },
  { phrase: 'keep going', def: { type: 'play' } },
  { phrase: 'continue', def: { type: 'play' } },
  { phrase: 'start over', def: { type: 'restart' } },
  { phrase: 'from the top', def: { type: 'restart' } },
  { phrase: 'restart', def: { type: 'restart' } },
  { phrase: 'what exercise', def: { type: 'info', query: 'current_exercise' } },
  { phrase: 'how much time', def: { type: 'info', query: 'time_remaining' } },
  { phrase: 'time left', def: { type: 'info', query: 'time_remaining' } },
];

// Longest phrase first so a superstring phrase ("slow it down") always beats its
// shorter neighbours and ambiguity resolves deterministically.
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
};

// Compound ("forty five") must precede the bare tens, and longer single words
// precede their prefixes, so alternation captures the fullest number token.
const NUMBER_TOKEN =
  '(?:twenty|thirty|forty|fifty|sixty)[\\s-](?:one|two|three|four|five|six|seven|eight|nine)' +
  '|twenty|thirty|forty|fifty|sixty' +
  '|nineteen|eighteen|seventeen|sixteen|fifteen|fourteen|thirteen|twelve|eleven|ten' +
  '|nine|eight|seven|six|five|four|three|two|one' +
  '|\\d+';

const DEFAULT_SEEK_SECONDS = 10;

function tokenToNumber(token: string): number | null {
  const compound = token.match(
    /^(twenty|thirty|forty|fifty|sixty)[\s-](one|two|three|four|five|six|seven|eight|nine)$/,
  );
  if (compound) return WORD_NUMBERS[compound[1]] + WORD_NUMBERS[compound[2]];
  if (token in WORD_NUMBERS) return WORD_NUMBERS[token];
  if (/^\d+$/.test(token)) return Number.parseInt(token, 10);
  return null;
}

// Returns an explicit duration in seconds, or null when the transcript names none
// (caller falls back to DEFAULT_SEEK_SECONDS).
function parseDurationSeconds(normalized: string): number | null {
  if (/\bhalf a minute\b/.test(normalized)) return 30;

  const minuteMatch = normalized.match(new RegExp(`\\b(${NUMBER_TOKEN})[\\s-]+minutes?\\b`));
  if (minuteMatch) {
    const value = tokenToNumber(minuteMatch[1]);
    if (value !== null) return value * 60;
  }
  if (/\ba minute\b/.test(normalized)) return 60;

  const secondMatch = normalized.match(new RegExp(`\\b(${NUMBER_TOKEN})[\\s-]+seconds?\\b`));
  if (secondMatch) {
    const value = tokenToNumber(secondMatch[1]);
    if (value !== null) return value;
  }

  const bareMatch = normalized.match(new RegExp(`\\b(${NUMBER_TOKEN})\\b`));
  if (bareMatch) {
    const value = tokenToNumber(bareMatch[1]);
    if (value !== null) return value;
  }

  return null;
}

function buildAction(def: PhraseDef, normalized: string): PlayerVoiceAction {
  switch (def.type) {
    case 'pause':
      return { kind: 'pause' };
    case 'play':
      return { kind: 'play' };
    case 'restart':
      return { kind: 'restart' };
    case 'rate_step':
      return { kind: 'rate_step', direction: def.direction };
    case 'rate_set':
      return { kind: 'rate_set', rate: def.rate };
    case 'info':
      return { kind: 'info', query: def.query };
    case 'seek': {
      const seconds = parseDurationSeconds(normalized) ?? DEFAULT_SEEK_SECONDS;
      return { kind: 'seek', deltaSeconds: def.sign * seconds };
    }
  }
}

function findLongestPhrase(text: string): { def: PhraseDef; phrase: string } | null {
  for (const entry of PHRASE_REGEXPS) {
    if (entry.regex.test(text)) return { def: entry.def, phrase: entry.phrase };
  }
  return null;
}

export function parsePlayerCommand(transcript: string): PlayerVoiceMatch | null {
  const normalized = transcript.toLowerCase().trim().replace(/\s+/g, ' ');
  if (!normalized) return null;

  // False-trigger guard: long gym chatter with no command near the end is ignored.
  const words = normalized.split(' ');
  if (words.length > 6) {
    const tail = words.slice(-4).join(' ');
    if (!findLongestPhrase(tail)) return null;
  }

  const match = findLongestPhrase(normalized);
  if (!match) return null;

  return {
    action: buildAction(match.def, normalized),
    confidence: normalized === match.phrase ? 1.0 : 0.8,
    raw: transcript,
  };
}

export function stepRate(current: number, direction: 'down' | 'up'): number {
  let nearestIndex = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < PLAYER_RATE_LADDER.length; i++) {
    const diff = Math.abs(PLAYER_RATE_LADDER[i] - current);
    if (diff < bestDiff) {
      bestDiff = diff;
      nearestIndex = i;
    }
  }
  const delta = direction === 'up' ? 1 : -1;
  const nextIndex = Math.min(PLAYER_RATE_LADDER.length - 1, Math.max(0, nearestIndex + delta));
  return PLAYER_RATE_LADDER[nextIndex];
}

export function getSupportedPlayerCommands(): string[] {
  return PHRASES.map((entry) => entry.phrase);
}
