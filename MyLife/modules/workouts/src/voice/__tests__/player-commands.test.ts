import { describe, it, expect } from 'vitest';
import {
  parsePlayerCommand,
  stepRate,
  getSupportedPlayerCommands,
  PLAYER_RATE_LADDER,
} from '../player-commands';

describe('parsePlayerCommand - pause / play', () => {
  it('matches "pause" exactly with confidence 1.0', () => {
    const result = parsePlayerCommand('pause');
    expect(result).not.toBeNull();
    expect(result!.action).toEqual({ kind: 'pause' });
    expect(result!.confidence).toBe(1.0);
    expect(result!.raw).toBe('pause');
  });

  it('matches "stop" -> pause', () => {
    expect(parsePlayerCommand('stop')!.action).toEqual({ kind: 'pause' });
  });

  it('matches "hold on" -> pause', () => {
    expect(parsePlayerCommand('hold on')!.action).toEqual({ kind: 'pause' });
  });

  it('matches contained "please pause now" with confidence 0.8', () => {
    const result = parsePlayerCommand('please pause now');
    expect(result!.action).toEqual({ kind: 'pause' });
    expect(result!.confidence).toBe(0.8);
    expect(result!.raw).toBe('please pause now');
  });

  it('is case-insensitive: "PAUSE" -> pause with confidence 1.0', () => {
    const result = parsePlayerCommand('PAUSE');
    expect(result!.action).toEqual({ kind: 'pause' });
    expect(result!.confidence).toBe(1.0);
  });

  it('matches "play" -> play', () => {
    const result = parsePlayerCommand('play');
    expect(result!.action).toEqual({ kind: 'play' });
    expect(result!.confidence).toBe(1.0);
  });

  it('matches "resume" -> play', () => {
    expect(parsePlayerCommand('resume')!.action).toEqual({ kind: 'play' });
  });

  it('matches "keep going" -> play', () => {
    expect(parsePlayerCommand('keep going')!.action).toEqual({ kind: 'play' });
  });

  it('matches "continue" -> play', () => {
    expect(parsePlayerCommand('continue')!.action).toEqual({ kind: 'play' });
  });
});

describe('parsePlayerCommand - rate step / set', () => {
  it('matches "slow down" -> rate_step down', () => {
    const result = parsePlayerCommand('slow down');
    expect(result!.action).toEqual({ kind: 'rate_step', direction: 'down' });
    expect(result!.confidence).toBe(1.0);
  });

  it('matches "slower" -> rate_step down', () => {
    expect(parsePlayerCommand('slower')!.action).toEqual({ kind: 'rate_step', direction: 'down' });
  });

  it('matches "slow it down" -> rate_step down (longest phrase wins)', () => {
    expect(parsePlayerCommand('slow it down')!.action).toEqual({
      kind: 'rate_step',
      direction: 'down',
    });
  });

  it('matches "speed up" -> rate_step up', () => {
    expect(parsePlayerCommand('speed up')!.action).toEqual({ kind: 'rate_step', direction: 'up' });
  });

  it('matches "faster" -> rate_step up', () => {
    expect(parsePlayerCommand('faster')!.action).toEqual({ kind: 'rate_step', direction: 'up' });
  });

  it('matches "speed it up" -> rate_step up', () => {
    expect(parsePlayerCommand('speed it up')!.action).toEqual({ kind: 'rate_step', direction: 'up' });
  });

  it('matches "normal speed" -> rate_set 1', () => {
    expect(parsePlayerCommand('normal speed')!.action).toEqual({ kind: 'rate_set', rate: 1 });
  });

  it('matches "regular speed" -> rate_set 1', () => {
    expect(parsePlayerCommand('regular speed')!.action).toEqual({ kind: 'rate_set', rate: 1 });
  });

  it('matches "full speed" -> rate_set 1', () => {
    expect(parsePlayerCommand('full speed')!.action).toEqual({ kind: 'rate_set', rate: 1 });
  });

  it('matches "half speed" -> rate_set 0.5', () => {
    expect(parsePlayerCommand('half speed')!.action).toEqual({ kind: 'rate_set', rate: 0.5 });
  });
});

