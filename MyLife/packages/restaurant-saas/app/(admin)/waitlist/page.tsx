'use client';

import { useState } from 'react';
import type { WaitlistEntry, WaitlistStatus } from '@/lib/waitlist/types';
import { estimateWait, recalculatePositions } from '@/lib/waitlist/quote';
import { getWalkAwayReasons, isValidTransition } from '@/lib/waitlist/lifecycle';

// Mock data for UI development
const MOCK_ENTRIES: WaitlistEntry[] = [
  {
    id: '1',
    restaurantId: 'r1',
    dinerName: 'Sarah Chen',
    phone: '+15551234567',
    partySize: 4,
    dietaryNotes: 'Gluten-free',
    joinedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    estimatedWaitMin: 15,
    position: 1,
    status: 'waiting',
    readyPingedAt: null,
    walkedAwayReason: null,
    smsConsent: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    restaurantId: 'r1',
    dinerName: 'Marcus Johnson',
    phone: '+15559876543',
    partySize: 2,
    dietaryNotes: null,
    joinedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    estimatedWaitMin: 25,
    position: 2,
    status: 'waiting',
    readyPingedAt: null,
    walkedAwayReason: null,
    smsConsent: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    restaurantId: 'r1',
    dinerName: 'Emily Rodriguez',
    phone: null,
    partySize: 6,
    dietaryNotes: 'Nut allergy',
    joinedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    estimatedWaitMin: 35,
    position: 3,
    status: 'waiting',
    readyPingedAt: null,
    walkedAwayReason: null,
    smsConsent: false,
    createdAt: new Date().toISOString(),
  },
];

const AVG_TURN_MINUTES = 12;

