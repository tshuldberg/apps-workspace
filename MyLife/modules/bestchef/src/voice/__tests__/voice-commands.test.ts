import { describe, it, expect } from 'vitest';
import { parseVoiceCommand } from '../voice-commands';

describe('parseVoiceCommand', () => {
  it('"next step" returns next_step', () => {
    expect(parseVoiceCommand('next step')).toEqual({ command: 'next_step' });
  });

  it('"Next" returns next_step (case-insensitive)', () => {
    expect(parseVoiceCommand('Next')).toEqual({ command: 'next_step' });
  });

  it('"continue" returns next_step (synonym)', () => {
    expect(parseVoiceCommand('continue')).toEqual({ command: 'next_step' });
  });

  it('"go back" returns previous_step', () => {
    expect(parseVoiceCommand('go back')).toEqual({ command: 'previous_step' });
  });

  it('"previous" returns previous_step', () => {
    expect(parseVoiceCommand('previous')).toEqual({ command: 'previous_step' });
  });

  it('"start timer" returns start_timer', () => {
    expect(parseVoiceCommand('start timer')).toEqual({ command: 'start_timer' });
  });

  it('"stop timer" returns stop_timer', () => {
    expect(parseVoiceCommand('stop timer')).toEqual({ command: 'stop_timer' });
  });

  it('"repeat" returns repeat_step', () => {
    expect(parseVoiceCommand('repeat')).toEqual({ command: 'repeat_step' });
  });

  it('"read ingredients" returns read_ingredients', () => {
    expect(parseVoiceCommand('read ingredients')).toEqual({ command: 'read_ingredients' });
  });

  it('"go to step 3" returns go_to_step with stepNumber 3', () => {
    expect(parseVoiceCommand('go to step 3')).toEqual({ command: 'go_to_step', stepNumber: 3 });
  });

  it('"step 12" returns go_to_step with stepNumber 12', () => {
    expect(parseVoiceCommand('step 12')).toEqual({ command: 'go_to_step', stepNumber: 12 });
  });

  it('"hello world" returns null', () => {
    expect(parseVoiceCommand('hello world')).toBeNull();
  });

  it('"" returns null', () => {
    expect(parseVoiceCommand('')).toBeNull();
  });

  it('handles mixed case with extra whitespace', () => {
    expect(parseVoiceCommand('  START TIMER  ')).toEqual({ command: 'start_timer' });
  });

  it('"forward" returns next_step', () => {
    expect(parseVoiceCommand('forward')).toEqual({ command: 'next_step' });
  });

  it('"what does it say" returns repeat_step', () => {
    expect(parseVoiceCommand('what does it say')).toEqual({ command: 'repeat_step' });
  });

  it('"jump to step 5" returns go_to_step with stepNumber 5', () => {
    expect(parseVoiceCommand('jump to step 5')).toEqual({ command: 'go_to_step', stepNumber: 5 });
  });
});