describe('parsePlayerCommand - seek defaults', () => {
  it('matches "back up" -> seek -10', () => {
    const result = parsePlayerCommand('back up');
    expect(result!.action).toEqual({ kind: 'seek', deltaSeconds: -10 });
    expect(result!.confidence).toBe(1.0);
  });

  it('matches "go back" -> seek -10', () => {
    expect(parsePlayerCommand('go back')!.action).toEqual({ kind: 'seek', deltaSeconds: -10 });
  });

  it('matches "rewind" -> seek -10', () => {
    expect(parsePlayerCommand('rewind')!.action).toEqual({ kind: 'seek', deltaSeconds: -10 });
  });

  it('matches "back it up" -> seek -10', () => {
    expect(parsePlayerCommand('back it up')!.action).toEqual({ kind: 'seek', deltaSeconds: -10 });
  });

  it('matches "skip ahead" -> seek +10', () => {
    expect(parsePlayerCommand('skip ahead')!.action).toEqual({ kind: 'seek', deltaSeconds: 10 });
  });

  it('matches "go forward" -> seek +10', () => {
    expect(parsePlayerCommand('go forward')!.action).toEqual({ kind: 'seek', deltaSeconds: 10 });
  });

  it('matches "fast forward" -> seek +10', () => {
    expect(parsePlayerCommand('fast forward')!.action).toEqual({ kind: 'seek', deltaSeconds: 10 });
  });

  it('matches "skip forward" -> seek +10', () => {
    expect(parsePlayerCommand('skip forward')!.action).toEqual({ kind: 'seek', deltaSeconds: 10 });
  });
});

describe('parsePlayerCommand - seek durations', () => {
  it('parses "back up thirty seconds" -> seek -30 with confidence 0.8', () => {
    const result = parsePlayerCommand('back up thirty seconds');
    expect(result!.action).toEqual({ kind: 'seek', deltaSeconds: -30 });
    expect(result!.confidence).toBe(0.8);
  });

  it('parses bare number "go back 15" -> seek -15 (seconds)', () => {
    expect(parsePlayerCommand('go back 15')!.action).toEqual({ kind: 'seek', deltaSeconds: -15 });
  });

  it('parses "rewind one minute" -> seek -60', () => {
    expect(parsePlayerCommand('rewind one minute')!.action).toEqual({ kind: 'seek', deltaSeconds: -60 });
  });

  it('parses "back up half a minute" -> seek -30', () => {
    expect(parsePlayerCommand('back up half a minute')!.action).toEqual({
      kind: 'seek',
      deltaSeconds: -30,
    });
  });

  it('parses "go back a minute" -> seek -60', () => {
    expect(parsePlayerCommand('go back a minute')!.action).toEqual({ kind: 'seek', deltaSeconds: -60 });
  });

  it('parses "skip ahead twenty seconds" -> seek +20', () => {
    expect(parsePlayerCommand('skip ahead twenty seconds')!.action).toEqual({
      kind: 'seek',
      deltaSeconds: 20,
    });
  });

  it('parses digit "back up 45" -> seek -45', () => {
    expect(parsePlayerCommand('back up 45')!.action).toEqual({ kind: 'seek', deltaSeconds: -45 });
  });

  it('parses compound word "back up forty five seconds" -> seek -45', () => {
    expect(parsePlayerCommand('back up forty five seconds')!.action).toEqual({
      kind: 'seek',
      deltaSeconds: -45,
    });
  });

  it('parses "skip ahead two minutes" -> seek +120', () => {
    expect(parsePlayerCommand('skip ahead two minutes')!.action).toEqual({
      kind: 'seek',
      deltaSeconds: 120,
    });
  });

  it('parses digit minutes "go back 2 minutes" -> seek -120', () => {
    expect(parsePlayerCommand('go back 2 minutes')!.action).toEqual({ kind: 'seek', deltaSeconds: -120 });
  });
});

describe('parsePlayerCommand - restart / info', () => {
  it('matches "start over" -> restart', () => {
    expect(parsePlayerCommand('start over')!.action).toEqual({ kind: 'restart' });
  });

  it('matches "from the top" -> restart', () => {
    expect(parsePlayerCommand('from the top')!.action).toEqual({ kind: 'restart' });
  });

  it('matches "restart" -> restart', () => {
    expect(parsePlayerCommand('restart')!.action).toEqual({ kind: 'restart' });
  });

  it('matches "what exercise" -> info current_exercise', () => {
    expect(parsePlayerCommand('what exercise')!.action).toEqual({
      kind: 'info',
      query: 'current_exercise',
    });
  });

  it('matches "how much time" -> info time_remaining', () => {
    expect(parsePlayerCommand('how much time')!.action).toEqual({
      kind: 'info',
      query: 'time_remaining',
    });
  });

  it('matches "time left" -> info time_remaining', () => {
    expect(parsePlayerCommand('time left')!.action).toEqual({
      kind: 'info',
      query: 'time_remaining',
    });
  });
});

