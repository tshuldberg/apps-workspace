import React, { useState } from 'react';
import {
  Image,
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
  getSocialClient,
  useMyKudosForActivities,
  useMyProfile,
  useProfileActivities,
} from '@mylife/social';
import { colors } from '@mylife/ui';
import { SocialActivityCard } from '../../components/social/SocialActivityCard';
import { SocialProfileSetupPanel } from '../../components/social/SocialProfileSetupPanel';
import { SocialStatePanel } from '../../components/social/SocialStatePanel';

type ProfileTab = 'activity' | 'privacy';

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

export default function ProfileScreen() {
  const router = useRouter();
  const auth = useAuth();
  const myProfile = useMyProfile();
  const activities = useProfileActivities(myProfile.data?.id ?? '', { limit: 20 });
  const myKudos = useMyKudosForActivities((activities.data ?? []).map((activity) => activity.id));
  const [tab, setTab] = useState<ProfileTab>('activity');
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const profile = myProfile.data;

  const activityAuthorName = profile?.displayName ?? 'You';

  if (auth.isLoading || myProfile.isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (myProfile.error === 'Social client not initialized') {
    return (
      <SocialStatePanel
        title="Social is not configured"
        description="Profile and sharing features require the social backend."
      />
    );
  }

  if (myProfile.error === 'Not authenticated' || !auth.isAuthenticated) {
    return (
      <SocialStatePanel
        title="Sign in to use your profile"
        description="Social profiles are tied to your MyLife account."
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

  if (!profile) {
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

  async function saveProfile() {
    const client = getSocialClient();
    if (!client) {
      setActionError('Social client not initialized.');
      return;
    }

    const result = await client.updateProfile({
      displayName: displayName.trim(),
      bio: bio.trim() || null,
      avatarUrl: avatarUrl.trim() || null,
    });

    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setActionError(null);
    setIsEditing(false);
    void myProfile.refetch();
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
    void Promise.all([activities.refetch(), myKudos.refetch()]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {profile.displayName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <Text style={styles.displayName}>{profile.displayName}</Text>
        <Text style={styles.handle}>@{profile.handle}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>

      <View style={styles.statsRow}>
        {[
          { value: profile.enabledModules.length, label: 'Modules' },
          { value: profile.followerCount, label: 'Followers' },
          { value: profile.followingCount, label: 'Following' },
          { value: (activities.data ?? []).length, label: 'Posts' },
        ].map((stat) => (
          <View key={stat.label} style={styles.statItem}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.editButton}
        onPress={() => {
          setDisplayName(profile.displayName);
          setBio(profile.bio ?? '');
          setAvatarUrl(profile.avatarUrl ?? '');
          setIsEditing((current) => !current);
        }}
      >
        <Text style={styles.editButtonText}>
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </Text>
      </TouchableOpacity>

      {isEditing ? (
        <View style={styles.editPanel}>
          <TextInput
            style={styles.input}
            value={displayName}
            placeholder="Display name"
            placeholderTextColor={colors.textTertiary}
            onChangeText={setDisplayName}
          />
          <TextInput
            style={styles.input}
            value={avatarUrl}
            placeholder="Avatar URL"
            placeholderTextColor={colors.textTertiary}
            onChangeText={setAvatarUrl}
          />
          <TextInput
            style={styles.textarea}
            value={bio}
            placeholder="Bio"
            placeholderTextColor={colors.textTertiary}
            multiline={true}
            numberOfLines={3}
            onChangeText={setBio}
          />
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => {
              void saveProfile();
            }}
          >
            <Text style={styles.saveButtonText}>Save changes</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

      <View style={styles.tabs}>
        {(['activity', 'privacy'] as const).map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.tab, tab === item && styles.tabActive]}
            onPress={() => setTab(item)}
          >
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'activity' ? (
        <View style={styles.section}>
          {(activities.data ?? []).length === 0 ? (
            <Text style={styles.emptyText}>No social activity yet.</Text>
          ) : (
            (activities.data ?? []).map((activity) => (
              <SocialActivityCard
                key={activity.id}
                activity={activity}
                authorName={activityAuthorName}
                authorAvatarUrl={profile.avatarUrl}
                hasKudosed={myKudos.data?.[activity.id] ?? false}
                onToggleKudos={(activityId, nextActive) => {
                  void handleKudos(activityId, nextActive);
                }}
              />
            ))
          )}
        </View>
      ) : null}

      {tab === 'privacy' ? (
        <View style={styles.section}>
          <View style={styles.privacyRow}>
            <Text style={styles.privacyLabel}>Discoverable</Text>
            <Text style={styles.privacyValue}>
              {profile.privacySettings.discoverable ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.privacyRow}>
            <Text style={styles.privacyLabel}>Open follows</Text>
            <Text style={styles.privacyValue}>
              {profile.privacySettings.openFollows ? 'Anyone can follow' : 'Approval required'}
            </Text>
          </View>
          <View style={styles.privacyRow}>
            <Text style={styles.privacyLabel}>Module auto-posts</Text>
            <Text style={styles.privacyValue}>
              {profile.privacySettings.moduleSettings.filter((setting) => setting.autoPost).length}
            </Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
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
  header: {
    alignItems: 'center',
    gap: 8,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
    fontSize: 28,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  handle: {
    fontSize: 13,
    color: '#7C4DFF',
  },
  bio: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#7C4DFF',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  editPanel: {
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    fontSize: 14,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    fontSize: 14,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  saveButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#7C4DFF',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#7C4DFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  tabTextActive: {
    color: '#7C4DFF',
  },
  section: {
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  privacyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 4,
  },
  privacyLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  privacyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
