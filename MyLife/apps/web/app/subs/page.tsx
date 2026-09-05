'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  fetchCostSummary,
  fetchSubscriptions,
  fetchOpportunities,
} from './actions';
import { formatCurrency, formatCycleShort, formatRelativeDate, getStatusConfig } from './ui';
import type { CostSummary, Subscription, OpportunityScore, SubscriptionFilter } from '@mylife/subs';

type SortBy = 'name' | 'cost' | 'nextRenewal' | 'createdAt';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'paused' | 'cancelled' | 'trial';

function SkeletonBlock({ width, height }: { width: string | number; height: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 8,
        background: 'var(--border)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

export default function SubsDashboardPage() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('cost');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<'monthly' | 'annual'>('monthly');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: SubscriptionFilter = {
        sortBy,
        sortOrder,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      };
      const [summaryData, subsData, oppsData] = await Promise.all([
        fetchCostSummary(),
        fetchSubscriptions(filter),
        fetchOpportunities(40),
      ]);
      setSummary(summaryData);
      setSubs(subsData);
      setOpportunities(oppsData);
    } catch {
      setError('Could not load your subscriptions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const statusCounts = useMemo(() => {
    if (!summary) return { all: 0, active: 0, paused: 0, cancelled: 0, trial: 0 };
    return {
      all: summary.activeCount + summary.pausedCount + summary.cancelledCount + summary.trialCount,
      active: summary.activeCount,
      paused: summary.pausedCount,
      cancelled: summary.cancelledCount,
      trial: summary.trialCount,
    };
  }, [summary]);

  const handleSort = (col: SortBy) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder(col === 'cost' ? 'desc' : 'asc');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ padding: 24, borderRadius: 24, background: 'var(--accent-subs-dim)', border: '1px solid var(--accent-subs-border)' }}>
          <SkeletonBlock width={200} height={40} />
          <div style={{ marginTop: 12 }}><SkeletonBlock width={300} height={20} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} width={90} height={36} />)}
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ padding: 16, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <SkeletonBlock width="100%" height={20} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text)' }}>Something went wrong</h2>
        <p style={{ margin: '12px 0 20px', color: 'var(--text-secondary)' }}>{error}</p>
        <button
          type="button"
          onClick={() => void loadData()}
          style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--accent-subs)', color: 'var(--background)', fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!summary || (statusCounts.all === 0 && subs.length === 0)) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 28, color: 'var(--text)' }}>Start tracking your subscriptions</h2>
        <p style={{ margin: '12px auto 24px', maxWidth: 480, color: 'var(--text-secondary)' }}>
          Add your subscriptions to see your monthly burn rate, upcoming renewals, and savings opportunities.
        </p>
        <Link
          href="/subs/catalog"
          style={{ display: 'inline-block', padding: '12px 24px', borderRadius: 999, background: 'var(--accent-subs)', color: 'var(--background)', fontWeight: 700, textDecoration: 'none' }}
        >
          + Add Subscription
        </Link>
      </div>
    );
  }

  const heroAmount = viewMode === 'monthly' ? summary.totalMonthlyCents : summary.totalAnnualCents;
  const heroLabel = viewMode === 'monthly' ? '/month' : '/year';
  const dailyCost = Math.round(summary.totalMonthlyCents / 30);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Hero Section */}
      <section
        style={{
          padding: 24,
          borderRadius: 24,
          background: 'var(--accent-subs-dim)',
          border: '1px solid var(--accent-subs-border)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)', fontFamily: 'ui-monospace, monospace' }}>
              {formatCurrency(heroAmount)}
            </span>
            <span style={{ fontSize: 18, color: 'var(--text-secondary)' }}>{heroLabel}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'monthly' ? 'annual' : 'monthly')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-subs)', cursor: 'pointer', fontWeight: 600, fontSize: 14, padding: 0 }}
            >
              {viewMode === 'monthly'
                ? `${formatCurrency(summary.totalAnnualCents)}/yr`
                : `${formatCurrency(summary.totalMonthlyCents)}/mo`}
            </button>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{formatCurrency(dailyCost)}/day</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              {summary.activeCount} active{summary.pausedCount > 0 ? `, ${summary.pausedCount} paused` : ''}
            </span>
          </div>
        </div>
        <Link
          href="/subs/catalog"
          style={{ borderRadius: 999, background: 'var(--accent-subs)', color: 'var(--background)', padding: '10px 16px', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          + Add Subscription
        </Link>
      </section>

      {/* Filter Pills */}
      <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['all', 'active', 'paused', 'cancelled', 'trial'] as StatusFilter[]).map((status) => {
          const count = statusCounts[status];
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              style={{
                borderRadius: 999,
                border: isActive ? '1px solid var(--accent-subs)' : '1px solid var(--border)',
                background: isActive ? 'var(--accent-subs)' : 'var(--glass)',
                color: isActive ? 'var(--background)' : 'var(--text-secondary)',
                padding: '8px 14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
            </button>
          );
        })}
      </section>

      {/* Subscription Table */}
      {subs.length === 0 ? (
        <section
          style={{ padding: 32, borderRadius: 24, border: '1px dashed var(--accent-subs-border)', background: 'var(--glass)', textAlign: 'center' }}
        >
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No subscriptions match this filter.</p>
        </section>
      ) : (
        <section style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                {([
                  { key: 'name' as SortBy, label: 'Name' },
                  { key: 'cost' as SortBy, label: 'Cost' },
                  { key: 'nextRenewal' as SortBy, label: 'Renewal' },
                ] as const).map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      color: sortBy === key ? 'var(--accent-subs)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {label} {sortBy === key ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </th>
                ))}
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                  Cycle
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => {
                const statusCfg = getStatusConfig(sub.status);
                return (
                  <tr
                    key={sub.id}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/subs/${sub.id}`} style={{ color: 'var(--text)', textDecoration: 'none', fontWeight: 500 }}>
                        {sub.name}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', color: 'var(--text)' }}>
                      {formatCurrency(sub.costCents)}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {sub.nextRenewalDate ? formatRelativeDate(sub.nextRenewalDate) : '--'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'var(--border)',
                          color: 'var(--text-secondary)',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {formatCycleShort(sub.billingCycle)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{ color: statusCfg.color, fontSize: 12, fontWeight: 600 }}>
                        {statusCfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Savings Opportunities */}
      {opportunities.length > 0 && (
        <section style={{ padding: 20, borderRadius: 20, background: 'var(--glass)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text)' }}>Savings Opportunities</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {opportunities.slice(0, 5).map((opp) => (
              <Link
                key={opp.subscriptionId}
                href={`/subs/${opp.subscriptionId}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                  color: 'var(--text)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 500 }}>{opp.subscriptionName}</span>
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: opp.priority === 'high' ? 'color-mix(in srgb, var(--danger) 15%, transparent)' : 'color-mix(in srgb, var(--warning) 15%, transparent)',
                      color: opp.priority === 'high' ? 'var(--danger)' : 'var(--warning)',
                    }}
                  >
                    {opp.priority.toUpperCase()}
                  </span>
                </div>
                <span style={{ color: 'var(--success)', fontWeight: 600, fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
                  Save {formatCurrency(opp.monthlySavingsCents)}/mo
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
