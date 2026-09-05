// Types
export type {
  CommunityProfile,
  CommunityConnection,
  CommunityFeedItem,
  FeedItemWithProfile,
  CommunityChallenge,
  ChallengeMember,
  LeaderboardEntry,
  ProfileVisibility,
  ConnectionStatus,
  ActivityType,
  ChallengeType,
  ChallengeJoinType,
  ChallengeStatus,
  ChallengeMemberRole,
} from './types';
export { AVATAR_EMOJIS, STREAK_MILESTONES, ACTIVITY_SHARING_MAP } from './types';

// Profiles
export {
  generateShareCode,
  createProfile,
  getProfile,
  getProfileById,
  updateProfile,
  deleteProfile,
} from './profiles';

// Connections
export {
  sendConnectionRequest,
  acceptConnection,
  declineConnection,
  blockConnection,
  removeConnection,
  getAcceptedConnections,
  getPendingRequests,
  getAcceptedProfileIds,
  isBlocked,
} from './connections';

// Feed
export {
  createFeedItem,
  getFeed,
  getOwnFeed,
  cheerFeedItem,
  uncheerFeedItem,
} from './feed';

// Challenges
export {
  createChallenge,
  joinChallenge,
  updateChallengeProgress,
  getChallengeById,
  getActiveChallenges,
  getCompletedChallenges,
  getChallengeLeaderboard,
  getChallengeMember,
  transitionChallengeStatuses,
  getActiveChallengesByType,
} from './challenges';

// Sharing
export {
  isActivityVisible,
  getVisibleActivityTypes,
} from './sharing';
