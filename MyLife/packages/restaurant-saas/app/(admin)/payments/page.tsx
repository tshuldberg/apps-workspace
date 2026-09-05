'use client';

export default function PaymentsPage() {
  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
          Payments
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
          Manage your Stripe Connect account, view payouts, and handle disputes.
        </p>
      </div>

      {/* Stripe Connect status card */}
      <div
        style={{
          background: 'var(--surface-low)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1rem' }}>
          Stripe Connect
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--warm)',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Not yet connected. Complete Stripe onboarding to accept deposits and process no-show fees.
          </span>
        </div>
        <button
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Connect with Stripe
        </button>
      </div>

      {/* Placeholder for embedded Stripe components */}
      <div
        style={{
          background: 'var(--surface-low)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: '0.875rem',
        }}
      >
        <p>Stripe Embedded Components (Payments, Payouts, Account Management) will render here once connected.</p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
          Stripe handles 1099-K issuance directly to restaurants on Standard accounts.
        </p>
      </div>
    </div>
  );
}
