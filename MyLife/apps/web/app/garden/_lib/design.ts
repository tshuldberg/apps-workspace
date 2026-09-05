import { GARDEN_ACCENT, GARDEN_ACCENT_LIGHT, GARDEN_DANGER, GARDEN_GOLD, GARDEN_GOLD_DEEP, GARDEN_SURFACES, GARDEN_TERTIARY } from '@mylife/garden';
import { fontStacks } from '@mylife/ui/src/tokens/typography';

export const GARDEN_CHROME = {
  accent: GARDEN_ACCENT,
  accentLight: GARDEN_ACCENT_LIGHT,
  gold: GARDEN_GOLD,
  goldDeep: GARDEN_GOLD_DEEP,
  tertiary: GARDEN_TERTIARY,
  danger: GARDEN_DANGER,
  warning: '#FFB877',
  text: '#E4E1E9',
  textMuted: 'rgba(228,225,233,0.68)',
  textDim: 'rgba(228,225,233,0.42)',
  line: 'rgba(255,255,255,0.06)',
  lineStrong: 'rgba(255,255,255,0.12)',
  surfaceDepth: GARDEN_SURFACES.depth,
  surfaceBase: GARDEN_SURFACES.base,
  surfaceLift: GARDEN_SURFACES.lift,
  surfaceFocus: GARDEN_SURFACES.focus,
  surfaceHighest: GARDEN_SURFACES.highest,
  shellGlow: '0 28px 80px rgba(0,0,0,0.45)',
} as const;

export const GARDEN_FONT = fontStacks.display;
export const GARDEN_SIDEBAR_WIDTH = 256;

export function alpha(hex: string, opacity: number): string {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function formatGardenDate(value?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return 'No date';
  const input = value.includes('T') ? value : `${value}T12:00:00`;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', options ?? {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatGardenTime(value?: string | null): string {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatGardenCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function humanizeGardenValue(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (segment) => segment.toUpperCase());
}

export function getStatusTone(status?: string | null): {
  label: string;
  color: string;
  background: string;
} {
  switch (status) {
    case 'healthy':
      return { label: 'Healthy', color: GARDEN_ACCENT, background: alpha(GARDEN_ACCENT, 0.16) };
    case 'needs_attention':
      return { label: 'Needs Attention', color: '#FFB4AB', background: 'rgba(255,180,171,0.16)' };
    case 'dormant':
      return { label: 'Dormant', color: '#9F8E81', background: 'rgba(159,142,129,0.18)' };
    case 'dead':
      return { label: 'Lost', color: GARDEN_DANGER, background: alpha(GARDEN_DANGER, 0.18) };
    default:
      return { label: 'Unknown', color: GARDEN_CHROME.textDim, background: alpha('#FFFFFF', 0.04) };
  }
}

export function getActionTone(action: string): {
  label: string;
  color: string;
  background: string;
} {
  switch (action) {
    case 'water':
      return { label: 'Watering', color: GARDEN_TERTIARY, background: alpha(GARDEN_TERTIARY, 0.14) };
    case 'harvest':
      return { label: 'Harvest', color: GARDEN_ACCENT, background: alpha(GARDEN_ACCENT, 0.14) };
    case 'fertilize':
      return { label: 'Feed', color: GARDEN_GOLD, background: alpha(GARDEN_GOLD, 0.14) };
    case 'prune':
      return { label: 'Prune', color: '#C4B5FD', background: 'rgba(196,181,253,0.16)' };
    case 'photo':
      return { label: 'Photo', color: '#F9A8D4', background: 'rgba(249,168,212,0.16)' };
    case 'pest_treatment':
      return { label: 'Treatment', color: GARDEN_DANGER, background: alpha(GARDEN_DANGER, 0.16) };
    case 'repot':
      return { label: 'Repot', color: '#FDBA74', background: 'rgba(253,186,116,0.16)' };
    default:
      return { label: humanizeGardenValue(action), color: GARDEN_CHROME.textMuted, background: alpha('#FFFFFF', 0.05) };
  }
}

export function pickImage(...sources: Array<string | null | undefined>): string | null {
  return sources.find((value) => Boolean(value && value.trim())) ?? null;
}

export function getPlantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'MG';
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
