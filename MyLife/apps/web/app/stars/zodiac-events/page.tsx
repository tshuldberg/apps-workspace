'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchZodiacEventsAction } from '../actions';
import { filterEventsByCategory, type EventCategory, type ZodiacEvent } from '@mylife/stars';
import {
  EmptyState,
  InlineBadge,
  STARS_ACCENT_LIGHT,
  STARS_BG,
  STARS_TEXT,
  STARS_TEXT_SECONDARY,
  SectionTitle,
  StarsSymbol,
  formatShortDate,
  ghostButtonStyle,
  panelStyle,
  secondaryButtonStyle,
  withAlpha,
} from '../ui';

const CATEGORIES: Array<{ label: string; value: EventCategory | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Season', value: 'season' },
  { label: 'Major', value: 'major' },
  { label: 'Minor', value: 'minor' },
];

export default function ZodiacEventsPage() {
  const [events, setEvents] = useState<ZodiacEvent[]>([]);
  const [category, setCategory] = useState<EventCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<'timeline' | 'month-grid'>('timeline');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const start = new Date().toISOString().slice(0, 10);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 90);
        const eventItems = await fetchZodiacEventsAction(start, endDate.toISOString().slice(0, 10));
        if (!cancelled) {
          setEvents(eventItems);
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError('Failed to load zodiac events');
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

  const filtered = useMemo(
    () => (category === 'all' ? events : filterEventsByCategory(events, category)),
    [category, events],
  );
  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, ZodiacEvent[]>();
    for (const event of filtered) {
      const key = new Date(`${event.eventDate}T12:00:00`).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      const current = groups.get(key) ?? [];
      current.push(event);
      groups.set(key, current);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  if (error) {
    return (
      <EmptyState
        title="Zodiac events unavailable"
        detail={error}
        action={
          <button type="button" onClick={() => location.reload()} style={ghostButtonStyle(true)}>
            <StarsSymbol name="refresh" size={18} color={STARS_BG} filled />
            Reload events
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
          eyebrow="Zodiac Events"
          title="Ingresses, lunations, and eclipse weather"
          detail="Filter the 90-day event window and switch between a dense timeline or a monthly grid to spot clusters, seasons, and quieter stretches."
          actions={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setViewMode('timeline')} style={viewMode === 'timeline' ? ghostButtonStyle(true) : secondaryButtonStyle()}>
                Timeline
              </button>
              <button type="button" onClick={() => setViewMode('month-grid')} style={viewMode === 'month-grid' ? ghostButtonStyle(true) : secondaryButtonStyle()}>
                Month grid
              </button>
            </div>
          }
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CATEGORIES.map((item) => (
            <button key={item.value} type="button" onClick={() => setCategory(item.value)} style={category === item.value ? ghostButtonStyle(true) : secondaryButtonStyle()}>
              {item.label}
            </button>
          ))}
          <InlineBadge label={`${filtered.length} events`} tone={withAlpha(STARS_ACCENT_LIGHT, 0.14)} textColor={STARS_ACCENT_LIGHT} />
        </div>
      </section>

      {filtered.length === 0 ? (
        <EmptyState title="No events match this filter" detail="Switch categories or widen the event horizon in a future pass." />
      ) : viewMode === 'timeline' ? (
        <section style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 12 }}>
          {filtered.map((event) => (
            <div key={event.id} style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <strong style={{ color: STARS_TEXT, fontSize: 18 }}>{event.title}</strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <InlineBadge label={formatShortDate(event.eventDate)} icon="calendar_today" />
                  <InlineBadge label={event.body} tone={withAlpha(STARS_ACCENT_LIGHT, 0.16)} textColor={STARS_ACCENT_LIGHT} />
                </div>
              </div>
              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>
                {event.descriptionBrief}
              </p>
              {event.descriptionFull ? (
                <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.8 }}>
                  {event.descriptionFull}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ) : (
        <section style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 18 }}>
          {groupedByMonth.map(([label, monthEvents]) => (
            <div key={label} style={{ display: 'grid', gap: 10 }}>
              <strong style={{ color: STARS_TEXT, fontSize: 24, letterSpacing: '-0.04em' }}>{label}</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {monthEvents.map((event) => (
                  <div key={event.id} style={{ ...panelStyle({ padding: 16, tone: '#111117' }), display: 'grid', gap: 5 }}>
                    <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12 }}>{formatShortDate(event.eventDate)}</span>
                    <strong style={{ color: STARS_TEXT, fontSize: 16 }}>{event.title}</strong>
                    <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                      {event.descriptionBrief}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
