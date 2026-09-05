import { SYSTEM_FOLDERS, ACCOUNT_COLORS } from '@mylife/mail';

// Cool Obsidian design tokens for MyMail web pages
export const MAIL_COLORS = {
  accent: '#3B82F6',
  accentDim: 'rgba(59,130,246,0.15)',
  accentBorder: 'rgba(59,130,246,0.25)',
  text: '#F0F0F5',
  textSec: 'rgba(240,240,245,0.65)',
  textTert: 'rgba(240,240,245,0.35)',
  bg: '#0A0A0F',
  surface: '#12121A',
  border: 'rgba(255,255,255,0.06)',
  glass: 'rgba(255,255,255,0.04)',
  glassStrong: 'rgba(255,255,255,0.08)',
  glassDock: 'rgba(18,18,26,0.65)',
  danger: '#FF453A',
} as const;

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  if (d > weekAgo) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function generateInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

export function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash + email.charCodeAt(i)) | 0;
  }
  const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
  return colors[Math.abs(hash) % colors.length];
}

export function truncatePreview(body: string, len = 120): string {
  const clean = body.replace(/\s+/g, ' ').trim();
  if (clean.length <= len) return clean;
  return clean.slice(0, len) + '...';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getAccountColor(index: number): string {
  return ACCOUNT_COLORS[index % ACCOUNT_COLORS.length];
}

export function getSyncStatusLabel(status: string): string {
  if (status === 'syncing') return 'Syncing...';
  if (status === 'error') return 'Error';
  return 'Idle';
}

export function getFolderIcon(folderName: string): string {
  const sys = SYSTEM_FOLDERS.find((f) => f.name === folderName);
  return sys?.icon ?? 'folder';
}

export function groupThreadsByDate<T extends { latestMessageAt: string }>(
  threads: T[],
): { title: string; data: T[] }[] {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const groups: Record<string, T[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Earlier: [],
  };

  for (const t of threads) {
    const d = new Date(t.latestMessageAt);
    const ds = d.toDateString();
    if (ds === today) groups.Today.push(t);
    else if (ds === yesterday) groups.Yesterday.push(t);
    else if (d > weekAgo) groups['This Week'].push(t);
    else groups.Earlier.push(t);
  }

  return Object.entries(groups)
    .filter(([, data]) => data.length > 0)
    .map(([title, data]) => ({ title, data }));
}
