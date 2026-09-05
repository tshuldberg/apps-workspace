'use client';

import { useState } from 'react';
import { useAuth } from '@mylife/auth/provider';
import {
  getSocialClient,
  useDiscoverGroups,
  useMyGroups,
  useMyProfile,
} from '@mylife/social';
import { SocialProfileSetupCard } from '@/components/social/SocialProfileSetupCard';
import { SocialStateCard } from '@/components/social/SocialStateCard';
import { toGroupItem } from '@/components/social/types';

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

export default function GroupsPage() {
  const auth = useAuth();
  const myProfile = useMyProfile();
  const myGroups = useMyGroups();
  const discoverGroups = useDiscoverGroups({ limit: 24 });
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  if (auth.isLoading || myProfile.isLoading) {
    return <p style={styles.loadingText}>Loading groups...</p>;
  }

  if (myProfile.error === 'Social client not initialized') {
    return (
      <SocialStateCard
        title="Social is not configured"
        description="Groups require a configured social backend."
      />
    );
  }

  if (myProfile.error === 'Not authenticated' || !auth.isAuthenticated) {
    return (
      <SocialStateCard
        title="Sign in to join groups"
        description="Group memberships are tied to your MyLife account."
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

  const joinedGroups = (myGroups.data ?? []).map((group) => toGroupItem(group, true));
  const joinedGroupIds = new Set(joinedGroups.map((group) => group.id));
  const discoverableGroups = (discoverGroups.data ?? [])
    .filter((group) => !joinedGroupIds.has(group.id))
    .map((group) => toGroupItem(group, false));

  async function toggleGroup(groupId: string, isJoined: boolean) {
    const client = getSocialClient();
    if (!client) {
      setActionError('Social client not initialized.');
      return;
    }

    setActiveGroupId(groupId);
    const result = isJoined
      ? await client.leaveGroup(groupId)
      : await client.joinGroup(groupId);
    setActiveGroupId(null);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setActionError(null);
    void Promise.all([myGroups.refetch(), discoverGroups.refetch()]);
  }

  return (
    <div style={styles.container}>
      {actionError ? <p style={styles.errorText}>{actionError}</p> : null}

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Your groups</h2>
          <p style={styles.sectionText}>
            Private circles and public communities you already belong to.
          </p>
        </div>

        {myGroups.isLoading ? (
          <p style={styles.loadingText}>Loading your groups...</p>
        ) : joinedGroups.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>No groups joined yet</p>
            <p style={styles.emptyText}>
              Browse public groups below to find your people.
            </p>
          </div>
        ) : (
          <div style={styles.grid}>
            {joinedGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                isBusy={activeGroupId === group.id}
                onToggle={() => {
                  void toggleGroup(group.id, true);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Discover groups</h2>
          <p style={styles.sectionText}>
            Join public communities and keep conversations organized by topic.
          </p>
        </div>

        {discoverGroups.isLoading ? (
          <p style={styles.loadingText}>Loading discoverable groups...</p>
        ) : discoverableGroups.length === 0 ? (
          <p style={styles.emptyText}>No additional public groups are available right now.</p>
        ) : (
          <div style={styles.grid}>
            {discoverableGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                isBusy={activeGroupId === group.id}
                onToggle={() => {
                  void toggleGroup(group.id, false);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GroupCard({
  group,
  isBusy,
  onToggle,
}: {
  group: ReturnType<typeof toGroupItem>;
  isBusy: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.groupBadge}>{group.name.charAt(0).toUpperCase()}</div>
        <div style={styles.cardHeaderText}>
          <h3 style={styles.groupName}>{group.name}</h3>
          <p style={styles.memberCount}>
            {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <p style={styles.groupDesc}>{group.description}</p>
      <div style={styles.cardFooter}>
        <button
          type="button"
          style={group.isJoined ? styles.leaveButton : styles.joinButton}
          disabled={isBusy}
          onClick={onToggle}
        >
          {isBusy ? 'Updating...' : group.isJoined ? 'Leave group' : 'Join group'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '860px',
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sectionHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text)',
  },
  sectionText: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  loadingText: {
    fontSize: '14px',
    color: 'var(--text-tertiary)',
  },
  errorText: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--danger)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },
  card: {
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  groupBadge: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    backgroundColor: '#7C4DFF1A',
    color: 'var(--accent-social)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  },
  cardHeaderText: {
    flex: 1,
  },
  groupName: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  memberCount: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    margin: '2px 0 0',
  },
  groupDesc: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
    margin: 0,
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  joinButton: {
    padding: '6px 16px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--accent-social)',
    color: '#FFFFFF',
    border: 'none',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    font: 'inherit',
  },
  leaveButton: {
    padding: '6px 16px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    font: 'inherit',
  },
  empty: {
    textAlign: 'center',
    padding: '48px 24px',
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginTop: '8px',
  },
};
