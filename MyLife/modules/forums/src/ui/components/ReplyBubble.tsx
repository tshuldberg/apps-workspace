import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Reply } from '../../types';
import type { UserProfile } from '../../models';
import {
  FR_TEXT,
  FR_TEXT_MUTED,
  FR_TEXT_SECONDARY,
  FR_TYPOGRAPHY,
  type ForumTrustTier,
} from '../tokens';
import { GlassCard } from './GlassCard';
import { HumanVerifiedBadge } from './HumanVerifiedBadge';
import { MaterialSymbol } from './MaterialSymbol';
import { VoteControls, type ForumsVoteState } from './VoteControls';

export interface ReplyBubbleProps {
  reply: Reply;
  author: UserProfile;
  depth: number;
  userVote?: ForumsVoteState;
  onVote?: (direction: 'up' | 'down') => void;
  onReply?: () => void;
  onReport?: () => void;
}

function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getTrustTier(profile: UserProfile): ForumTrustTier {
  if (profile.isVerified && profile.karma >= 1000) return 'highly_trusted';
  if (profile.isVerified) return 'trusted';
  if (profile.karma > 0) return 'new';
  return 'unverified';
}

export function ReplyBubble({
  reply,
  author,
  depth,
  userVote = null,
  onVote,
  onReply,
  onReport,
}: ReplyBubbleProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <View style={{ marginLeft: Math.min(depth, 5) * 14 }}>
      <GlassCard style={styles.card}>
        <View style={styles.header}>
          <View style={styles.authorRow}>
            <Text style={styles.author}>{author.displayName}</Text>
            <HumanVerifiedBadge tier={getTrustTier(author)} showLabel={false} />
            <Text style={styles.timestamp}>{formatRelativeTime(reply.createdAt)}</Text>
          </View>
          <Pressable onPress={() => setCollapsed((value) => !value)}>
            <Text style={styles.toggle}>{collapsed ? 'Expand' : 'Collapse'}</Text>
          </Pressable>
        </View>
        {!collapsed ? (
          <>
            <Text style={styles.body}>{reply.body}</Text>
            <View style={styles.footer}>
              <VoteControls
                count={reply.voteScore}
                userVote={userVote}
                orientation="horizontal"
                onUp={() => onVote?.('up')}
                onDown={() => onVote?.('down')}
              />
              <Pressable onPress={onReply} style={styles.actionButton}>
                <Text style={styles.actionText}>Reply</Text>
              </Pressable>
              <Pressable onPress={onReport} style={styles.actionIcon}>
                <MaterialSymbol name="more_vert" size={16} color={FR_TEXT_MUTED} />
              </Pressable>
            </View>
          </>
        ) : null}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  author: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT,
  },
  timestamp: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_MUTED,
  },
  toggle: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_SECONDARY,
  },
  body: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
    marginTop: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  actionText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT,
  },
  actionIcon: {
    padding: 8,
  },
});
