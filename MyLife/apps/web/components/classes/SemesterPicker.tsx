'use client';

import { useTransition } from 'react';
import type { SemesterRow } from '@mylife/classes';

export function SemesterPicker({
  semesters,
  selectedId,
  onSelect,
}: {
  semesters: SemesterRow[];
  selectedId: string | null;
  onSelect: (id: string) => Promise<void> | void;
}) {
  const [pending, startTransition] = useTransition();

  if (semesters.length === 0) {
    return (
      <a
        href="/classes/settings"
        style={{
          display: 'inline-block',
          padding: '8px 14px',
          borderRadius: 999,
          border: '1px dashed rgba(59,130,246,0.45)',
          color: 'var(--accent-classes)',
          fontWeight: 700,
          fontSize: 13,
          textDecoration: 'none',
        }}
      >
        + Add a semester
      </a>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {semesters.map((sem) => {
        const active = sem.id === selectedId;
        return (
          <button
            key={sem.id}
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => onSelect(sem.id))}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: active
                ? '1px solid rgba(59,130,246,0.55)'
                : '1px solid var(--border)',
              background: active
                ? 'rgba(59,130,246,0.18)'
                : 'var(--surface-elevated)',
              color: active ? 'var(--text)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {sem.name}
            {sem.is_current === 1 ? (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--accent-classes)',
                }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
