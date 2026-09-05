'use client';

import { useState } from 'react';
import type { ActivityItem } from './types';
import { KudosButton } from './KudosButton';

interface ActivityCardProps {
  activity: ActivityItem;
  onKudos?: (activityId: string, nextActive: boolean) => void;
}

export function ActivityCard({ activity, onKudos }: ActivityCardProps) {
  const [kudosed, setKudosed] = useState(activity.hasKudosed);
  const [kudosCount, setKudosCount] = useState(activity.kudosCount);

  function handleKudos() {
    if (!onKudos) return;

    const nextActive = !kudosed;
    setKudosed(!kudosed);
    setKudosCount((c) => (kudosed ? c - 1 : c + 1));
    onKudos(activity.id, nextActive);
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div
          style={{
            ...styles.avatar,
            backgroundImage: activity.userAvatarUrl
              ? `url(${activity.userAvatarUrl})`
              : undefined,
            backgroundColor: activity.userAvatarUrl
              ? undefined
              : 'var(--surface-elevated)',
          }}
        >
          {!activity.userAvatarUrl && (
            <span style={styles.avatarFallback}>
              {activity.userDisplayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div style={styles.headerText}>
          <span style={styles.userName}>{activity.userDisplayName}</span>
          <span style={styles.timestamp}>
            {formatRelativeTime(activity.timestamp)}
          </span>
        </div>

        <div
          style={{
            ...styles.moduleBadge,
            backgroundColor: `${activity.moduleAccentColor}1A`,
          }}
        >
          <span style={styles.moduleIcon}>{activity.moduleIcon}</span>
        </div>
      </div>

      <p style={styles.description}>{activity.description}</p>

      {activity.comments.length > 0 && (
        <div style={styles.commentsPreview}>
          {activity.comments.slice(0, 2).map((comment) => (
            <div key={comment.id} style={styles.comment}>
              <span style={styles.commentUser}>{comment.userDisplayName}</span>
              <span style={styles.commentText}>{comment.text}</span>
            </div>
          ))}
          {activity.commentCount > 2 && (
            <span style={styles.moreComments}>
              View all {activity.commentCount} comments
            </span>
          )}
        </div>
      )}

      <div style={styles.actions}>
        <KudosButton
          count={kudosCount}
          active={kudosed}
          onClick={handleKudos}
        />
        <button style={styles.commentButton} type="button">
          {activity.commentCount > 0
            ? `${activity.commentCount} comment${activity.commentCount !== 1 ? 's' : ''}`
            : 'Comment'}
        </button>
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
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
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '20px',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarFallback: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  headerText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  userName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  timestamp: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  moduleBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  moduleIcon: {
    fontSize: '16px',
  },
  description: {
    fontSize: '14px',
    color: 'var(--text)',
    lineHeight: '1.5',
    margin: 0,
  },
  commentsPreview: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    paddingLeft: '8px',
    borderLeft: '2px solid var(--border)',
  },
  comment: {
    display: 'flex',
    gap: '6px',
    fontSize: '13px',
  },
  commentUser: {
    fontWeight: 600,
    color: 'var(--text-secondary)',
    flexShrink: 0,
  },
  commentText: {
    color: 'var(--text-secondary)',
  },
  moreComments: {
    fontSize: '12px',
    color: 'var(--accent-social)',
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    paddingTop: '4px',
    borderTop: '1px solid var(--border)',
  },
  commentButton: {
    background: 'none',
    border: 'none',
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    padding: '4px 0',
    font: 'inherit',
  },
};
