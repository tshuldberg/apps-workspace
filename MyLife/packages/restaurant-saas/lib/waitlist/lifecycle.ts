import type { WaitlistStatus } from './types';

const AUTO_RELEASE_DEFAULT_MINUTES = 10;

export interface StatusTransition {
  from: WaitlistStatus;
  to: WaitlistStatus;
  valid: boolean;
}

/**
 * Valid state transitions for waitlist entries.
 */
const VALID_TRANSITIONS: StatusTransition[] = [
  { from: 'waiting', to: 'ready', valid: true },
  { from: 'waiting', to: 'walked_away', valid: true },
  { from: 'waiting', to: 'seated', valid: true },
  { from: 'ready', to: 'seated', valid: true },
  { from: 'ready', to: 'walked_away', valid: true },
  { from: 'ready', to: 'waiting', valid: true }, // re-queue if they need more time
];

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(from: WaitlistStatus, to: WaitlistStatus): boolean {
  return VALID_TRANSITIONS.some((t) => t.from === from && t.to === to && t.valid);
}

/**
 * Check if an entry should be auto-released (walked away due to no response).
 * Returns true if enough time has passed since the ready ping.
 */
export function shouldAutoRelease(
  readyPingedAt: Date,
  timeoutMinutes: number = AUTO_RELEASE_DEFAULT_MINUTES
): boolean {
  const now = new Date();
  const elapsed = (now.getTime() - readyPingedAt.getTime()) / (1000 * 60);
  return elapsed >= timeoutMinutes;
}

/**
 * Get the list of walk-away reasons.
 */
export function getWalkAwayReasons(): string[] {
  return ['Left voluntarily', 'No response', 'Seated elsewhere'];
}

/**
 * SMS lifecycle stages for a waitlist entry:
 * 1. join - confirmation SMS with position and estimated wait
 * 2. ready_ping - "Your table is ready!" notification
 * 3. reminder - follow-up if no response after N minutes
 * 4. auto_release - notify party they've been removed from waitlist
 */
export type SmsLifecycleStage = 'join' | 'ready_ping' | 'reminder' | 'auto_release';

/**
 * Get the SMS message template for a lifecycle stage.
 */
export function getSmsTemplate(stage: SmsLifecycleStage, data: Record<string, string>): string {
  switch (stage) {
    case 'join':
      return `You're #${data.position} on the waitlist at ${data.restaurant}. Estimated wait: ${data.estimate}. Reply STOP to opt out.`;
    case 'ready_ping':
      return `Your table is ready at ${data.restaurant}! Please check in with the host within 10 minutes.`;
    case 'reminder':
      return `Reminder: Your table is still waiting at ${data.restaurant}. Please check in soon or you may lose your spot.`;
    case 'auto_release':
      return `We weren't able to reach you and have released your spot at ${data.restaurant}. Feel free to rejoin the waitlist anytime.`;
  }
}
