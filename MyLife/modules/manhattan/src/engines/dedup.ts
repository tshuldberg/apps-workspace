import type { NormalizedEvent } from '../sources/types';

export function dedupKey(e: { title: string; venueName?: string; startAt?: string }): string {
  const norm = (s?: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return [norm(e.title), norm(e.venueName), (e.startAt ?? '').slice(0, 10)].join('|');
}

export function dedupe(events: NormalizedEvent[]): NormalizedEvent[] {
  const seen = new Map<string, NormalizedEvent>();
  for (const e of events) {
    const k = dedupKey(e);
    if (!seen.has(k)) seen.set(k, e);
  }
  return [...seen.values()];
}
