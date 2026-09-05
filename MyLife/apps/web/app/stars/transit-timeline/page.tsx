'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchProfiles, fetchTransitEvents } from '../actions';
import { filterBySignificance, type BirthProfile, type TransitEvent, type TransitSignificance } from '@mylife/stars';
import { StarsChartWheel } from '../chart-wheel';
import { createTransitFocusChart, transitSummary } from '../view-models';
import {
  EmptyState,
  InlineBadge,
  STARS_ACCENT_LIGHT,
  STARS_BG,
  STARS_TEXT,
  STARS_TEXT_SECONDARY,
  SectionTitle,
  StarsSymbol,
  formatLongDate,
  formatShortDate,
  ghostButtonStyle,
  panelStyle,
  secondaryButtonStyle,
  withAlpha,
} from '../ui';

const FILTERS: Array<{ label: string; value: TransitSignificance | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Major', value: 'major' },
  { label: 'Minor', value: 'minor' },
];

export default function TransitTimelinePage() {
  const [profiles, setProfiles] = useState<BirthProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [transits, setTransits] = useState<TransitEvent[]>([]);
  const [filter, setFilter] = useState<TransitSignificance | 'all'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfiles() {
      try {
        const profileItems = await fetchProfiles();
        if (!cancelled) {
          setProfiles(profileItems);
          setSelectedProfileId(profileItems[0]?.id ?? '');
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError('Failed to load transit profiles');
        }
      }
    }
    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadTransits() {
      if (!selectedProfileId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const start = new Date().toISOString().slice(0, 10);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 45);
        const eventItems = await fetchTransitEvents(selectedProfileId, start, endDate.toISOString().slice(0, 10));
        if (!cancelled) {
          setTransits(eventItems);
          setSelectedIndex(0);
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError('Failed to load transit events');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadTransits();
    return () => {
      cancelled = true;
    };
  }, [selectedProfileId]);

  const filtered = useMemo(
    () => (filter === 'all' ? transits : filterBySignificance(transits, filter)),
    [filter, transits],
  );
  const selectedTransit = filtered[selectedIndex] ?? filtered[0] ?? null;
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const focusChart = useMemo(
    () => (selectedProfile && selectedTransit ? createTransitFocusChart(selectedProfile, selectedTransit) : null),
    [selectedProfile, selectedTransit],
  );

  if (error && loading) {
    return (
      <EmptyState
        title="Transit timeline unavailable"
        detail={error}
        action={
          <button type="button" onClick={() => location.reload()} style={ghostButtonStyle(true)}>
            <StarsSymbol name="refresh" size={18} color={STARS_BG} filled />
            Reload
          </button>
        }
      />
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ ...panelStyle({ minHeight: 200, glow: true }) }} />
        <div style={{ ...panelStyle({ minHeight: 620 }) }} />
      </div>
    );
  }

  if (!selectedProfile) {
    return (
      <EmptyState
        title="Add a profile for transit timing"
        detail="Transit scoring needs a saved profile before MyStars can estimate which natal placements are being activated."
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="stars-card-glow" style={{ ...panelStyle({ padding: 28, tone: '#15151B', glow: true }), display: 'grid', gap: 18 }}>
        <SectionTitle
          eyebrow="Transit Timeline"
          title={`${selectedProfile.name}'s next 45 days`}
          detail="Use the scrubber to move between transits, then inspect the active transit-to-natal connection on the wheel and in the expanded list below."
          actions={
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 14px',
                borderRadius: 999,
                background: withAlpha('#35343A', 0.9),
                boxShadow: `inset 0 0 0 1.5px ${withAlpha(STARS_ACCENT_LIGHT, 0.08)}`,
              }}
            >
              <StarsSymbol name="group" size={18} color={STARS_ACCENT_LIGHT} />
              <select
                value={selectedProfileId}
                onChange={(event) => setSelectedProfileId(event.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: STARS_TEXT,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
          }
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((item) => (
            <button key={item.value} type="button" onClick={() => setFilter(item.value)} style={filter === item.value ? ghostButtonStyle(true) : secondaryButtonStyle()}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {filtered.length === 0 || !selectedTransit || !focusChart ? (
        <EmptyState
          title="No transits in this filter window"
          detail="Try the other significance filters or revisit the timeline after the next caching cycle."
        />
      ) : (
        <>
          <section style={{ ...panelStyle({ padding: 24, tone: '#15151B', glow: true }), display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                    Scrubber focus
                  </span>
                  <h2 style={{ margin: '4px 0 0', color: STARS_TEXT, fontSize: 30, letterSpacing: '-0.04em' }}>
                    {transitSummary(selectedTransit)}
                  </h2>
                </div>
                <InlineBadge label={`Orb ${selectedTransit.currentOrb.toFixed(1)}°`} tone={withAlpha(STARS_ACCENT_LIGHT, 0.16)} textColor={STARS_ACCENT_LIGHT} />
              </div>

              <input
                type="range"
                min={0}
                max={Math.max(filtered.length - 1, 0)}
                value={selectedIndex}
                onChange={(event) => setSelectedIndex(Number(event.target.value))}
                style={{ width: '100%', accentColor: STARS_ACCENT_LIGHT }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.02fr) minmax(320px, 0.98fr)', gap: 18 }}>
              <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', placeItems: 'center' }}>
                <div style={{ width: '100%', maxWidth: 620 }}>
                  <StarsChartWheel chart={focusChart} size={520} />
                </div>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 8 }}>
                  <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                    Transit detail
                  </span>
                  <strong style={{ color: STARS_TEXT, fontSize: 24, letterSpacing: '-0.04em' }}>
                    {selectedTransit.transitingBody} {selectedTransit.aspectType} {selectedTransit.natalBody}
                  </strong>
                  <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 12, fontWeight: 700 }}>
                    {formatLongDate(selectedTransit.exactDate)} · {selectedTransit.significance} transit
                  </span>
                  <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>
                    {selectedTransit.interpretationBrief}
                  </p>
                </div>
                <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 8 }}>
                  <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                    Timing note
                  </span>
                  <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>
                    {selectedTransit.isApplying
                      ? 'The aspect is still tightening, so the pattern is intensifying as you approach exactitude.'
                      : 'The aspect is separating, which means you are integrating what just peaked rather than entering it cold.'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 12 }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Timeline list
            </span>
            {filtered.map((transit, index) => (
              <button
                key={transit.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                style={{
                  ...panelStyle({ padding: 16, tone: index === selectedIndex ? '#1C1B25' : '#111117', glow: index === selectedIndex }),
                  border: 'none',
                  cursor: 'pointer',
                  display: 'grid',
                  gap: 4,
                  textAlign: 'left',
                }}
              >
                <strong style={{ color: STARS_TEXT, fontSize: 15 }}>
                  {transit.transitingBody} {transit.aspectType} {transit.natalBody}
                </strong>
                <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12 }}>
                  {formatShortDate(transit.exactDate)} · {transit.significance} · orb {transit.currentOrb.toFixed(1)}°
                </span>
                <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                  {transit.interpretationBrief}
                </p>
              </button>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
