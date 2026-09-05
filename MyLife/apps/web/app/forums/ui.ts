import type { CSSProperties } from 'react';
import { getDefaultAvatarColor } from '@mylife/forums';

export const FONT_STACK =
  "var(--font-forums), 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

export const TOKENS = {
  primary: '#C9894D',
  primaryLight: '#FFB877',
  primaryWash: 'rgba(201,137,77,0.16)',
  primaryGlow: 'rgba(201,137,77,0.3)',
  trust: '#7C4DFF',
  trustLight: '#A78BFA',
  trustGlow: 'rgba(124,77,255,0.28)',
  upvote: '#30D158',
  downvote: '#FFB4AB',
  info: '#8BCFF0',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  textTertiary: '#9F8E81',
  textMuted: 'rgba(228,225,233,0.45)',
  background: '#0E0E13',
  surface: '#131318',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(201,137,77,0.22)',
  glass: 'rgba(255,255,255,0.04)',
  glassStrong: 'rgba(255,255,255,0.08)',
  shellGlass: 'rgba(19,19,24,0.72)',
  danger: '#FF453A',
  success: '#30D158',
} as const;

export const ACCENT = TOKENS.primary;
export const ACCENT_LIGHT = TOKENS.primaryLight;
export const ACCENT_DIM = TOKENS.primaryWash;
export const ACCENT_BORDER = TOKENS.borderStrong;
export const DOWNVOTE_COLOR = TOKENS.downvote;
export const TEXT = TOKENS.text;
export const TEXT_SEC = TOKENS.textSecondary;
export const TEXT_TER = TOKENS.textTertiary;
export const BG = TOKENS.background;
export const SURFACE = TOKENS.surface;
export const SURFACE_LOW = TOKENS.low;
export const SURFACE_EL = TOKENS.high;
export const BORDER = TOKENS.border;
export const GLASS = TOKENS.glass;
export const GLASS_BORDER = TOKENS.border;
export const GLASS_STRONG = TOKENS.glassStrong;
export const DANGER = TOKENS.danger;
export const SUCCESS = TOKENS.success;
export const FR_HUMAN_VERIFIED = TOKENS.trustLight;

export const FORUMS_ROOT_VARS: CSSProperties = {
  ['--forums-primary' as string]: TOKENS.primary,
  ['--forums-primary-light' as string]: TOKENS.primaryLight,
  ['--forums-trust' as string]: TOKENS.trust,
  ['--forums-trust-light' as string]: TOKENS.trustLight,
  ['--forums-border' as string]: TOKENS.border,
  fontFamily: FONT_STACK,
  color: TOKENS.text,
};

export const FORUMS_PRIMARY_NAV = [
  { href: '/', label: 'Home', icon: 'grid_view' },
  { href: '/books', label: 'Library', icon: 'auto_stories' },
  { href: '/forums', label: 'Forums', icon: 'forum' },
  { href: '/journal', label: 'Archives', icon: 'inventory_2' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
] as const;

export interface ForumsSecondaryNavLink {
  href: string;
  label: string;
  activePath?: string | string[];
  exact?: boolean;
}

export const FORUMS_SECONDARY_NAV = [
  { href: '/forums', label: 'Threads', match: '/forums', exact: true },
  { href: '/forums/communities', label: 'Categories', match: '/forums/communities' },
  { href: '/forums/search?scope=threads', label: 'Rising', match: '/forums/search' },
  { href: '/forums/saved', label: 'Bookmarks', match: '/forums/saved' },
  { href: '/forums/messages', label: 'Messages', match: '/forums/messages' },
  { href: '/forums/activity', label: 'Activity', match: '/forums/activity' },
  { href: '/forums/mod-log', label: 'Moderation', match: '/forums/mod-log' },
] as const satisfies ReadonlyArray<{ href: string; label: string; match: string; exact?: boolean }>;

export const FORUMS_GLOBAL_CSS = `
  .forums-route-shell { display: grid; min-height: 100vh; }
  .forums-shell-layout { margin-left: 264px; padding-top: 80px; min-height: 100vh; }
  .forums-shell-inner { max-width: 1440px; margin: 0 auto; padding: 32px 32px 56px; }
  .forums-page-stack { display: grid; gap: 24px; }
  .forums-shell-scroll { scrollbar-width: none; }
  .forums-shell-scroll::-webkit-scrollbar { display: none; }
  .forums-feed-grid { display: grid; grid-template-columns: 280px minmax(0, 1fr) 320px; gap: 24px; align-items: start; }
  .forums-content-grid { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 24px; align-items: start; }
  .forums-detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 24px; align-items: start; }
  .forums-two-up { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .forums-three-up { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .forums-four-up { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
  .forums-chip-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .forums-sidebar-card { position: sticky; top: 112px; }
  .forums-sticky-composer { position: sticky; bottom: 24px; z-index: 8; }
  .forums-rich-markdown p { margin: 0 0 1em; }
  .forums-rich-markdown h1,
  .forums-rich-markdown h2,
  .forums-rich-markdown h3,
  .forums-rich-markdown h4 { margin: 0 0 0.6em; color: ${TOKENS.text}; }
  .forums-rich-markdown ul,
  .forums-rich-markdown ol { margin: 0 0 1em; padding-left: 1.4em; }
  .forums-rich-markdown li { margin-bottom: 0.45em; }
  .forums-rich-markdown blockquote {
    margin: 0 0 1.1em;
    padding: 14px 18px;
    border-radius: 18px;
    background: rgba(255,255,255,0.05);
    color: ${TOKENS.textSecondary};
  }
  .forums-rich-markdown code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    background: rgba(255,255,255,0.06);
    padding: 0.12em 0.4em;
    border-radius: 8px;
  }
  .forums-rich-markdown pre {
    margin: 0 0 1em;
    padding: 16px;
    border-radius: 18px;
    overflow-x: auto;
    background: rgba(0,0,0,0.22);
  }
  .forums-rich-markdown pre code { background: transparent; padding: 0; }
  @media (max-width: 1300px) {
    .forums-feed-grid { grid-template-columns: 240px minmax(0, 1fr); }
    .forums-feed-grid > :last-child { grid-column: span 2; }
  }
  @media (max-width: 1120px) {
    .forums-shell-layout { margin-left: 0; padding-top: 76px; }
    .forums-shell-inner { padding: 24px 20px 44px; }
    .forums-feed-grid,
    .forums-content-grid,
    .forums-detail-grid { grid-template-columns: 1fr; }
    .forums-sidebar-card { position: static; top: auto; }
    .forums-desktop-shell { display: none !important; }
    .forums-mobile-shell { display: flex !important; }
  }
  @media (max-width: 760px) {
    .forums-two-up,
    .forums-three-up,
    .forums-four-up { grid-template-columns: 1fr; }
  }
`;

export function shellPanelStyle(level: 'surface' | 'low' | 'mid' | 'high' = 'low'): CSSProperties {
  const background =
    level === 'surface'
      ? TOKENS.surface
      : level === 'mid'
        ? TOKENS.mid
        : level === 'high'
          ? TOKENS.high
          : TOKENS.low;
  return {
    background,
    borderRadius: 28,
    boxShadow: '0 28px 64px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.03)',
  };
}

export const glassPanelStyle: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))',
  borderRadius: 28,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 28px 64px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
};

