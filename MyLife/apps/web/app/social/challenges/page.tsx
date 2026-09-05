'use client';

import { useState } from 'react';
import { useAuth } from '@mylife/auth/provider';
import {
  getSocialClient,
  useChallengeProgress,
  useChallenges,
  useMyProfile,
} from '@mylife/social';
import type { Challenge as PackageChallenge } from '@mylife/social';
import { ChallengeCard } from '@/components/social/ChallengeCard';
import { SocialProfileSetupCard } from '@/components/social/SocialProfileSetupCard';
import { SocialStateCard } from '@/components/social/SocialStateCard';
import { toChallengeItem } from '@/components/social/types';

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

function ChallengeListItem({
  challenge,
  onChanged,
}: {
  challenge: PackageChallenge;
  onChanged: () => void;
}) {
  const membership = useChallengeProgress(challenge.id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const challengeItem = toChallengeItem(challenge, membership.data);

  async function toggleMembership() {
    const client = getSocialClient();
    if (!client) {
      setActionError('Social client not initialized.');
      return;
    }

    setIsSubmitting(true);
    const result = membership.data
      ? await client.leaveChallenge(challenge.id)
      : await client.joinChallenge(challenge.id);
    setIsSubmitting(false);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setActionError(null);
    onChanged();
    void membership.refetch();
  }

  return (
    <div style={styles.challengeStack}>
      <ChallengeCard
        challenge={challengeItem}
        onJoin={() => {
          void toggleMembership();
        }}
      />

      {membership.data ? (
        <button
          type="button"
          style={styles.secondaryButton}
          disabled={isSubmitting}
          onClick={() => {
            void toggleMembership();
          }}
        >
          {isSubmitting ? 'Updating...' : 'Leave challenge'}
        </button>
      ) : null}

      {actionError ? <p style={styles.errorText}>{actionError}</p> : null}
    </div>
  );
}

export default function ChallengesPage() {
  const auth = useAuth();
  const myProfile = useMyProfile();
  const challenges = useChallenges({ limit: 20 });

  if (auth.isLoading || myProfile.isLoading) {
    return <p style={styles.loadingText}>Loading challenges...</p>;
  }

  if (myProfile.error === 'Social client not initialized') {
    return (
      <SocialStateCard
        title="Social is not configured"
        description="Challenges require a configured social backend."
      />
    );
  }

  if (myProfile.error === 'Not authenticated' || !auth.isAuthenticated) {
    return (
      <SocialStateCard
        title="Sign in to join challenges"
        description="Challenge memberships are tied to your MyLife account."
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

  if (challenges.isLoading) {
    return <p style={styles.loadingText}>Loading challenges...</p>;
  }

  if (challenges.error) {
    return (
      <SocialStateCard
        title="Unable to load challenges"
        description={challenges.error}
      />
    );
  }

  return (
    <div style={styles.container}>
      {challenges.data?.length ? (
        <div style={styles.grid}>
          {challenges.data.map((challenge) => (
            <ChallengeListItem
              key={challenge.id}
              challenge={challenge}
              onChanged={() => {
                void challenges.refetch();
              }}
            />
          ))}
        </div>
      ) : (
        <div style={styles.empty}>
          <p style={styles.emptyTitle}>No active challenges</p>
          <p style={styles.emptyText}>
            Challenges will appear here as your community creates them.
          </p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '840px',
  },
  loadingText: {
    fontSize: '14px',
    color: 'var(--text-tertiary)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  challengeStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  secondaryButton: {
    alignSelf: 'flex-end',
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
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
