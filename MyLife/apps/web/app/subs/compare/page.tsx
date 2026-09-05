'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  fetchOpportunities,
  fetchComparisonSummary,
} from '../actions';
import { formatCurrency } from '../ui';
import type { OpportunityScore } from '@mylife/subs';

export default function SubsComparePage() {
  const [opportunities, setOpportunities] = useState<OpportunityScore[]>([]);
  const [summary, setSummary] = useState<{ totalMonthlySavingsCents: number; subscriptionsWithSavings: number; topOpportunity: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [opps, sum] = await Promise.all([
        fetchOpportunities(40),
        fetchComparisonSummary(),
      ]);
      setOpportunities(opps);
      setSummary(sum);
    } catch {
      setError('Could not load comparisons. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: 'var(--text)' }}>Price Comparison</h1>
        <div style={{ height: 100, borderRadius: 20, background: 'var(--glass)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 140, borderRadius: 20, background: 'var(--glass)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text)' }}>Something went wrong</h2>
        <p style={{ margin: '12px 0 20px', color: 'var(--text-secondary)' }}>{error}</p>
        <button type="button" onClick={() => void loadData()} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--accent-subs)', color: 'var(--background)', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          Try Again
        </button>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: 'var(--text)' }}>Price Comparison</h1>
        <div style={{ padding: 48, textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text)' }}>No savings opportunities found</h2>
          <p style={{ margin: '12px auto 24px', maxWidth: 480, color: 'var(--text-secondary)' }}>
            Add subscriptions to compare prices and find savings opportunities across tiers and alternative services.
          </p>
          <Link href="/subs/catalog" style={{ color: 'var(--accent-subs)', fontWeight: 600, textDecoration: 'none' }}>
            + Add Subscriptions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <h1 style={{ margin: 0, fontSize: 28, color: 'var(--text)' }}>Price Comparison</h1>

      {/* Savings Summary */}
      {summary && summary.totalMonthlySavingsCents > 0 && (
        <section style={{ padding: 24, borderRadius: 20, background: 'var(--accent-subs-dim)', border: '1px solid var(--accent-subs-border)' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', fontFamily: 'ui-monospace, monospace' }}>
            Save up to {formatCurrency(summary.totalMonthlySavingsCents)}/month
          </div>
          <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 15 }}>
            {formatCurrency(summary.totalMonthlySavingsCents * 12)}/year across {summary.subscriptionsWithSavings} subscription{summary.subscriptionsWithSavings !== 1 ? 's' : ''}
            {summary.topOpportunity && `. Biggest opportunity: ${summary.topOpportunity}`}
          </p>
        </section>
      )}

      {/* Opportunity Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {opportunities.map((opp) => (
          <Link
            key={opp.subscriptionId}
            href={`/subs/${opp.subscriptionId}`}
            style={{
              padding: 20,
              borderRadius: 20,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
              color: 'var(--text)',
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{opp.subscriptionName}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: opp.priority === 'high' ? 'color-mix(in srgb, var(--danger) 15%, transparent)' : 'color-mix(in srgb, var(--warning) 15%, transparent)',
                  color: opp.priority === 'high' ? 'var(--danger)' : 'var(--warning)',
                }}
              >
                {opp.priority.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Current</span>
                <span style={{ fontFamily: 'ui-monospace, monospace' }}>{formatCurrency(opp.monthlySavingsCents)}/mo</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Potential savings</span>
                <span style={{ color: 'var(--success)', fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>
                  {formatCurrency(opp.annualSavingsCents)}/yr
                </span>
              </div>
            </div>

            {opp.reasons.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {opp.reasons.slice(0, 2).map((r) => (
                  <span key={r.signal} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 4, background: 'var(--glass)', border: '1px solid var(--border)' }}>
                    {r.description.length > 40 ? r.description.slice(0, 40) + '...' : r.description}
                  </span>
                ))}
              </div>
            )}

            <span style={{ fontSize: 13, color: 'var(--accent-subs)', fontWeight: 600 }}>View Details &#8250;</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
