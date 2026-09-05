'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  getProfile,
  getProfileById,
  createProfile,
  updateProfile,
  getAcceptedConnections,
  getPendingRequests,
  sendConnectionRequest,
  acceptConnection,
  declineConnection,
  blockConnection,
  getActiveChallenges,
  getCompletedChallenges,
  getFeed,
  cheerFeedItem,
  createChallenge,
  joinChallenge,
  getChallengeLeaderboard,
  getChallengeById,
  transitionChallengeStatuses,
  type CommunityProfile,
  type CommunityConnection,
  type FeedItemWithProfile,
  type CommunityChallenge,
  type LeaderboardEntry,
  type ChallengeType,
  type ChallengeJoinType,
} from '@mylife/nutrition';

function getDb() {
  ensureModuleMigrations('nutrition');
  return getAdapter();
}

export async function fetchCommunityProfile(): Promise<CommunityProfile | null> {
  return getProfile(getDb());
}

export async function fetchProfileById(id: string): Promise<CommunityProfile | null> {
  return getProfileById(getDb(), id);
}

export async function createCommunityProfile(input: {
  displayName: string;
  avatarEmoji?: string;
  bio?: string;
  shareStreaks?: boolean;
  shareGoals?: boolean;
  shareCalories?: boolean;
  shareMacros?: boolean;
  shareWeight?: boolean;
}): Promise<CommunityProfile> {
  return createProfile(getDb(), input);
}

export async function updateCommunityProfile(
  id: string,
  input: Partial<{
    displayName: string;
    avatarEmoji: string;
    bio: string | null;
    shareStreaks: boolean;
    shareGoals: boolean;
    shareCalories: boolean;
    shareMacros: boolean;
    shareWeight: boolean;
  }>,
): Promise<CommunityProfile> {
  return updateProfile(getDb(), id, input);
}

export async function fetchAcceptedConnections(profileId: string) {
  return getAcceptedConnections(getDb(), profileId);
}

export async function fetchPendingRequests(profileId: string) {
  return getPendingRequests(getDb(), profileId);
}

export async function sendCommunityConnectionRequest(fromId: string, toId: string): Promise<CommunityConnection> {
  return sendConnectionRequest(getDb(), fromId, toId);
}

export async function acceptCommunityConnection(connectionId: string): Promise<CommunityConnection> {
  return acceptConnection(getDb(), connectionId);
}

export async function declineCommunityConnection(connectionId: string): Promise<void> {
  return declineConnection(getDb(), connectionId);
}

export async function blockCommunityConnection(profileId: string, targetId: string): Promise<void> {
  return blockConnection(getDb(), profileId, targetId);
}

export async function fetchActiveChallenges(profileId: string): Promise<CommunityChallenge[]> {
  const db = getDb();
  transitionChallengeStatuses(db);
  return getActiveChallenges(db, profileId);
}

export async function fetchCompletedChallenges(profileId: string): Promise<CommunityChallenge[]> {
  return getCompletedChallenges(getDb(), profileId);
}

export async function fetchCommunityFeed(profileId: string, limit = 50): Promise<FeedItemWithProfile[]> {
  return getFeed(getDb(), profileId, limit);
}

export async function cheerCommunityFeedItem(feedItemId: string): Promise<void> {
  return cheerFeedItem(getDb(), feedItemId);
}

export async function createCommunityChallenge(
  creatorProfileId: string,
  input: {
    title: string;
    description?: string;
    challengeType: ChallengeType;
    targetValue?: number;
    targetUnit?: string;
    startDate: string;
    endDate: string;
    maxParticipants?: number;
    joinType?: ChallengeJoinType;
  },
): Promise<CommunityChallenge> {
  return createChallenge(getDb(), creatorProfileId, input);
}

export async function joinCommunityChallenge(challengeId: string, profileId: string) {
  return joinChallenge(getDb(), challengeId, profileId);
}

export async function fetchChallengeById(id: string): Promise<CommunityChallenge | null> {
  return getChallengeById(getDb(), id);
}

export async function fetchChallengeLeaderboard(challengeId: string): Promise<LeaderboardEntry[]> {
  return getChallengeLeaderboard(getDb(), challengeId);
}
