'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  fetchSubscription,
  fetchPriceHistory,
  fetchRenewalEvents,
  fetchCancellationHistory,
  fetchComparison,
  fetchCategories,
  doUpdateSubscription,
  doDeleteSubscription,
  doLogCancellationAction,
  doGenerateRenewalEvents,
} from '../actions';
import { formatCurrency, formatCycleShort, formatRelativeDate, formatDate, getStatusConfig } from '../ui';
import type {
  Subscription,
  PriceHistory,
  RenewalEvent,
  CancellationAction,
  Category,
} from '@mylife/subs';
import type { ComparisonResult } from '@mylife/subs';

export default function SubDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [sub, setSub] = useState<Subscription | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [renewalEvents, setRenewalEvents] = useState<RenewalEvent[]>([]);
  const [cancellationHistory, setCancellationHistory] = useState<CancellationAction[]>([]);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const subData = await fetchSubscription(id);
      if (!subData) {
        setError('Subscription not found.');
        setLoading(false);
        return;
      }
      setSub(subData);

      // Generate renewal events if needed, then load all data
      await doGenerateRenewalEvents(id, 12);
      const [ph, re, ch, comp, cats] = await Promise.all([
        fetchPriceHistory(id),
        fetchRenewalEvents(id),
        fetchCancellationHistory(id),
        fetchComparison(id),
        fetchCategories(),
      ]);
      setPriceHistory(ph);
      setRenewalEvents(re);
      setCancellationHistory(ch);
      setComparison(comp);
      setCategories(cats);
    } catch {
      setError('Could not load subscription details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handlePause = async () => {
    if (!sub) return;
    setActionLoading(true);
    try {
      const newStatus = sub.status === 'paused' ? 'active' : 'paused';
      await doUpdateSubscription(id, { status: newStatus });
      void loadData();
    } catch {
      setError('Failed to update status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!sub) return;
    setActionLoading(true);
    try {
      await doUpdateSubscription(id, { status: 'cancelled' });
      await doLogCancellationAction({
        subscriptionId: id,
        action: 'cancelled',
        savingsCents: sub.costCents,
      });
      void loadData();
    } catch {
      setError('Failed to cancel subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await doDeleteSubscription(id);
      router.push('/subs');
    } catch {
      setError('Failed to delete subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ height: 44, borderRadius: 8, background: 'var(--glass)', width: 200, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 160, borderRadius: 20, background: 'var(--glass)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ height: 180, borderRadius: 20, background: 'var(--glass)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 180, borderRadius: 20, background: 'var(--glass)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  if (error && !sub) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text)' }}>Something went wrong</h2>
        <p style={{ margin: '12px 0 20px', color: 'var(--text-secondary)' }}>{error}</p>
        <Link href="/subs" style={{ color: 'var(--accent-subs)', fontWeight: 600, textDecoration: 'none' }}>Back to Dashboard</Link>
      </div>
    );
  }

  if (!sub) return null;

  const statusCfg = getStatusConfig(sub.status);
  const categoryName = categories.find((c) => c.id === sub.categoryId)?.name ?? 'Uncategorized';
  const startDate = new Date(sub.startDate + 'T00:00:00');
  const now = new Date();
  const monthsActive = Math.max(1, Math.round((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  const lifetimeCostEstimate = Math.round(sub.costCents * monthsActive / (sub.billingCycle === 'monthly' ? 1 : sub.billingCycle === 'yearly' ? 12 : sub.billingCycle === 'quarterly' ? 3 : sub.billingCycle === 'weekly' ? 0.23 : 1));

  const upcomingRenewals = renewalEvents.filter((e) => e.status === 'upcoming').slice(0, 6);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Back + Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/subs" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, fontSize: 14 }}>
          &#8249; Back to Dashboard
        </Link>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            style={{ padding: '6px 14px', borderRadius: 8, background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            Delete
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => void handleDelete()} disabled={actionLoading} style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--danger)', color: 'var(--text)', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Confirm Delete
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--border)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>}

      {/* Subscription Header */}
      <section style={{ padding: 24, borderRadius: 20, background: 'var(--accent-subs-dim)', border: '1px solid var(--accent-subs-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, color: 'var(--text)' }}>{sub.name}</h1>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: 'var(--text)' }}>
                {formatCurrency(sub.costCents)}/{formatCycleShort(sub.billingCycle)}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{categoryName}</span>
              <span style={{ color: statusCfg.color, fontWeight: 600 }}>{statusCfg.label}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, color: 'var(--text-secondary)', fontSize: 14, flexWrap: 'wrap' }}>
              {sub.nextRenewalDate && (
                <span>Next renewal: {formatDate(sub.nextRenewalDate)} ({formatRelativeDate(sub.nextRenewalDate)})</span>
              )}
              <span>Started: {formatDate(sub.startDate)}</span>
              <span>Lifetime cost: ~{formatCurrency(lifetimeCostEstimate)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {sub.status !== 'cancelled' && sub.status !== 'expired' && (
              <>
                <button
                  type="button"
                  onClick={() => void handlePause()}
                  disabled={actionLoading}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--border)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                >
                  {sub.status === 'paused' ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCancel()}
                  disabled={actionLoading}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                >
                  Cancel Sub
                </button>
              </>
            )}
          </div>
        </div>
        {sub.notes && <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>{sub.notes}</p>}
      </section>

      {/* Price History + Renewal Events */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <section style={{ padding: 20, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text)' }}>Price History</h3>
          {priceHistory.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>No price changes recorded.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {priceHistory.map((ph) => (
                <div key={ph.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: 'var(--glass)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 14, color: 'var(--text)' }}>
                    {formatCurrency(ph.oldCostCents)} &#8594; {formatCurrency(ph.newCostCents)}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDate(ph.changedOn.slice(0, 10))}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ padding: 20, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text)' }}>Upcoming Renewals</h3>
          {upcomingRenewals.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>No upcoming renewals.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {upcomingRenewals.map((re) => (
                <div key={re.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: 'var(--glass)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 14, color: 'var(--text)' }}>{formatDate(re.renewalDate)}</span>
                  <span style={{ fontSize: 14, fontFamily: 'ui-monospace, monospace', color: 'var(--text-secondary)' }}>{formatCurrency(re.amountCents)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Price Comparison */}
      {comparison && (comparison.cheaperTiers.length > 0 || comparison.alternatives.length > 0) && (
        <section style={{ padding: 20, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text)' }}>Price Comparison</h3>

          {comparison.cheaperTiers.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>Cheaper Tiers</h4>
              <div style={{ display: 'grid', gap: 8 }}>
                {comparison.cheaperTiers.map((tier) => (
                  <div key={tier.tierName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--border)' }}>
                    <div>
                      <span style={{ fontWeight: 500, color: 'var(--text)' }}>{tier.tierName}</span>
                      <span style={{ marginLeft: 10, fontSize: 13, fontFamily: 'ui-monospace, monospace', color: 'var(--text-secondary)' }}>{formatCurrency(tier.monthlyCents)}/mo</span>
                    </div>
                    <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>
                      Save {formatCurrency(tier.savingsCents)}/mo ({tier.savingsPercent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {comparison.annualSavings && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, background: 'color-mix(in srgb, var(--success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 15%, transparent)' }}>
              <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 14 }}>
                Switch to annual: save {formatCurrency(comparison.annualSavings.annualSavingsCents)}/yr ({comparison.annualSavings.savingsPercent}% off)
              </span>
            </div>
          )}

          {comparison.alternatives.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>Alternatives</h4>
              <div style={{ display: 'grid', gap: 8 }}>
                {comparison.alternatives.map((alt) => (
                  <div key={alt.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--border)' }}>
                    <div>
                      <span style={{ fontWeight: 500, color: 'var(--text)' }}>{alt.name}</span>
                      <span style={{ marginLeft: 10, fontSize: 13, fontFamily: 'ui-monospace, monospace', color: 'var(--text-secondary)' }}>
                        {alt.freeOptionAvailable ? 'FREE' : `${formatCurrency(alt.monthlyCents)}/mo`}
                      </span>
                    </div>
                    <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>
                      Save {formatCurrency(alt.savingsCents)}/mo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Cancellation History */}
      <section style={{ padding: 20, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text)' }}>Cancellation History</h3>
        {cancellationHistory.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>No cancellation actions recorded.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {cancellationHistory.map((ca) => (
              <div key={ca.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: 'var(--glass)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14, color: 'var(--text)', textTransform: 'capitalize' }}>{ca.action}</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDate(ca.actedOn.slice(0, 10))}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
