import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  calculateClassGrade,
  calculateLatePenalty,
  getActiveTimer,
  getAssignment,
  getClass,
  getDependencyChain,
  getTeacher,
  getTimerElapsedMs,
  isBlocked,
  letterFromPercent,
  listAssignmentsByClass,
  markAssignmentSubmitted,
  pauseAssignmentTimer,
  setAssignmentGrade,
  startAssignmentTimer,
  stopAssignmentTimer,
  updateAssignment,
  type AssignmentRow,
  type AssignmentStatus,
  type AssignmentTimerSnapshot,
  type CategoryWeights,
  type ClassRow,
  type GroupMember,
  type LatePenalty,
  type TeacherRow,
} from '@mylife/classes';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { CLASSES_ACCENT, CLASSES_ACCENT_BORDER, CLASSES_ACCENT_DIM, useClassesFocusedSnapshot } from '../_ui';
import { classesTimerStorage } from '../_time-tracker-storage';

interface DetailSnapshot {
  assignment: AssignmentRow | null;
  cls: ClassRow | null;
  teacher: TeacherRow | null;
  classAssignments: AssignmentRow[];
  dependencyChain: AssignmentRow[];
  blocked: boolean;
  latePenalty: LatePenalty | null;
  groupMembers: GroupMember[];
  weights: CategoryWeights | null;
  classGradePercent: number | null;
  impactWeight: number | null;
}

const STATUS_OPTIONS: AssignmentStatus[] = [
  'not_started',
  'in_progress',
  'submitted',
  'graded',
];

const PRIORITY_TINT: Record<string, string> = {
  low: colors.textTertiary,
  medium: colors.tertiary,
  high: colors.primary,
  critical: colors.danger,
};

function parseGroupMembers(raw: string | null): GroupMember[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GroupMember[]) : [];
  } catch {
    return [];
  }
}

function parseWeights(raw: string | null): CategoryWeights | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as CategoryWeights) : null;
  } catch {
    return null;
  }
}

function statusLabel(status: AssignmentStatus): string {
  switch (status) {
    case 'not_started':
      return 'Not started';
    case 'in_progress':
      return 'In progress';
    case 'submitted':
      return 'Submitted';
    case 'graded':
      return 'Graded';
  }
}

