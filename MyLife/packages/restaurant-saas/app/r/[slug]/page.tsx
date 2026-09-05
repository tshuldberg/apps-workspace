import { createClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function RestaurantPublicPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  // In production, fetch restaurant by slug
  void supabase;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Hero */}
      <div style={{
        height: '240px',
        background: 'linear-gradient(180deg, var(--surface-mid) 0%, var(--bg) 100%)',
        display: 'flex',
        alignItems: 'flex-end',
        padding: '2rem',
      }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>{slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Italian · $$$ · East Village</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
        <a
          href={`/r/${slug}/book`}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px',
            borderRadius: '8px',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 600,
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Make a Reservation
        </a>

        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'var(--surface-low)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>Hours</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Mon-Thu: 5pm - 10pm</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Fri-Sat: 5pm - 11pm</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Sun: 4pm - 9pm</p>
          </div>
        </div>
      </div>
    </div>
  );
}
