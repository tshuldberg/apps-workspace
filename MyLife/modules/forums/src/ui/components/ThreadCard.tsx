import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Community, Thread } from '../../types';
import type { UserProfile } from '../../models';
import {
  FR_PINNED,
  FR_TEXT,
  FR_TEXT_MUTED,
  FR_TEXT_SECONDARY,
  FR_TYPOGRAPHY,
  type ForumTrustTier,
} from '../tokens';
import { GlassCard } from './GlassCard';
import { VoteControls, type ForumsVoteState } from './VoteControls';
import { CommunityPill } from './CommunityPill';
import { HumanVerifiedBadge } from './HumanVerifiedBadge';
import { MaterialSymbol } from './MaterialSymbol';

export interface ThreadCardProps {
  thread: Thread;
  author: UserProfile;
  community: Community;
  voteCount?: number;
  userVote: ForumsVoteState;
  replyCount?: number;
  pinned?: boolean;
  variant?: 'feed' | 'compact' | 'pinned';
  onVote?: (direction: 'up' | 'down') => void;
  onPress?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onReport?: () => void;
}

function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
  if (profile.karma > 0) return 'new';
  return 'unverified';
}

export function ThreadCard({
  thread,
  author,
  community,
  voteCount = thread.voteScore,
  userVote,
  replyCount = thread.replyCount,
  pinned = thread.isPinned,
  variant = 'feed',
  onVote,
  onPress,
  onSave,
  onShare,
  onReport,
}: ThreadCardProps) {
  const snippet = thread.body.replace(/\s+/g, ' ').trim();

  const handleLongPress = () => {
    Alert.alert('Thread actions', 'Choose an action for this thread.', [
      { text: 'Save', onPress: onSave },
      { text: 'Share', onPress: onShare },
      { text: 'Report', onPress: onReport, style: 'destructive' },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <GlassCard
      onPress={onPress}
      style={[styles.card, variant === 'compact' ? styles.cardCompact : null]}
    >
      <Pressable onLongPress={handleLongPress} style={styles.pressable}>
        <VoteControls
          count={voteCount}
          userVote={userVote}
          onUp={() => onVote?.('up')}
          onDown={() => onVote?.('down')}
        />
        <View style={styles.content}>
          <View style={styles.metaRow}>
            {pinned ? (
              <View style={styles.pinnedBadge}>
                <MaterialSymbol name="push_pin" size={12} color={FR_PINNED} filled />
                <Text style={styles.pinnedText}>Pinned</Text>
              </View>
            ) : null}
            <CommunityPill community={community} />
            <Text style={styles.time}>{formatRelativeTime(thread.createdAt)}</Text>
          </View>
          <Text numberOfLines={variant === 'compact' ? 2 : 3} style={styles.title}>
            {thread.title}
          </Text>
          <Text numberOfLines={2} style={styles.snippet}>
            {snippet}
          </Text>
          <View style={styles.footer}>
            <View style={styles.authorRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(author.displayName)}</Text>
              </View>
              <Text style={styles.authorName}>{author.displayName}</Text>
              <HumanVerifiedBadge tier={getTrustTier(author)} showLabel={false} />
            </View>
            <View style={styles.replyMeta}>
              <MaterialSymbol name="chat_bubble" size={14} color={FR_TEXT_MUTED} />
              <Text style={styles.replyCount}>{replyCount}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
  },
  cardCompact: {
    minHeight: 140,
  },
  pressable: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  content: {
    flex: 1,
    gap: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinnedText: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_PINNED,
  },
  time: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_MUTED,
    marginLeft: 'auto',
  },
  title: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
  },
  snippet: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FR_PINNED,
  },
  avatarText: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT,
  },
  authorName: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT,
    flexShrink: 1,
  },
  replyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyCount: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_MUTED,
  },
});
