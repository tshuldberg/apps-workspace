'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ALL_DAYS,
  DAY_LABELS,
  DEFAULT_HOUR_WINDOW,
  buildConflictIndex,
  computeHourWindow,
  getBlockPosition,
  getDayKey,
  getHourRows,
  getNowLinePosition,
  groupBlocksByDay,
  type ConflictIndexEntry,
  type Day,
  type ScheduleConflict,
  type ScheduledBlock,
} from '@mylife/classes';
import { ClassBlock } from './ClassBlock';

const DAY_COL_PX = 140;
const HOUR_PX = 56;

export function WeeklySchedule({
  blocks,
  conflicts,
  showWeekends = true,
}: {
  blocks: ScheduledBlock[];
  conflicts: ScheduleConflict[];
  showWeekends?: boolean;
}) {
  const window = useMemo(
    () => computeHourWindow(blocks, DEFAULT_HOUR_WINDOW),
    [blocks],
  );
  const grouped = useMemo(() => groupBlocksByDay(blocks), [blocks]);
  const conflictIndex = useMemo(() => buildConflictIndex(conflicts), [conflicts]);
  const hourRows = getHourRows(window);
  const totalHeight = hourRows.length * HOUR_PX;

  const visibleDays: Day[] = useMemo(
    () =>
      showWeekends
        ? ALL_DAYS
        : ALL_DAYS.filter((d) => d !== 'sat' && d !== 'sun'),
    [showWeekends],
  );

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const nowDay = getDayKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowPct = getNowLinePosition(nowMinutes, window);
  const nowVisible = nowPct >= 0 && nowPct <= 100 && visibleDays.includes(nowDay);

  const [conflictModal, setConflictModal] = useState<ConflictIndexEntry[] | null>(
    null,
  );

  return (
    <section
      style={{
        borderRadius: 16,
        border: '1px solid var(--glass-border)',
        background: 'var(--glass)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        overflow: 'auto',
      }}
    >
      <div style={{ minWidth: 48 + visibleDays.length * DAY_COL_PX }}>
        {/* Header row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `48px repeat(${visibleDays.length}, ${DAY_COL_PX}px)`,
            background: 'var(--surface-elevated)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div />
          {visibleDays.map((day) => {
            const isToday = day === nowDay;
            return (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  padding: '12px 0',
                  borderLeft: '1px solid var(--border)',
                  background: isToday ? 'rgba(59,130,246,0.10)' : 'transparent',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: isToday
                    ? 'var(--accent-classes)'
                    : 'var(--text-secondary)',
                }}
              >
                {DAY_LABELS[day]}
              </div>
            );
          })}
        </div>

        {/* Body grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `48px repeat(${visibleDays.length}, ${DAY_COL_PX}px)`,
            position: 'relative',
            height: totalHeight,
          }}
        >
          {/* Hour gutter */}
          <div>
            {hourRows.map((hour) => (
              <div
                key={hour}
                style={{
                  height: HOUR_PX,
                  textAlign: 'center',
                  paddingTop: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {visibleDays.map((day) => {
            const isToday = day === nowDay;
            const dayBlocks = grouped[day] ?? [];
            return (
              <div
                key={day}
                style={{
                  position: 'relative',
                  borderLeft: '1px solid var(--border)',
                  background: isToday ? 'rgba(59,130,246,0.04)' : 'transparent',
                }}
              >
                {hourRows.map((hour) => (
                  <div
                    key={hour}
                    style={{
                      height: HOUR_PX,
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  />
                ))}
                {dayBlocks.map((sb, idx) => {
                  const position = getBlockPosition(sb.block, window);
                  const conflictsForCls =
                    conflictIndex
                      .get(sb.cls.id)
                      ?.filter((c) => c.day === day) ?? [];
                  return (
                    <ClassBlock
                      key={`${sb.cls.id}-${day}-${idx}`}
                      cls={sb.cls}
                      block={sb.block}
                      position={position}
                      conflicts={conflictsForCls}
                      onConflictClick={(entries) => setConflictModal(entries)}
                    />
                  );
                })}
                {isToday && nowVisible ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: `${nowPct}%`,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: 'var(--danger, #FFB4AB)',
                      pointerEvents: 'none',
                      opacity: 0.85,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {conflictModal ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setConflictModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 420,
              width: '100%',
              background: 'var(--surface)',
              borderRadius: 18,
              border: '1px solid var(--border)',
              padding: 20,
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
              Schedule Conflicts
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              These classes overlap on the same day. Open one to edit its
              schedule.
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {conflictModal.map((c, idx) => (
                <a
                  key={`${c.otherId}-${idx}`}
                  href={`/classes/class/${c.otherId}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    borderRadius: 12,
                    background: 'var(--surface-elevated)',
                    color: 'var(--text)',
                    textDecoration: 'none',
                  }}
                >
                  <span>
                    <span style={{ fontWeight: 700, display: 'block' }}>
                      {c.otherName}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {DAY_LABELS[c.day]} · {c.overlap_minutes} min overlap
                    </span>
                  </span>
                  <span
                    style={{
                      color: 'var(--accent-classes)',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    Open
                  </span>
                </a>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setConflictModal(null)}
              style={{
                marginTop: 4,
                padding: '12px 16px',
                borderRadius: 10,
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
