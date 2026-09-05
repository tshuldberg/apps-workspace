'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameDetail, LeagueId, TimelineEvent } from '@mylife/sports';
import { isMajorEvent } from '@mylife/sports';
import { SPORTS_ACCENT, sportsStyles } from '../../_ui';
import { sportsGetGameTimeline } from '../../actions';

type Props = {
  detail: GameDetail;
  initialTimeline: TimelineEvent[];
  league: LeagueId;
  gameId: string;
};

const TIMELINE_POLL_MS = 15_000;

export function GameDetailClient({
  detail,
  initialTimeline,
  league,
  gameId,
}: Props) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>(initialTimeline);
  const pendingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      const next = await sportsGetGameTimeline(gameId, league, detail.status);
      setTimeline(next);
    } catch {
      // Keep last-known timeline on fetch failure.
    } finally {
      pendingRef.current = false;
    }
  }, [gameId, league, detail.status]);

  // visibilitychange: fresh pull when tab becomes visible during a live game.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (detail.status !== 'live') return;
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [detail.status, refresh]);

  // Polling only while the game is live + tab is visible.
  useEffect(() => {
    if (detail.status !== 'live') return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, TIMELINE_POLL_MS);
    return () => window.clearInterval(id);
  }, [detail.status, refresh]);

  const statusLabel =
    detail.status === 'live'
      ? detail.period ?? 'Live'
      : detail.status === 'final'
        ? 'Final'
        : 'Scheduled';
  const isLive = detail.status === 'live';

  return (
    <section style={sportsStyles.panel}>
      <div style={heroCardStyle}>
        <div style={heroHeaderStyle}>
          <span style={sportsStyles.eyebrow}>
            {detail.league.toUpperCase()}
          </span>
          <span style={isLive ? pillLiveStyle : pillStyle}>{statusLabel}</span>
        </div>
        <div style={scoreRowStyle}>
          <div style={{ flex: 1 }}>
            <div style={sideNameStyle}>{detail.away.name}</div>
            {detail.away.abbreviation ? (
              <div style={sideAbbrStyle}>{detail.away.abbreviation}</div>
            ) : null}
          </div>
          <div style={scoreValueStyle}>{detail.away.score ?? '—'}</div>
        </div>
        <div style={scoreRowStyle}>
          <div style={{ flex: 1 }}>
            <div style={sideNameStyle}>{detail.home.name}</div>
            {detail.home.abbreviation ? (
              <div style={sideAbbrStyle}>{detail.home.abbreviation}</div>
            ) : null}
          </div>
          <div style={scoreValueStyle}>{detail.home.score ?? '—'}</div>
        </div>
        {isLive && detail.clock ? (
          <p style={clockTextStyle}>{detail.clock}</p>
        ) : null}
      </div>

      {detail.periods.length > 0 ? (
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>By period</h3>
          <div style={tableHeaderStyle}>
            <span style={{ ...tableCellTeamStyle, ...tableHeaderTextStyle }}>
              Team
            </span>
            {detail.periods.map((p, i) => (
              <span
                key={`${p.period}-${i}`}
                style={{ ...tableCellPeriodStyle, ...tableHeaderTextStyle }}
              >
                {String(p.period)}
              </span>
            ))}
            <span style={{ ...tableCellPeriodStyle, ...tableHeaderTextStyle }}>
              T
            </span>
          </div>
          <div style={tableRowStyle}>
            <span style={tableCellTeamStyle}>
              {detail.away.abbreviation ?? detail.away.name}
            </span>
            {detail.periods.map((p, i) => (
              <span
                key={`a-${i}`}
                style={{ ...tableCellPeriodStyle, ...tableCellValueStyle }}
              >
                {p.awayScore}
              </span>
            ))}
            <span style={{ ...tableCellPeriodStyle, ...tableCellTotalStyle }}>
              {detail.away.score ?? '—'}
            </span>
          </div>
          <div style={tableRowStyle}>
            <span style={tableCellTeamStyle}>
              {detail.home.abbreviation ?? detail.home.name}
            </span>
            {detail.periods.map((p, i) => (
              <span
                key={`h-${i}`}
                style={{ ...tableCellPeriodStyle, ...tableCellValueStyle }}
              >
                {p.homeScore}
              </span>
            ))}
            <span style={{ ...tableCellPeriodStyle, ...tableCellTotalStyle }}>
              {detail.home.score ?? '—'}
            </span>
          </div>
        </div>
      ) : null}

      {detail.leaders && detail.leaders.length > 0 ? (
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Leaders</h3>
          {detail.leaders.map((l, i) => (
            <div
              key={`${l.teamSide}-${l.category}-${i}`}
              style={leaderRowStyle}
            >
              <div style={{ flex: 1 }}>
                <div style={leaderCategoryStyle}>
                  {l.teamSide === 'home'
                    ? detail.home.abbreviation ?? 'Home'
                    : detail.away.abbreviation ?? 'Away'}
                  {' · '}
                  {l.category}
                </div>
                {l.athleteName ? (
                  <div style={leaderAthleteStyle}>{l.athleteName}</div>
                ) : null}
              </div>
              <div style={leaderValueStyle}>{l.displayValue}</div>
            </div>
          ))}
        </div>
      ) : null}

      {detail.venue || detail.broadcast || detail.weather ? (
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Game info</h3>
          {detail.venue ? (
            <InfoRow label="Venue" value={detail.venue} />
          ) : null}
          {detail.broadcast ? (
            <InfoRow label="Broadcast" value={detail.broadcast} />
          ) : null}
          {detail.weather ? (
            <InfoRow label="Weather" value={detail.weather} />
          ) : null}
        </div>
      ) : null}

      <div style={sectionStyle}>
        <div style={timelineHeaderStyle}>
          <h3 style={sectionTitleStyle}>Plays</h3>
          <span style={timelineCountPillStyle}>{timeline.length}</span>
        </div>
        {timeline.length === 0 ? (
          <div style={timelineEmptyStyle}>
            Play-by-play unavailable for this game.
          </div>
        ) : (
          timeline.map((ev) => (
            <TimelineRow
              key={ev.id}
              event={ev}
              homeAbbr={detail.home.abbreviation ?? null}
              awayAbbr={detail.away.abbreviation ?? null}
            />
          ))
        )}
      </div>

      <div style={comingSoonStyle}>
        <div style={comingSoonLabelStyle}>Coming soon</div>
        <div style={comingSoonHintStyle}>Attendance + game notes (P6)</div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Link href="/sports/schedule" style={backLinkStyle}>
          Back to schedule
        </Link>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoRowStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <span style={infoValueStyle}>{value}</span>
    </div>
  );
}

const heroCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 20,
  borderRadius: 20,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  marginTop: 8,
};

const heroHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const pillStyle: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
};

const pillLiveStyle: CSSProperties = {
  ...pillStyle,
  background: SPORTS_ACCENT,
  borderColor: SPORTS_ACCENT,
  color: '#0E0E13',
};

const scoreRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const sideNameStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 18,
  fontWeight: 800,
};

const sideAbbrStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.1em',
  marginTop: 2,
};

const scoreValueStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 32,
  fontWeight: 900,
  minWidth: 56,
  textAlign: 'right',
};

const clockTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 12,
};

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 16,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text)',
  fontSize: 15,
  fontWeight: 700,
};

const tableHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 12px',
};

const tableHeaderTextStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const tableRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 12,
  borderRadius: 12,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
};

const tableCellTeamStyle: CSSProperties = {
  flex: 1,
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 700,
};

const tableCellPeriodStyle: CSSProperties = {
  width: 40,
  textAlign: 'center',
  color: 'var(--text)',
  fontSize: 13,
};

const tableCellValueStyle: CSSProperties = {
  fontWeight: 600,
};

const tableCellTotalStyle: CSSProperties = {
  fontWeight: 900,
  color: SPORTS_ACCENT,
};

const leaderRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: 12,
  borderRadius: 12,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
};

const leaderCategoryStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 700,
};

const leaderAthleteStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 11,
  marginTop: 2,
};

const leaderValueStyle: CSSProperties = {
  color: SPORTS_ACCENT,
  fontSize: 13,
  fontWeight: 800,
};

const infoRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: 12,
  borderRadius: 12,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
};

const infoLabelStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 700,
};

const infoValueStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 600,
};

const comingSoonStyle: CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 14,
  background: 'var(--surface)',
  border: '1px dashed var(--border)',
};

const comingSoonLabelStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 700,
};

const comingSoonHintStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 12,
  marginTop: 2,
};

const backLinkStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 600,
};

// ── P2-B play-by-play styles + subcomponent ────────────────────────

function TimelineRow({
  event,
  homeAbbr,
  awayAbbr,
}: {
  event: TimelineEvent;
  homeAbbr: string | null;
  awayAbbr: string | null;
}) {
  const major = isMajorEvent(event);
  const sideLabel =
    event.team === 'home'
      ? homeAbbr ?? 'HOME'
      : event.team === 'away'
        ? awayAbbr ?? 'AWAY'
        : null;
  return (
    <div style={major ? timelineRowMajorStyle : timelineRowStyle}>
      <div style={timelineMetaStyle}>
        <span
          style={
            major
              ? { ...timelinePeriodStyle, color: SPORTS_ACCENT }
              : timelinePeriodStyle
          }
        >
          {String(event.period ?? '—')}
        </span>
        {event.clock ? (
          <span style={timelineClockStyle}>{event.clock}</span>
        ) : null}
      </div>
      <div style={timelineBodyStyle}>
        {sideLabel ? (
          <span style={timelineSideStyle}>{sideLabel}</span>
        ) : null}
        <span
          style={
            major
              ? { ...timelineDescriptionStyle, fontWeight: 700 }
              : timelineDescriptionStyle
          }
        >
          {event.description}
        </span>
        {event.isScoring &&
        event.homeScoreAfter !== null &&
        event.homeScoreAfter !== undefined &&
        event.awayScoreAfter !== null &&
        event.awayScoreAfter !== undefined ? (
          <span style={timelineScoreAfterStyle}>
            {awayAbbr ?? 'AWAY'} {event.awayScoreAfter} ·{' '}
            {homeAbbr ?? 'HOME'} {event.homeScoreAfter}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const timelineHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const timelineCountPillStyle: CSSProperties = {
  padding: '2px 10px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 700,
};

const timelineEmptyStyle: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: 'var(--surface)',
  border: '1px dashed var(--border)',
  color: 'var(--text-secondary)',
  fontSize: 12,
};

const timelineRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  padding: 12,
  borderRadius: 12,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
};

const timelineRowMajorStyle: CSSProperties = {
  ...timelineRowStyle,
  borderColor: SPORTS_ACCENT,
  background: 'rgba(22,163,74,0.12)',
};

const timelineMetaStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  width: 72,
};

const timelinePeriodStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 800,
};

const timelineClockStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 11,
};

const timelineBodyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const timelineSideStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const timelineDescriptionStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  lineHeight: '18px',
};

const timelineScoreAfterStyle: CSSProperties = {
  color: SPORTS_ACCENT,
  fontSize: 12,
  fontWeight: 800,
  marginTop: 4,
};
