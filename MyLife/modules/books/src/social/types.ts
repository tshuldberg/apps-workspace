export type FeedEventType = 'book_rating' | 'book_review' | 'book_finished' | 'book_started' | 'book_added';

export type FriendConnectionStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface FeedItem {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  eventType: FeedEventType;
  bookTitle: string;
  bookCoverUrl: string | null;
  bookAuthors: string | null;
  rating: number | null;
  reviewExcerpt: string | null;
  createdAt: string;
}

export interface FriendConnection {
  id: string;
  requesterId: string;
  responderId: string;
  status: FriendConnectionStatus;
  createdAt: string;
  acceptedAt: string | null;
}

export interface FriendProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  sharedBookCount: number;
  connectionStatus: FriendConnectionStatus | null;
}

export interface FeedFilter {
  eventTypes?: FeedEventType[];
  limit?: number;
  offset?: number;
  maxAgeDays?: number;
}

export interface SyncShareEventInput {
  eventType: FeedEventType;
  bookTitle: string;
  bookCoverUrl?: string | null;
  bookAuthors?: string | null;
  rating?: number | null;
  reviewExcerpt?: string | null;
  visibility: 'friends' | 'public';
}

export interface FeedResult {
  items: FeedItem[];
  hasMore: boolean;
  isStale: boolean;
  lastUpdated: string | null;
}
