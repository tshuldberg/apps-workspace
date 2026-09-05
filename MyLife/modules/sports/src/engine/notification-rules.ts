/**
 * Pure-logic rule engine that converts a (team, prevGame, nextGame)
 * tuple into a set of NotificationIntent values. Zero platform imports,
 * zero fetch, zero storage access -- this file is 100% unit-testable.
 *
 * The dispatcher (`notification-dispatcher.ts`) owns expo-notifications
 * + sp_notifications_log writes. Keep this file side-effect free.
 */

import type { Game, LeagueId, Team } from '../types';
import type { NotificationEventType } from '../db/crud/notifications-log';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A decision emitted by the rule engine. The dispatcher turns these
 * into actual expo-notifications calls + sp_notifications_log writes.
 */
export interface NotificationIntent {
  teamId: string;
  gameId: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
}

export interface DecideNotificationsArgs {
  team: Team;
  /** The cached game row prior to the current upsert. May be null on first sighting. */
  prevGame?: Game | null;
  /** The fresh game row just upserted. */
  nextGame: Game;
}

// ---------------------------------------------------------------------------
// Close-game thresholds -- exported for tests
// ---------------------------------------------------------------------------

export interface CloseGameThreshold {
  /** Max absolute score differential that still counts as "close". */
  marginAtMost: number;
  /** Substring (case-insensitive) the `period` field must contain, or null to skip. */
  periodIncludes: string | null;
  /** Max seconds on the game clock, or null to skip the clock check. */
  clockMaxSeconds: number | null;
}

