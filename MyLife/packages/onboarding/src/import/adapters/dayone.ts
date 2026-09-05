/**
 * Day One JSON import adapter.
 *
 * Imports journal entries from Day One ($34.99/yr) into MyJournal (free).
 * Day One exports a JSON file containing an "entries" array with rich
 * metadata including text, tags, location, weather, and photo references.
 */

import type {
  ImportAdapter,
  FormatDetection,
  ParsedRecord,
  ImportValidationError,
  ImportResult,
  ImportProgress,
} from '../types';

// ---------------------------------------------------------------------------
// Source record (parsed from Day One JSON)
// ---------------------------------------------------------------------------

export interface DayOneSourceRecord {
  creationDate: string;
  modifiedDate: string | null;
  text: string;
  tags: string[];
  photos: DayOnePhoto[];
  location: DayOneLocation | null;
  weather: DayOneWeather | null;
  starred: boolean;
  uuid: string;
}

export interface DayOnePhoto {
  identifier: string;
  md5: string;
  type: string;
  filename: string | null;
}

export interface DayOneLocation {
  latitude: number;
  longitude: number;
  placeName: string | null;
  localityName: string | null;
  country: string | null;
}

export interface DayOneWeather {
  conditionsDescription: string | null;
  temperatureCelsius: number | null;
}

// ---------------------------------------------------------------------------
// Target record (ready for jn_ tables)
// ---------------------------------------------------------------------------

export interface JournalImportRecord {
  entryDate: string;
  title: string | null;
  body: string;
  tags: string[];
  mood: string | null;
  imageUris: string[];
  wordCount: number;
  sourceId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Extract a title from the first line if it looks like a heading. */
function extractTitle(text: string): { title: string | null; body: string } {
  const lines = text.split('\n');
  const firstLine = lines[0]?.trim() ?? '';

  // Day One markdown: # Heading or a short first line (< 80 chars) followed by blank line
  if (firstLine.startsWith('# ')) {
    return {
      title: firstLine.slice(2).trim(),
      body: lines.slice(1).join('\n').trim(),
    };
  }

  if (firstLine.length > 0 && firstLine.length <= 80 && lines[1]?.trim() === '') {
    return {
      title: firstLine,
      body: lines.slice(2).join('\n').trim(),
    };
  }

  return { title: null, body: text };
}

/** Map Day One weather conditions to journal mood (best effort). */
function inferMoodFromWeather(weather: DayOneWeather | null): string | null {
  if (!weather?.conditionsDescription) return null;
  const desc = weather.conditionsDescription.toLowerCase();
  if (desc.includes('sunny') || desc.includes('clear')) return 'great';
  if (desc.includes('partly') || desc.includes('fair')) return 'good';
  if (desc.includes('cloudy') || desc.includes('overcast')) return 'okay';
  if (desc.includes('rain') || desc.includes('storm') || desc.includes('snow')) return 'low';
  return null;
}

/** Normalize Day One date to ISO 8601 date string (YYYY-MM-DD). */
function normalizeDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().slice(0, 10);
}

/** Normalize Day One date to full ISO 8601 timestamp. */
function normalizeTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString();
}

/** Build location string from Day One location object. */
function formatLocation(loc: DayOneLocation | null): string | null {
  if (!loc) return null;
  const parts: string[] = [];
  if (loc.placeName) parts.push(loc.placeName);
  if (loc.localityName) parts.push(loc.localityName);
  if (loc.country) parts.push(loc.country);
  return parts.length > 0 ? parts.join(', ') : null;
}

