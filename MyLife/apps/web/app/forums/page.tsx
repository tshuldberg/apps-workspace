'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { useEffectEvent } from '@/lib/react';
import Link from 'next/link';
import {
  castVoteAction,
  fetchAllThreads,
  fetchCommunities,
  fetchJoinedCommunityIds,
  fetchProfilesByIds,
} from './actions';
import {
  Avatar,
  DesktopThreadCard,
  EmptyState,
  GlassCard,
  HumanVerifiedChip,
  SectionIntro,
  StatPill,
} from './components';
import {
  TOKENS,
  chipStyle,
  formatCount,
  formatRelativeTime,
  getTrustTier,
  gradientButtonStyle,
  truncate,
} from './ui';

interface ThreadRow {
  id: string;
  communityId: string;
  authorId: string;
  title: string;
  body: string;
  isPinned: boolean | number;
  voteScore: number;
  replyCount: number;
  viewCount: number;
  createdAt: string;
}

interface CommunityRow {
  id: string;
  displayName: string;
  description: string | null;
  humansOnly: boolean | number;
  memberCount: number;
  threadCount: number;
}

interface ProfileRow {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  karma: number;
  isVerified: boolean | number;
}

type SortMode = 'hot' | 'new' | 'top';
type WindowMode = '24h' | '7d' | '30d' | 'all';

