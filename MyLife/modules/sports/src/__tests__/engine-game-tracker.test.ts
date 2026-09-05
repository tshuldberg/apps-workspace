import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TIMELINE_FINAL_TTL_MS,
  TIMELINE_LIVE_TTL_MS,
  clearGameTimelineCache,
  fetchGameTimeline,
  pickTimelineTtl,
  type GameTimelineFetch,
} from '../engine/game-tracker';
import { isMajorEvent, type TimelineEvent } from '../types';

// ---------------------------------------------------------------------------
// Fixture builders. The ESPN summary response exposes plays in three shapes:
//   - top-level `plays[]` (NBA/MLB/NHL/MLS)
//   - nested `drives.previous[].plays[]` + `drives.current.plays[]` (NFL)
//   - `scoringPlays[]` fallback
// Each builder produces a payload in one of those shapes.
// ---------------------------------------------------------------------------

interface FixturePlay {
  id?: string | number;
  text: string;
  period?: number | string;
  clock?: string;
  teamId?: string;
  scoringPlay?: boolean;
  scoreValue?: number;
  homeScore?: number;
  awayScore?: number;
  typeText?: string;
}

interface FlatFixtureInput {
  gameId: string;
  homeId: string;
  awayId: string;
  plays: FixturePlay[];
}

function makePlay(p: FixturePlay) {
  return {
    id: p.id ?? undefined,
    text: p.text,
    period:
      typeof p.period === 'number'
        ? { number: p.period, displayValue: `${p.period}` }
        : p.period !== undefined
          ? { displayValue: p.period }
          : undefined,
    clock: p.clock ? { displayValue: p.clock } : undefined,
    team: p.teamId ? { id: p.teamId } : undefined,
    scoringPlay: p.scoringPlay,
    scoreValue: p.scoreValue,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    type: p.typeText ? { text: p.typeText } : undefined,
  };
}

function flatFixture(input: FlatFixtureInput): unknown {
  return {
    header: {
      id: input.gameId,
      competitions: [
        {
          competitors: [
            { homeAway: 'home', team: { id: input.homeId } },
            { homeAway: 'away', team: { id: input.awayId } },
          ],
        },
      ],
    },
    plays: input.plays.map(makePlay),
  };
}

function drivesFixture(input: FlatFixtureInput): unknown {
  // Split plays across one "previous" drive and a "current" drive to prove
  // the NFL flattening path works.
  const half = Math.floor(input.plays.length / 2);
  const previous = input.plays.slice(0, half).map(makePlay);
  const current = input.plays.slice(half).map(makePlay);
  return {
    header: {
      id: input.gameId,
      competitions: [
        {
          competitors: [
            { homeAway: 'home', team: { id: input.homeId } },
            { homeAway: 'away', team: { id: input.awayId } },
          ],
        },
      ],
    },
    drives: {
      previous: [{ plays: previous }],
      current: { plays: current },
    },
  };
}

function scoringOnlyFixture(input: FlatFixtureInput): unknown {
  return {
    header: {
      id: input.gameId,
      competitions: [
        {
          competitors: [
            { homeAway: 'home', team: { id: input.homeId } },
            { homeAway: 'away', team: { id: input.awayId } },
          ],
        },
      ],
    },
    scoringPlays: input.plays.map(makePlay),
  };
}

