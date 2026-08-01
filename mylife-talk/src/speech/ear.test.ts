import { spawn as nodeSpawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '../config.js';
import { Ear } from './ear.js';

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stdin = new PassThrough();
  readonly kill = vi.fn();
}

function spawnFixture(): {
  spawn: typeof nodeSpawn;
  children: FakeChild[];
  mock: ReturnType<typeof vi.fn>;
} {
  const children: FakeChild[] = [];
  const mock = vi.fn(() => {
    const child = new FakeChild();
    children.push(child);
    return child;
  });
  return { spawn: mock as unknown as typeof nodeSpawn, children, mock };
}

describe('Ear', () => {
  it('parses typed JSONL events and ignores malformed lines', () => {
    const fixture = spawnFixture();
    const ear = new Ear(DEFAULT_SETTINGS, '/fake/talk-ear', fixture.spawn);
    const partials: string[] = [];
    const finals: string[] = [];
    const ptt: string[] = [];
    const events: string[] = [];
    const statuses: string[] = [];
    const errors: Error[] = [];
    ear.on('event', (event) => events.push(event.type));
    ear.on('partial', (text) => partials.push(text));
    ear.on('final', (text) => finals.push(text));
    ear.on('ptt', (state) => ptt.push(state));
    ear.on('status', (message) => statuses.push(message));
    ear.on('error', (error) => errors.push(error));
    ear.start();

    fixture.children[0]?.stdout.write('{"type":"ready"}\n{"type":"partial","text":"hel');
    fixture.children[0]?.stdout.write(
      '"}\nnot json\n{"type":"final","text":"hello"}\n{"type":"ptt","state":"down"}\n{"type":"status","message":"listening"}\n{"type":"error","message":"permission denied"}\n',
    );

    expect(partials).toEqual(['hel']);
    expect(finals).toEqual(['hello']);
    expect(ptt).toEqual(['down']);
    expect(statuses).toEqual(['listening']);
    expect(errors[0]?.message).toBe('permission denied');
    expect(events).toEqual(['ready', 'partial', 'final', 'ptt', 'status', 'error']);
  });

  it('adds the push-to-talk argument only for that mode', () => {
    const fixture = spawnFixture();
    new Ear(
      { ...DEFAULT_SETTINGS, turnTaking: 'push-to-talk', pttKey: 'f13' },
      '/fake/talk-ear',
      fixture.spawn,
    ).start();

    expect(fixture.mock.mock.calls[0]?.[1]).toEqual([
      '--silence-ms',
      '1500',
      '--locale',
      'en-US',
      '--ptt-key',
      'f13',
    ]);
  });

  it('restarts at most three times in sixty seconds', () => {
    const fixture = spawnFixture();
    const ear = new Ear(DEFAULT_SETTINGS, '/fake/talk-ear', fixture.spawn);
    const errors: Error[] = [];
    ear.on('error', (error) => errors.push(error));
    ear.start();

    fixture.children[0]?.emit('exit', 1);
    fixture.children[1]?.emit('exit', 1);
    fixture.children[2]?.emit('exit', 1);
    expect(fixture.children).toHaveLength(4);
    fixture.children[3]?.emit('exit', 1);

    expect(fixture.children).toHaveLength(4);
    expect(errors.at(-1)?.message).toContain('3 restart attempts');
  });

  it('writes mute commands to child stdin and stops without restarting', () => {
    const fixture = spawnFixture();
    const ear = new Ear(DEFAULT_SETTINGS, '/fake/talk-ear', fixture.spawn);
    let input = '';
    ear.start();
    fixture.children[0]?.stdin.on('data', (chunk) => {
      input += chunk.toString();
    });

    ear.mute();
    ear.unmute();
    ear.stop();
    fixture.children[0]?.emit('exit', 0);

    expect(input).toBe('mute\nunmute\n');
    expect(fixture.children[0]?.kill).toHaveBeenCalledOnce();
    expect(fixture.children).toHaveLength(1);
  });
});