export const gradientButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '12px 18px',
  background: `linear-gradient(135deg, ${TOKENS.primaryLight}, ${TOKENS.primary})`,
  color: '#2E1600',
  fontFamily: FONT_STACK,
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: '0 16px 34px rgba(201,137,77,0.22)',
};

export const ghostButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '11px 16px',
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.textSecondary,
  fontFamily: FONT_STACK,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

export function chipStyle(active: boolean, tone: 'gold' | 'trust' | 'neutral' = 'gold'): CSSProperties {
  const activeColor =
    tone === 'trust' ? TOKENS.trustLight : tone === 'neutral' ? TOKENS.highest : TOKENS.primary;
  const activeText = tone === 'trust' ? '#F5F1FF' : tone === 'neutral' ? TOKENS.text : '#2E1600';
  return {
    border: 'none',
    borderRadius: 999,
    padding: '10px 14px',
    background: active
      ? activeColor
      : tone === 'trust'
        ? 'rgba(124,77,255,0.14)'
        : 'rgba(255,255,255,0.05)',
    color: active ? activeText : TOKENS.textSecondary,
    fontFamily: FONT_STACK,
    fontSize: 13,
    fontWeight: active ? 800 : 700,
    cursor: 'pointer',
    boxShadow: active && tone === 'trust' ? `0 0 18px ${TOKENS.trustGlow}` : 'none',
  };
}

export const inputStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  borderRadius: 18,
  padding: '14px 16px',
  background: 'rgba(255,255,255,0.05)',
  color: TOKENS.text,
  fontFamily: FONT_STACK,
  fontSize: 14,
  boxSizing: 'border-box',
};

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 160,
  resize: 'vertical',
};

