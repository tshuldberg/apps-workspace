import type { CSSProperties } from 'react';

// ── Module Identity ─────────────────────────────────────────────────

export const ACCENT = 'var(--accent-voice)';
export const ACCENT_DIM = 'var(--accent-voice-dim)';
export const ACCENT_BORDER = 'var(--accent-voice-border)';

// ── Cool Obsidian Tokens ────────────────────────────────────────────

export const TEXT = 'var(--text)';
export const TEXT_SEC = 'var(--text-secondary)';
export const TEXT_TER = 'var(--text-tertiary)';
export const BG = 'var(--background)';
export const SURFACE = 'var(--surface)';
export const BORDER = 'var(--border)';
export const GLASS = 'var(--glass)';
export const GLASS_STRONG = 'var(--glass-strong)';
export const GLASS_BORDER = 'var(--glass-border)';
export const DANGER = 'var(--danger)';
export const SUCCESS = 'var(--success)';

// ── Formatting ──────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  if (hrs > 0) {
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  }
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

// ── Reusable Styles ─────────────────────────────────────────────────

export function glassCard(): CSSProperties {
  return {
    borderRadius: 16,
    border: `1px solid ${BORDER}`,
    backgroundColor: SURFACE,
    padding: 16,
  };
}

export function glassStrong(): CSSProperties {
  return {
    borderRadius: 16,
    border: `1px solid ${GLASS_BORDER}`,
    backgroundColor: GLASS_STRONG,
    padding: 16,
  };
}

export function heroStyle(): CSSProperties {
  return {
    padding: 24,
    borderRadius: 24,
    background: ACCENT_DIM,
    border: `1px solid ${ACCENT_BORDER}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
    flexWrap: 'wrap',
  };
}

export function pillButton(active: boolean): CSSProperties {
  return {
    borderRadius: 999,
    border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
    backgroundColor: active ? ACCENT : GLASS,
    color: active ? BG : TEXT_SEC,
    padding: '8px 14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 14,
  };
}

export function primaryButton(): CSSProperties {
  return {
    borderRadius: 999,
    backgroundColor: ACCENT,
    color: BG,
    padding: '10px 16px',
    fontWeight: 700,
    textDecoration: 'none',
    cursor: 'pointer',
    border: 'none',
    fontSize: 14,
  };
}

export function ghostButton(): CSSProperties {
  return {
    borderRadius: 8,
    backgroundColor: 'transparent',
    color: TEXT_SEC,
    padding: '8px 12px',
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${BORDER}`,
    fontSize: 14,
  };
}

export function emptyState(): CSSProperties {
  return {
    padding: 32,
    borderRadius: 24,
    border: `1px dashed ${ACCENT_BORDER}`,
    backgroundColor: GLASS,
    textAlign: 'center',
  };
}

// ── Language Colors (mirrors engine/language.ts) ────────────────────

export const LANGUAGE_COLORS: Record<string, string> = {
  en: '#60A5FA',
  es: '#F97316',
  zh: '#EF4444',
  fr: '#818CF8',
  de: '#FBBF24',
  ja: '#F472B6',
  ko: '#2DD4BF',
  pt: '#34D399',
  hi: '#A78BFA',
  ar: '#FB923C',
  it: '#4ADE80',
  ru: '#38BDF8',
};

export function getLanguageColor(code: string | null): string {
  if (!code) return '#9CA3AF';
  const base = code.split('-')[0].toLowerCase();
  return LANGUAGE_COLORS[base] ?? '#9CA3AF';
}

export function getLanguageName(code: string | null): string {
  if (!code) return 'Unknown';
  const base = code.split('-')[0].toUpperCase();
  return base;
}

// ── Speaker Colors (mirrors engine/speaker.ts) ─────────────────────

export const SPEAKER_COLORS = [
  '#60A5FA',
  '#F97316',
  '#34D399',
  '#A78BFA',
  '#FBBF24',
  '#F472B6',
  '#2DD4BF',
  '#FB923C',
  '#818CF8',
  '#4ADE80',
] as const;

export function getSpeakerColor(index: number): string {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}
