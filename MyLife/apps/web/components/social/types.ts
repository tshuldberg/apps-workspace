import type {
  Activity as SocialActivity,
  Challenge as SocialChallenge,
  ChallengeMember,
  Follow,
  Group as SocialGroup,
  LeaderboardEntry as SocialLeaderboardEntry,
  SocialProfile as PackageSocialProfile,
} from '@mylife/social';
import {
  calculateChallengeProgressPercent,
  describeSocialActivity,
  getPrimaryChallengeModuleId,
  getSocialModulePresentation,
} from '@mylife/social';

export interface SocialProfile {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  followerCount: number;
  followingCount: number;
  enabledModuleCount: number;
}

export interface ActivityComment {
  id: string;
  userId: string;
  userDisplayName: string;
  text: string;
  timestamp: string;
}

export interface ActivityItem {
  id: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl?: string | null;
  moduleId: string;
  moduleIcon: string;
  moduleAccentColor: string;
  description: string;
  timestamp: string;
  kudosCount: number;
  hasKudosed: boolean;
  commentCount: number;
  comments: ActivityComment[];
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  moduleId: string;
  moduleIcon: string;
  moduleAccentColor: string;
  participantCount: number;
  startDate: string;
  endDate: string;
  isJoined: boolean;
  progress?: number;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  fromAvatarUrl?: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isJoined: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  score: number;
}

export function indexProfiles(
  profiles: PackageSocialProfile[] | null | undefined,
): Record<string, PackageSocialProfile> {
  const profileMap: Record<string, PackageSocialProfile> = {};

  for (const profile of profiles ?? []) {
    profileMap[profile.id] = profile;
  }

  return profileMap;
}

export function toSocialProfileCard(
  profile: PackageSocialProfile,
): SocialProfile {
  return {
    id: profile.id,
    handle: profile.handle,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    followerCount: profile.followerCount,
    followingCount: profile.followingCount,
    enabledModuleCount: profile.enabledModules.length,
  };
}

export function toActivityItem(
  activity: SocialActivity,
  profileMap: Record<string, PackageSocialProfile>,
  opts: {
    hasKudosed?: boolean;
    comments?: ActivityComment[];
  } = {},
): ActivityItem {
  const author = profileMap[activity.profileId];
  const modulePresentation = getSocialModulePresentation(activity.moduleId);

  return {
    id: activity.id,
    userId: activity.profileId,
    userDisplayName: author?.displayName ?? 'MyLife member',
    userAvatarUrl: author?.avatarUrl,
    moduleId: activity.moduleId ?? 'social',
    moduleIcon: modulePresentation.icon,
    moduleAccentColor: modulePresentation.accentColor,
    description: describeSocialActivity(activity),
    timestamp: activity.createdAt,
    kudosCount: activity.kudosCount,
    hasKudosed: opts.hasKudosed ?? false,
    commentCount: activity.commentCount,
    comments: opts.comments ?? [],
  };
}

export function toChallengeItem(
  challenge: SocialChallenge,
  membership: ChallengeMember | null,
): Challenge {
  const modulePresentation = getSocialModulePresentation(
    getPrimaryChallengeModuleId(challenge),
  );
  const progress = calculateChallengeProgressPercent(challenge, membership);

  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description ?? 'Join the challenge and track progress across MyLife.',
    moduleId: challenge.goals[0]?.moduleId ?? 'social',
    moduleIcon: modulePresentation.icon,
    moduleAccentColor: modulePresentation.accentColor,
    participantCount: challenge.memberCount,
    startDate: challenge.startsAt,
    endDate: challenge.endsAt,
    isJoined: membership !== null,
    progress: progress ?? undefined,
  };
}

export function toFriendRequestItem(
  request: Follow,
  profileMap: Record<string, PackageSocialProfile>,
): FriendRequest {
  const requester = profileMap[request.followerId];

  return {
    id: request.id,
    fromUserId: request.followerId,
    fromDisplayName: requester?.displayName ?? 'MyLife member',
    fromAvatarUrl: requester?.avatarUrl,
    status: request.status === 'pending' ? 'pending' : 'accepted',
    timestamp: request.createdAt,
  };
}

export function toGroupItem(
  group: SocialGroup,
  isJoined: boolean,
): Group {
  return {
    id: group.id,
    name: group.name,
    description: group.description ?? 'Community group',
    memberCount: group.memberCount,
    isJoined,
  };
}

export function toLeaderboardEntryRow(
  entry: SocialLeaderboardEntry,
): LeaderboardEntry {
  return {
    rank: entry.rank,
    userId: entry.profileId,
    displayName: entry.displayName,
    handle: entry.handle,
    avatarUrl: entry.avatarUrl,
    score: entry.score,
  };
}
