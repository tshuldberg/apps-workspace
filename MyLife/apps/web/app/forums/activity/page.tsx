'use client';

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useEffectEvent } from '@/lib/react';
import Link from 'next/link';
import {
  fetchActivityFeedAction,
  markActivityReadAction,
  markAllActivityReadAction,
} from '../actions';
import {
  EmptyState,
  GlassCard,
  MaterialSymbol,
  SectionIntro,
  SurfaceCard,
} from '../components';
import { TOKENS, chipStyle, formatRelativeTime, gradientButtonStyle } from '../ui';

type ActivityFilter = 'all' | 'mentions' | 'replies' | 'votes' | 'invites' | 'mod_actions';

interface ActivityItem {
  id: string;
  actorName: string;
  actorTrustTier: 'unverified' | 'new' | 'trusted' | 'highly_trusted' | 'mod';
  type: 'mention' | 'reply' | 'vote' | 'invite' | 'mod_action';
  verb: string;
  context: string;
  detail: string | null;
  targetType: 'thread' | 'community' | 'conversation' | 'profile';
  targetId: string | null;
  communityId: string | null;
  threadId: string | null;
  conversationId: string | null;
  targetProfileId: string | null;
  createdAt: string;
  readAt: string | null;
}

interface ActivityGroup {
  label: string;
  items: ActivityItem[];
}

interface ActivityFeedPage {
  groups: ActivityGroup[];
  unreadCounts: Record<ActivityFilter, number>;
  total: number;
}

const EMPTY_COUNTS: Record<ActivityFilter, number> = {
  all: 0,
  mentions: 0,
  replies: 0,
  votes: 0,
  invites: 0,
  mod_actions: 0,
};

const FILTER_LABELS: Record<ActivityFilter, string> = {
  all: 'All',
  mentions: 'Mentions',
  replies: 'Replies',
  votes: 'Votes',
  invites: 'Invites',
  mod_actions: 'Mod actions',
};

