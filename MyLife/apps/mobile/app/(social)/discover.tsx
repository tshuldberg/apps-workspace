import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@mylife/auth';
import {
  calculateChallengeProgressPercent,
  getPrimaryChallengeModuleId,
  getSocialClient,
  getSocialModulePresentation,
  useChallengeProgress,
  useChallenges,
  useDiscoverGroups,
  useFollowing,
  useMyGroups,
  useMyProfile,
  useProfileSearch,
} from '@mylife/social';
import type {
  Challenge,
  Group,
  SocialProfile,
} from '@mylife/social';
import { colors } from '@mylife/ui';
import { SocialProfileSetupPanel } from '../../components/social/SocialProfileSetupPanel';
import { SocialStatePanel } from '../../components/social/SocialStatePanel';

type FilterType = 'all' | 'user' | 'challenge' | 'group';

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

export default function DiscoverScreen() {
  const router = useRouter();
  const auth = useAuth();
  const myProfile = useMyProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  const search = useProfileSearch(searchQuery.trim().length >= 2 ? searchQuery.trim() : '');
  const challenges = useChallenges({ limit: 12 });
  const groups = useDiscoverGroups({ limit: 12 });
  const following = useFollowing(myProfile.data?.id ?? '');
  const myGroups = useMyGroups();

  const followingIds = new Set((following.data ?? []).map((profile) => profile.id));
  const myGroupIds = new Set((myGroups.data ?? []).map((group) => group.id));

  if (auth.isLoading || myProfile.isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading discover...</Text>
      </View>
    );
  }

  if (myProfile.error === 'Social client not initialized') {
    return (
      <SocialStatePanel
        title="Social is not configured"
        description="Discover requires the social backend to be configured."
      />
    );
  }

  if (myProfile.error === 'Not authenticated' || !auth.isAuthenticated) {
    return (
      <SocialStatePanel
        title="Sign in to discover people"
        description="Social discovery is tied to your MyLife account."
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

  const visibleProfiles = (search.data ?? []).filter((profile) => profile.id !== myProfile.data?.id);
  const visibleChallenges = (challenges.data ?? []).filter((challenge) =>
    searchQuery.trim().length === 0
      ? true
      : challenge.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  const visibleGroups = (groups.data ?? []).filter((group) =>
    searchQuery.trim().length === 0
      ? true
      : group.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  async function toggleFollow(profile: SocialProfile) {
    const client = getSocialClient();
    if (!client) {
      setActionError('Social client not initialized.');
      return;
    }

    const result = followingIds.has(profile.id)
      ? await client.unfollow(profile.id)
      : await client.follow(profile.id);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setActionError(null);
    void Promise.all([following.refetch(), search.refetch()]);
  }

  async function toggleGroup(group: Group) {
    const client = getSocialClient();
    if (!client) {
      setActionError('Social client not initialized.');
      return;
    }

    const result = myGroupIds.has(group.id)
      ? await client.leaveGroup(group.id)
      : await client.joinGroup(group.id);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setActionError(null);
    void Promise.all([myGroups.refetch(), groups.refetch()]);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search people, challenges, groups..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filters}>
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'user', label: 'People' },
            { id: 'challenge', label: 'Challenges' },
            { id: 'group', label: 'Groups' },
          ] as const
        ).map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => setFilter(item.id)}
            style={[
              styles.filterPill,
              filter === item.id && styles.filterPillActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === item.id && styles.filterTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

      {(filter === 'all' || filter === 'user') && searchQuery.trim().length >= 2 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>People</Text>
          {visibleProfiles.length === 0 ? (
            <Text style={styles.emptyText}>No matching profiles found.</Text>
          ) : (
            visibleProfiles.map((profile) => (
              <ProfileRow
                key={profile.id}
                profile={profile}
                isFollowing={followingIds.has(profile.id)}
                onToggle={() => {
                  void toggleFollow(profile);
                }}
              />
            ))
          )}
        </View>
      ) : null}

      {(filter === 'all' || filter === 'challenge') ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Challenges</Text>
          {visibleChallenges.length === 0 ? (
            <Text style={styles.emptyText}>No challenges match that search.</Text>
          ) : (
            visibleChallenges.map((challenge) => (
              <ChallengeRow
                key={challenge.id}
                challenge={challenge}
                onChanged={() => {
                  void challenges.refetch();
                }}
              />
            ))
          )}
        </View>
      ) : null}

      {(filter === 'all' || filter === 'group') ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Groups</Text>
          {visibleGroups.length === 0 ? (
            <Text style={styles.emptyText}>No groups match that search.</Text>
          ) : (
            visibleGroups.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                isJoined={myGroupIds.has(group.id)}
                onToggle={() => {
                  void toggleGroup(group);
                }}
              />
            ))
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

function ProfileRow({
  profile,
  isFollowing,
  onToggle,
}: {
  profile: SocialProfile;
  isFollowing: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{profile.displayName}</Text>
        <Text style={styles.cardSubtitle}>
          @{profile.handle} · {profile.followerCount} followers
        </Text>
      </View>
      <TouchableOpacity
        onPress={onToggle}
        style={[styles.actionButton, isFollowing && styles.secondaryActionButton]}
      >
        <Text style={styles.actionButtonText}>
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function GroupRow({
  group,
  isJoined,
  onToggle,
}: {
  group: Group;
  isJoined: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{group.name}</Text>
        <Text style={styles.cardSubtitle}>
          {group.memberCount} members
        </Text>
        {group.description ? (
          <Text style={styles.cardBody}>{group.description}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={onToggle}
        style={[styles.actionButton, isJoined && styles.secondaryActionButton]}
      >
        <Text style={styles.actionButtonText}>
          {isJoined ? 'Leave' : 'Join'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ChallengeRow({
  challenge,
  onChanged,
}: {
  challenge: Challenge;
  onChanged: () => void;
}) {
  const membership = useChallengeProgress(challenge.id);
  const [error, setError] = useState<string | null>(null);
  const modulePresentation = getSocialModulePresentation(
    getPrimaryChallengeModuleId(challenge),
  );
  const progress = calculateChallengeProgressPercent(challenge, membership.data);

  async function toggleChallenge() {
    const client = getSocialClient();
    if (!client) {
      setError('Social client not initialized.');
      return;
    }

    const result = membership.data
      ? await client.leaveChallenge(challenge.id)
      : await client.joinChallenge(challenge.id);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    void membership.refetch();
    onChanged();
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>
          {modulePresentation.icon} {challenge.title}
        </Text>
        <Text style={styles.cardSubtitle}>
          {challenge.memberCount} participants
        </Text>
        {challenge.description ? (
          <Text style={styles.cardBody}>{challenge.description}</Text>
        ) : null}
        {progress != null ? (
          <Text style={styles.progressText}>Progress: {progress}%</Text>
        ) : null}
        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
      </View>
      <TouchableOpacity
        onPress={() => {
          void toggleChallenge();
        }}
        style={[styles.actionButton, membership.data && styles.secondaryActionButton]}
      >
        <Text style={styles.actionButtonText}>
          {membership.data ? 'Leave' : 'Join'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 20,
  },
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
  searchContainer: {
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.text,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: '#7C4DFF',
    borderColor: '#7C4DFF',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  cardBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  progressText: {
    fontSize: 12,
    color: '#7C4DFF',
    fontWeight: '600',
  },
  inlineError: {
    fontSize: 12,
    color: colors.danger,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#7C4DFF',
  },
  secondaryActionButton: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
