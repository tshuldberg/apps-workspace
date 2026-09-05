import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GlassPanel,
  MaterialSymbol,
  WK_ACCENT_DARK,
  WK_ACCENT_LIGHT,
  WK_FONTS,
  WK_SURFACES,
} from '@mylife/workouts';
import type {
  WorkoutSocialFeedItem,
  WorkoutSocialReactionKey,
} from '../../lib/workouts/social';
import { formatSocialRelativeTime } from '../../lib/workouts/social';
import { avatarLabel, formatVolumeLabel } from './phase2-kit';
import { formatCompactNumber } from './(tabs)/_screen-kit';

interface SocialPostCardProps {
  activeReaction: WorkoutSocialReactionKey | null;
  expanded: boolean;
  onOpenProfile: (userId: string) => void;
  onReact: (postId: string, reaction: WorkoutSocialReactionKey) => void;
  onToggleComments: (postId: string) => void;
  post: WorkoutSocialFeedItem;
}

const REACTION_META: Record<
  WorkoutSocialReactionKey,
  { icon: string; label: string }
> = {
  fire: { icon: 'local_fire_department', label: 'Fire' },
  muscle: { icon: 'fitness_center', label: 'Muscle' },
  clap: { icon: 'front_hand', label: 'Clap' },
};

export function SocialPostCard({
  activeReaction,
  expanded,
  onOpenProfile,
  onReact,
  onToggleComments,
  post,
}: SocialPostCardProps) {
  const reactionEntries = (Object.keys(REACTION_META) as WorkoutSocialReactionKey[]).map(
    (key) => ({
      key,
      icon: REACTION_META[key].icon,
      label: REACTION_META[key].label,
      count: post.reactionCounts[key] + (activeReaction === key ? 1 : 0),
    }),
  );

  return (
    <GlassPanel padding={18} style={styles.card}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => onOpenProfile(post.userId)}
          style={styles.authorPressable}
        >
          <SocialAvatar
            displayName={post.authorName}
            accent={post.focusAccent}
            size={48}
          />
          <View style={styles.authorCopy}>
            <RNText style={styles.authorName}>{post.authorName}</RNText>
            <View style={styles.metaRow}>
              <RNText style={styles.metaText}>{post.privacyLabel.toUpperCase()}</RNText>
              <View
                style={[
                  styles.metaDot,
                  { backgroundColor: `${post.privacyAccent}66` },
                ]}
              />
              <RNText style={styles.metaText}>{formatSocialRelativeTime(post.createdAt)}</RNText>
            </View>
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          <PrivacyPill
            accent={post.privacyAccent}
            icon={post.privacyIcon}
            label={post.privacyLabel}
          />
          <Pressable style={styles.iconShell}>
            <MaterialSymbol name="more_horiz" size={18} color="rgba(214, 195, 181, 0.68)" />
          </Pressable>
        </View>
      </View>

      <View style={styles.titleRow}>
        <RNText style={styles.title}>{post.content.title}</RNText>
        {post.hasNewPr ? (
          <View style={styles.prBadge}>
            <MaterialSymbol name="stars" size={14} color="#EF4444" />
            <RNText style={styles.prBadgeText}>New PR</RNText>
          </View>
        ) : null}
      </View>

      <RNText style={styles.caption}>{post.caption}</RNText>

      <CoverPanel post={post} />

      <View style={styles.summaryRow}>
        <StatPill label="Duration" value={`${post.content.durationMinutes}m`} />
        <StatPill label="Volume" value={formatVolumeLabel(post.content.totalVolume)} />
        <StatPill label="Moves" value={String(Math.max(post.content.exerciseCount, 1))} />
      </View>

      <View style={styles.chipRow}>
        <FocusChip accent={post.focusAccent} label={post.focusLabel} />
        {post.content.muscleGroups.slice(0, 3).map((group) => (
          <FocusChip
            key={`${post.id}-${group}`}
            accent="rgba(255,255,255,0.18)"
            label={group.replace(/_/g, ' ')}
            muted
          />
        ))}
      </View>

      <View style={styles.actionRow}>
        <View style={styles.reactionRow}>
          {reactionEntries.map((entry) => (
            <Pressable
              key={`${post.id}-${entry.key}`}
              onPress={() => onReact(post.id, entry.key)}
              style={[
                styles.reactionButton,
                activeReaction === entry.key && {
                  backgroundColor: `${post.focusAccent}24`,
                },
              ]}
            >
              <MaterialSymbol
                name={entry.icon}
                size={16}
                color={activeReaction === entry.key ? post.focusAccent : '#D6C3B5'}
              />
              <RNText
                style={[
                  styles.reactionText,
                  activeReaction === entry.key && { color: post.focusAccent },
                ]}
              >
                {formatCompactNumber(entry.count)}
              </RNText>
            </Pressable>
          ))}
        </View>

        <View style={styles.metaActions}>
          <Pressable
            onPress={() => onToggleComments(post.id)}
            style={styles.inlineAction}
          >
            <MaterialSymbol name="mode_comment" size={16} color="rgba(214, 195, 181, 0.72)" />
            <RNText style={styles.inlineActionText}>{post.commentCount}</RNText>
          </Pressable>
          <Pressable style={styles.inlineAction}>
            <MaterialSymbol name="ios_share" size={16} color="rgba(214, 195, 181, 0.72)" />
          </Pressable>
        </View>
      </View>

      {expanded ? (
        <View style={styles.commentsWrap}>
          {post.comments.map((comment) => (
            <View key={comment.id} style={styles.commentRow}>
              <RNText style={styles.commentAuthor}>{comment.authorName}</RNText>
              <RNText style={styles.commentBody}>{comment.body}</RNText>
            </View>
          ))}
        </View>
      ) : null}
    </GlassPanel>
  );
}

