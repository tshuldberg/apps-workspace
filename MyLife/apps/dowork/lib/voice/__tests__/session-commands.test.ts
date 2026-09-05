import { describe, expect, it } from 'vitest';
import {
  describeSessionCommand,
  getSupportedSessionCommands,
  parseSessionCommand,
} from '../session-commands';

describe('session-commands: parseSessionCommand', () => {
  it('recognizes set completion phrases', () => {
    expect(parseSessionCommand('mark complete')?.action).toEqual({ kind: 'complete_set' });
    expect(parseSessionCommand('complete set')?.action).toEqual({ kind: 'complete_set' });
    expect(parseSessionCommand('set complete')?.action).toEqual({ kind: 'complete_set' });
    expect(parseSessionCommand('log it')?.action).toEqual({ kind: 'complete_set' });
    expect(parseSessionCommand('done')?.action).toEqual({ kind: 'complete_set' });
  });

  it('recognizes exercise navigation phrases', () => {
    expect(parseSessionCommand('next exercise')?.action).toEqual({ kind: 'next_exercise' });
    expect(parseSessionCommand('skip exercise')?.action).toEqual({ kind: 'next_exercise' });
    expect(parseSessionCommand('previous exercise')?.action).toEqual({ kind: 'previous_exercise' });
    expect(parseSessionCommand('last exercise')?.action).toEqual({ kind: 'previous_exercise' });
    expect(parseSessionCommand('go back')?.action).toEqual({ kind: 'previous_exercise' });
  });

  it('recognizes rest timer phrases', () => {
    expect(parseSessionCommand('skip rest')?.action).toEqual({ kind: 'skip_rest' });
    expect(parseSessionCommand('done resting')?.action).toEqual({ kind: 'skip_rest' });
    expect(parseSessionCommand('end rest')?.action).toEqual({ kind: 'skip_rest' });
  });

  it('recognizes pause/resume phrases', () => {
    expect(parseSessionCommand('pause')?.action).toEqual({ kind: 'pause' });
    expect(parseSessionCommand('hold on')?.action).toEqual({ kind: 'pause' });
    expect(parseSessionCommand('resume')?.action).toEqual({ kind: 'resume' });
    expect(parseSessionCommand('keep going')?.action).toEqual({ kind: 'resume' });
    expect(parseSessionCommand('continue')?.action).toEqual({ kind: 'resume' });
  });

  it('parses numeric reps commands, digits and words', () => {
    expect(parseSessionCommand('reps 10')?.action).toEqual({ kind: 'set_reps', value: 10 });
    expect(parseSessionCommand('10 reps')?.action).toEqual({ kind: 'set_reps', value: 10 });
    expect(parseSessionCommand('set reps to twelve')?.action).toEqual({
      kind: 'set_reps',
      value: 12,
    });
  });

  it('parses numeric weight commands, digits and words', () => {
    expect(parseSessionCommand('weight 185')?.action).toEqual({ kind: 'set_weight', value: 185 });
    expect(parseSessionCommand('set weight to 225')?.action).toEqual({
      kind: 'set_weight',
      value: 225,
    });
    expect(parseSessionCommand('135 pounds')?.action).toEqual({ kind: 'set_weight', value: 135 });
    expect(parseSessionCommand('forty five kilos')?.action).toEqual({
      kind: 'set_weight',
      value: 45,
    });
  });

  it('parses compound spoken numbers', () => {
    expect(parseSessionCommand('reps twenty five')?.action).toEqual({
      kind: 'set_reps',
      value: 25,
    });
    expect(parseSessionCommand('weight ninety nine')?.action).toEqual({
      kind: 'set_weight',
      value: 99,
    });
  });

  it('does not fire on a bare number without a domain word', () => {
    expect(parseSessionCommand('ten')).toBeNull();
    expect(parseSessionCommand('185')).toBeNull();
  });

  it('returns null for unrecognized chatter', () => {
    expect(parseSessionCommand('nice set man')).toBeNull();
    expect(parseSessionCommand('')).toBeNull();
    expect(parseSessionCommand('   ')).toBeNull();
  });

  it('prefers the longest matching phrase', () => {
    expect(parseSessionCommand('skip the rest')?.action).toEqual({ kind: 'skip_rest' });
  });

  it('applies a tail guard so long chatter needs a command near the end', () => {
    expect(parseSessionCommand('yeah man that was heavy but I got it done')?.action).toEqual({
      kind: 'complete_set',
    });
    expect(
      parseSessionCommand('yeah man that was heavy but I think I need more chalk'),
    ).toBeNull();
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(parseSessionCommand('  NEXT EXERCISE  ')?.action).toEqual({ kind: 'next_exercise' });
  });
});

describe('session-commands: describeSessionCommand', () => {
  it('labels session actions', () => {
    expect(describeSessionCommand({ kind: 'complete_set' })).toBe('Set complete');
    expect(describeSessionCommand({ kind: 'skip_rest' })).toBe('Rest skipped');
    expect(describeSessionCommand({ kind: 'next_exercise' })).toBe('Next exercise');
    expect(describeSessionCommand({ kind: 'previous_exercise' })).toBe('Previous exercise');
    expect(describeSessionCommand({ kind: 'pause' })).toBe('Paused');
    expect(describeSessionCommand({ kind: 'resume' })).toBe('Resumed');
  });

  it('echoes the value for weight and reps commands', () => {
    expect(describeSessionCommand({ kind: 'set_weight', value: 185 })).toBe('Weight 185');
    expect(describeSessionCommand({ kind: 'set_reps', value: 10 })).toBe('Reps 10');
  });
});

describe('session-commands: getSupportedSessionCommands', () => {
  it('returns a non-empty list of phrases for recognizer biasing', () => {
    const commands = getSupportedSessionCommands();
    expect(commands.length).toBeGreaterThan(0);
    expect(commands).toContain('mark complete');
  });
});
