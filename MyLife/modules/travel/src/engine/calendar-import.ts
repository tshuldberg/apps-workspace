// Calendar (iCal / RFC 5545) import engine.
// Pure functions. No I/O, no persistence.

export interface ImportedEvent {
  uid: string;
  title: string;
  startIso: string;
  endIso?: string;
  location?: string;
  description?: string;
}

export interface ActivitySuggestion {
  title: string;
  dateIso: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
}

function unfoldLines(icsText: string): string[] {
  const normalized = icsText.split('\r\n').join('\n').split('\r').join('\n');
  const rawLines = normalized.split('\n');
  const unfolded: string[] = [];
  for (const line of rawLines) {
    if (line.length === 0) {
      unfolded.push('');
      continue;
    }
    const first = line.charAt(0);
    if ((first === ' ' || first === '\t') && unfolded.length > 0) {
      unfolded[unfolded.length - 1] = unfolded[unfolded.length - 1] + line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

function unescapeText(value: string): string {
  return value
    .split('\\N').join('\n')
    .split('\\n').join('\n')
    .split('\\,').join(',')
    .split('\\;').join(';')
    .split('\\\\').join('\\');
}

function parseIcsDate(value: string, isDateOnly: boolean): string | null {
  const v = value.trim();
  if (!v) return null;

  if (isDateOnly || /^\d{8}$/.test(v)) {
    if (!/^\d{8}$/.test(v)) return null;
    const y = v.slice(0, 4);
    const m = v.slice(4, 6);
    const d = v.slice(6, 8);
    return y + '-' + m + '-' + d;
  }

  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, z] = match;
  const suffix = z === 'Z' ? 'Z' : '';
  return y + '-' + mo + '-' + d + 'T' + h + ':' + mi + ':' + s + suffix;
}

function parseProperty(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;
  const left = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const segments = left.split(';');
  const name = segments[0].toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < segments.length; i += 1) {
    const seg = segments[i];
    const eqIdx = seg.indexOf('=');
    if (eqIdx === -1) continue;
    const key = seg.slice(0, eqIdx).toUpperCase();
    const val = seg.slice(eqIdx + 1);
    params[key] = val;
  }
  return { name, params, value };
}

export function importIcs(icsText: string): ImportedEvent[] {
  if (typeof icsText !== 'string' || icsText.length === 0) return [];
  const lines = unfoldLines(icsText);

  const events: ImportedEvent[] = [];
  let inEvent = false;
  let current: Partial<ImportedEvent> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      if (inEvent && current.uid && current.title && current.startIso) {
        const ev: ImportedEvent = {
          uid: current.uid,
          title: current.title,
          startIso: current.startIso,
        };
        if (current.endIso) ev.endIso = current.endIso;
        if (current.location) ev.location = current.location;
        if (current.description) ev.description = current.description;
        events.push(ev);
      }
      inEvent = false;
      current = {};
      continue;
    }

    if (!inEvent) continue;

    const prop = parseProperty(line);
    if (!prop) continue;

    switch (prop.name) {
      case 'UID':
        current.uid = prop.value.trim();
        break;
      case 'SUMMARY':
        current.title = unescapeText(prop.value);
        break;
      case 'LOCATION':
        current.location = unescapeText(prop.value);
        break;
      case 'DESCRIPTION':
        current.description = unescapeText(prop.value);
        break;
      case 'DTSTART': {
        const isDateOnly = prop.params['VALUE'] === 'DATE';
        const iso = parseIcsDate(prop.value, isDateOnly);
        if (iso) current.startIso = iso;
        break;
      }
      case 'DTEND': {
        const isDateOnly = prop.params['VALUE'] === 'DATE';
        const iso = parseIcsDate(prop.value, isDateOnly);
        if (iso) current.endIso = iso;
        break;
      }
      default:
        break;
    }
  }

  return events;
}

function isoToDateKey(iso: string): string {
  if (iso.length >= 10 && iso.charAt(4) === '-' && iso.charAt(7) === '-') {
    return iso.slice(0, 10);
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function isoToTime(iso: string): string | undefined {
  if (iso.length >= 16 && iso.charAt(10) === 'T') {
    return iso.slice(11, 16);
  }
  return undefined;
}

export function eventsToActivitySuggestions(
  events: ImportedEvent[],
  tripStart: string,
  tripEnd: string,
): ActivitySuggestion[] {
  const startKey = tripStart.slice(0, 10);
  const endKey = tripEnd.slice(0, 10);
  const suggestions: ActivitySuggestion[] = [];
  for (const ev of events) {
    const dateKey = isoToDateKey(ev.startIso);
    if (dateKey < startKey || dateKey > endKey) continue;
    const s: ActivitySuggestion = {
      title: ev.title,
      dateIso: dateKey,
    };
    const startTime = isoToTime(ev.startIso);
    if (startTime) s.startTime = startTime;
    if (ev.endIso) {
      const endTime = isoToTime(ev.endIso);
      if (endTime) s.endTime = endTime;
    }
    if (ev.location) s.location = ev.location;
    if (ev.description) s.notes = ev.description;
    suggestions.push(s);
  }
  return suggestions;
}
