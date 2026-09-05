'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      setError(authError?.message ?? 'Failed to create account');
      setLoading(false);
      return;
    }

    // 2. Create restaurant
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .insert({
        slug: slug || generateSlug(restaurantName),
        display_name: restaurantName,
        legal_name: restaurantName,
      })
      .select('id')
      .single();

    if (restError || !restaurant) {
      setError(restError?.message ?? 'Failed to create restaurant');
      setLoading(false);
      return;
    }

    // 3. Create restaurant_users row (owner)
    const { error: ruError } = await supabase
      .from('restaurant_users')
      .insert({
        restaurant_id: restaurant.id,
        user_id: authData.user.id,
        role: 'owner',
        can_manage_billing: true,
        can_manage_staff: true,
        accepted_at: new Date().toISOString(),
      });

    if (ruError) {
      setError(ruError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Create your restaurant
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Get started with MyLife Reservations
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
            minLength={8}
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
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Restaurant name</span>
          <input
            type="text"
            value={restaurantName}
            onChange={(e) => {
              setRestaurantName(e.target.value);
              if (!slug) setSlug(generateSlug(e.target.value));
            }}
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
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            URL slug
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            required
            placeholder="my-restaurant"
            style={{
              padding: '0.625rem 0.75rem',
              background: 'var(--surface-mid)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            reservations.mylife.app/{slug || 'my-restaurant'}
          </span>
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
          {loading ? 'Creating...' : 'Create restaurant'}
        </button>
      </form>

      <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: 'var(--accent-light)' }}>
          Sign in
        </Link>
      </p>
    </>
  );
}
