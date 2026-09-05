import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Text, LoadingState, EmptyState, colors, spacing } from '@mylife/ui';
import Svg, { Circle } from 'react-native-svg';
import {
  GlassCard,
  GradientButton,
  ReadingProgressBar,
  BOOKS_SURFACES,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import { useChallenges } from '../../hooks/books/use-challenges';

const BOOKS_ACCENT = colors.modules.books;

const TYPE_OPTIONS = [
  { value: 'books_count', label: 'Books' },
  { value: 'pages_count', label: 'Pages' },
  { value: 'minutes_count', label: 'Minutes' },
  { value: 'themed', label: 'Themed' },
] as const;

type ChallengeType = (typeof TYPE_OPTIONS)[number]['value'];

const TYPE_BADGE_LABELS: Record<ChallengeType, string> = {
  books_count: 'BOOKS',
  pages_count: 'PAGES',
  minutes_count: 'MINUTES',
  themed: 'THEMED',
};

const TIME_FRAME_LABELS: Record<string, string> = {
  yearly: 'ANNUAL PROGRESS',
  monthly: 'MONTHLY',
  weekly: 'WEEKLY',
  custom: 'CUSTOM',
};

function formatEndDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `Ends ${months[d.getMonth()]} ${d.getDate()}`;
}

function formatCompletedDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ];
  return `COMPLETED ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function ProgressRing({
  current,
  target,
  size = 80,
}: {
  current: number;
  target: number;
  size?: number;
}) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? Math.min(current / target, 1) : 0;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={BOOKS_SURFACES.highest}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={BOOKS_ACCENT}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringLabel}>
        <Text style={styles.ringValue}>
          {current}
          <Text style={styles.ringTarget}>/{target}</Text>
        </Text>
      </View>
    </View>
  );
}

export default function ChallengesScreen() {
  const { activeStatuses, loading, create, deactivate, remove } = useChallenges();
  const [showCreate, setShowCreate] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ChallengeType>('books_count');
  const [target, setTarget] = useState('');
  const [timeFrame, setTimeFrame] = useState<'yearly' | 'monthly' | 'weekly' | 'custom'>('yearly');

  const active = activeStatuses.filter((s) => !s.isComplete);
  const completed = activeStatuses.filter((s) => s.isComplete);

  const handleCreate = () => {
    if (!name.trim() || !target) return;
    const now = new Date().toISOString();
    const durations: Record<string, number> = {
      yearly: 365 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      custom: 365 * 24 * 60 * 60 * 1000,
    };
    const endDate = new Date(Date.now() + durations[timeFrame]).toISOString();
    create({
      name: name.trim(),
      description: description.trim() || undefined,
      challenge_type: type,
      target_value: parseInt(target, 10),
      target_unit:
        type === 'books_count' || type === 'themed'
          ? 'books'
          : type === 'pages_count'
            ? 'pages'
            : 'minutes',
      time_frame: timeFrame,
      start_date: now,
      end_date: endDate,
    });
    setName('');
    setDescription('');
    setTarget('');
    setShowCreate(false);
  };

  const handleLongPress = (id: string) => {
    Alert.alert('Challenge', 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', onPress: () => deactivate(id) },
      { text: 'Delete', style: 'destructive', onPress: () => remove(id) },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState rows={3} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>PERSONAL GROWTH</Text>
        <Text style={styles.headerTitle}>Reading{'\n'}Challenges</Text>
      </View>

      {/* Create Button */}
      <GradientButton
        label="+ Create Challenge"
        onPress={() => setShowCreate(true)}
        style={styles.createButton}
      />

      {activeStatuses.length === 0 && (
        <EmptyState
          icon="🎯"
          title="No active challenges"
          message="Set a reading goal to get started!"
          accentColor={BOOKS_ACCENT}
        />
      )}

      {/* Active Challenges */}
      {active.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Active Challenges</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{active.length} ONGOING</Text>
            </View>
          </View>

          {active.map((s) => {
            const remaining = Math.max(0, s.targetValue - s.currentValue);
            const unitLabel =
              s.challenge.target_unit === 'books'
                ? 'books'
                : s.challenge.target_unit === 'pages'
                  ? 'pages'
                  : 'min';
            const isMinutes = s.challenge.challenge_type === 'minutes_count';
            const isThemed = s.challenge.challenge_type === 'themed';

            return (
              <Pressable
                key={s.challenge.id}
                onLongPress={() => handleLongPress(s.challenge.id)}
              >
                <GlassCard level={2} style={styles.challengeCard}>
                  {/* Badge row */}
                  <View style={styles.badgeRow}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {TYPE_BADGE_LABELS[s.challenge.challenge_type as ChallengeType] ?? 'BOOKS'}
                      </Text>
                    </View>
                    <View style={styles.dateCol}>
                      <Text style={styles.dateText}>
                        {formatEndDate(s.challenge.end_date)}
                      </Text>
                      <Text style={styles.timeFrameText}>
                        {TIME_FRAME_LABELS[s.challenge.time_frame] ?? 'CUSTOM'}
                      </Text>
                    </View>
                  </View>

                  {/* Title + Description */}
                  <Text style={styles.challengeTitle}>{s.challenge.name}</Text>
                  {s.challenge.description && (
                    <Text style={styles.challengeDesc}>
                      {s.challenge.description}
                    </Text>
                  )}

                  {/* Progress section */}
                  {isMinutes ? (
                    <View style={styles.minutesProgress}>
                      <View style={styles.minutesMetaRow}>
                        <Text style={styles.progressMeta}>
                          {s.currentValue} / {s.targetValue} {unitLabel}
                        </Text>
                        <Text style={styles.minutesPct}>
                          {s.percentComplete}%
                        </Text>
                      </View>
                      <ReadingProgressBar
                        progress={s.percentComplete / 100}
                        height={6}
                      />
                    </View>
                  ) : isThemed ? (
                    <View style={styles.themedProgress}>
                      <View style={styles.themedRow}>
                        <View style={styles.themedDots}>
                          {Array.from({ length: Math.min(s.targetValue, 10) }).map((_, i) => (
                            <View
                              key={i}
                              style={[
                                styles.themedDot,
                                i < s.currentValue && styles.themedDotFilled,
                              ]}
                            >
                              <Text style={styles.themedDotNum}>{i + 1}</Text>
                            </View>
                          ))}
                        </View>
                        <Text style={styles.progressMeta}>
                          {s.currentValue} of {s.targetValue} books read
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.ringSection}>
                      <ProgressRing
                        current={s.currentValue}
                        target={s.targetValue}
                        size={80}
                      />
                      <View style={styles.ringInfo}>
                        <Text style={styles.ringPercent}>
                          {s.percentComplete}% Completed
                        </Text>
                        <Text style={styles.ringRemaining}>
                          {remaining} {unitLabel} remaining to reach{'\n'}your goal.
                        </Text>
                      </View>
                    </View>
                  )}
                </GlassCard>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Completed Challenges */}
      {completed.length > 0 && (
        <View style={styles.section}>
          <Pressable
            onPress={() => setShowCompleted(!showCompleted)}
            style={styles.completedHeader}
          >
            <Text style={styles.completedIcon}>{'\u2705'}</Text>
            <Text style={styles.sectionTitle}>Completed Challenges</Text>
            <View style={styles.completedCountBadge}>
              <Text style={styles.completedCountText}>{completed.length}</Text>
            </View>
            <Text style={styles.chevron}>{showCompleted ? '\u25B2' : '\u25BC'}</Text>
          </Pressable>

          {showCompleted &&
            completed.map((s) => (
              <GlassCard key={s.challenge.id} level={1} style={styles.completedCard}>
                <View style={styles.completedRow}>
                  <Text style={styles.checkMark}>{'\u2714'}</Text>
                  <View style={styles.completedInfo}>
                    <Text style={styles.completedName}>{s.challenge.name}</Text>
                    <Text style={styles.completedDate}>
                      {formatCompletedDate(s.challenge.updated_at)}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            ))}
        </View>
      )}

      {/* Create Modal */}
      <CreateModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        type={type}
        setType={setType}
        target={target}
        setTarget={setTarget}
        timeFrame={timeFrame}
        setTimeFrame={setTimeFrame}
        onCreate={handleCreate}
      />
    </ScrollView>
  );
}

function CreateModal({
  visible,
  onClose,
  name,
  setName,
  description,
  setDescription,
  type,
  setType,
  target,
  setTarget,
  timeFrame,
  setTimeFrame,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  type: ChallengeType;
  setType: (v: ChallengeType) => void;
  target: string;
  setTarget: (v: string) => void;
  timeFrame: 'yearly' | 'monthly' | 'weekly' | 'custom';
  setTimeFrame: (v: 'yearly' | 'monthly' | 'weekly' | 'custom') => void;
  onCreate: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          <Text style={styles.modalTitle}>New Challenge</Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Challenge name"
            placeholderTextColor={colors.textTertiary}
            selectionColor={BOOKS_ACCENT}
          />

          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textTertiary}
            selectionColor={BOOKS_ACCENT}
            multiline
            numberOfLines={2}
          />

          <Text style={styles.modalLabel}>Type</Text>
          <View style={styles.chipRow}>
            {TYPE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.chip, type === opt.value && styles.chipActive]}
                onPress={() => setType(opt.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    type === opt.value && styles.chipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.modalLabel}>Time Frame</Text>
          <View style={styles.chipRow}>
            {(['yearly', 'monthly', 'weekly'] as const).map((tf) => (
              <Pressable
                key={tf}
                style={[styles.chip, timeFrame === tf && styles.chipActive]}
                onPress={() => setTimeFrame(tf)}
              >
                <Text
                  style={[
                    styles.chipText,
                    timeFrame === tf && styles.chipTextActive,
                  ]}
                >
                  {tf.charAt(0).toUpperCase() + tf.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            value={target}
            onChangeText={setTarget}
            placeholder="Target value"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            selectionColor={BOOKS_ACCENT}
          />

          <View style={styles.modalButtons}>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <GradientButton label="Create" onPress={onCreate} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  headerLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    letterSpacing: 1.2,
    color: BOOKS_ACCENT,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 32,
    color: colors.text,
    lineHeight: 38,
    marginTop: 4,
    letterSpacing: -0.5,
  },

  // Create button
  createButton: { alignSelf: 'flex-start', marginTop: spacing.sm, marginBottom: spacing.md },

  // Section
  section: { marginTop: spacing.lg, gap: spacing.md },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 18,
    color: colors.text,
  },
  countBadge: {
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },

  // Challenge card
  challengeCard: { gap: 12, paddingVertical: 20 },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    backgroundColor: BOOKS_SURFACES.highest,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 1,
    color: BOOKS_ACCENT,
  },
  dateCol: { alignItems: 'flex-end' },
  dateText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  timeFrameText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  challengeTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 24,
    color: colors.text,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  challengeDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Ring progress
  ringSection: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  ringLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: colors.text,
  },
  ringTarget: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  ringInfo: { flex: 1, gap: 4 },
  ringPercent: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  ringRemaining: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Minutes progress
  minutesProgress: { gap: 6, marginTop: 4 },
  minutesMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  minutesPct: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  progressMeta: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Themed progress
  themedProgress: { marginTop: 4 },
  themedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  themedDots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  themedDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: BOOKS_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themedDotFilled: { backgroundColor: BOOKS_ACCENT },
  themedDotNum: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: colors.text,
  },

  // Completed
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedIcon: { fontSize: 16 },
  completedCountBadge: {
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 999,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  completedCountText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  chevron: { fontSize: 10, color: colors.textSecondary, marginLeft: 'auto' },
  completedCard: { opacity: 0.7 },
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkMark: { fontSize: 16, color: colors.textSecondary },
  completedInfo: { flex: 1, gap: 2 },
  completedName: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: colors.textSecondary,
  },
  completedDate: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },

  // Modal
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modal: {
    backgroundColor: BOOKS_SURFACES.lift,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
  },
  modalTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: colors.text,
    marginBottom: 4,
  },
  modalLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  input: {
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 56, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: BOOKS_SURFACES.focus,
  },
  chipActive: { backgroundColor: BOOKS_ACCENT },
  chipText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  chipTextActive: { color: '#1a1008' },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: { paddingHorizontal: 16, paddingVertical: 12 },
  cancelText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
