'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchCommunities,
  fetchJoinedCommunityIds,
  joinCommunityAction,
  leaveCommunityAction,
} from '../actions';
import {
  CommunityTile,
  EmptyState,
  GlassCard,
  SectionIntro,
  StatPill,
} from '../components';
import {
  TOKENS,
  chipStyle,
  gradientButtonStyle,
  inputStyle,
} from '../ui';

interface CommunityRow {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  communityType: string;
  humansOnly: boolean | number;
  memberCount: number;
  threadCount: number;
}

type TypeFilter = 'all' | 'humans' | 'public' | 'restricted' | 'private';
type SortMode = 'largest' | 'threads' | 'a-z';

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<SortMode>('largest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [communityResult, membershipIds] = await Promise.all([
          fetchCommunities({ limit: 200 }),
          fetchJoinedCommunityIds(),
        ]);
        if (cancelled) return;
        setCommunities((communityResult as CommunityRow[]) ?? []);
        setJoinedIds(membershipIds);
      } catch {
        if (!cancelled) setError('Could not load the community explorer.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleMembership(communityId: string, joined: boolean) {
    const previous = joinedIds;
    setJoinedIds((current) =>
      joined ? current.filter((id) => id !== communityId) : [...current, communityId],
    );
    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId
          ? {
              ...community,
              memberCount: Math.max(0, community.memberCount + (joined ? -1 : 1)),
            }
          : community,
      ),
    );
    try {
      if (joined) {
        await leaveCommunityAction(communityId);
      } else {
        await joinCommunityAction(communityId);
      }
    } catch {
      setJoinedIds(previous);
    }
  }

  const filtered = useMemo(() => {
    const next = communities.filter((community) => {
      const matchesQuery =
        query.trim().length === 0 ||
        community.displayName.toLowerCase().includes(query.trim().toLowerCase()) ||
        community.name.toLowerCase().includes(query.trim().toLowerCase()) ||
        (community.description ?? '').toLowerCase().includes(query.trim().toLowerCase());
      if (!matchesQuery) return false;
      if (typeFilter === 'humans') return Boolean(community.humansOnly);
      if (typeFilter === 'all') return true;
      return community.communityType === typeFilter;
    });

    return next.sort((left, right) => {
      if (sort === 'threads') return right.threadCount - left.threadCount;
      if (sort === 'a-z') return left.displayName.localeCompare(right.displayName);
      return right.memberCount - left.memberCount;
    });
  }, [communities, query, sort, typeFilter]);

  const joined = filtered.filter((community) => joinedIds.includes(community.id));
  const discover = filtered.filter((community) => !joinedIds.includes(community.id));

  if (loading) {
    return (
      <div className="forums-page-stack">
        <GlassCard style={{ minHeight: 180, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div className="forums-content-grid">
          <GlassCard style={{ minHeight: 380, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <GlassCard style={{ minHeight: 380, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="groups"
        title="Community explorer unavailable"
        description={error}
        actionHref="/forums"
        actionLabel="Return to feed"
      />
    );
  }

  return (
    <div className="forums-page-stack">
      <SectionIntro
        eyebrow="Community Explorer"
        title="Find the vault that matches your standards."
        description="Browse focused discussion spaces, filter for humans-only rooms, and move between your joined communities and the wider discovery catalog without leaving the Curator shell."
        actions={
          <>
            <StatPill label="Joined" value={String(joinedIds.length)} icon="groups" />
            <Link href="/forums/create-community" style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
              Create community
            </Link>
          </>
        }
      />

      <div className="forums-content-grid">
        <GlassCard className="forums-sidebar-card">
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: TOKENS.primary, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 800 }}>
                Filter rail
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search categories or descriptions..."
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <span style={filterLabelStyle}>Type</span>
              <div className="forums-chip-row">
                {([
                  ['all', 'All'],
                  ['humans', 'Humans Only'],
                  ['public', 'Public'],
                  ['restricted', 'Restricted'],
                  ['private', 'Private'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTypeFilter(value)}
                    style={chipStyle(typeFilter === value, value === 'humans' ? 'trust' : 'gold')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <span style={filterLabelStyle}>Sort</span>
              <div className="forums-chip-row">
                {([
                  ['largest', 'Largest'],
                  ['threads', 'Most threads'],
                  ['a-z', 'A–Z'],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setSort(value)} style={chipStyle(sort === value, 'neutral')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8, padding: 18, borderRadius: 24, background: 'rgba(255,255,255,0.04)' }}>
              <span style={{ color: TOKENS.primaryLight, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Curator note
              </span>
              <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.65, fontSize: 14 }}>
                Purple stays reserved for trust semantics here too. Warm gold remains the browser chrome and action language.
              </p>
            </div>
          </div>
        </GlassCard>

        <div style={{ display: 'grid', gap: 28 }}>
          {joined.length > 0 ? (
            <section style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <span style={{ color: TOKENS.primary, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 800 }}>
                    Your communities
                  </span>
                  <h2 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Already inside</h2>
                </div>
                <span style={{ color: TOKENS.textTertiary, fontSize: 13 }}>
                  {joined.length} joined
                </span>
              </div>
              <div className="forums-two-up">
                {joined.map((community) => (
                  <CommunityTile
                    key={community.id}
                    href={`/forums/community/${community.id}`}
                    title={community.displayName}
                    description={community.description ?? 'Focused discussion for signal-heavy members.'}
                    members={community.memberCount}
                    threads={community.threadCount}
                    humansOnly={community.humansOnly}
                    joined
                    actionLabel="Leave"
                    onAction={() => void toggleMembership(community.id, true)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <span style={{ color: TOKENS.primary, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 800 }}>
                  Discover
                </span>
                <h2 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>New rooms to enter</h2>
              </div>
              <span style={{ color: TOKENS.textTertiary, fontSize: 13 }}>
                {discover.length} visible
              </span>
            </div>

            {discover.length === 0 ? (
              <EmptyState
                icon="travel_explore"
                title="No new communities matched"
                description="Your current search and filter combination narrowed the archive to nothing. Try widening the type filter or clearing the query."
              />
            ) : (
              <div className="forums-two-up">
                {discover.map((community) => (
                  <CommunityTile
                    key={community.id}
                    href={`/forums/community/${community.id}`}
                    title={community.displayName}
                    description={community.description ?? 'Focused discussion for signal-heavy members.'}
                    members={community.memberCount}
                    threads={community.threadCount}
                    humansOnly={community.humansOnly}
                    joined={joinedIds.includes(community.id)}
                    actionLabel={joinedIds.includes(community.id) ? 'Joined' : 'Join'}
                    onAction={() => void toggleMembership(community.id, joinedIds.includes(community.id))}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const filterLabelStyle = {
  color: TOKENS.textTertiary,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
} as const;
