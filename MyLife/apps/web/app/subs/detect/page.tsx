'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  fetchPlaidConfigured,
  fetchPendingDetections,
  doAcceptDetection,
  doDismissDetection,
  doAcceptAllDetections,
} from '../actions';
import { formatCurrency } from '../ui';
import type { DetectedSubscription } from '@mylife/subs';

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--warning)';
  const bg = pct >= 80
    ? 'color-mix(in srgb, var(--success) 20%, transparent)'
    : pct >= 60
      ? 'color-mix(in srgb, var(--warning) 20%, transparent)'
      : 'color-mix(in srgb, var(--warning) 20%, transparent)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 12,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {pct}%
    </span>
  );
}

function FrequencyLabel({ frequency }: { frequency: string }) {
  const labels: Record<string, string> = {
    weekly: 'Weekly',
    monthly: 'Monthly',
    annual: 'Yearly',
  };
  return <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{labels[frequency] ?? frequency}</span>;
}

export default function DetectPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [detections, setDetections] = useState<DetectedSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const [isConfigured, pending] = await Promise.all([
        fetchPlaidConfigured(),
        fetchPendingDetections(),
      ]);
      setConfigured(isConfigured);
      setDetections(pending);
    } catch {
      setConfigured(false);
      setDetections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAccept = async (id: string) => {
    setProcessing((p) => new Set(p).add(id));
    try {
      await doAcceptDetection(id);
      setDetections((d) => d.filter((det) => det.id !== id));
    } finally {
      setProcessing((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  };

  const handleDismiss = async (id: string) => {
    setProcessing((p) => new Set(p).add(id));
    try {
      await doDismissDetection(id);
      setDetections((d) => d.filter((det) => det.id !== id));
    } finally {
      setProcessing((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  };

  const handleAcceptAll = async () => {
    setLoading(true);
    try {
      await doAcceptAllDetections(0.6);
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, color: 'var(--text)' }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Find Subscriptions</div>
        <p style={{ color: 'var(--text-secondary)' }}>Scanning transactions...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: 24, fontWeight: 700, margin: 0 }}>Find Subscriptions</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '4px 0 0' }}>
            Auto-detect recurring charges from your bank transactions
          </p>
        </div>
        <Link
          href="/subs"
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: 'var(--glass)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: 14,
          }}
        >
          Back
        </Link>
      </div>

      {!configured && (
        <div
          style={{
            padding: 24,
            borderRadius: 12,
            background: 'color-mix(in srgb, var(--warning) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)',
            marginBottom: 24,
          }}
        >
          <div style={{ color: 'var(--warning)', fontWeight: 600, marginBottom: 8 }}>
            Bank Connection Required
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Plaid credentials are not configured yet. To auto-detect subscriptions
            from bank transactions, set up your Plaid account and add the
            PLAID_CLIENT_ID and PLAID_SECRET environment variables.
          </p>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text)' }}>Setup steps:</strong>
            <ol style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
              <li>Create a Plaid account at dashboard.plaid.com</li>
              <li>Get your client_id and secret from the Keys section</li>
              <li>Set PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV environment variables</li>
              <li>Restart the app to connect your bank</li>
            </ol>
          </div>
        </div>
      )}

      {detections.length === 0 ? (
        <div
          style={{
            padding: 48,
            borderRadius: 12,
            background: 'var(--glass)',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {configured ? '🔍' : '🔗'}
          </div>
          <div style={{ color: 'var(--text)', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            {configured ? 'No subscriptions detected' : 'Connect your bank to get started'}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            {configured
              ? 'Sync your bank transactions to find recurring charges automatically.'
              : 'Once Plaid is configured, sync your bank to auto-detect subscriptions.'}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              {detections.length} subscription{detections.length !== 1 ? 's' : ''} detected
            </span>
            {detections.length > 1 && (
              <button
                type="button"
                onClick={handleAcceptAll}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'var(--accent-subs)',
                  border: 'none',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Accept All (60%+ confidence)
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {detections.map((det) => {
              const busy = processing.has(det.id);
              return (
                <div
                  key={det.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: 16,
                    borderRadius: 12,
                    background: 'var(--glass)',
                    border: '1px solid var(--border)',
                    opacity: busy ? 0.5 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15 }}>{det.payee}</span>
                      <ConfidenceBadge value={det.confidence} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: 'var(--accent-subs)', fontWeight: 600, fontSize: 14 }}>
                        {formatCurrency(det.amountCents)}
                      </span>
                      <FrequencyLabel frequency={det.frequency} />
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {det.transactionDates.length} charge{det.transactionDates.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleAccept(det.id)}
                      disabled={busy}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        background: 'var(--accent-subs-dim)',
                        border: '1px solid var(--accent-subs-border)',
                        color: 'var(--accent-subs)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: busy ? 'default' : 'pointer',
                      }}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismiss(det.id)}
                      disabled={busy}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        background: 'var(--glass)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        fontSize: 13,
                        cursor: busy ? 'default' : 'pointer',
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
