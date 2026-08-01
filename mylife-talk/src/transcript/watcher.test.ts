import { appendFileSync, closeSync, mkdtempSync, openSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SessionEvent } from '../types.js';
import { TranscriptWatcher } from './watcher.js';

const tempDirs: string[] = [];

function fixture(): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), 'mylife-talk-watcher-'));
  const file = join(dir, 'session.jsonl');
  writeFileSync(file, '');
  tempDirs.push(dir);
  return { dir, file };
}

function watcher(file: string, fromStart = false): TranscriptWatcher {
  return new TranscriptWatcher(
    file,
    { statSync, openSync, readSync, closeSync },
    { pollMs: 20, fromStart },
  );
}

function userLine(text: string): string {
  return `${JSON.stringify({ type: 'user', message: { content: text } })}\n`;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('TranscriptWatcher', () => {
  it('emits events from appended complete lines', async () => {
    const { file } = fixture();
    const subject = watcher(file);
    const events: SessionEvent[] = [];
    subject.on('event', (event) => events.push(event));
    subject.start();

    appendFileSync(file, userLine('one') + userLine('two'));

    await vi.waitFor(() => expect(events).toEqual([
      { kind: 'user-text', text: 'one' },
      { kind: 'user-text', text: 'two' },
    ]));
    subject.stop();
  });

  it('buffers a partial trailing line', async () => {
    const { file } = fixture();
    const subject = watcher(file);
    const events: SessionEvent[] = [];
    subject.on('event', (event) => events.push(event));
    subject.start();
    const complete = userLine('assembled');

    appendFileSync(file, complete.slice(0, 18));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(events).toEqual([]);
    appendFileSync(file, complete.slice(18));

    await vi.waitFor(() =>
      expect(events).toEqual([{ kind: 'user-text', text: 'assembled' }]),
    );
    subject.stop();
  });

  it('skips content that existed before start', async () => {
    const { file } = fixture();
    writeFileSync(file, userLine('old'));
    const subject = watcher(file);
    const events: SessionEvent[] = [];
    subject.on('event', (event) => events.push(event));
    subject.start();
    appendFileSync(file, userLine('new'));

    await vi.waitFor(() =>
      expect(events).toEqual([{ kind: 'user-text', text: 'new' }]),
    );
    subject.stop();
  });

  it('reads pre-existing content when fromStart is true', async () => {
    const { file } = fixture();
    writeFileSync(file, userLine('existing'));
    const subject = watcher(file, true);
    const events: SessionEvent[] = [];
    subject.on('event', (event) => events.push(event));
    subject.start();

    await vi.waitFor(() =>
      expect(events).toEqual([{ kind: 'user-text', text: 'existing' }]),
    );
    subject.stop();
  });

  it('resets to the beginning after truncation', async () => {
    const { file } = fixture();
    writeFileSync(file, `${userLine('padding')}${' '.repeat(200)}`);
    const subject = watcher(file);
    const events: SessionEvent[] = [];
    subject.on('event', (event) => events.push(event));
    subject.start();
    writeFileSync(file, userLine('replacement'));

    await vi.waitFor(() =>
      expect(events).toEqual([{ kind: 'user-text', text: 'replacement' }]),
    );
    subject.stop();
  });
});
