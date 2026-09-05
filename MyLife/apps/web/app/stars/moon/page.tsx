'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchMoonCalendarMonth, fetchZodiacEventsAction } from '../actions';
import {
  MOON_PHASE_INTERPRETATIONS,
  MOON_SIGN_INTERPRETATIONS,
  getKeyPhasesForMonth,
  getNextFullMoon,
  getNextNewMoon,
  type MoonCalendarDay,
  type ZodiacEvent,
} from '@mylife/stars';
import {
  EmptyState,
  InlineBadge,
  STARS_ACCENT_LIGHT,
  STARS_TEXT,
  STARS_TEXT_SECONDARY,
  SectionTitle,
  StarsSymbol,
  formatLongDate,
  formatShortDate,
  ghostButtonStyle,
  panelStyle,
  secondaryButtonStyle,
} from '../ui';

export default function MoonPortalPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [todayData, setTodayData] = useState<MoonCalendarDay | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<ZodiacEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const current = new Date(`${today}T12:00:00`);
        const month = current.getMonth() + 1;
        const year = current.getFullYear();
        const endDate = new Date(current);
        endDate.setDate(endDate.getDate() + 28);

        const [days, events] = await Promise.all([
          fetchMoonCalendarMonth(year, month),
          fetchZodiacEventsAction(today, endDate.toISOString().slice(0, 10)),
        ]);

        if (!cancelled) {
          setTodayData(days.find((day) => day.date === today) ?? null);
          setUpcomingEvents(events);
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError('Failed to load the moon portal');
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

  const keyPhases = useMemo(() => {
    const current = new Date(`${today}T12:00:00`);
    return getKeyPhasesForMonth(current.getFullYear(), current.getMonth() + 1);
  }, [today]);
  const nextNewMoon = getNextNewMoon(today);
  const nextFullMoon = getNextFullMoon(today);

  if (error) {
    return (
      <EmptyState
        title="Moon portal offline"
        detail={error}
        action={
          <button type="button" onClick={() => location.reload()} style={ghostButtonStyle(true)}>
            <StarsSymbol name="refresh" size={18} color="#0E0E13" filled />
            Reload
          </button>
        }
      />
    );
  }

  if (loading || !todayData) {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ ...panelStyle({ minHeight: 280, glow: true }) }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.9fr', gap: 18 }}>
          <div style={{ ...panelStyle({ minHeight: 420 }) }} />
          <div style={{ ...panelStyle({ minHeight: 420 }) }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="stars-card-glow" style={{ ...panelStyle({ padding: 28, tone: '#15151B', glow: true }), display: 'grid', gap: 18 }}>
        <SectionTitle
          eyebrow="Moon Portal"
          title={`${phaseLabel(todayData.moonPhase)} in ${capitalizeWord(todayData.moonSign)}`}
          detail={`${formatLongDate(today)} carries a ${ritualTone(todayData.moonPhase)} tone. Illumination is at ${Math.round(todayData.illuminationPct)}%, and the portal is tuned for ritual, reflection, and the next celestial turn.`}
          actions={
            <>
              <Link href="/stars/moon-calendar" style={ghostButtonStyle(true)}>
                <StarsSymbol name="calendar_month" size={18} color="#0E0E13" filled />
                Open calendar
              </Link>
              <Link href="/stars/zodiac-events" style={secondaryButtonStyle()}>
                <StarsSymbol name="flare" size={18} color={STARS_ACCENT_LIGHT} />
                Event timeline
              </Link>
            </>
          }
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <InlineBadge label={`${moonEmoji(todayData.moonPhase)} ${phaseLabel(todayData.moonPhase)}`} icon="dark_mode" />
          <InlineBadge label={`Moon in ${capitalizeWord(todayData.moonSign)}`} icon="brightness_2" />
          <InlineBadge
            label={`Next new moon ${nextNewMoon ? formatShortDate(nextNewMoon.date) : 'TBD'}`}
            tone="rgba(196,181,253,0.16)"
            textColor="#C4B5FD"
          />
          <InlineBadge
            label={`Next full moon ${nextFullMoon ? formatShortDate(nextFullMoon.date) : 'TBD'}`}
            tone="rgba(255,184,119,0.16)"
            textColor="#FFB877"
          />
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.06fr) minmax(320px, 0.94fr)', gap: 18 }}>
        <section style={{ ...panelStyle({ padding: 24, tone: '#15151B', glow: true }), display: 'grid', gap: 20 }}>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 140, lineHeight: 1 }}>{moonEmoji(todayData.moonPhase)}</div>
            <strong style={{ color: STARS_TEXT, fontSize: 36, letterSpacing: '-0.05em' }}>{phaseLabel(todayData.moonPhase)}</strong>
            <p style={{ margin: 0, maxWidth: 520, color: STARS_TEXT_SECONDARY, fontSize: 15, lineHeight: 1.85, textAlign: 'center' }}>
              {MOON_PHASE_INTERPRETATIONS[todayData.moonPhase]}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 6 }}>
              <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Moon sign
              </span>
              <strong style={{ color: STARS_TEXT, fontSize: 26 }}>{capitalizeWord(todayData.moonSign)}</strong>
              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                {MOON_SIGN_INTERPRETATIONS[todayData.moonSign]}
              </p>
            </div>
            <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 6 }}>
              <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Illumination
              </span>
              <strong style={{ color: STARS_TEXT, fontSize: 26 }}>{Math.round(todayData.illuminationPct)}%</strong>
              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                {todayData.isKeyPhase ? 'Today is a key lunar turning point.' : 'A quiet but active phase with enough light to notice subtle shifts.'}
              </p>
            </div>
          </div>

          <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 10 }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Ritual prompts
            </span>
            {ritualPrompts(todayData.moonPhase, todayData.moonSign).map((prompt) => (
              <p key={prompt} style={{ margin: 0, color: STARS_TEXT, fontSize: 14, lineHeight: 1.8 }}>
                {prompt}
              </p>
            ))}
          </div>
        </section>

        <section style={{ ...panelStyle({ padding: 24, tone: '#15151B' }), display: 'grid', gap: 18, alignContent: 'start' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Key phases this month
            </span>
            {keyPhases.slice(0, 4).map((phase) => (
              <div key={phase.date} style={{ ...panelStyle({ padding: 16, tone: '#111117' }), display: 'grid', gap: 4 }}>
                <strong style={{ color: STARS_TEXT, fontSize: 15 }}>
                  {moonEmoji(phase.moonPhase)} {phaseLabel(phase.moonPhase)}
                </strong>
                <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 12, fontWeight: 700 }}>
                  {formatShortDate(phase.date)} · {capitalizeWord(phase.moonSign)}
                </span>
                <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                  {phase.phaseInterpretation}
                </p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Upcoming celestial events
            </span>
            {upcomingEvents.slice(0, 5).map((event) => (
              <div key={event.id} style={{ display: 'grid', gap: 4 }}>
                <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12 }}>{formatShortDate(event.eventDate)}</span>
                <strong style={{ color: STARS_TEXT, fontSize: 15 }}>{event.title}</strong>
                <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                  {event.descriptionBrief}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function capitalizeWord(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function phaseLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function moonEmoji(value: string) {
  return {
    new_moon: '\u{1F311}',
    waxing_crescent: '\u{1F312}',
    first_quarter: '\u{1F313}',
    waxing_gibbous: '\u{1F314}',
    full_moon: '\u{1F315}',
    waning_gibbous: '\u{1F316}',
    last_quarter: '\u{1F317}',
    waning_crescent: '\u{1F318}',
  }[value] ?? '\u{1F319}';
}

function ritualTone(phase: string) {
  if (phase === 'new_moon') return 'quiet seed-setting';
  if (phase === 'full_moon') return 'high-voltage release';
  if (phase === 'waning_crescent') return 'closing and integration';
  return 'slow-building devotional';
}

function ritualPrompts(phase: string, sign: string) {
  return [
    `What intention wants a cleaner container during this ${phaseLabel(phase).toLowerCase()}?`,
    `How can ${capitalizeWord(sign)} help you move with more feeling and less force tonight?`,
    'If the sky were a private mentor, what one ritual would it ask you to repeat for the next three days?',
  ];
}
