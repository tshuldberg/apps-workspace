import type { DatabaseAdapter } from '@mylife/db';
import type {
  DreamType,
  SleepDurationTone,
} from '@mylife/sleep';

export const SLEEP_DURATION_TONES: Record<
  SleepDurationTone,
  { background: string; borderColor: string; color: string }
> = {
  success: {
    background: 'rgba(48,209,88,0.14)',
    borderColor: 'rgba(48,209,88,0.34)',
    color: '#BBF7D0',
  },
  warning: {
    background: 'rgba(250,204,21,0.14)',
    borderColor: 'rgba(250,204,21,0.34)',
    color: '#FEF08A',
  },
  danger: {
    background: 'rgba(255,69,58,0.14)',
    borderColor: 'rgba(255,69,58,0.34)',
    color: '#FECACA',
  },
};

export const SLEEP_DREAM_TYPE_TONES: Record<
  DreamType,
  { background: string; borderColor: string; color: string }
> = {
  normal: {
    background: 'rgba(148,163,184,0.14)',
    borderColor: 'rgba(148,163,184,0.32)',
    color: '#E2E8F0',
  },
  vivid: {
    background: 'rgba(167,139,250,0.16)',
    borderColor: 'rgba(167,139,250,0.38)',
    color: '#E9DDFF',
  },
  nightmare: {
    background: 'rgba(255,69,58,0.14)',
    borderColor: 'rgba(255,69,58,0.34)',
    color: '#FECACA',
  },
  lucid: {
    background: 'rgba(96,165,250,0.16)',
    borderColor: 'rgba(96,165,250,0.34)',
    color: '#DBEAFE',
  },
  recurring: {
    background: 'rgba(251,191,36,0.14)',
    borderColor: 'rgba(251,191,36,0.34)',
    color: '#FDE68A',
  },
};

export function readSleepTargetHours(db: DatabaseAdapter): number {
  const rawValue = db.query<{ value: string }>(
    `SELECT value FROM sl_settings WHERE key = ? LIMIT 1`,
    ['sleep.targetHours'],
  )[0]?.value;
  const parsed = Number(rawValue);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}
