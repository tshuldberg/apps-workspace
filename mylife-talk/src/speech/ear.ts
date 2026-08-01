import { spawn as nodeSpawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

import type { Settings } from '../config.js';
import type { EarEvent } from '../types.js';

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseEarEvent(line: string): EarEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line) as unknown;
  } catch {
    return null;
  }
  const object = asObject(value);
  switch (object?.type) {
    case 'ready':
      return { type: 'ready' };
    case 'partial':
    case 'final':
      return typeof object.text === 'string' ? { type: object.type, text: object.text } : null;
    case 'ptt':
      return object.state === 'down' || object.state === 'up'
        ? { type: 'ptt', state: object.state }
        : null;
    case 'status':
    case 'error':
      return typeof object.message === 'string'
        ? { type: object.type, message: object.message }
        : null;
    default:
      return null;
  }
}

export interface Ear {
  on(event: 'event', listener: (event: EarEvent) => void): this;
  on(event: 'ready', listener: () => void): this;
  on(event: 'partial' | 'final' | 'status', listener: (text: string) => void): this;
  on(event: 'ptt', listener: (state: 'down' | 'up') => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  emit(event: 'ready'): boolean;
  emit(event: 'event', value: EarEvent): boolean;
  emit(event: 'partial' | 'final' | 'status', text: string): boolean;
  emit(event: 'ptt', state: 'down' | 'up'): boolean;
  emit(event: 'error', error: Error): boolean;
}

export class Ear extends EventEmitter {
  private child: ReturnType<typeof nodeSpawn> | null = null;
  private running = false;
  private restartTimes: number[] = [];

  constructor(
    private readonly settings: Settings,
    private readonly binPath: string,
    private readonly spawn: typeof nodeSpawn = nodeSpawn,
  ) {
    super();
    this.on('error', () => undefined);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.launch();
  }

  stop(): void {
    this.running = false;
    const child = this.child;
    this.child = null;
    child?.kill();
  }

  mute(): void {
    this.child?.stdin?.write('mute\n');
  }

  unmute(): void {
    this.child?.stdin?.write('unmute\n');
  }

  private launch(): void {
    const args = [
      '--silence-ms',
      String(this.settings.silenceMs),
      '--locale',
      this.settings.locale,
    ];
    if (this.settings.turnTaking === 'push-to-talk') {
      args.push('--ptt-key', this.settings.pttKey);
    }

    let child: ReturnType<typeof nodeSpawn>;
    try {
      child = this.spawn(this.binPath, args);
    } catch (error) {
      this.handleExit(error);
      return;
    }
    this.child = child;
    let partial = '';
    child.stdout?.on('data', (chunk: Buffer | string) => {
      const lines = `${partial}${chunk.toString()}`.split('\n');
      partial = lines.pop() ?? '';
      for (const line of lines) this.dispatch(line.endsWith('\r') ? line.slice(0, -1) : line);
    });
    child.on('error', (error) => this.emit('error', error));
    child.on('exit', () => {
      if (this.child === child) this.child = null;
      this.handleExit();
    });
  }

  private dispatch(line: string): void {
    const event = parseEarEvent(line);
    if (event === null) return;
    this.emit('event', event);
    switch (event.type) {
      case 'ready':
        this.emit('ready');
        break;
      case 'partial':
      case 'final':
        this.emit(event.type, event.text);
        break;
      case 'ptt':
        this.emit('ptt', event.state);
        break;
      case 'status':
        this.emit('status', event.message);
        break;
      case 'error':
        this.emit('error', new Error(event.message));
        break;
    }
  }

  private handleExit(cause?: unknown): void {
    if (!this.running) return;
    const now = Date.now();
    this.restartTimes = this.restartTimes.filter((time) => now - time < 60_000);
    if (this.restartTimes.length >= 3) {
      this.running = false;
      const detail = cause instanceof Error ? `: ${cause.message}` : '';
      this.emit('error', new Error(`talk-ear stopped after 3 restart attempts${detail}`));
      return;
    }
    this.restartTimes.push(now);
    this.launch();
  }
}
