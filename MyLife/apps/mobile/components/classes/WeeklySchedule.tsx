import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@mylife/ui';
import {
  ALL_DAYS,
  DAY_LABELS,
  DEFAULT_HOUR_WINDOW,
  buildConflictIndex,
  computeHourWindow,
  getActiveDays,
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

const HOUR_PX = 56; // height of each hour row
const NARROW_BREAKPOINT = 480;

export interface WeeklyScheduleProps {
  blocks: ScheduledBlock[];
  conflicts: ScheduleConflict[];
  /** Optional override for hour bounds; otherwise computed from blocks. */
  windowOverride?: { startHour: number; endHour: number };
  /** When true, always show all 7 days even if some are empty. */
  showWeekends?: boolean;
}

interface ConflictModalState {
  conflicts: ConflictIndexEntry[];
}

/**
 * 7-column weekly schedule grid. Renders an absolute-positioned ClassBlock
 * for each (class, day-time) pair within a configurable hour window. On
 * narrow screens (<480px) collapses to days that actually have blocks.
 */
export function WeeklySchedule({
  blocks,
  conflicts,
  windowOverride,
  showWeekends = true,
}: WeeklyScheduleProps) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const isNarrow = width < NARROW_BREAKPOINT;

  const window = useMemo(
    () => windowOverride ?? computeHourWindow(blocks, DEFAULT_HOUR_WINDOW),
    [blocks, windowOverride],
  );
  const grouped = useMemo(() => groupBlocksByDay(blocks), [blocks]);
  const conflictIndex = useMemo(() => buildConflictIndex(conflicts), [conflicts]);
  const hourRows = getHourRows(window);
  const totalHeight = hourRows.length * HOUR_PX;

  const visibleDays: Day[] = useMemo(() => {
    if (!isNarrow) {
      return showWeekends
        ? ALL_DAYS
        : ALL_DAYS.filter((d) => d !== 'sat' && d !== 'sun');
    }
    const active = getActiveDays(blocks);
    return active.length > 0 ? active : ['mon', 'tue', 'wed', 'thu', 'fri'];
  }, [isNarrow, blocks, showWeekends]);

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const nowDay = getDayKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowPct = getNowLinePosition(nowMinutes, window);
  const nowVisible = nowPct >= 0 && nowPct <= 100 && visibleDays.includes(nowDay);

  const [conflictModal, setConflictModal] = useState<ConflictModalState | null>(null);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Day header */}
          <View style={styles.headerRow}>
            <View style={styles.hourGutter} />
            {visibleDays.map((day) => {
              const isToday = day === nowDay;
              return (
                <View
                  key={day}
                  style={[styles.dayHeader, isToday && styles.dayHeaderActive]}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      isToday && styles.dayLabelActive,
                    ]}
                  >
                    {DAY_LABELS[day]}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Grid */}
          <View style={[styles.grid, { height: totalHeight }]}>
            {/* Hour gutter */}
            <View style={styles.hourGutter}>
              {hourRows.map((hour) => (
                <View key={hour} style={[styles.hourCell, { height: HOUR_PX }]}>
                  <Text style={styles.hourLabel}>
                    {String(hour).padStart(2, '0')}:00
                  </Text>
                </View>
              ))}
            </View>

            {/* Day columns */}
            {visibleDays.map((day) => {
              const dayBlocks = grouped[day] ?? [];
              const isToday = day === nowDay;
              return (
                <View
                  key={day}
                  style={[
                    styles.dayColumn,
                    isToday && styles.dayColumnActive,
                  ]}
                >
                  {hourRows.map((hour) => (
                    <View
                      key={hour}
                      style={[styles.hourLine, { height: HOUR_PX }]}
                    />
                  ))}
                  {dayBlocks.map((sb, idx) => {
                    const position = getBlockPosition(sb.block, window);
                    const conflictsForCls =
                      conflictIndex.get(sb.cls.id)?.filter((c) => c.day === day) ??
                      [];
                    return (
                      <ClassBlock
                        key={`${sb.cls.id}-${day}-${idx}`}
                        cls={sb.cls}
                        block={sb.block}
                        position={position}
                        conflicts={conflictsForCls}
                        onConflictPress={(entries) =>
                          setConflictModal({ conflicts: entries })
                        }
                      />
                    );
                  })}
                  {isToday && nowVisible ? (
                    <View
                      pointerEvents="none"
                      style={[styles.nowLine, { top: `${nowPct}%` }]}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Conflict resolver sheet */}
      <Modal
        visible={!!conflictModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConflictModal(null)}
      >
        <Pressable
          style={styles.modalScrim}
          onPress={() => setConflictModal(null)}
        >
          <Pressable style={styles.modalSheet} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Schedule Conflicts</Text>
            <Text style={styles.modalSubtitle}>
              These classes overlap on the same day. Tap a class to edit its
              schedule.
            </Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              {conflictModal?.conflicts.map((c, idx) => (
                <Pressable
                  key={`${c.otherId}-${idx}`}
                  style={styles.conflictRow}
                  onPress={() => {
                    setConflictModal(null);
                    router.push({
                      pathname: '/(classes)/class/[id]',
                      params: { id: c.otherId },
                    });
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.conflictName}>{c.otherName}</Text>
                    <Text style={styles.conflictMeta}>
                      {DAY_LABELS[c.day]} · {c.overlap_minutes} min overlap
                    </Text>
                  </View>
                  <Text style={styles.conflictAction}>Open</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={styles.modalDismiss}
              onPress={() => setConflictModal(null)}
            >
              <Text style={styles.modalDismissText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hourGutter: {
    width: 48,
  },
  dayHeader: {
    width: 96,
    paddingVertical: 10,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  dayHeaderActive: {
    backgroundColor: 'rgba(59,130,246,0.10)',
  },
  dayLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dayLabelActive: {
    color: colors.modules.classes,
  },
  grid: {
    flexDirection: 'row',
  },
  hourCell: {
    paddingTop: 4,
    alignItems: 'center',
  },
  hourLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '600',
  },
  dayColumn: {
    width: 96,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    position: 'relative',
  },
  dayColumnActive: {
    backgroundColor: 'rgba(59,130,246,0.04)',
  },
  hourLine: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.danger,
    opacity: 0.85,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  conflictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  conflictName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  conflictMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  conflictAction: {
    color: colors.modules.classes,
    fontSize: 13,
    fontWeight: '700',
  },
  modalDismiss: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  modalDismissText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
