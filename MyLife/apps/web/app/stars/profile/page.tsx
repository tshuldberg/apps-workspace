'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  doCreateProfile,
  doDeleteProfile,
  fetchProfiles,
  fetchProgressedChartAction,
  fetchSolarReturn,
} from '../actions';
import { getZodiacSign, type BirthProfile, type CreateBirthProfileInput, type ProgressedChartResult, type SolarReturnResult } from '@mylife/stars';
import {
  EmptyState,
  InlineBadge,
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
import { createProgressionSummary, createSolarReturnSummary } from '../view-models';

const ZODIAC_SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'] as const;

function ProfilesPageContent() {
  const params = useSearchParams();
  const focusPanel = params.get('panel');
  const [profiles, setProfiles] = useState<BirthProfile[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [solarReturn, setSolarReturn] = useState<SolarReturnResult | null>(null);
  const [progressed, setProgressed] = useState<ProgressedChartResult | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadProfiles();
  }, []);

  useEffect(() => {
    const profile = profiles.find((item) => item.id === selectedId) ?? profiles[0] ?? null;
    if (!profile) {
      setSolarReturn(null);
      setProgressed(null);
      return;
    }
    let cancelled = false;
    async function loadDetails() {
      try {
        const currentYear = new Date().getFullYear();
        const [solar, progression] = await Promise.all([
          fetchSolarReturn(profile.id, currentYear),
          fetchProgressedChartAction(profile.id),
        ]);
        if (!cancelled) {
          setSolarReturn(solar);
          setProgressed(progression);
        }
      } catch (detailError) {
        console.error(detailError);
      }
    }
    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [profiles, selectedId]);

  async function loadProfiles() {
    setLoading(true);
    try {
      const items = await fetchProfiles();
      setProfiles(items);
      setSelectedId(items[0]?.id ?? '');
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load birth profiles');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await doDeleteProfile(id);
      const next = profiles.filter((profile) => profile.id !== id);
      setProfiles(next);
      setSelectedId(next[0]?.id ?? '');
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete profile');
    }
  }

  const selectedProfile = profiles.find((profile) => profile.id === selectedId) ?? profiles[0] ?? null;
  const solarSummary = solarReturn ? createSolarReturnSummary(solarReturn, null) : null;
  const progressionSummary = progressed ? createProgressionSummary(progressed) : null;

  if (error && loading) {
    return (
      <EmptyState
        title="Profile library unavailable"
        detail={error}
        action={
          <button type="button" onClick={() => location.reload()} style={ghostButtonStyle(true)}>
            <StarsSymbol name="refresh" size={18} color={STARS_BG} filled />
            Reload library
          </button>
        }
      />
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ ...panelStyle({ minHeight: 180, glow: true }) }} />
        <div style={{ ...panelStyle({ minHeight: 620 }) }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="stars-card-glow" style={{ ...panelStyle({ padding: 28, tone: '#15151B', glow: true }), display: 'grid', gap: 18 }}>
        <SectionTitle
          eyebrow="Profiles"
          title="Birth data, solar return, and progressions"
          detail="Manage the local profile library, pick a chart to spotlight, and use the same surface for solar return and progression summaries."
          actions={
            <button type="button" onClick={() => setShowForm((value) => !value)} style={ghostButtonStyle(true)}>
              <StarsSymbol name={showForm ? 'close' : 'person_add'} size={18} color={STARS_BG} filled />
              {showForm ? 'Close form' : 'Add profile'}
            </button>
          }
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <InlineBadge label={`${profiles.length} profile${profiles.length === 1 ? '' : 's'}`} icon="group" />
          <InlineBadge label={`Focus ${focusPanel ?? 'library'}`} tone={withAlpha(STARS_GOLD, 0.16)} textColor={STARS_GOLD} />
        </div>
      </section>

      {showForm ? (
        <AddProfileForm
          onCreated={(profile) => {
            setProfiles((current) => [profile, ...current]);
            setSelectedId(profile.id);
            setShowForm(false);
          }}
        />
      ) : null}

      {!selectedProfile ? (
        <EmptyState
          title="Add your first profile"
          detail="A saved profile unlocks personalized readings, compatibility, retrograde impact, and richer moon timing across the web shell."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.36fr) minmax(0, 0.64fr)', gap: 18 }}>
          <aside style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 12, alignContent: 'start' }}>
            {profiles.map((profile) => (
              <div
                key={profile.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(profile.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedId(profile.id);
                  }
                }}
                style={{
                  ...panelStyle({ padding: 18, tone: profile.id === selectedProfile.id ? '#1C1B25' : '#111117', glow: profile.id === selectedProfile.id }),
                  cursor: 'pointer',
                  display: 'grid',
                  gap: 8,
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <strong style={{ color: STARS_TEXT, fontSize: 18 }}>{profile.name}</strong>
                  <InlineBadge label={profile.id === selectedProfile.id ? 'Selected' : 'Tap to focus'} tone={withAlpha(STARS_ACCENT_LIGHT, 0.16)} textColor={STARS_ACCENT_LIGHT} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <InlineBadge label={`Sun ${shortSign(profile.sunSign)}`} />
                  <InlineBadge label={`Moon ${shortSign(profile.moonSign)}`} tone={withAlpha(STARS_ACCENT_LIGHT, 0.16)} textColor={STARS_ACCENT_LIGHT} />
                  <InlineBadge label={`Rising ${shortSign(profile.risingSign)}`} tone={withAlpha(STARS_GOLD, 0.16)} textColor={STARS_GOLD} />
                </div>
                <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12 }}>
                  {profile.birthDate}{profile.birthPlace ? ` · ${profile.birthPlace}` : ''}
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Link href={`/stars/profile/${profile.id}`} style={{ color: STARS_ACCENT_LIGHT, fontSize: 13, fontWeight: 700 }}>
                    Open detail route
                  </Link>
                  <button type="button" onClick={(event) => { event.stopPropagation(); void handleDelete(profile.id); }} style={secondaryButtonStyle()}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </aside>

          <section style={{ ...panelStyle({ padding: 22, tone: '#15151B', glow: true }), display: 'grid', gap: 18 }}>
            <div style={{ ...panelStyle({ padding: 20, tone: '#111117' }), display: 'grid', gap: 10 }}>
              <strong style={{ color: STARS_TEXT, fontSize: 30, letterSpacing: '-0.05em' }}>{selectedProfile.name}</strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <InlineBadge label={`Sun ${shortSign(selectedProfile.sunSign)}`} />
                <InlineBadge label={`Moon ${shortSign(selectedProfile.moonSign)}`} tone={withAlpha(STARS_ACCENT_LIGHT, 0.16)} textColor={STARS_ACCENT_LIGHT} />
                <InlineBadge label={`Rising ${shortSign(selectedProfile.risingSign)}`} tone={withAlpha(STARS_GOLD, 0.16)} textColor={STARS_GOLD} />
              </div>
              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>
                {selectedProfile.birthDate}{selectedProfile.birthTime ? ` at ${selectedProfile.birthTime}` : ''}{selectedProfile.birthPlace ? ` · ${selectedProfile.birthPlace}` : ''}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <section id="solar-return" style={{ ...panelStyle({ padding: 18, tone: focusPanel === 'solar-return' ? '#1C1B25' : '#111117', glow: focusPanel === 'solar-return' }), display: 'grid', gap: 8 }}>
                <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                  Solar return
                </span>
                {solarSummary ? (
                  <>
                    <strong style={{ color: STARS_TEXT, fontSize: 20 }}>{solarSummary.title}</strong>
                    <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                      {solarSummary.returnMoment}
                    </p>
                    <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                      {solarSummary.comparisonCopy}
                    </p>
                  </>
                ) : (
                  <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                    Solar return will appear after the profile is loaded into the chart cache.
                  </p>
                )}
              </section>

              <section id="progressions" style={{ ...panelStyle({ padding: 18, tone: focusPanel === 'progressions' ? '#1C1B25' : '#111117', glow: focusPanel === 'progressions' }), display: 'grid', gap: 8 }}>
                <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                  Progressions
                </span>
                {progressionSummary ? (
                  <>
                    <strong style={{ color: STARS_TEXT, fontSize: 20 }}>{progressionSummary.progressedMoon}</strong>
                    <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                      {progressionSummary.progressedSun}
                    </p>
                    <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                      {progressionSummary.nextThreshold}
                    </p>
                  </>
                ) : (
                  <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                    Progression summaries become available once the progression engine resolves the current chart.
                  </p>
                )}
              </section>
            </div>

            <section style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 10 }}>
              <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Library guidance
              </span>
              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>
                Use this surface as the home for friends and alternate profiles. The profile list is also the entry point for compatibility pairings, solar-return snapshots, and progression summaries through the secondary nav links.
              </p>
            </section>
          </section>
        </div>
      )}
    </div>
  );
}

