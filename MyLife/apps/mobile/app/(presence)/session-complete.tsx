import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  GlassPanel,
  MaterialSymbol,
  PR_ACCENT,
  PR_ACCENT_GLOW,
  PR_ACCENT_LIGHT,
  PR_CYAN_GLOW_STYLE,
  PR_FONTS,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TEXT_TERTIARY,
  PR_TYPOGRAPHY,
  calculateXP,
  calculateStreakBonus,
  getBadgeDefinitionById,
  getFocusSession,
  getRewards,
  getSetting,
  setSetting,
  syncBadges,
  syncRewards,
  updateFocusSessionRating,
} from '@mylife/presence';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const SESSION_EMOJIS = ['😖', '😕', '😐', '🙂', '😄'] as const;
const STREAK_MILESTONES = [7, 14, 30, 60, 90, 180, 365];

function getReflectionKey(sessionId: string): string {
  return `presence:session-reflection:${sessionId}`;
}

export default function SessionCompleteScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionId?: string;
    actualMinutes?: string;
    baseXp?: string;
    streakBonus?: string;
    beastBonus?: string;
    totalXp?: string;
    streakDays?: string;
    newBadgeIds?: string;
    newRewardIds?: string;
  }>();

  const sessionId = params.sessionId ?? '';
  const session = useMemo(
    () => (sessionId ? getFocusSession(db, sessionId) : null),
    [db, sessionId],
  );
  const actualMinutes = Number.parseInt(
    params.actualMinutes ?? String(session?.actual_minutes ?? session?.planned_minutes ?? 0),
    10,
  );
  const baseXp = Number.parseInt(
    params.baseXp ?? String(calculateXP('session', actualMinutes)),
    10,
  );
  const streakDays = Number.parseInt(params.streakDays ?? '0', 10);
  const streakBonus = Number.parseInt(
    params.streakBonus ?? String(calculateStreakBonus(streakDays)),
    10,
  );
  const beastBonus = Number.parseInt(
    params.beastBonus ?? String(session?.type === 'beast' ? baseXp : 0),
    10,
  );
  const totalXp = Number.parseInt(
    params.totalXp ?? String(baseXp + streakBonus + beastBonus),
    10,
  );

  const initialNote = useMemo(
    () => (sessionId ? getSetting(db, getReflectionKey(sessionId)) ?? '' : ''),
    [db, sessionId],
  );
  const [newBadgeIds, setNewBadgeIds] = useState<string[]>(
    () => params.newBadgeIds?.split(',').filter(Boolean) ?? [],
  );
  const [newRewardIds, setNewRewardIds] = useState<string[]>(
    () => params.newRewardIds?.split(',').filter(Boolean) ?? [],
  );

  const [rating, setRating] = useState<number | null>(session?.rating ?? null);
  const [note, setNote] = useState(initialNote);
  const [savingNote, setSavingNote] = useState(false);
  const sparkleOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleOpacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [sparkleOpacity]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    void (async () => {
      try {
        const [badgeSyncResult, rewardSyncResult] = await Promise.all([
          syncBadges(db),
          syncRewards(db),
        ]);
        if (badgeSyncResult.newlyEarned.length > 0) {
          setNewBadgeIds((current) => [...new Set([...current, ...badgeSyncResult.newlyEarned.map((badge) => badge.id)])]);
        }
        if (rewardSyncResult.newlyEarned.length > 0) {
          setNewRewardIds((current) => [...new Set([...current, ...rewardSyncResult.newlyEarned.map((reward) => reward.id)])]);
        }
      } catch {
        // Session completion has already persisted. Failed celebration sync is non-fatal here.
      }
    })();
  }, [db, sessionId]);

  const milestoneReached = STREAK_MILESTONES.includes(streakDays);
  const streakHeadline = streakDays <= 0
    ? 'Fresh start'
    : streakDays === 1
      ? 'Streak started!'
      : `${streakDays}-day streak!`;
  const streakBody = streakDays <= 1
    ? 'One clean session is how momentum starts.'
    : 'Keep your next session close to today so the streak keeps compounding.';
  const reflectionChanged = note.trim() !== initialNote.trim();
  const newlyEarnedBadges = useMemo(
    () => newBadgeIds.map((id) => getBadgeDefinitionById(id)).filter((badge): badge is NonNullable<typeof badge> => badge != null),
    [newBadgeIds],
  );
  const newlyEarnedRewards = useMemo(
    () => getRewards(db).filter((reward) => newRewardIds.includes(reward.id)),
    [db, newRewardIds],
  );

  const handleSelectRating = (value: number) => {
    setRating(value);

    if (!sessionId) {
      return;
    }

    try {
      updateFocusSessionRating(db, sessionId, value);
    } catch {
      Alert.alert('Unable to save rating', 'The session score could not be stored.');
    }
  };

  const persistReflection = () => {
    if (!sessionId || !reflectionChanged) {
      return true;
    }

    try {
      setSetting(db, getReflectionKey(sessionId), note.trim());
      return true;
    } catch {
      Alert.alert('Unable to save reflection', 'Your note could not be stored.');
      return false;
    }
  };

  const handleSaveReflection = () => {
    if (savingNote) {
      return;
    }

    setSavingNote(true);
    const ok = persistReflection();
    setSavingNote(false);

    if (ok) {
      Alert.alert('Reflection saved', 'Your note is attached to this session locally.');
    }
  };

  const handleDone = () => {
    if (!persistReflection()) {
      return;
    }

    router.replace('/(presence)' as never);
  };

  const handleStartAnother = () => {
    if (!persistReflection()) {
      return;
    }

    router.replace('/(presence)/sessions' as never);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.heroGlow} />

        <View style={styles.heroSection}>
          <Animated.View style={[styles.sparkRow, { opacity: sparkleOpacity }]}>
            <View style={styles.sparkSmall} />
            <View style={styles.sparkLarge} />
            <View style={styles.sparkSmall} />
          </Animated.View>
          <View style={styles.heroIcon}>
            <MaterialSymbol
              name="check_circle"
              size={72}
              color={PR_ACCENT_LIGHT}
              filled
              style={styles.heroIconSymbol}
            />
          </View>
          <Text style={styles.heroMinutes}>{actualMinutes} minutes</Text>
          <Text style={styles.heroSubtitle}>of focus</Text>
        </View>

        <GlassPanel padding={20} style={styles.card}>
          <Text style={styles.eyebrow}>XP EARNED</Text>
          <Text style={styles.xpTotal}>+{totalXp} XP</Text>

          <View style={styles.breakdownList}>
            <BreakdownRow label="Base XP" value={`+${baseXp}`} highlight={false} />
            {streakBonus > 0 ? (
              <BreakdownRow label={`Streak bonus (${streakDays} days)`} value={`+${streakBonus}`} highlight={false} />
            ) : null}
            {beastBonus > 0 ? (
              <BreakdownRow label="Beast multiplier 2x" value={`+${beastBonus}`} highlight={false} />
            ) : null}
            <BreakdownRow label="Total" value={`+${totalXp}`} highlight />
          </View>
        </GlassPanel>

        {newlyEarnedBadges.length > 0 || newlyEarnedRewards.length > 0 ? (
          <GlassPanel padding={20} style={styles.card}>
            <Text style={styles.eyebrow}>MOMENTUM UNLOCKED</Text>
            <View style={styles.breakdownList}>
              {newlyEarnedBadges.map((badge) => (
                <View key={badge.id} style={styles.rewardUnlockRow}>
                  <Text style={styles.unlockEmoji}>{badge.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.unlockTitle}>{badge.name}</Text>
                    <Text style={styles.unlockCopy}>{badge.description}</Text>
                  </View>
                </View>
              ))}
              {newlyEarnedRewards.map((reward) => (
                <View key={reward.id} style={styles.rewardUnlockRow}>
                  <Text style={styles.unlockEmoji}>🎁</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.unlockTitle}>Reward earned</Text>
                    <Text style={styles.unlockCopy}>{reward.rewardText}</Text>
                  </View>
                </View>
              ))}
            </View>
          </GlassPanel>
        ) : null}

        <GlassPanel padding={18} style={styles.card}>
          <View style={styles.streakHeader}>
            <MaterialSymbol
              name={streakDays > 0 ? 'local_fire_department' : 'bolt'}
              size={28}
              color={streakDays > 0 ? PR_ACCENT_LIGHT : PR_TEXT_SECONDARY}
              filled={streakDays > 0}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.streakTitle}>{streakHeadline}</Text>
              <Text style={styles.streakBody}>{streakBody}</Text>
            </View>
          </View>

          {milestoneReached ? (
            <View style={styles.milestonePill}>
              <Text style={styles.milestoneText}>Milestone unlocked: {streakDays} days</Text>
            </View>
          ) : null}
        </GlassPanel>

        <GlassPanel padding={18} style={styles.card}>
          <Text style={styles.sectionTitle}>How did that feel?</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="What helped you stay present?"
            placeholderTextColor={PR_TEXT_TERTIARY}
            multiline
            style={styles.noteInput}
          />

          <Text style={styles.ratingLabel}>Rate this session</Text>
          <View style={styles.ratingRow}>
            {SESSION_EMOJIS.map((emoji, index) => {
              const value = index + 1;
              const selected = rating === value;

              return (
                <Pressable
                  key={emoji}
                  style={[styles.ratingButton, selected && styles.ratingButtonActive]}
                  onPress={() => handleSelectRating(value)}
                >
                  <Text style={styles.ratingEmoji}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.saveReflectionButton} onPress={handleSaveReflection}>
            <Text style={styles.saveReflectionText}>
              {savingNote ? 'Saving...' : 'Save reflection'}
            </Text>
          </Pressable>
        </GlassPanel>

        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={handleDone}>
            <LinearGradient
              colors={[PR_ACCENT_LIGHT, PR_ACCENT]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleStartAnother}>
            <Text style={styles.secondaryButtonText}>Start Another</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

function BreakdownRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={highlight ? styles.breakdownLabelHighlight : styles.breakdownLabel}>
        {label}
      </Text>
      <Text style={highlight ? styles.breakdownValueHighlight : styles.breakdownValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PR_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  heroGlow: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: PR_ACCENT_GLOW,
    opacity: 0.28,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 24,
    gap: 6,
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  sparkSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(34, 211, 238, 0.4)',
  },
  sparkLarge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: PR_ACCENT_LIGHT,
    ...PR_CYAN_GLOW_STYLE,
  },
  heroIcon: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
  },
  heroIconSymbol: {
    ...PR_CYAN_GLOW_STYLE,
  },
  heroMinutes: {
    fontFamily: PR_FONTS.extraBold,
    fontSize: 48,
    lineHeight: 54,
    color: PR_TEXT,
    letterSpacing: -1.5,
  },
  heroSubtitle: {
    fontFamily: PR_FONTS.medium,
    fontSize: 24,
    lineHeight: 30,
    color: PR_TEXT_SECONDARY,
  },
  card: {
    gap: 14,
  },
  eyebrow: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_TERTIARY,
  },
  xpTotal: {
    fontFamily: PR_FONTS.extraBold,
    fontSize: 40,
    lineHeight: 46,
    color: PR_ACCENT_LIGHT,
    ...PR_CYAN_GLOW_STYLE,
  },
  breakdownList: {
    gap: 10,
  },
  rewardUnlockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 2,
  },
  unlockEmoji: {
    fontSize: 24,
    lineHeight: 28,
  },
  unlockTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  unlockCopy: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    marginTop: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  breakdownValue: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  breakdownLabelHighlight: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_ACCENT_LIGHT,
  },
  breakdownValueHighlight: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_ACCENT_LIGHT,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
  },
  streakBody: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    marginTop: 4,
  },
  milestonePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
  },
  milestoneText: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  sectionTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
  },
  noteInput: {
    minHeight: 110,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: PR_TEXT,
    fontFamily: PR_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  ratingLabel: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_TERTIARY,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  ratingButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ratingButtonActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
  },
  ratingEmoji: {
    fontSize: 24,
    lineHeight: 30,
  },
  saveReflectionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  saveReflectionText: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  primaryGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: '#041015',
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryButtonText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
});
