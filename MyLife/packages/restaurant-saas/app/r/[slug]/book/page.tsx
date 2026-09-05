'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [step, setStep] = useState<'details' | 'policy' | 'confirm'>('details');
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    partySize: 2,
    name: '',
    email: '',
    phone: '',
    occasion: '',
    specialRequests: '',
    dietaryNotes: '',
    policyConsent: false,
  });

  const handleSubmit = async () => {
    // In production: create reservation via server action
    setStep('confirm');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '2rem' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Book a Table
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '2rem' }}>
          {slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </p>

        {step === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Date
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                />
              </label>
              <label style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Time
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                />
              </label>
            </div>

            <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Party Size
              <select
                value={formData.partySize}
                onChange={(e) => setFormData({ ...formData, partySize: parseInt(e.target.value) })}
                style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Name
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
              />
            </label>

            <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Email
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
              />
            </label>

            <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Phone
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
              />
            </label>

            <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Special Requests (optional)
              <textarea
                value={formData.specialRequests}
                onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                rows={3}
                style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', resize: 'vertical' }}
              />
            </label>

            <button
              onClick={() => setStep('policy')}
              disabled={!formData.date || !formData.time || !formData.name || !formData.email}
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                opacity: (!formData.date || !formData.time || !formData.name || !formData.email) ? 0.5 : 1,
              }}
            >
              Continue
            </button>
          </div>
        )}

        {step === 'policy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* SB 1524 Policy Disclosure */}
            <div style={{ padding: '16px', background: 'var(--surface-low)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>Reservation Policy</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                A deposit of $25 per person will be charged to hold your reservation. This deposit will be applied to your final bill upon arrival.
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '8px' }}>
                Cancellations made less than 24 hours before your reservation time will forfeit the deposit. No-shows will be charged the full deposit amount.
              </p>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.policyConsent}
                onChange={(e) => setFormData({ ...formData, policyConsent: e.target.checked })}
                style={{ marginTop: '2px', accentColor: 'var(--accent)' }}
              />
              <span>
                I have read and agree to the reservation and cancellation policy above. I authorize the deposit charge as described.
              </span>
            </label>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setStep('details')}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.policyConsent}
                style={{
                  flex: 2,
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  opacity: !formData.policyConsent ? 0.5 : 1,
                }}
              >
                Confirm Reservation
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>&#10003;</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Reservation Confirmed</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {formData.date} at {formData.time} for {formData.partySize} guest{formData.partySize > 1 ? 's' : ''}
            </p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem', marginTop: '1rem' }}>
              A confirmation email has been sent to {formData.email}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
