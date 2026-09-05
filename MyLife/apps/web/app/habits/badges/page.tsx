'use client';

import { useEffect, useMemo, useState } from 'react';
import { BADGE_CATALOG } from '@mylife/habits';
import { fetchUnlockedBadgeKeys } from '../actions';
import {
  EmptyState,
  GlassPanel,
  PageIntro,
  PillButton,
  SectionHeading,
  SymbolIcon,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_STREAK, withAlpha } from '@mylife/habits';

type Filter = 'all' | 'streak' | 'completion' | 'special' | 'sobriety' | 'collection';

export default function HabitsBadgesPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [unlockedKeys, setUnlockedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const keys = await fetchUnlockedBadgeKeys();
        setUnlockedKeys(Array.from((keys as Set<string>) ?? []));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load badges.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filtered = useMemo(() => BADGE_CATALOG.filter((badge) => filter === 'all' || badge.category === filter), [filter]);
  const unlocked = filtered.filter((badge) => unlockedKeys.includes(badge.key));
  const locked = filtered.filter((badge) => !unlockedKeys.includes(badge.key));
  const selected = BADGE_CATALOG.find((badge) => badge.key === selectedKey) ?? null;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Badges"
        title="Achievements, milestone pressure, and what still needs unlocking."
        description="Browse every badge by category, keep earned awards separated from locked ones, and inspect any badge in detail without leaving the desktop shell."
      />

      <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 16 }}>
        <SectionHeading detail={`${unlockedKeys.length} earned of ${BADGE_CATALOG.length}`} title="Collection" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 48, fontWeight: 800, color: HB_ACCENT_LIGHT }}>{unlockedKeys.length}</div>
            <div style={{ color: '#E4E1E9', fontSize: 15, lineHeight: 1.7 }}>
              Keep streak, completion, sobriety, and special achievements visible so users can see the long arc of consistency, not just the current day.
            </div>
          </div>
          <div style={{ width: 110, height: 110, borderRadius: 36, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${withAlpha(HB_STREAK.fire, 0.22)} 0%, ${withAlpha(HB_ACCENT_LIGHT, 0.18)} 100%)` }}>
            <SymbolIcon color={HB_STREAK.fire} filled name="military_tech" size={40} />
          </div>
        </div>
      </GlassPanel>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['all', 'streak', 'completion', 'collection', 'sobriety', 'special'] as Filter[]).map((value) => (
          <PillButton active={filter === value} key={value} onClick={() => setFilter(value)}>
            {value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)}
          </PillButton>
        ))}
      </div>

      {error ? <EmptyState body={error} title="Badge gallery unavailable" /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1.1fr 0.9fr' : '1fr', gap: 20 }}>
        <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 20 }}>
          <SectionHeading detail={`${unlocked.length} earned, ${locked.length} locked`} title="Badge grid" />
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} style={{ height: 160, borderRadius: 24, background: withAlpha('#ffffff', 0.04) }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
              {filtered.map((badge) => {
                const unlockedBadge = unlockedKeys.includes(badge.key);
                return (
                  <button
                    key={badge.key}
                    onClick={() => setSelectedKey(badge.key)}
                    style={{
                      display: 'grid',
                      gap: 12,
                      padding: 18,
                      borderRadius: 24,
                      border: 'none',
                      background: unlockedBadge ? withAlpha(HB_ACCENT_LIGHT, 0.18) : withAlpha('#ffffff', 0.04),
                      color: 'white',
                      cursor: 'pointer',
                      opacity: unlockedBadge ? 1 : 0.52,
                    }}
                  >
                    <div style={{ fontSize: 34 }}>{unlockedBadge ? badge.emoji : '◻'}</div>
                    <div style={{ fontWeight: 700 }}>{badge.name}</div>
                    <div style={{ color: unlockedBadge ? '#E4E1E9' : '#9F8E81', fontSize: 12, lineHeight: 1.6 }}>{badge.description}</div>
                  </button>
                );
              })}
            </div>
          )}
        </GlassPanel>

        {selected ? (
          <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 16, alignSelf: 'start' }}>
            <SectionHeading detail={unlockedKeys.includes(selected.key) ? 'Earned' : 'Locked'} title="Badge detail" />
            <div style={{ fontSize: 56 }}>{unlockedKeys.includes(selected.key) ? selected.emoji : '◻'}</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{selected.name}</div>
            <div style={{ color: '#E4E1E9', lineHeight: 1.8 }}>{selected.description}</div>
            <div style={{ padding: 16, borderRadius: 20, background: withAlpha('#ffffff', 0.04), color: '#D6C3B5', lineHeight: 1.7 }}>
              Category: {selected.category} · Threshold: {selected.threshold}
            </div>
          </GlassPanel>
        ) : null}
      </div>
    </div>
  );
}
