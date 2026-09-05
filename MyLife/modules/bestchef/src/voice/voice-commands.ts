import type { ParsedVoiceCommand, VoiceCommand } from '../types';

interface CommandPattern {
  command: VoiceCommand;
  patterns: string[];
}

const COMMAND_PATTERNS: CommandPattern[] = [
  {
    command: 'next_step',
    patterns: ['next step', 'next', 'continue', 'go forward', 'forward', 'move on'],
  },
  {
    command: 'previous_step',
    patterns: ['previous step', 'previous', 'go back', 'back', 'last step'],
  },
  {
    command: 'start_timer',
    patterns: ['start timer', 'begin timer', 'set timer', 'start the timer', 'timer start'],
  },
  {
    command: 'stop_timer',
    patterns: ['stop timer', 'cancel timer', 'clear timer', 'stop the timer', 'timer stop'],
  },
  {
    command: 'repeat_step',
    patterns: ['repeat', 'read step', 'what does it say', 'say again', 'read it again', 'read aloud'],
  },
  {
    command: 'read_ingredients',
    patterns: ['read ingredients', 'ingredients', 'list ingredients', 'what ingredients'],
  },
];

const STEP_NUMBER_PATTERN = /(?:go to step|step|jump to step)\s+(\d+)/i;

export function parseVoiceCommand(text: string): ParsedVoiceCommand | null {
  if (!text || text.trim().length === 0) return null;

  const normalized = text.trim().toLowerCase();

  const stepMatch = normalized.match(STEP_NUMBER_PATTERN);
  if (stepMatch) {
    return { command: 'go_to_step', stepNumber: parseInt(stepMatch[1], 10) };
  }

  for (const { command, patterns } of COMMAND_PATTERNS) {
    for (const pattern of patterns) {
      if (normalized === pattern || normalized.includes(pattern)) {
        return { command };
      }
    }
  }

  return null;
}