export function getForumsSecondaryNav(pathname: string): ForumsSecondaryNavLink[] {
  const links: ForumsSecondaryNavLink[] = FORUMS_SECONDARY_NAV.map((link) => ({
    href: link.href,
    label: link.label,
    activePath: link.match,
    exact: 'exact' in link ? link.exact : false,
  }));

  const segments = pathname.split('/').filter(Boolean);
  const route = segments[1] ?? null;
  const routeId = segments[2] ?? null;
  const isThreadDetail = route === 'thread' && Boolean(routeId) && routeId !== 'create';
  const isThreadComposer = pathname === '/forums/create-thread' || pathname.startsWith('/forums/thread/create');
  const isCommunityDetail = route === 'community' && Boolean(routeId);
  const isCommunityHealth = route === 'community-health' && Boolean(routeId);
  const isCommunitySettings = route === 'community-settings' && Boolean(routeId);
  const isLegacyCommunityRoute = route === 'communities' && Boolean(routeId) && routeId !== 'create';
  const communityId =
    isCommunityDetail || isCommunityHealth || isCommunitySettings || isLegacyCommunityRoute
      ? routeId
      : null;
  const isOwnProfile = pathname === '/forums/profile';
  const isProfileEdit = pathname === '/forums/edit-profile' || pathname === '/forums/profile/edit';
  const isProfileDetail = route === 'profile' && Boolean(routeId) && routeId !== 'edit';
  const isCreateCommunity = pathname === '/forums/create-community' || pathname.startsWith('/forums/communities/create');

  const append = (link: ForumsSecondaryNavLink) => {
    if (!links.some((entry) => entry.href === link.href && entry.label === link.label)) {
      links.push(link);
    }
  };

  if (isThreadDetail) {
    append({
      href: pathname,
      label: 'Thread',
      activePath: pathname,
      exact: true,
    });
  }

  if (isThreadComposer) {
    append({
      href: '/forums/create-thread',
      label: 'Create',
      activePath: ['/forums/create-thread', '/forums/thread/create'],
    });
  }

  if (communityId) {
    append({
      href: `/forums/community/${communityId}`,
      label: 'Community',
      activePath: [`/forums/community/${communityId}`, `/forums/communities/${communityId}`],
    });
    append({
      href: `/forums/community-health/${communityId}`,
      label: 'Health',
      activePath: [`/forums/community-health/${communityId}`, `/forums/communities/${communityId}/mod`],
    });
    append({
      href: `/forums/community-settings/${communityId}`,
      label: 'Settings',
      activePath: [`/forums/community-settings/${communityId}`, `/forums/communities/${communityId}/settings`],
    });
    append({
      href: `/forums/create-thread?community=${communityId}`,
      label: 'Create',
      activePath: ['/forums/create-thread', '/forums/thread/create'],
    });
  }

  if (isCreateCommunity) {
    append({
      href: '/forums/create-community',
      label: 'Create community',
      activePath: ['/forums/create-community', '/forums/communities/create'],
    });
  }

  if (isOwnProfile) {
    append({
      href: '/forums/profile',
      label: 'Profile',
      activePath: '/forums/profile',
      exact: true,
    });
  }

  if (isProfileEdit) {
    append({
      href: '/forums/edit-profile',
      label: 'Edit profile',
      activePath: ['/forums/edit-profile', '/forums/profile/edit'],
    });
  }

  if (isProfileDetail) {
    append({
      href: pathname,
      label: 'Profile',
      activePath: pathname,
      exact: true,
    });
  }

  return links;
}

export function isNavActive(pathname: string, href: string | string[], exact = false): boolean {
  const candidates = Array.isArray(href) ? href : [href];
  return candidates.some((candidate) =>
    exact ? pathname === candidate : pathname === candidate || pathname.startsWith(`${candidate}/`),
  );
}

export function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  const diffMo = Math.floor(diffD / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  return `${Math.floor(diffMo / 12)}y ago`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function getInitials(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function getAvatarGradient(seed: string): string {
  const base = getDefaultAvatarColor(seed || 'forums');
  return `linear-gradient(135deg, ${base}, ${TOKENS.primary})`;
}

export type TrustTier = 'unverified' | 'new' | 'trusted' | 'highly_trusted' | 'mod';

export function getTrustTier(params: {
  karma?: number;
  isVerified?: boolean | number;
  role?: string;
}): TrustTier {
  if (['owner', 'admin', 'moderator'].includes(params.role ?? '')) return 'mod';
  if (params.isVerified && (params.karma ?? 0) >= 1000) return 'highly_trusted';
  if (params.isVerified) return 'trusted';
  if ((params.karma ?? 0) > 0) return 'new';
  return 'unverified';
}

export function getTrustMeta(tier: TrustTier): { label: string; color: string; glow: boolean } {
  switch (tier) {
    case 'mod':
      return { label: 'Moderator', color: TOKENS.primaryLight, glow: false };
    case 'highly_trusted':
      return { label: 'Human Verified', color: TOKENS.trust, glow: true };
    case 'trusted':
      return { label: 'Verified', color: TOKENS.trustLight, glow: true };
    case 'new':
      return { label: 'New Voice', color: TOKENS.info, glow: false };
    case 'unverified':
    default:
      return { label: 'Unverified', color: TOKENS.textTertiary, glow: false };
  }
}

export function getCommunityCover(name: string): string {
  const palettes = [
    ['#2E1600', '#C9894D'],
    ['#2B1C3B', '#7C4DFF'],
    ['#0D2B38', '#8BCFF0'],
    ['#182513', '#30D158'],
    ['#341B1B', '#FFB4AB'],
  ] as const;
  const index = Math.abs(
    name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0),
  ) % palettes.length;
  const [start, end] = palettes[index];
  return `linear-gradient(135deg, ${start}, ${end})`;
}

export function splitHighlightedText(text: string, query: string): Array<{ value: string; match: boolean }> {
  const trimmed = query.trim();
  if (!trimmed) return [{ value: text, match: false }];
  const pattern = new RegExp(`(${escapeRegExp(trimmed)})`, 'ig');
  return text.split(pattern).filter(Boolean).map((value) => ({
    value,
    match: value.toLowerCase() === trimmed.toLowerCase(),
  }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
