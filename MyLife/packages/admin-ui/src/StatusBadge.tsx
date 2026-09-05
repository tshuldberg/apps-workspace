'use client';

import React from 'react';

export interface StatusBadgeProps {
  status: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

const variantColors: Record<string, string> = {
  success: '#30D158',
  warning: '#FFB877',
  danger: '#FFB4AB',
  info: '#8BCFF0',
  neutral: 'var(--text-tertiary)',
};

export function StatusBadge({
  status,
  variant = 'neutral',
  size = 'md',
}: StatusBadgeProps) {
  const color = variantColors[variant] ?? variantColors.neutral;
  const isSmall = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: isSmall ? '12px' : '14px',
        padding: isSmall ? '4px 8px' : '4px 12px',
        borderRadius: '999px',
        color,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        fontWeight: 500,
        lineHeight: 1,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
}
