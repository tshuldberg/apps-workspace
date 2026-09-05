'use client';

import type { Challenge } from './types';

interface ChallengeCardProps {
  challenge: Challenge;
  onJoin?: (challengeId: string) => void;
}

export function ChallengeCard({ challenge, onJoin }: ChallengeCardProps) {
  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(challenge.endDate).getTime() - Date.now()) / 86_400_000
    )
  );

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div
          style={{
            ...styles.moduleBadge,
            backgroundColor: `${challenge.moduleAccentColor}1A`,
          }}
        >
          <span style={styles.moduleIcon}>{challenge.moduleIcon}</span>
        </div>
        <div style={styles.headerText}>
          <h3 style={styles.title}>{challenge.title}</h3>
          <p style={styles.meta}>
            {challenge.participantCount} participant
            {challenge.participantCount !== 1 ? 's' : ''} &middot; {daysLeft}{' '}
            day{daysLeft !== 1 ? 's' : ''} left
          </p>
        </div>
      </div>

      <p style={styles.description}>{challenge.description}</p>

      {challenge.isJoined && challenge.progress !== undefined && (
        <div style={styles.progressContainer}>
          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressFill,
                width: `${Math.min(100, challenge.progress)}%`,
                backgroundColor: challenge.moduleAccentColor,
              }}
            />
          </div>
          <span style={styles.progressLabel}>{challenge.progress}%</span>
        </div>
      )}

      <div style={styles.footer}>
        {challenge.isJoined ? (
          <span style={styles.joinedBadge}>Joined</span>
        ) : (
          <button
            type="button"
            onClick={() => onJoin?.(challenge.id)}
            style={styles.joinButton}
          >
            Join Challenge
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  moduleBadge: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  moduleIcon: {
    fontSize: '20px',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  meta: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    margin: 0,
    marginTop: '2px',
  },
  description: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
    margin: 0,
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  progressTrack: {
    flex: 1,
    height: '6px',
    backgroundColor: 'var(--surface-elevated)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  progressLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    flexShrink: 0,
  },
  footer: {
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
    transition: 'opacity 0.15s',
  },
  joinedBadge: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--success)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
};
