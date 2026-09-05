'use client';

import { useState } from 'react';

interface SocialOnboardingProps {
  onComplete: (opted: boolean) => void;
}

export function SocialOnboarding({ onComplete }: SocialOnboardingProps) {
  const [step, setStep] = useState(0);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {step === 0 && (
          <>
            <div style={styles.iconCircle}>
              <span style={styles.icon}>{'\u{1F91D}'}</span>
            </div>
            <h2 style={styles.title}>Social Features</h2>
            <p style={styles.description}>
              Connect with friends, share achievements, and join challenges
              across all your MyLife modules. Your data stays private until you
              choose to share.
            </p>
            <div style={styles.features}>
              <div style={styles.featureRow}>
                <span style={styles.featureIcon}>{'\u{1F4F0}'}</span>
                <div>
                  <strong style={styles.featureTitle}>Activity Feed</strong>
                  <p style={styles.featureDesc}>
                    See what your friends are up to across modules
                  </p>
                </div>
              </div>
              <div style={styles.featureRow}>
                <span style={styles.featureIcon}>{'\u{1F3C6}'}</span>
                <div>
                  <strong style={styles.featureTitle}>Challenges</strong>
                  <p style={styles.featureDesc}>
                    Join reading challenges, workout goals, and more
                  </p>
                </div>
              </div>
              <div style={styles.featureRow}>
                <span style={styles.featureIcon}>{'\u{1F4E4}'}</span>
                <div>
                  <strong style={styles.featureTitle}>Share Cards</strong>
                  <p style={styles.featureDesc}>
                    Beautiful cards to share your milestones
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={styles.primaryButton}
            >
              Learn More
            </button>
            <button
              type="button"
              onClick={() => onComplete(false)}
              style={styles.secondaryButton}
            >
              Not Now
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div style={styles.iconCircle}>
              <span style={styles.icon}>{'\u{1F512}'}</span>
            </div>
            <h2 style={styles.title}>Your Privacy First</h2>
            <p style={styles.description}>
              Social features are entirely opt-in. You control exactly what is
              shared and with whom. Nothing is published without your explicit
              action.
            </p>
            <ul style={styles.privacyList}>
              <li style={styles.privacyItem}>
                All module data remains local by default
              </li>
              <li style={styles.privacyItem}>
                You choose which activities to share
              </li>
              <li style={styles.privacyItem}>
                Friends must be mutually approved
              </li>
              <li style={styles.privacyItem}>
                You can disable social features at any time
              </li>
            </ul>
            <button
              type="button"
              onClick={() => onComplete(true)}
              style={styles.primaryButton}
            >
              Enable Social Features
            </button>
            <button
              type="button"
              onClick={() => onComplete(false)}
              style={styles.secondaryButton}
            >
              Keep Private
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '60vh',
  },
  card: {
    maxWidth: '440px',
    width: '100%',
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    border: '1px solid var(--border)',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '16px',
  },
  iconCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '32px',
    backgroundColor: '#7C4DFF1A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: '28px',
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
  features: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    textAlign: 'left',
    margin: '8px 0',
  },
  featureRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  featureIcon: {
    fontSize: '20px',
    flexShrink: 0,
    marginTop: '2px',
  },
  featureTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  featureDesc: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
    marginTop: '2px',
  },
  privacyList: {
    width: '100%',
    textAlign: 'left',
    listStyle: 'none',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    margin: '8px 0',
  },
  privacyItem: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    paddingLeft: '20px',
    position: 'relative',
  },
  primaryButton: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: '#7C4DFF',
    color: '#FFFFFF',
    border: 'none',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    font: 'inherit',
    transition: 'opacity 0.15s',
  },
  secondaryButton: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    color: 'var(--text-tertiary)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    font: 'inherit',
    transition: 'color 0.15s',
  },
};
