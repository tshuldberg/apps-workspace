#!/usr/bin/env node

import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import { CodexBrain } from './brain/codex.js';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  settingsPath,
  type Settings,
} from './config.js';
import { Daemon } from './daemon.js';
import { injectViaOsascript, defaultExecFile } from './inject/osascript.js';
import { injectViaTmux } from './inject/tmux.js';
import { Narrator } from './narrator.js';
import { Ear } from './speech/ear.js';
import { Speaker } from './speech/speaker.js';
import { newestTranscript, transcriptDirFor } from './transcript/locate.js';
import { TranscriptWatcher } from './transcript/watcher.js';
import { TurnTaking } from './turntaking.js';
import { Ui } from './ui.js';
import { VoiceLog, loadRecentHistory } from './voicelog.js';

const settingsKeys = Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>;

function currentSettings(): Settings {
  return loadSettings((path) => readFileSync(path, 'utf8'));
}

function earBinPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../bin/talk-ear');
}

function parseStartArgs(args: string[]): { project: string; transcript: string | null } {
  let project = process.cwd();
  let transcript: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (name !== '--project' && name !== '--transcript') {
      throw new Error(`Unknown option: ${name ?? ''}`);
    }
    const value = args[index + 1];
    if (value === undefined) throw new Error(`Missing value for ${name}`);
    if (name === '--project') project = value;
    if (name === '--transcript') transcript = value;
    index += 1;
  }
  return {
    project: resolve(project),
    transcript: transcript === null ? null : resolve(transcript),
  };
}

async function startCommand(args: string[]): Promise<number> {
  const parsed = parseStartArgs(args);
  const home = process.env.HOME ?? homedir();
  const transcriptDir = transcriptDirFor(parsed.project, home);
  const transcript =
    parsed.transcript ?? newestTranscript(transcriptDir, { readdirSync, statSync });
  if (transcript === null || !existsSync(transcript)) {
    process.stderr.write(
      `No Claude transcript found. Expected a .jsonl session in ${transcriptDir}. Use --transcript <file> to override.\n`,
    );
    return 1;
  }

  const settings = currentSettings();
  const ear = new Ear(settings, earBinPath());
  const speaker = new Speaker(settings);
  const watcher = new TranscriptWatcher(transcript, {
    statSync,
    openSync,
    readSync,
    closeSync,
  });
  const brain = new CodexBrain(settings);
  const narrator = new Narrator(settings.narration);
  const turnTaking = new TurnTaking(settings);
  const ui = new Ui();
  const injector = async (prompt: string): Promise<void> => {
    if (settings.injector === 'osascript') {
      await injectViaOsascript(prompt, settings.terminalApp);
      return;
    }
    if (settings.tmuxTarget === null) {
      throw new Error('tmuxTarget must be configured when the tmux injector is selected.');
    }
    await injectViaTmux(prompt, settings.tmuxTarget);
  };

  const voiceLogIo = { mkdirSync, appendFileSync, readdirSync, readFileSync };
  const transcriptsDir = resolve(dirname(settingsPath()), 'transcripts');
  const initialHistory = loadRecentHistory(transcriptsDir, voiceLogIo, settings.historyTurns);
  const voiceLog = new VoiceLog(transcriptsDir, voiceLogIo);
  voiceLog.start();

  const daemon = new Daemon({
    settings,
    ear,
    speaker,
    watcher,
    brain,
    injector,
    narrator,
    turnTaking,
    ui,
    log: (line) => ui.log(line),
    voiceLog,
    initialHistory,
  });
  ui.log(`MyTalk watching ${transcript}`);
  if (initialHistory.length > 0) {
    ui.log(`Recalled ${String(initialHistory.length)} turns from the last conversation.`);
  }
  if (voiceLog.path !== null) ui.log(`Saving this conversation to ${voiceLog.path}`);
  daemon.start();
  process.once('SIGINT', () => {
    daemon.stop();
    voiceLog.close();
    process.stdout.write('\nMyTalk stopped. Conversation saved.\n');
  });
  return 0;
}

function displayValue(value: Settings[keyof Settings]): string {
  if (Array.isArray(value)) return value.join(', ');
  return value === null ? 'null' : String(value);
}

const choices: Partial<Record<keyof Settings, readonly string[]>> = {
  turnTaking: ['hands-free', 'push-to-talk', 'confirm-word'],
  narration: ['milestones', 'turn-end', 'play-by-play'],
  verification: ['read-back', 'instant', 'explicit'],
  injector: ['osascript', 'tmux'],
  pttKey: ['rightOption', 'rightCommand', 'f13'],
};