describe('parsePlayerCommand - boundaries and ambiguity', () => {
  it('"start over" resolves to restart, never pause', () => {
    const result = parsePlayerCommand('start over');
    expect(result!.action.kind).toBe('restart');
    expect(result!.action.kind).not.toBe('pause');
  });

  it('"playlist" does not trigger play (word-boundary matching)', () => {
    expect(parsePlayerCommand('playlist')).toBeNull();
  });

  it('"fast forward" does not resolve to rate_step up via "faster"', () => {
    expect(parsePlayerCommand('fast forward')!.action).toEqual({ kind: 'seek', deltaSeconds: 10 });
  });

  it('contained-match design: "dont slow down yet" still matches rate_step down', () => {
    const result = parsePlayerCommand('dont slow down yet');
    expect(result!.action).toEqual({ kind: 'rate_step', direction: 'down' });
    expect(result!.confidence).toBe(0.8);
  });

  it('trims and collapses whitespace: "  slow   down  " -> rate_step down confidence 1.0', () => {
    const result = parsePlayerCommand('  slow   down  ');
    expect(result!.action).toEqual({ kind: 'rate_step', direction: 'down' });
    expect(result!.confidence).toBe(1.0);
  });
});

describe('parsePlayerCommand - null cases', () => {
  it('returns null for unrelated speech "nice set bro"', () => {
    expect(parsePlayerCommand('nice set bro')).toBeNull();
  });

  it('returns null for "hello world"', () => {
    expect(parsePlayerCommand('hello world')).toBeNull();
  });

  it('returns null for empty transcript', () => {
    expect(parsePlayerCommand('')).toBeNull();
    expect(parsePlayerCommand('   ')).toBeNull();
  });
});

describe('parsePlayerCommand - false-trigger guard', () => {
  it('returns null when a long transcript has no command in the final 4 words', () => {
    // "pause" appears early but the tail is gym conversation.
    const result = parsePlayerCommand('pause for a second we should grab lunch after this set');
    expect(result).toBeNull();
  });

  it('matches when a long transcript has the command within the final 4 words', () => {
    const result = parsePlayerCommand('we can grab lunch after but first slow down');
    expect(result!.action).toEqual({ kind: 'rate_step', direction: 'down' });
  });

  it('does not apply the guard for transcripts of 6 words or fewer', () => {
    const result = parsePlayerCommand('slow down for me right now');
    expect(result!.action).toEqual({ kind: 'rate_step', direction: 'down' });
  });

  it('returns null for a long non-command conversation', () => {
    expect(
      parsePlayerCommand('that was a really solid set man you crushed it today'),
    ).toBeNull();
  });
});

describe('stepRate', () => {
  it('steps up from 1 to 1.25', () => {
    expect(stepRate(1, 'up')).toBe(1.25);
  });

  it('steps down from 1 to 0.75', () => {
    expect(stepRate(1, 'down')).toBe(0.75);
  });

  it('clamps at the top of the ladder', () => {
    expect(stepRate(2, 'up')).toBe(2);
  });

  it('clamps at the bottom of the ladder', () => {
    expect(stepRate(0.25, 'down')).toBe(0.25);
  });

  it('snaps off-ladder value 0.9 to nearest (1) then steps up to 1.25', () => {
    expect(stepRate(0.9, 'up')).toBe(1.25);
  });

  it('snaps off-ladder value 0.9 to nearest (1) then steps down to 0.75', () => {
    expect(stepRate(0.9, 'down')).toBe(0.75);
  });

  it('snaps off-ladder value 0.6 to nearest (0.5) then steps up to 0.75', () => {
    expect(stepRate(0.6, 'up')).toBe(0.75);
  });

  it('walks the full ladder stepping up', () => {
    let rate = 0.25;
    const seen = [rate];
    for (let i = 0; i < PLAYER_RATE_LADDER.length + 2; i++) {
      rate = stepRate(rate, 'up');
      seen.push(rate);
    }
    expect(seen).toContain(0.5);
    expect(seen).toContain(1);
    expect(seen).toContain(2);
    expect(rate).toBe(2);
  });
});

describe('getSupportedPlayerCommands', () => {
  it('includes a representative phrase from every action group', () => {
    const commands = getSupportedPlayerCommands();
    expect(commands).toContain('pause');
    expect(commands).toContain('play');
    expect(commands).toContain('slow down');
    expect(commands).toContain('speed up');
    expect(commands).toContain('normal speed');
    expect(commands).toContain('half speed');
    expect(commands).toContain('back up');
    expect(commands).toContain('skip ahead');
    expect(commands).toContain('start over');
    expect(commands).toContain('what exercise');
    expect(commands).toContain('time left');
  });

  it('returns 31 phrases', () => {
    expect(getSupportedPlayerCommands()).toHaveLength(31);
  });
});

describe('PLAYER_RATE_LADDER', () => {
  it('is the expected ordered ladder', () => {
    expect([...PLAYER_RATE_LADDER]).toEqual([0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]);
  });
});
