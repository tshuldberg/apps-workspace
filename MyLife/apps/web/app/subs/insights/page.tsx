'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchCategoryBreakdown,
  fetchCycleBreakdown,
  fetchPriceChanges,
  fetchSpendingProjection,
  fetchTotalSavings,
  fetchCostSummary,
} from '../actions';
import { formatCurrency, formatCycleFull } from '../ui';
import type { CategoryBreakdown, CycleBreakdown, PriceChangeAnalysis, CostSummary } from '@mylife/subs';

export default function SubsInsightsPage() {
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [cycles, setCycles] = useState<CycleBreakdown[]>([]);
  const [priceChanges, setPriceChanges] = useState<PriceChangeAnalysis[]>([]);
  const [projection, setProjection] = useState<{ next30DaysCents: number; next90DaysCents: number; next12MonthsCents: number } | null>(null);
  const [savings, setSavings] = useState<{ totalCents: number; cancelledCount: number; downgradedCount: number } | null>(null);
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catData, cycleData, priceData, projData, savData, sumData] = await Promise.all([
        fetchCategoryBreakdown(),
        fetchCycleBreakdown(),
        fetchPriceChanges(),
        fetchSpendingProjection(),
        fetchTotalSavings(),
        fetchCostSummary(),
      ]);
      setCategories(catData);
      setCycles(cycleData);
      setPriceChanges(priceData);
      setProjection(projData);
      setSavings(savData);
      setSummary(sumData);
    } catch {
      setError('Could not load analytics. Please try again.');
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
        <h1 style={{ margin: 0, fontSize: 28, color: 'var(--text)' }}>Spending Insights</h1>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 180, borderRadius: 20, background: 'var(--glass)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
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

  if (categories.length === 0 && cycles.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 28, color: 'var(--text)' }}>Add subscriptions to see spending insights</h2>
        <p style={{ margin: '12px 0', color: 'var(--text-secondary)' }}>Once you have active subscriptions, this page will show category breakdowns, price trends, and projections.</p>
      </div>
    );
  }

  const totalMonthly = summary?.totalMonthlyCents ?? 0;

  // Build donut gradient
  const donutGradient = (() => {
    if (categories.length === 0) return 'var(--border)';
    const segments: string[] = [];
    let offset = 0;
    for (const cat of categories) {
      const end = offset + (cat.percentage / 100) * 360;
      segments.push(`${cat.categoryColor} ${offset}deg ${end}deg`);
      offset = end;
    }
    return `conic-gradient(${segments.join(', ')})`;
  })();

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <h1 style={{ margin: 0, fontSize: 28, color: 'var(--text)' }}>Spending Insights</h1>

      {/* Category Donut + Cycle Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Category Donut */}
        <section style={{ padding: 24, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, color: 'var(--text)' }}>By Category</h3>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
              <div style={{ width: 140, height: 140, borderRadius: '50%', background: donutGradient }} />
              <div style={{ position: 'absolute', inset: 25, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'ui-monospace, monospace' }}>
                  {formatCurrency(totalMonthly)}
                </span>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8, flex: 1 }}>
              {categories.map((cat) => (
                <div key={cat.categoryId ?? 'other'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat.categoryColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>{cat.categoryName}</span>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace' }}>
                    {formatCurrency(cat.monthlyCents)} ({cat.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cycle Breakdown */}
        <section style={{ padding: 24, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, color: 'var(--text)' }}>By Billing Cycle</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {cycles.map((cyc) => (
              <div key={cyc.cycle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: 'var(--text)' }}>{formatCycleFull(cyc.cycle)} ({cyc.count})</span>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace' }}>
                    {formatCurrency(cyc.totalMonthlyCents)}/mo ({cyc.percentage}%)
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: 'var(--accent-subs)', width: `${cyc.percentage}%`, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            ))}
            {cycles.length === 0 && <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No active subscriptions.</p>}
          </div>
        </section>
      </div>

      {/* Price Changes */}
      <section style={{ padding: 24, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text)' }}>Price Changes</h3>
        {priceChanges.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No price changes recorded yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {priceChanges.map((pc) => (
              <div key={pc.subscriptionId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--border)' }}>
                <div>
                  <span style={{ fontWeight: 500, color: 'var(--text)' }}>{pc.subscriptionName}</span>
                  <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                    {formatCurrency(pc.originalCostCents)} &#8594; {formatCurrency(pc.currentCostCents)}
                  </span>
                </div>
                <span style={{ fontWeight: 600, fontSize: 13, color: pc.direction === 'increased' ? 'var(--danger)' : pc.direction === 'decreased' ? 'var(--success)' : 'var(--text-secondary)' }}>
                  {pc.direction === 'increased' ? '+' : ''}{pc.totalChangePercent}%
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Projections + Savings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Projections */}
        {projection && (
          <section style={{ padding: 24, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text)' }}>Spending Projection</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { label: 'Next 30 days', value: projection.next30DaysCents },
                { label: 'Next 90 days', value: projection.next90DaysCents },
                { label: 'Next 12 months', value: projection.next12MonthsCents },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{item.label}</span>
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: 'var(--text)' }}>{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Savings */}
        {savings && (
          <section style={{ padding: 24, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text)' }}>Savings This Year</h3>
            {savings.totalCents > 0 ? (
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)', fontFamily: 'ui-monospace, monospace' }}>
                  {formatCurrency(savings.totalCents)}
                </div>
                <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
                  Saved by cancelling {savings.cancelledCount} subscription{savings.cancelledCount !== 1 ? 's' : ''}
                  {savings.downgradedCount > 0 ? ` and downgrading ${savings.downgradedCount}` : ''}
                </p>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No cancellation savings recorded this year.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
