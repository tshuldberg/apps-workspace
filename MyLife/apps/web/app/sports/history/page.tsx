import { sportsGetHistory } from '../actions';
import { HistoryClient } from './HistoryClient';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;

interface PageProps {
  searchParams?: Promise<{ teamId?: string; range?: string }>;
}

export default async function SportsHistoryPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const teamId = typeof params.teamId === 'string' ? params.teamId : undefined;
  const rangeDays = parseRange(params.range);
  const now = Date.now();
  const since = now - rangeDays * DAY_MS;
  const data = await sportsGetHistory(since, now, teamId ? [teamId] : undefined);
  return (
    <HistoryClient
      initialGames={data.games}
      initialTeams={data.teams}
      initialRange={rangeDays}
      initialTeamId={teamId ?? null}
    />
  );
}

function parseRange(raw: unknown): number {
  if (typeof raw !== 'string') return DEFAULT_RANGE_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RANGE_DAYS;
  return Math.min(Math.floor(n), 365);
}
