'use client';

import { useState } from 'react';
import { useAuth } from '@mylife/auth/provider';
import {
  useFriendsLeaderboard,
  useMyProfile,
} from '@mylife/social';
import type { LeaderboardTimeframe } from '@mylife/social';
import { SocialProfileSetupCard } from '@/components/social/SocialProfileSetupCard';
import { SocialStateCard } from '@/components/social/SocialStateCard';
import { toLeaderboardEntryRow } from '@/components/social/types';

const TIMEFRAME_OPTIONS: readonly {
  id: LeaderboardTimeframe;
  label: string;
}[] = [
  { id: 'daily', label: 'Today' },
  { id: 'weekly', label: 'This week' },
  { id: 'monthly', label: 'This month' },
  { id: 'all_time', label: 'All time' },
];

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

export default function LeaderboardPage() {
  const auth = useAuth();
  const myProfile = useMyProfile();
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>('weekly');
  const leaderboard = useFriendsLeaderboard(timeframe);

  if (auth.isLoading || myProfile.isLoading) {
    return <p style={styles.loadingText}>Loading leaderboard...</p>;
  }

  if (myProfile.error === 'Social client not initialized') {
    return (
      <SocialStateCard
        title="Social is not configured"
        description="Leaderboards require a configured social backend."
      />
    );
  }

  if (myProfile.error === 'Not authenticated' || !auth.isAuthenticated) {
    return (
      <SocialStateCard
        title="Sign in to view leaderboards"
        description="Leaderboards are based on your MyLife account and the people you follow."
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

  if (leaderboard.isLoading) {
    return <p style={styles.loadingText}>Loading leaderboard...</p>;
  }

  if (leaderboard.error) {
    return (
      <SocialStateCard
        title="Unable to load the leaderboard"
        description={leaderboard.error}
      />
    );
  }

  const entries = (leaderboard.data ?? []).map(toLeaderboardEntryRow);

  return (
    <div style={styles.container}>
      <div style={styles.filters}>
        {TIMEFRAME_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTimeframe(option.id)}
            style={{
              ...styles.filterButton,
              backgroundColor:
                timeframe === option.id ? 'var(--accent-social)' : 'var(--surface)',
              color: timeframe === option.id ? '#FFFFFF' : 'var(--text-secondary)',
              borderColor:
                timeframe === option.id ? 'var(--accent-social)' : 'var(--border)',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyTitle}>No leaderboard entries yet</p>
          <p style={styles.emptyText}>
            Follow a few people and log activity to start comparing progress.
          </p>
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span style={styles.colRank}>Rank</span>
            <span style={styles.colName}>Member</span>
            <span style={styles.colScore}>Score</span>
          </div>
          {entries.map((entry) => (
            <div
              key={entry.userId}
              style={{
                ...styles.tableRow,
                ...(entry.rank <= 3 ? styles.topThreeRow : {}),
              }}
            >
              <span style={{ ...styles.colRank, ...styles.rankValue }}>
                {entry.rank <= 3 ? MEDALS[entry.rank - 1] : `#${entry.rank}`}
              </span>
              <div style={{ ...styles.colName, ...styles.userCell }}>
                <div style={styles.userAvatar}>
                  {entry.avatarUrl ? (
                    <img
                      alt={entry.displayName}
                      src={entry.avatarUrl}
                      style={styles.userAvatarImage}
                    />
                  ) : (
                    <span style={styles.userAvatarText}>
                      {entry.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={styles.userText}>
                  <span style={styles.userName}>{entry.displayName}</span>
                  <span style={styles.userHandle}>@{entry.handle}</span>
                </div>
              </div>
              <span style={{ ...styles.colScore, ...styles.scoreValue }}>
                {entry.score.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '720px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  filters: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  filterButton: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    font: 'inherit',
  },
  loadingText: {
    fontSize: '14px',
    color: 'var(--text-tertiary)',
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
  table: {
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex',
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
  },
  topThreeRow: {
    backgroundColor: 'var(--surface-elevated)',
  },
  colRank: {
    width: '60px',
    flexShrink: 0,
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  colName: {
    flex: 1,
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  colScore: {
    width: '100px',
    flexShrink: 0,
    textAlign: 'right' as const,
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  rankValue: {
    fontSize: '16px',
    fontWeight: 700,
    textTransform: 'none' as const,
  },
  userCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    textTransform: 'none' as const,
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '16px',
    backgroundColor: '#7C4DFF1A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  userAvatarText: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--accent-social)',
  },
  userText: {
    display: 'flex',
    flexDirection: 'column',
  },
  userName: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text)',
  },
  userHandle: {
    fontSize: '12px',
    color: 'var(--accent-social)',
  },
  scoreValue: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--accent-social)',
    textTransform: 'none' as const,
  },
};
