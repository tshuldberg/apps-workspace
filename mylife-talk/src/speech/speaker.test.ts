import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '../config.js';
import { Speaker, type SpawnLike } from './speaker.js';

interface FakeProcess {
  exit(): void;
  killed: boolean;
  on(event: 'exit', callback: () => void): void;
  kill(): void;
}

function fakeProcess(): FakeProcess {
  let onExit = (): void => undefined;
  return {
    killed: false,
    on(_event, callback) {
      onExit = callback;
    },
    kill() {
      this.killed = true;
    },
    exit() {
      onExit();
    },
  };
}

describe('Speaker', () => {
  it('queues speech sequentially', () => {
    const children: FakeProcess[] = [];
    const spawn: SpawnLike = vi.fn(() => {
      const child = fakeProcess();
      children.push(child);
      return child;
    });
    const speaker = new Speaker(DEFAULT_SETTINGS, spawn);

    speaker.say('first');
    speaker.say('second');
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(speaker.speaking).toBe(true);
    children[0]?.exit();
    expect(spawn).toHaveBeenCalledTimes(2);
    children[1]?.exit();
    expect(speaker.speaking).toBe(false);
  });

  it('interrupts current speech and clears the old queue', () => {
    const children: FakeProcess[] = [];
    const spawn: SpawnLike = vi.fn(() => {
      const child = fakeProcess();
      children.push(child);
      return child;
    });
    const speaker = new Speaker(DEFAULT_SETTINGS, spawn);

    speaker.say('first');
    speaker.say('never spoken');
    speaker.say('replacement', { interrupt: true });

    expect(children[0]?.killed).toBe(true);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect((spawn as ReturnType<typeof vi.fn>).mock.calls[1]?.[1]).toContain('replacement');
  });

  it('sanitizes speech and passes configured voice and rate', () => {
    const spawn = vi.fn<SpawnLike>(() => fakeProcess());
    const speaker = new Speaker({ ...DEFAULT_SETTINGS, voice: 'Alex', rate: 210 }, spawn);

    speaker.say(' **hello**\n`src/file.ts` and_some ');

    expect(spawn).toHaveBeenCalledWith('say', [
      '-v',
      'Alex',
      '-r',
      '210',
      'hello src/file.ts andsome',
    ]);
  });

  it('caps long speech and appends a truncation marker', () => {
    const spawn = vi.fn<SpawnLike>(() => fakeProcess());
    const speaker = new Speaker(DEFAULT_SETTINGS, spawn);

    speaker.say('x'.repeat(1300));

    const spoken = spawn.mock.calls[0]?.[1][4];
    expect(spoken).toBe(`${'x'.repeat(1200)} ...truncated`);
  });
});
