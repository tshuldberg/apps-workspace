import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GoalRing,
  MaterialSymbol,
  PR_ACCENT,
  PR_ACCENT_GLOW,
  PR_ACCENT_LIGHT,
  PR_CYAN_GLOW_STYLE,
  PR_FONTS,
  PR_SESSION_TYPES,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TEXT_TERTIARY,
  PR_TYPOGRAPHY,
  abandonFocusSession,
  awardXP,
  calculateStreakBonus,
  calculateStreaks,
  calculateXP,
  completeFocusSession,
  getDailyUsageRange,
  getFocusSession,
  syncBadges,
  syncRewards,
  type FocusSession,
} from '@mylife/presence';
import { Text, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const MOTIVATIONAL_MESSAGES = [
  'Stay present.',
  'Focus is freedom.',
  'Be where your feet are.',
  'This minute still belongs to you.',
  'The scroll can wait.',
];

function startDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatSessionType(type: FocusSession['type']): string {
  switch (type) {
    case 'group':
      return 'GROUP FOCUS';
    case 'beast':
      return 'BEAST MODE';
    default:
      return 'SOLO FOCUS';
  }
}

export default function SessionActiveScreen() {
  const db = useDatabase();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params.sessionId ?? '';

  const [session, setSession] = useState<FocusSession | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const messageOpacity = useRef(new Animated.Value(1)).current;
  const allowNavigationRef = useRef(false);
  const finishingRef = useRef(false);

  useEffect(() => {
    try {
      const nextSession = sessionId ? getFocusSession(db, sessionId) : null;
      setSession(nextSession);
      setLoadFailed(nextSession == null);
    } catch {
      setSession(null);
      setLoadFailed(true);
    }
  }, [db, sessionId]);

  useEffect(() => {
    if (session == null || session.end_time != null) {
      return undefined;
    }

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    const messageTimer = setInterval(() => {
      Animated.sequence([
        Animated.timing(messageOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(messageOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
      setMessageIndex((current) => (current + 1) % MOTIVATIONAL_MESSAGES.length);
    }, 30000);

    return () => clearInterval(messageTimer);
  }, [messageOpacity]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowNavigationRef.current || finishingRef.current) {
        return;
      }

      event.preventDefault();
      Alert.alert(
        'Leave focus session?',
        'The timer will keep running in the background until it finishes.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave screen',
            onPress: () => {
              allowNavigationRef.current = true;
              navigation.dispatch(event.data.action);
            },
          },
        ],
      );
    });

    return unsubscribe;
  }, [navigation]);

  const plannedSeconds = (session?.planned_minutes ?? 25) * 60;
  const sessionStartMs = session?.start_time != null
    ? Date.parse(session.start_time)
    : Date.now();
  const elapsedSeconds = useMemo(() => {
    if (Number.isNaN(sessionStartMs)) {
      return 0;
    }

    return Math.max(0, Math.floor((nowMs - sessionStartMs) / 1000));
  }, [nowMs, sessionStartMs]);
  const remainingSeconds = Math.max(plannedSeconds - elapsedSeconds, 0);
  const topProgress = plannedSeconds > 0
    ? Math.min(elapsedSeconds / plannedSeconds, 1)
    : 0;
  const ringProgress = plannedSeconds > 0
    ? Math.max(remainingSeconds / plannedSeconds, 0)
    : 0;
  const sessionColor = session == null
    ? PR_ACCENT_LIGHT
    : PR_SESSION_TYPES[session.type];
  const isBeastMode = session?.type === 'beast';

  useEffect(() => {
    if (
      session == null ||
      session.end_time != null ||
      finishingRef.current ||
      remainingSeconds > 0
    ) {
      return;
    }

    finishingRef.current = true;

    void (async () => {
      try {
        const actualMinutes = Math.max(
          session.planned_minutes,
          Math.round(elapsedSeconds / 60),
        );
        const today = new Date().toISOString().slice(0, 10);
        const streaks = calculateStreaks(getDailyUsageRange(db, startDate(365), today));
        const baseXp = calculateXP('session', actualMinutes);
        const streakBonus = calculateStreakBonus(streaks.current);
        const beastBonus = session.type === 'beast' ? baseXp : 0;
        const totalXp = baseXp + streakBonus + beastBonus;

        completeFocusSession(db, session.id, actualMinutes);
        awardXP(db, {
          date: today,
          source: 'session',
          amount: baseXp + beastBonus,
        });
        if (streakBonus > 0) {
          awardXP(db, {
            date: today,
            source: 'streak',
            amount: streakBonus,
          });
        }
        const [badgeSyncResult, rewardSyncResult] = await Promise.all([
          syncBadges(db),
          syncRewards(db),
        ]);

        allowNavigationRef.current = true;
        router.replace({
          pathname: '/(presence)/session-complete',
          params: {
            sessionId: session.id,
            actualMinutes: String(actualMinutes),
            baseXp: String(baseXp),
            streakBonus: String(streakBonus),
            beastBonus: String(beastBonus),
            totalXp: String(totalXp),
            streakDays: String(streaks.current),
            newBadgeIds: badgeSyncResult.newlyEarned.map((badge) => badge.id).join(','),
            newRewardIds: rewardSyncResult.newlyEarned.map((reward) => reward.id).join(','),
          },
        } as never);
      } catch {
        finishingRef.current = false;
        Alert.alert('Session error', 'The session finished, but completion could not be saved. Please try again.');
      }
    })();
  }, [db, elapsedSeconds, remainingSeconds, router, session]);

  const handleEndEarly = () => {
    if (session == null) {
      return;
    }

    if (isBeastMode) {
      Alert.alert('Beast Mode', 'Beast Mode sessions cannot be ended early.');
      return;
    }

    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

    Alert.alert(
      'End session early?',
      'You will lose any session XP earned so far.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'End session',
          style: 'destructive',
          onPress: () => {
            try {
              abandonFocusSession(db, session.id, elapsedMinutes);
              allowNavigationRef.current = true;
              router.replace('/(presence)/sessions' as never);
            } catch {
              Alert.alert('Unable to end session', 'Please try again.');
            }
          },
        },
      ],
    );
  };

  if (loadFailed || session == null) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingScreen}>
          <Text style={styles.errorHeadline}>Session unavailable</Text>
          <Text style={styles.errorCopy}>
            The active focus session could not be loaded.
          </Text>
          <Pressable
            style={styles.errorButton}
            onPress={() => router.replace('/(presence)/sessions' as never)}
          >
            <Text style={styles.errorButtonText}>Back to Sessions</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />
      <View style={styles.screen}>
        <View style={styles.backgroundGlow} />
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={[PR_ACCENT_LIGHT, sessionColor]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.progressFill, { width: `${Math.max(topProgress * 100, 2)}%` }]}
          />
        </View>

        {!isBeastMode ? (
          <Pressable style={styles.closeButton} onPress={handleEndEarly}>
            <MaterialSymbol name="close" size={22} color={PR_TEXT_TERTIARY} />
          </Pressable>
        ) : null}

        <View style={[styles.typeBadge, { backgroundColor: `${sessionColor}22` }]}>
          <Text style={[styles.typeBadgeText, { color: sessionColor }]}>
            {formatSessionType(session.type)}
          </Text>
        </View>

        <View style={styles.centerContent}>
          <GoalRing progress={ringProgress} size={320} strokeWidth={6}>
            <View style={styles.ringContent}>
              <Text style={styles.countdownText}>{formatCountdown(remainingSeconds)}</Text>
              <Text style={styles.countdownLabel}>REMAINING</Text>
            </View>
          </GoalRing>

          <Animated.View style={[styles.messageWrap, { opacity: messageOpacity }]}>
            <Text style={styles.messageText}>{MOTIVATIONAL_MESSAGES[messageIndex]}</Text>
          </Animated.View>
        </View>

        <View style={styles.bottomArea}>
          <Text style={styles.targetMeta}>
            {session.planned_minutes} minute target
          </Text>
          <Pressable
            style={[styles.endButton, isBeastMode && styles.endButtonDisabled]}
            onPress={handleEndEarly}
          >
            <Text style={styles.endButtonText}>
              {isBeastMode ? 'Beast Mode cannot be ended' : 'End Session Early'}
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PR_SURFACES.lowest,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: PR_SURFACES.lowest,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  errorHeadline: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
  },
  errorCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  errorButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: PR_ACCENT,
  },
  errorButtonText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: '#041015',
  },
  backgroundGlow: {
    position: 'absolute',
    top: '24%',
    left: '50%',
    marginLeft: -160,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: PR_ACCENT_GLOW,
    opacity: 0.24,
  },
  progressTrack: {
    height: 2,
    borderRadius: 999,
    backgroundColor: PR_SURFACES.highest,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    borderRadius: 999,
    shadowColor: PR_ACCENT_LIGHT,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 26,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  typeBadge: {
    alignSelf: 'center',
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  typeBadgeText: {
    ...PR_TYPOGRAPHY.labelUpper,
    letterSpacing: 1.8,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: 24,
  },
  ringContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    fontFamily: PR_FONTS.extraBold,
    color: PR_ACCENT_LIGHT,
    fontSize: 62,
    lineHeight: 68,
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
    ...PR_CYAN_GLOW_STYLE,
  },
  countdownLabel: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_TERTIARY,
    marginTop: 8,
  },
  messageWrap: {
    minHeight: 34,
    justifyContent: 'center',
  },
  messageText: {
    fontFamily: PR_FONTS.medium,
    fontSize: 16,
    lineHeight: 24,
    color: PR_TEXT_SECONDARY,
    fontStyle: 'italic',
    textAlign: 'center',
    maxWidth: 240,
  },
  bottomArea: {
    alignItems: 'center',
    gap: 10,
  },
  targetMeta: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_TERTIARY,
  },
  endButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  endButtonDisabled: {
    opacity: 0.3,
  },
  endButtonText: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_TERTIARY,
  },
});
