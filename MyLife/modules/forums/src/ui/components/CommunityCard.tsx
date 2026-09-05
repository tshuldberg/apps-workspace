import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Community } from '../../types';
import {
  FR_ACCENT,
  FR_COMMUNITY_TYPES,
  FR_ON_ACCENT,
  FR_SURFACES,
  FR_TEXT,
  FR_TEXT_MUTED,
  FR_TEXT_SECONDARY,
  FR_TYPOGRAPHY,
} from '../tokens';
import { getCommunityTone } from '../logic';
import { GlassCard } from './GlassCard';
import { MaterialSymbol } from './MaterialSymbol';

export interface CommunityCardProps {
  community: Community;
  joined: boolean;
  variant?: 'row' | 'grid';
  onJoin?: () => void;
  onLeave?: () => void;
  onPress?: () => void;
}

export function CommunityCard({
  community,
  joined,
  variant = 'row',
  onJoin,
  onLeave,
  onPress,
}: CommunityCardProps) {
  const tone = FR_COMMUNITY_TYPES[getCommunityTone({
    humansOnly: community.humansOnly,
    communityType: community.communityType,
  })];

  return (
    <GlassCard onPress={onPress} style={variant === 'grid' ? styles.gridCard : undefined}>
      <View style={[styles.container, variant === 'grid' ? styles.grid : styles.row]}>
        <View style={[styles.cover, { backgroundColor: tone }]} />
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.title}>
              {community.displayName}
            </Text>
            {community.humansOnly ? (
              <MaterialSymbol name="shield" size={14} color={tone} filled />
            ) : null}
          </View>
          <Text numberOfLines={2} style={styles.description}>
            {community.description ?? 'Private, human-centered discussion.'}
          </Text>
          <View style={styles.statsRow}>
            <Text style={styles.stat}>{community.memberCount} members</Text>
            <Text style={styles.stat}>{community.threadCount} threads</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={joined ? onLeave : onJoin}
          style={[styles.actionPill, joined ? styles.leavePill : styles.joinPill]}
        >
          <Text style={[styles.actionText, joined ? styles.leaveText : styles.joinText]}>
            {joined ? 'Leave' : 'Join'}
          </Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  gridCard: {
    minHeight: 220,
  },
  container: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: 18,
  },
  content: {
    flex: 1,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
    flex: 1,
  },
  description: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  stat: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_MUTED,
  },
  actionPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  joinPill: {
    backgroundColor: FR_ACCENT,
  },
  leavePill: {
    backgroundColor: FR_SURFACES.high,
  },
  actionText: {
    ...FR_TYPOGRAPHY.labelUpper,
  },
  joinText: {
    color: FR_ON_ACCENT,
  },
  leaveText: {
    color: FR_TEXT,
  },
});
