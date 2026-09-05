'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Route-level error boundary for the web hub. Catches render errors from
 * `page.tsx` and any child component that doesn't have its own boundary.
 * Async data-fetch errors are still handled in-page via setError().
 */
export default function HubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[hub] render error:', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 16,
        minHeight: 300,
        gap: 12,
      }}
    >
      <div style={{ fontSize: 36 }}>⚠️</div>
      <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 20, fontWeight: 700 }}>
        The hub ran into a problem
      </h2>
      <p style={{ color: 'var(--text-secondary)', margin: 0, textAlign: 'center', maxWidth: 420 }}>
        {error.message || 'An unexpected error occurred while rendering your dashboard.'}
      </p>
      {error.digest && (
        <p style={{ color: 'var(--text-tertiary)', margin: 0, fontSize: 11, fontFamily: 'monospace' }}>
          Error ID: {error.digest}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          onClick={reset}
          style={{
            background: '#3B82F6',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontWeight: 700,
            padding: '8px 16px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <Link
          href="/discover"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Browse modules
        </Link>
      </div>
    </div>
  );
}
