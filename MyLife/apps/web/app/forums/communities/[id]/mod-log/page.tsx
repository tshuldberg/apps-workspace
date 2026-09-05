'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchCommunityById, fetchModLog } from '../../../actions';
import {
  EmptyState,
  GlassCard,
  MaterialSymbol,
  SectionIntro,
  SurfaceCard,
} from '../../../components';
import { TOKENS, chipStyle, formatRelativeTime, gradientButtonStyle } from '../../../ui';

interface CommunityRow {
  id: string;
  displayName: string;
  description: string | null;
}

interface ModActionRow {
  id: string;
  actionType: string;
  targetId: string | null;
  reason: string | null;
  createdAt: string;
  moderatorId: string;
}

export default function CommunityModLogPage() {
  const params = useParams<{ id: string }>();
  const [community, setCommunity] = useState<CommunityRow | null>(null);
  const [actions, setActions] = useState<ModActionRow[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [communityResult, logResult] = await Promise.all([
          fetchCommunityById(params.id),
          fetchModLog(params.id),
        ]);
        if (cancelled) return;
        setCommunity((communityResult as CommunityRow) ?? null);
        setActions(
          [...((logResult as ModActionRow[]) ?? [])].sort(
            (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
          ),
        );
      } catch {
        if (!cancelled) setError('Could not load this moderation log.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const actionTypes = useMemo(
    () => ['all', ...new Set(actions.map((action) => action.actionType))],
    [actions],
  );

  const filtered = useMemo(
    () => actions.filter((action) => filter === 'all' || action.actionType === filter),
    [actions, filter],
  );

  if (loading) {
    return <GlassCard style={{ minHeight: 420, animation: 'pulse 1.5s ease-in-out infinite' }} />;
  }

  if (error || !community) {
    return (
      <EmptyState
        icon="gavel"
        title="Moderation log unavailable"
        description={error ?? 'This community log could not be loaded.'}
        actionHref={`/forums/community/${params.id}`}
        actionLabel="Back to community"
      />
    );
  }

  return (
    <div className="forums-page-stack">
      <SectionIntro
        eyebrow="Moderation Log"
        title={`${community.displayName} action feed`}
        description="This public ledger keeps moderator interventions visible. Filters help separate structural changes from thread-level triage."
        actions={
          <>
            <Link href={`/forums/community/${community.id}`} style={ghostLinkStyle}>
              Community
            </Link>
            <Link href={`/forums/community-settings/${community.id}`} style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
              Settings
            </Link>
          </>
        }
      />

      <div className="forums-detail-grid" style={{ gridTemplateColumns: '280px minmax(0, 1fr)' }}>
        <GlassCard className="forums-sidebar-card" style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <span style={eyebrowStyle}>Filters</span>
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
            <span style={eyebrowStyle}>At a glance</span>
            <div style={summaryRowStyle}>
              <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>Logged actions</span>
              <strong>{actions.length}</strong>
            </div>
            <div style={summaryRowStyle}>
              <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>Visible filter</span>
              <strong>{filtered.length}</strong>
            </div>
          </div>
        </GlassCard>

        <div style={{ display: 'grid', gap: 14 }}>
          {filtered.length === 0 ? (
            <EmptyState
              icon="visibility"
              title="Nothing matches this filter"
              description="Switch filters or come back after the next moderator action lands in the cache."
              actionHref={`/forums/community/${community.id}`}
              actionLabel="Back to community"
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
                    <strong style={{ fontSize: 16, textTransform: 'capitalize' }}>
                      {action.actionType.replace(/_/g, ' ')}
                    </strong>
                  </div>
                  <span style={{ color: TOKENS.textTertiary, fontSize: 12 }}>{formatRelativeTime(action.createdAt)}</span>
                </div>
                <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.7 }}>
                  {action.reason ?? 'No written rationale was stored for this action.'}
                </p>
                <div className="forums-chip-row">
                  <span style={chipStyle(false, 'neutral')}>Moderator {action.moderatorId === 'local-user' ? 'Local account' : action.moderatorId}</span>
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
