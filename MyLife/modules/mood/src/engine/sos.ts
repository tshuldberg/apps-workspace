import type { BreathingPattern } from '../types';
import { BREATHING_PATTERNS } from '../types';

export type SosStepType = 'breathing' | 'grounding' | 'affirmation' | 'exit';

export interface SosStep {
  type: SosStepType;
  title: string;
  instruction: string;
  durationSeconds: number;
}

export interface GroundingSense {
  sense: 'see' | 'touch' | 'hear' | 'smell' | 'taste';
  count: number;
  prompt: string;
}

export const GROUNDING_SENSES: GroundingSense[] = [
  { sense: 'see', count: 5, prompt: 'Name 5 things you can see right now' },
  { sense: 'touch', count: 4, prompt: 'Name 4 things you can feel or touch' },
  { sense: 'hear', count: 3, prompt: 'Name 3 things you can hear' },
  { sense: 'smell', count: 2, prompt: 'Name 2 things you can smell' },
  { sense: 'taste', count: 1, prompt: 'Name 1 thing you can taste' },
];

export const DEFAULT_AFFIRMATIONS: string[] = [
  'This feeling is temporary. It will pass.',
  'I am safe right now in this moment.',
  'I have gotten through hard times before, and I can do it again.',
  'I am stronger than I think.',
  'It is okay to feel this way. My feelings are valid.',
  'I am not my thoughts. I can observe them without judgment.',
  'Right now, in this breath, I have everything I need.',
  'I deserve kindness, especially from myself.',
  'Every storm runs out of rain.',
  'I give myself permission to take things one moment at a time.',
  'My best is enough, and today I am doing my best.',
  'I am allowed to take up space and feel what I feel.',
  'Difficult moments are not permanent states.',
  'I choose to respond to myself with compassion right now.',
  'I trust my ability to navigate hard things.',
  'I am worthy of peace and calm.',
  'The hardest part is often just the beginning. I have already started.',
  'I am not alone in feeling this way.',
  'I can take it one small step at a time.',
  'This moment does not define my whole story.',
];

export function getSosFlow(pattern: BreathingPattern = 'box'): SosStep[] {
  const breathingName = BREATHING_PATTERNS[pattern]?.name ?? 'Box Breathing';
  return [
    {
      type: 'breathing',
      title: 'Breathe',
      instruction: `Follow the ${breathingName} pattern to calm your nervous system`,
      durationSeconds: 60,
    },
    {
      type: 'grounding',
      title: 'Ground Yourself',
      instruction: 'Use the 5-4-3-2-1 technique to anchor yourself in the present',
      durationSeconds: 120,
    },
    {
      type: 'affirmation',
      title: 'Affirmation',
      instruction: getRandomAffirmation(),
      durationSeconds: 30,
    },
    {
      type: 'exit',
      title: 'Check In',
      instruction: 'How are you feeling now? Rate your current mood.',
      durationSeconds: 30,
    },
  ];
}

export function getRandomAffirmation(): string {
  return DEFAULT_AFFIRMATIONS[Math.floor(Math.random() * DEFAULT_AFFIRMATIONS.length)];
}

export function computeSosDuration(steps: SosStep[]): number {
  return steps.reduce((sum, s) => sum + s.durationSeconds, 0);
}

export function getSosStepCount(): number {
  return 4;
}
