'use client';

import { useState, useTransition } from 'react';
import { toggleAutomationRuleAction } from '@/app/actions';

interface Props {
  ruleId: string;
  label: string;
  description: string;
  clusters: string[];
  initialEnabled: boolean;
}

export function AutomationToggleRow({
  ruleId,
  label,
  description,
  clusters,
  initialEnabled,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        await toggleAutomationRuleAction(ruleId, next);
      } catch (err) {
        // Revert optimistic toggle on failure.
        setEnabled(!next);
        console.error('[automations] toggle failed', err);
      }
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        padding: 20,
        background: '#2A292F',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <h3
            style={{
              color: '#E4E1E9',
              fontSize: 16,
              fontWeight: 600,
              margin: 0,
            }}
          >
            {label}
          </h3>
          {clusters.map((c) => (
            <span
              key={c}
              style={{
                color: '#D6C3B5',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                padding: '2px 8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 999,
              }}
            >
              {c}
            </span>
          ))}
        </div>
        <p style={{ color: '#D6C3B5', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${enabled ? 'Disable' : 'Enable'} ${label}`}
        onClick={handleToggle}
        disabled={isPending}
        style={{
          flexShrink: 0,
          width: 44,
          height: 26,
          borderRadius: 999,
          border: 'none',
          background: enabled ? '#FFB877' : '#52443A',
          position: 'relative',
          cursor: isPending ? 'wait' : 'pointer',
          transition: 'background 160ms ease',
          padding: 0,
          opacity: isPending ? 0.6 : 1,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: enabled ? 21 : 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#131318',
            transition: 'left 160ms ease',
          }}
        />
      </button>
    </div>
  );
}
