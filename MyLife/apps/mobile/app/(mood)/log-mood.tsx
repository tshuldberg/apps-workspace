import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uuid } from '../../lib/uuid';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import {
  Camera,
  Mic,
  Dumbbell,
  Users,
  Briefcase,
  Moon,
  TreePine,
  UtensilsCrossed,
} from 'lucide-react-native';
import {
  createMoodEntry,
  getActivities,
  seedDefaultActivities,
  getSetting,
  getPet,
  updatePetStats,
  createPetActivity,
  getPetActivitiesToday,
  feedPet,
  getMoodEntryCount,
  type PlutchikEmotion,
  type MoodActivity,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { PhotoPicker } from '../../components/mood/PhotoPicker';
import { VoiceRecorder } from '../../components/mood/VoiceRecorder';
import {
  GlassCard,
  GradientButton,
  EmotionChip,
  MOOD_ACCENT,
  MOOD_SURFACES,
  MOOD_TYPOGRAPHY,
  MOOD_SCORE_COLORS,
  type MoodScore,
} from '@mylife/mood/ui';

// ── Wheel axes (simplified Plutchik for visual) ─────────────────────────

const WHEEL_AXES = [
  { label: 'JOY', emotion: 'joy' as PlutchikEmotion, angle: -90 },
  { label: 'TRUST', emotion: 'trust' as PlutchikEmotion, angle: -90 + 72 },
  { label: 'FEAR', emotion: 'fear' as PlutchikEmotion, angle: -90 + 144 },
  { label: 'SURPRISE', emotion: 'surprise' as PlutchikEmotion, angle: -90 + 216 },
  { label: 'SADNESS', emotion: 'sadness' as PlutchikEmotion, angle: -90 + 288 },
] as const;

// Map activity names to icons
const ACTIVITY_ICON_MAP: Record<string, typeof Dumbbell> = {
  exercise: Dumbbell,
  social: Users,
  work: Briefcase,
  sleep: Moon,
  outdoors: TreePine,
  nutrition: UtensilsCrossed,
};

// Slider emoji markers
const SLIDER_EMOJIS = [
  { emoji: '\uD83D\uDE1E', position: 0.0 },   // sad
  { emoji: '\uD83D\uDE10', position: 0.33 },   // neutral
  { emoji: '\uD83D\uDE0A', position: 0.67 },   // happy
  { emoji: '\uD83D\uDE04', position: 1.0 },    // elated
] as const;

// ── Plutchik Wheel (SVG) ────────────────────────────────────────────────

function PlutchikWheel({
  selectedEmotions,
  onToggleEmotion,
}: {
  selectedEmotions: PlutchikEmotion[];
  onToggleEmotion: (emotion: PlutchikEmotion) => void;
}) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 105;
  const innerR = 30;
  const labelR = outerR + 20;
  const segmentAngle = 360 / WHEEL_AXES.length;

  const degToRad = (deg: number) => (deg * Math.PI) / 180;

  const getPoint = (angleDeg: number, r: number) => ({
    x: cx + r * Math.cos(degToRad(angleDeg)),
    y: cy + r * Math.sin(degToRad(angleDeg)),
  });

  const segments = WHEEL_AXES.map((axis, i) => {
    const startAngle = axis.angle - segmentAngle / 2;
    const endAngle = axis.angle + segmentAngle / 2;
    const selected = selectedEmotions.includes(axis.emotion);

    // Outer arc points
    const outerStart = getPoint(startAngle, outerR);
    const outerEnd = getPoint(endAngle, outerR);
    // Inner arc points
    const innerStart = getPoint(startAngle, innerR);
    const innerEnd = getPoint(endAngle, innerR);

    // SVG path: outer arc -> line to inner end -> inner arc back -> close
    const largeArc = segmentAngle > 180 ? 1 : 0;
    const path = [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
      'Z',
    ].join(' ');

    // Label position
    const labelPos = getPoint(axis.angle, labelR);

    return { ...axis, path, selected, labelPos, index: i };
  });

  return (
    <View style={wheelStyles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        {segments.map((seg) => (
          <Path
            key={`bg-${seg.label}`}
            d={seg.path}
            fill={MOOD_SURFACES.focus}
            stroke={MOOD_SURFACES.lift}
            strokeWidth={1}
          />
        ))}
        {/* Selected segments */}
        {segments
          .filter((s) => s.selected)
          .map((seg) => (
            <Path
              key={`sel-${seg.label}`}
              d={seg.path}
              fill={`${MOOD_ACCENT}40`}
              stroke={MOOD_ACCENT}
              strokeWidth={1.5}
            />
          ))}
        {/* Labels */}
        {segments.map((seg) => (
          <SvgText
            key={`lbl-${seg.label}`}
            x={seg.labelPos.x}
            y={seg.labelPos.y}
            fill={seg.selected ? MOOD_ACCENT : colors.textSecondary}
            fontSize={10}
            fontWeight="600"
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {seg.label}
          </SvgText>
        ))}
        {/* Radial lines */}
        {segments.map((seg) => {
          const startAngle = seg.angle - 360 / WHEEL_AXES.length / 2;
          const inner = getPoint(startAngle, innerR);
          const outer = getPoint(startAngle, outerR);
          return (
            <Path
              key={`line-${seg.label}`}
              d={`M ${inner.x} ${inner.y} L ${outer.x} ${outer.y}`}
              stroke={MOOD_SURFACES.lift}
              strokeWidth={0.5}
            />
          );
        })}
      </Svg>
      {/* Invisible pressable overlays for each segment */}
      {segments.map((seg) => {
        const hitCenter = getPoint(seg.angle, (outerR + innerR) / 2);
        const hitSize = 60;
        return (
          <Pressable
            key={`hit-${seg.label}`}
            onPress={() => onToggleEmotion(seg.emotion)}
            style={[
              wheelStyles.hitArea,
              {
                left: hitCenter.x - hitSize / 2,
                top: hitCenter.y - hitSize / 2,
                width: hitSize,
                height: hitSize,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const wheelStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: 260,
    height: 260,
  },
  hitArea: {
    position: 'absolute',
    borderRadius: 30,
  },
});

// ── Mood Intensity Slider ───────────────────────────────────────────────

function MoodIntensitySlider({
  score,
  onChange,
}: {
  score: number;
  onChange: (v: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const animValue = useRef(new Animated.Value(score)).current;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: score,
      useNativeDriver: false,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [score, animValue]);

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const scoreFromX = (x: number) => {
    if (trackWidth <= 0) return score;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    return Math.max(1, Math.min(10, Math.round(ratio * 9) + 1));
  };

  const handleTouch = (e: GestureResponderEvent) => {
    onChange(scoreFromX(e.nativeEvent.locationX));
  };

  const fillWidth = trackWidth > 0
    ? animValue.interpolate({
        inputRange: [1, 10],
        outputRange: [0, trackWidth],
        extrapolate: 'clamp',
      })
    : 0;

  const thumbLeft = trackWidth > 0
    ? animValue.interpolate({
        inputRange: [1, 10],
        outputRange: [-10, trackWidth - 10],
        extrapolate: 'clamp',
      })
    : 0;

  const scoreColor = MOOD_SCORE_COLORS[Math.max(1, Math.min(10, score)) as MoodScore];

  return (
    <GlassCard level={2}>
      {/* Header row */}
      <View style={sliderStyles.headerRow}>
        <RNText style={sliderStyles.label}>MOOD INTENSITY</RNText>
        <View style={sliderStyles.scoreDisplay}>
          <RNText style={[sliderStyles.scoreValue, { color: scoreColor }]}>
            {score}
          </RNText>
          <RNText style={sliderStyles.scoreDenom}>/10</RNText>
        </View>
      </View>

      {/* Slider track */}
      <View
        style={sliderStyles.trackContainer}
        onLayout={handleTrackLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
      >
        <View style={sliderStyles.trackBg} />
        <Animated.View
          style={[
            sliderStyles.trackFill,
            { width: fillWidth, backgroundColor: scoreColor },
          ]}
        />
        <Animated.View
          style={[
            sliderStyles.thumb,
            { left: thumbLeft, borderColor: scoreColor },
          ]}
        />
      </View>

      {/* Emoji row */}
      <View style={sliderStyles.emojiRow}>
        {SLIDER_EMOJIS.map((item) => {
          const emojiScore = Math.round(item.position * 9) + 1;
          const isActive =
            Math.abs(score - emojiScore) <= 1 ||
            (item.position === 0 && score <= 2) ||
            (item.position === 1 && score >= 9);
          return (
            <RNText
              key={item.emoji}
              style={[
                sliderStyles.emoji,
                isActive && sliderStyles.emojiActive,
              ]}
            >
              {item.emoji}
            </RNText>
          );
        })}
      </View>
    </GlassCard>
  );
}

const sliderStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 36,
    fontWeight: '700',
  },
  scoreDenom: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 16,
    color: colors.textSecondary,
  },
  trackContainer: {
    height: 40,
    justifyContent: 'center',
    marginBottom: 8,
  },
  trackBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: MOOD_SURFACES.focus,
  },
  trackFill: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    left: 0,
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.text,
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  emoji: {
    fontSize: 24,
    opacity: 0.35,
  },
  emojiActive: {
    opacity: 1,
    fontSize: 28,
  },
});

// ── Activity Chip ───────────────────────────────────────────────────────

function ActivityChip({
  activity,
  selected,
  onPress,
}: {
  activity: MoodActivity;
  selected: boolean;
  onPress: () => void;
}) {
  const IconComponent = ACTIVITY_ICON_MAP[activity.name.toLowerCase()] ?? Dumbbell;

  return (
    <Pressable
      style={[activityStyles.chip, selected && activityStyles.chipSelected]}
      onPress={onPress}
    >
      <IconComponent
        size={16}
        color={selected ? MOOD_ACCENT : colors.textSecondary}
        strokeWidth={1.8}
      />
      <RNText
        style={[
          activityStyles.chipLabel,
          selected && activityStyles.chipLabelSelected,
        ]}
      >
        {activity.name}
      </RNText>
    </Pressable>
  );
}

const activityStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: MOOD_SURFACES.focus,
  },
  chipSelected: {
    backgroundColor: `${MOOD_ACCENT}18`,
    shadowColor: MOOD_ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  chipLabel: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
  },
  chipLabelSelected: {
    color: colors.text,
  },
});

// ── Attachment Card ─────────────────────────────────────────────────────

function AttachmentCard({
  label,
  icon: Icon,
  onPress,
}: {
  label: string;
  icon: typeof Camera;
  onPress: () => void;
}) {
  return (
    <GlassCard level={2} onPress={onPress} style={attachStyles.card}>
      <Icon size={28} color={colors.textSecondary} strokeWidth={1.5} />
      <RNText style={attachStyles.label}>{label}</RNText>
    </GlassCard>
  );
}

const attachStyles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  label: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
});

