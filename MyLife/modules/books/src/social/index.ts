// Social feed engine -- Supabase-backed friend feed and connections

export {
  assembleFeed,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  blockUser,
  removeFriend,
  syncShareEvent,
  getFriendConnections,
  MAX_FRIENDS,
} from './feed-engine';
export type { SocialSupabaseClient } from './feed-engine';

export type {
  FeedEventType,
  FriendConnectionStatus,
  FeedItem,
  FriendConnection,
  FriendProfile,
  FeedFilter,
  SyncShareEventInput,
  FeedResult,
} from './types';
