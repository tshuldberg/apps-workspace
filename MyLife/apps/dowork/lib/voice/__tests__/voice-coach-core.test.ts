import { describe, expect, it } from 'vitest';
import {
  createVoiceCoachState,
  describeCommand,
  processTranscript,
  VOICE_COMMAND_DEBOUNCE_MS,
} from '../voice-coach-core';

describe('voice-coach-core: processTranscript', () => {
  it('passes a recognized command through and records its key', () => {
    const { state, command } = processTranscript(createVoiceCoachState(), 'slow down', 1000);
    expect(command).not.toBeNull();
    expect(command?.action).toEqual({ kind: 'rate_step', direction: 'down' });
    expect(state.lastAt).toBe(1000);
  });

  it('returns null for a transcript with no command', () => {
    const result = processTranscript(createVoiceCoachState(), 'nice set man', 1000);
    expect(result.command).toBeNull();
    expect(result.state.lastKey).toBeNull();
  });

  it('swallows the same command inside the debounce window', () => {
    let state = createVoiceCoachState();
    const first = processTranscript(state, 'slow down', 1000);
    expect(first.command).not.toBeNull();
    state = first.state;

    const repeat = processTranscript(state, 'slow down', 1000 + VOICE_COMMAND_DEBOUNCE_MS - 1);
    expect(repeat.command).toBeNull();
    // window is anchored to the last accept, not slid by swallowed repeats
    expect(repeat.state.lastAt).toBe(1000);
  });

  it('re-fires the same command once the window passes', () => {
    let state = createVoiceCoachState();
    state = processTranscript(state, 'slow down', 1000).state;
    const again = processTranscript(state, 'slow down', 1000 + VOICE_COMMAND_DEBOUNCE_MS);
    expect(again.command).not.toBeNull();
    expect(again.state.lastAt).toBe(1000 + VOICE_COMMAND_DEBOUNCE_MS);
  });

  it('lets a different command fire immediately within the window', () => {
    let state = createVoiceCoachState();
    state = processTranscript(state, 'slow down', 1000).state;
    const other = processTranscript(state, 'speed up', 1100);
    expect(other.command?.action).toEqual({ kind: 'rate_step', direction: 'up' });
  });

  it('treats seeks with different deltas as distinct commands', () => {
    let state = createVoiceCoachState();
    const back = processTranscript(state, 'go back', 1000);
    expect(back.command?.action).toEqual({ kind: 'seek', deltaSeconds: -10 });
    state = back.state;
    const forward = processTranscript(state, 'skip ahead', 1100);
    expect(forward.command?.action).toEqual({ kind: 'seek', deltaSeconds: 10 });
  });
});

describe('voice-coach-core: describeCommand', () => {
  it('labels transport commands', () => {
    expect(describeCommand({ kind: 'pause' })).toBe('Paused');
    expect(describeCommand({ kind: 'play' })).toBe('Playing');
    expect(describeCommand({ kind: 'restart' })).toBe('From the top');
  });

  it('labels seeks with direction and magnitude', () => {
    expect(describeCommand({ kind: 'seek', deltaSeconds: -10 })).toBe('Back 10 s');
    expect(describeCommand({ kind: 'seek', deltaSeconds: 15 })).toBe('Forward 15 s');
  });

  it('labels rate steps with the resulting rate', () => {
    expect(describeCommand({ kind: 'rate_step', direction: 'down' }, 0.75)).toBe('Slowed to 0.75x');
    expect(describeCommand({ kind: 'rate_step', direction: 'up' }, 1.25)).toBe('Sped up to 1.25x');
  });

  it('falls back to a generic rate-step label without a result rate', () => {
    expect(describeCommand({ kind: 'rate_step', direction: 'down' })).toBe('Slower');
    expect(describeCommand({ kind: 'rate_step', direction: 'up' })).toBe('Faster');
  });

  it('labels rate sets, naming normal speed', () => {
    expect(describeCommand({ kind: 'rate_set', rate: 1 })).toBe('Normal speed');
    expect(describeCommand({ kind: 'rate_set', rate: 0.5 })).toBe('Speed 0.5x');
  });

  it('labels info queries', () => {
    expect(describeCommand({ kind: 'info', query: 'current_exercise' })).toBe('Current exercise');
    expect(describeCommand({ kind: 'info', query: 'time_remaining' })).toBe('Time remaining');
  });
});
