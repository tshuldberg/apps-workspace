import { EventEmitter } from 'node:events';
import { spawn as nodeSpawn } from 'node:child_process';

import type { Settings } from '../config.js';

export interface SpawnLike {
  (cmd: string, args: string[]): {
    on(event: 'exit', callback: () => void): void;
    kill(): void;
  };
}

interface SpeakingProcess {
  child: ReturnType<SpawnLike>;
}

function systemSpawn(cmd: string, args: string[]): ReturnType<SpawnLike> {
  const child = nodeSpawn(cmd, args);
  return {
    on(event, callback) {
      child.on(event, callback);
    },
    kill() {
      child.kill();
    },
  };
}

function sanitize(text: string): string {
  const cleaned = text.replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.length > 1200 ? `${cleaned.slice(0, 1200)} ...truncated` : cleaned;
}

export interface Speaker {
  on(event: 'speaking-start' | 'speaking-end', listener: () => void): this;
  emit(event: 'speaking-start' | 'speaking-end'): boolean;
}

export class Speaker extends EventEmitter {
  private queue: string[] = [];
  private current: SpeakingProcess | null = null;

  constructor(
    private readonly settings: Settings,
    private readonly spawn: SpawnLike = systemSpawn,
  ) {
    super();
  }

  say(text: string, opts: { interrupt?: boolean } = {}): void {
    if (opts.interrupt === true) this.stop();
    const cleaned = sanitize(text);
    if (cleaned === '') return;
    this.queue.push(cleaned);
    this.pump();
  }

  stop(): void {
    this.queue = [];
    const current = this.current;
    if (current === null) return;
    current.child.kill();
    if (this.current === current) {
      this.current = null;
      this.emit('speaking-end');
    }
  }

  get speaking(): boolean {
    return this.current !== null;
  }

  private pump(): void {
    if (this.current !== null) return;
    const text = this.queue.shift();
    if (text === undefined) return;

    const child = this.spawn('say', [
      '-v',
      this.settings.voice,
      '-r',
      String(this.settings.rate),
      text,
    ]);
    const current = { child };
    this.current = current;
    this.emit('speaking-start');
    child.on('exit', () => {
      if (this.current !== current) return;
      this.current = null;
      this.emit('speaking-end');
      this.pump();
    });
  }
}
