'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  fetchCommunities,
  fetchProfilesByIds,
  searchCommunitiesAction,
  searchProfilesAction,
  searchRepliesAction,
  searchThreadsAction,
} from '../actions';
import {
  Avatar,
  EmptyState,
  GlassCard,
  HighlightedText,
  HumanVerifiedChip,
  SectionIntro,
  StatPill,
  SurfaceCard,
} from '../components';
import {
  TOKENS,
  chipStyle,
  formatRelativeTime,
  getTrustTier,
  inputStyle,
  truncate,
} from '../ui';

interface ThreadRow {
  id: string;
  title: string;
  body: string;
  authorId: string;
  voteScore: number;
  replyCount: number;
  createdAt: string;
  communityId: string;
}

interface ReplyRow {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  voteScore: number;
  createdAt: string;
  threadTitle: string | null;
  communityId: string | null;
}

interface CommunityRow {
  id: string;
  displayName: string;
  description: string | null;
  memberCount: number;
}

interface ProfileRow {
  id: string;
  displayName: string;
  username: string;
  bio: string;
  karma: number;
  isVerified: boolean | number;
  avatarUrl: string | null;
}

type Scope = 'threads' | 'replies' | 'communities' | 'users';
type DateFilter = 'any' | '24h' | '7d' | '30d';
type TrustFilter = 'all' | 'verified' | 'trusted' | 'mod';

function SearchPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const initialScope = (searchParams.get('scope') as Scope) || 'threads';
  const initialDate = (searchParams.get('date') as DateFilter) || 'any';
  const initialTrust = (searchParams.get('trust') as TrustFilter) || 'all';
  const initialCommunity = searchParams.get('community') ?? 'all';
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [scope, setScope] = useState<Scope>(initialScope);
  const [dateFilter, setDateFilter] = useState<DateFilter>(initialDate);
  const [trustFilter, setTrustFilter] = useState<TrustFilter>(initialTrust);
  const [communityFilter, setCommunityFilter] = useState(initialCommunity);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileRow>>({});
  const [allCommunities, setAllCommunities] = useState<CommunityRow[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('forums:web:recent-searches');
      if (raw) setRecentSearches(JSON.parse(raw) as string[]);
    } catch {
      // Ignore local storage failures.
    }
    void fetchCommunities({ limit: 100 }).then((result) => setAllCommunities((result as CommunityRow[]) ?? []));
  }, []);

  useEffect(() => {
    if (initialQuery) {
      void runSearch(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (submittedQuery) params.set('q', submittedQuery);
    if (scope !== 'threads') params.set('scope', scope);
    if (dateFilter !== 'any') params.set('date', dateFilter);
    if (trustFilter !== 'all') params.set('trust', trustFilter);
    if (communityFilter !== 'all') params.set('community', communityFilter);
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next, { scroll: false });
  }, [communityFilter, dateFilter, pathname, router, scope, submittedQuery, trustFilter]);

  async function runSearch(nextQuery = query) {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const [threadResult, replyResult, communityResult, profileResult] = await Promise.all([
        searchThreadsAction(trimmed),
        searchRepliesAction(trimmed),
        searchCommunitiesAction(trimmed),
        searchProfilesAction(trimmed),
      ]);

      const threadRows = (threadResult as ThreadRow[]) ?? [];
      const replyRows = (replyResult as ReplyRow[]) ?? [];
      const communityRows = (communityResult as CommunityRow[]) ?? [];
      const profileRows = (profileResult as ProfileRow[]) ?? [];
      const authorIds = Array.from(
        new Set([...threadRows.map((thread) => thread.authorId), ...replyRows.map((reply) => reply.authorId)]),
      );
      const authorProfiles = (await fetchProfilesByIds(authorIds)) as ProfileRow[];
      const nextProfileMap = Object.fromEntries(
        [...profileRows, ...authorProfiles].map((profile) => [profile.id, profile]),
      );

      setThreads(threadRows);
      setReplies(replyRows);
      setCommunities(communityRows);
      setProfiles(profileRows);
      setProfileMap(nextProfileMap);
      setSearched(true);
      setSubmittedQuery(trimmed);

      const nextRecent = [trimmed, ...recentSearches.filter((entry) => entry !== trimmed)].slice(0, 8);
      setRecentSearches(nextRecent);
      window.localStorage.setItem('forums:web:recent-searches', JSON.stringify(nextRecent));
    } catch {
      setError('Search failed. Try another term or widen the query.');
    } finally {
      setLoading(false);
    }
  }

  const filteredThreads = useMemo(
    () =>
      threads.filter(
        (thread) =>
          matchesDateFilter(thread.createdAt, dateFilter) &&
          matchesTrust(profileMap[thread.authorId], trustFilter) &&
          matchesCommunity(thread.communityId, communityFilter),
      ),
    [communityFilter, dateFilter, profileMap, threads, trustFilter],
  );

  const filteredReplies = useMemo(
    () =>
      replies.filter(
        (reply) =>
          matchesDateFilter(reply.createdAt, dateFilter) &&
          matchesTrust(profileMap[reply.authorId], trustFilter) &&
          matchesCommunity(reply.communityId, communityFilter),
      ),
    [communityFilter, dateFilter, profileMap, replies, trustFilter],
  );

  const filteredCommunities = useMemo(
    () => communities.filter((community) => matchesCommunity(community.id, communityFilter)),
    [communities, communityFilter],
  );

  const resultsCount =
    scope === 'threads'
      ? filteredThreads.length
      : scope === 'replies'
        ? filteredReplies.length
        : scope === 'communities'
          ? filteredCommunities.length
          : profiles.length;

  return (
    <div className="forums-page-stack">
      <SectionIntro
        eyebrow="Search Results"
        title={searched ? `Found ${resultsCount} ${scope}` : 'Search the archive'}
        description="Search threads, replies, communities, and users from one desktop results surface. Match highlights stay warm gold, while trust verification keeps the purple semantic lane."
        actions={searched ? <StatPill label="Scope" value={scope} icon="travel_explore" /> : undefined}
      />

      <GlassCard style={{ position: 'sticky', top: 96, zIndex: 10 }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch();
          }}
          style={{ display: 'grid', gap: 14 }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search threads, replies, communities, or users..."
            style={{ ...inputStyle, fontSize: 16, padding: '18px 20px' }}
          />
          <div className="forums-chip-row" style={{ justifyContent: 'space-between' }}>
            <div className="forums-chip-row">
              {(['threads', 'replies', 'communities', 'users'] as Scope[]).map((value) => (
                <button key={value} type="button" onClick={() => setScope(value)} style={chipStyle(scope === value)}>
                  {value}
                </button>
              ))}
            </div>
            <button type="submit" style={submitButtonStyle}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </form>
      </GlassCard>

      <div className="forums-content-grid">
        <GlassCard className="forums-sidebar-card">
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <span style={filterLabelStyle}>Date range</span>
              <div className="forums-chip-row">
                {([
                  ['any', 'Anytime'],
                  ['24h', '24 hours'],
                  ['7d', 'Past week'],
                  ['30d', 'Past month'],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setDateFilter(value)} style={chipStyle(dateFilter === value, 'neutral')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <span style={filterLabelStyle}>Author trust</span>
              <div className="forums-chip-row">
                {([
                  ['all', 'All'],
                  ['verified', 'Verified'],
                  ['trusted', 'Trusted+'],
                  ['mod', 'Moderators'],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setTrustFilter(value)} style={chipStyle(trustFilter === value, value === 'all' ? 'neutral' : 'trust')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <span style={filterLabelStyle}>Communities</span>
              <div style={{ display: 'grid', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setCommunityFilter('all')}
                  style={filterRailButtonStyle(communityFilter === 'all')}
                >
                  <span>All communities</span>
                  <span style={{ color: TOKENS.textTertiary }}>{allCommunities.length}</span>
                </button>
                {allCommunities.slice(0, 8).map((community) => (
                  <button
                    key={community.id}
                    type="button"
                    onClick={() => setCommunityFilter(community.id)}
                    style={filterRailButtonStyle(communityFilter === community.id)}
                  >
                    <span>{community.displayName}</span>
                    <span style={{ color: TOKENS.textTertiary }}>{community.memberCount}</span>
                  </button>
                ))}
                <span style={{ color: TOKENS.textTertiary, fontSize: 12, lineHeight: 1.5 }}>
                  Applies to thread, reply, and community results.
                </span>
              </div>
            </div>
          </div>
        </GlassCard>

        <div style={{ display: 'grid', gap: 20 }}>
          {error ? (
            <EmptyState icon="search_off" title="Search stumbled" description={error} />
          ) : !searched ? (
            <EmptyState
              icon="search"
              title="Search for high-signal discussion"
              description="Use the global search field to look across threads, replies, communities, and user profiles."
            />
          ) : resultsCount === 0 ? (
            <EmptyState
              icon="hide_source"
              title="No results for this combination"
              description="Try a broader term, switch scopes, or relax the trust and date filters."
            />
          ) : scope === 'threads' ? (
            filteredThreads.map((thread) => (
              <SurfaceCard key={thread.id} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <Link href={`/forums/thread/${thread.id}`} style={{ color: TOKENS.text, textDecoration: 'none' }}>
                      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>
                        <HighlightedText text={thread.title} query={query} />
                      </h2>
                    </Link>
                    <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.65 }}>
                      <HighlightedText text={truncate(thread.body, 220)} query={query} />
                    </p>
                  </div>
                  <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                    <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{formatRelativeTime(thread.createdAt)}</span>
                    <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{thread.replyCount} replies</span>
                  </div>
                </div>
              </SurfaceCard>
            ))
          ) : scope === 'replies' ? (
            filteredReplies.map((reply) => {
              const author = profileMap[reply.authorId];
              return (
                <SurfaceCard key={reply.id} style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Avatar label={author?.displayName ?? 'Curator'} size={38} imageUrl={author?.avatarUrl} />
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong>{author?.displayName ?? 'Curator'}</strong>
                        <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{formatRelativeTime(reply.createdAt)}</span>
                      </div>
                    </div>
                    {author ? <HumanVerifiedChip compact karma={author.karma} isVerified={author.isVerified} /> : null}
                  </div>
                  <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.65 }}>
                    <HighlightedText text={truncate(reply.body, 220)} query={query} />
                  </p>
                  <Link href={`/forums/thread/${reply.threadId}`} style={{ color: TOKENS.primaryLight, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                    In {reply.threadTitle ?? 'thread'}
                  </Link>
                </SurfaceCard>
              );
            })
          ) : scope === 'communities' ? (
            filteredCommunities.map((community) => (
              <SurfaceCard key={community.id} style={{ display: 'grid', gap: 12 }}>
                <Link href={`/forums/community/${community.id}`} style={{ color: TOKENS.text, textDecoration: 'none' }}>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>
                    <HighlightedText text={community.displayName} query={query} />
                  </h2>
                </Link>
                <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.65 }}>
                  <HighlightedText text={truncate(community.description ?? 'Focused community discussion.', 200)} query={query} />
                </p>
                <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{community.memberCount} members</span>
              </SurfaceCard>
            ))
          ) : (
            profiles.map((profile) => (
              <SurfaceCard key={profile.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <Avatar label={profile.displayName} size={56} imageUrl={profile.avatarUrl} />
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Link href={`/forums/profile/${profile.id}`} style={{ color: TOKENS.text, textDecoration: 'none' }}>
                      <strong style={{ fontSize: 18 }}>
                        <HighlightedText text={profile.displayName} query={query} />
                      </strong>
                    </Link>
                    <span style={{ color: TOKENS.textTertiary, fontSize: 13 }}>@{profile.username}</span>
                    <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.6 }}>
                      <HighlightedText text={truncate(profile.bio || 'Curator profile', 140)} query={query} />
                    </p>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                  <HumanVerifiedChip compact karma={profile.karma} isVerified={profile.isVerified} />
                  <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{getTrustTier({ karma: profile.karma, isVerified: profile.isVerified })}</span>
                </div>
              </SurfaceCard>
            ))
          )}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <GlassCard className="forums-sidebar-card">
            <div style={{ display: 'grid', gap: 16 }}>
              <span style={filterLabelStyle}>Recent searches</span>
              {recentSearches.length === 0 ? (
                <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.6 }}>
                  Search history is empty. Recent queries will appear here.
                </p>
              ) : (
                recentSearches.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => {
                      setQuery(entry);
                      void runSearch(entry);
                    }}
                    style={{
                      ...chipStyle(false, 'neutral'),
                      justifyContent: 'flex-start',
                    }}
                  >
                    {entry}
                  </button>
                ))
              )}
            </div>
          </GlassCard>

          <GlassCard>
            <div style={{ display: 'grid', gap: 14 }}>
              <span style={filterLabelStyle}>Trending tags</span>
              <div className="forums-chip-row">
                {['trust systems', 'humans only', 'moderation', 'archives', 'signal'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setQuery(tag);
                      void runSearch(tag);
                    }}
                    style={chipStyle(false)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function matchesDateFilter(value: string, filter: DateFilter): boolean {
  if (filter === 'any') return true;
  const age = Date.now() - new Date(value).getTime();
  if (filter === '24h') return age <= 24 * 60 * 60 * 1000;
  if (filter === '7d') return age <= 7 * 24 * 60 * 60 * 1000;
  return age <= 30 * 24 * 60 * 60 * 1000;
}

function matchesTrust(profile: ProfileRow | undefined, filter: TrustFilter): boolean {
  if (filter === 'all' || !profile) return true;
  const tier = getTrustTier({ karma: profile.karma, isVerified: profile.isVerified });
  if (filter === 'verified') return Boolean(profile.isVerified) || tier === 'mod';
  if (filter === 'trusted') return tier === 'trusted' || tier === 'highly_trusted' || tier === 'mod';
  return tier === 'mod';
}

function matchesCommunity(value: string | null | undefined, filter: string): boolean {
  return filter === 'all' || value === filter;
}

const filterLabelStyle = {
  color: TOKENS.textTertiary,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
} as const;

const submitButtonStyle = {
  border: 'none',
  borderRadius: 999,
  padding: '10px 16px',
  background: `linear-gradient(135deg, ${TOKENS.primaryLight}, ${TOKENS.primary})`,
  color: '#2E1600',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
} as const;

function filterRailButtonStyle(active: boolean) {
  return {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
    border: 'none',
    borderRadius: 18,
    padding: '11px 12px',
    background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
    color: active ? TOKENS.primaryLight : TOKENS.textSecondary,
    fontSize: 13,
    fontWeight: active ? 700 : 600,
    textAlign: 'left',
    cursor: 'pointer',
  } as const;
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  );
}
