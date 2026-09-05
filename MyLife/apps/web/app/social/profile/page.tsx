'use client';

import { useState } from 'react';
import { useAuth } from '@mylife/auth/provider';
import {
  generateProfileCard,
  getSocialClient,
  useMyKudosForActivities,
  useMyProfile,
  useProfileActivities,
} from '@mylife/social';
import { ActivityCard } from '@/components/social/ActivityCard';
import { ShareCardPreview } from '@/components/social/ShareCardPreview';
import { SocialProfileSetupCard } from '@/components/social/SocialProfileSetupCard';
import { SocialStateCard } from '@/components/social/SocialStateCard';
import { indexProfiles, toActivityItem } from '@/components/social/types';

type ProfileTab = 'activity' | 'privacy' | 'share';

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

export default function ProfilePage() {
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
  const [isSaving, setIsSaving] = useState(false);

  if (auth.isLoading || myProfile.isLoading) {
    return <p style={styles.loadingText}>Loading profile...</p>;
  }

  if (myProfile.error === 'Social client not initialized') {
    return (
      <SocialStateCard
        title="Social is not configured"
        description="Profile and sharing features require a configured social backend."
      />
    );
  }

  if (myProfile.error === 'Not authenticated' || !auth.isAuthenticated) {
    return (
      <SocialStateCard
        title="Sign in to use your profile"
        description="Social profiles are tied to your MyLife account."
        actionHref="/settings/data-sync"
        actionLabel="Open data sync"
      />
    );
  }

  if (myProfile.error && myProfile.error !== 'Not authenticated') {
    return (
      <SocialStateCard
        title="Unable to load your social profile"
        description={myProfile.error}
      />
    );
  }

  if (!myProfile.data) {
    return (
      <SocialProfileSetupCard
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

  const profile = myProfile.data;
  const activityMap = indexProfiles([profile]);
  const activityItems = (activities.data ?? []).map((activity) =>
    toActivityItem(activity, activityMap, {
      hasKudosed: myKudos.data?.[activity.id] ?? false,
    }),
  );
  const shareCard = generateProfileCard(profile, {
    totalActivities: activityItems.length,
    activeModules: profile.enabledModules.length,
  });

  async function saveProfile() {
    const client = getSocialClient();
    if (!client) {
      setActionError('Social client not initialized.');
      return;
    }

    setIsSaving(true);
    const result = await client.updateProfile({
      displayName: displayName.trim(),
      bio: bio.trim() || null,
      avatarUrl: avatarUrl.trim() || null,
    });
    setIsSaving(false);

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
    <div style={styles.container}>
      <div style={styles.profileHeader}>
        <div style={styles.avatarLarge}>
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              style={styles.avatarImage}
            />
          ) : (
            <span style={styles.avatarFallback}>
              {profile.displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div style={styles.profileInfo}>
          <h2 style={styles.displayName}>{profile.displayName}</h2>
          <p style={styles.handle}>@{profile.handle}</p>
          {profile.bio ? <p style={styles.bio}>{profile.bio}</p> : null}
        </div>

        <button
          type="button"
          style={styles.editButton}
          onClick={() => {
            setDisplayName(profile.displayName);
            setBio(profile.bio ?? '');
            setAvatarUrl(profile.avatarUrl ?? '');
            setIsEditing((current) => !current);
          }}
        >
          {isEditing ? 'Cancel' : 'Edit profile'}
        </button>
      </div>

      {isEditing ? (
        <div style={styles.editPanel}>
          <label style={styles.label}>
            Display name
            <input
              style={styles.input}
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label style={styles.label}>
            Avatar URL
            <input
              style={styles.input}
              type="url"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
            />
          </label>
          <label style={styles.label}>
            Bio
            <textarea
              style={styles.textarea}
              value={bio}
              rows={3}
              onChange={(event) => setBio(event.target.value)}
            />
          </label>
          <div style={styles.editActions}>
            <button
              type="button"
              style={styles.saveButton}
              disabled={isSaving || displayName.trim().length === 0}
              onClick={() => {
                void saveProfile();
              }}
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : null}

      {actionError ? <p style={styles.errorText}>{actionError}</p> : null}

      <div style={styles.statsGrid}>
        {[
          { value: profile.enabledModules.length, label: 'Modules' },
          { value: profile.followerCount, label: 'Followers' },
          { value: profile.followingCount, label: 'Following' },
          { value: activityItems.length, label: 'Recent posts' },
        ].map((stat) => (
          <div key={stat.label} style={styles.statCard}>
            <span style={styles.statValue}>{stat.value}</span>
            <span style={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
      </div>

      <div style={styles.tabs}>
        {(
          [
            { id: 'activity', label: 'Activity' },
            { id: 'privacy', label: 'Privacy' },
            { id: 'share', label: 'Share Card' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            style={{
              ...styles.tab,
              color: tab === item.id ? 'var(--accent-social)' : 'var(--text-tertiary)',
              borderBottomColor: tab === item.id ? 'var(--accent-social)' : 'transparent',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'activity' ? (
        <div style={styles.activityList}>
          {activities.isLoading ? (
            <p style={styles.loadingText}>Loading activity...</p>
          ) : activityItems.length === 0 ? (
            <p style={styles.emptyText}>No social activity yet.</p>
          ) : (
            activityItems.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onKudos={(activityId, nextActive) => {
                  void handleKudos(activityId, nextActive);
                }}
              />
            ))
          )}
        </div>
      ) : null}

      {tab === 'privacy' ? (
        <div style={styles.privacyPanel}>
          <div style={styles.privacyRow}>
            <span style={styles.privacyLabel}>Discoverable</span>
            <span style={styles.privacyValue}>
              {profile.privacySettings.discoverable ? 'Yes' : 'No'}
            </span>
          </div>
          <div style={styles.privacyRow}>
            <span style={styles.privacyLabel}>Open follows</span>
            <span style={styles.privacyValue}>
              {profile.privacySettings.openFollows ? 'Anyone can follow' : 'Approval required'}
            </span>
          </div>
          <div style={styles.privacyRow}>
            <span style={styles.privacyLabel}>Module auto-posts</span>
            <span style={styles.privacyValue}>
              {profile.privacySettings.moduleSettings.length === 0
                ? 'No modules enabled'
                : `${profile.privacySettings.moduleSettings.filter((setting) => setting.autoPost).length} enabled`}
            </span>
          </div>
          <div style={styles.moduleList}>
            {profile.privacySettings.moduleSettings.map((setting) => (
              <div key={setting.moduleId} style={styles.moduleChip}>
                <span>{setting.moduleId}</span>
                <span>{setting.autoPost ? setting.defaultVisibility : 'off'}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'share' ? (
        <div style={styles.shareSection}>
          <p style={styles.shareDesc}>
            Preview the profile card generated from your real social profile.
          </p>
          <ShareCardPreview
            title={shareCard.headline}
            subtitle={shareCard.subtext ?? `@${profile.handle}`}
            moduleIcon={'\u{1F30D}'}
            moduleAccentColor="#7C4DFF"
            stat={shareCard.statValue ?? undefined}
            statLabel={shareCard.statLabel ?? undefined}
          />
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '720px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  loadingText: {
    fontSize: '14px',
    color: 'var(--text-tertiary)',
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  avatarLarge: {
    width: '72px',
    height: '72px',
    borderRadius: '36px',
    backgroundColor: 'var(--surface-elevated)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  avatarFallback: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  handle: {
    fontSize: '13px',
    color: 'var(--accent-social)',
    margin: '4px 0 0',
  },
  bio: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: '6px 0 0',
  },
  editButton: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    font: 'inherit',
    flexShrink: 0,
  },
  editPanel: {
    display: 'grid',
    gap: '12px',
    padding: '16px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
  },
  label: {
    display: 'grid',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    font: 'inherit',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    font: 'inherit',
    resize: 'vertical',
  },
  editActions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  saveButton: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    backgroundColor: 'var(--accent-social)',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    font: 'inherit',
  },
  errorText: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--danger)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '12px',
  },
  statCard: {
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--accent-social)',
  },
  statLabel: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    background: 'none',
    border: 'none',
    borderBottom: '2px solid',
    cursor: 'pointer',
    font: 'inherit',
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  privacyPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '20px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
  },
  privacyRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    fontSize: '14px',
  },
  privacyLabel: {
    color: 'var(--text-secondary)',
  },
  privacyValue: {
    color: 'var(--text)',
    fontWeight: 600,
  },
  moduleList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  moduleChip: {
    display: 'inline-flex',
    gap: '8px',
    padding: '6px 10px',
    borderRadius: '999px',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-tertiary)',
  },
  shareSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  shareDesc: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
};
