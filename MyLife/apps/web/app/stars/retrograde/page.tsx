'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchProfiles } from '../actions';
import {
  computeRetrogradeBanner,
  computeRetrogradeStatuses,
  getActiveRetrogrades,
  getRetrogradePersonalImpact,
  getUpcomingRetrogrades,
  getYearRetrogrades,
  type BirthProfile,
} from '@mylife/stars';
import {
  EmptyState,
  InlineBadge,
  STARS_ACCENT_LIGHT,
  STARS_BG,
  STARS_DANGER,
  STARS_GOLD,
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function RetrogradePage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const year = new Date().getFullYear();
  const statuses = useMemo(() => computeRetrogradeStatuses(today), [today]);
  const banner = useMemo(() => computeRetrogradeBanner(statuses), [statuses]);
  const active = useMemo(() => getActiveRetrogrades(statuses), [statuses]);
  const upcoming = useMemo(() => getUpcomingRetrogrades(statuses), [statuses]);
  const periods = useMemo(() => getYearRetrogrades(year), [year]);

  const [profiles, setProfiles] = useState<BirthProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchProfiles()
      .then((items) => {
        if (!cancelled) {
          setProfiles(items);
        }
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) {
          setError('Failed to load retrograde profile context');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const primaryProfile = profiles[0] ?? null;
  const impact = useMemo(() => getRetrogradePersonalImpact(statuses, primaryProfile), [primaryProfile, statuses]);

  if (error) {
    return (
      <EmptyState
        title="Retrograde board unavailable"
        detail={error}
        action={
          <button type="button" onClick={() => location.reload()} style={ghostButtonStyle(true)}>
            <StarsSymbol name="refresh" size={18} color={STARS_BG} filled />
            Reload board
          </button>
        }
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="stars-card-glow" style={{ ...panelStyle({ padding: 28, tone: '#15151B', glow: true }), display: 'grid', gap: 18 }}>
        <SectionTitle
          eyebrow="Retrograde Tracker"
          title={`${active.length} active retrogrades`}
          detail="Scan current retrogrades, the rest of the year's timeline, and the personal placements most exposed by the current review cycle."
          actions={
            <InlineBadge
              label={banner.text}
              tone={withAlpha(banner.color === 'red' ? STARS_DANGER : STARS_GOLD, 0.16)}
              textColor={banner.color === 'red' ? '#FFB4AB' : '#FFD08A'}
              icon="autorenew"
            />
          }
        />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        <section style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 12 }}>
          <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
            Active now
          </span>
          {active.length === 0 ? (
            <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>
              No planets are currently retrograde. Use the year board to anticipate the next review cycle.
            </p>
          ) : (
            active.map((status) => (
              <div key={status.body} style={{ ...panelStyle({ padding: 16, tone: '#111117', glow: true }), display: 'grid', gap: 4 }}>
                <strong style={{ color: STARS_TEXT, fontSize: 16 }}>
                  {status.body.toUpperCase()} RX
                </strong>
                <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 12, fontWeight: 700 }}>
                  {status.retrogradeStart} → {status.retrogradeEnd}
                </span>
                <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>{status.interpretation}</p>
              </div>
            ))
          )}
        </section>

        <section style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 12 }}>
          <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
            Upcoming next
          </span>
          {upcoming.slice(0, 5).map((status) => (
            <div key={status.body} style={{ display: 'grid', gap: 4 }}>
              <strong style={{ color: STARS_TEXT, fontSize: 15 }}>{status.body.toUpperCase()} RX</strong>
              <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12 }}>
                {status.daysUntilStart} days until {formatShortDate(status.retrogradeStart ?? today)}
              </span>
            </div>
          ))}
        </section>

        <section style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 12 }}>
          <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
            Personal impact
          </span>
          {impact.length === 0 ? (
            <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>
              Add a profile with Sun, Moon, and Rising to estimate which placements the retrograde cycle is touching.
            </p>
          ) : (
            impact.map((item) => (
              <div key={item.body} style={{ ...panelStyle({ padding: 16, tone: '#111117' }), display: 'grid', gap: 4 }}>
                <strong style={{ color: STARS_TEXT, fontSize: 15 }}>
                  {item.body.toUpperCase()} · {item.level.toUpperCase()}
                </strong>
                <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>{item.summary}</p>
              </div>
            ))
          )}
        </section>
      </div>

      <section style={{ ...panelStyle({ padding: 22, tone: '#15151B', glow: true }), display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              {year} retrograde board
            </span>
            <h2 style={{ margin: '4px 0 0', color: STARS_TEXT, fontSize: 30, letterSpacing: '-0.04em' }}>Year timeline</h2>
          </div>
          <button type="button" style={secondaryButtonStyle()}>
            <StarsSymbol name="calendar_month" size={18} color={STARS_ACCENT_LIGHT} />
            {periods.length} periods tracked
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(12, minmax(0, 1fr))', gap: 8, alignItems: 'center' }}>
          <div />
          {MONTHS.map((month) => (
            <div key={month} style={{ color: STARS_TEXT_SECONDARY, fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              {month}
            </div>
          ))}
          {['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].map((body) => {
            const bodyPeriods = periods.filter((period) => period.body === body);
            return (
              <div key={body} style={{ display: 'contents' }}>
                <strong style={{ color: STARS_TEXT, fontSize: 14 }}>{body.toUpperCase()}</strong>
                {MONTHS.map((_, index) => {
                  const monthNumber = index + 1;
                  const activeInMonth = bodyPeriods.some((period) => {
                    const startMonth = Number(period.start.slice(5, 7));
                    const endMonth = Number(period.end.slice(5, 7));
                    return monthNumber >= startMonth && monthNumber <= endMonth;
                  });
                  return (
                    <div
                      key={`${body}-${monthNumber}`}
                      style={{
                        height: 28,
                        borderRadius: 999,
                        background: activeInMonth ? `linear-gradient(90deg, ${withAlpha(STARS_ACCENT_LIGHT, 0.88)}, ${withAlpha(STARS_GOLD, 0.86)})` : withAlpha('#FFFFFF', 0.05),
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
