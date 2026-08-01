import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { VoiceLog, loadRecentHistory } from './voicelog.js';

const io = { mkdirSync, appendFileSync, readdirSync, readFileSync };
let dir: string;

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function makeDir(): string {
  dir = mkdtempSync(join(tmpdir(), 'voicelog-'));
  return dir;
}

describe('VoiceLog', () => {
  it('writes a stamped jsonl transcript with start and end notes', () => {
    const base = join(makeDir(), 'transcripts');
    const log = new VoiceLog(base, io, () => new Date(2026, 7, 1, 9, 5, 3));
    log.start();
    log.append({ who: 'founder', kind: 'utterance', text: 'run the tests' });
    log.append({ who: 'copilot', kind: 'speech', text: 'Sending: run the tests' });
    log.close();

    expect(log.path).toBeNull();
    const files = readdirSync(base);
    expect(files).toEqual(['2026-08-01-090503.jsonl']);
    const lines = readFileSync(join(base, files[0] ?? ''), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { who: string; kind: string; text: string });
    expect(lines.map((line) => line.kind)).toEqual(['note', 'utterance', 'speech', 'note']);
    expect(lines[1]?.text).toBe('run the tests');
  });

  it('drops appends before start and never throws on write failure', () => {
    const base = join(makeDir(), 'transcripts');
    const log = new VoiceLog(base, io);
    expect(() => {
      log.append({ who: 'founder', kind: 'utterance', text: 'ignored' });
    }).not.toThrow();
    const failing = new VoiceLog(base, {
      ...io,
      appendFileSync: () => {
        throw new Error('disk full');
      },
    });
    failing.start();
    expect(() => {
      failing.append({ who: 'founder', kind: 'utterance', text: 'x' });
    }).not.toThrow();
  });
});

describe('loadRecentHistory', () => {
  it('loads founder and copilot turns from the newest transcript only', () => {
    const base = join(makeDir(), 'transcripts');
    mkdirSync(base, { recursive: true });
    writeFileSync(
      join(base, '2026-07-30-100000.jsonl'),
      `${JSON.stringify({ at: 'x', who: 'founder', kind: 'utterance', text: 'old session' })}\n`,
    );
    writeFileSync(
      join(base, '2026-08-01-090000.jsonl'),
      [
        JSON.stringify({ at: 'x', who: 'system', kind: 'note', text: 'session started' }),
        JSON.stringify({ at: 'x', who: 'founder', kind: 'utterance', text: 'fix the bug' }),
        'not json at all',
        JSON.stringify({ at: 'x', who: 'copilot', kind: 'speech', text: 'On it.' }),
        JSON.stringify({ at: 'x', who: 'system', kind: 'inject', text: 'fix the bug' }),
      ].join('\n'),
    );

    expect(loadRecentHistory(base, io, 10)).toEqual([
      { who: 'founder', text: 'fix the bug' },
      { who: 'copilot', text: 'On it.' },
    ]);
    expect(loadRecentHistory(base, io, 1)).toEqual([{ who: 'copilot', text: 'On it.' }]);
  });

  it('returns empty for a missing directory or zero budget', () => {
    expect(loadRecentHistory(join(makeDir(), 'nope'), io, 10)).toEqual([]);
    expect(loadRecentHistory(makeDir(), io, 0)).toEqual([]);
  });
});
