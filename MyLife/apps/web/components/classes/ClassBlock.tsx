'use client';

import Link from 'next/link';
import {
  type BlockPosition,
  type ClassRow,
  type ConflictIndexEntry,
  type DayTime,
  withAlpha,
} from '@mylife/classes';
import { ConflictBadge } from './ConflictBadge';

export function ClassBlock({
  cls,
  block,
  position,
  conflicts,
  onConflictClick,
}: {
  cls: ClassRow;
  block: DayTime;
  position: BlockPosition;
  conflicts: ConflictIndexEntry[];
  onConflictClick?: (entries: ConflictIndexEntry[]) => void;
}) {
  const accent = cls.color;
  return (
    <Link
      href={`/classes/class/${cls.id}`}
      style={{
        position: 'absolute',
        top: `${position.topPct}%`,
        height: `${Math.max(2, position.heightPct)}%`,
        left: 4,
        right: 4,
        borderRadius: 10,
        border: `1px solid ${withAlpha(accent, 0.6)}`,
        background: withAlpha(accent, 0.18),
        color: accent,
        textDecoration: 'none',
        display: 'flex',
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <span style={{ width: 3, background: accent, flexShrink: 0 }} />
      <span style={{ padding: 6, display: 'grid', gap: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: accent,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {cls.name}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
          {block.start_time}-{block.end_time}
        </span>
        {cls.room ? (
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
            {cls.room}
            {cls.building ? ` · ${cls.building}` : ''}
          </span>
        ) : null}
        {conflicts.length > 0 ? (
          <span
            style={{ marginTop: 4 }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onConflictClick?.(conflicts);
            }}
          >
            <ConflictBadge conflicts={conflicts} />
          </span>
        ) : null}
      </span>
    </Link>
  );
}
