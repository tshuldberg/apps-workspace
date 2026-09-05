import type {
  ForumActivity,
  ForumActivityFeedPage,
  ForumActivityFilter,
  ForumActivityGroup,
  ForumActivityGroupLabel,
  ForumActivityType,
  ForumActivityUnreadCounts,
} from '../models/activity';

const FILTER_TO_TYPE: Partial<Record<ForumActivityFilter, ForumActivityType>> = {
  mentions: 'mention',
  replies: 'reply',
  votes: 'vote',
  invites: 'invite',
  mod_actions: 'mod_action',
};

const GROUP_LABELS: ForumActivityGroupLabel[] = [
  'Today',
  'Yesterday',
  'This Week',
  'Earlier',
];

export function isActivityUnread(activity: ForumActivity): boolean {
  return activity.readAt == null;
}

export function matchesActivityFilter(
  activity: ForumActivity,
  filter: ForumActivityFilter,
): boolean {
  const requiredType = FILTER_TO_TYPE[filter];
  return requiredType == null ? true : activity.type === requiredType;
}

export function getActivityGroupLabel(
  createdAt: string,
  now: Date = new Date(),
): ForumActivityGroupLabel {
  const created = new Date(createdAt).getTime();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const yesterdayMs = todayMs - 24 * 60 * 60 * 1000;
  const weekMs = todayMs - 7 * 24 * 60 * 60 * 1000;

  if (created >= todayMs) {
    return 'Today';
  }

  if (created >= yesterdayMs) {
    return 'Yesterday';
  }

  if (created >= weekMs) {
    return 'This Week';
  }

  return 'Earlier';
}

export function countUnreadActivityByFilter(
  items: ForumActivity[],
): ForumActivityUnreadCounts {
  const counts: ForumActivityUnreadCounts = {
    all: 0,
    mentions: 0,
    replies: 0,
    votes: 0,
    invites: 0,
    mod_actions: 0,
  };

  for (const item of items) {
    if (!isActivityUnread(item)) {
      continue;
    }

    counts.all += 1;

    if (item.type === 'mention') counts.mentions += 1;
    if (item.type === 'reply') counts.replies += 1;
    if (item.type === 'vote') counts.votes += 1;
    if (item.type === 'invite') counts.invites += 1;
    if (item.type === 'mod_action') counts.mod_actions += 1;
  }

  return counts;
}

export function groupActivityFeed(
  items: ForumActivity[],
  now: Date = new Date(),
): ForumActivityGroup[] {
  const buckets = new Map<ForumActivityGroupLabel, ForumActivity[]>(
    GROUP_LABELS.map((label) => [label, []]),
  );

  for (const item of items) {
    const label = getActivityGroupLabel(item.createdAt, now);
    buckets.get(label)?.push(item);
  }

  return GROUP_LABELS
    .map((label) => ({
      label,
      items: buckets.get(label) ?? [],
    }))
    .filter((group) => group.items.length > 0);
}

export function buildActivityFeedPage(
  items: ForumActivity[],
  filter: ForumActivityFilter = 'all',
  page = 0,
  pageSize = 24,
): ForumActivityFeedPage {
  const sorted = items
    .slice()
    .sort((left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  const filtered = sorted.filter((item) => matchesActivityFilter(item, filter));
  const start = Math.max(0, page) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return {
    items: paged,
    groups: groupActivityFeed(paged),
    unreadCounts: countUnreadActivityByFilter(sorted),
    page,
    total: filtered.length,
    hasMore: start + pageSize < filtered.length,
  };
}

export function markActivityReadInList(
  items: ForumActivity[],
  activityId: string,
  readAt: string = new Date().toISOString(),
): ForumActivity[] {
  return items.map((item) =>
    item.id === activityId && item.readAt == null
      ? { ...item, readAt }
      : item,
  );
}

export function markAllActivityReadInList(
  items: ForumActivity[],
  filter: ForumActivityFilter = 'all',
  readAt: string = new Date().toISOString(),
): ForumActivity[] {
  return items.map((item) =>
    item.readAt == null && matchesActivityFilter(item, filter)
      ? { ...item, readAt }
      : item,
  );
}