export function SocialAvatar({
  accent,
  displayName,
  size = 56,
}: {
  accent: string;
  displayName: string;
  size?: number;
}) {
  return (
    <LinearGradient
      colors={[accent, withAlpha(accent, '66')]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <RNText style={styles.avatarText}>{avatarLabel(displayName)}</RNText>
    </LinearGradient>
  );
}

function CoverPanel({ post }: { post: WorkoutSocialFeedItem }) {
  const colors =
    post.coverVariant === 'recovery'
      ? ['rgba(48, 209, 88, 0.28)', 'rgba(19, 19, 24, 0.92)']
      : post.coverVariant === 'hero'
        ? ['rgba(139, 207, 240, 0.28)', 'rgba(19, 19, 24, 0.92)']
        : [`${post.focusAccent}44`, 'rgba(19, 19, 24, 0.92)'];
  const symbol =
    post.coverVariant === 'recovery'
      ? 'monitor_heart'
      : post.focusLabel.toLowerCase() === 'cardio'
        ? 'route'
        : 'fitness_center';

  return (
    <LinearGradient
      colors={colors as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.coverPanel}
    >
      <View style={styles.coverCopy}>
        <RNText style={styles.coverEyebrow}>{post.coverCaption}</RNText>
        <View style={styles.coverValueRow}>
          <RNText style={styles.coverValue}>{post.coverValue}</RNText>
          <RNText style={styles.coverUnit}>{post.coverUnit}</RNText>
        </View>
      </View>
      <View style={[styles.coverIconWrap, { backgroundColor: withAlpha(post.focusAccent, '18') }]}>
        <MaterialSymbol name={symbol} size={36} color={post.focusAccent} />
      </View>
    </LinearGradient>
  );
}

function FocusChip({
  accent,
  label,
  muted = false,
}: {
  accent: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <View
      style={[
        styles.focusChip,
        {
          backgroundColor: muted ? 'rgba(255, 255, 255, 0.07)' : withAlpha(accent, '20'),
        },
      ]}
    >
      <RNText style={[styles.focusChipText, muted && styles.mutedChipText]}>
        {label}
      </RNText>
    </View>
  );
}

function PrivacyPill({
  accent,
  icon,
  label,
}: {
  accent: string;
  icon: string;
  label: string;
}) {
  return (
    <View style={[styles.privacyPill, { backgroundColor: withAlpha(accent, '22') }]}>
      <MaterialSymbol name={icon} size={12} color={accent} />
      <RNText style={[styles.privacyLabel, { color: accent }]}>{label}</RNText>
    </View>
  );
}

function StatPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statPill}>
      <RNText style={styles.statValue}>{value}</RNText>
      <RNText style={styles.statLabel}>{label}</RNText>
    </View>
  );
}

function withAlpha(color: string, alpha: string): string {
  if (color.startsWith('#') && color.length === 7) {
    return `${color}${alpha}`;
  }

  return color;
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  authorPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorCopy: {
    flex: 1,
    gap: 4,
  },
  authorName: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: 'rgba(214, 195, 181, 0.66)',
    fontFamily: WK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  privacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  privacyLabel: {
    fontFamily: WK_FONTS.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  iconShell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  title: {
    flex: 1,
    color: '#E4E1E9',
    fontFamily: WK_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.8,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  prBadgeText: {
    color: '#EF4444',
    fontFamily: WK_FONTS.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  caption: {
    color: 'rgba(214, 195, 181, 0.82)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  coverPanel: {
    minHeight: 120,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    backgroundColor: WK_SURFACES.low,
  },
  coverCopy: {
    flex: 1,
    gap: 6,
  },
  coverEyebrow: {
    color: 'rgba(228, 225, 233, 0.62)',
    fontFamily: WK_FONTS.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  coverValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  coverValue: {
    color: '#FFFFFF',
    fontFamily: WK_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1.2,
  },
  coverUnit: {
    color: 'rgba(228, 225, 233, 0.78)',
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
    paddingBottom: 4,
  },
  coverIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statPill: {
    flex: 1,
    minHeight: 70,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  statValue: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.extraBold,
    fontSize: 16,
    lineHeight: 18,
  },
  statLabel: {
    marginTop: 4,
    color: 'rgba(214, 195, 181, 0.62)',
    fontFamily: WK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  focusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  focusChipText: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mutedChipText: {
    color: 'rgba(228, 225, 233, 0.86)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reactionRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 8,
  },
  reactionButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  reactionText: {
    color: '#D6C3B5',
    fontFamily: WK_FONTS.bold,
    fontSize: 12,
    lineHeight: 14,
  },
  metaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineActionText: {
    color: 'rgba(214, 195, 181, 0.72)',
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 14,
  },
  commentsWrap: {
    gap: 10,
    paddingTop: 4,
  },
  commentRow: {
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  commentAuthor: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 12,
    lineHeight: 14,
  },
  commentBody: {
    color: 'rgba(214, 195, 181, 0.8)',
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: WK_ACCENT_DARK,
    fontFamily: WK_FONTS.extraBold,
    fontSize: 20,
    lineHeight: 22,
  },
});
