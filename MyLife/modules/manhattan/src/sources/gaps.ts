import { type EventSourceAdapter, type GapReason, SourceGapError } from './types';

function gap(id: string, displayName: string, reason: GapReason, note: string, categories: string[]): EventSourceAdapter {
  return {
    id, displayName, tier: 'gap',
    coverage: { categories, ingestKinds: [], realtime: false },
    gapFlag: { reason, note },
    isAvailable: () => false,
    fetchEvents: async () => { throw new SourceGapError(id, reason, note); },
  };
}

export const gapAdapters: EventSourceAdapter[] = [
  gap('ticketmaster', 'Ticketmaster', 'tos_excluded', 'API terms exclude this use; coming with MyLife Tickets', ['Music', 'Comedy', 'Theater']),
  gap('resident_advisor', 'Resident Advisor', 'no_public_api', 'No public discovery API; coming with MyLife Tickets', ['Nightlife/Social', 'Music']),
  gap('dice', 'DICE', 'no_public_api', 'No public discovery API; coming with MyLife Tickets', ['Music', 'Nightlife/Social']),
  gap('posh', 'Posh', 'no_public_api', 'No public discovery API; coming with MyLife Tickets', ['Nightlife/Social']),
  gap('partiful', 'Partiful', 'no_public_api', 'No public discovery API; coming with MyLife Tickets', ['Nightlife/Social']),
  gap('equinox', 'Equinox', 'auth_required', 'Per-account schedules; capture via share or calendar', ['Education/Class']),
  gap('mylife_tickets', 'MyLife Tickets', 'planned_first_party', 'First-party ticketing module (planned)', ['Music', 'Comedy', 'Theater', 'Nightlife/Social']),
];