function parseSettingValue(
  key: keyof Settings,
  input: string,
): Settings[keyof Settings] | undefined {
  const value = input.trim();
  const allowed = choices[key];
  if (allowed !== undefined) return allowed.includes(value) ? value : undefined;
  if (
    key === 'rate' ||
    key === 'silenceMs' ||
    key === 'readBackGraceMs' ||
    key === 'turnEndQuietMs' ||
    key === 'codexTimeoutMs' ||
    key === 'ttsMuteTailMs' ||
    key === 'historyTurns'
  ) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  if (
    key === 'sendWords' ||
    key === 'cancelWords' ||
    key === 'waitWords' ||
    key === 'muteWords' ||
    key === 'unmuteWords' ||
    key === 'statusWords' ||
    key === 'readFullWords'
  ) {
    const words = value.split(',').map((word) => word.trim()).filter(Boolean);
    return words.length > 0 ? words : undefined;
  }
  if (key === 'tmuxTarget' || key === 'codexModel') {
    return value === '' || value.toLocaleLowerCase() === 'null' ? null : value;
  }
  return value === '' ? undefined : value;
}

async function settingsCommand(): Promise<number> {
  const settings = currentSettings();
  for (const [index, key] of settingsKeys.entries()) {
    process.stdout.write(`${index + 1}. ${key}: ${displayValue(settings[key])}\n`);
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const selection = Number(await readline.question('Setting number: '));
    const key = Number.isInteger(selection) ? settingsKeys[selection - 1] : undefined;
    if (key === undefined) {
      process.stderr.write('Invalid setting number.\n');
      return 1;
    }
    const hint = choices[key] === undefined ? '' : ` (${choices[key]?.join(' | ')})`;
    const raw = await readline.question(`New ${key}${hint}: `);
    const value = parseSettingValue(key, raw);
    if (value === undefined) {
      process.stderr.write(`Invalid value for ${key}.\n`);
      return 1;
    }
    const updated = { ...settings, [key]: value } as Settings;
    mkdirSync(dirname(settingsPath()), { recursive: true });
    saveSettings(updated, (path, contents) => writeFileSync(path, contents));
    process.stdout.write(`Saved ${key}: ${displayValue(value)}\n`);
    return 0;
  } finally {
    readline.close();
  }
}

async function commandAvailable(command: string, args: string[]): Promise<boolean> {
  try {
    return (await defaultExecFile(command, args)).code === 0;
  } catch {
    return false;
  }
}

async function doctorCommand(): Promise<number> {
  const settings = currentSettings();
  let healthy = true;
  const report = (ok: boolean, success: string, failure: string): void => {
    process.stdout.write(`${ok ? '✅' : '✖'} ${ok ? success : failure}\n`);
    healthy &&= ok;
  };

  report(
    await commandAvailable('codex', ['--version']),
    'codex is available',
    'codex is missing. Install the Codex CLI and ensure codex is on PATH.',
  );
  report(
    existsSync(earBinPath()),
    'talk-ear is built',
    'talk-ear is missing. Run pnpm build:ear.',
  );

  const transcriptDir = transcriptDirFor(process.cwd(), process.env.HOME ?? homedir());
  report(
    newestTranscript(transcriptDir, { readdirSync, statSync }) !== null,
    'Claude transcript found',
    `No Claude transcript found in ${transcriptDir}. Start Claude Code here first.`,
  );

  if (settings.injector === 'tmux') {
    const tmuxReady =
      settings.tmuxTarget !== null && (await commandAvailable('tmux', ['-V']));
    report(
      tmuxReady,
      `tmux is available for ${settings.tmuxTarget ?? ''}`,
      'tmux injection requires tmux on PATH and a configured tmuxTarget.',
    );
  }

  process.stdout.write(
    'ℹ Grant microphone and speech recognition access when prompted.\n' +
      'ℹ For Terminal injection, grant access in System Settings > Privacy & Security > Accessibility.\n',
  );
  return healthy ? 0 : 1;
}

export async function main(args: string[] = process.argv.slice(2)): Promise<number> {
  const [command = 'start', ...rest] = args;
  switch (command) {
    case 'start':
      return startCommand(rest);
    case 'settings':
      return settingsCommand();
    case 'doctor':
      return doctorCommand();
    default:
      process.stderr.write(
        'Usage: talk [start [--project <dir>] [--transcript <file>] | settings | doctor]\n',
      );
      return 1;
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
