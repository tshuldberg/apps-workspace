import { EventEmitter } from 'node:events';

import type { SessionEvent } from '../types.js';
import { parseTranscriptLine } from './parser.js';

export interface WatcherIo {
  statSync(path: string): { size: number; mtimeMs: number };
  openSync(path: string, flags: string): number;
  readSync(fd: number, buffer: Buffer, offset: number, length: number, position: number): number;
  closeSync(fd: number): void;
}

export interface TranscriptWatcher {
  on(event: 'event', listener: (event: SessionEvent) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  emit(event: 'event', value: SessionEvent): boolean;
  emit(event: 'error', error: Error): boolean;
}

export class TranscriptWatcher extends EventEmitter {
  private readonly pollMs: number;
  private readonly fromStart: boolean;
  private timer: NodeJS.Timeout | null = null;
  private offset = 0;
  private partial = Buffer.alloc(0);
  private lastFailure: string | null = null;

  constructor(
    private readonly file: string,
    private readonly io: WatcherIo,
    opts: { pollMs?: number; fromStart?: boolean } = {},
  ) {
    super();
    this.pollMs = opts.pollMs ?? 300;
    this.fromStart = opts.fromStart ?? false;
    this.on('error', () => undefined);
  }

  start(): void {
    if (this.timer !== null) return;
    if (!this.fromStart) {
      try {
        this.offset = this.io.statSync(this.file).size;
        this.lastFailure = null;
      } catch (error) {
        this.report(error);
      }
    }
    this.timer = setInterval(() => this.poll(), this.pollMs);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private poll(): void {
    try {
      const { size } = this.io.statSync(this.file);
      if (size < this.offset) {
        this.offset = 0;
        this.partial = Buffer.alloc(0);
      }
      if (size === this.offset) {
        this.lastFailure = null;
        return;
      }

      const buffer = Buffer.alloc(size - this.offset);
      const fd = this.io.openSync(this.file, 'r');
      let bytesRead = 0;
      try {
        bytesRead = this.io.readSync(fd, buffer, 0, buffer.length, this.offset);
      } finally {
        this.io.closeSync(fd);
      }
      this.offset += bytesRead;
      this.consume(buffer.subarray(0, bytesRead));
      this.lastFailure = null;
    } catch (error) {
      this.report(error);
    }
  }

  private consume(chunk: Buffer): void {
    const contents = Buffer.concat([this.partial, chunk]);
    let start = 0;
    let newline = contents.indexOf(0x0a, start);
    while (newline !== -1) {
      const end = newline > start && contents[newline - 1] === 0x0d ? newline - 1 : newline;
      const line = contents.subarray(start, end).toString('utf8');
      for (const event of parseTranscriptLine(line)) this.emit('event', event);
      start = newline + 1;
      newline = contents.indexOf(0x0a, start);
    }
    this.partial = contents.subarray(start);
  }

  private report(value: unknown): void {
    const error = value instanceof Error ? value : new Error(String(value));
    const fingerprint = `${error.name}:${error.message}`;
    if (fingerprint !== this.lastFailure) {
      this.lastFailure = fingerprint;
      this.emit('error', error);
    }
  }
}
