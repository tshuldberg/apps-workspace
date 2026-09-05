import type { VoiceCommandCategory, VoiceCommand } from './types';

const COMMAND_MAP: Record<string, { category: VoiceCommandCategory; action: string }> = {
  pause: { category: 'playback', action: 'pause' },
  stop: { category: 'playback', action: 'pause' },
  resume: { category: 'playback', action: 'resume' },
  play: { category: 'playback', action: 'resume' },
  start: { category: 'playback', action: 'resume' },
  slower: { category: 'pacing', action: 'slower' },
  'slow down': { category: 'pacing', action: 'slower' },
  faster: { category: 'pacing', action: 'faster' },
  'speed up': { category: 'pacing', action: 'faster' },
  'normal speed': { category: 'pacing', action: 'normal' },
  next: { category: 'navigation', action: 'next' },
  skip: { category: 'navigation', action: 'next' },
  previous: { category: 'navigation', action: 'previous' },
  back: { category: 'navigation', action: 'previous' },
  repeat: { category: 'navigation', action: 'repeat' },
  'what exercise': { category: 'info', action: 'current_exercise' },
  'how many reps': { category: 'info', action: 'rep_count' },
  'how much time': { category: 'info', action: 'time_remaining' },
  'start recording': { category: 'recording', action: 'start' },
  'stop recording': { category: 'recording', action: 'stop' },
};

export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const normalized = transcript.toLowerCase().trim();

  for (const [phrase, command] of Object.entries(COMMAND_MAP)) {
    if (normalized.includes(phrase)) {
      return {
        ...command,
        confidence: normalized === phrase ? 1.0 : 0.8,
        raw: transcript,
      };
    }
  }

  return null;
}

export function getSupportedCommands(): string[] {
  return Object.keys(COMMAND_MAP);
}