export const CLOSE_GAME_THRESHOLDS: Record<LeagueId, CloseGameThreshold> = {
  nfl: { marginAtMost: 8, periodIncludes: 'q4', clockMaxSeconds: 5 * 60 },
  nba: { marginAtMost: 6, periodIncludes: 'q4', clockMaxSeconds: 3 * 60 },
  mlb: { marginAtMost: 2, periodIncludes: '9', clockMaxSeconds: null },
  nhl: { marginAtMost: 1, periodIncludes: '3rd', clockMaxSeconds: 5 * 60 },
  mls: { marginAtMost: 1, periodIncludes: null, clockMaxSeconds: null },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clockToSeconds(clock: string | null | undefined): number | null {
  if (!clock) return null;
  const m = clock.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const minutes = Number(m[1]);
  const seconds = Number(m[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

function normPeriod(period: string | null | undefined): string {
  return (period ?? '').toLowerCase();
}

function bothScoresKnown(g: Game): boolean {
  return (
    typeof g.home.score === 'number' &&
    typeof g.away.score === 'number'
  );
}

function margin(g: Game): number {
  const h = g.home.score ?? 0;
  const a = g.away.score ?? 0;
  return Math.abs(h - a);
}

function isRivalTeamSide(team: Team, g: Game): 'home' | 'away' | null {
  if (g.home.id && g.home.id === team.id) return 'home';
  if (g.away.id && g.away.id === team.id) return 'away';
  return null;
}

function opposingScore(side: 'home' | 'away', g: Game): number {
  return side === 'home' ? g.away.score ?? 0 : g.home.score ?? 0;
}

function teamScore(side: 'home' | 'away', g: Game): number {
  return side === 'home' ? g.home.score ?? 0 : g.away.score ?? 0;
}

function isMlsLate(periodLc: string): boolean {
  // MLS "80+" uses minute markers like "85'" or "Minute 82".
  const m = periodLc.match(/(\d{2,3})/);
  if (!m) return false;
  const minute = Number(m[1]);
  return Number.isFinite(minute) && minute >= 80;
}

/** Returns true when the game is live + scores are tight per-league. */
export function isCloseGame(g: Game): boolean {
  if (g.status !== 'live') return false;
  if (!bothScoresKnown(g)) return false;
  const league = g.league as LeagueId;
  const threshold = CLOSE_GAME_THRESHOLDS[league];
  if (!threshold) return false;
  if (margin(g) > threshold.marginAtMost) return false;

  const periodLc = normPeriod(g.period);

  if (league === 'mls') {
    return isMlsLate(periodLc);
  }

  if (threshold.periodIncludes && !periodLc.includes(threshold.periodIncludes)) {
    return false;
  }

  if (threshold.clockMaxSeconds !== null) {
    const secs = clockToSeconds(g.clock);
    if (secs === null) return false;
    if (secs > threshold.clockMaxSeconds) return false;
  }
  return true;
}

/** Returns true when a live game has crossed into an OT/extra period. */
export function isOvertime(g: Game): boolean {
  if (g.status !== 'live') return false;
  const p = normPeriod(g.period);
  // Catch NBA/NHL "OT", NFL "Overtime", MLB "10th"+ innings, soccer "ET"/"Extra".
  if (p.includes('ot') || p.includes('overtime') || p.includes('extra') || p.includes('et')) {
    return true;
  }
  // MLB extra innings: a number >= 10 in the period string.
  if (g.league === 'mlb') {
    const m = p.match(/(\d{1,2})/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 10) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Decider
// ---------------------------------------------------------------------------

/**
 * Return zero or more NotificationIntents for the given state transition.
 *
 * - `start` fires when a game flips from scheduled -> live (once).
 * - `final` fires when a game flips live -> final (once).
 * - `close` fires when an already-live game meets per-league tightness.
 * - `overtime` fires when an already-live game has entered OT.
 * - `rival_loss` fires at the final for a rival team when they lost.
 *
 * Dedupe across polls is the dispatcher's job via
 * `recordNotification(... INSERT OR IGNORE ...)`. This function may emit
 * the same intent on back-to-back calls; the dedupe primitive swallows it.
 */
export function decideNotifications(
  args: DecideNotificationsArgs,
): NotificationIntent[] {
  const { team, nextGame, prevGame } = args;
  const out: NotificationIntent[] = [];

  const side = isRivalTeamSide(team, nextGame);
  // If the team isn't a participant in this game, emit nothing.
  if (side === null) return out;

  const teamName = team.name;
  const opp = side === 'home' ? nextGame.away.name : nextGame.home.name;
  const ts = (side === 'home' ? nextGame.home.score : nextGame.away.score) ?? 0;
  const os = opposingScore(side, nextGame);

  // start -- scheduled -> live transition
  if (team.notify_start === 1) {
    const flipped =
      prevGame === undefined || prevGame === null
        ? nextGame.status === 'live'
        : prevGame.status === 'scheduled' && nextGame.status === 'live';
    if (flipped) {
      out.push({
        teamId: team.id,
        gameId: nextGame.id,
        eventType: 'start',
        title: `${teamName} is playing`,
        body: `vs ${opp} -- live now.`,
      });
    }
  }

  // final -- -> final transition
  if (team.notify_end === 1) {
    const flipped =
      prevGame === undefined || prevGame === null
        ? nextGame.status === 'final'
        : prevGame.status !== 'final' && nextGame.status === 'final';
    if (flipped) {
      const won = teamScore(side, nextGame) > os;
      const result = won ? 'Win' : teamScore(side, nextGame) === os ? 'Draw' : 'Loss';
      out.push({
        teamId: team.id,
        gameId: nextGame.id,
        eventType: 'final',
        title: `${teamName} -- ${result}`,
        body: `${teamName} ${ts} ${opp} ${os} (Final)`,
      });
    }
  }

  // close -- only while live
  if (team.notify_close === 1 && isCloseGame(nextGame)) {
    out.push({
      teamId: team.id,
      gameId: nextGame.id,
      eventType: 'close',
      title: `${teamName} in a close one`,
      body: `${teamName} ${ts} ${opp} ${os} -- ${nextGame.period ?? 'Live'}`,
    });
  }

  // overtime -- only while live
  if (team.notify_end === 1 && isOvertime(nextGame)) {
    out.push({
      teamId: team.id,
      gameId: nextGame.id,
      eventType: 'overtime',
      title: `${teamName} in overtime`,
      body: `${teamName} ${ts} ${opp} ${os} -- ${nextGame.period ?? 'OT'}`,
    });
  }

  // rival_loss -- on final transition only, for rival teams, when they lost
  if (team.is_rival === 1) {
    const flipped =
      prevGame === undefined || prevGame === null
        ? nextGame.status === 'final'
        : prevGame.status !== 'final' && nextGame.status === 'final';
    const lost = teamScore(side, nextGame) < os;
    if (flipped && lost) {
      out.push({
        teamId: team.id,
        gameId: nextGame.id,
        eventType: 'rival_loss',
        title: `Rival loss: ${teamName}`,
        body: `${teamName} ${ts} ${opp} ${os} (Final)`,
      });
    }
  }

  return out;
}
