import type { CommunityChallenge, CommunityParticipation } from '../db/community-challenges';

export interface CommunityChallengeWithProgress {
  challenge: CommunityChallenge;
  participation: CommunityParticipation | null;
  percentComplete: number;
  daysRemaining: number | null;
  isExpired: boolean;
}

export interface CommunityProgressUpdate {
  challengeId: string;
  participationId: string;
  newValue: number;
  isComplete: boolean;
}
