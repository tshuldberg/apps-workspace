/**
 * Types for MyFriends privacy/security utilities.
 */

export interface DataStats {
  people: number;
  circles: number;
  hangouts: number;
  gifts: number;
  giftIdeas: number;
  memories: number;
  lifeEvents: number;
  nudges: number;
  photos: number;
}

export interface FriendsExport {
  exportedAt: string;
  version: string;
  data: {
    people: Record<string, unknown>[];
    circles: Record<string, unknown>[];
    hangouts: Record<string, unknown>[];
    gifts: Record<string, unknown>[];
    giftIdeas: Record<string, unknown>[];
    memories: Record<string, unknown>[];
    lifeEvents: Record<string, unknown>[];
    nudges: Record<string, unknown>[];
    photos: Record<string, unknown>[];
    settings: Record<string, string>;
  };
}

export interface CascadeDeleteResult {
  people: number;
  gifts: number;
  giftIdeas: number;
  memories: number;
  lifeEvents: number;
  nudges: number;
  photos: number;
  circlesUpdated: number;
  hangoutsUpdated: number;
}
