import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  createStudySession,
  getClassesSettings,
  getWeeklySummary,
  listClassesBySemester,
  listSemesters,
  listStudySessionsByDateRange,
  pomodoroSettingsFromUserSettings,
  type ClassRow,
  type StudySessionRow,
  type WeeklySummary,
} from '@mylife/classes';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
  useClassesFocusedSnapshot,
} from './_ui';
import {
  formatRemaining,
  mondayOfWeekISO,
  phaseAccentLabel,
  relativeTimeFrom,
  usePomodoroController,
  type WorkCompletePayload,
} from './_pomodoro';

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function classNameFor(classes: ClassRow[], id: string | null): string {
  if (!id) return 'Unattached';
  return classes.find((c) => c.id === id)?.name ?? 'Unattached';
}

function classColorFor(classes: ClassRow[], id: string | null): string {
  if (!id) return CLASSES_ACCENT;
  return classes.find((c) => c.id === id)?.color ?? CLASSES_ACCENT;
}

function renderStars(rating: number | null): string {
  if (rating === null) return '—';
  return '★'.repeat(Math.max(0, Math.min(5, rating))) +
    '☆'.repeat(Math.max(0, 5 - Math.min(5, rating)));
}

export default function ClassesStudyScreen() {
  const db = useDatabase();
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = () => setRefreshTick((n) => n + 1);
  const [banner, setBanner] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const settings = useClassesFocusedSnapshot(
    useCallback(() => getClassesSettings(db), [db]),
  );
  const semesters = useClassesFocusedSnapshot(
    useCallback(() => listSemesters(db), [db, refreshTick]),
  );
  const currentSemester =
    semesters.find((s) => s.is_current === 1) ?? semesters[0] ?? null;
  const classes = useClassesFocusedSnapshot(
    useCallback(
      () => (currentSemester ? listClassesBySemester(db, currentSemester.id) : []),
      [db, currentSemester?.id, refreshTick],
    ),
  );

  const weekStart = useMemo(() => mondayOfWeekISO(new Date()), [refreshTick]);
  const weekly: WeeklySummary = useClassesFocusedSnapshot(
    useCallback(
      () => getWeeklySummary(db, weekStart),
      [db, weekStart, refreshTick],
    ),
  );

  const recent: StudySessionRow[] = useClassesFocusedSnapshot(
    useCallback(() => {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      return listStudySessionsByDateRange(
        db,
        start.toISOString(),
        end.toISOString(),
      ).slice(-25).reverse();
    }, [db, refreshTick]),
  );

  const pomodoroSettings = useMemo(
    () => pomodoroSettingsFromUserSettings(settings),
    [settings.defaultStudyMinutes, settings.focusBreakMinutes],
  );

  const handleWorkComplete = useCallback(
    (payload: WorkCompletePayload) => {
      try {
        const startedAt = new Date(
          Date.now() - payload.durationMinutes * 60 * 1000,
        ).toISOString();
        createStudySession(db, genId('ses'), {
          class_id: selectedClassId,
          started_at: startedAt,
          duration_minutes: payload.durationMinutes,
          timer_type: 'pomodoro',
          pomodoro_count: payload.completedPomodoros,
        });
        const label = classNameFor(classes, selectedClassId);
        setBanner(`Logged ${payload.durationMinutes} min of ${label}`);
        refresh();
      } catch (err) {
        setBanner(
          `Could not log session: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [db, selectedClassId, classes],
  );

  const controller = usePomodoroController(pomodoroSettings, handleWorkComplete);
  const phaseLabel = phaseAccentLabel(controller.state.phase);
  const remaining = formatRemaining(controller.progress.remainingSeconds);
  const percent = Math.max(0, Math.min(100, controller.progress.percent));

  const topClassHours = weekly.by_class.slice(0, 4);
  const maxClassHours = topClassHours.reduce(
    (max, c) => Math.max(max, c.hours),
    0,
  );

  return (
    <ScrollView style={screenStyles.screen} contentContainerStyle={screenStyles.content}>
      <View style={screenStyles.header}>
        <Text style={screenStyles.eyebrow}>MyClasses</Text>
        <Text style={screenStyles.title}>Study</Text>
        <Text variant="body" color={colors.textSecondary} style={screenStyles.subtitle}>
          Focus blocks log automatically. Pick a class or run an unattached session.
        </Text>
      </View>

      {banner ? (
        <View style={screenStyles.banner}>
          <Text style={screenStyles.bannerText}>{banner}</Text>
          <Pressable onPress={() => setBanner(null)} hitSlop={12}>
            <Text style={screenStyles.bannerDismiss}>Dismiss</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Class picker */}
      {classes.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={screenStyles.chipRow}
        >
          <Pressable
            onPress={() => setSelectedClassId(null)}
            style={[
              screenStyles.chip,
              selectedClassId === null ? screenStyles.chipActive : null,
            ]}
          >
            <Text
              style={[
                screenStyles.chipText,
                selectedClassId === null ? screenStyles.chipTextActive : null,
              ]}
            >
              Unattached
            </Text>
          </Pressable>
          {classes.map((c) => {
            const active = selectedClassId === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setSelectedClassId(c.id)}
                style={[
                  screenStyles.chip,
                  active ? screenStyles.chipActive : null,
                ]}
              >
                <View
                  style={[
                    screenStyles.chipDot,
                    { backgroundColor: c.color || CLASSES_ACCENT },
                  ]}
                />
                <Text
                  style={[
                    screenStyles.chipText,
                    active ? screenStyles.chipTextActive : null,
                  ]}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Active timer card */}
      <Card elevated style={screenStyles.timerCard}>
        <View style={screenStyles.phaseRow}>
          <View style={screenStyles.phaseChip}>
            <Text style={screenStyles.phaseChipText}>{phaseLabel}</Text>
          </View>
          <Text style={screenStyles.pomCount}>
            {controller.state.totalPomodoros} pom
          </Text>
        </View>
        <Text style={screenStyles.timerText}>{remaining}</Text>
        <View style={screenStyles.progressTrack}>
          <View style={[screenStyles.progressFill, { width: `${percent}%` }]} />
        </View>
        <View style={screenStyles.controlRow}>
          {controller.isRunning ? (
            <Pressable
              onPress={controller.pause}
              style={[screenStyles.btn, screenStyles.btnPrimary]}
            >
              <Text style={screenStyles.btnPrimaryText}>Pause</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={controller.start}
              style={[screenStyles.btn, screenStyles.btnPrimary]}
            >
              <Text style={screenStyles.btnPrimaryText}>
                {controller.state.phase === 'idle' ? 'Start' : 'Resume'}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={controller.skip}
            style={[screenStyles.btn, screenStyles.btnSecondary]}
            disabled={controller.state.phase === 'idle'}
          >
            <Text style={screenStyles.btnSecondaryText}>Skip</Text>
          </Pressable>
          <Pressable
            onPress={controller.reset}
            style={[screenStyles.btn, screenStyles.btnSecondary]}
            disabled={controller.state.phase === 'idle'}
          >
            <Text style={screenStyles.btnSecondaryText}>Reset</Text>
          </Pressable>
        </View>
      </Card>

      {/* Weekly summary */}
      <Card style={screenStyles.summaryCard}>
        <Text style={screenStyles.cardTitle}>This week</Text>
        <View style={screenStyles.summaryGrid}>
          <View style={screenStyles.summaryCell}>
            <Text variant="caption" color={colors.textSecondary}>
              Hours
            </Text>
            <Text style={screenStyles.summaryValue}>
              {weekly.total_hours.toFixed(1)}
            </Text>
          </View>
          <View style={screenStyles.summaryCell}>
            <Text variant="caption" color={colors.textSecondary}>
              Days
            </Text>
            <Text style={screenStyles.summaryValue}>{weekly.study_days}</Text>
          </View>
          <View style={screenStyles.summaryCell}>
            <Text variant="caption" color={colors.textSecondary}>
              Streak
            </Text>
            <Text style={screenStyles.summaryValue}>{weekly.streak}d</Text>
          </View>
          <View style={screenStyles.summaryCell}>
            <Text variant="caption" color={colors.textSecondary}>
              Productivity
            </Text>
            <Text style={screenStyles.summaryValue}>
              {weekly.avg_productivity === null
                ? '—'
                : renderStars(Math.round(weekly.avg_productivity))}
            </Text>
          </View>
        </View>

        {topClassHours.length > 0 ? (
          <View style={screenStyles.barList}>
            {topClassHours.map((row) => {
              const barPct =
                maxClassHours > 0 ? (row.hours / maxClassHours) * 100 : 0;
              const color = classColorFor(classes, row.class_id);
              const name = classNameFor(classes, row.class_id);
              return (
                <View
                  key={row.class_id ?? 'unattached'}
                  style={screenStyles.barRow}
                >
                  <Text
                    variant="caption"
                    color={colors.textSecondary}
                    style={screenStyles.barLabel}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  <View style={screenStyles.barTrack}>
                    <View
                      style={[
                        screenStyles.barFill,
                        { width: `${barPct}%`, backgroundColor: color },
                      ]}
                    />
                  </View>
                  <Text variant="caption" color={colors.textSecondary}>
                    {row.hours.toFixed(1)}h
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text variant="caption" color={colors.textTertiary}>
            No study sessions this week yet.
          </Text>
        )}
      </Card>

      {/* Recent sessions */}
      <Card style={screenStyles.summaryCard}>
        <Text style={screenStyles.cardTitle}>Recent sessions</Text>
        {recent.length === 0 ? (
          <Text variant="caption" color={colors.textTertiary}>
            No sessions in the last 7 days.
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {recent.map((s) => {
              const color = classColorFor(classes, s.class_id);
              const name = classNameFor(classes, s.class_id);
              return (
                <Pressable
                  key={s.id}
                  // TODO: route to /(classes)/study/session/{id} once detail screen lands.
                  onPress={() => {}}
                  style={screenStyles.sessionRow}
                >
                  <View
                    style={[screenStyles.sessionStripe, { backgroundColor: color }]}
                  />
                  <View style={screenStyles.sessionBody}>
                    <Text style={screenStyles.sessionName} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {s.duration_minutes}m · {s.location ?? 'No location'} ·{' '}
                      {renderStars(s.productivity_rating)}
                    </Text>
                  </View>
                  <Text variant="caption" color={colors.textTertiary}>
                    {relativeTimeFrom(s.started_at)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const screenStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: { gap: spacing.xs },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: CLASSES_ACCENT,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: colors.text,
  },
  subtitle: { lineHeight: 21 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CLASSES_ACCENT_DIM,
    borderColor: CLASSES_ACCENT_BORDER,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  bannerText: { color: colors.text, fontSize: 13, flex: 1 },
  bannerDismiss: {
    color: CLASSES_ACCENT,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  chipRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: CLASSES_ACCENT_DIM,
  },
  chipDot: { width: 8, height: 8, borderRadius: 999 },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: CLASSES_ACCENT },
  timerCard: {
    backgroundColor: CLASSES_ACCENT_DIM,
    borderColor: CLASSES_ACCENT_BORDER,
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phaseChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(19,24,36,0.55)',
  },
  phaseChipText: {
    color: CLASSES_ACCENT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  pomCount: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  timerText: {
    fontSize: 64,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(19,24,36,0.55)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: CLASSES_ACCENT,
  },
  controlRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: CLASSES_ACCENT },
  btnPrimaryText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: 'rgba(19,24,36,0.82)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  summaryCard: { gap: spacing.sm },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCell: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: 4,
  },
  summaryValue: {
    color: CLASSES_ACCENT,
    fontSize: 18,
    fontWeight: '700',
  },
  barList: { gap: spacing.xs, marginTop: spacing.xs },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barLabel: { width: 96 },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sessionStripe: {
    width: 4,
    height: 36,
    borderRadius: 999,
  },
  sessionBody: { flex: 1, gap: 2 },
  sessionName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
