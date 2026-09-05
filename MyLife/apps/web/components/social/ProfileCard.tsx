'use client';

import type { SocialProfile } from './types';

interface ProfileCardProps {
  profile: SocialProfile;
  onFollow?: (userId: string) => void;
  isFollowing?: boolean;
  compact?: boolean;
}

export function ProfileCard({
  profile,
  onFollow,
  isFollowing = false,
  compact = false,
}: ProfileCardProps) {
  return (
    <div style={compact ? styles.cardCompact : styles.card}>
      <div
        style={{
          ...styles.avatar,
          width: compact ? '36px' : '48px',
          height: compact ? '36px' : '48px',
          borderRadius: compact ? '18px' : '24px',
          backgroundImage: profile.avatarUrl
            ? `url(${profile.avatarUrl})`
            : undefined,
          backgroundColor: profile.avatarUrl
            ? undefined
            : 'var(--surface-elevated)',
        }}
      >
        {!profile.avatarUrl && (
          <span
            style={{
              ...styles.avatarFallback,
              fontSize: compact ? '14px' : '18px',
            }}
          >
            {profile.displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div style={styles.info}>
        <span style={styles.name}>{profile.displayName}</span>
        <span style={styles.handle}>@{profile.handle}</span>
        {!compact && profile.bio && (
          <span style={styles.bio}>{profile.bio}</span>
        )}
        {!compact && (
          <div style={styles.stats}>
            <span style={styles.stat}>
              <strong>{profile.enabledModuleCount}</strong> modules
            </span>
            <span style={styles.stat}>
              <strong>{profile.followerCount}</strong> followers
            </span>
            <span style={styles.stat}>
              <strong>{profile.followingCount}</strong> following
            </span>
          </div>
        )}
      </div>

      {onFollow && (
        <button
          type="button"
          onClick={() => onFollow(profile.id)}
          style={{
            ...styles.followButton,
            backgroundColor: isFollowing
              ? 'transparent'
              : 'var(--accent-social)',
            color: isFollowing ? 'var(--text-tertiary)' : '#FFFFFF',
            border: isFollowing
              ? '1px solid var(--border)'
              : '1px solid var(--accent-social)',
          }}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    padding: '16px',
  },
  cardCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
  },
  avatar: {
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarFallback: {
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  info: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  name: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  handle: {
    fontSize: '12px',
    color: 'var(--accent-social)',
  },
  bio: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  stats: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px',
  },
  stat: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  followButton: {
    padding: '6px 16px',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    font: 'inherit',
    transition: 'background-color 0.15s',
    flexShrink: 0,
  },
};
