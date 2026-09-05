import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Svg, { Circle } from 'react-native-svg';
import {
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_FONTS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  MaterialSymbol,
  createProject,
  deleteProject,
  deleteSession,
  endSession,
  formatCurrency,
  getAllActiveProjects,
  getHabits,
  getSessionsForHabit,
  startSession,
  updateProject,
  type Habit,
  type Project,
  type TimedSession,
} from '@mylife/habits';
import { LinearGradient } from 'expo-linear-gradient';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  buildProjectSummaries,
  buildSimplePdfReport,
  buildTimeEntries,
  buildTimeReportCsv,
  formatCompactDuration,
  formatStopwatch,
  getActiveTimedSession,
  getPhase3Range,
  type HabitsPhase3PeriodKey,
} from '../../lib/habits/phase3';
import { uuid } from '../../lib/uuid';

type ProjectFormState = {
  id: string | null;
  projectName: string;
  clientName: string;
  hourlyRate: string;
  habitId: string | null;
};

type EntryEditState = {
  id: string;
  duration: string;
};

const PERIOD_OPTIONS: HabitsPhase3PeriodKey[] = ['today', 'week', 'month', 'custom'];
const DONUT_RADIUS = 62;
const DONUT_STROKE = 18;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function shiftDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function emptyProjectForm(project?: Project | null): ProjectFormState {
  return {
    id: project?.id ?? null,
    projectName: project?.projectName ?? '',
    clientName: project?.clientName ?? '',
    hourlyRate: project != null ? String(project.hourlyRate / 100) : '',
    habitId: project?.habitId ?? null,
  };
}

