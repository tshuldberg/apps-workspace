import type { BroadcastMessage } from './types';

export function createBroadcastMessage(
  type: string,
  payload: Record<string, unknown>,
  senderId: string,
): BroadcastMessage {
  return {
    type,
    payload,
    senderId,
    timestamp: Date.now(),
  };
}

export function isBroadcastStale(message: BroadcastMessage, maxAgeMs: number = 5000): boolean {
  return Date.now() - message.timestamp > maxAgeMs;
}

export function filterOwnMessages(messages: BroadcastMessage[], currentUserId: string): BroadcastMessage[] {
  return messages.filter((m) => m.senderId !== currentUserId);
}
