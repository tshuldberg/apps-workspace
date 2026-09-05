'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import {
  BADGE_CATEGORY_COLORS,
  PresenceCard,
  PresenceEmptyState,
  PresenceMetricCard,
  PresenceSectionHeading,
  MaterialSymbol,
  TOKENS,
  modalBackdropStyle,
  modalCardStyle,
} from '../ui';
import { fetchPresenceBadgeSnapshot } from '../actions';

interface BadgePageData {
  earnedCount: number;
  totalCount: number;
  level: number;
  totalXP: number;
  nextBadge: {
    id: string;
    name: string;
    description: string;
    icon: string;
    target: number;
    unit: string;
    currentValue: number;
    progress: number;
    earned: boolean;
  } | null;
  categories: Array<{
    category: string;
    badges: Array<{
      id: string;
      name: string;
      description: string;
      icon: string;
      target: number;
      unit: string;
      currentValue: number;
      progress: number;
      earned: boolean;
    }>;
  }>;
}

export default function BadgesPage() {
  const [data, setData] = useState<BadgePageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function loadData() {
    try {
      setError(null);
      setData((await fetchPresenceBadgeSnapshot()) as BadgePageData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load badges.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const selectedBadge = data?.categories.flatMap((category) => category.badges).find((badge) => badge.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="pr-card-stack">
        <PresenceCard style={{ minHeight: 180 }} />
        <PresenceCard style={{ minHeight: 260 }} />
      </div>
    );
  }

  if (error || data == null) {
    return (
      <PresenceEmptyState
        icon="warning"
        title="Badges unavailable"
        body={error ?? 'We could not load your badge progress.'}
      />
    );
  }

  return (
    <div className="pr-main-stack">
      <PresenceCard
        style={{
          background: 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(255,184,119,0.08), rgba(255,255,255,0.03))',
        }}
      >
        <PresenceSectionHeading
          title="Achievement Gallery"
          subtitle="Grouped into five sections so you can see exactly which behavior loops are compounding and which ones still need reps."
        />
        <div className="pr-grid-4" style={{ marginTop: 20 }}>
          <PresenceMetricCard label="Earned" value={`${data.earnedCount}`} tone={TOKENS.accentLight} detail={`of ${data.totalCount} badges`} />
          <PresenceMetricCard label="Level" value={`${data.level}`} tone={TOKENS.warning} detail="current Presence level" />
          <PresenceMetricCard label="XP" value={`${data.totalXP}`} tone={TOKENS.info} detail="total XP earned" />
          <PresenceMetricCard
            label="Next Unlock"
            value={data.nextBadge ? `${Math.round(data.nextBadge.progress * 100)}%` : 'Done'}
            tone={TOKENS.success}
            detail={data.nextBadge?.name ?? 'All visible badges earned'}
          />
        </div>

        {data.nextBadge ? (
          <div style={{ marginTop: 20, padding: 20, borderRadius: 24, border: `1.5px solid ${TOKENS.borderStrong}`, background: 'rgba(34,211,238,0.08)', display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ color: TOKENS.accentLight, fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Upcoming</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{data.nextBadge.name}</div>
              </div>
              <div style={{ color: TOKENS.textSecondary, fontSize: 14 }}>
                {data.nextBadge.currentValue} / {data.nextBadge.target} {data.nextBadge.unit}
              </div>
            </div>
            <div style={trackStyle}>
              <div style={{ ...fillStyle, width: `${Math.max(8, data.nextBadge.progress * 100)}%` }} />
            </div>
          </div>
        ) : null}
      </PresenceCard>

      {data.categories.map((category) => {
        const earnedCount = category.badges.filter((badge) => badge.earned).length;
        return (
          <PresenceCard key={category.category}>
            <PresenceSectionHeading
              title={category.category}
              subtitle={`${earnedCount} earned · ${category.badges.length - earnedCount} locked`}
            />
            <div className="pr-badge-grid" style={{ marginTop: 18 }}>
              {category.badges.map((badge) => (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => setSelectedId(badge.id)}
                  style={{
                    padding: 18,
                    borderRadius: 24,
                    border: `1.5px solid ${badge.earned ? BADGE_CATEGORY_COLORS[category.category] ?? TOKENS.borderStrong : TOKENS.border}`,
                    background: badge.earned ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'grid',
                    gap: 12,
                    boxShadow: badge.earned ? '0 18px 34px rgba(8,145,178,0.12)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        display: 'grid',
                        placeItems: 'center',
                        background: badge.earned ? 'rgba(34,211,238,0.16)' : 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <MaterialSymbol name={badge.icon} size={20} color={badge.earned ? TOKENS.accentLight : TOKENS.textTertiary} filled={badge.earned} />
                    </div>
                    <span style={{ color: badge.earned ? TOKENS.success : TOKENS.textTertiary, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                      {badge.earned ? 'Earned' : 'Locked'}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{badge.name}</div>
                    <div style={{ color: TOKENS.textSecondary, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
                      {badge.description}
                    </div>
                  </div>
                  <div style={trackStyle}>
                    <div
                      style={{
                        ...fillStyle,
                        width: `${Math.max(8, badge.progress * 100)}%`,
                        background: badge.earned
                          ? `linear-gradient(90deg, ${BADGE_CATEGORY_COLORS[category.category] ?? TOKENS.accentLight}, ${TOKENS.accentLight})`
                          : 'linear-gradient(90deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))',
                      }}
                    />
                  </div>
                  <div style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
                    {badge.currentValue} / {badge.target} {badge.unit}
                  </div>
                </button>
              ))}
            </div>
          </PresenceCard>
        );
      })}

      {selectedBadge ? (
        <div style={modalBackdropStyle} onClick={() => setSelectedId(null)}>
          <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
            <PresenceSectionHeading title={selectedBadge.name} subtitle={selectedBadge.earned ? 'Earned in your current local history' : 'Progress toward unlock'} />
            <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 24,
                    display: 'grid',
                    placeItems: 'center',
                    background: selectedBadge.earned ? 'rgba(34,211,238,0.16)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  <MaterialSymbol name={selectedBadge.icon} size={34} color={selectedBadge.earned ? TOKENS.accentLight : TOKENS.textTertiary} filled={selectedBadge.earned} />
                </div>
              </div>
              <p style={{ margin: 0, color: TOKENS.textSecondary, fontSize: 15, lineHeight: 1.8 }}>
                {selectedBadge.description}
              </p>
              <div style={trackStyle}>
                <div style={{ ...fillStyle, width: `${Math.max(8, selectedBadge.progress * 100)}%` }} />
              </div>
              <div style={{ color: TOKENS.textSecondary, fontSize: 14 }}>
                {selectedBadge.currentValue} / {selectedBadge.target} {selectedBadge.unit}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const trackStyle: CSSProperties = {
  width: '100%',
  height: 10,
  borderRadius: 999,
  overflow: 'hidden',
  background: 'rgba(255,255,255,0.08)',
};

const fillStyle: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, #22D3EE, #0891B2)',
};