// ── Main Screen ─────────────────────────────────────────────────────────

export default function LogMoodScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [entryId] = useState(() => uuid());
  const [score, setScore] = useState(7);
  const [selectedEmotions, setSelectedEmotions] = useState<PlutchikEmotion[]>([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

  const [activities, setActivities] = useState<MoodActivity[]>([]);

  useEffect(() => {
    try {
      seedDefaultActivities(db);
    } catch {
      // Seed may fail on first run
    }
    setActivities(getActivities(db));
  }, [db]);

  // Display first 6 activities for the grid
  const displayActivities = useMemo(() => activities.slice(0, 6), [activities]);

  const toggleEmotion = useCallback((emotion: PlutchikEmotion) => {
    setSelectedEmotions((prev) =>
      prev.includes(emotion) ? prev.filter((e) => e !== emotion) : [...prev, emotion],
    );
  }, []);

  const toggleActivity = useCallback((id: string) => {
    setSelectedActivityIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  }, []);

  const handleSave = useCallback(() => {
    createMoodEntry(db, entryId, {
      score,
      note: null,
      emotions: selectedEmotions.map((emotion) => ({ emotion, intensity: 2 })),
      activityIds: selectedActivityIds,
    });

    // Pet feeding (MOOD-21)
    try {
      const pet = getPet(db);
      if (pet) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const feedCount = getPetActivitiesToday(db, 'mood_log', todayStr);
        const totalEntries = getMoodEntryCount(db);
        const result = feedPet(pet, 'mood_log', feedCount, totalEntries);
        if (!result.dailyLimitReached) {
          updatePetStats(
            db,
            result.newHappiness,
            result.newExperience,
            result.newEvolutionStage,
            pet.totalFeeds + 1,
            result.justHatched ? new Date().toISOString() : undefined,
          );
          createPetActivity(db, uuid(), 'mood_log', result.happinessDelta, result.experienceDelta, 'mood');
          if (result.justHatched) Alert.alert('Your pet hatched!');
          if (result.justEvolved) Alert.alert('Your pet evolved!');
        }
      }
    } catch {
      // Never block save on pet errors
    }

    // SOS nudge for low scores (MOOD-30)
    if (score <= 2) {
      const sosEnabled = getSetting(db, 'sos_enabled') !== 'false';
      if (sosEnabled) {
        Alert.alert(
          'Feeling rough?',
          'Would you like to try a calming exercise?',
          [
            { text: 'No thanks', style: 'cancel', onPress: () => router.back() },
            { text: 'Stress Relief', onPress: () => router.replace('/(mood)/sos') },
          ],
        );
        return;
      }
    }

    router.back();
  }, [db, entryId, score, selectedEmotions, selectedActivityIds, router]);

  // Selected emotion labels for the header chips
  const selectedLabels = useMemo(
    () =>
      WHEEL_AXES
        .filter((axis) => selectedEmotions.includes(axis.emotion))
        .map((axis) => axis.label),
    [selectedEmotions],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Editorial headline */}
      <View style={styles.headerSection}>
        <RNText style={styles.headline}>How are you{'\n'}feeling?</RNText>
        <RNText style={styles.subtitle}>Log your emotional state for today.</RNText>
      </View>

      {/* Mood Intensity Slider */}
      <MoodIntensitySlider score={score} onChange={setScore} />

      {/* Emotion Mapping */}
      <View style={styles.sectionGap}>
        <View style={styles.emotionHeader}>
          <RNText style={styles.sectionTitle}>Emotion Mapping</RNText>
          <View style={styles.selectedChips}>
            {selectedLabels.map((label) => (
              <EmotionChip key={label} label={label} selected color={MOOD_ACCENT} />
            ))}
          </View>
        </View>
        <PlutchikWheel
          selectedEmotions={selectedEmotions}
          onToggleEmotion={toggleEmotion}
        />
      </View>

      {/* Activities */}
      <View style={styles.sectionGap}>
        <RNText style={styles.sectionTitle}>What influenced this?</RNText>
        <View style={styles.activityGrid}>
          {displayActivities.map((activity) => (
            <View key={activity.id} style={styles.activityGridItem}>
              <ActivityChip
                activity={activity}
                selected={selectedActivityIds.includes(activity.id)}
                onPress={() => toggleActivity(activity.id)}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Attachments */}
      <View style={styles.attachmentRow}>
        <AttachmentCard
          label="ADD PHOTO"
          icon={Camera}
          onPress={() => setShowPhotoPicker(true)}
        />
        <AttachmentCard
          label="VOICE MEMO"
          icon={Mic}
          onPress={() => setShowVoiceRecorder(true)}
        />
      </View>

      {/* Hidden pickers (shown when tapped) */}
      {showPhotoPicker && (
        <GlassCard level={1}>
          <PhotoPicker entryId={entryId} onAttach={() => setAttachmentCount((c) => c + 1)} />
        </GlassCard>
      )}
      {showVoiceRecorder && (
        <GlassCard level={1}>
          <VoiceRecorder entryId={entryId} onAttach={() => setAttachmentCount((c) => c + 1)} />
        </GlassCard>
      )}

      {attachmentCount > 0 && (
        <RNText style={styles.attachCount}>
          {attachmentCount} item{attachmentCount !== 1 ? 's' : ''} attached
        </RNText>
      )}

      {/* Save */}
      <GradientButton title="Save Mood Log" onPress={handleSave} />

      {/* Bottom spacer for tab bar */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 24,
  },
  headerSection: {
    gap: 6,
  },
  headline: {
    ...MOOD_TYPOGRAPHY.displayLg,
    color: colors.text,
    lineHeight: 38,
  },
  subtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  sectionGap: {
    gap: 16,
  },
  emotionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedChips: {
    flexDirection: 'row',
    gap: 6,
  },
  sectionTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  activityGridItem: {
    width: '48%',
    flexGrow: 1,
  },
  attachmentRow: {
    flexDirection: 'row',
    gap: 12,
  },
  attachCount: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: MOOD_ACCENT,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 20,
  },
});
