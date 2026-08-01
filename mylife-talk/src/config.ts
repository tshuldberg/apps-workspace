import { homedir } from 'node:os';
import { join } from 'node:path';

import type {
  NarrationMode,
  TurnTakingMode,
  VerificationMode,
} from './types.js';

export interface Settings {
  turnTaking: TurnTakingMode;
  narration: NarrationMode;
  verification: VerificationMode;
  voice: string;
  rate: number;
  silenceMs: number;
  readBackGraceMs: number;
  turnEndQuietMs: number;
  sendWords: string[];
  cancelWords: string[];
  waitWords: string[];
  muteWords: string[];
  unmuteWords: string[];
  statusWords: string[];
  readFullWords: string[];
  terminalApp: string;
  injector: 'osascript' | 'tmux';
  tmuxTarget: string | null;
  codexModel: string | null;
  codexTimeoutMs: number;
  pttKey: 'rightOption' | 'rightCommand' | 'f13';
  locale: string;
}

export const DEFAULT_SETTINGS: Settings = {
  turnTaking: 'hands-free',
  narration: 'milestones',
  verification: 'read-back',
  voice: 'Samantha',
  rate: 180,
  silenceMs: 1500,
  readBackGraceMs: 3000,
  turnEndQuietMs: 2000,
  sendWords: ['send it', 'go ahead'],
  cancelWords: ['scratch that', 'cancel that', 'never mind'],
  waitWords: ['wait', 'hold on'],
  muteWords: ['stop listening'],
  unmuteWords: ['start listening'],
  statusWords: ["what's happening", 'status report'],
  readFullWords: ['read it in full', 'read the whole thing'],
  terminalApp: 'Terminal',
  injector: 'osascript',
  tmuxTarget: null,
  codexModel: null,
  codexTimeoutMs: 90_000,
  pttKey: 'rightOption',
  locale: 'en-US',
};

const turnTakingModes = new Set<TurnTakingMode>([
  'hands-free',
  'push-to-talk',
  'confirm-word',
]);
const narrationModes = new Set<NarrationMode>([
  'milestones',
  'turn-end',
  'play-by-play',
]);
const verificationModes = new Set<VerificationMode>([
  'read-back',
  'instant',
  'explicit',
]);
const injectors = new Set<Settings['injector']>(['osascript', 'tmux']);
const pttKeys = new Set<Settings['pttKey']>([
  'rightOption',
  'rightCommand',
  'f13',
]);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validatedSettings(value: unknown): Settings {
  const input = objectValue(value) ?? {};
  const stringValue = (key: keyof Settings, fallback: string): string =>
    typeof input[key] === 'string' ? input[key] : fallback;
  const numberValue = (key: keyof Settings, fallback: number): number =>
    typeof input[key] === 'number' && Number.isFinite(input[key])
      ? input[key]
      : fallback;
  const arrayValue = (key: keyof Settings, fallback: string[]): string[] =>
    isStringArray(input[key]) ? [...input[key]] : [...fallback];

  return {
    turnTaking: turnTakingModes.has(input.turnTaking as TurnTakingMode)
      ? (input.turnTaking as TurnTakingMode)
      : DEFAULT_SETTINGS.turnTaking,
    narration: narrationModes.has(input.narration as NarrationMode)
      ? (input.narration as NarrationMode)
      : DEFAULT_SETTINGS.narration,
    verification: verificationModes.has(input.verification as VerificationMode)
      ? (input.verification as VerificationMode)
      : DEFAULT_SETTINGS.verification,
    voice: stringValue('voice', DEFAULT_SETTINGS.voice),
    rate: numberValue('rate', DEFAULT_SETTINGS.rate),
    silenceMs: numberValue('silenceMs', DEFAULT_SETTINGS.silenceMs),
    readBackGraceMs: numberValue(
      'readBackGraceMs',
      DEFAULT_SETTINGS.readBackGraceMs,
    ),
    turnEndQuietMs: numberValue('turnEndQuietMs', DEFAULT_SETTINGS.turnEndQuietMs),
    sendWords: arrayValue('sendWords', DEFAULT_SETTINGS.sendWords),
    cancelWords: arrayValue('cancelWords', DEFAULT_SETTINGS.cancelWords),
    waitWords: arrayValue('waitWords', DEFAULT_SETTINGS.waitWords),
    muteWords: arrayValue('muteWords', DEFAULT_SETTINGS.muteWords),
    unmuteWords: arrayValue('unmuteWords', DEFAULT_SETTINGS.unmuteWords),
    statusWords: arrayValue('statusWords', DEFAULT_SETTINGS.statusWords),
    readFullWords: arrayValue('readFullWords', DEFAULT_SETTINGS.readFullWords),
    terminalApp: stringValue('terminalApp', DEFAULT_SETTINGS.terminalApp),
    injector: injectors.has(input.injector as Settings['injector'])
      ? (input.injector as Settings['injector'])
      : DEFAULT_SETTINGS.injector,
    tmuxTarget:
      typeof input.tmuxTarget === 'string' || input.tmuxTarget === null
        ? input.tmuxTarget
        : DEFAULT_SETTINGS.tmuxTarget,
    codexModel:
      typeof input.codexModel === 'string' || input.codexModel === null
        ? input.codexModel
        : DEFAULT_SETTINGS.codexModel,
    codexTimeoutMs: numberValue('codexTimeoutMs', DEFAULT_SETTINGS.codexTimeoutMs),
    pttKey: pttKeys.has(input.pttKey as Settings['pttKey'])
      ? (input.pttKey as Settings['pttKey'])
      : DEFAULT_SETTINGS.pttKey,
    locale: stringValue('locale', DEFAULT_SETTINGS.locale),
  };
}

export function settingsPath(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CONFIG_HOME ?? join(env.HOME ?? homedir(), '.config');
  return join(base, 'mylife-talk', 'settings.json');
}

export function loadSettings(readFile: (path: string) => string): Settings {
  try {
    return validatedSettings(JSON.parse(readFile(settingsPath())) as unknown);
  } catch {
    return validatedSettings(null);
  }
}

export function saveSettings(
  settings: Settings,
  writeFile: (path: string, contents: string) => void,
): void {
  writeFile(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`);
}
