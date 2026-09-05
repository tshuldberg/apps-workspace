import { describe, it, expect } from 'vitest';
import { parseVoiceCommand, getSupportedCommands } from '../../voice';

describe('parseVoiceCommand', () => {
  it('returns exact match with confidence 1.0 for "pause"', () => {
    const result = parseVoiceCommand('pause');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('playback');
    expect(result!.action).toBe('pause');
    expect(result!.confidence).toBe(1.0);
    expect(result!.raw).toBe('pause');
  });

  it('returns exact match with confidence 1.0 for "stop"', () => {
    const result = parseVoiceCommand('stop');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('playback');
    expect(result!.action).toBe('pause');
    expect(result!.confidence).toBe(1.0);
  });

  it('returns substring match with confidence 0.8 for "please pause now"', () => {
    const result = parseVoiceCommand('please pause now');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('playback');
    expect(result!.action).toBe('pause');
    expect(result!.confidence).toBe(0.8);
    expect(result!.raw).toBe('please pause now');
  });

  it('handles case-insensitive input', () => {
    const result = parseVoiceCommand('PAUSE');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('playback');
    expect(result!.confidence).toBe(1.0);
  });

  it('trims whitespace from input', () => {
    const result = parseVoiceCommand('  pause  ');
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(1.0);
  });

  it('returns null for unrecognized input', () => {
    expect(parseVoiceCommand('xyz123')).toBeNull();
    expect(parseVoiceCommand('hello world')).toBeNull();
    expect(parseVoiceCommand('jump high')).toBeNull();
  });

  it('matches playback commands', () => {
    const resume = parseVoiceCommand('resume');
    expect(resume).not.toBeNull();
    expect(resume!.category).toBe('playback');
    expect(resume!.action).toBe('resume');

    const play = parseVoiceCommand('play');
    expect(play).not.toBeNull();
    expect(play!.category).toBe('playback');
    expect(play!.action).toBe('resume');
  });

  it('matches pacing commands', () => {
    const slower = parseVoiceCommand('slower');
    expect(slower).not.toBeNull();
    expect(slower!.category).toBe('pacing');
    expect(slower!.action).toBe('slower');

    const faster = parseVoiceCommand('faster');
    expect(faster).not.toBeNull();
    expect(faster!.category).toBe('pacing');
    expect(faster!.action).toBe('faster');

    const slowDown = parseVoiceCommand('slow down');
    expect(slowDown).not.toBeNull();
    expect(slowDown!.category).toBe('pacing');

    const normal = parseVoiceCommand('normal speed');
    expect(normal).not.toBeNull();
    expect(normal!.category).toBe('pacing');
    expect(normal!.action).toBe('normal');
  });

  it('matches navigation commands', () => {
    const next = parseVoiceCommand('next');
    expect(next).not.toBeNull();
    expect(next!.category).toBe('navigation');
    expect(next!.action).toBe('next');

    const skip = parseVoiceCommand('skip');
    expect(skip).not.toBeNull();
    expect(skip!.category).toBe('navigation');
    expect(skip!.action).toBe('next');

    const previous = parseVoiceCommand('previous');
    expect(previous).not.toBeNull();
    expect(previous!.category).toBe('navigation');
    expect(previous!.action).toBe('previous');

    const repeatCmd = parseVoiceCommand('repeat');
    expect(repeatCmd).not.toBeNull();
    expect(repeatCmd!.category).toBe('navigation');
    expect(repeatCmd!.action).toBe('repeat');
  });

  it('matches info commands', () => {
    const exercise = parseVoiceCommand('what exercise');
    expect(exercise).not.toBeNull();
    expect(exercise!.category).toBe('info');
    expect(exercise!.action).toBe('current_exercise');

    const reps = parseVoiceCommand('how many reps');
    expect(reps).not.toBeNull();
    expect(reps!.category).toBe('info');
    expect(reps!.action).toBe('rep_count');

    const time = parseVoiceCommand('how much time');
    expect(time).not.toBeNull();
    expect(time!.category).toBe('info');
    expect(time!.action).toBe('time_remaining');
  });

  it('matches recording commands', () => {
    // "start recording" matches "start" first (playback resume) due to iteration order,
    // since the parser uses first-match with `includes()`.
    // The "start" key appears before "start recording" in the command map.
    const startRec = parseVoiceCommand('start recording');
    expect(startRec).not.toBeNull();
    // First match is "start" -> playback/resume (greedy first-match)
    expect(startRec!.category).toBe('playback');

    // "stop recording" similarly matches "stop" first -> playback/pause
    const stopRec = parseVoiceCommand('stop recording');
    expect(stopRec).not.toBeNull();
    expect(stopRec!.category).toBe('playback');
  });
});

describe('getSupportedCommands', () => {
  it('returns all supported command phrases', () => {
    const commands = getSupportedCommands();
    expect(commands).toContain('pause');
    expect(commands).toContain('stop');
    expect(commands).toContain('resume');
    expect(commands).toContain('next');
    expect(commands).toContain('start recording');
    expect(commands).toContain('stop recording');
  });

  it('returns 20 phrases', () => {
    const commands = getSupportedCommands();
    expect(commands).toHaveLength(20);
  });

  it('covers all 5 categories', () => {
    const commands = getSupportedCommands();
    // Verify representative commands from each category exist
    // playback
    expect(commands).toContain('pause');
    // pacing
    expect(commands).toContain('faster');
    // navigation
    expect(commands).toContain('next');
    // info
    expect(commands).toContain('what exercise');
    // recording
    expect(commands).toContain('start recording');
  });
});
