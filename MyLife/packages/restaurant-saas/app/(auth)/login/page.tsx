'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Sign in
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Access your restaurant dashboard
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: '0.625rem 0.75rem',
              background: 'var(--surface-mid)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              outline: 'none',
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: '0.625rem 0.75rem',
              background: 'var(--surface-mid)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              outline: 'none',
            }}
          />
        </label>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: '8px',
            fontWeight: 500,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" style={{ color: 'var(--accent-light)' }}>
          Sign up
        </Link>
      </p>
    </>
  );
}
