import React, { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@mylife/auth';
import {
  getSocialClient,
  useActivityFeed,
  useMyKudosForActivities,
  useMyProfile,
  useProfilesByIds,
} from '@mylife/social';
import { colors } from '@mylife/ui';
import { SocialActivityCard } from '../../components/social/SocialActivityCard';
import { SocialProfileSetupPanel } from '../../components/social/SocialProfileSetupPanel';
import { SocialStatePanel } from '../../components/social/SocialStatePanel';

function getInitialDisplayName(
  email: string | undefined,
  metadataDisplayName: unknown,
): string {
  if (typeof metadataDisplayName === 'string' && metadataDisplayName.trim().length > 0) {
    return metadataDisplayName.trim();
  }

  if (!email) return '';
  return email.split('@')[0] ?? '';
}

export default function FeedScreen() {
  const router = useRouter();
  const auth = useAuth();
  const myProfile = useMyProfile();
  const feed = useActivityFeed({ limit: 20 });
  const authors = useProfilesByIds((feed.data ?? []).map((activity) => activity.profileId));
  const myKudos = useMyKudosForActivities((feed.data ?? []).map((activity) => activity.id));
  const [actionError, setActionError] = useState<string | null>(null);

  const authorMap = Object.fromEntries(
    (authors.data ?? []).map((profile) => [profile.id, profile]),
  );

  if (auth.isLoading || myProfile.isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading social feed...</Text>
      </View>
    );
  }

  if (myProfile.error === 'Social client not initialized') {
    return (
      <SocialStatePanel
        title="Social is not configured"
        description="Social features require Supabase configuration before feed, follows, and challenges can load."
      />
    );
  }

  if (myProfile.error === 'Not authenticated' || !auth.isAuthenticated) {
    return (
      <SocialStatePanel
        title="Sign in to use social"
        description="Social features are part of the cloud experience. Connect your account first, then create a social profile."
        actionLabel="Open data sync"
        onAction={() => router.push('/(hub)/data-sync')}
      />
    );
  }

  if (myProfile.error && myProfile.error !== 'Not authenticated') {
    return (
      <SocialStatePanel
        title="Unable to load your social profile"
        description={myProfile.error}
      />
    );
  }

  if (!myProfile.data) {
    return (
      <SocialProfileSetupPanel
        initialDisplayName={getInitialDisplayName(
          auth.user?.email,
          auth.user?.user_metadata?.display_name,
        )}
        onCreated={() => {
          void myProfile.refetch();
        }}
      />
    );
  }

  async function handleKudos(activityId: string, nextActive: boolean) {
    const client = getSocialClient();
    if (!client) {
      setActionError('Social client not initialized.');
      return;
    }

    const result = nextActive
      ? await client.giveKudos(activityId, 'clap')
      : await client.removeKudos(activityId);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setActionError(null);
    void Promise.all([feed.refetch(), myKudos.refetch()]);
  }

  return (
    <FlatList
      data={feed.data ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Friends feed</Text>
          <Text style={styles.subtitle}>
            Activity from you and the people you follow appears here.
          </Text>
          {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyText}>
            Follow people, join challenges, or post from Market and Forums to
            start filling your feed.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <SocialActivityCard
          activity={item}
          authorName={authorMap[item.profileId]?.displayName ?? 'MyLife member'}
          authorAvatarUrl={authorMap[item.profileId]?.avatarUrl}
          hasKudosed={myKudos.data?.[item.id] ?? false}
          onToggleKudos={(activityId, nextActive) => {
            void handleKudos(activityId, nextActive);
          }}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  list: {
    padding: 16,
    gap: 12,
    backgroundColor: colors.background,
  },
  header: {
    gap: 6,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
  empty: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
