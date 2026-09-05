import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { UserStats } from '../../types';
import type { UserProfile } from '../../models';
import {
  FR_ACCENT,
  FR_ACCENT_LIGHT,
  FR_TEXT,
  FR_TEXT_SECONDARY,
  FR_TYPOGRAPHY,
  type ForumTrustTier,
} from '../tokens';
import { GlassCard } from './GlassCard';
import { HumanVerifiedBadge } from './HumanVerifiedBadge';

export interface ProfileCardProps {
  profile: UserProfile;
  stats: UserStats;
  variant?: 'hero' | 'compact';
}

function initials(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getTrustTier(profile: UserProfile): ForumTrustTier {
  if (profile.isVerified && profile.karma >= 1000) return 'highly_trusted';
  if (profile.isVerified) return 'trusted';
  return 'new';
}

export function ProfileCard({
  profile,
  stats,
  variant = 'hero',
}: ProfileCardProps) {
  if (variant === 'compact') {
    return (
      <GlassCard>
        <View style={styles.compactRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(profile.displayName)}</Text>
          </View>
          <View style={styles.compactCopy}>
            <Text style={styles.name}>{profile.displayName}</Text>
            <Text style={styles.handle}>@{profile.username}</Text>
          </View>
          <HumanVerifiedBadge tier={getTrustTier(profile)} showLabel={false} />
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding={0}>
      <LinearGradient
        colors={[FR_ACCENT_LIGHT, FR_ACCENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBanner}
      />
      <View style={styles.heroBody}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>{initials(profile.displayName)}</Text>
        </View>
        <View style={styles.heroHeader}>
          <Text style={styles.heroName}>{profile.displayName}</Text>
          <HumanVerifiedBadge tier={getTrustTier(profile)} />
        </View>
        <Text style={styles.handle}>@{profile.username}</Text>
        <Text style={styles.bio}>{profile.bio}</Text>
        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statValue}>{stats.threadCount}</Text>
            <Text style={styles.statLabel}>Threads</Text>
          </View>
          <View>
            <Text style={styles.statValue}>{stats.replyCount}</Text>
            <Text style={styles.statLabel}>Replies</Text>
          </View>
          <View>
            <Text style={styles.statValue}>{stats.karma}</Text>
            <Text style={styles.statLabel}>Karma</Text>
          </View>
          <View>
            <Text style={styles.statValue}>{stats.communitiesJoined}</Text>
            <Text style={styles.statLabel}>Communities</Text>
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  heroBanner: {
    height: 96,
  },
  heroBody: {
    padding: 16,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FR_ACCENT,
  },
  avatarText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -52,
    backgroundColor: FR_ACCENT,
  },
  avatarLargeText: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactCopy: {
    flex: 1,
    gap: 2,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  heroName: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
  },
  handle: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  bio: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 8,
  },
  statValue: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
  },
  statLabel: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_SECONDARY,
  },
});
