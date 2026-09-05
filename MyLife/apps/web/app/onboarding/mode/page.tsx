'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setModeConfigAction } from '@/app/actions';
import type { PlanMode } from '@mylife/entitlements';

export default function ModeOnboardingPage() {
  const router = useRouter();
  const [selfHostUrl, setSelfHostUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const chooseMode = async (mode: PlanMode) => {
    setIsSaving(true);
    try {
      const serverUrl = mode === 'self_host' ? selfHostUrl || null : null;
      await setModeConfigAction(mode, serverUrl);
      router.push('/');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.title}>Choose Your Mode</h1>
      <p style={styles.subtitle}>
        You can change this any time in Settings.
      </p>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Hosted</h2>
        <p style={styles.cardBody}>Use MyLife managed services.</p>
        <button
          disabled={isSaving}
          style={styles.button}
          onClick={() => void chooseMode('hosted')}
        >
          Use Hosted
        </button>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Self-Host</h2>
        <p style={styles.cardBody}>Connect to your own server.</p>
        <input
          type="url"
          value={selfHostUrl}
          onChange={(e) => setSelfHostUrl(e.target.value)}
          placeholder="https://home.example.com"
          style={styles.input}
        />
        <button
          disabled={isSaving}
          style={styles.button}
          onClick={() => void chooseMode('self_host')}
        >
          Use Self-Host
        </button>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Local-Only</h2>
        <p style={styles.cardBody}>Keep all data on this device.</p>
        <button
          disabled={isSaving}
          style={styles.button}
          onClick={() => void chooseMode('local_only')}
        >
          Use Local-Only
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    maxWidth: '700px',
    margin: '0 auto',
    display: 'grid',
    gap: '16px',
  },
  title: {
    margin: 0,
    fontSize: '30px',
    color: 'var(--text)',
  },
  subtitle: {
    margin: 0,
    color: 'var(--text-secondary)',
  },
  card: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--surface)',
    padding: '16px',
    display: 'grid',
    gap: '8px',
  },
  cardTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '18px',
  },
  cardBody: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  input: {
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
  },
  button: {
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
