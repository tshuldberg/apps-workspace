'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@mylife/auth/provider';
import {
  getSocialClient,
  useActivityFeed,
  useMyKudosForActivities,
  useMyProfile,
  useProfilesByIds,
} from '@mylife/social';
import { ActivityCard } from '@/components/social/ActivityCard';
import { SocialProfileSetupCard } from '@/components/social/SocialProfileSetupCard';
import { SocialStateCard } from '@/components/social/SocialStateCard';
import { indexProfiles, toActivityItem } from '@/components/social/types';

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

export default function SocialFeedPage() {
  const auth = useAuth();
  const myProfile = useMyProfile();
  const feed = useActivityFeed({ limit: 20 });
  const authors = useProfilesByIds((feed.data ?? []).map((activity) => activity.profileId));
  const myKudos = useMyKudosForActivities((feed.data ?? []).map((activity) => activity.id));
  const [actionError, setActionError] = useState<string | null>(null);

  if (auth.isLoading || myProfile.isLoading) {
    return <p style={styles.loadingText}>Loading social feed...</p>;
  }

  if (myProfile.error === 'Social client not initialized') {
    return (
      <SocialStateCard
        title="Social is not configured"
        description="Social features require Supabase configuration in the host app environment before feed, follows, and challenges can load."
      />
    );
  }

  if (myProfile.error === 'Not authenticated' || !auth.isAuthenticated) {
    return (
      <SocialStateCard
        title="Sign in to use social"
        description="Social features are part of the cloud experience. Connect your MyLife account first, then opt in with a social profile."
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

  if (feed.isLoading) {
    return <p style={styles.loadingText}>Loading feed...</p>;
  }

  if (feed.error) {
    return (
      <SocialStateCard
        title="Unable to load the feed"
        description={feed.error}
      />
    );
  }

  const authorMap = indexProfiles(authors.data);
  const kudosMap = myKudos.data ?? {};
  const items = (feed.data ?? []).map((activity) =>
    toActivityItem(activity, authorMap, {
      hasKudosed: kudosMap[activity.id] ?? false,
    }),
  );

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
    <div style={styles.container}>
      <div style={styles.hero}>
        <div>
          <h2 style={styles.heroTitle}>Friends feed</h2>
          <p style={styles.heroText}>
            Activity from you and the people you follow appears here. Manage
            your network from the <Link href="/social/friends" style={styles.inlineLink}>friends</Link> tab.
          </p>
        </div>
      </div>

      {actionError ? <p style={styles.errorText}>{actionError}</p> : null}

      {items.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyTitle}>No activity yet</p>
          <p style={styles.emptyText}>
            Follow people, join challenges, or post from Market and Forums to
            start filling your feed.
          </p>
        </div>
      ) : (
        <div style={styles.feed}>
          {items.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onKudos={(activityId, nextActive) => {
                void handleKudos(activityId, nextActive);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxWidth: '720px',
  },
  hero: {
    background:
      'linear-gradient(135deg, rgba(124,77,255,0.18), rgba(34,197,94,0.08))',
    borderRadius: 'var(--radius-xl)',
    border: '1px solid var(--border)',
    padding: '20px',
  },
  heroTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text)',
  },
  heroText: {
    margin: '8px 0 0',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
  },
  inlineLink: {
    color: 'var(--accent-social)',
    textDecoration: 'none',
  },
  feed: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
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
  empty: {
    textAlign: 'center',
    padding: '64px 24px',
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
