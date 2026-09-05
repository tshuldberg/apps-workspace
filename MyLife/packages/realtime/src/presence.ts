import type { PresenceUser, PresenceState } from './types';

export function mergePresenceState(
  current: PresenceState,
  joins: Record<string, PresenceUser[]>,
  leaves: Record<string, PresenceUser[]>,
): PresenceState {
  const next = { ...current };

  for (const [key, users] of Object.entries(leaves)) {
    if (next[key]) {
      next[key] = next[key].filter(
        (u) => !users.some((lu) => lu.id === u.id),
      );
      if (next[key].length === 0) delete next[key];
    }
  }

  for (const [key, users] of Object.entries(joins)) {
    next[key] = users;
  }

  return next;
}

export function isUserStale(user: PresenceUser, staleThresholdMs: number = 30000): boolean {
  return Date.now() - user.lastSeen > staleThresholdMs;
}

export function pruneStaleUsers(state: PresenceState, thresholdMs: number = 30000): PresenceState {
  const pruned: PresenceState = {};
  for (const [key, users] of Object.entries(state)) {
    const active = users.filter((u) => !isUserStale(u, thresholdMs));
    if (active.length > 0) pruned[key] = active;
  }
  return pruned;
}

export function generatePresenceColor(userId: string): string {
  const colors = ['#DC2626', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#4F46E5'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}