function shortSign(value: string | null | undefined) {
  return value ? value.slice(0, 3).toUpperCase() : 'TBD';
}

function AddProfileForm({
  onCreated,
}: {
  onCreated: (profile: BirthProfile) => void;
}) {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [sunSign, setSunSign] = useState('');
  const [moonSign, setMoonSign] = useState('');
  const [risingSign, setRisingSign] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim() || !birthDate) {
      setError('Name and birth date are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const profile = await doCreateProfile({
        name: name.trim(),
        birthDate,
        birthTime: birthTime || null,
        birthPlace: birthPlace || null,
        sunSign: (sunSign || getZodiacSign(birthDate)) as CreateBirthProfileInput['sunSign'],
        moonSign: (moonSign || null) as CreateBirthProfileInput['moonSign'],
        risingSign: (risingSign || null) as CreateBirthProfileInput['risingSign'],
      });
      onCreated(profile);
    } catch (submitError) {
      console.error(submitError);
      setError('Failed to create profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ ...panelStyle({ padding: 22, tone: '#15151B', glow: true }), display: 'grid', gap: 12 }}>
      <strong style={{ color: STARS_TEXT, fontSize: 24, letterSpacing: '-0.04em' }}>New birth profile</strong>
      {error ? <p style={{ margin: 0, color: '#FFB4AB', fontSize: 13 }}>{error}</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <label style={fieldLabelStyle}>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} style={fieldStyle} />
        </label>
        <label style={fieldLabelStyle}>
          Birth date
          <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} style={fieldStyle} />
        </label>
        <label style={fieldLabelStyle}>
          Birth time
          <input type="time" value={birthTime} onChange={(event) => setBirthTime(event.target.value)} style={fieldStyle} />
        </label>
        <label style={fieldLabelStyle}>
          Birth place
          <input value={birthPlace} onChange={(event) => setBirthPlace(event.target.value)} style={fieldStyle} />
        </label>
        <label style={fieldLabelStyle}>
          Sun sign
          <select value={sunSign} onChange={(event) => setSunSign(event.target.value)} style={fieldStyle}>
            <option value="">Auto</option>
            {ZODIAC_SIGNS.map((sign) => (
              <option key={sign} value={sign}>
                {sign}
              </option>
            ))}
          </select>
        </label>
        <label style={fieldLabelStyle}>
          Moon sign
          <select value={moonSign} onChange={(event) => setMoonSign(event.target.value)} style={fieldStyle}>
            <option value="">Unknown</option>
            {ZODIAC_SIGNS.map((sign) => (
              <option key={sign} value={sign}>
                {sign}
              </option>
            ))}
          </select>
        </label>
        <label style={fieldLabelStyle}>
          Rising sign
          <select value={risingSign} onChange={(event) => setRisingSign(event.target.value)} style={fieldStyle}>
            <option value="">Unknown</option>
            {ZODIAC_SIGNS.map((sign) => (
              <option key={sign} value={sign}>
                {sign}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <button type="button" onClick={() => void handleSubmit()} disabled={saving} style={ghostButtonStyle(true)}>
          <StarsSymbol name="check" size={18} color={STARS_BG} filled />
          {saving ? 'Saving...' : 'Create profile'}
        </button>
      </div>
    </section>
  );
}

const fieldLabelStyle = {
  display: 'grid',
  gap: 6,
  color: STARS_TEXT_SECONDARY,
  fontSize: 12,
  fontWeight: 700,
};

const fieldStyle = {
  border: 'none',
  outline: 'none',
  borderRadius: 16,
  padding: '12px 14px',
  background: withAlpha('#1B1B20', 0.96),
  boxShadow: `inset 0 0 0 1.5px ${withAlpha(STARS_ACCENT_LIGHT, 0.08)}`,
  color: STARS_TEXT,
  fontSize: 14,
};

export default function ProfilesPage() {
  return (
    <Suspense fallback={null}>
      <ProfilesPageContent />
    </Suspense>
  );
}
