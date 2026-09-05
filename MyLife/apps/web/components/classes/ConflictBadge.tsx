'use client';

import type { ConflictIndexEntry } from '@mylife/classes';

export function ConflictBadge({
  conflicts,
  onClick,
}: {
  conflicts: ConflictIndexEntry[];
  onClick?: () => void;
}) {
  if (conflicts.length === 0) return null;
  const summary =
    conflicts.length === 1
      ? `Overlaps ${conflicts[0].otherName}`
      : `${conflicts.length} conflicts`;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 999,
        background: 'rgba(255,180,171,0.10)',
        border: '1px solid rgba(255,180,171,0.55)',
        color: 'var(--danger, #FFB4AB)',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: 'var(--danger, #FFB4AB)',
        }}
      />
      {summary}
    </button>
  );
}
