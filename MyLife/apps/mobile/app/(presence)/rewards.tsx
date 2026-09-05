import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  GlassPanel,
  PR_ACCENT_LIGHT,
  PR_FONTS,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TYPOGRAPHY,
  buildRewardEvaluationStats,
  createReward,
  deleteReward,
  getRewardMilestoneLabel,
  getRewardProgress,
  getRewards,
  type RewardMilestoneType,
} from '@mylife/presence';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  PresenceBottomSheet,
  PresenceChip,
  PresenceEmptyState,
  PresenceHero,
  PresencePillButton,
  PresenceScrollScreen,
  PresenceSectionHeader,
  presenceScreenKitStyles,
} from './_screen-kit';

const MILESTONE_TYPES: RewardMilestoneType[] = ['streak', 'sessions', 'xp', 'goal-met-days'];

export default function RewardsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [milestoneType, setMilestoneType] = useState<RewardMilestoneType>('streak');
  const [milestoneValue, setMilestoneValue] = useState('7');
  const [rewardText, setRewardText] = useState('');
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  const rewards = useMemo(() => getRewards(db), [db, tick]);
  const stats = useMemo(() => buildRewardEvaluationStats(db), [db, tick]);

  const closeSheet = () => {
    setSheetVisible(false);
    setMilestoneType('streak');
    setMilestoneValue('7');
    setRewardText('');
  };

  const handleSave = () => {
    const parsedValue = parseInt(milestoneValue, 10);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      Alert.alert('Invalid milestone', 'Enter a milestone number greater than zero.');
      return;
    }
    if (rewardText.trim().length === 0) {
      Alert.alert('Missing reward', 'Describe the reward you want to earn.');
      return;
    }
    try {
      createReward(db, {
        milestoneType,
        milestoneValue: parsedValue,
        rewardText,
      });
      closeSheet();
      refresh();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save the reward.');
    }
  };

  return (
    <>
      <PresenceScrollScreen>
        <PresenceHero
          eyebrow="Self-accountability"
          title="Self-Set Rewards"
          subtitle="Turn streaks, sessions, XP, and clean goal days into rewards that make discipline feel tangible."
          action={<PresencePillButton label="Add Reward" icon="card_giftcard" onPress={() => setSheetVisible(true)} />}
        />

        <PresenceSectionHeader title="Reward list" />
        {rewards.length === 0 ? (
          <PresenceEmptyState
            icon="emoji_events"
            title="No rewards yet"
            body="Create small rewards tied to the habits you want to reinforce so Presence can mark them earned automatically."
          />
        ) : (
          <View style={presenceScreenKitStyles.stack}>
            {rewards.map((reward) => {
              const progress = getRewardProgress(reward, stats);
              return (
                <GlassPanel key={reward.id} padding={18} style={styles.rewardCard}>
                  <View style={styles.rewardHeader}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.rewardTitle}>{getRewardMilestoneLabel(reward)}</Text>
                      <Text style={styles.rewardText}>{reward.rewardText}</Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        Alert.alert('Delete reward', `Remove "${reward.rewardText}"?`, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => {
                              try {
                                deleteReward(db, reward.id);
                                refresh();
                              } catch {
                                Alert.alert('Delete failed', 'Could not remove the reward.');
                              }
                            },
                          },
                        ]);
                      }}
                    >
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </View>

                  {reward.earned ? (
                    <View style={styles.earnedPill}>
                      <Text style={styles.earnedText}>
                        Earned {reward.earnedAt != null ? new Date(reward.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.progressBlock}>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.max(progress * 100, 8)}%` }]} />
                      </View>
                      <Text style={styles.progressText}>{Math.round(progress * 100)}% complete</Text>
                    </View>
                  )}
                </GlassPanel>
              );
            })}
          </View>
        )}
      </PresenceScrollScreen>

      <PresenceBottomSheet visible={sheetVisible} onClose={closeSheet}>
        <Text style={styles.sheetTitle}>Add reward</Text>

        <View>
          <Text style={presenceScreenKitStyles.fieldLabel}>Milestone type</Text>
          <View style={styles.chipWrap}>
            {MILESTONE_TYPES.map((type) => (
              <PresenceChip
                key={type}
                label={type}
                selected={milestoneType === type}
                onPress={() => setMilestoneType(type)}
              />
            ))}
          </View>
        </View>

        <View>
          <Text style={presenceScreenKitStyles.fieldLabel}>Milestone value</Text>
          <TextInput
            value={milestoneValue}
            onChangeText={setMilestoneValue}
            placeholder="7"
            placeholderTextColor={PR_TEXT_SECONDARY}
            keyboardType="numeric"
            style={presenceScreenKitStyles.input}
          />
        </View>

        <View>
          <Text style={presenceScreenKitStyles.fieldLabel}>Reward</Text>
          <TextInput
            value={rewardText}
            onChangeText={setRewardText}
            placeholder="Buy myself a coffee"
            placeholderTextColor={PR_TEXT_SECONDARY}
            style={presenceScreenKitStyles.input}
          />
        </View>

        <View style={presenceScreenKitStyles.actionRow}>
          <Pressable style={presenceScreenKitStyles.secondaryButton} onPress={closeSheet}>
            <Text style={presenceScreenKitStyles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={presenceScreenKitStyles.primaryButton} onPress={handleSave}>
            <Text style={presenceScreenKitStyles.primaryButtonText}>Save</Text>
          </Pressable>
        </View>
      </PresenceBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  rewardCard: {
    gap: 14,
  },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  rewardTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
    fontFamily: PR_FONTS.bold,
  },
  rewardText: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  deleteText: {
    ...PR_TYPOGRAPHY.bodySm,
    color: '#FFB4AB',
    fontFamily: PR_FONTS.semiBold,
  },
  earnedPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: `${PR_ACCENT_LIGHT}22`,
  },
  earnedText: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_ACCENT_LIGHT,
    fontFamily: PR_FONTS.semiBold,
  },
  progressBlock: {
    gap: 8,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: PR_SURFACES.high,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: PR_ACCENT_LIGHT,
  },
  progressText: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
  },
  sheetTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
    fontFamily: PR_FONTS.bold,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
