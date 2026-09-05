import type { Venue } from '@mylife/sports';
import { sportsListVenues } from '../../actions';
import { LogAttendanceClient } from './LogAttendanceClient';

export const dynamic = 'force-dynamic';

export default async function SportsEventsLogPage(props: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await props.searchParams;
  const isWatchParty = mode === 'watch-party';
  const venuesResult = await sportsListVenues();
  const venues: Venue[] = venuesResult.ok ? venuesResult.venues : [];
  return (
    <LogAttendanceClient venues={venues} isWatchParty={isWatchParty} />
  );
}
