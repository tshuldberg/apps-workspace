import { EventEmitter } from 'node:events';

import type { Settings } from './config.js';
import type { ControlCommand } from './types.js';

export type DaemonPhase = 'listening' | 'muted' | 'awaiting-send' | 'read-back';

export interface PendingPrompt {
  prompt: string;
  spokenBack: boolean;
}

type ActiveControl = Exclude<ControlCommand, null>;

function controlMatch(text: string, phrase: string): boolean {
  const trimPunctuation = (value: string): string =>
    value.trim().toLocaleLowerCase().replace(/[.,!?;:'"…]+$/u, '').trimEnd();
  const candidate = trimPunctuation(text);
  const expected = trimPunctuation(phrase);
  if (candidate === expected) return true;
  if (!candidate.startsWith(expected)) return false;
  const remainder = candidate.slice(expected.length);
  return remainder.length <= 2 && /^[\s.,!?;:'"-]*$/.test(remainder);
}

export function detectControl(text: string, settings: Settings): ControlCommand {
  const controls: Array<[ActiveControl, string[]]> = [
    ['cancel', settings.cancelWords],
    ['mute', settings.muteWords],
    ['unmute', settings.unmuteWords],
    ['send', settings.sendWords],
    ['wait', settings.waitWords],
    ['status', settings.statusWords],
    ['read-full', settings.readFullWords],
    ['help', ['help']],
  ];

  for (const [command, phrases] of controls) {
    if (phrases.some((phrase) => controlMatch(text, phrase))) return command;
  }
  return null;
}

export interface TurnTaking {
  on(event: 'route' | 'inject' | 'speak', listener: (text: string) => void): this;
  on(event: 'control', listener: (command: ControlCommand) => void): this;
  on(event: 'mute-ear' | 'unmute-ear', listener: () => void): this;
  emit(event: 'route' | 'inject' | 'speak', text: string): boolean;
  emit(event: 'control', command: ControlCommand): boolean;
  emit(event: 'mute-ear' | 'unmute-ear'): boolean;
}

export class TurnTaking extends EventEmitter {
  private currentPhase: DaemonPhase = 'listening';
  private buffer = '';
  private pending: PendingPrompt | null = null;
  private graceDeadline = 0;
  private waiting = false;

  constructor(
    private readonly settings: Settings,
    private readonly now: () => number = Date.now,
  ) {
    super();
  }

  get phase(): DaemonPhase {
    return this.currentPhase;
  }

  onFinalUtterance(text: string): void {
    const utterance = text.trim();
    if (utterance === '') return;
    const control = detectControl(utterance, this.settings);

    if (this.currentPhase === 'muted') {
      if (control === 'unmute') this.handleControl(control);
      return;
    }
    if (control !== null) {
      this.handleControl(control);
      return;
    }
    if (this.pending !== null) {
      this.emit('route', utterance);
      return;
    }

    switch (this.settings.turnTaking) {
      case 'hands-free':
        this.emit('route', utterance);
        break;
      case 'confirm-word':
        this.buffer = [this.buffer, utterance].filter(Boolean).join(' ');
        break;
      case 'push-to-talk':
        // the ear only captures while the key is held, so any final is legitimate
        // (finals can arrive after the key-up event; do not gate on pttDown)
        this.emit('route', utterance);
        break;
    }
  }

  onPtt(_state: 'down' | 'up'): void {
    // capture windows are enforced by talk-ear; nothing to track here
  }

  onBrainPrompt(prompt: string): void {
    if (this.settings.verification === 'instant') {
      this.emit('inject', prompt);
      this.emit('speak', 'Sent.');
      return;
    }

    this.pending = { prompt, spokenBack: true };
    this.waiting = false;
    this.emit('speak', `Sending: ${prompt}`);
    if (this.settings.verification === 'read-back') {
      this.currentPhase = 'read-back';
      this.graceDeadline = this.now() + this.settings.readBackGraceMs;
    } else {
      this.currentPhase = 'awaiting-send';
      this.emit('speak', 'Say send it when ready.');
    }
  }

  tick(): void {
    if (
      this.pending !== null &&
      this.settings.verification === 'read-back' &&
      !this.waiting &&
      this.now() >= this.graceDeadline
    ) {
      this.injectPending(false);
    }
  }

  private handleControl(command: ActiveControl): void {
    switch (command) {
      case 'cancel':
        this.buffer = '';
        this.pending = null;
        this.waiting = false;
        this.currentPhase = 'listening';
        this.emit('speak', 'Cancelled.');
        break;
      case 'mute':
        this.currentPhase = 'muted';
        this.emit('mute-ear');
        this.emit('speak', 'Muted.');
        break;
      case 'unmute':
        this.currentPhase = 'listening';
        this.emit('unmute-ear');
        this.emit('speak', 'Unmuted.');
        break;
      case 'send':
        if (this.pending !== null) {
          this.injectPending(true);
        } else if (this.settings.turnTaking === 'confirm-word' && this.buffer !== '') {
          const buffered = this.buffer;
          this.buffer = '';
          this.emit('route', buffered);
        }
        break;
      case 'wait':
        if (this.pending !== null) {
          this.waiting = true;
          this.currentPhase = 'awaiting-send';
          this.emit('speak', 'Waiting.');
        }
        break;
      case 'status':
      case 'read-full':
      case 'help':
        this.emit('control', command);
        break;
    }
  }

  private injectPending(confirm: boolean): void {
    if (this.pending === null) return;
    const { prompt } = this.pending;
    this.pending = null;
    this.waiting = false;
    this.currentPhase = 'listening';
    this.emit('inject', prompt);
    if (confirm) this.emit('speak', 'Sent.');
  }
}
