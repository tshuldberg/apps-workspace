import type { NormalizedEvent } from '../sources/types';
export interface Facet { axis: string; value: string; }

const CATEGORY_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/comedy|stand-?up|open mic/i, 'Comedy'],
  [/theater|theatre|broadway|play|musical/i, 'Theater'],
  [/concert|live music|\bdj\b|\bset\b|gig|band|festival|jazz|hip-?hop|techno|house/i, 'Music'],
  [/yoga|pilates|workshop|class|lesson|seminar|lecture/i, 'Education/Class'],
  [/gym|equinox|run club|workout/i, 'Education/Class'],
  [/dinner|tasting|pop-?up|brunch|food|drink|cocktail/i, 'Food & Drink'],
  [/party|nightlife|club|rave|warehouse/i, 'Nightlife/Social'],
  [/market|fair|flea|sample sale/i, 'Markets & Fairs'],
  [/exhibit|gallery|museum|art/i, 'Visual Arts/Exhibition'],
  [/film|screening|movie|cinema/i, 'Film/Screening'],
];

const PURPOSE_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/jam session/i, 'Jam Session'],
  [/open mic/i, 'Open Mic'],
  [/\bdj\b set|\bdj\b/i, 'DJ Set'],
  [/listening party|playback/i, 'Listening Party'],
  [/masterclass/i, 'Masterclass'],
  [/music theory/i, 'Music Theory'],
  [/music history/i, 'Music History'],
  [/luthier|instrument making|instrument-making/i, 'Instrument Making/Luthiery'],
  [/production|recording|studio session/i, 'Production/Recording'],
  [/workshop|lesson|class|teach/i, 'Class/Workshop'],
  [/festival/i, 'Festival'],
  [/screening/i, 'Screening'],
  [/talk|lecture|panel|q&a/i, 'Seminar/Talk'],
  [/party/i, 'Party'],
  [/concert|live/i, 'Live Performance'],
];

function firstMatch(text: string, rules: ReadonlyArray<readonly [RegExp, string]>): string | null {
  for (const [re, val] of rules) if (re.test(text)) return val;
  return null;
}

export function priceBucket(e: NormalizedEvent): string {
  if (e.isFree || e.priceMin === 0) return 'Free';
  const p = e.priceMin;
  if (p == null) return 'Unknown';
  if (p < 20) return 'Under $20';
  if (p < 50) return '$20-50';
  if (p < 100) return '$50-100';
  return '$100+';
}

export function timeBucket(startAt?: string, now?: string): string {
  if (!startAt) return 'Pick a Date';
  const day = startAt.slice(0, 10);
  const today = (now ?? startAt).slice(0, 10);
  if (day === today) return 'Tonight';
  return 'Upcoming';
}

export function classify(e: NormalizedEvent, now?: string): Facet[] {
  const text = [e.title, e.description, e.venueName, e.category].filter(Boolean).join(' ');
  const facets: Facet[] = [];
  const cat = e.category && /\S/.test(e.category) ? e.category : firstMatch(text, CATEGORY_RULES);
  if (cat) facets.push({ axis: 'category', value: cat });
  const purpose = firstMatch(text, PURPOSE_RULES);
  if (purpose) facets.push({ axis: 'format', value: purpose });
  facets.push({ axis: 'price', value: priceBucket(e) });
  facets.push({ axis: 'time', value: timeBucket(e.startAt, now) });
  for (const f of e.facets ?? []) facets.push(f);
  return facets;
}
