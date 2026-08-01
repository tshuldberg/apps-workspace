import { join } from 'node:path';

import type { BrainTurn } from './brain/prompts.js';

export interface VoiceLogEntry {
  at: string;
  who: 'founder' | 'copilot' | 'system';
  kind: 'utterance' | 'speech' | 'inject' | 'note';
  text: string;
}

export interface VoiceLogIo {
  mkdirSync(path: string, opts: { recursive: true }): unknown;
  appendFileSync(path: string, data: string): void;
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: 'utf8'): string;
}

function stamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export class VoiceLog {
  private file: string | null = null;

  constructor(
    private readonly dir: string,
    private readonly io: VoiceLogIo,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get path(): string | null {
    return this.file;
  }

  start(): void {
    this.io.mkdirSync(this.dir, { recursive: true });
    this.file = join(this.dir, `${stamp(this.now())}.jsonl`);
    this.append({ who: 'system', kind: 'note', text: 'session started' });
  }

  append(entry: Omit<VoiceLogEntry, 'at'>): void {
    if (this.file === null) return;
    const line: VoiceLogEntry = { at: this.now().toISOString(), ...entry };
    try {
      this.io.appendFileSync(this.file, `${JSON.stringify(line)}\n`);
    } catch {
      // a failing transcript write must never take down the conversation
    }
  }

  close(): void {
    this.append({ who: 'system', kind: 'note', text: 'session ended' });
    this.file = null;
  }
}

function parseEntry(line: string): VoiceLogEntry | null {
  try {
    const value = JSON.parse(line) as unknown;
    if (typeof value !== 'object' || value === null) return null;
    const entry = value as Record<string, unknown>;
    if (
      (entry.who === 'founder' || entry.who === 'copilot' || entry.who === 'system') &&
      typeof entry.text === 'string' &&
      typeof entry.kind === 'string' &&
      typeof entry.at === 'string'
    ) {
      return {
        at: entry.at,
        who: entry.who,
        kind: entry.kind as VoiceLogEntry['kind'],
        text: entry.text,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Seeds a new session's brain history from the most recent saved conversation,
// so the copilot remembers what you talked about last time.
export function loadRecentHistory(
  dir: string,
  io: Pick<VoiceLogIo, 'readdirSync' | 'readFileSync'>,
  maxTurns: number,
): BrainTurn[] {
  if (maxTurns <= 0) return [];
  let files: string[];
  try {
    files = io
      .readdirSync(dir)
      .filter((file) => file.endsWith('.jsonl'))
      .sort();
  } catch {
    return [];
  }
  const newest = files.at(-1);
  if (newest === undefined) return [];

  let contents: string;
  try {
    contents = io.readFileSync(join(dir, newest), 'utf8');
  } catch {
    return [];
  }

  const turns: BrainTurn[] = [];
  for (const line of contents.split('\n')) {
    if (line.trim() === '') continue;
    const entry = parseEntry(line);
    if (entry === null || entry.who === 'system') continue;
    turns.push({ who: entry.who, text: entry.text });
  }
  return turns.slice(-maxTurns);
}
