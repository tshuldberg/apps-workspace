// -- Community enums ---------------------------------------------------------

export type ProfileVisibility = 'private' | 'connections' | 'public';
export type ConnectionStatus = 'pending' | 'accepted' | 'blocked';
export type ActivityType = 'streak' | 'goal_hit' | 'challenge_joined' | 'challenge_complete' | 'milestone' | 'custom';
export type ChallengeType = 'streak' | 'calorie_target' | 'protein_target' | 'water_target' | 'log_streak' | 'custom';
export type ChallengeJoinType = 'open' | 'invite' | 'approval';
export type ChallengeStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type ChallengeMemberRole = 'creator' | 'member';

// -- Community types ---------------------------------------------------------

export interface CommunityProfile {
  id: string;
  displayName: string;
  avatarEmoji: string;
  bio: string | null;
  shareStreaks: boolean;
  shareGoals: boolean;
  shareCalories: boolean;
  shareMacros: boolean;
  shareWeight: boolean;
  profileVisibility: ProfileVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityConnection {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityFeedItem {
  id: string;
  profileId: string;
  activityType: ActivityType;
  title: string;
  body: string | null;
  metadataJson: string | null;
  visibility: ProfileVisibility;
  cheered: boolean;
  createdAt: string;
}

export interface FeedItemWithProfile extends CommunityFeedItem {
  displayName: string;
  avatarEmoji: string;
}

export interface CommunityChallenge {
  id: string;
  creatorProfileId: string;
  title: string;
  description: string | null;
  challengeType: ChallengeType;
  targetValue: number | null;
  targetUnit: string | null;
  startDate: string;
  endDate: string;
  maxParticipants: number;
  joinType: ChallengeJoinType;
  status: ChallengeStatus;
  createdAt: string;
}

export interface ChallengeMember {
  id: string;
  challengeId: string;
  profileId: string;
  role: ChallengeMemberRole;
  currentValue: number;
  joinedAt: string;
  completedAt: string | null;
}

export interface LeaderboardEntry extends ChallengeMember {
  displayName: string;
  avatarEmoji: string;
  rank: number;
}

// -- Sharing preference keys ------------------------------------------------

export const ACTIVITY_SHARING_MAP: Record<ActivityType, keyof Pick<CommunityProfile, 'shareStreaks' | 'shareGoals' | 'shareCalories' | 'shareMacros' | 'shareWeight'> | null> = {
  streak: 'shareStreaks',
  goal_hit: 'shareCalories',
  challenge_joined: null,    // Always visible
  challenge_complete: null,  // Always visible
  milestone: 'shareStreaks',
  custom: null,              // Always visible
};

// -- Milestone thresholds ---------------------------------------------------

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365] as const;

// -- Avatar emoji options ---------------------------------------------------

export const AVATAR_EMOJIS = [
  '\u{1F966}', '\u{1F34E}', '\u{1F951}', '\u{1F955}', '\u{1F34A}',
  '\u{1F353}', '\u{1F34C}', '\u{1F347}', '\u{1F952}', '\u{1F345}',
  '\u{1F96A}', '\u{1F957}', '\u{1F969}', '\u{1F95A}', '\u{1F371}',
  '\u{1F3CB}\uFE0F', '\u{1F6B4}', '\u{1F3C3}', '\u{1F4AA}', '\u{2764}\uFE0F',
] as const;
