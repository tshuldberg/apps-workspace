'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchMoonCalendarMonth, fetchZodiacEventsAction } from '../actions';
import {
  MOON_PHASE_INTERPRETATIONS,
  MOON_SIGN_INTERPRETATIONS,
  type MoonCalendarDay,
  type ZodiacEvent,
} from '@mylife/stars';
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
  formatShortDate,
  ghostButtonStyle,
  panelStyle,
  secondaryButtonStyle,
  withAlpha,
} from '../ui';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MoonCalendarPage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<MoonCalendarDay[]>([]);
  const [events, setEvents] = useState<ZodiacEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(now.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
        const [dayItems, eventItems] = await Promise.all([
          fetchMoonCalendarMonth(year, month),
          fetchZodiacEventsAction(startDate, endDate),
        ]);
        if (!cancelled) {
          setDays(dayItems);
          setEvents(eventItems);
          if (!dayItems.some((item) => item.date === selectedDate)) {
            setSelectedDate(dayItems[0]?.date ?? startDate);
          }
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError('Failed to load moon calendar');
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
  }, [month, year]);

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const selectedDay = days.find((day) => day.date === selectedDate) ?? null;

  if (error) {
    return (
      <EmptyState
        title="Calendar unavailable"
        detail={error}
        action={
          <button type="button" onClick={() => location.reload()} style={ghostButtonStyle(true)}>
            <StarsSymbol name="refresh" size={18} color="#0E0E13" filled />
            Reload calendar
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

  if (!selectedDay) {
    return (
      <EmptyState
        title="No moon data for this month"
        detail="MyStars could not assemble the requested lunar month. Try another month or reload the page."
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="stars-card-glow" style={{ ...panelStyle({ padding: 28, tone: '#15151B', glow: true }), display: 'grid', gap: 16 }}>
        <SectionTitle
          eyebrow="Moon Calendar"
          title={new Date(`${selectedDay.date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          detail={`Track each phase, illumination shift, and celestial event across the month. Select any day to inspect moon sign context and overlays from the zodiac event engine.`}
          actions={
            <>
              <button type="button" onClick={() => shiftMonth(-1, month, year, setMonth, setYear)} style={secondaryButtonStyle()}>
                <StarsSymbol name="chevron_left" size={18} color={STARS_ACCENT_LIGHT} />
                Previous
              </button>
              <button type="button" onClick={() => shiftMonth(1, month, year, setMonth, setYear)} style={secondaryButtonStyle()}>
                Next
                <StarsSymbol name="chevron_right" size={18} color={STARS_ACCENT_LIGHT} />
              </button>
            </>
          }
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <InlineBadge label={`${moonEmoji(selectedDay.moonPhase)} ${phaseLabel(selectedDay.moonPhase)}`} icon="dark_mode" />
          <InlineBadge label={`Moon in ${capitalizeWord(selectedDay.moonSign)}`} icon="brightness_2" />
          <InlineBadge label={`${Math.round(selectedDay.illuminationPct)}% illuminated`} tone={withAlpha(STARS_GOLD, 0.16)} textColor={STARS_GOLD} />
          <InlineBadge label={`${events.length} event overlay${events.length === 1 ? '' : 's'}`} tone={withAlpha(STARS_ACCENT, 0.16)} textColor={STARS_ACCENT_LIGHT} />
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.06fr) minmax(320px, 0.94fr)', gap: 18 }}>
        <section style={{ ...panelStyle({ padding: 20, tone: '#15151B' }), display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10 }}>
            {WEEKDAYS.map((day) => (
              <div key={day} style={{ padding: '0 6px', color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {day}
              </div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} />
            ))}
            {days.map((day) => {
              const isToday = day.date === new Date().toISOString().slice(0, 10);
              const isSelected = day.date === selectedDate;
              const dayEvents = events.filter((event) => event.eventDate === day.date).length;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  style={{
                    ...panelStyle({ padding: 14, tone: isSelected ? '#1C1B25' : '#111117', glow: isSelected }),
                    minHeight: 112,
                    display: 'grid',
                    gap: 6,
                    justifyItems: 'start',
                    cursor: 'pointer',
                    border: 'none',
                    textAlign: 'left',
                    boxShadow: [
                      `inset 0 0 0 ${isToday ? 2.5 : 1.5}px ${isToday ? STARS_ACCENT : withAlpha(STARS_ACCENT_LIGHT, 0.08)}`,
                      isSelected ? `0 0 26px ${withAlpha(STARS_ACCENT, 0.24)}` : 'none',
                    ].join(', '),
                  }}
                >
                  <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 700 }}>
                    {day.date.slice(-2)}
                  </span>
                  <span style={{ fontSize: 30, lineHeight: 1 }}>{moonEmoji(day.moonPhase)}</span>
                  <span style={{ color: STARS_TEXT, fontSize: 12, fontWeight: 700 }}>
                    {capitalizeWord(day.moonSign).slice(0, 3)}
                  </span>
                  <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 11 }}>{Math.round(day.illuminationPct)}%</span>
                  {dayEvents > 0 ? (
                    <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 11, fontWeight: 700 }}>
                      {dayEvents} event{dayEvents === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section style={{ ...panelStyle({ padding: 24, tone: '#15151B' }), display: 'grid', gap: 18, alignContent: 'start' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Selected day
            </span>
            <strong style={{ color: STARS_TEXT, fontSize: 28, letterSpacing: '-0.04em' }}>{formatLongDate(selectedDay.date)}</strong>
            <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>
              {moonEmoji(selectedDay.moonPhase)} {phaseLabel(selectedDay.moonPhase)} in {capitalizeWord(selectedDay.moonSign)} with {Math.round(selectedDay.illuminationPct)}% illumination.
            </p>
          </div>

          <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 10 }}>
            <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>
              {MOON_PHASE_INTERPRETATIONS[selectedDay.moonPhase]}
            </p>
            <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>
              {MOON_SIGN_INTERPRETATIONS[selectedDay.moonSign]}
            </p>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Event overlay
            </span>
            {events.filter((event) => event.eventDate === selectedDay.date).length > 0 ? (
              events
                .filter((event) => event.eventDate === selectedDay.date)
                .map((event) => (
                  <div key={event.id} style={{ ...panelStyle({ padding: 16, tone: '#111117' }), display: 'grid', gap: 4 }}>
                    <strong style={{ color: STARS_TEXT, fontSize: 15 }}>{event.title}</strong>
                    <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                      {event.descriptionBrief}
                    </p>
                  </div>
                ))
            ) : (
              <div style={{ ...panelStyle({ padding: 16, tone: '#111117' }), color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                No zodiac event overlays land on this date, so use it as a pure lunar rhythm day.
              </div>
            )}

            <button type="button" onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))} style={secondaryButtonStyle()}>
              <StarsSymbol name="today" size={18} color={STARS_ACCENT_LIGHT} />
              Jump to today
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function shiftMonth(
  delta: number,
  month: number,
  year: number,
  setMonth: (month: number) => void,
  setYear: (year: number) => void,
) {
  let nextMonth = month + delta;
  let nextYear = year;
  if (nextMonth < 1) {
    nextMonth = 12;
    nextYear -= 1;
  }
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  setMonth(nextMonth);
  setYear(nextYear);
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
