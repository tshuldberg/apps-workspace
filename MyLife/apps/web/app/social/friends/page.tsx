'use client';

import { useState } from 'react';
import { useAuth } from '@mylife/auth/provider';
import {
  getSocialClient,
  useFollowing,
  useMyProfile,
  usePendingFollowRequests,
  useProfileSearch,
  useProfilesByIds,
} from '@mylife/social';
import { ProfileCard } from '@/components/social/ProfileCard';
import { SocialProfileSetupCard } from '@/components/social/SocialProfileSetupCard';
import { SocialStateCard } from '@/components/social/SocialStateCard';
import {
  indexProfiles,
  toFriendRequestItem,
  toSocialProfileCard,
} from '@/components/social/types';

type FriendsTab = 'following' | 'requests' | 'search';

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

export default function FriendsPage() {
  const auth = useAuth();
  const myProfile = useMyProfile();
  const [tab, setTab] = useState<FriendsTab>('following');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const following = useFollowing(myProfile.data?.id ?? '');
  const requests = usePendingFollowRequests();
  const search = useProfileSearch(searchQuery.trim());
  const requesterProfiles = useProfilesByIds(
    (requests.data ?? []).map((request) => request.followerId),
  );

  if (auth.isLoading || myProfile.isLoading) {
    return <p style={styles.loadingText}>Loading friends...</p>;
  }

  if (myProfile.error === 'Social client not initialized') {
    return (
      <SocialStateCard
        title="Social is not configured"
        description="Friend connections require a configured social backend."
      />
    );
  }

  if (myProfile.error === 'Not authenticated' || !auth.isAuthenticated) {
    return (
      <SocialStateCard
        title="Sign in to connect with people"
        description="Follow requests and social search only work for signed-in MyLife accounts."
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

  const followingProfiles = (following.data ?? []).map(toSocialProfileCard);
  const followingIds = new Set((following.data ?? []).map((profile) => profile.id));
  const requestProfileMap = indexProfiles(requesterProfiles.data);
  const requestItems = (requests.data ?? []).map((request) =>
    toFriendRequestItem(request, requestProfileMap),
  );
  const searchResults = (search.data ?? [])
    .filter((profile) => profile.id !== myProfile.data?.id)
    .map(toSocialProfileCard);

  async function followProfile(profileId: string) {
    const client = getSocialClient();
    if (!client) {
      setActionError('Social client not initialized.');
      return;
    }

    const result = followingIds.has(profileId)
      ? await client.unfollow(profileId)
      : await client.follow(profileId);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setActionError(null);
    void Promise.all([following.refetch(), search.refetch()]);
  }

  async function respondToRequest(
    followId: string,
    action: 'accept' | 'reject',
  ) {
    const client = getSocialClient();
    if (!client) {
      setActionError('Social client not initialized.');
      return;
    }

    setActiveRequestId(followId);
    const result = action === 'accept'
      ? await client.acceptFollowRequest(followId)
      : await client.rejectFollowRequest(followId);
    setActiveRequestId(null);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setActionError(null);
    void Promise.all([requests.refetch(), following.refetch()]);
  }

  return (
    <div style={styles.container}>
      <div style={styles.tabs}>
        {(
          [
            { id: 'following', label: `Following (${followingProfiles.length})` },
            { id: 'requests', label: `Requests (${requestItems.length})` },
            { id: 'search', label: 'Find People' },
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

      {actionError ? <p style={styles.errorText}>{actionError}</p> : null}

      {tab === 'following' ? (
        <div style={styles.list}>
          {following.isLoading ? (
            <p style={styles.loadingText}>Loading following...</p>
          ) : followingProfiles.length === 0 ? (
            <div style={styles.empty}>
              <p style={styles.emptyTitle}>You are not following anyone yet</p>
              <p style={styles.emptyText}>
                Search for people by handle or display name to start building
                your MyLife network.
              </p>
            </div>
          ) : (
            followingProfiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                isFollowing={true}
                onFollow={() => {
                  void followProfile(profile.id);
                }}
              />
            ))
          )}
        </div>
      ) : null}

      {tab === 'requests' ? (
        <div style={styles.list}>
          {requests.isLoading ? (
            <p style={styles.loadingText}>Loading requests...</p>
          ) : requestItems.length === 0 ? (
            <p style={styles.emptyText}>No pending follow requests.</p>
          ) : (
            requestItems.map((request) => (
              <div key={request.id} style={styles.requestCard}>
                <div style={styles.requestInfo}>
                  <div
                    style={{
                      ...styles.requestAvatar,
                      backgroundImage: request.fromAvatarUrl
                        ? `url(${request.fromAvatarUrl})`
                        : undefined,
                    }}
                  >
                    {!request.fromAvatarUrl ? (
                      <span style={styles.requestAvatarText}>
                        {request.fromDisplayName.charAt(0).toUpperCase()}
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <span style={styles.requestName}>{request.fromDisplayName}</span>
                    <span style={styles.requestTime}>requested to follow you</span>
                  </div>
                </div>
                <div style={styles.requestActions}>
                  <button
                    type="button"
                    style={styles.acceptButton}
                    disabled={activeRequestId === request.id}
                    onClick={() => {
                      void respondToRequest(request.id, 'accept');
                    }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    style={styles.declineButton}
                    disabled={activeRequestId === request.id}
                    onClick={() => {
                      void respondToRequest(request.id, 'reject');
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === 'search' ? (
        <div style={styles.searchSection}>
          <input
            type="text"
            placeholder="Search by handle or name..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            style={styles.searchInput}
          />

          {searchQuery.trim().length < 2 ? (
            <p style={styles.emptyText}>
              Enter at least two characters to search MyLife members.
            </p>
          ) : search.isLoading ? (
            <p style={styles.loadingText}>Searching...</p>
          ) : searchResults.length === 0 ? (
            <p style={styles.emptyText}>No matching profiles found.</p>
          ) : (
            <div style={styles.list}>
              {searchResults.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  isFollowing={followingIds.has(profile.id)}
                  onFollow={() => {
                    void followProfile(profile.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '680px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
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
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  empty: {
    textAlign: 'center',
    padding: '48px 24px',
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-tertiary)',
    marginTop: '8px',
  },
  requestCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    padding: '12px 16px',
  },
  requestInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  requestAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '18px',
    backgroundColor: 'var(--surface-elevated)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestAvatarText: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  requestName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
    display: 'block',
  },
  requestTime: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  requestActions: {
    display: 'flex',
    gap: '8px',
  },
  acceptButton: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--accent-social)',
    color: '#FFFFFF',
    border: 'none',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    font: 'inherit',
  },
  declineButton: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    color: 'var(--text-tertiary)',
    border: '1px solid var(--border)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    font: 'inherit',
  },
  searchSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  searchInput: {
    width: '100%',
    padding: '10px 16px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '14px',
    font: 'inherit',
  },
};