export default function ForumsFeedPage() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [sort, setSort] = useState<SortMode>('hot');
  const [windowMode, setWindowMode] = useState<WindowMode>('7d');
  const [humansOnly, setHumansOnly] = useState(false);
  const [voteState, setVoteState] = useState<Record<string, 'up' | 'down' | null>>({});
  const [pendingThreads, setPendingThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useEffectEvent(async (nextSort: SortMode) => {
    try {
      setError(null);
      const [threadResult, communityResult, membershipIds] = await Promise.all([
        fetchAllThreads({ sort: nextSort, limit: 72 }),
        fetchCommunities({ limit: 200 }),
        fetchJoinedCommunityIds(),
      ]);
      const nextThreads = (threadResult as ThreadRow[]) ?? [];
      const nextCommunities = (communityResult as CommunityRow[]) ?? [];
      const authorIds = Array.from(new Set(nextThreads.map((thread) => thread.authorId)));
      const profileRows = await fetchProfilesByIds(authorIds);
      const nextProfiles = Object.fromEntries(
        (profileRows as ProfileRow[]).map((profile) => [profile.id, profile]),
      );

      startTransition(() => {
        setThreads(nextThreads);
        setCommunities(nextCommunities);
        setJoinedIds(membershipIds);
        setProfiles(nextProfiles);
      });
    } catch {
      setError('Could not load the forums feed right now.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    setLoading(true);
    void loadFeed(sort);
  }, [loadFeed, sort]);

  const pollForNewThreads = useEffectEvent(async () => {
    try {
      const latest = (await fetchAllThreads({ sort, limit: 18 })) as ThreadRow[];
      if (latest.length === 0 || threads.length === 0) return;
      const fresh = latest.filter((thread) => !threads.some((existing) => existing.id === thread.id));
      if (fresh.length > 0) setPendingThreads(fresh);
    } catch {
      // Silent background polling failure.
    }
  });

  useEffect(() => {
    if (threads.length === 0) return undefined;
    const interval = window.setInterval(() => {
      void pollForNewThreads();
    }, 20000);
    return () => window.clearInterval(interval);
  }, [pollForNewThreads, threads.length]);

  async function handleVote(threadId: string, direction: 'up' | 'down') {
    const previous = voteState[threadId] ?? null;
    const next = previous === direction ? null : direction;
    const delta =
      next == null
        ? previous === 'up'
          ? -1
          : 1
        : previous == null
          ? direction === 'up'
            ? 1
            : -1
          : direction === 'up'
            ? 2
            : -2;

    setVoteState((current) => ({ ...current, [threadId]: next }));
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId ? { ...thread, voteScore: thread.voteScore + delta } : thread,
      ),
    );

    try {
      await castVoteAction('thread', threadId, direction);
    } catch {
      setVoteState((current) => ({ ...current, [threadId]: previous }));
      setThreads((current) =>
        current.map((thread) =>
          thread.id === threadId ? { ...thread, voteScore: thread.voteScore - delta } : thread,
        ),
      );
    }
  }

  const communityMap = useMemo(
    () => Object.fromEntries(communities.map((community) => [community.id, community])),
    [communities],
  );

  const filteredThreads = useMemo(() => {
    const now = Date.now();
    const threshold =
      windowMode === '24h'
        ? 24 * 60 * 60 * 1000
        : windowMode === '7d'
          ? 7 * 24 * 60 * 60 * 1000
          : windowMode === '30d'
            ? 30 * 24 * 60 * 60 * 1000
            : Infinity;

    return threads.filter((thread) => {
      const community = communityMap[thread.communityId];
      if (humansOnly && !community?.humansOnly) return false;
      if (threshold !== Infinity && now - new Date(thread.createdAt).getTime() > threshold) return false;
      return true;
    });
  }, [communityMap, humansOnly, threads, windowMode]);

  const pinnedThreads = filteredThreads.filter((thread) => Boolean(thread.isPinned)).slice(0, 4);
  const mainFeed = filteredThreads.filter((thread) => !thread.isPinned);

  const trendingCommunities = useMemo(() => {
    return [...communities]
      .sort((left, right) => right.memberCount + right.threadCount - (left.memberCount + left.threadCount))
      .slice(0, 5);
  }, [communities]);

  const activeProfiles = useMemo(() => {
    const ranked = Object.values(profiles)
      .sort((left, right) => right.karma - left.karma)
      .slice(0, 5);
    return ranked;
  }, [profiles]);

  if (loading) {
    return (
      <div className="forums-page-stack">
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ width: 260, height: 18, borderRadius: 999, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ width: '72%', height: 54, borderRadius: 22, background: 'rgba(255,255,255,0.06)' }} />
        </div>
        <div className="forums-feed-grid">
          {Array.from({ length: 3 }).map((_, column) => (
            <GlassCard key={column} style={{ minHeight: 360, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="forum"
        title="The archive door stayed shut"
        description={error}
        actionHref="/forums"
        actionLabel="Reload feed"
      />
    );
  }

  if (filteredThreads.length === 0) {
    return (
      <EmptyState
        icon="forum"
        title="No threads match this lens"
        description="Try widening the time range, disable the humans-only filter, or join more communities to populate the feed."
        actionHref="/forums/communities"
        actionLabel="Browse communities"
      />
    );
  }

  return (
    <div className="forums-page-stack">
      <SectionIntro
        eyebrow="Main Feed"
        title="Curated threads, sorted for signal."
        description="The web feed uses warm gold chrome for navigation and reserve purple for verified-human trust signals only. Filter aggressively, then move between communities without losing the archive context."
        actions={
          <>
            <StatPill label="Joined" value={String(joinedIds.length)} icon="groups" />
            <StatPill label="Visible threads" value={String(filteredThreads.length)} icon="forum" />
          </>
        }
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="forums-chip-row">
          <button type="button" onClick={() => setHumansOnly((current) => !current)} style={chipStyle(humansOnly, 'trust')}>
            Humans Only
          </button>
          {(['hot', 'new', 'top'] as SortMode[]).map((value) => (
            <button key={value} type="button" onClick={() => setSort(value)} style={chipStyle(sort === value)}>
              {value}
            </button>
          ))}
          {(['24h', '7d', '30d', 'all'] as WindowMode[]).map((value) => (
            <button key={value} type="button" onClick={() => setWindowMode(value)} style={chipStyle(windowMode === value, 'neutral')}>
              {value}
            </button>
          ))}
        </div>
        <Link href="/forums/create-thread" style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
          Start a thread
        </Link>
      </div>

      {pendingThreads.length > 0 ? (
        <GlassCard style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <strong style={{ fontSize: 18 }}>Realtime update ready</strong>
            <span style={{ color: TOKENS.textSecondary, lineHeight: 1.5 }}>
              {pendingThreads.length} new thread{pendingThreads.length === 1 ? '' : 's'} landed while you were reading.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setPendingThreads([]);
              setLoading(true);
              void loadFeed(sort);
            }}
            style={gradientButtonStyle}
          >
            Refresh feed
          </button>
        </GlassCard>
      ) : null}

      <div className="forums-feed-grid">
        <div style={{ display: 'grid', gap: 16 }}>
          <GlassCard className="forums-sidebar-card">
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: TOKENS.primary, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800 }}>
                  Pinned
                </span>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Reading room picks</h2>
              </div>
              {pinnedThreads.length === 0 ? (
                <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.6 }}>
                  No pinned threads match the current filter set.
                </p>
              ) : (
                pinnedThreads.map((thread) => (
                  <Link key={thread.id} href={`/forums/thread/${thread.id}`} style={{ textDecoration: 'none', color: TOKENS.text }}>
                    <div style={{ display: 'grid', gap: 8, padding: 16, borderRadius: 24, background: 'rgba(255,255,255,0.04)' }}>
                      <span style={{ color: TOKENS.primaryLight, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                        {communityMap[thread.communityId]?.displayName ?? 'Community'}
                      </span>
                      <strong style={{ fontSize: 16, lineHeight: 1.3 }}>{thread.title}</strong>
                      <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
                        {formatRelativeTime(thread.createdAt)} · {formatCount(thread.replyCount)} replies
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {mainFeed.map((thread) => {
            const author = profiles[thread.authorId];
            const community = communityMap[thread.communityId];
            return (
              <DesktopThreadCard
                key={thread.id}
                href={`/forums/thread/${thread.id}`}
                title={thread.title}
                body={truncate(thread.body.replace(/\s+/g, ' ').trim(), 280)}
                communityLabel={community?.displayName}
                authorLabel={author?.displayName ?? 'Anonymous Curator'}
                createdAt={thread.createdAt}
                replies={thread.replyCount}
                votes={thread.voteScore}
                views={thread.viewCount}
                pinned={Boolean(thread.isPinned)}
                trust={{
                  karma: author?.karma ?? 0,
                  isVerified: author?.isVerified ?? false,
                }}
                voteState={voteState[thread.id] ?? null}
                onVote={(direction) => void handleVote(thread.id, direction)}
                footer={
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Link href={`/forums/thread/${thread.id}`} style={secondaryActionLinkStyle}>
                      Discuss
                    </Link>
                    <Link href={`/forums/community/${thread.communityId}`} style={secondaryActionLinkStyle}>
                      Community
                    </Link>
                  </div>
                }
              />
            );
          })}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <GlassCard className="forums-sidebar-card">
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: TOKENS.primary, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800 }}>
                  Trending communities
                </span>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Vaults with momentum</h2>
              </div>
              {trendingCommunities.map((community) => (
                <Link key={community.id} href={`/forums/community/${community.id}`} style={{ textDecoration: 'none', color: TOKENS.text }}>
                  <div style={{ display: 'grid', gap: 8, padding: 16, borderRadius: 24, background: 'rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{community.displayName}</strong>
                      {community.humansOnly ? <HumanVerifiedChip karma={900} isVerified compact /> : null}
                    </div>
                    <p style={{ margin: 0, color: TOKENS.textSecondary, fontSize: 13, lineHeight: 1.55 }}>
                      {truncate(community.description ?? 'Focused discussion and high-signal curation.', 96)}
                    </p>
                    <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
                      {formatCount(community.memberCount)} members · {formatCount(community.threadCount)} threads
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: TOKENS.primary, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800 }}>
                  Active members
                </span>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Verified voices</h2>
              </div>
              {activeProfiles.length === 0 ? (
                <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.6 }}>
                  As profiles gain karma they surface here with trust context.
                </p>
              ) : (
                activeProfiles.map((profile) => (
                  <Link key={profile.id} href={`/forums/profile/${profile.id}`} style={{ textDecoration: 'none', color: TOKENS.text }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Avatar label={profile.displayName} size={40} imageUrl={profile.avatarUrl} />
                        <div style={{ display: 'grid', gap: 4 }}>
                          <strong style={{ fontSize: 14 }}>{profile.displayName}</strong>
                          <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>@{profile.username}</span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
                        <HumanVerifiedChip
                          compact
                          karma={profile.karma}
                          isVerified={profile.isVerified}
                          role={getTrustTier({ karma: profile.karma, isVerified: profile.isVerified }) === 'mod' ? 'moderator' : undefined}
                        />
                        <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{formatCount(profile.karma)} karma</span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

const secondaryActionLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 14px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
} as const;
