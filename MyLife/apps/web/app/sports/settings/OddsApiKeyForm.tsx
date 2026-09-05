'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { SPORTS_ACCENT } from '../_ui';
import { sportsSetOddsApiKey } from '../actions';

export function OddsApiKeyForm({ hasKey }: { hasKey: boolean }) {
  const [value, setValue] = useState('');
  const [stored, setStored] = useState(hasKey);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSave = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setStatus('Enter a key to save.');
      return;
    }
    startTransition(async () => {
      try {
        await sportsSetOddsApiKey(trimmed);
        setValue('');
        setStored(true);
        setStatus('Saved.');
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Could not save');
      }
    });
  };

  const onClear = () => {
    startTransition(async () => {
      try {
        await sportsSetOddsApiKey(null);
        setValue('');
        setStored(false);
        setStatus('Cleared.');
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Could not clear');
      }
    });
  };

  return (
    <section style={styles.card}>
      <h3 style={styles.heading}>Odds API key</h3>
      <p style={styles.body}>
        Bring your own from the-odds-api.com (free tier: 500 requests/month).
        We never store it outside this browser / device.
      </p>
      <p style={styles.body}>
        Status: {stored ? 'Saved on this device' : 'Not set'}
      </p>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste your API key"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        style={styles.input}
      />
      <div style={styles.buttonRow}>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          style={styles.primaryBtn}
        >
          Save key
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={pending}
          style={styles.secondaryBtn}
        >
          Clear key
        </button>
      </div>
      {status ? <p style={styles.status}>{status}</p> : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    padding: 18,
    borderRadius: 18,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'grid',
    gap: 10,
  },
  heading: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--text)',
  },
  body: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  input: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 14,
  },
  buttonRow: { display: 'flex', gap: 10 },
  primaryBtn: {
    padding: '10px 16px',
    borderRadius: 10,
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontWeight: 800,
    fontSize: 13,
    border: 'none',
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 16px',
    borderRadius: 10,
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontWeight: 700,
    fontSize: 13,
    border: '1px solid var(--border)',
    cursor: 'pointer',
  },
  status: {
    margin: 0,
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
};