/** Build photo URIs from Day One photo references. */
function buildPhotoUris(photos: DayOnePhoto[]): string[] {
  return photos.map((p) => {
    // Day One exports photos in a sibling "photos" folder with the identifier as filename
    if (p.filename) return `dayone://photos/${p.filename}`;
    return `dayone://photos/${p.identifier}.${p.type || 'jpeg'}`;
  });
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const dayOneAdapter: ImportAdapter<DayOneSourceRecord, JournalImportRecord> = {
  name: 'dayone-json',
  sourceApp: 'Day One',
  targetModule: 'journal',
  supportedExtensions: ['.json'],

  detectFormat(content: string, fileName?: string): FormatDetection {
    try {
      const data = JSON.parse(content);

      // Day One exports have a top-level "entries" array
      if (!data || typeof data !== 'object' || !Array.isArray(data.entries)) {
        return { detected: false, confidence: 0, reason: 'No "entries" array in JSON root' };
      }

      if (data.entries.length === 0) {
        // Empty entries array -- could be Day One but no data
        const fileBoost = fileName?.toLowerCase().includes('dayone') ? 0.2 : 0;
        return {
          detected: true,
          confidence: 0.4 + fileBoost,
          reason: 'Has "entries" array but no entries to verify structure',
        };
      }

      // Check first entry for Day One signature fields
      const first = data.entries[0];
      const hasCreationDate = typeof first.creationDate === 'string';
      const hasText = typeof first.text === 'string';
      const hasUUID = typeof first.uuid === 'string';

      if (!hasCreationDate) {
        return { detected: false, confidence: 0, reason: 'First entry missing "creationDate"' };
      }

      let confidence = 0.6;
      if (hasText) confidence += 0.15;
      if (hasUUID) confidence += 0.15;
      if (Array.isArray(first.tags)) confidence += 0.05;
      if (first.weather != null) confidence += 0.05;

      const fileBoost = fileName?.toLowerCase().includes('dayone') ? 0.05 : 0;
      confidence = Math.min(1.0, confidence + fileBoost);

      return {
        detected: true,
        confidence,
        reason: `Day One JSON: entries[${data.entries.length}], creationDate=${hasCreationDate}, text=${hasText}, uuid=${hasUUID}`,
      };
    } catch {
      return { detected: false, confidence: 0, reason: 'Invalid JSON' };
    }
  },

  parse(content: string): ParsedRecord<DayOneSourceRecord>[] {
    let data: { entries: unknown[] };
    try {
      data = JSON.parse(content);
    } catch {
      return [];
    }

    if (!data?.entries || !Array.isArray(data.entries)) return [];

    const records: ParsedRecord<DayOneSourceRecord>[] = [];

    for (let i = 0; i < data.entries.length; i++) {
      const raw = data.entries[i] as Record<string, unknown>;
      const warnings: string[] = [];

      const photos: DayOnePhoto[] = [];
      if (Array.isArray(raw.photos)) {
        for (const p of raw.photos) {
          const photo = p as Record<string, unknown>;
          photos.push({
            identifier: String(photo.identifier ?? ''),
            md5: String(photo.md5 ?? ''),
            type: String(photo.type ?? 'jpeg'),
            filename: photo.filename ? String(photo.filename) : null,
          });
        }
      }

      let location: DayOneLocation | null = null;
      if (raw.location && typeof raw.location === 'object') {
        const loc = raw.location as Record<string, unknown>;
        location = {
          latitude: Number(loc.latitude ?? 0),
          longitude: Number(loc.longitude ?? 0),
          placeName: loc.placeName ? String(loc.placeName) : null,
          localityName: loc.localityName ? String(loc.localityName) : null,
          country: loc.country ? String(loc.country) : null,
        };
      }

      let weather: DayOneWeather | null = null;
      if (raw.weather && typeof raw.weather === 'object') {
        const w = raw.weather as Record<string, unknown>;
        weather = {
          conditionsDescription: w.conditionsDescription ? String(w.conditionsDescription) : null,
          temperatureCelsius: typeof w.temperatureCelsius === 'number' ? w.temperatureCelsius : null,
        };
      }

      const text = typeof raw.text === 'string' ? raw.text : '';
      if (!text) warnings.push('Entry has empty text');

      const tags = Array.isArray(raw.tags)
        ? (raw.tags as unknown[]).map(String).filter(Boolean)
        : [];

      records.push({
        rowNumber: i + 1,
        data: {
          creationDate: String(raw.creationDate ?? ''),
          modifiedDate: raw.modifiedDate ? String(raw.modifiedDate) : null,
          text,
          tags,
          photos,
          location,
          weather,
          starred: raw.starred === true,
          uuid: String(raw.uuid ?? `entry-${i}`),
        },
        warnings,
      });
    }

    return records;
  },

  validate(records: ParsedRecord<DayOneSourceRecord>[]): {
    valid: ParsedRecord<DayOneSourceRecord>[];
    errors: ImportValidationError[];
  } {
    const valid: ParsedRecord<DayOneSourceRecord>[] = [];
    const errors: ImportValidationError[] = [];

    for (const record of records) {
      const { data } = record;

      if (!data.text || data.text.trim().length === 0) {
        errors.push({
          row: record.rowNumber,
          field: 'text',
          message: 'Entry text is empty',
        });
        continue;
      }

      if (!data.creationDate) {
        errors.push({
          row: record.rowNumber,
          field: 'creationDate',
          message: 'Entry has no creation date',
        });
        continue;
      }

      const parsed = new Date(data.creationDate);
      if (isNaN(parsed.getTime())) {
        errors.push({
          row: record.rowNumber,
          field: 'creationDate',
          message: 'Invalid date format',
          value: data.creationDate,
        });
        continue;
      }

      valid.push(record);
    }

    return { valid, errors };
  },

  transform(records: ParsedRecord<DayOneSourceRecord>[]): ParsedRecord<JournalImportRecord>[] {
    return records.map((record) => {
      const { data } = record;
      const { title, body } = extractTitle(data.text);

      // Append location and weather as metadata at the end of body
      const metadataParts: string[] = [];
      const locationStr = formatLocation(data.location);
      if (locationStr) metadataParts.push(`Location: ${locationStr}`);
      if (data.weather?.conditionsDescription) {
        let weatherStr = data.weather.conditionsDescription;
        if (data.weather.temperatureCelsius != null) {
          weatherStr += ` (${Math.round(data.weather.temperatureCelsius)}\u00B0C)`;
        }
        metadataParts.push(`Weather: ${weatherStr}`);
      }

      const fullBody = metadataParts.length > 0
        ? `${body}\n\n---\n${metadataParts.join('\n')}`
        : body;

      const tags = [...data.tags];
      if (data.starred && !tags.includes('starred')) tags.push('starred');

      return {
        rowNumber: record.rowNumber,
        data: {
          entryDate: normalizeDate(data.creationDate),
          title,
          body: fullBody || data.text,
          tags,
          mood: inferMoodFromWeather(data.weather),
          imageUris: buildPhotoUris(data.photos),
          wordCount: countWords(fullBody || data.text),
          sourceId: data.uuid,
        },
        warnings: record.warnings,
      };
    });
  },

  import(
    db: unknown,
    records: ParsedRecord<JournalImportRecord>[],
    onProgress?: (progress: ImportProgress) => void,
  ): ImportResult {
    const startTime = Date.now();
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: ImportValidationError[] = [];

    const adapter = db as {
      execute(sql: string, params?: unknown[]): void;
      query<T>(sql: string, params?: unknown[]): T[];
    };

    // Ensure default journal exists
    const defaultJournals = adapter.query<{ id: string }>(
      `SELECT id FROM jn_journals WHERE is_default = 1 LIMIT 1`,
    );
    let journalId: string;
    if (defaultJournals.length > 0) {
      journalId = defaultJournals[0].id;
    } else {
      journalId = generateId();
      const now = new Date().toISOString();
      adapter.execute(
        `INSERT INTO jn_journals (id, name, description, color, is_default, created_at, updated_at)
         VALUES (?, 'Journal', 'Default journal', NULL, 1, ?, ?)`,
        [journalId, now, now],
      );
    }

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const entry = record.data;

      onProgress?.({
        phase: 'importing',
        current: i + 1,
        total: records.length,
        message: `Importing entry ${i + 1}/${records.length}`,
      });

      try {
        // Check for duplicate by source UUID in body or same date+title
        const isDuplicate = checkDuplicate(adapter, entry);
        if (isDuplicate) {
          skipped++;
          continue;
        }

        const entryId = generateId();
        const now = new Date().toISOString();

        adapter.execute(
          `INSERT INTO jn_entries (id, journal_id, entry_date, title, body, mood, image_uris_json, word_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entryId,
            journalId,
            entry.entryDate,
            entry.title,
            entry.body,
            entry.mood,
            JSON.stringify(entry.imageUris),
            entry.wordCount,
            now,
            now,
          ],
        );

        // Sync tags
        for (const tagName of entry.tags) {
          const normalized = tagName.trim().toLowerCase();
          if (!normalized) continue;

          // Get or create tag
          const existing = adapter.query<{ id: string }>(
            `SELECT id FROM jn_tags WHERE name = ?`,
            [normalized],
          );

          let tagId: string;
          if (existing.length > 0) {
            tagId = existing[0].id;
          } else {
            tagId = generateId();
            adapter.execute(
              `INSERT INTO jn_tags (id, name, created_at) VALUES (?, ?, ?)`,
              [tagId, normalized, now],
            );
          }

          adapter.execute(
            `INSERT OR IGNORE INTO jn_entry_tags (entry_id, tag_id, created_at) VALUES (?, ?, ?)`,
            [entryId, tagId, now],
          );
        }

        imported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('UNIQUE')) {
          skipped++;
        } else {
          failed++;
          errors.push({
            row: record.rowNumber,
            field: 'import',
            message,
          });
        }
      }
    }

    onProgress?.({
      phase: 'complete',
      current: records.length,
      total: records.length,
      message: `Import complete: ${imported} imported, ${skipped} skipped, ${failed} failed`,
    });

    return {
      adapterName: 'dayone-json',
      targetModule: 'journal',
      totalRows: records.length,
      imported,
      skipped,
      failed,
      errors,
      durationMs: Date.now() - startTime,
    };
  },
};

function checkDuplicate(
  db: { query<T>(sql: string, params?: unknown[]): T[] },
  entry: JournalImportRecord,
): boolean {
  // Check by entry_date + title (if title exists)
  if (entry.title) {
    const rows = db.query<{ id: string }>(
      `SELECT id FROM jn_entries WHERE entry_date = ? AND title = ?`,
      [entry.entryDate, entry.title],
    );
    if (rows.length > 0) return true;
  }

  // Check by entry_date + body prefix (first 100 chars)
  const bodyPrefix = entry.body.slice(0, 100);
  const rows = db.query<{ id: string }>(
    `SELECT id FROM jn_entries WHERE entry_date = ? AND body LIKE ?`,
    [entry.entryDate, bodyPrefix + '%'],
  );
  return rows.length > 0;
}

function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
