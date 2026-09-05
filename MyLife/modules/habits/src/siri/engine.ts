import type { SiriCompletionResult } from '../types';

export function handleSiriCompletion(
  habitExists: boolean,
  alreadyCompletedToday: boolean,
): SiriCompletionResult {
  if (!habitExists) return 'not_found';
  if (alreadyCompletedToday) return 'already_done';
  return 'completed';
}

export function generateSiriResponse(result: SiriCompletionResult, habitName: string): string {
  switch (result) {
    case 'completed':
      return `Done. ${habitName} logged.`;
    case 'already_done':
      return 'Already done for today.';
    case 'not_found':
      return 'This habit no longer exists.';
  }
}

export function isPlatformSupported(platform: string, osVersion?: number): boolean {
  if (platform === 'android' || platform === 'web') return false;
  if (platform === 'ios' && osVersion !== undefined && osVersion < 16) return false;
  return platform === 'ios';
}