function parseDurationInput(value: string): number | null {
  const parts = value.split(':').map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

function formatDurationInput(totalSeconds: number): string {
  return formatStopwatch(totalSeconds);
}

export default function TimeReportsScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<HabitsPhase3PeriodKey>('week');
  const [customStart, setCustomStart] = useState(shiftDays(-14));
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm());
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [entryEdit, setEntryEdit] = useState<EntryEditState | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());

  const range = useMemo(
    () => getPhase3Range(period, new Date(), { start: customStart, end: customEnd, label: 'Custom' }),
    [customEnd, customStart, period],
  );
  const habits = useMemo(() => getHabits(db, { isArchived: false }), [db, tick]);
  const projects = useMemo(() => getAllActiveProjects(db), [db, tick]);
  const sessions = useMemo<TimedSession[]>(
    () => projects.flatMap((project) => getSessionsForHabit(db, project.habitId)),
    [db, projects, tick],
  );
  const activeSession = getActiveTimedSession(sessions);

  useEffect(() => {
    if (activeSession == null) {
      return;
    }

    const interval = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeSession?.id]);

  const projectSummaries = useMemo(
    () => buildProjectSummaries(projects, habits, sessions, range, clockNow),
    [clockNow, habits, projects, range, sessions],
  );
  const entries = useMemo(
    () => buildTimeEntries(projects, habits, sessions, range, clockNow),
    [clockNow, habits, projects, range, sessions],
  );
  const totalSeconds = projectSummaries.reduce((sum, project) => sum + project.totalSeconds, 0);
  const totalBillable = projectSummaries.reduce((sum, project) => sum + project.billableCents, 0);

  const selectedProjectEntries = entries.filter((entry) => entry.project?.id === selectedProject?.id);
  const activeProject = activeSession != null
    ? projects.find((project) => project.habitId === activeSession.habitId) ?? null
    : null;

  const handleRefresh = () => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setRefreshing(false);
  };

  const handleStartProjectTimer = (project: Project) => {
    if (activeSession != null && activeProject?.id !== project.id) {
      Alert.alert('Timer already running', 'Stop the active session before starting a new project.');
      return;
    }

    if (activeSession != null && activeProject?.id === project.id) {
      handleStopActiveTimer();
      return;
    }

    try {
      startSession(db, uuid(), project.habitId, 0);
      setTick((value) => value + 1);
    } catch {
      Alert.alert('Time Tracking', 'Unable to start the project timer.');
    }
  };

  const handleStopActiveTimer = () => {
    if (activeSession == null) {
      return;
    }

    try {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000),
      );
      endSession(db, activeSession.id, elapsedSeconds);
      setTick((value) => value + 1);
    } catch {
      Alert.alert('Time Tracking', 'Unable to stop the active timer.');
    }
  };

  const openNewProject = () => {
    setProjectForm(emptyProjectForm());
    setShowProjectModal(true);
  };

  const openEditProject = (project: Project) => {
    setSelectedProject(null);
    setProjectForm(emptyProjectForm(project));
    setShowProjectModal(true);
  };

  const handleSaveProject = () => {
    if (!projectForm.projectName.trim() || projectForm.habitId == null) {
      Alert.alert('Project details', 'Add a project name and choose a linked habit.');
      return;
    }

    const hourlyRateCents = Math.round((Number.parseFloat(projectForm.hourlyRate || '0') || 0) * 100);

    try {
      if (projectForm.id != null) {
        updateProject(db, projectForm.id, {
          projectName: projectForm.projectName.trim(),
          clientName: projectForm.clientName.trim() || undefined,
          hourlyRate: hourlyRateCents,
          currency: 'USD',
        });
      } else {
        createProject(db, uuid(), {
          habitId: projectForm.habitId,
          projectName: projectForm.projectName.trim(),
          clientName: projectForm.clientName.trim() || undefined,
          hourlyRate: hourlyRateCents,
          currency: 'USD',
        });
      }
      setShowProjectModal(false);
      setTick((value) => value + 1);
    } catch {
      Alert.alert('Project save failed', 'Unable to save this project right now.');
    }
  };

  const handleDeleteProject = (project: Project) => {
    Alert.alert(
      'Delete project?',
      'The project row will be removed. Existing time entries stay on the linked habit history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteProject(db, project.id);
            if (selectedProject?.id === project.id) {
              setSelectedProject(null);
            }
            setTick((value) => value + 1);
          },
        },
      ],
    );
  };

  const handleDeleteEntry = (sessionId: string) => {
    Alert.alert(
      'Delete time entry?',
      'This removes the logged session from reports and project totals.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteSession(db, sessionId);
            setTick((value) => value + 1);
          },
        },
      ],
    );
  };

  const handleSaveEntryEdit = () => {
    if (entryEdit == null) {
      return;
    }

    const totalSeconds = parseDurationInput(entryEdit.duration);
    if (totalSeconds == null || totalSeconds < 0) {
      Alert.alert('Duration format', 'Use MM:SS or HH:MM:SS.');
      return;
    }

    try {
      endSession(db, entryEdit.id, totalSeconds);
      setEntryEdit(null);
      setTick((value) => value + 1);
    } catch {
      Alert.alert('Time entry', 'Unable to update that session.');
    }
  };

  const exportReport = async (format: 'csv' | 'pdf') => {
    if (projectSummaries.length === 0) {
      Alert.alert('No report data', 'Create a project or log time before exporting.');
      return;
    }

    const sharingAvailable = await Sharing.isAvailableAsync();
    if (!sharingAvailable) {
      Alert.alert('Sharing unavailable', 'This device cannot share files right now.');
      return;
    }

    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDir) {
      Alert.alert('Export failed', 'No writable directory is available.');
      return;
    }

    try {
      if (format === 'csv') {
        const csv = buildTimeReportCsv(projects, sessions, range, clockNow);
        const fileUri = `${baseDir}myhabits-time-report-${Date.now()}.csv`;
        await FileSystem.writeAsStringAsync(fileUri, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export time report CSV',
        });
        return;
      }

      const lines = [
        `${range.label} • ${range.start} to ${range.end}`,
        `Total tracked: ${formatCompactDuration(totalSeconds)}`,
        `Billable value: ${formatCurrency(totalBillable, 'USD')}`,
        '',
        ...projectSummaries.slice(0, 6).map(
          (project) =>
            `${project.project.projectName} • ${formatCompactDuration(project.totalSeconds)} • ${formatCurrency(project.billableCents, project.project.currency)}`,
        ),
        '',
        ...entries.slice(0, 12).map(
          (entry) =>
            `${entry.project?.projectName ?? 'Unassigned'} • ${entry.startedAtLabel} • ${entry.durationLabel}`,
        ),
      ];
      const pdf = buildSimplePdfReport('MyHabits Time Tracking Report', lines);
      const fileUri = `${baseDir}myhabits-time-report-${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, pdf, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Export time report PDF',
      });
    } catch {
      Alert.alert('Export failed', 'The report could not be generated.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={HB_ACCENT_LIGHT} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <MaterialSymbol name="arrow_back" size={20} color={HB_TEXT} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>Mission Control</Text>
            <Text style={styles.headerTitle}>Time Tracking</Text>
          </View>
          <Pressable onPress={() => exportReport('csv')} style={styles.headerButton}>
            <MaterialSymbol name="download" size={20} color={HB_ACCENT_LIGHT} />
          </Pressable>
        </View>

        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Project time, live timer, clean exports.</Text>
          <Text style={styles.heroSubtitle}>
            Run one active session at a time, split hours by project, and keep billable totals visible.
          </Text>
        </View>

        {activeSession != null && activeProject != null ? (
          <GlassCard level={2} style={styles.activeTimerCard}>
            <View style={styles.activePulse} />
            <View style={styles.activeCopy}>
              <Text style={styles.activeLabel}>Current session</Text>
              <Text style={styles.activeTitle}>{activeProject.projectName}</Text>
              <Text style={styles.activeBody}>{formatStopwatch(Math.max(0, Math.floor((clockNow - new Date(activeSession.startedAt).getTime()) / 1000)))}</Text>
            </View>
            <Pressable onPress={handleStopActiveTimer} style={styles.stopButton}>
              <LinearGradient
                colors={[HB_ACCENT_LIGHT, HB_ACCENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.stopButtonGradient}
              >
                <MaterialSymbol name="stop_circle" size={18} color="#130F1D" filled />
                <Text style={styles.stopButtonText}>Stop</Text>
              </LinearGradient>
            </Pressable>
          </GlassCard>
        ) : null}

        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((option) => {
            const selected = period === option;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  if (option === 'custom') {
                    setShowCustomRange(true);
                  } else {
                    setPeriod(option);
                  }
                }}
                style={[styles.periodChip, selected && styles.periodChipSelected]}
              >
                <Text style={[styles.periodChipText, selected && styles.periodChipTextSelected]}>
                  {option === 'today'
                    ? 'Today'
                    : option === 'week'
                      ? 'This Week'
                      : option === 'month'
                        ? 'This Month'
                        : 'Custom'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <GlassCard level={2} style={styles.heroCard}>
          <Text style={styles.heroCardLabel}>Tracked hours</Text>
          <Text style={styles.heroCardValue}>{formatCompactDuration(totalSeconds)}</Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <MaterialSymbol name="payments" size={14} color={HB_ACCENT_LIGHT} />
              <Text style={styles.heroMetaText}>{formatCurrency(totalBillable, 'USD')} billable</Text>
            </View>
            <View style={styles.heroMetaPill}>
              <MaterialSymbol name="folder" size={14} color={HB_ACCENT_LIGHT} />
              <Text style={styles.heroMetaText}>{projectSummaries.length} projects</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard level={1} style={styles.chartCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Project distribution</Text>
            <Text style={styles.cardMeta}>{range.label}</Text>
          </View>
          {projectSummaries.length === 0 ? (
            <Text style={styles.placeholderText}>Create a project to see the donut breakdown.</Text>
          ) : (
            <View style={styles.donutLayout}>
              <Svg width={160} height={160}>
                <Circle
                  cx="80"
                  cy="80"
                  r={DONUT_RADIUS}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={DONUT_STROKE}
                  fill="transparent"
                />
                {(() => {
                  let consumed = 0;
                  return projectSummaries.map((project) => {
                    const fraction = project.totalSeconds / Math.max(1, totalSeconds);
                    const length = DONUT_CIRCUMFERENCE * fraction;
                    const dashOffset = DONUT_CIRCUMFERENCE - consumed;
                    consumed += length;
                    return (
                      <Circle
                        key={project.project.id}
                        cx="80"
                        cy="80"
                        r={DONUT_RADIUS}
                        stroke={project.color}
                        strokeWidth={DONUT_STROKE}
                        strokeLinecap="round"
                        strokeDasharray={`${length} ${DONUT_CIRCUMFERENCE}`}
                        strokeDashoffset={dashOffset}
                        fill="transparent"
                        rotation={-90}
                        origin="80,80"
                      />
                    );
                  });
                })()}
              </Svg>
              <View style={styles.donutCenter}>
                <Text style={styles.donutCenterValue}>{projectSummaries.length}</Text>
                <Text style={styles.donutCenterLabel}>Projects</Text>
              </View>
              <View style={styles.legendList}>
                {projectSummaries.map((project) => (
                  <View key={project.project.id} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: project.color }]} />
                    <View style={styles.legendCopy}>
                      <Text style={styles.legendTitle}>{project.project.projectName}</Text>
                      <Text style={styles.legendBody}>{formatCompactDuration(project.totalSeconds)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </GlassCard>

        <GlassCard level={1} style={styles.listCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Projects</Text>
            <Pressable onPress={openNewProject} style={styles.inlineButton}>
              <MaterialSymbol name="add" size={16} color={HB_ACCENT_LIGHT} />
              <Text style={styles.inlineButtonText}>New Project</Text>
            </Pressable>
          </View>
          {projectSummaries.length === 0 ? (
            <Text style={styles.placeholderText}>
              Add a project and link it to a habit so tracked sessions roll into reports.
            </Text>
          ) : (
            projectSummaries.map((summary, index) => (
              <Pressable
                key={summary.project.id}
                onPress={() => setSelectedProject(summary.project)}
                style={[styles.projectRow, index < projectSummaries.length - 1 && styles.rowDivider]}
              >
                <View style={[styles.projectColor, { backgroundColor: summary.color }]} />
                <View style={styles.projectCopy}>
                  <Text style={styles.projectTitle}>{summary.project.projectName}</Text>
                  <Text style={styles.projectBody}>
                    {summary.habit?.name ?? 'Unassigned habit'} • {formatCurrency(summary.billableCents, summary.project.currency)}
                  </Text>
                </View>
                <View style={styles.projectActions}>
                  <Text style={styles.projectHours}>{formatCompactDuration(summary.totalSeconds)}</Text>
                  <Pressable onPress={() => handleStartProjectTimer(summary.project)} style={styles.playButton}>
                    <MaterialSymbol
                      name={summary.isActive ? 'stop' : 'play_arrow'}
                      size={18}
                      color={summary.isActive ? '#130F1D' : HB_ACCENT_LIGHT}
                      filled={summary.isActive}
                    />
                  </Pressable>
                </View>
              </Pressable>
            ))
          )}
        </GlassCard>

        <GlassCard level={1} style={styles.listCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Time log</Text>
            <View style={styles.exportActions}>
              <Pressable onPress={() => exportReport('csv')} style={styles.inlineButton}>
                <MaterialSymbol name="download" size={16} color={HB_ACCENT_LIGHT} />
                <Text style={styles.inlineButtonText}>CSV</Text>
              </Pressable>
              <Pressable onPress={() => exportReport('pdf')} style={styles.inlineButton}>
                <MaterialSymbol name="picture_as_pdf" size={16} color={HB_ACCENT_LIGHT} />
                <Text style={styles.inlineButtonText}>PDF</Text>
              </Pressable>
            </View>
          </View>
          {entries.length === 0 ? (
            <Text style={styles.placeholderText}>No sessions landed in this date range yet.</Text>
          ) : (
            entries.map((entry, index) => (
              <View key={entry.session.id} style={[styles.entryRow, index < entries.length - 1 && styles.rowDivider]}>
                <View style={[styles.entryAccent, { backgroundColor: entry.color }]} />
                <View style={styles.entryCopy}>
                  <Text style={styles.entryTitle}>{entry.project?.projectName ?? entry.habit?.name ?? 'Unassigned'}</Text>
                  <Text style={styles.entryBody}>
                    {entry.startedAtLabel} • {entry.durationLabel}
                    {entry.amountLabel ? ` • ${entry.amountLabel}` : ''}
                  </Text>
                </View>
                <View style={styles.entryActions}>
                  <Pressable
                    onPress={() => setEntryEdit({ id: entry.session.id, duration: formatDurationInput(entry.totalSeconds) })}
                    style={styles.entryAction}
                  >
                    <MaterialSymbol name="edit" size={16} color={HB_TEXT_SECONDARY} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteEntry(entry.session.id)} style={styles.entryAction}>
                    <MaterialSymbol name="delete" size={16} color={HB_TEXT_SECONDARY} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </GlassCard>
      </ScrollView>

      <Modal visible={showCustomRange} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <GlassCard level={3} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Custom range</Text>
            <TextInput
              value={customStart}
              onChangeText={setCustomStart}
              style={styles.modalInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={HB_TEXT_TERTIARY}
            />
            <TextInput
              value={customEnd}
              onChangeText={setCustomEnd}
              style={styles.modalInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={HB_TEXT_TERTIARY}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowCustomRange(false)} style={styles.modalSecondary}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setPeriod('custom');
                  setShowCustomRange(false);
                }}
                style={styles.modalPrimaryWrap}
              >
                <LinearGradient
                  colors={[HB_ACCENT_LIGHT, HB_ACCENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalPrimary}
                >
                  <Text style={styles.modalPrimaryText}>Apply range</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={showProjectModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <GlassCard level={3} style={styles.modalCard}>
            <Text style={styles.modalTitle}>{projectForm.id ? 'Edit project' : 'New project'}</Text>
            <TextInput
              value={projectForm.projectName}
              onChangeText={(value) => setProjectForm((current) => ({ ...current, projectName: value }))}
              style={styles.modalInput}
              placeholder="Project name"
              placeholderTextColor={HB_TEXT_TERTIARY}
            />
            <TextInput
              value={projectForm.clientName}
              onChangeText={(value) => setProjectForm((current) => ({ ...current, clientName: value }))}
              style={styles.modalInput}
              placeholder="Client name (optional)"
              placeholderTextColor={HB_TEXT_TERTIARY}
            />
            <TextInput
              value={projectForm.hourlyRate}
              onChangeText={(value) => setProjectForm((current) => ({ ...current, hourlyRate: value.replace(/[^0-9.]/g, '') }))}
              style={styles.modalInput}
              placeholder="Hourly rate in dollars"
              placeholderTextColor={HB_TEXT_TERTIARY}
              keyboardType="decimal-pad"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.habitChips}>
              {habits.map((habit: Habit) => {
                const selected = projectForm.habitId === habit.id;
                return (
                  <Pressable
                    key={habit.id}
                    onPress={() => setProjectForm((current) => ({ ...current, habitId: habit.id }))}
                    style={[styles.habitChip, selected && styles.habitChipSelected]}
                  >
                    <View style={[styles.habitChipDot, { backgroundColor: habit.color ?? HB_ACCENT_LIGHT }]} />
                    <Text style={[styles.habitChipText, selected && styles.habitChipTextSelected]}>
                      {habit.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowProjectModal(false)} style={styles.modalSecondary}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              {projectForm.id != null ? (
                <Pressable
                  onPress={() => {
                    if (projectForm.id == null) {
                      return;
                    }
                    const project = projects.find((item) => item.id === projectForm.id);
                    if (project != null) {
                      setShowProjectModal(false);
                      handleDeleteProject(project);
                    }
                  }}
                  style={styles.modalSecondary}
                >
                  <Text style={styles.modalSecondaryText}>Delete</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={handleSaveProject} style={styles.modalPrimaryWrap}>
                <LinearGradient
                  colors={[HB_ACCENT_LIGHT, HB_ACCENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalPrimary}
                >
                  <Text style={styles.modalPrimaryText}>Save project</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={selectedProject != null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <GlassCard level={3} style={[styles.modalCard, styles.detailModal]}>
            <View style={styles.cardHeader}>
              <Text style={styles.modalTitle}>{selectedProject?.projectName ?? 'Project detail'}</Text>
              {selectedProject != null ? (
                <Pressable onPress={() => openEditProject(selectedProject)} style={styles.inlineButton}>
                  <MaterialSymbol name="edit" size={16} color={HB_ACCENT_LIGHT} />
                  <Text style={styles.inlineButtonText}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {selectedProjectEntries.length === 0 ? (
                <Text style={styles.placeholderText}>No entries for this project in the selected range.</Text>
              ) : (
                selectedProjectEntries.map((entry, index) => (
                  <View key={entry.session.id} style={[styles.entryRow, index < selectedProjectEntries.length - 1 && styles.rowDivider]}>
                    <View style={[styles.entryAccent, { backgroundColor: entry.color }]} />
                    <View style={styles.entryCopy}>
                      <Text style={styles.entryTitle}>{entry.startedAtLabel}</Text>
                      <Text style={styles.entryBody}>{entry.durationLabel}</Text>
                    </View>
                    <View style={styles.entryActions}>
                      <Pressable
                        onPress={() => setEntryEdit({ id: entry.session.id, duration: formatDurationInput(entry.totalSeconds) })}
                        style={styles.entryAction}
                      >
                        <MaterialSymbol name="edit" size={16} color={HB_TEXT_SECONDARY} />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            <Pressable onPress={() => setSelectedProject(null)} style={styles.modalSecondary}>
              <Text style={styles.modalSecondaryText}>Close</Text>
            </Pressable>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={entryEdit != null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <GlassCard level={3} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit time entry</Text>
            <TextInput
              value={entryEdit?.duration ?? ''}
              onChangeText={(value) => setEntryEdit((current) => (current == null ? current : { ...current, duration: value }))}
              style={styles.modalInput}
              placeholder="HH:MM:SS"
              placeholderTextColor={HB_TEXT_TERTIARY}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEntryEdit(null)} style={styles.modalSecondary}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSaveEntryEdit} style={styles.modalPrimaryWrap}>
                <LinearGradient
                  colors={[HB_ACCENT_LIGHT, HB_ACCENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalPrimary}
                >
                  <Text style={styles.modalPrimaryText}>Save entry</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  container: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 18,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: HB_SURFACES.low,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: HB_ACCENT_LIGHT,
  },
  headerTitle: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: HB_TEXT,
  },
  heroCopy: {
    gap: 6,
  },
  heroTitle: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1,
    color: HB_TEXT,
  },
  heroSubtitle: {
    fontFamily: HB_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: HB_TEXT_SECONDARY,
  },
  activeTimerCard: {
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  activePulse: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: HB_ACCENT,
    shadowColor: HB_ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  activeCopy: {
    flex: 1,
    gap: 2,
  },
  activeLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: HB_ACCENT_LIGHT,
  },
  activeTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  activeBody: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1,
    color: HB_TEXT,
  },
  stopButton: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  stopButtonGradient: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stopButtonText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 16,
    color: '#130F1D',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.low,
    alignItems: 'center',
  },
  periodChipSelected: {
    backgroundColor: HB_ACCENT,
  },
  periodChipText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 12,
    lineHeight: 14,
    color: HB_TEXT_SECONDARY,
  },
  periodChipTextSelected: {
    color: '#130F1D',
  },
  heroCard: {
    borderRadius: 26,
    gap: 14,
  },
  heroCardLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: HB_TEXT_TERTIARY,
  },
  heroCardValue: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1.6,
    color: HB_TEXT,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.12)',
  },
  heroMetaText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 14,
    color: HB_TEXT_SECONDARY,
  },
  chartCard: {
    borderRadius: 26,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  cardMeta: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
  },
  donutLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  donutCenter: {
    position: 'absolute',
    left: 44,
    top: 62,
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterValue: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    color: HB_TEXT,
  },
  donutCenterLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: HB_TEXT_TERTIARY,
  },
  legendList: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendCopy: {
    flex: 1,
    gap: 2,
  },
  legendTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  legendBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  listCard: {
    borderRadius: 26,
    gap: 4,
  },
  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.low,
  },
  inlineButtonText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 14,
    color: HB_TEXT_SECONDARY,
  },
  placeholderText: {
    marginTop: 8,
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  projectColor: {
    width: 10,
    height: 44,
    borderRadius: 999,
  },
  projectCopy: {
    flex: 1,
    gap: 2,
  },
  projectTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  projectBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  projectActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  projectHours: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.14)',
  },
  exportActions: {
    flexDirection: 'row',
    gap: 8,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  entryAccent: {
    width: 10,
    height: 44,
    borderRadius: 999,
  },
  entryCopy: {
    flex: 1,
    gap: 2,
  },
  entryTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  entryBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  entryActions: {
    flexDirection: 'row',
    gap: 6,
  },
  entryAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HB_SURFACES.low,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,15,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    gap: 14,
  },
  detailModal: {
    maxHeight: '80%',
  },
  modalTitle: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.8,
    color: HB_TEXT,
  },
  modalInput: {
    borderRadius: 18,
    backgroundColor: HB_SURFACES.low,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: HB_FONTS.medium,
    fontSize: 15,
    color: HB_TEXT,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  modalSecondary: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HB_SURFACES.low,
  },
  modalSecondaryText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 16,
    color: HB_TEXT,
  },
  modalPrimaryWrap: {
    flex: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  modalPrimary: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 16,
    color: '#130F1D',
  },
  habitChips: {
    gap: 10,
  },
  habitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.low,
  },
  habitChipSelected: {
    backgroundColor: 'rgba(139,92,246,0.18)',
  },
  habitChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  habitChipText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
  },
  habitChipTextSelected: {
    color: HB_TEXT,
  },
});
