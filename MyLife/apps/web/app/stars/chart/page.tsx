'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchProfiles } from '../actions';
import type { BirthProfile } from '@mylife/stars';
import { StarsChartWheel } from '../chart-wheel';
import { createBirthChartView } from '../view-models';
import {
  EmptyState,
  InlineBadge,
  STARS_ACCENT,
  STARS_ACCENT_LIGHT,
  STARS_GOLD,
  STARS_TEXT,
  STARS_TEXT_SECONDARY,
  SectionTitle,
  StarsSymbol,
  formatLongDate,
  ghostButtonStyle,
  panelStyle,
  secondaryButtonStyle,
  withAlpha,
} from '../ui';

type ChartTab = 'overview' | 'planets' | 'houses' | 'aspects';

const TAB_OPTIONS: Array<{ key: ChartTab; label: string; icon: string }> = [
  { key: 'overview', label: 'Overview', icon: 'auto_awesome' },
  { key: 'planets', label: 'Planets', icon: 'orbital' },
  { key: 'houses', label: 'Houses', icon: 'grid_view' },
  { key: 'aspects', label: 'Aspects', icon: 'flare' },
];

export default function StarsChartPage() {
  const [profiles, setProfiles] = useState<BirthProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ChartTab>('overview');
  const [showAspectLines, setShowAspectLines] = useState(true);
  const [selection, setSelection] = useState<{ title: string; subtitle?: string; body: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchProfiles()
      .then((items) => {
        if (!cancelled) {
          setProfiles(items);
          setSelectedId(items[0]?.id ?? '');
        }
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) {
          setError('Failed to load MyStars profiles');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProfile = profiles.find((profile) => profile.id === selectedId) ?? profiles[0] ?? null;
  const chart = useMemo(
    () => (selectedProfile ? createBirthChartView(selectedProfile) : null),
    [selectedProfile],
  );

  if (error) {
    return (
      <EmptyState
        title="Chart room unavailable"
        detail={error}
        action={
          <button type="button" onClick={() => location.reload()} style={ghostButtonStyle(true)}>
            <StarsSymbol name="refresh" size={18} color="#0E0E13" filled />
            Retry
          </button>
        }
      />
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ ...panelStyle({ minHeight: 180, glow: true }) }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1.08fr 0.92fr', gap: 18 }}>
          <div style={{ ...panelStyle({ minHeight: 560 }) }} />
          <div style={{ ...panelStyle({ minHeight: 560 }) }} />
        </div>
      </div>
    );
  }

  if (!selectedProfile || !chart) {
    return (
      <EmptyState
        title="Create your first birth profile"
        detail="MyStars uses your birth date, moon sign, and rising sign to assemble a private chart wheel, interpretation tabs, and saved chart context across the module."
        action={
          <Link href="/stars/profile" style={ghostButtonStyle(true)}>
            <StarsSymbol name="person_add" size={18} color="#0E0E13" filled />
            Add profile
          </Link>
        }
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="stars-card-glow" style={{ ...panelStyle({ padding: 28, tone: '#15151C', glow: true }), display: 'grid', gap: 18 }}>
        <SectionTitle
          eyebrow="Birth Chart Web"
          title={`${selectedProfile.name}'s chart observatory`}
          detail={`Built from ${formatLongDate(selectedProfile.birthDate)}${selectedProfile.birthPlace ? ` in ${selectedProfile.birthPlace}` : ''}. Hover or tap the wheel to inspect planets, houses, and sign emphasis.`}
          actions={
            <>
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
                  value={selectedProfile.id}
                  onChange={(event) => setSelectedId(event.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: STARS_TEXT,
                    fontSize: 13,
                    fontWeight: 700,
                    minWidth: 140,
                  }}
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => setShowAspectLines((value) => !value)} style={secondaryButtonStyle()}>
                <StarsSymbol name="flare" size={18} color={STARS_ACCENT_LIGHT} />
                {showAspectLines ? 'Hide aspects' : 'Show aspects'}
              </button>
            </>
          }
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <InlineBadge label={`Sun ${chart.core.sun.slice(0, 3).toUpperCase()}`} tone={withAlpha(STARS_GOLD, 0.18)} textColor={STARS_GOLD} />
          <InlineBadge label={`Moon ${chart.core.moon.slice(0, 3).toUpperCase()}`} tone={withAlpha(STARS_ACCENT, 0.18)} textColor={STARS_ACCENT_LIGHT} />
          <InlineBadge label={`Rising ${chart.core.rising.slice(0, 3).toUpperCase()}`} />
          <InlineBadge label={`Dominant blend ${chart.dominantBlend}`} icon="auto_awesome" />
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.08fr) minmax(340px, 0.92fr)', gap: 18 }}>
        <section style={{ ...panelStyle({ padding: 22, tone: '#15151B', glow: true }), display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Interactive wheel
              </span>
              <h2 style={{ margin: '4px 0 0', color: STARS_TEXT, fontSize: 30, letterSpacing: '-0.04em' }}>
                SVG chart wheel
              </h2>
            </div>
            <Link href={`/stars/profile/${selectedProfile.id}`} style={secondaryButtonStyle()}>
              <StarsSymbol name="chevron_right" size={18} color={STARS_ACCENT_LIGHT} />
              Open profile
            </Link>
          </div>

          <div style={{ ...panelStyle({ padding: 18, tone: '#101017' }), display: 'grid', placeItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: 620 }}>
              <StarsChartWheel
                chart={chart.chart}
                size={520}
                showAspectLines={showAspectLines}
                highlight={selection ? [selection.title.toLowerCase()] : undefined}
                onSelect={(type, value) => {
                  if (type === 'planet') {
                    const planet = chart.planets.find((entry) => entry.body === value);
                    if (planet) {
                      setSelection({
                        title: planet.label,
                        subtitle: `${planet.degreeLabel} · House ${planet.house ?? 1}`,
                        body: planet.interpretation,
                      });
                    }
                    return;
                  }
                  if (type === 'house') {
                    const house = chart.houses.find((entry) => entry.house === value);
                    if (house) {
                      setSelection({
                        title: `House ${house.house}`,
                        subtitle: `${house.rulingPlanet} rules ${house.sign}`,
                        body: house.interpretation,
                      });
                    }
                    return;
                  }
                  const sign = String(value);
                  setSelection({
                    title: sign,
                    subtitle: 'Zodiac tone',
                    body: `${sign.charAt(0).toUpperCase() + sign.slice(1)} energy feels ${signDescription(sign)} across this chart. Repeated appearances point to how the profile processes identity, instinct, and timing.`,
                  });
                }}
              />
            </div>
          </div>
        </section>

        <section style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 16, alignContent: 'start' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={tab.key === activeTab ? ghostButtonStyle(true) : secondaryButtonStyle()}
              >
                <StarsSymbol name={tab.icon} size={18} color={tab.key === activeTab ? '#0E0E13' : STARS_ACCENT_LIGHT} filled={tab.key === activeTab} />
                {tab.label}
              </button>
            ))}
          </div>

          {selection ? (
            <div style={{ ...panelStyle({ padding: 18, tone: '#121219', glow: true }), display: 'grid', gap: 8 }}>
              <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Selected detail
              </span>
              <strong style={{ fontSize: 22, color: STARS_TEXT }}>{selection.title}</strong>
              {selection.subtitle ? <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 13, fontWeight: 700 }}>{selection.subtitle}</span> : null}
              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>{selection.body}</p>
            </div>
          ) : null}

          {activeTab === 'overview' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                {Object.entries(chart.elementBalance).map(([element, count]) => (
                  <div key={element} style={{ ...panelStyle({ padding: 18, tone: '#121219' }), display: 'grid', gap: 6 }}>
                    <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                      {element}
                    </span>
                    <strong style={{ color: STARS_TEXT, fontSize: 26 }}>{count}</strong>
                  </div>
                ))}
              </div>
              <div style={{ ...panelStyle({ padding: 18, tone: '#121219' }), display: 'grid', gap: 10 }}>
                <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                  Dominant planets
                </span>
                {chart.dominantPlanets.map((planet) => (
                  <div key={planet.body} style={{ display: 'grid', gap: 4 }}>
                    <strong style={{ color: STARS_TEXT }}>{planet.body.toUpperCase()}</strong>
                    <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>{planet.reason}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {activeTab === 'planets' ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {chart.planets.map((planet) => (
                <button
                  key={planet.body}
                  type="button"
                  onClick={() =>
                    setSelection({
                      title: planet.label,
                      subtitle: `${planet.degreeLabel} · House ${planet.house ?? 1}`,
                      body: planet.interpretation,
                    })
                  }
                  style={{
                    ...panelStyle({ padding: 16, tone: '#121219' }),
                    display: 'grid',
                    gap: 5,
                    cursor: 'pointer',
                    border: 'none',
                    textAlign: 'left',
                  }}
                >
                  <strong style={{ color: STARS_TEXT, fontSize: 16 }}>
                    {planet.label} in {planet.sign.charAt(0).toUpperCase() + planet.sign.slice(1)}
                  </strong>
                  <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 12, fontWeight: 700 }}>
                    {planet.degreeLabel} · House {planet.house ?? 1}
                  </span>
                  <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                    {planet.interpretation}
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {activeTab === 'houses' ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {chart.houses.map((house) => (
                <button
                  key={house.house}
                  type="button"
                  onClick={() =>
                    setSelection({
                      title: `House ${house.house}`,
                      subtitle: `${house.sign} on the cusp`,
                      body: house.interpretation,
                    })
                  }
                  style={{
                    ...panelStyle({ padding: 16, tone: '#121219' }),
                    display: 'grid',
                    gap: 5,
                    cursor: 'pointer',
                    border: 'none',
                    textAlign: 'left',
                  }}
                >
                  <strong style={{ color: STARS_TEXT, fontSize: 16 }}>
                    House {house.house} · {house.sign.charAt(0).toUpperCase() + house.sign.slice(1)}
                  </strong>
                  <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 12, fontWeight: 700 }}>
                    Ruled by {house.rulingPlanet}
                  </span>
                  <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                    {house.interpretation}
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {activeTab === 'aspects' ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {chart.aspects.map((aspect) => (
                <button
                  key={`${aspect.fromBody}-${aspect.toBody}-${aspect.type}`}
                  type="button"
                  onClick={() =>
                    setSelection({
                      title: aspect.label,
                      subtitle: `Orb ${aspect.orb.toFixed(1)}°`,
                      body: aspect.interpretation,
                    })
                  }
                  style={{
                    ...panelStyle({ padding: 16, tone: '#121219' }),
                    display: 'grid',
                    gap: 5,
                    cursor: 'pointer',
                    border: 'none',
                    textAlign: 'left',
                  }}
                >
                  <strong style={{ color: STARS_TEXT, fontSize: 16 }}>{aspect.label}</strong>
                  <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 12, fontWeight: 700 }}>
                    Orb {aspect.orb.toFixed(1)}°
                  </span>
                  <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                    {aspect.interpretation}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function signDescription(sign: string) {
  const descriptions: Record<string, string> = {
    aries: 'bold and first-moving',
    taurus: 'grounded and steady',
    gemini: 'curious and connective',
    cancer: 'intuitive and protective',
    leo: 'radiant and expressive',
    virgo: 'precise and attentive',
    libra: 'relational and balancing',
    scorpio: 'deep and catalytic',
    sagittarius: 'expansive and adventurous',
    capricorn: 'structured and strategic',
    aquarius: 'inventive and future-facing',
    pisces: 'porous and imaginative',
  };
  return descriptions[sign] ?? 'distinctive';
}
