'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, type CSSProperties } from 'react';
import type {
  FollowTier,
  Game,
  StandingRow,
  Team,
} from '@mylife/sports';
import { SPORTS_ACCENT, sportsStyles } from '../../_ui';
import {
  sportsSetRival,
  sportsUnfollowTeam,
  sportsUpdateNotifications,
  sportsUpdateTier,
} from '../../actions';

const TIERS: Array<{ id: FollowTier; label: string; subtitle: string }> = [
  { id: 'diehard', label: 'Die-hard', subtitle: 'Every game. Every trade.' },
  { id: 'casual', label: 'Casual', subtitle: 'Playoffs and big matchups.' },
  { id: 'occasional', label: 'Occasional', subtitle: 'Just the headlines.' },
];

type NotifyKey =
  | 'notify_start'
  | 'notify_end'
  | 'notify_close'
  | 'notify_trades';

export function TeamDetailClient({
  team: initial,
  record,
  schedule = [],
}: {
  team: Team;
  record?: StandingRow | null;
  schedule?: Game[];
}) {
  const router = useRouter();
  const [team, setTeam] = useState<Team>(initial);
  const [, startTransition] = useTransition();

  const { upcoming, recent } = useMemo(() => {
    const now = Date.now();
    const up: Game[] = [];
    const rc: Game[] = [];
    for (const g of schedule) {
      if (g.status === 'final' || g.startAt < now) rc.push(g);
      else up.push(g);
    }
    up.sort((a, b) => a.startAt - b.startAt);
    rc.sort((a, b) => b.startAt - a.startAt);
    return { upcoming: up.slice(0, 10), recent: rc.slice(0, 10) };
  }, [schedule]);

  const heroTint = team.primary_color ?? null;
  const validHex =
    heroTint && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(heroTint);
  const heroStyle: CSSProperties = validHex
    ? {
        padding: 18,
        borderRadius: 18,
        background: `${heroTint}`,
        border: `1px solid ${heroTint}`,
      }
    : {
        padding: 18,
        borderRadius: 18,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      };

  const setTier = (tier: FollowTier) => {
    setTeam((prev) => ({ ...prev, follow_tier: tier }));
    startTransition(() => {
      void sportsUpdateTier(team.id, tier);
    });
  };

  const toggleRival = (next: boolean) => {
    setTeam((prev) => ({ ...prev, is_rival: next ? 1 : 0 }));
    startTransition(() => {
      void sportsSetRival(team.id, next);
    });
  };

  const toggleNotification = (key: NotifyKey, next: boolean) => {
    const value = next ? 1 : 0;
    setTeam((prev) => ({ ...prev, [key]: value }));
    startTransition(() => {
      void sportsUpdateNotifications(team.id, { [key]: value });
    });
  };

  const handleUnfollow = () => {
    startTransition(async () => {
      await sportsUnfollowTeam(team.id);
      router.push('/sports/teams');
    });
  };

  return (
    <section style={sportsStyles.panel}>
      <div style={heroStyle}>
        <div style={heroRowStyle}>
          <div style={{ flex: 1 }}>
            <p style={sportsStyles.eyebrow}>{team.league.toUpperCase()}</p>
            <h2 style={sportsStyles.title}>{team.name}</h2>
            <p style={sportsStyles.body}>
              {[team.conference, team.division].filter(Boolean).join(' · ') ||
                'Team details'}
            </p>
          </div>
          {team.logo_url ? (
            <img
              src={team.logo_url}
              alt={`${team.name} logo`}
              width={64}
              height={64}
              style={heroLogoStyle}
            />
          ) : null}
        </div>
        {record ? (
          <span style={recordBadgeStyle}>
            Season: {record.wins}-{record.losses}
            {record.ties > 0 ? `-${record.ties}` : ''}
            {' · '}
            {record.winPct.toFixed(3).replace(/^0/, '')}
          </span>
        ) : null}
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Follow tier</h3>
        {TIERS.map((tier) => {
          const active = team.follow_tier === tier.id;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => setTier(tier.id)}
              style={active ? tierRowActiveStyle : tierRowStyle}
            >
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={tierLabelStyle}>{tier.label}</div>
                <div style={tierSubtitleStyle}>{tier.subtitle}</div>
              </div>
              <span style={active ? tierDotActiveStyle : tierDotStyle}>
                {active ? '●' : '○'}
              </span>
            </button>
          );
        })}
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Rivalry</h3>
        <ToggleRow
          label="Mark as rival"
          hint="Rival tuning powers smarter alerts in a later phase."
          value={team.is_rival === 1}
          onChange={toggleRival}
        />
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Notifications</h3>
        <p style={captionStyle}>
          Preferences are stored now; dispatch goes live in P2.
        </p>
        <ToggleRow
          label="Game start"
          value={team.notify_start === 1}
          onChange={(v) => toggleNotification('notify_start', v)}
        />
        <ToggleRow
          label="Final score"
          value={team.notify_end === 1}
          onChange={(v) => toggleNotification('notify_end', v)}
        />
        <ToggleRow
          label="Close games"
          value={team.notify_close === 1}
          onChange={(v) => toggleNotification('notify_close', v)}
        />
        <ToggleRow
          label="Trades and transactions"
          value={team.notify_trades === 1}
          onChange={(v) => toggleNotification('notify_trades', v)}
        />
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Schedule</h3>
        {schedule.length === 0 ? (
          <p style={captionStyle}>No games found.</p>
        ) : null}
        {upcoming.length > 0 ? (
          <>
            <p style={scheduleGroupHeaderStyle}>Upcoming</p>
            {upcoming.map((g) => (
              <GameRow key={g.id} game={g} teamId={team.id} />
            ))}
          </>
        ) : null}
        {recent.length > 0 ? (
          <>
            <p style={scheduleGroupHeaderStyle}>Recent</p>
            {recent.map((g) => (
              <GameRow key={g.id} game={g} teamId={team.id} />
            ))}
          </>
        ) : null}
        <Link
          href={`/sports/history?teamId=${encodeURIComponent(team.id.split(':').pop() ?? team.id)}`}
          style={seasonHistoryLinkStyle}
        >
          Season history →
        </Link>
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Coming in later phases</h3>
        <div style={placeholderListStyle}>
          <PlaceholderRow label="Roster" hint="Depth chart and injuries" />
          <PlaceholderRow label="Stats" hint="Standings and season rolls" />
        </div>
      </div>

      <div style={footerStyle}>
        <Link href="/sports/teams" style={secondaryLinkStyle}>
          Back to teams
        </Link>
        <button
          type="button"
          onClick={handleUnfollow}
          style={destructiveButtonStyle}
        >
          Unfollow this team
        </button>
      </div>
    </section>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={toggleRowStyle}>
      <span style={{ flex: 1 }}>
        <span style={toggleLabelStyle}>{label}</span>
        {hint ? <span style={toggleHintStyle}>{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: SPORTS_ACCENT, width: 18, height: 18 }}
      />
    </label>
  );
}