const STATUS_COLORS: Record<WaitlistStatus, string> = {
  waiting: 'var(--warm)',
  ready: 'var(--info)',
  seated: 'var(--success)',
  walked_away: 'var(--text-tertiary)',
};

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>(MOCK_ENTRIES);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showReasonPicker, setShowReasonPicker] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  // Add walk-in form state
  const [formName, setFormName] = useState('');
  const [formPartySize, setFormPartySize] = useState(2);
  const [formPhone, setFormPhone] = useState('');
  const [formDietary, setFormDietary] = useState('');
  const [formSmsConsent, setFormSmsConsent] = useState(false);

  const activeEntries = entries.filter((e) => e.status === 'waiting' || e.status === 'ready');
  const completedEntries = entries.filter((e) => e.status === 'seated' || e.status === 'walked_away');

  function handleAddWalkIn() {
    if (!formName.trim()) return;

    const newEntry: WaitlistEntry = {
      id: crypto.randomUUID(),
      restaurantId: 'r1',
      dinerName: formName.trim(),
      phone: formPhone.trim() || null,
      partySize: formPartySize,
      dietaryNotes: formDietary.trim() || null,
      joinedAt: new Date().toISOString(),
      estimatedWaitMin: null,
      position: null,
      status: 'waiting',
      readyPingedAt: null,
      walkedAwayReason: null,
      smsConsent: formSmsConsent,
      createdAt: new Date().toISOString(),
    };

    const updated = recalculatePositions([...entries, newEntry]);
    // Update estimated wait for the new entry
    const position = updated.find((e) => e.id === newEntry.id)?.position ?? 1;
    const quote = estimateWait(position, AVG_TURN_MINUTES);
    const withEstimate = updated.map((e) =>
      e.id === newEntry.id ? { ...e, estimatedWaitMin: quote.max } : e
    );

    setEntries(withEstimate);
    setShowAddForm(false);
    setFormName('');
    setFormPartySize(2);
    setFormPhone('');
    setFormDietary('');
    setFormSmsConsent(false);
  }

  function handleStatusChange(id: string, newStatus: WaitlistStatus, reason?: string) {
    setEntries((prev) => {
      const updated = prev.map((entry) => {
        if (entry.id !== id) return entry;
        if (!isValidTransition(entry.status, newStatus)) return entry;

        return {
          ...entry,
          status: newStatus,
          readyPingedAt: newStatus === 'ready' ? new Date().toISOString() : entry.readyPingedAt,
          walkedAwayReason: newStatus === 'walked_away' ? (reason ?? null) : entry.walkedAwayReason,
        };
      });
      return recalculatePositions(updated);
    });
    setShowReasonPicker(null);
  }

  function getWaitDisplay(entry: WaitlistEntry): string {
    const elapsed = Math.round((Date.now() - new Date(entry.joinedAt).getTime()) / 60000);
    return `${elapsed}m`;
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    marginTop: '4px',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '0.8125rem',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>Waitlist</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {activeEntries.length} {activeEntries.length === 1 ? 'party' : 'parties'} waiting
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Kitchen pacing pause */}
          <button
            onClick={() => setPaused(!paused)}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              border: '1px solid var(--border)',
              background: paused ? 'rgba(220, 38, 38, 0.15)' : 'transparent',
              color: paused ? 'var(--accent-light)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {paused ? '⏸ Paused' : '▶ Accepting'}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + Add Walk-in
          </button>
        </div>
      </div>

      {/* Paused banner */}
      {paused && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '8px',
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          fontSize: '0.8125rem',
          color: 'var(--accent-light)',
        }}>
          Kitchen pacing paused. New walk-ins will not receive time estimates until resumed.
        </div>
      )}

      {/* Add walk-in form */}
      {showAddForm && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          background: 'var(--surface-low)',
          border: '1px solid var(--border)',
        }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '12px' }}>Add Walk-in</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Name *
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Guest name"
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Party Size *
              <select
                value={formPartySize}
                onChange={(e) => setFormPartySize(parseInt(e.target.value))}
                style={inputStyle}
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Phone
              <input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Dietary Notes
              <input
                type="text"
                value={formDietary}
                onChange={(e) => setFormDietary(e.target.value)}
                placeholder="Allergies, restrictions..."
                style={inputStyle}
              />
            </label>
          </div>
          {formPhone && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formSmsConsent}
                onChange={(e) => setFormSmsConsent(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Guest consents to SMS notifications
            </label>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={() => setShowAddForm(false)}
              style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8125rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddWalkIn}
              disabled={!formName.trim()}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                opacity: !formName.trim() ? 0.5 : 1,
              }}
            >
              Add to Waitlist
            </button>
          </div>
        </div>
      )}

      {/* Active entries */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {activeEntries.map((entry) => (
            <div
              key={entry.id}
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                background: 'var(--surface-low)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              {/* Position */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--glass-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: STATUS_COLORS[entry.status],
                flexShrink: 0,
              }}>
                {entry.position ?? '-'}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{entry.dinerName}</span>
                  <span style={{
                    fontSize: '0.6875rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: `color-mix(in srgb, ${STATUS_COLORS[entry.status]} 15%, transparent)`,
                    color: STATUS_COLORS[entry.status],
                    fontWeight: 500,
                  }}>
                    {entry.status.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>{entry.partySize} {entry.partySize === 1 ? 'guest' : 'guests'}</span>
                  <span>{getWaitDisplay(entry)} waited</span>
                  {entry.dietaryNotes && <span style={{ color: 'var(--warm)' }}>{entry.dietaryNotes}</span>}
                  {entry.smsConsent && entry.phone && <span style={{ color: 'var(--info)' }}>SMS</span>}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {entry.status === 'waiting' && (
                  <button
                    onClick={() => handleStatusChange(entry.id, 'ready')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: 'rgba(139, 207, 240, 0.15)',
                      color: 'var(--info)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Ready
                  </button>
                )}
                {(entry.status === 'waiting' || entry.status === 'ready') && (
                  <button
                    onClick={() => handleStatusChange(entry.id, 'seated')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: 'rgba(48, 209, 88, 0.15)',
                      color: 'var(--success)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Seated
                  </button>
                )}
                {(entry.status === 'waiting' || entry.status === 'ready') && (
                  <button
                    onClick={() => setShowReasonPicker(entry.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      background: 'transparent',
                      color: 'var(--text-tertiary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    Walked Away
                  </button>
                )}
              </div>

              {/* Reason picker dropdown */}
              {showReasonPicker === entry.id && (
                <div style={{
                  position: 'absolute',
                  right: '16px',
                  marginTop: '80px',
                  background: 'var(--surface-high)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '4px',
                  zIndex: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}>
                  {getWalkAwayReasons().map((reason) => (
                    <button
                      key={reason}
                      onClick={() => handleStatusChange(entry.id, 'walked_away', reason)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '0.8125rem',
                        color: 'var(--text)',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      {reason}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowReasonPicker(null)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}

          {activeEntries.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '1rem', marginBottom: '4px' }}>No one waiting</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>Add a walk-in to get started</p>
            </div>
          )}
        </div>

        {/* Completed section */}
        {completedEntries.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Completed Today
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {completedEntries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    background: 'var(--surface)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    opacity: 0.6,
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{entry.dinerName}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {entry.partySize} guests
                  </span>
                  <span style={{
                    fontSize: '0.6875rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: `color-mix(in srgb, ${STATUS_COLORS[entry.status]} 15%, transparent)`,
                    color: STATUS_COLORS[entry.status],
                  }}>
                    {entry.status.replace('_', ' ')}
                  </span>
                  {entry.walkedAwayReason && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                      {entry.walkedAwayReason}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
