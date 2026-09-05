import {
  getCachedActivity,
  markAllCachedActivityRead,
  markCachedActivityRead,
  type DatabaseAdapter,
} from '../db/crud';
import type {
  ForumActivityFeedPage,
  ForumActivityFilter,
} from '../models/activity';
import { buildActivityFeedPage } from './logic';

export function getActivityFeed(
  db: DatabaseAdapter,
  profileId: string,
  filter: ForumActivityFilter = 'all',
  page = 0,
  pageSize = 24,
): ForumActivityFeedPage {
  const rows = getCachedActivity(db, profileId, {
    limit: Math.max(pageSize * (page + 1), pageSize),
  });

  return buildActivityFeedPage(rows, filter, page, pageSize);
}

export function markActivityRead(
  db: DatabaseAdapter,
  activityId: string,
  readAt: string = new Date().toISOString(),
): void {
  markCachedActivityRead(db, activityId, readAt);
}

export function markAllActivityRead(
  db: DatabaseAdapter,
  profileId: string,
  filter: ForumActivityFilter = 'all',
  readAt: string = new Date().toISOString(),
): void {
  markAllCachedActivityRead(db, profileId, filter, readAt);
}

export function subscribeToActivity(options: {
  db: DatabaseAdapter;
  profileId: string;
  onChange: (page: ForumActivityFeedPage) => void;
  filter?: ForumActivityFilter;
  page?: number;
  pageSize?: number;
  intervalMs?: number;
}): () => void {
  const {
    db,
    profileId,
    onChange,
    filter = 'all',
    page = 0,
    pageSize = 24,
    intervalMs = 1500,
  } = options;

  let previousSignature = '';

  const emitIfChanged = () => {
    const next = getActivityFeed(db, profileId, filter, page, pageSize);
    const signature = JSON.stringify({
      ids: next.items.map((item) => item.id),
      reads: next.items.map((item) => item.readAt),
      counts: next.unreadCounts,
      total: next.total,
    });

    if (signature !== previousSignature) {
      previousSignature = signature;
      onChange(next);
    }
  };

  emitIfChanged();

  const handle = setInterval(emitIfChanged, intervalMs);

  return () => {
    clearInterval(handle);
  };
}