function makeFetch(
  fixtures: Partial<Record<string, unknown>>,
): GameTimelineFetch {
  return vi.fn(async (url: string) => {
    for (const key of Object.keys(fixtures)) {
      if (url.includes(`event=${key}`)) {
        return fixtures[key] as Awaited<ReturnType<GameTimelineFetch>>;
      }
    }
    return {};
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pickTimelineTtl', () => {
  it('uses a short TTL for live games', () => {
    expect(pickTimelineTtl('live')).toBe(TIMELINE_LIVE_TTL_MS);
  });

  it('uses the long TTL for scheduled and final games', () => {
    expect(pickTimelineTtl('scheduled')).toBe(TIMELINE_FINAL_TTL_MS);
    expect(pickTimelineTtl('final')).toBe(TIMELINE_FINAL_TTL_MS);
  });
});

describe('isMajorEvent', () => {
  const base: TimelineEvent = {
    id: '1',
    gameId: 'espn:nfl:1',
    period: 1,
    clock: null,
    team: 'home',
    type: 'other',
    scoreValue: null,
    description: 'x',
    isScoring: false,
    awayScoreAfter: null,
    homeScoreAfter: null,
  };

  it('returns true for score events', () => {
    expect(isMajorEvent({ ...base, type: 'score' })).toBe(true);
  });

  it('returns true for big_play events', () => {
    expect(isMajorEvent({ ...base, type: 'big_play' })).toBe(true);
  });

  it('returns false for penalty/substitution/period_boundary/timeout/other', () => {
    expect(isMajorEvent({ ...base, type: 'penalty' })).toBe(false);
    expect(isMajorEvent({ ...base, type: 'substitution' })).toBe(false);
    expect(isMajorEvent({ ...base, type: 'period_boundary' })).toBe(false);
    expect(isMajorEvent({ ...base, type: 'timeout' })).toBe(false);
    expect(isMajorEvent({ ...base, type: 'other' })).toBe(false);
  });
});

describe('fetchGameTimeline', () => {
  afterEach(() => {
    clearGameTimelineCache();
  });

  it('normalizes a flat NBA plays[] response into TimelineEvent rows', async () => {
    const fetchImpl = makeFetch({
      '700': flatFixture({
        gameId: '700',
        homeId: '13',
        awayId: '14',
        plays: [
          {
            id: 'p1',
            text: 'LeBron makes 3-pt shot',
            period: 1,
            clock: '11:30',
            teamId: '13',
            scoringPlay: true,
            scoreValue: 3,
            homeScore: 3,
            awayScore: 0,
          },
          {
            id: 'p2',
            text: 'Technical foul on Lakers',
            period: 1,
            clock: '10:12',
            teamId: '13',
          },
          {
            id: 'p3',
            text: 'Kawhi with a slam dunk',
            period: 1,
            clock: '9:55',
            teamId: '14',
            scoringPlay: true,
            scoreValue: 2,
            homeScore: 3,
            awayScore: 2,
          },
        ],
      }),
    });

    const events = await fetchGameTimeline({
      gameId: 'espn:nba:700',
      league: 'nba',
      status: 'live',
      fetchImpl,
    });
    expect(events).toHaveLength(3);
    // Newest-first ordering -- the last ESPN play should be events[0].
    expect(events[0]?.id).toBe('p3');
    expect(events[0]?.type).toBe('score');
    expect(events[0]?.team).toBe('away');
    expect(events[0]?.scoreValue).toBe(2);
    expect(events[0]?.isScoring).toBe(true);
    expect(events[1]?.type).toBe('penalty');
    expect(events[1]?.isScoring).toBe(false);
    expect(events[2]?.id).toBe('p1');
    expect(events[2]?.team).toBe('home');
    expect(events[2]?.description).toContain('3-pt');
    for (const ev of events) {
      expect(ev.gameId).toBe('espn:nba:700');
    }
  });

  it('flattens NFL drives.previous[].plays[] + drives.current.plays[]', async () => {
    const fetchImpl = makeFetch({
      '800': drivesFixture({
        gameId: '800',
        homeId: '6',
        awayId: '7',
        plays: [
          {
            id: 'd1',
            text: 'Prescott pass complete for 18 yards',
            period: 1,
            clock: '10:00',
            teamId: '6',
          },
          {
            id: 'd2',
            text: 'Prescott passes for a touchdown',
            period: 1,
            clock: '9:14',
            teamId: '6',
            scoringPlay: true,
            scoreValue: 7,
            homeScore: 7,
            awayScore: 0,
          },
          {
            id: 'd3',
            text: 'Hurts intercepted by Dallas',
            period: 2,
            clock: '14:22',
            teamId: '7',
          },
          {
            id: 'd4',
            text: 'Dallas timeout',
            period: 2,
            clock: '13:55',
            teamId: '6',
          },
        ],
      }),
    });

    const events = await fetchGameTimeline({
      gameId: 'espn:nfl:800',
      league: 'nfl',
      status: 'live',
      fetchImpl,
    });
    expect(events).toHaveLength(4);
    // Newest-first -- the "current" drive's last play leads.
    expect(events[0]?.id).toBe('d4');
    expect(events[0]?.type).toBe('timeout');
    // Interception is a big_play.
    expect(events[1]?.type).toBe('big_play');
    // Scoring play classification.
    const touchdown = events.find((e) => e.id === 'd2');
    expect(touchdown?.type).toBe('score');
    expect(touchdown?.isScoring).toBe(true);
    expect(touchdown?.homeScoreAfter).toBe(7);
  });

  it('falls back to scoringPlays[] when plays/drives are absent (MLS style)', async () => {
    const fetchImpl = makeFetch({
      '900': scoringOnlyFixture({
        gameId: '900',
        homeId: '21',
        awayId: '22',
        plays: [
          {
            id: 's1',
            text: 'Goal! Home side scores',
            period: 1,
            clock: "23'",
            teamId: '21',
            scoringPlay: true,
            scoreValue: 1,
            homeScore: 1,
            awayScore: 0,
          },
        ],
      }),
    });

    const events = await fetchGameTimeline({
      gameId: 'espn:mls:900',
      league: 'mls',
      status: 'live',
      fetchImpl,
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('score');
    expect(events[0]?.team).toBe('home');
  });

  it('returns [] when no plays are extractable', async () => {
    const fetchImpl: GameTimelineFetch = vi.fn(
      async () =>
        ({
          header: {
            id: '1',
            competitions: [
              {
                competitors: [
                  { homeAway: 'home' as const, team: { id: '13' } },
                  { homeAway: 'away' as const, team: { id: '14' } },
                ],
              },
            ],
          },
        }) as Awaited<ReturnType<GameTimelineFetch>>,
    );
    const events = await fetchGameTimeline({
      gameId: 'espn:nba:empty',
      league: 'nba',
      status: 'live',
      fetchImpl,
    });
    expect(events).toEqual([]);
  });

  it('caches with the short TTL for live games', async () => {
    const fetchImpl = makeFetch({
      '500': flatFixture({
        gameId: '500',
        homeId: '6',
        awayId: '7',
        plays: [{ id: 'p1', text: 'Touchdown', teamId: '6', scoringPlay: true }],
      }),
    });
    await fetchGameTimeline({
      gameId: 'espn:nfl:500',
      league: 'nfl',
      status: 'live',
      fetchImpl,
      now: 1_000,
    });
    await fetchGameTimeline({
      gameId: 'espn:nfl:500',
      league: 'nfl',
      status: 'live',
      fetchImpl,
      now: 1_000 + TIMELINE_LIVE_TTL_MS - 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await fetchGameTimeline({
      gameId: 'espn:nfl:500',
      league: 'nfl',
      status: 'live',
      fetchImpl,
      now: 1_000 + TIMELINE_LIVE_TTL_MS + 10,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('caches with the long TTL for final games (survives past the live TTL)', async () => {
    const fetchImpl = makeFetch({
      '600': flatFixture({
        gameId: '600',
        homeId: '6',
        awayId: '7',
        plays: [{ id: 'p1', text: 'Touchdown', teamId: '6', scoringPlay: true }],
      }),
    });
    await fetchGameTimeline({
      gameId: 'espn:nfl:600',
      league: 'nfl',
      status: 'final',
      fetchImpl,
      now: 10_000,
    });
    // Past the live TTL but inside the final TTL -- still cached.
    await fetchGameTimeline({
      gameId: 'espn:nfl:600',
      league: 'nfl',
      status: 'final',
      fetchImpl,
      now: 10_000 + TIMELINE_LIVE_TTL_MS + 1_000,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await fetchGameTimeline({
      gameId: 'espn:nfl:600',
      league: 'nfl',
      status: 'final',
      fetchImpl,
      now: 10_000 + TIMELINE_FINAL_TTL_MS + 1_000,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('propagates AbortSignal and rejects when aborted', async () => {
    const fetchImpl: GameTimelineFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    const controller = new AbortController();
    const pending = fetchGameTimeline({
      gameId: 'espn:nfl:400',
      league: 'nfl',
      status: 'live',
      fetchImpl,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow(/abort/i);
  });

  it('returns [] for an unknown league without calling fetch', async () => {
    const fetchImpl = vi.fn(async () => ({}));
    const events = await fetchGameTimeline({
      gameId: 'espn:xfl:1',
      league: 'xfl' as never,
      status: 'live',
      fetchImpl: fetchImpl as unknown as GameTimelineFetch,
    });
    expect(events).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('accepts a raw ESPN event id and builds the right URL', async () => {
    const fetchImpl = makeFetch({
      '901': flatFixture({
        gameId: '901',
        homeId: '1',
        awayId: '2',
        plays: [{ id: 'p1', text: 'Jump ball', teamId: '1' }],
      }),
    });
    await fetchGameTimeline({
      gameId: '901',
      league: 'nba',
      status: 'live',
      fetchImpl,
    });
    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string];
    expect(url).toContain('/basketball/nba/summary?event=901');
  });

  it('classifies period_boundary rows from text (halftime, end of quarter)', async () => {
    const fetchImpl = makeFetch({
      'pb': flatFixture({
        gameId: 'pb',
        homeId: '6',
        awayId: '7',
        plays: [
          { id: 'e1', text: 'End of the 1st Quarter', period: 1 },
          { id: 'e2', text: 'Halftime', period: 2 },
        ],
      }),
    });
    const events = await fetchGameTimeline({
      gameId: 'espn:nba:pb',
      league: 'nba',
      status: 'live',
      fetchImpl,
    });
    for (const ev of events) {
      expect(ev.type).toBe('period_boundary');
    }
  });

  it('leaves team null when ESPN play has no team id', async () => {
    const fetchImpl = makeFetch({
      'nt': flatFixture({
        gameId: 'nt',
        homeId: '6',
        awayId: '7',
        plays: [{ id: 'x', text: 'Official timeout', period: 1 }],
      }),
    });
    const events = await fetchGameTimeline({
      gameId: 'espn:nfl:nt',
      league: 'nfl',
      status: 'live',
      fetchImpl,
    });
    expect(events[0]?.team).toBeNull();
    expect(events[0]?.type).toBe('timeout');
  });
});
