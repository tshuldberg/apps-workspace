'use client';

import { useEffect, useMemo, useState } from 'react';
import { doComputeCompatibility, fetchProfiles, fetchRecentCompatibility } from '../actions';
import type { BirthProfile } from '@mylife/stars';
import { StarsChartWheel } from '../chart-wheel';
import { createSynastryView } from '../view-models';
import {
  EmptyState,
  InlineBadge,
  STARS_ACCENT,
  STARS_ACCENT_LIGHT,
  STARS_BG,
  STARS_GOLD,
  STARS_TEXT,
  STARS_TEXT_SECONDARY,
  SectionTitle,
  StarsSymbol,
  ghostButtonStyle,
  panelStyle,
  secondaryButtonStyle,
  withAlpha,
} from '../ui';

interface ComparisonResult {
  overallScore: number;
  elementDescription: string;
  profileAName: string;
  profileBName: string;
  sign1: string;
  sign2: string;
}

interface RecentResult {
  id: string;
  profileAId: string;
  profileBId: string;
  overallScore: number;
  profileAName: string;
  profileBName: string;
}

export default function CompatibilityPage() {
  const [profiles, setProfiles] = useState<BirthProfile[]>([]);
  const [profileAId, setProfileAId] = useState('');
  const [profileBId, setProfileBId] = useState('');
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [recent, setRecent] = useState<RecentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [profileItems, recentItems] = await Promise.all([
          fetchProfiles(),
          fetchRecentCompatibility(10),
        ]);
        if (!cancelled) {
          setProfiles(profileItems);
          setProfileAId(profileItems[0]?.id ?? '');
          setProfileBId(profileItems[1]?.id ?? profileItems[0]?.id ?? '');
          setRecent(recentItems);
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError('Failed to load compatibility data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const profileA = profiles.find((profile) => profile.id === profileAId) ?? null;
  const profileB = profiles.find((profile) => profile.id === profileBId) ?? null;
  const synastry = useMemo(
    () => (profileA && profileB && profileA.id !== profileB.id ? createSynastryView(profileA, profileB) : null),
    [profileA, profileB],
  );

  async function handleCompare() {
    if (!profileAId || !profileBId || profileAId === profileBId) {
      setError('Choose two different profiles to compare.');
      return;
    }
    setComputing(true);
    setError(null);
    try {
      const comparison = await doComputeCompatibility(profileAId, profileBId);
      if (!comparison) {
        setError('Both profiles need sun signs for compatibility.');
      } else {
        setResult(comparison as ComparisonResult);
      }
      setRecent(await fetchRecentCompatibility(10));
    } catch (comparisonError) {
      console.error(comparisonError);
      setError('Failed to compute compatibility');
    } finally {
      setComputing(false);
    }
  }

  if (error && loading) {
    return (
      <EmptyState
        title="Compatibility chamber unavailable"
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

  if (profiles.length < 2) {
    return (
      <EmptyState
        title="Add at least two birth profiles"
        detail="Compatibility becomes meaningful when MyStars can compare two charts side by side. Create another profile, then return to the synastry chamber."
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="stars-card-glow" style={{ ...panelStyle({ padding: 28, tone: '#15151B', glow: true }), display: 'grid', gap: 18 }}>
        <SectionTitle
          eyebrow="Compatibility Web"
          title="Synastry chamber"
          detail="Pair two profiles, compare their chart overlays, and archive the result in the local compatibility history."
          actions={
            <button type="button" onClick={() => void handleCompare()} disabled={computing} style={ghostButtonStyle(true)}>
              <StarsSymbol name="favorite" size={18} color={STARS_BG} filled />
              {computing ? 'Comparing...' : 'Compare charts'}
            </button>
          }
        />
        {error ? <p style={{ margin: 0, color: '#FFB4AB', fontSize: 13 }}>{error}</p> : null}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.36fr) minmax(0, 0.64fr)', gap: 18 }}>
        <aside style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 16, alignContent: 'start' }}>
          <ProfilePicker label="Profile A" value={profileAId} onChange={setProfileAId} profiles={profiles} />
          <ProfilePicker label="Profile B" value={profileBId} onChange={setProfileBId} profiles={profiles} />

          {result ? (
            <div style={{ ...panelStyle({ padding: 20, tone: '#111117', glow: true }), display: 'grid', gap: 12 }}>
              <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Latest score
              </span>
              <strong style={{ color: STARS_TEXT, fontSize: 54, lineHeight: 1 }}>{result.overallScore}%</strong>
              <div style={{ height: 10, borderRadius: 999, background: withAlpha('#FFFFFF', 0.06) }}>
                <div
                  style={{
                    width: `${result.overallScore}%`,
                    height: 10,
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${STARS_ACCENT_LIGHT}, ${STARS_GOLD})`,
                  }}
                />
              </div>
              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>
                {result.elementDescription}
              </p>
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Recent comparisons
            </span>
            {recent.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setProfileAId(item.profileAId);
                  setProfileBId(item.profileBId);
                }}
                style={{
                  ...panelStyle({ padding: 16, tone: '#111117' }),
                  border: 'none',
                  cursor: 'pointer',
                  display: 'grid',
                  gap: 4,
                  textAlign: 'left',
                }}
              >
                <strong style={{ color: STARS_TEXT, fontSize: 15 }}>
                  {item.profileAName} + {item.profileBName}
                </strong>
                <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12 }}>{item.overallScore}% overall score</span>
              </button>
            ))}
          </div>
        </aside>

        <section style={{ ...panelStyle({ padding: 22, tone: '#15151B', glow: true }), display: 'grid', gap: 18 }}>
          {!synastry ? (
            <EmptyState title="Pick two different profiles" detail="The synastry wheel activates once two distinct charts are selected." />
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {synastry.categories.map((category) => (
                  <InlineBadge key={category.label} label={`${category.label} ${category.score}%`} tone={withAlpha(category.tone, 0.16)} textColor={category.tone} />
                ))}
              </div>

              <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', placeItems: 'center' }}>
                <div style={{ width: '100%', maxWidth: 620 }}>
                  <StarsChartWheel chart={synastry.chart} size={540} showAspectLines />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 8 }}>
                  <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                    Overall theme
                  </span>
                  <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>{synastry.overallTheme}</p>
                </div>
                <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 8 }}>
                  <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                    Strengths
                  </span>
                  <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>{synastry.strengths}</p>
                </div>
                <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 8 }}>
                  <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                    Challenges
                  </span>
                  <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>{synastry.challenges}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                  Highlighted aspects
                </span>
                {synastry.highlights.map((aspect) => (
                  <div key={`${aspect.fromBody}-${aspect.toBody}-${aspect.type}`} style={{ ...panelStyle({ padding: 16, tone: '#111117' }), display: 'grid', gap: 4 }}>
                    <strong style={{ color: STARS_TEXT, fontSize: 15 }}>{aspect.label}</strong>
                    <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 12, fontWeight: 700 }}>Orb {aspect.orb.toFixed(1)}°</span>
                    <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>{aspect.interpretation}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ProfilePicker({
  label,
  value,
  onChange,
  profiles,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  profiles: BirthProfile[];
}) {
  return (
    <label style={{ display: 'grid', gap: 6, color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 700 }}>
      {label}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 18,
          background: withAlpha('#1B1B20', 0.96),
          boxShadow: `inset 0 0 0 1.5px ${withAlpha(STARS_ACCENT_LIGHT, 0.08)}`,
        }}
      >
        <StarsSymbol name="group" size={18} color={STARS_ACCENT_LIGHT} />
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: STARS_TEXT,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
