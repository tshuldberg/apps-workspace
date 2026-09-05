'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  fetchCommunityById,
  fetchJoinedCommunities,
  fetchModLog,
} from '../actions';
import {
  EmptyState,
  GlassCard,
  MaterialSymbol,
  SectionIntro,
  SurfaceCard,
} from '../components';
import { TOKENS, chipStyle, formatRelativeTime, gradientButtonStyle } from '../ui';

interface CommunityRow {
  id: string;
  displayName: string;
  description: string | null;
  communityType: string;
  memberCount: number;
}

interface ModActionRow {
  id: string;
  communityId: string;
  actionType: string;
  targetId: string | null;
  reason: string | null;
  createdAt: string;
  moderatorId: string;
}

interface JoinedActionRow extends ModActionRow {
  communityName: string;
}

function ModerationLogHubPageContent() {
  const searchParams = useSearchParams();
  const requestedCommunityId = searchParams.get('community');

  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [actions, setActions] = useState<JoinedActionRow[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>('all');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const joined = ((await fetchJoinedCommunities()) as CommunityRow[]) ?? [];
        const nextCommunities = [...joined];

        if (
          requestedCommunityId &&
          !nextCommunities.some((community) => community.id === requestedCommunityId)
        ) {
          const requestedCommunity = (await fetchCommunityById(
            requestedCommunityId,
          )) as CommunityRow | undefined;
          if (requestedCommunity) nextCommunities.push(requestedCommunity);
        }

        const logResults = await Promise.all(
          nextCommunities.map(async (community) => {
            const result = (await fetchModLog(community.id)) as ModActionRow[];
            return result.map((action) => ({
              ...action,
              communityName: community.displayName,
            }));
          }),
        );

        if (cancelled) return;

        const flattened = logResults
          .flat()
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

        setCommunities(nextCommunities);
        setActions(flattened);
        setSelectedCommunityId(
          requestedCommunityId && nextCommunities.some((community) => community.id === requestedCommunityId)
            ? requestedCommunityId
            : 'all',
        );
      } catch {
        if (!cancelled) setError('Could not load moderation logs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestedCommunityId]);

  const actionTypes = useMemo(
    () => ['all', ...new Set(actions.map((action) => action.actionType))],
    [actions],
  );

  const filtered = useMemo(() => {
    return actions.filter((action) => {
      const communityMatch = selectedCommunityId === 'all' || action.communityId === selectedCommunityId;
      const typeMatch = filter === 'all' || action.actionType === filter;
      return communityMatch && typeMatch;
    });
  }, [actions, filter, selectedCommunityId]);

  const selectedCommunity =
    selectedCommunityId === 'all'
      ? null
      : communities.find((community) => community.id === selectedCommunityId) ?? null;

  if (loading) {
    return <GlassCard style={{ minHeight: 420, animation: 'pulse 1.5s ease-in-out infinite' }} />;
  }

  if (error) {
    return (
      <EmptyState
        icon="gavel"
        title="Moderation feed unavailable"
        description={error}
        actionHref="/forums/communities"
        actionLabel="Back to browser"
      />
    );
  }

  if (communities.length === 0) {
    return (
      <EmptyState
        icon="forum"
        title="No moderated rooms yet"
        description="Join or create a community first, then the shared moderation feed can aggregate the public actions here."
        actionHref="/forums/create-community"
        actionLabel="Create community"
      />
    );
  }

  return (
    <div className="forums-page-stack">
      <SectionIntro
        eyebrow="Moderation"
        title={selectedCommunity ? `${selectedCommunity.displayName} moderator feed` : 'Cross-community moderator feed'}
        description="This desktop moderation surface aggregates public interventions across your rooms, then narrows with community and action filters."
        actions={
          selectedCommunity ? (
            <>
              <Link href={`/forums/community/${selectedCommunity.id}`} style={ghostLinkStyle}>
                View community
              </Link>
              <Link href={`/forums/community-health/${selectedCommunity.id}`} style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
                Community health
              </Link>
            </>
          ) : (
            <Link href="/forums/communities" style={ghostLinkStyle}>
              Browse communities
            </Link>
          )
        }
      />

      <div className="forums-detail-grid" style={{ gridTemplateColumns: '280px minmax(0, 1fr)' }}>
        <GlassCard className="forums-sidebar-card" style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <span style={eyebrowStyle}>Communities</span>
            <button
              type="button"
              onClick={() => setSelectedCommunityId('all')}
              style={chipStyle(selectedCommunityId === 'all', 'neutral')}
            >
              All rooms
            </button>
            {communities.map((community) => (
              <button
                key={community.id}
                type="button"
                onClick={() => setSelectedCommunityId(community.id)}
                style={chipStyle(selectedCommunityId === community.id, 'gold')}
              >
                {community.displayName}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <span style={eyebrowStyle}>Action types</span>
            <div className="forums-chip-row">
              {actionTypes.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  style={chipStyle(filter === value, value === 'lock_thread' ? 'trust' : 'neutral')}
                >
                  {value === 'all' ? 'all actions' : value.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <span style={eyebrowStyle}>Feed counts</span>
            <div style={summaryRowStyle}>
              <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>Communities</span>
              <strong>{communities.length}</strong>
            </div>
            <div style={summaryRowStyle}>
              <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>Visible actions</span>
              <strong>{filtered.length}</strong>
            </div>
          </div>
        </GlassCard>

        <div style={{ display: 'grid', gap: 14 }}>
          {filtered.length === 0 ? (
            <EmptyState
              icon="visibility"
              title="Nothing matches this moderation slice"
              description="Try a different community or action type to expand the feed."
              actionHref="/forums/mod-log"
              actionLabel="Reset filters"
            />
          ) : (
            filtered.map((action) => (
              <SurfaceCard key={action.id} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={iconBadgeStyle(action.actionType)}>
                      <MaterialSymbol
                        name={action.actionType === 'lock_thread' ? 'lock' : action.actionType === 'pin_thread' ? 'keep' : 'edit'}
                        size={16}
                        color={action.actionType === 'lock_thread' ? TOKENS.trustLight : TOKENS.primaryLight}
                      />
                    </span>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <strong style={{ fontSize: 16, textTransform: 'capitalize' }}>
                        {action.actionType.replace(/_/g, ' ')}
                      </strong>
                      <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
                        {action.communityName} · {formatRelativeTime(action.createdAt)}
                      </span>
                    </div>
                  </div>
                  <Link href={`/forums/community/${action.communityId}`} style={linkPillStyle}>
                    Open room
                  </Link>
                </div>

                <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.7 }}>
                  {action.reason ?? 'No written moderator rationale was attached to this record.'}
                </p>

                <div className="forums-chip-row">
                  <span style={chipStyle(false, 'neutral')}>
                    Moderator {action.moderatorId === 'local-user' ? 'Local account' : action.moderatorId}
                  </span>
                  {action.targetId ? <span style={chipStyle(false, 'neutral')}>Target {action.targetId.slice(0, 8)}</span> : null}
                </div>
              </SurfaceCard>
            ))
          )}
        </div>
      </div>
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

const ghostLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  padding: '0 14px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 700,
} as const;

const summaryRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.04)',
} as const;

const linkPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 700,
} as const;

function iconBadgeStyle(actionType: string) {
  const color = actionType === 'lock_thread' ? TOKENS.trustLight : TOKENS.primaryLight;
  return {
    width: 36,
    height: 36,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    background: `${color}20`,
  } as const;
}

export default function ModerationLogHubPage() {
  return (
    <Suspense fallback={null}>
      <ModerationLogHubPageContent />
    </Suspense>
  );
}