export default function ActivityPage() {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [feed, setFeed] = useState<ActivityFeedPage>({
    groups: [],
    unreadCounts: EMPTY_COUNTS,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deferredFilter = useDeferredValue(filter);

  const loadFeed = useEffectEvent(async () => {
    try {
      const result = (await fetchActivityFeedAction(deferredFilter)) as ActivityFeedPage;
      startTransition(() => {
        setFeed({
          groups: result.groups ?? [],
          unreadCounts: result.unreadCounts ?? EMPTY_COUNTS,
          total: result.total ?? 0,
        });
      });
      setError(null);
    } catch {
      setError('Could not load the activity feed.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadFeed();
  }, [deferredFilter, loadFeed]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      void loadFeed();
    }, 10000);
    return () => window.clearInterval(handle);
  }, [loadFeed]);

  const unreadCount = useMemo(
    () => feed.unreadCounts[filter] ?? 0,
    [feed.unreadCounts, filter],
  );

  async function markOneRead(activityId: string) {
    setWorkingId(activityId);
    try {
      await markActivityReadAction(activityId);
      await loadFeed();
    } finally {
      setWorkingId(null);
    }
  }

  async function markAllRead() {
    setWorkingId('all');
    try {
      await markAllActivityReadAction(filter);
      await loadFeed();
    } finally {
      setWorkingId(null);
    }
  }

  if (loading) {
    return <GlassCard style={{ minHeight: 420, animation: 'pulse 1.5s ease-in-out infinite' }} />;
  }

  if (error && feed.total === 0) {
    return (
      <EmptyState
        icon="notifications"
        title="Activity unavailable"
        description={error}
        actionHref="/forums"
        actionLabel="Return to feed"
      />
    );
  }

  return (
    <div className="forums-page-stack">
      <SectionIntro
        eyebrow="Activity"
        title="Time-grouped signal feed"
        description="Notifications are grouped by recency, filtered by type, and refreshed on an interval so the page feels live without breaking the calm desktop shell."
        actions={
          <button type="button" onClick={() => void markAllRead()} disabled={workingId === 'all' || unreadCount === 0} style={markAllButtonStyle(workingId === 'all' || unreadCount === 0)}>
            {workingId === 'all' ? 'Marking...' : `Mark ${unreadCount} read`}
          </button>
        }
      />

      <div className="forums-chip-row">
        {(Object.keys(FILTER_LABELS) as ActivityFilter[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            style={chipStyle(filter === value, value === 'mentions' || value === 'mod_actions' ? 'trust' : 'neutral')}
          >
            {FILTER_LABELS[value]}
            {(feed.unreadCounts[value] ?? 0) > 0 ? ` · ${feed.unreadCounts[value]}` : ''}
          </button>
        ))}
      </div>

      {feed.groups.length === 0 ? (
        <EmptyState
          icon="notifications_active"
          title="Nothing new in this lane"
          description="This filter is quiet right now. Switch the chip set or wait for the next realtime poll."
          actionHref="/forums"
          actionLabel="Back to forums"
        />
      ) : (
        feed.groups.map((group) => (
          <div key={group.label} style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <span style={eyebrowStyle}>{group.label}</span>
              <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{group.items.length} items</span>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {group.items.map((item) => (
                <SurfaceCard
                  key={item.id}
                  style={{
                    display: 'grid',
                    gap: 12,
                    background: item.readAt ? undefined : 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={iconBadgeStyle(item.type, item.readAt == null)}>
                        <MaterialSymbol name={activityIcon(item.type)} size={16} color={iconColor(item.type)} />
                      </span>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong style={{ fontSize: 15 }}>
                          {item.actorName} {item.verb} {item.context}
                        </strong>
                        <div className="forums-chip-row">
                          <span style={trustPillStyle(item.actorTrustTier)}>{item.actorTrustTier.replace(/_/g, ' ')}</span>
                          {!item.readAt ? <span style={chipStyle(true, 'trust')}>Unread</span> : null}
                        </div>
                      </div>
                    </div>
                    <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{formatRelativeTime(item.createdAt)}</span>
                  </div>

                  {item.detail ? (
                    <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.7 }}>{item.detail}</p>
                  ) : null}

                  <div className="forums-chip-row" style={{ justifyContent: 'space-between' }}>
                    <div className="forums-chip-row">
                      <button
                        type="button"
                        onClick={() => void markOneRead(item.id)}
                        disabled={Boolean(item.readAt) || workingId === item.id}
                        style={markOneButtonStyle(Boolean(item.readAt) || workingId === item.id)}
                      >
                        {workingId === item.id ? 'Saving...' : item.readAt ? 'Read' : 'Mark read'}
                      </button>
                    </div>
                    <Link href={targetHref(item)} style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
                      Open target
                    </Link>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const eyebrowStyle = {
  color: TOKENS.primary,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
} as const;

function activityIcon(type: ActivityItem['type']) {
  if (type === 'mention') return 'alternate_email';
  if (type === 'reply') return 'reply';
  if (type === 'vote') return 'thumb_up';
  if (type === 'invite') return 'group_add';
  return 'gavel';
}

function iconColor(type: ActivityItem['type']) {
  return type === 'mention' || type === 'mod_action' ? TOKENS.trustLight : TOKENS.primaryLight;
}

function iconBadgeStyle(type: ActivityItem['type'], unread: boolean) {
  const color = iconColor(type);
  return {
    width: 36,
    height: 36,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    background: unread ? `${color}26` : `${color}14`,
  } as const;
}

function trustPillStyle(tier: ActivityItem['actorTrustTier']) {
  const trustColor =
    tier === 'mod' || tier === 'highly_trusted' || tier === 'trusted'
      ? TOKENS.trustLight
      : TOKENS.primaryLight;
  return {
    padding: '7px 10px',
    borderRadius: 999,
    background: `${trustColor}18`,
    color: trustColor,
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
  } as const;
}

function targetHref(item: ActivityItem) {
  if (item.targetType === 'thread' && item.threadId) return `/forums/thread/${item.threadId}`;
  if (item.targetType === 'community' && item.communityId) return `/forums/community/${item.communityId}`;
  if (item.targetType === 'conversation' && item.conversationId) return `/forums/messages/${item.conversationId}`;
  if (item.targetType === 'profile' && item.targetProfileId) return `/forums/profile/${item.targetProfileId}`;
  return '/forums';
}

function markAllButtonStyle(disabled: boolean) {
  return {
    ...gradientButtonStyle,
    opacity: disabled ? 0.56 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  } as const;
}

function markOneButtonStyle(disabled: boolean) {
  return {
    border: 'none',
    minHeight: 38,
    padding: '0 12px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.05)',
    color: TOKENS.textSecondary,
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.56 : 1,
  } as const;
}
