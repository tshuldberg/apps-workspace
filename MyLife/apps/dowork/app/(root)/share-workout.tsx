import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  buildWorkoutSummary,
  type WorkoutSummaryCard,
} from '@mylife/workouts';
import { useDatabase } from './providers/DatabaseProvider';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import {
  WorkoutBodyCopy,
  WorkoutGradientButton,
  WorkoutPhaseHeader,
  WorkoutPhaseScreen,
  formatDateLabel,
  formatVolumeLabel,
} from './phase2-kit';
import { DW_ACCENT, DW_ACCENT_LIGHT } from './theme/tokens';
import { uploadWorkoutShare } from './data/cloud-shares';
import { friendlyError } from './data/friendly-errors';

type CardVariant = 'gradient' | 'solid' | 'image';

const VARIANT_COLORS: Record<CardVariant, [string, string]> = {
  gradient: ['#3D1F07', DW_ACCENT],
  solid: [WK_CATEGORY_COLORS.hypertrophy, WK_CATEGORY_COLORS.hypertrophy],
  image: ['#1C1A20', '#3A2D24'],
};

export default function ShareWorkoutScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string; id?: string }>();
  const { supabase, userId } = useDoWorkCloud();

  const [variant, setVariant] = useState<CardVariant>('gradient');
  const [showStats, setShowStats] = useState(true);
  const [showPRs, setShowPRs] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [posting, setPosting] = useState(false);

  const sessionId = params.sessionId ?? params.id;

  const card = useMemo<WorkoutSummaryCard | null>(() => {
    if (!sessionId) {
      return null;
    }
    return buildWorkoutSummary(db, sessionId);
  }, [db, sessionId]);

  const copyLink = async () => {
    if (!sessionId) {
      return;
    }
    await Clipboard.setStringAsync(`dowork://workouts/session/${sessionId}`);
    Alert.alert('Copied', 'A DoWork deep link is on your clipboard.');
  };

  const postToCloud = async () => {
    if (!card) return;
    if (!supabase || !userId) {
      Alert.alert('Sign in required', 'Sign in to share your workout to the community feed.');
      return;
    }
    setPosting(true);
    try {
      const result = await uploadWorkoutShare(supabase, {
        title: card.title,
        durationSeconds: card.durationMinutes * 60,
        totalVolumeKg: card.totalVolume,
        exerciseCount: card.exerciseCount,
        privacy: 'public',
      });
      if (result.ok) {
        Alert.alert('Shared', 'Your workout is live in the community feed.');
        router.push('/(root)/social-feed' as never);
      } else if (result.queued) {
        // Parked for offline retry. Say so and leave the screen so the user does
        // not re-tap Post and queue the same workout twice.
        Alert.alert('Saved offline', 'Saved offline. It will post when you reconnect.');
        router.back();
      } else {
        Alert.alert('Could not share', friendlyError(result.error));
      }
    } finally {
      setPosting(false);
    }
  };

  if (!card) {
    return (
      <WorkoutPhaseScreen>
        <Stack.Screen options={{ headerShown: false }} />
        <WorkoutPhaseHeader
          title="Share Workout"
          onBack={() => router.back()}
          close
        />
        <View style={styles.body}>
          <GlassPanel padding={24} style={styles.emptyCard}>
            <RNText style={styles.emptyTitle}>No workout available</RNText>
            <WorkoutBodyCopy>Complete a session before sharing it.</WorkoutBodyCopy>
          </GlassPanel>
        </View>
      </WorkoutPhaseScreen>
    );
  }

  return (
    <WorkoutPhaseScreen contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutPhaseHeader
        title="Share Workout"
        onBack={() => router.back()}
        close
        right={(
          <Pressable style={styles.moreButton} onPress={() => void copyLink()}>
            <MaterialSymbol name="more_horiz" size={16} color={DW_ACCENT_LIGHT} />
          </Pressable>
        )}
      />

      <View style={styles.body}>
        <View style={styles.previewWrap}>
          <LinearGradient
            colors={VARIANT_COLORS[variant]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.previewCard}
          >
            <View style={styles.decorOne} />
            <View style={styles.decorTwo} />
            {variant === 'image' ? (
              <MaterialSymbol name="fitness_center" size={160} color="rgba(255,255,255,0.06)" />
            ) : null}

            <View style={styles.previewHeader}>
              <RNText style={styles.watermark}>DoWork</RNText>
              {showDate ? <RNText style={styles.dateStamp}>{formatDateLabel(card.date)}</RNText> : null}
            </View>

            <View style={styles.previewBody}>
              <RNText style={styles.previewTitle}>{card.title}</RNText>

              {showStats ? (
                <View style={styles.statsRow}>
                  <View style={styles.statBadge}>
                    <RNText style={styles.statValue}>{card.durationMinutes}</RNText>
                    <RNText style={styles.statLabel}>min</RNText>
                  </View>
                  <View style={styles.statBadge}>
                    <RNText style={styles.statValue}>{card.exerciseCount}</RNText>
                    <RNText style={styles.statLabel}>exercises</RNText>
                  </View>
                  <View style={styles.statBadge}>
                    <RNText style={styles.statValue}>{card.totalSets}</RNText>
                    <RNText style={styles.statLabel}>sets</RNText>
                  </View>
                </View>
              ) : null}

              <View style={styles.volumePill}>
                <MaterialSymbol name="timeline" size={15} color={DW_ACCENT_LIGHT} />
                <RNText style={styles.volumePillText}>{formatVolumeLabel(card.totalVolume)}</RNText>
              </View>

              {showPRs && card.prsHit.length > 0 ? (
                <View style={styles.prRow}>
                  {card.prsHit.map((pr) => (
                    <View key={`${pr.exerciseName}-${pr.estimated1rm}`} style={styles.prBadge}>
                      <RNText style={styles.prBadgeText}>
                        {pr.exerciseName}
                        {pr.estimated1rm > 0 ? ` · ${pr.estimated1rm}` : ''}
                      </RNText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </LinearGradient>
        </View>

        <GlassPanel padding={18} style={styles.controlsCard}>
          <RNText style={styles.controlsTitle}>Background</RNText>
          <View style={styles.chipRow}>
            {(['gradient', 'solid', 'image'] as CardVariant[]).map((option) => (
              <Chip
                key={option}
                label={option}
                selected={variant === option}
                accent={option === 'solid' ? WK_CATEGORY_COLORS.hypertrophy : DW_ACCENT}
                onPress={() => setVariant(option)}
              />
            ))}
          </View>

          <RNText style={styles.controlsTitle}>Options</RNText>
          <View style={styles.chipRow}>
            <Chip label="Stats" selected={showStats} accent={DW_ACCENT} onPress={() => setShowStats((value) => !value)} />
            <Chip label="PRs" selected={showPRs} accent={DW_ACCENT_LIGHT} onPress={() => setShowPRs((value) => !value)} />
            <Chip label="Date" selected={showDate} accent={WK_CATEGORY_COLORS.cardio} onPress={() => setShowDate((value) => !value)} />
          </View>
        </GlassPanel>

        <View style={styles.actions}>
          <WorkoutGradientButton
            label={posting ? 'Posting...' : 'Post to Community'}
            icon="north_east"
            disabled={posting}
            onPress={() => void postToCloud()}
          />
          <WorkoutGradientButton label="Copy Link" icon="link" onPress={() => void copyLink()} />
          <WorkoutGradientButton
            label="View Feed"
            icon="forum"
            onPress={() => router.push('/(root)/social-feed' as never)}
          />
        </View>
      </View>
    </WorkoutPhaseScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 20,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  moreButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  previewWrap: {
    alignItems: 'center',
  },
  previewCard: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 4 / 5,
    borderRadius: 28,
    padding: 24,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  decorOne: {
    position: 'absolute',
    top: -40,
    right: -10,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  decorTwo: {
    position: 'absolute',
    bottom: -40,
    left: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  watermark: {
    color: 'rgba(255,255,255,0.78)',
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dateStamp: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  previewBody: {
    gap: 18,
  },
  previewTitle: {
    color: '#FFFFFF',
    fontFamily: WK_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBadge: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.22)',
    gap: 4,
  },
  statValue: {
    color: '#FFFFFF',
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    lineHeight: 19,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  volumePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volumePillText: {
    color: '#FFFFFF',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  prRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 184, 119, 0.18)',
  },
  prBadgeText: {
    color: '#FFD7A7',
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  controlsCard: {
    gap: 12,
  },
  controlsTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actions: {
    gap: 12,
  },
});
