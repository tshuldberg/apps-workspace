import { calculateWordCount } from '@mylife/voice';

export interface VoiceTranscriptionRow {
  id: string;
  text: string;
  durationSeconds: number;
  language: string | null;
  confidence: number | null;
  audioUri?: string | null;
  createdAt: string;
}

export interface VoiceNoteRow {
  id: string;
  title: string;
  transcriptionId: string | null;
  tags: string | null;
  isFavorite: boolean;
  createdAt: string;
}

export interface RecordingRow {
  id: string;
  transcriptionId: string | null;
  noteId: string | null;
  title: string;
  preview: string;
  durationSeconds: number;
  wordCount: number;
  language: string | null;
  confidence: number | null;
  audioUri: string | null;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  status: 'Transcribed' | 'Audio Only' | 'Note Only';
}

export function deriveTitle(text: string, fallback = 'Untitled recording'): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, 48);
}

export function splitTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function buildRecordingRows(
  transcriptions: VoiceTranscriptionRow[],
  notes: VoiceNoteRow[],
): RecordingRow[] {
  const notesByTranscription = new Map<string, VoiceNoteRow>();
  const orphanNotes: RecordingRow[] = [];

  for (const note of notes) {
    if (note.transcriptionId) {
      notesByTranscription.set(note.transcriptionId, note);
      continue;
    }

    orphanNotes.push({
      id: note.id,
      transcriptionId: null,
      noteId: note.id,
      title: note.title,
      preview: 'Standalone voice note',
      durationSeconds: 0,
      wordCount: 0,
      language: null,
      confidence: null,
      audioUri: null,
      tags: splitTags(note.tags),
      isFavorite: note.isFavorite,
      createdAt: note.createdAt,
      status: 'Note Only',
    });
  }

  const transcriptionRows = transcriptions.map((transcription) => {
    const note = notesByTranscription.get(transcription.id);
    return {
      id: transcription.id,
      transcriptionId: transcription.id,
      noteId: note?.id ?? null,
      title: note?.title ?? deriveTitle(transcription.text),
      preview: transcription.text.trim() || 'No transcript text yet',
      durationSeconds: transcription.durationSeconds,
      wordCount: calculateWordCount(transcription.text),
      language: transcription.language,
      confidence: transcription.confidence,
      audioUri: transcription.audioUri ?? null,
      tags: splitTags(note?.tags ?? null),
      isFavorite: note?.isFavorite ?? false,
      createdAt: transcription.createdAt,
      status: transcription.text.trim() ? 'Transcribed' : 'Audio Only',
    } satisfies RecordingRow;
  });

  return [...transcriptionRows, ...orphanNotes].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function matchesSearch(row: RecordingRow, query: string): boolean {
  const parsed = parseSearchQuery(query);
  const haystack = [row.title, row.preview, row.tags.join(' ')]
    .join(' ')
    .toLowerCase();

  if (parsed.exact.length > 0 && !parsed.exact.every((term) => haystack.includes(term))) {
    return false;
  }
  if (parsed.include.length > 0 && !parsed.include.every((term) => haystack.includes(term))) {
    return false;
  }
  if (parsed.exclude.some((term) => haystack.includes(term))) {
    return false;
  }

  return parsed.exact.length > 0 || parsed.include.length > 0 ? true : haystack.includes(query.toLowerCase());
}

export function parseSearchQuery(query: string) {
  const exact = Array.from(query.matchAll(/"([^"]+)"/g)).map((match) => match[1].toLowerCase());
  const exclude = Array.from(query.matchAll(/(?:^|\s)-([^\s"]+)/g)).map((match) => match[1].toLowerCase());

  const stripped = query
    .replace(/"([^"]+)"/g, ' ')
    .replace(/(?:^|\s)-([^\s"]+)/g, ' ')
    .trim();

  const include = stripped
    .split(/\s+/)
    .map((term) => term.toLowerCase())
    .filter(Boolean);

  return { exact, include, exclude };
}

export function buildExcerpt(text: string, query: string, radius = 54): string {
  const tokens = query
    .replace(/"([^"]+)"/g, '$1')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);

  if (!text.trim()) return 'No transcript text yet.';
  if (tokens.length === 0) return text.slice(0, 160) + (text.length > 160 ? '...' : '');

  const lower = text.toLowerCase();
  const firstMatch = tokens.find((token) => lower.includes(token));
  if (!firstMatch) return text.slice(0, 160) + (text.length > 160 ? '...' : '');

  const index = lower.indexOf(firstMatch);
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + firstMatch.length + radius);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}
