import React from 'react';
import { colors } from '../tokens/colors';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

export type ShareStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface ShareStatusBadgeProps {
  status: ShareStatus;
  transport?: string | null;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Style tokens (Obsidian Noir, platform-agnostic CSSProperties)
// ---------------------------------------------------------------------------

const s = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1,
    padding: '3px 8px',
    borderRadius: 6,
    backgroundColor: colors.glassStrong,
    border: `1px solid ${colors.glassBorder}`,
    whiteSpace: 'nowrap',
  } satisfies React.CSSProperties,

  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  } satisfies React.CSSProperties,

  icon: {
    fontSize: 11,
    lineHeight: 1,
    flexShrink: 0,
  } satisfies React.CSSProperties,
} as const;

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

interface StatusConfig {
  dotColor: string;
  label: string;
  icon?: string;
}

function getStatusConfig(status: ShareStatus, transport?: string | null): StatusConfig {
  switch (status) {
    case 'pending':
      return { dotColor: colors.warning, label: 'Sharing...' };
    case 'sent':
      return {
        dotColor: colors.tertiary,
        label: transport ? `Sent via ${transport}` : 'Sent',
      };
    case 'delivered':
      return { dotColor: colors.success, label: 'Delivered', icon: '\u2713' };
    case 'failed':
      return { dotColor: colors.danger, label: 'Failed', icon: '\u2717' };
  }
}

// ---------------------------------------------------------------------------
// ShareStatusBadge
// ---------------------------------------------------------------------------

export function ShareStatusBadge({ status, transport, style }: ShareStatusBadgeProps) {
  const config = getStatusConfig(status, transport);

  return (
    <span style={{ ...s.badge, ...style }}>
      {config.icon ? (
        <span style={{ ...s.icon, color: config.dotColor }}>{config.icon}</span>
      ) : (
        <span style={{ ...s.dot, backgroundColor: config.dotColor }} />
      )}
      <span style={{ color: colors.textSecondary }}>{config.label}</span>
    </span>
  );
}
