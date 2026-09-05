/**
 * Protocol Progression Engine
 *
 * Suggests the next fasting protocol when a user has demonstrated sustained
 * adherence to their current protocol. Gamifies advancement without pressure.
 *
 * Default threshold: 7 consecutive successful fasts before suggesting advancement.
 * Progression path: 16:8 -> 18:6 -> 20:4 -> OMAD -> 36h -> 48h -> 72h
 */

import type { ProtocolSuggestion } from '../types';
import { PROTOCOL_PROGRESSION, PRESET_PROTOCOLS } from '../protocols';

const DEFAULT_THRESHOLD = 7;

/**
 * Suggest the next protocol based on consecutive successful fasts.
 *
 * @param currentProtocolId - The protocol the user is currently following
 * @param consecutiveSuccesses - Number of consecutive fasts that hit the target
 * @param threshold - Number of successes required before suggesting advancement (default: 7)
 * @returns A suggestion with the next protocol, or null suggestedProtocolId if at the top
 */
export function suggestNextProtocol(
  currentProtocolId: string,
  consecutiveSuccesses: number,
  threshold: number = DEFAULT_THRESHOLD,
): ProtocolSuggestion {
  const nextId = PROTOCOL_PROGRESSION[currentProtocolId] ?? null;
  const meetsThreshold = consecutiveSuccesses >= threshold;

  if (!meetsThreshold) {
    return {
      currentProtocolId,
      suggestedProtocolId: null,
      reason: `${threshold - consecutiveSuccesses} more successful fasts to unlock the next level.`,
      consecutiveSuccesses,
      threshold,
    };
  }

  if (!nextId) {
    return {
      currentProtocolId,
      suggestedProtocolId: null,
      reason: 'You are at the most advanced protocol. Consistency is the goal now.',
      consecutiveSuccesses,
      threshold,
    };
  }

  const nextProtocol = PRESET_PROTOCOLS.find((p) => p.id === nextId);
  const nextName = nextProtocol?.name ?? nextId;

  return {
    currentProtocolId,
    suggestedProtocolId: nextId,
    reason: `${consecutiveSuccesses} consecutive successes. Ready to try ${nextName}?`,
    consecutiveSuccesses,
    threshold,
  };
}
