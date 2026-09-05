'use client';

import { useState } from 'react';
import type { SocialProfile } from '@mylife/social';
import { getSocialClient, suggestSocialHandle } from '@mylife/social';

interface SocialProfileSetupCardProps {
  initialDisplayName?: string;
  onCreated: (profile: SocialProfile) => void;
}

export function SocialProfileSetupCard({
  initialDisplayName = '',
  onCreated,
}: SocialProfileSetupCardProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [handle, setHandle] = useState(
    suggestSocialHandle(initialDisplayName),
  );
  const [bio, setBio] = useState('');
  const [hasEditedHandle, setHasEditedHandle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const client = getSocialClient();
    if (!client) {
      setError('Social client not initialized.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await client.createProfile({
      displayName: displayName.trim(),
      handle: suggestSocialHandle(handle),
      bio: bio.trim() || undefined,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onCreated(result.data);
  }

  return (
    <div style={styles.card}>
      <div style={styles.badge}>{'\u{1F512}'}</div>
      <h2 style={styles.title}>Create your social profile</h2>
      <p style={styles.description}>
        Social stays opt-in. Pick a handle, add an optional bio, and nothing
        auto-posts until you explicitly enable module sharing.
      </p>

      <div style={styles.form}>
        <label style={styles.label}>
          Display name
          <input
            style={styles.input}
            type="text"
            value={displayName}
            onChange={(event) => {
              const nextValue = event.target.value;
              setDisplayName(nextValue);
              if (!hasEditedHandle) {
                setHandle(suggestSocialHandle(nextValue));
              }
            }}
            placeholder="Your name"
          />
        </label>

        <label style={styles.label}>
          Handle
          <input
            style={styles.input}
            type="text"
            value={handle}
            onChange={(event) => {
              setHasEditedHandle(true);
              setHandle(event.target.value);
            }}
            placeholder="mylife_handle"
          />
        </label>

        <label style={styles.label}>
          Bio
          <textarea
            style={styles.textarea}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="What do you want friends to know about your MyLife?"
            rows={3}
          />
        </label>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}

      <button
        type="button"
        onClick={() => {
          void handleSubmit();
        }}
        style={styles.primaryButton}
        disabled={isSubmitting || displayName.trim().length === 0}
      >
        {isSubmitting ? 'Creating profile...' : 'Create profile'}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    maxWidth: '560px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  badge: {
    width: '48px',
    height: '48px',
    borderRadius: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C4DFF1A',
    fontSize: '24px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  description: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    margin: 0,
  },
  form: {
    display: 'grid',
    gap: '12px',
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
  error: {
    fontSize: '13px',
    color: 'var(--danger)',
    margin: 0,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    padding: '10px 16px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    backgroundColor: 'var(--accent-social)',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    font: 'inherit',
  },
};
