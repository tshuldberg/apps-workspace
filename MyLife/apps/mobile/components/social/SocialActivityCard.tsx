import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Activity } from '@mylife/social';
import { describeSocialActivity, getSocialModulePresentation } from '@mylife/social';
import { colors } from '@mylife/ui';

interface SocialActivityCardProps {
  activity: Activity;
  authorName: string;
  authorAvatarUrl?: string | null;
  hasKudosed: boolean;
  onToggleKudos?: (activityId: string, nextActive: boolean) => void;
}

export function SocialActivityCard({
  activity,
  authorName,
  authorAvatarUrl,
  hasKudosed,
  onToggleKudos,
}: SocialActivityCardProps) {
  const modulePresentation = getSocialModulePresentation(activity.moduleId);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          {authorAvatarUrl ? (
            <Image source={{ uri: authorAvatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {authorName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View style={styles.cardHeaderText}>
          <Text style={styles.userName}>{authorName}</Text>
          <Text style={styles.timestamp}>
            {formatRelativeTime(activity.createdAt)}
          </Text>
        </View>

        <View
          style={[
            styles.moduleBadge,
            { backgroundColor: `${modulePresentation.accentColor}1A` },
          ]}
        >
          <Text style={styles.moduleIconText}>{modulePresentation.icon}</Text>
        </View>
      </View>

      <Text style={styles.description}>{describeSocialActivity(activity)}</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          disabled={!onToggleKudos}
          style={styles.kudosButton}
          onPress={() => onToggleKudos?.(activity.id, !hasKudosed)}
        >
          <Text style={styles.kudosIcon}>
            {hasKudosed ? '\u2764\uFE0F' : '\u2661'}
          </Text>
          {activity.kudosCount > 0 ? (
            <Text
              style={[
                styles.kudosCount,
                { color: hasKudosed ? '#7C4DFF' : colors.textTertiary },
              ]}
            >
              {activity.kudosCount}
            </Text>
          ) : null}
        </TouchableOpacity>

        <Text style={styles.commentCount}>
          {activity.commentCount} comment{activity.commentCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cardHeaderText: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  moduleBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleIconText: {
    fontSize: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  kudosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kudosIcon: {
    fontSize: 16,
  },
  kudosCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  commentCount: {
    fontSize: 13,
    color: colors.textTertiary,
  },
});
