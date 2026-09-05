import Link from 'next/link';
import type { QuickAction } from '@mylife/module-registry';

const SURFACE_EL = '#2A292F';
const TEXT = '#E4E1E9';
const BORDER = 'rgba(255,255,255,0.10)';
const TEXT_SECONDARY = '#D6C3B5';

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;
  return (
    <section style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1.5,
          color: TEXT_SECONDARY,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Quick
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {actions.map((action) => (
          <Link
            key={action.route}
            href={action.route}
            style={{
              background: SURFACE_EL,
              border: `1px solid ${BORDER}`,
              color: TEXT,
              padding: '8px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
