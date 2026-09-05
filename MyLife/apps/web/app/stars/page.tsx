'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchDailyReading,
  fetchProfiles,
  fetchStats,
  fetchTransitEvents,
  fetchZodiacEventsAction,
} from './actions';
import {
  computeRetrogradeBanner,
  computeRetrogradeStatuses,
  getJournalPrompts,
  getMoonPhase,
  getMoonSign,
  getTarotCardOfDay,
  getZodiacSign,
  type BirthProfile,
  type DailyReading,
  type StarsStats,
  type TransitEvent,
  type ZodiacEvent,
} from '@mylife/stars';
import {
  EmptyState,
  InlineBadge,
  MetricCard,
  STARS_ACCENT,
  STARS_ACCENT_LIGHT,
  STARS_BG,
  STARS_DANGER,
  STARS_GOLD,
  STARS_TEXT,
  STARS_TEXT_SECONDARY,
  STARS_TEXT_TERTIARY,
  SectionTitle,
  StarsSymbol,
  formatLongDate,
  formatShortDate,
  ghostButtonStyle,
  panelStyle,
  secondaryButtonStyle,
  withAlpha,
} from './ui';
import { resolveDailyTarotCard } from './view-models';

export default function StarsPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [profiles, setProfiles] = useState<BirthProfile[]>([]);
  const [stats, setStats] = useState<StarsStats | null>(null);
  const [events, setEvents] = useState<ZodiacEvent[]>([]);
  const [transits, setTransits] = useState<TransitEvent[]>([]);
  const [reading, setReading] = useState<DailyReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 21);
        const [profileItems, statsItem, eventItems] = await Promise.all([
          fetchProfiles(),
          fetchStats(),
          fetchZodiacEventsAction(today, endDate.toISOString().slice(0, 10)),
        ]);

        const primaryProfile = profileItems[0] ?? null;
        const [dailyReading, transitItems] = primaryProfile
          ? await Promise.all([
              fetchDailyReading(primaryProfile.id, today),
              fetchTransitEvents(primaryProfile.id, today, endDate.toISOString().slice(0, 10)),
            ])
          : [null, []];

        if (!cancelled) {
          setProfiles(profileItems);
          setStats(statsItem);
          setEvents(eventItems);
          setReading(dailyReading);
          setTransits(transitItems);
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError('Failed to load MyStars dashboard');
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
  }, [today]);

  const primaryProfile = profiles[0] ?? null;
  const moonPhase = useMemo(() => getMoonPhase(today), [today]);
  const moonSign = useMemo(() => getMoonSign(today), [today]);
  const sunSign = useMemo(() => getZodiacSign(today), [today]);
  const tarotCard = useMemo(() => resolveDailyTarotCard(reading, today), [reading, today]);
  const retrogrades = useMemo(() => computeRetrogradeStatuses(today), [today]);
  const retrogradeBanner = useMemo(() => computeRetrogradeBanner(retrogrades), [retrogrades]);
  const prompts = useMemo(
    () =>
      getJournalPrompts({
        moonPhase,
        moonSign,
        sunSign,
        tarotCardName: tarotCard.name,
        retrogradePlanets: retrogrades.filter((item) => item.isRetrograde).map((item) => item.body),
        transits,
      }),
    [moonPhase, moonSign, sunSign, tarotCard.name, retrogrades, transits],
  );

  if (error) {
    return (
      <EmptyState
        title="The observatory is offline"
        detail={error}
        action={
          <button type="button" onClick={() => location.reload()} style={ghostButtonStyle(true)}>
            <StarsSymbol name="refresh" size={18} color={STARS_BG} filled />
            Reload dashboard
          </button>
        }
      />
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ ...panelStyle({ minHeight: 240, glow: true }) }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          <div style={{ ...panelStyle({ minHeight: 340 }) }} />
          <div style={{ ...panelStyle({ minHeight: 340 }) }} />
          <div style={{ ...panelStyle({ minHeight: 340 }) }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section
        className="stars-card-glow"
        style={{
          ...panelStyle({ padding: 28, tone: '#14141A', glow: true }),
          background: [
            `radial-gradient(circle at 12% 18%, ${withAlpha(STARS_ACCENT_LIGHT, 0.16)}, transparent 25%)`,
            `radial-gradient(circle at 86% 0%, ${withAlpha(STARS_GOLD, 0.12)}, transparent 28%)`,
            `linear-gradient(135deg, ${withAlpha('#0F0F15', 0.98)}, ${withAlpha('#181821', 0.98)})`,
          ].join(', '),
        }}
      >
        <SectionTitle
          eyebrow="Daily Observatory"
          title={formatLongDate(today)}
          detail={
            primaryProfile
              ? `${primaryProfile.name}'s sky opens with the Sun in ${capitalizeWord(sunSign)}, the Moon in ${capitalizeWord(moonSign)}, and ${retrogrades.filter((item) => item.isRetrograde).length} active retrogrades shaping the tone.`
              : `Start with the Moon in ${capitalizeWord(moonSign)}, a ${prettyPhase(moonPhase)} atmosphere, and today's tarot cue: ${tarotCard.name}.`
          }
          actions={
            <>
              <Link href="/stars/readings" style={ghostButtonStyle(true)}>
                <StarsSymbol name="auto_awesome" size={18} color={STARS_BG} filled />
                Full reading
              </Link>
              <Link href="/stars/journal" style={secondaryButtonStyle()}>
                <StarsSymbol name="menu_book" size={18} color={STARS_ACCENT_LIGHT} />
                Cosmic journal
              </Link>
            </>
          }
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
          <InlineBadge label={retrogradeBanner.text} tone={bannerTone(retrogradeBanner.color)} textColor={bannerText(retrogradeBanner.color)} icon="autorenew" />
          <InlineBadge label={`${prettyPhase(moonPhase)} in ${capitalizeWord(moonSign)}`} icon="dark_mode" />
          <InlineBadge label={`Tarot: ${tarotCard.name}`} icon="style" tone={withAlpha(STARS_ACCENT, 0.18)} textColor={STARS_ACCENT_LIGHT} />
        </div>
      </section>

      {!primaryProfile ? (
        <EmptyState
          title="Add a birth profile to personalize the sky"
          detail="MyStars already has the cosmic weather ready. Add your birth details to unlock chart overlays, tailored daily readings, compatibility, and transit scoring."
          action={
            <Link href="/stars/profile" style={ghostButtonStyle(true)}>
              <StarsSymbol name="person_add" size={18} color={STARS_BG} filled />
              Add birth profile
            </Link>
          }
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 18,
            alignItems: 'stretch',
          }}
        >
          <section style={{ ...panelStyle({ tone: '#181820', glow: true }), display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                  Celestial Snapshot
                </span>
                <h2 style={{ margin: 0, fontSize: 28, color: STARS_TEXT, letterSpacing: '-0.04em' }}>{primaryProfile.name}</h2>
              </div>
              <Link href={`/stars/profile/${primaryProfile.id}`} style={secondaryButtonStyle()}>
                <StarsSymbol name="chevron_right" size={18} color={STARS_ACCENT_LIGHT} />
                Profile
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <MetricCard label="Sun" value={shortSign(primaryProfile.sunSign)} accent={STARS_GOLD} />
              <MetricCard label="Moon" value={shortSign(primaryProfile.moonSign)} accent={STARS_ACCENT_LIGHT} />
              <MetricCard label="Rising" value={shortSign(primaryProfile.risingSign)} accent={STARS_ACCENT} />
            </div>

            <div style={{ ...panelStyle({ padding: 18, tone: '#15151D' }), display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 700, letterSpacing: 0.9, textTransform: 'uppercase' }}>
                    Moon phase
                  </span>
                  <div style={{ marginTop: 4, color: STARS_TEXT, fontSize: 24, fontWeight: 700 }}>
                    {prettyPhase(moonPhase)}
                  </div>
                </div>
                <div style={{ fontSize: 44 }}>{moonEmoji(moonPhase)}</div>
              </div>
              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.75 }}>
                The Moon moves through {capitalizeWord(moonSign)} today, giving your routines a {moonTexture(moonPhase)} rhythm. Use the journal prompt rail when the day feels louder than your intuition.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <MetricCard label="Profiles" value={String(stats?.totalProfiles ?? profiles.length)} />
              <MetricCard label="Saved Charts" value={String(stats?.totalSavedCharts ?? 0)} />
            </div>
          </section>

          <section style={{ ...panelStyle({ tone: '#171720', glow: true }), display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                  Daily reading
                </span>
                <h2 style={{ margin: 0, color: STARS_TEXT, fontSize: 28, letterSpacing: '-0.04em' }}>
                  {reading ? 'Live with your sky' : 'Ready to generate'}
                </h2>
              </div>
              <Link href="/stars/readings" style={secondaryButtonStyle()}>
                <StarsSymbol name="history" size={18} color={STARS_ACCENT_LIGHT} />
                Archive
              </Link>
            </div>

            <div style={{ ...panelStyle({ padding: 20, tone: '#14141A' }), display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <InlineBadge label={`${moonEmoji(moonPhase)} ${prettyPhase(moonPhase)}`} />
                <InlineBadge label={`Moon in ${capitalizeWord(moonSign)}`} icon="brightness_2" />
                <InlineBadge label={tarotCard.name} tone={withAlpha(STARS_ACCENT, 0.18)} textColor={STARS_ACCENT_LIGHT} icon="style" />
              </div>
              <p style={{ margin: 0, color: STARS_TEXT, fontSize: 16, lineHeight: 1.9 }}>
                {reading?.summary ??
                  `${moonTexture(moonPhase)} energy is mixing with ${capitalizeWord(moonSign)} instincts. ${tarotCard.name} suggests a theme of ${tarotCard.keywords.slice(0, 2).join(' and ')}.`}
              </p>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <h3 style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                  Transit highlights
                </h3>
                <Link href="/stars/transit-timeline" style={{ color: STARS_ACCENT_LIGHT, fontSize: 13, fontWeight: 700 }}>
                  View timeline
                </Link>
              </div>
              {transits.slice(0, 4).map((transit) => (
                <div key={transit.id} style={{ ...panelStyle({ padding: 16, tone: '#15151C' }), display: 'grid', gap: 5 }}>
                  <strong style={{ color: STARS_TEXT, fontSize: 15 }}>
                    {capitalizeWord(transit.transitingBody)} {transit.aspectType} {capitalizeWord(transit.natalBody)}
                  </strong>
                  <span style={{ color: STARS_TEXT_TERTIARY, fontSize: 12 }}>
                    {formatShortDate(transit.exactDate)} · {transit.significance} transit
                  </span>
                  <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                    {transit.interpretationBrief}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section style={{ ...panelStyle({ tone: '#17171E', glow: true }), display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Quick rituals
              </span>
              <h2 style={{ margin: 0, color: STARS_TEXT, fontSize: 28, letterSpacing: '-0.04em' }}>Tarot, prompts, and next events</h2>
            </div>

            <div style={{ ...panelStyle({ padding: 18, tone: '#13131A' }), display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div>
                  <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                    Today's tarot
                  </span>
                  <div style={{ marginTop: 4, color: STARS_TEXT, fontSize: 22, fontWeight: 700 }}>{tarotCard.name}</div>
                </div>
                <Link href="/stars/tarot" style={secondaryButtonStyle()}>
                  <StarsSymbol name="style" size={18} color={STARS_ACCENT_LIGHT} />
                  Sanctuary
                </Link>
              </div>
              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.75 }}>
                {tarotCard.uprightMeaning}
              </p>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {prompts.slice(0, 3).map((prompt, index) => (
                <div key={prompt} style={{ ...panelStyle({ padding: 16, tone: '#15151C' }), display: 'grid', gap: 6 }}>
                  <span style={{ color: STARS_TEXT_TERTIARY, fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                    Prompt 0{index + 1}
                  </span>
                  <p style={{ margin: 0, color: STARS_TEXT, fontSize: 14, lineHeight: 1.8 }}>{prompt}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                  Upcoming events
                </h3>
                <Link href="/stars/zodiac-events" style={{ color: STARS_ACCENT_LIGHT, fontSize: 13, fontWeight: 700 }}>
                  Calendar
                </Link>
              </div>
              {events.slice(0, 4).map((event) => (
                <div key={event.id} style={{ display: 'grid', gap: 4 }}>
                  <span style={{ color: STARS_TEXT_TERTIARY, fontSize: 12 }}>{formatShortDate(event.eventDate)}</span>
                  <strong style={{ color: STARS_TEXT, fontSize: 15 }}>{event.title}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function capitalizeWord(value: string | null | undefined) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown';
}

function shortSign(value: string | null | undefined) {
  return value ? value.slice(0, 3).toUpperCase() : 'TBD';
}

function prettyPhase(phase: string) {
  return phase.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function moonEmoji(phase: string) {
  return {
    new_moon: '\u{1F311}',
    waxing_crescent: '\u{1F312}',
    first_quarter: '\u{1F313}',
    waxing_gibbous: '\u{1F314}',
    full_moon: '\u{1F315}',
    waning_gibbous: '\u{1F316}',
    last_quarter: '\u{1F317}',
    waning_crescent: '\u{1F318}',
  }[phase] ?? '\u{1F319}';
}

function moonTexture(phase: string) {
  if (phase === 'new_moon') return 'seed-planting';
  if (phase === 'full_moon') return 'high-voltage';
  if (phase === 'waning_crescent') return 'release-and-rest';
  return 'slow-building';
}

function bannerTone(color: 'red' | 'amber' | 'yellow' | 'green') {
  if (color === 'red') return withAlpha(STARS_DANGER, 0.18);
  if (color === 'amber') return withAlpha('#FF9F0A', 0.18);
  if (color === 'yellow') return withAlpha(STARS_GOLD, 0.18);
  return withAlpha('#30D158', 0.18);
}

function bannerText(color: 'red' | 'amber' | 'yellow' | 'green') {
  if (color === 'red') return '#FFB4AB';
  if (color === 'amber') return '#FFD08A';
  if (color === 'yellow') return STARS_GOLD;
  return '#7EF0AA';
}