function GameRow({ game, teamId }: { game: Game; teamId: string }) {
  const isHome = game.home.id === teamId;
  const opponent = isHome ? game.away : game.home;
  const date = new Date(game.startAt);
  const dateLabel = date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeLabel = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const statusLabel =
    game.status === 'live'
      ? game.period ?? 'Live'
      : game.status === 'final'
        ? 'Final'
        : timeLabel;
  const scoreLabel =
    game.status === 'scheduled'
      ? null
      : `${game.away.score ?? '—'} – ${game.home.score ?? '—'}`;
  return (
    <Link
      href={`/sports/game/${encodeURIComponent(game.id)}?league=${game.league}`}
      style={gameRowStyle}
    >
      <span style={gameRowTopStyle}>
        <span style={gameOpponentStyle}>
          {isHome ? 'vs ' : '@ '}
          {opponent.name}
        </span>
        <span style={gameStatusStyle}>{statusLabel}</span>
      </span>
      <span style={gameRowBottomStyle}>
        <span style={gameDateStyle}>{dateLabel}</span>
        {scoreLabel ? (
          <span style={gameScoreStyle}>{scoreLabel}</span>
        ) : null}
      </span>
    </Link>
  );
}

function PlaceholderRow({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={placeholderRowStyle}>
      <div style={placeholderLabelStyle}>{label}</div>
      <div style={placeholderHintStyle}>{hint}</div>
    </div>
  );
}

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 12,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--text)',
};

const captionStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 12,
};

const tierRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 14,
  borderRadius: 14,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
};

const tierRowActiveStyle: CSSProperties = {
  ...tierRowStyle,
  borderColor: SPORTS_ACCENT,
};

const tierLabelStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 15,
  fontWeight: 700,
};

const tierSubtitleStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 12,
  marginTop: 2,
};

const tierDotStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 18,
};

const tierDotActiveStyle: CSSProperties = {
  ...tierDotStyle,
  color: SPORTS_ACCENT,
};

const toggleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 14,
  borderRadius: 14,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  cursor: 'pointer',
};

const toggleLabelStyle: CSSProperties = {
  display: 'block',
  color: 'var(--text)',
  fontSize: 14,
  fontWeight: 600,
};

const toggleHintStyle: CSSProperties = {
  display: 'block',
  color: 'var(--text-secondary)',
  fontSize: 12,
  marginTop: 2,
};

const placeholderListStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
};

const placeholderRowStyle: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: 'var(--surface)',
  border: '1px dashed var(--border)',
};

const placeholderLabelStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 14,
  fontWeight: 700,
};

const placeholderHintStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 12,
  marginTop: 2,
};

const footerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 12,
};

const secondaryLinkStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 600,
};

const destructiveButtonStyle: CSSProperties = {
  padding: '10px 16px',
  borderRadius: 12,
  background: 'transparent',
  border: '1px solid #7F1D1D',
  color: '#F87171',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const heroRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const heroLogoStyle: CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 12,
  background: 'rgba(255,255,255,0.08)',
  objectFit: 'contain',
};

const scheduleGroupHeaderStyle: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
};

const seasonHistoryLinkStyle: CSSProperties = {
  marginTop: 8,
  color: SPORTS_ACCENT,
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
};

const gameRowStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 14,
  borderRadius: 14,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  textDecoration: 'none',
};

const gameRowTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
};

const gameRowBottomStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
};

const gameOpponentStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 15,
  fontWeight: 700,
  flex: 1,
  marginRight: 8,
};

const gameStatusStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 700,
};

const gameDateStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 12,
};

const gameScoreStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 14,
  fontWeight: 800,
};

const recordBadgeStyle: CSSProperties = {
  display: 'inline-block',
  marginTop: 10,
  padding: '6px 12px',
  borderRadius: 999,
  background: 'rgba(22,163,74,0.08)',
  border: `1px solid ${SPORTS_ACCENT}`,
  color: SPORTS_ACCENT,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.03em',
};
