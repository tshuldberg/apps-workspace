import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import type { BrainContext } from './brain/prompts.js';
import { DEFAULT_SETTINGS } from './config.js';
import { Daemon } from './daemon.js';
import { Narrator } from './narrator.js';
import { TurnTaking } from './turntaking.js';
import type { BrainResult, SessionEvent } from './types.js';

class FakeEar extends EventEmitter {
  readonly start = vi.fn();
  readonly stop = vi.fn();
  readonly mute = vi.fn();
  readonly unmute = vi.fn();
}

class FakeSpeaker extends EventEmitter {
  readonly lines: Array<{ text: string; interrupt: boolean }> = [];
  readonly stop = vi.fn(() => {
    this.active = false;
  });
  private active = false;

  say(text: string, opts: { interrupt?: boolean } = {}): void {
    this.lines.push({ text, interrupt: opts.interrupt === true });
  }

  get speaking(): boolean {
    return this.active;
  }

  setSpeaking(value: boolean): void {
    this.active = value;
  }
}

class FakeWatcher extends EventEmitter {
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

describe('Daemon', () => {
  it('wires the full loop, narration, barge-in, and verbatim fallback', async () => {
    const ear = new FakeEar();
    const speaker = new FakeSpeaker();
    const watcher = new FakeWatcher();
    const injected: string[] = [];
    const settings = { ...DEFAULT_SETTINGS, verification: 'instant' as const };
    const brain = {
      ask: vi.fn(async (context: BrainContext): Promise<BrainResult | null> => {
        if (context.task === 'summarize-turn') {
          return { action: 'chat', speak: 'Claude finished cleanly.', prompt: null };
        }
        if (context.task === 'narrate-milestone') {
          return { action: 'chat', speak: 'Claude is running tests.', prompt: null };
        }
        if (context.utterance === 'Run the tests') {
          return { action: 'prompt', speak: null, prompt: 'Run pnpm test' };
        }
        return null;
      }),
    };
    const turnTaking = new TurnTaking(settings);
    const ui = { log: vi.fn(), status: vi.fn() };
    const daemon = new Daemon({
      settings,
      ear,
      speaker,
      watcher,
      brain,
      injector: async (prompt) => {
        injected.push(prompt);
      },
      narrator: new Narrator(settings.narration),
      turnTaking,
      ui,
      log: vi.fn(),
    });
    daemon.start();

    ear.emit('final', 'Run the tests');
    await vi.waitFor(() => expect(injected).toContain('Run pnpm test'));

    watcher.emit('event', {
      kind: 'tool-use',
      name: 'Bash',
      summary: 'pnpm test',
    } satisfies SessionEvent);
    watcher.emit('event', {
      kind: 'assistant-text',
      text: 'All tests passed.',
    } satisfies SessionEvent);
    watcher.emit('event', { kind: 'turn-end' } satisfies SessionEvent);
    await vi.waitFor(() =>
      expect(speaker.lines.map((line) => line.text)).toContain('Claude finished cleanly.'),
    );

    watcher.emit('event', {
      kind: 'question',
      text: 'Ship it?',
      options: ['Yes', 'No'],
    } satisfies SessionEvent);
    expect(speaker.lines.at(-1)).toEqual({
      text: 'Ship it? Options: Yes, No',
      interrupt: true,
    });

    ear.emit('final', 'Use the fallback');
    await vi.waitFor(() => expect(injected).toContain('Use the fallback'));
    expect(speaker.lines.map((line) => line.text)).toContain(
      'Codex is unreachable; sending your words as spoken.',
    );

    speaker.setSpeaking(true);
    ear.emit('partial', 'barge');
    expect(speaker.stop).toHaveBeenCalledOnce();

    daemon.stop();
    expect(ear.start).toHaveBeenCalledOnce();
    expect(watcher.start).toHaveBeenCalledOnce();
    expect(ear.stop).toHaveBeenCalledOnce();
    expect(watcher.stop).toHaveBeenCalledOnce();
  });
});