function formatDurationLabel(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.round(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function relativeDue(due: string | null): { label: string; overdue: boolean } {
  if (!due) return { label: 'No due date', overdue: false };
  const dueDate = new Date(due);
  const now = new Date();
  const ms = dueDate.getTime() - now.getTime();
  const days = Math.round(ms / 86400000);
  if (ms < 0) {
    const overdueDays = Math.abs(days);
    return {
      label: overdueDays === 0 ? 'Overdue today' : `Overdue ${overdueDays}d`,
      overdue: true,
    };
  }
  if (days === 0) return { label: 'Due today', overdue: false };
  if (days === 1) return { label: 'Due tomorrow', overdue: false };
  if (days < 7) return { label: `Due in ${days}d`, overdue: false };
  return {
    label: dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    overdue: false,
  };
}

function formatDueAbsolute(due: string | null): string {
  if (!due) return '';
  return new Date(due).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function AssignmentSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [revision, setRevision] = useState(0);
  const [activeTimer, setActiveTimer] = useState<AssignmentTimerSnapshot | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [timerNotice, setTimerNotice] = useState<string | null>(null);
  const [timerBusy, setTimerBusy] = useState(false);
  const [groupDrafts, setGroupDrafts] = useState<GroupMember[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  const [gradeInput, setGradeInput] = useState('');
  const [maxGradeInput, setMaxGradeInput] = useState('100');

  const refreshDetail = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  const snapshot = useClassesFocusedSnapshot<DetailSnapshot>(
    useCallback(() => {
      void revision;
      if (!id) {
        return {
          assignment: null,
          cls: null,
          teacher: null,
          classAssignments: [],
          dependencyChain: [],
          blocked: false,
          latePenalty: null,
          groupMembers: [],
          weights: null,
          classGradePercent: null,
          impactWeight: null,
        };
      }

      const assignment = getAssignment(db, id);
      if (!assignment) {
        return {
          assignment: null,
          cls: null,
          teacher: null,
          classAssignments: [],
          dependencyChain: [],
          blocked: false,
          latePenalty: null,
          groupMembers: [],
          weights: null,
          classGradePercent: null,
          impactWeight: null,
        };
      }

      const cls = getClass(db, assignment.class_id);
      const teacher = cls?.teacher_id ? getTeacher(db, cls.teacher_id) : null;
      const classAssignments = listAssignmentsByClass(db, assignment.class_id);
      const dependencyChain = getDependencyChain(assignment.id, classAssignments);
      const blocked = isBlocked(assignment, classAssignments);
      const latePenalty =
        assignment.due_at && assignment.late_policy
          ? calculateLatePenalty(
              assignment,
              assignment.submitted_at ?? new Date().toISOString(),
            )
          : null;
      const weights = parseWeights(cls?.category_weights ?? null);
      const classGrade = calculateClassGrade(classAssignments, weights);
      const impactWeight =
        assignment.weight ??
        (weights ? weights[assignment.type] ?? null : null);

      return {
        assignment,
        cls: cls ?? null,
        teacher,
        classAssignments,
        dependencyChain,
        blocked,
        latePenalty,
        groupMembers: parseGroupMembers(assignment.group_members),
        weights,
        classGradePercent: classGrade.percent,
        impactWeight,
      };
    }, [db, id, revision]),
  );

  useEffect(() => {
    setGroupDrafts(snapshot.groupMembers);
  }, [snapshot.groupMembers]);

  useEffect(() => {
    setGradeInput(
      snapshot.assignment?.grade !== null && snapshot.assignment?.grade !== undefined
        ? String(snapshot.assignment.grade)
        : '',
    );
    setMaxGradeInput(
      snapshot.assignment?.max_grade !== null && snapshot.assignment?.max_grade !== undefined
        ? String(snapshot.assignment.max_grade)
        : '100',
    );
  }, [snapshot.assignment?.grade, snapshot.assignment?.max_grade]);

  const loadActiveTimer = useCallback(async () => {
    const next = await getActiveTimer(classesTimerStorage);
    setActiveTimer(next);
    setClockNow(Date.now());
  }, []);

  useEffect(() => {
    void loadActiveTimer();
  }, [loadActiveTimer]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadActiveTimer();
      }
    });
    return () => sub.remove();
  }, [loadActiveTimer]);

  useEffect(() => {
    if (!activeTimer?.is_running || activeTimer.assignment_id !== id) {
      return;
    }
    const interval = setInterval(() => {
      setClockNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimer?.assignment_id, activeTimer?.is_running, id]);

  const activeForThisAssignment =
    activeTimer !== null && activeTimer.assignment_id === id;
  const liveElapsedMs =
    activeTimer !== null ? getTimerElapsedMs(activeTimer, clockNow) : 0;

  const due = useMemo(
    () => relativeDue(snapshot.assignment?.due_at ?? null),
    [snapshot.assignment?.due_at],
  );

  const actualMinutes = snapshot.assignment?.actual_minutes ?? 0;
  const estimatedMinutes = snapshot.assignment?.estimated_minutes ?? null;
  const variance =
    estimatedMinutes !== null && estimatedMinutes > 0
      ? actualMinutes - estimatedMinutes
      : null;

  async function handleStartTimer() {
    if (!id) return;
    setTimerBusy(true);
    setTimerNotice(null);
    try {
      const result = await startAssignmentTimer(classesTimerStorage, id);
      setActiveTimer(result.active);
      setClockNow(Date.now());
      if (result.replaced && result.replaced.assignment_id !== id) {
        setTimerNotice('Stopped a timer that was running on another assignment.');
      }
      if (snapshot.assignment?.status === 'not_started') {
        updateAssignment(db, id, { status: 'in_progress' });
        refreshDetail();
      }
    } catch (error) {
      Alert.alert('Timer error', String(error));
    } finally {
      setTimerBusy(false);
    }
  }

  async function handlePauseTimer() {
    setTimerBusy(true);
    try {
      const next = await pauseAssignmentTimer(classesTimerStorage);
      setActiveTimer(next);
      setClockNow(Date.now());
    } catch (error) {
      Alert.alert('Timer error', String(error));
    } finally {
      setTimerBusy(false);
    }
  }

  async function handleStopTimer() {
    if (!id || !snapshot.assignment) return;
    setTimerBusy(true);
    try {
      const stopped = await stopAssignmentTimer(classesTimerStorage);
      setActiveTimer(null);
      setClockNow(Date.now());
      if (!stopped) return;
      if (stopped.assignment_id !== id) {
        setTimerNotice('Stopped a timer that belonged to another assignment.');
        return;
      }
      updateAssignment(db, id, {
        actual_minutes: (snapshot.assignment.actual_minutes ?? 0) + stopped.elapsed_minutes,
      });
      setTimerNotice(`Logged ${stopped.elapsed_minutes} min to this assignment.`);
      refreshDetail();
    } catch (error) {
      Alert.alert('Timer error', String(error));
    } finally {
      setTimerBusy(false);
    }
  }

  function handleSetStatus(next: AssignmentStatus) {
    if (!id || !snapshot.assignment) return;
    try {
      if (next === 'submitted') {
        markAssignmentSubmitted(db, id);
      } else if (next === 'graded') {
        const grade = Number(gradeInput);
        const maxGrade = Number(maxGradeInput);
        if (!Number.isFinite(grade)) {
          Alert.alert('Grade required', 'Enter a numeric grade before marking this as graded.');
          return;
        }
        setAssignmentGrade(
          db,
          id,
          grade,
          Number.isFinite(maxGrade) ? maxGrade : undefined,
        );
      } else {
        updateAssignment(db, id, { status: next });
      }
      refreshDetail();
    } catch (error) {
      Alert.alert('Status update failed', String(error));
    }
  }

  function handleSaveGrade() {
    handleSetStatus('graded');
  }

  function persistGroupMembers(next: GroupMember[]) {
    if (!id) return;
    try {
      updateAssignment(db, id, {
        group_members: next.length > 0 ? next : null,
      });
      refreshDetail();
    } catch (error) {
      Alert.alert('Could not save team', String(error));
    }
  }

  function addGroupMember() {
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    const next = [
      ...groupDrafts,
      {
        name: trimmed,
        responsibilities: newMemberRole.trim() || undefined,
        complete: false,
      },
    ];
    setGroupDrafts(next);
    setNewMemberName('');
    setNewMemberRole('');
    persistGroupMembers(next);
  }

  if (!id) {
    return (
      <View style={styles.errorScreen}>
        <Text variant="heading" style={styles.errorTitle}>
          Missing assignment id
        </Text>
      </View>
    );
  }

  if (!snapshot.assignment) {
    return (
      <View style={styles.errorScreen}>
        <Text variant="heading" style={styles.errorTitle}>
          Assignment not found
        </Text>
        <Text variant="body" color={colors.textSecondary} style={styles.errorBody}>
          The assignment may have been deleted. Return to the assignments list.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/(classes)/assignments')}>
          <Text style={styles.primaryButtonLabel}>Back to assignments</Text>
        </Pressable>
      </View>
    );
  }

  const assignment = snapshot.assignment;
  const classAccent = snapshot.cls?.color || CLASSES_ACCENT;

  return (
    <>
      <Stack.Screen
        options={{
          title: assignment.title,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card elevated style={styles.heroCard}>
          <View style={[styles.heroAccentBar, { backgroundColor: classAccent }]} />
          <View style={styles.heroPills}>
            {snapshot.cls ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(classes)/class/[id]',
                    params: { id: snapshot.cls?.id ?? '' },
                  })
                }
                style={[styles.pill, { borderColor: classAccent }]}
              >
                <Text style={[styles.pillText, { color: classAccent }]}>
                  {snapshot.cls.code || snapshot.cls.name}
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.pill}>
              <Text style={styles.pillText}>{assignment.type}</Text>
            </View>
            <View style={styles.pill}>
              <View
                style={[
                  styles.priorityDot,
                  { backgroundColor: PRIORITY_TINT[assignment.priority] ?? colors.textTertiary },
                ]}
              />
              <Text style={styles.pillText}>{assignment.priority}</Text>
            </View>
          </View>
          <Text style={styles.title}>{assignment.title}</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
            {due.label}
            {assignment.due_at ? ` · ${formatDueAbsolute(assignment.due_at)}` : ''}
          </Text>

          {due.overdue ? (
            <View style={styles.warningChip}>
              <Text style={styles.warningChipText}>Overdue assignment</Text>
            </View>
          ) : null}
          {snapshot.blocked ? (
            <View style={styles.blockedChip}>
              <Text style={styles.blockedChipText}>Blocked by dependency</Text>
            </View>
          ) : null}
        </Card>

        <AssignmentSection title="Status">
          <Card style={styles.sectionCard}>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((status) => {
                const active = assignment.status === status;
                return (
                  <Pressable
                    key={status}
                    onPress={() => handleSetStatus(status)}
                    style={[
                      styles.statusPill,
                      active && { backgroundColor: classAccent, borderColor: classAccent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillLabel,
                        active && { color: colors.background },
                      ]}
                    >
                      {statusLabel(status)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </AssignmentSection>

        <AssignmentSection title="Time Tracking">
          <Card style={styles.sectionCard}>
            <Text variant="caption" color={colors.textSecondary}>
              Estimated: {estimatedMinutes !== null ? `${estimatedMinutes} min` : '—'}
            </Text>
            {activeTimer ? (
              <Text style={styles.timerLabel}>
                {activeForThisAssignment
                  ? activeTimer.is_running
                    ? `Working now · ${formatDurationLabel(liveElapsedMs)}`
                    : `Paused at ${formatDurationLabel(liveElapsedMs)}`
                  : `Another assignment timer is active (${formatDurationLabel(liveElapsedMs)}). Starting here will replace it.`}
              </Text>
            ) : null}
            <View style={styles.timerButtonRow}>
              {!activeForThisAssignment || !activeTimer ? (
                <Pressable
                  onPress={handleStartTimer}
                  disabled={timerBusy}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonLabel}>Start Working</Text>
                </Pressable>
              ) : activeTimer.is_running ? (
                <Pressable onPress={handlePauseTimer} disabled={timerBusy} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonLabel}>Pause</Text>
                </Pressable>
              ) : (
                <Pressable onPress={handleStartTimer} disabled={timerBusy} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonLabel}>Resume</Text>
                </Pressable>
              )}
              {activeForThisAssignment ? (
                <Pressable onPress={handleStopTimer} disabled={timerBusy} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonLabel}>Stop + Log</Text>
                </Pressable>
              ) : null}
            </View>
            <Text variant="body">Actual logged: {actualMinutes} min</Text>
            {variance !== null ? (
              <Text
                variant="caption"
                color={
                  variance > 0
                    ? colors.danger
                    : variance < 0
                      ? colors.success
                      : colors.textSecondary
                }
              >
                {variance === 0
                  ? 'On estimate'
                  : variance > 0
                    ? `${variance} min over estimate`
                    : `${Math.abs(variance)} min under estimate`}
              </Text>
            ) : null}
            {timerNotice ? (
              <Text variant="caption" color={colors.textSecondary}>
                {timerNotice}
              </Text>
            ) : null}
          </Card>
        </AssignmentSection>

        {(assignment.status === 'submitted' || assignment.status === 'graded') ? (
          <AssignmentSection title="Grade">
            <Card style={styles.sectionCard}>
              <View style={styles.gradeRow}>
                <View style={styles.gradeField}>
                  <Text variant="caption" color={colors.textSecondary}>
                    Grade
                  </Text>
                  <TextInput
                    value={gradeInput}
                    onChangeText={setGradeInput}
                    keyboardType="decimal-pad"
                    style={styles.input}
                    placeholder="95"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <View style={styles.gradeField}>
                  <Text variant="caption" color={colors.textSecondary}>
                    Max
                  </Text>
                  <TextInput
                    value={maxGradeInput}
                    onChangeText={setMaxGradeInput}
                    keyboardType="decimal-pad"
                    style={styles.input}
                    placeholder="100"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </View>
              {assignment.grade !== null && assignment.max_grade !== null && assignment.max_grade > 0 ? (
                <Text variant="body">
                  {assignment.grade}/{assignment.max_grade} · {Math.round((assignment.grade / assignment.max_grade) * 100)}%
                  {snapshot.classGradePercent !== null
                    ? ` · class ${letterFromPercent(snapshot.classGradePercent)}`
                    : ''}
                </Text>
              ) : null}
              {snapshot.impactWeight !== null ? (
                <Text variant="caption" color={colors.textSecondary}>
                  Weight: {snapshot.impactWeight}%
                </Text>
              ) : null}
              <Pressable onPress={handleSaveGrade} style={styles.primaryButton}>
                <Text style={styles.primaryButtonLabel}>Save Grade</Text>
              </Pressable>
            </Card>
          </AssignmentSection>
        ) : null}

        <AssignmentSection title="Group Project">
          <Card style={styles.sectionCard}>
            <View style={{ gap: spacing.sm }}>
              {groupDrafts.length === 0 ? (
                <Text variant="body" color={colors.textSecondary}>
                  No members yet. Add the team and assign responsibilities below.
                </Text>
              ) : (
                groupDrafts.map((member, index) => (
                  <View
                    key={`${member.name}-${index}`}
                    style={[
                      styles.memberRow,
                      member.is_me ? styles.memberRowMine : null,
                    ]}
                  >
                    <View style={{ flex: 1, gap: 8 }}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <TextInput
                        value={member.responsibilities ?? ''}
                        onChangeText={(value) =>
                          setGroupDrafts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, responsibilities: value || undefined }
                                : item,
                            ),
                          )
                        }
                        placeholder="Responsibility assignment"
                        placeholderTextColor={colors.textTertiary}
                        style={styles.input}
                      />
                      {member.is_me ? (
                        <Text variant="caption" color={classAccent}>
                          My responsibilities
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.memberControls}>
                      <View style={styles.switchColumn}>
                        <Text variant="caption" color={colors.textSecondary}>
                          Done
                        </Text>
                        <Switch
                          value={!!member.complete}
                          onValueChange={(value) =>
                            setGroupDrafts((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, complete: value }
                                  : item,
                              ),
                            )
                          }
                          trackColor={{ false: colors.surfaceElevated, true: classAccent }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                      <View style={styles.switchColumn}>
                        <Text variant="caption" color={colors.textSecondary}>
                          Mine
                        </Text>
                        <Switch
                          value={!!member.is_me}
                          onValueChange={(value) =>
                            setGroupDrafts((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, is_me: value }
                                  : item,
                              ),
                            )
                          }
                          trackColor={{ false: colors.surfaceElevated, true: classAccent }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                      <Pressable
                        onPress={() =>
                          setGroupDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))
                        }
                        style={styles.removeButton}
                      >
                        <Text style={styles.removeButtonLabel}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}

              <TextInput
                value={newMemberName}
                onChangeText={setNewMemberName}
                placeholder="Add member name"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
              <TextInput
                value={newMemberRole}
                onChangeText={setNewMemberRole}
                placeholder="Responsibility"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
              <View style={styles.groupActionRow}>
                <Pressable onPress={addGroupMember} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonLabel}>Add Member</Text>
                </Pressable>
                <Pressable onPress={() => persistGroupMembers(groupDrafts)} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonLabel}>Save Team</Text>
                </Pressable>
              </View>
            </View>
          </Card>
        </AssignmentSection>

        {assignment.submission_notes ? (
          <AssignmentSection title="Submission Notes">
            <Card style={styles.sectionCard}>
              <Text variant="body" color={colors.textSecondary}>
                {assignment.submission_notes}
              </Text>
            </Card>
          </AssignmentSection>
        ) : null}

        {snapshot.latePenalty && snapshot.latePenalty.penalty_percent > 0 ? (
          <AssignmentSection title="Late Policy">
            <Card style={styles.sectionCard}>
              <Text style={styles.latePenaltyText}>
                Penalty now: -{snapshot.latePenalty.penalty_percent}%
                {snapshot.latePenalty.capped ? ' (capped)' : ''}
              </Text>
            </Card>
          </AssignmentSection>
        ) : null}

        {snapshot.dependencyChain.length > 0 ? (
          <AssignmentSection title="Dependencies">
            <Card style={styles.sectionCard}>
              <View style={{ gap: spacing.sm }}>
                {snapshot.dependencyChain.map((dep) => {
                  const ready = dep.status === 'submitted' || dep.status === 'graded';
                  return (
                    <View key={dep.id} style={styles.dependencyRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="body">{dep.title}</Text>
                        <Text variant="caption" color={colors.textSecondary}>
                          {statusLabel(dep.status)}{dep.due_at ? ` · ${formatDueAbsolute(dep.due_at)}` : ''}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.dependencyBadge,
                          ready ? styles.dependencyBadgeReady : styles.dependencyBadgeBlocked,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dependencyBadgeLabel,
                            { color: ready ? colors.success : colors.primary },
                          ]}
                        >
                          {ready ? 'READY' : 'BLOCKED'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          </AssignmentSection>
        ) : null}

        {assignment.description_md ? (
          <AssignmentSection title="Description">
            <Card style={styles.sectionCard}>
              <Text variant="body" color={colors.textSecondary}>
                {assignment.description_md}
              </Text>
            </Card>
          </AssignmentSection>
        ) : null}

        {(snapshot.cls || snapshot.teacher) ? (
          <AssignmentSection title="Context">
            <Card style={styles.sectionCard}>
              {snapshot.cls ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(classes)/class/[id]',
                      params: { id: snapshot.cls?.id ?? '' },
                    })
                  }
                  style={styles.contextLink}
                >
                  <Text variant="body">Open class</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {snapshot.cls.name}
                  </Text>
                </Pressable>
              ) : null}
              {snapshot.teacher ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(classes)/teacher/[id]',
                      params: { id: snapshot.teacher?.id ?? '' },
                    })
                  }
                  style={styles.contextLink}
                >
                  <Text variant="body">Open teacher</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {snapshot.teacher.name}
                  </Text>
                </Pressable>
              ) : null}
            </Card>
          </AssignmentSection>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  errorScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  errorBody: {
    textAlign: 'center',
    lineHeight: 21,
  },
  heroCard: {
    backgroundColor: CLASSES_ACCENT_DIM,
    borderColor: CLASSES_ACCENT_BORDER,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  heroAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    lineHeight: 21,
  },
  warningChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(147,0,10,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.38)',
  },
  warningChipText: {
    color: colors.danger,
    fontWeight: '700',
  },
  blockedChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,184,119,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,119,0.32)',
  },
  blockedChipText: {
    color: colors.primary,
    fontWeight: '700',
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  sectionCard: {
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  statusPillLabel: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  timerLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    fontWeight: '700',
  },
  timerButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    backgroundColor: CLASSES_ACCENT,
  },
  primaryButtonLabel: {
    color: colors.background,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontWeight: '700',
  },
  gradeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  gradeField: {
    flex: 1,
    gap: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  memberRowMine: {
    borderColor: CLASSES_ACCENT,
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  memberName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.text,
  },
  memberControls: {
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  switchColumn: {
    alignItems: 'center',
    gap: 4,
  },
  removeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeButtonLabel: {
    color: colors.danger,
    fontWeight: '700',
  },
  groupActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  latePenaltyText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 15,
  },
  dependencyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  dependencyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  dependencyBadgeReady: {
    borderColor: colors.success,
    backgroundColor: 'rgba(48,209,88,0.12)',
  },
  dependencyBadgeBlocked: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255,184,119,0.14)',
  },
  dependencyBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  contextLink: {
    paddingVertical: spacing.xs,
    gap: 4,
  },
});
