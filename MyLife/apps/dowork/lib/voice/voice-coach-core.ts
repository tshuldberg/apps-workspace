// Pure controller for the hands-free voice coach. No React, no native modules:
// takes transcripts + a clock, returns the command to run (if any) and the next
// state. The hook (useVoiceCoach) owns recognition + timers and delegates the
// decision logic here so it stays fully unit-testable.
//
// The debounce logic is grammar-agnostic (processTranscriptWith) so both the
// player parser and the session parser reuse it; processTranscript stays as the
// player-bound wrapper for existing callers.

import { parsePlayerCommand, type PlayerVoiceAction, type PlayerVoiceMatch } from '@mylife/workouts';

// One accepted action per identical command within this window. Continuous
// recognition re-fires interim + final results for a single utterance many
// times a second; without this a single "slow down" would step the rate twice.
export const VOICE_COMMAND_DEBOUNCE_MS = 1500;

export interface VoiceCoachState {
  lastKey: string | null;
  lastAt: number;
}

export function createVoiceCoachState(): VoiceCoachState {
  return { lastKey: null, lastAt: 0 };
}

// Distinct commands must differ by key so a different action fires immediately
// while a repeat of the same one is debounced.
function actionKey(action: PlayerVoiceAction): string {
  switch (action.kind) {
    case 'seek':
      return `seek:${action.deltaSeconds}`;
    case 'rate_step':
      return `rate_step:${action.direction}`;
    case 'rate_set':
      return `rate_set:${action.rate}`;
    case 'info':
      return `info:${action.query}`;
    default:
      return action.kind;
  }
}

// A parsed command from any grammar. `keyOf` yields the debounce key so repeats
// of the same command are swallowed while a distinct command fires immediately.
export interface CommandGrammar<M> {
  parse: (transcript: string) => M | null;
  keyOf: (match: M) => string;
}

export interface ProcessResultOf<M> {
  state: VoiceCoachState;
  command: M | null;
}

// Grammar-agnostic transcript processor: debounces identical commands within
// VOICE_COMMAND_DEBOUNCE_MS. The window is anchored to the last accept, not slid
// by swallowed repeats, so a genuinely held command re-fires once per interval.
export function processTranscriptWith<M>(
  grammar: CommandGrammar<M>,
  state: VoiceCoachState,
  transcript: string,
  nowMs: number,
): ProcessResultOf<M> {
  const match = grammar.parse(transcript);
  if (!match) return { state, command: null };

  const key = grammar.keyOf(match);
  if (state.lastKey === key && nowMs - state.lastAt < VOICE_COMMAND_DEBOUNCE_MS) {
    return { state, command: null };
  }

  return { state: { lastKey: key, lastAt: nowMs }, command: match };
}

const PLAYER_GRAMMAR: CommandGrammar<PlayerVoiceMatch> = {
  parse: parsePlayerCommand,
  keyOf: (match) => actionKey(match.action),
};

export interface ProcessResult {
  state: VoiceCoachState;
  command: PlayerVoiceMatch | null;
}

export function processTranscript(
  state: VoiceCoachState,
  transcript: string,
  nowMs: number,
): ProcessResult {
  return processTranscriptWith(PLAYER_GRAMMAR, state, transcript, nowMs);
}

function formatRate(rate: number): string {
  return String(rate);
}

// Short toast label for an accepted command. For rate changes pass the rate the
// player actually landed on (post stepRate) so the toast reflects reality.
export function describeCommand(action: PlayerVoiceAction, resultRate?: number): string {
  switch (action.kind) {
    case 'pause':
      return 'Paused';
    case 'play':
      return 'Playing';
    case 'restart':
      return 'From the top';
    case 'seek': {
      const seconds = Math.abs(Math.round(action.deltaSeconds));
      return action.deltaSeconds < 0 ? `Back ${seconds} s` : `Forward ${seconds} s`;
    }
    case 'rate_step': {
      if (resultRate === undefined) return action.direction === 'down' ? 'Slower' : 'Faster';
      return action.direction === 'down'
        ? `Slowed to ${formatRate(resultRate)}x`
        : `Sped up to ${formatRate(resultRate)}x`;
    }
    case 'rate_set': {
      const rate = resultRate ?? action.rate;
      return rate === 1 ? 'Normal speed' : `Speed ${formatRate(rate)}x`;
    }
    case 'info':
      return action.query === 'current_exercise' ? 'Current exercise' : 'Time remaining';
  }
}
