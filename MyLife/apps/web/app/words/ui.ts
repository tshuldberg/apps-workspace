// Cool Obsidian design tokens for web (matches DESIGN.md)
export const ACCENT = '#0EA5E9';
export const ACCENT_DIM = 'rgba(14,165,233,0.15)';
export const ACCENT_BORDER = 'rgba(14,165,233,0.25)';
export const TEXT = '#F0F0F5';
export const TEXT_SEC = 'rgba(240,240,245,0.65)';
export const TEXT_TER = 'rgba(240,240,245,0.35)';
export const SURFACE = '#12121A';
export const BORDER = 'rgba(255,255,255,0.06)';
export const GLASS = 'rgba(255,255,255,0.04)';
export const GLASS_STRONG = 'rgba(255,255,255,0.08)';
export const GLASS_BORDER = 'rgba(255,255,255,0.10)';
export const DANGER = '#FF453A';
export const SUCCESS = '#30D158';
export const WARNING = '#FF9F0A';

export function computeMastery(
  lookedUpCount: number,
  lastLookedUpAt: string,
): { level: 'new' | 'learning' | 'familiar'; color: string; label: string } {
  const daysSince = Math.floor(
    (Date.now() - new Date(lastLookedUpAt).getTime()) / 86400000,
  );
  if (lookedUpCount <= 1)
    return { level: 'new', color: DANGER, label: 'New' };
  if (lookedUpCount <= 5 || daysSince > 30)
    return { level: 'learning', color: WARNING, label: 'Learning' };
  return { level: 'familiar', color: SUCCESS, label: 'Familiar' };
}

export function formatDaysAgo(isoDate: string): string {
  const days = Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / 86400000,
  );
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
