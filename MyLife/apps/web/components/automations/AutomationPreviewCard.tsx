'use client';

import { useTransition } from 'react';

interface Props {
  title: string;
  subtitle: string;
  onApply: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
  applyLabel?: string;
  dismissLabel?: string;
}

export function AutomationPreviewCard({
  title,
  subtitle,
  onApply,
  onDismiss,
  applyLabel = 'Apply',
  dismissLabel = 'Dismiss',
}: Props) {
  const [isPending, startTransition] = useTransition();

  const handleApply = () => {
    startTransition(async () => {
      await onApply();
    });
  };

  const handleDismiss = () => {
    startTransition(async () => {
      await onDismiss();
    });
  };

  return (
    <div
      role="region"
      aria-label="Automation preview"
      style={{
        marginTop: 16,
        padding: 20,
        background: 'rgba(255, 184, 119, 0.08)',
        border: '1px solid rgba(255, 184, 119, 0.24)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div>
        <h3
          style={{
            color: '#FFB877',
            fontSize: 14,
            fontWeight: 600,
            margin: '0 0 4px 0',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Automation
        </h3>
        <p
          style={{
            color: '#E4E1E9',
            fontSize: 17,
            fontWeight: 600,
            margin: '0 0 6px 0',
          }}
        >
          {title}
        </p>
        <p style={{ color: '#D6C3B5', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
          {subtitle}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleApply}
          disabled={isPending}
          style={{
            flex: 1,
            padding: '12px 16px',
            fontSize: 15,
            fontWeight: 600,
            color: '#131318',
            background: '#FFB877',
            border: 'none',
            borderRadius: 8,
            cursor: isPending ? 'wait' : 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {applyLabel}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          style={{
            flex: 1,
            padding: '12px 16px',
            fontSize: 15,
            fontWeight: 600,
            color: '#E4E1E9',
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            borderRadius: 8,
            cursor: isPending ? 'wait' : 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}
