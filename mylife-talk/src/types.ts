export type SessionEvent =
  | { kind: 'assistant-text'; text: string }
  | { kind: 'tool-use'; name: string; summary: string }
  | { kind: 'question'; text: string; options: string[] }
  | { kind: 'user-text'; text: string }
  | { kind: 'turn-end' };

export type BrainAction = 'chat' | 'prompt' | 'none';

export interface BrainResult {
  speak: string | null;
  action: BrainAction;
  prompt: string | null;
}

export type TurnTakingMode = 'hands-free' | 'push-to-talk' | 'confirm-word';
export type NarrationMode = 'milestones' | 'turn-end' | 'play-by-play';
export type VerificationMode = 'read-back' | 'instant' | 'explicit';

export type EarEvent =
  | { type: 'ready' }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'ptt'; state: 'down' | 'up' }
  | { type: 'status'; message: string }
  | { type: 'error'; message: string };

export type ControlCommand =
  | 'cancel'
  | 'mute'
  | 'unmute'
  | 'send'
  | 'wait'
  | 'status'
  | 'read-full'
  | 'help'
  | null;
