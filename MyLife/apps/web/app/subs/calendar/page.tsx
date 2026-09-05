'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchCalendarMonth, fetchRenewalSummary, generateAllRenewalEvents } from '../actions';
import { formatCurrency, formatDate } from '../ui';
import type { CalendarMonth, CalendarDay } from '@mylife/subs';

export default function SubsCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [calendarData, setCalendarData] = useState<CalendarMonth | null>(null);
  const [renewalSummary, setRenewalSummary] = useState<{ thisMonth: number; nextMonth: number; thisYear: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await generateAllRenewalEvents();
      const [cal, summary] = await Promise.all([
        fetchCalendarMonth(year, month),
        fetchRenewalSummary(),
      ]);
      setCalendarData(cal);
      setRenewalSummary(summary);
    } catch {
      setError('Could not load calendar. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const navigateMonth = (dir: -1 | 1) => {
    let newMonth = month + dir;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    setMonth(newMonth);
    setYear(newYear);
    setSelectedDate(null);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const buildGrid = () => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  const renewalsByDate = new Map<string, CalendarDay>();
  if (calendarData) {
    for (const day of calendarData.days) {
      renewalsByDate.set(day.date, day);
    }
  }

  const selectedDayData = selectedDate ? renewalsByDate.get(selectedDate) ?? null : null;
  const agendaDays = calendarData?.days?.filter((d) => d.renewals.length > 0).sort((a, b) => a.date.localeCompare(b.date)) ?? [];

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ padding: 24, borderRadius: 24, background: 'var(--glass)', border: '1px solid var(--border)', height: 300 }} />
        <div style={{ padding: 24, borderRadius: 24, background: 'var(--glass)', border: '1px solid var(--border)', height: 200 }} />
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

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <h1 style={{ margin: 0, fontSize: 28, color: 'var(--text)' }}>Renewal Calendar</h1>

      {/* Summary Bar */}
      {renewalSummary && (
        <section style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'This Month', value: renewalSummary.thisMonth },
            { label: 'Next Month', value: renewalSummary.nextMonth },
            { label: 'This Year', value: renewalSummary.thisYear },
          ].map((item) => (
            <div key={item.label} style={{ flex: 1, minWidth: 140, padding: 16, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{item.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', fontFamily: 'ui-monospace, monospace', marginTop: 4 }}>{formatCurrency(item.value)}</div>
            </div>
          ))}
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Month Grid */}
        <section style={{ padding: 24, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <button type="button" onClick={() => navigateMonth(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>
              &#8249;
            </button>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{monthNames[month - 1]} {year}</span>
            <button type="button" onClick={() => navigateMonth(1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>
              &#8250;
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
            {dayNames.map((d) => (
              <div key={d} style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, padding: '4px 0' }}>{d}</div>
            ))}
            {buildGrid().map((day, i) => {
              if (day === null) return <div key={`e-${i}`} />;
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const hasRenewals = renewalsByDate.has(dateStr);
              const isSelected = selectedDate === dateStr;
              const todayStr = new Date().toISOString().slice(0, 10);
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: isSelected ? '2px solid var(--accent-subs)' : isToday ? '1px solid var(--accent-subs-border)' : 'none',
                    background: isSelected ? 'var(--accent-subs-dim)' : 'transparent',
                    color: isToday ? 'var(--accent-subs)' : 'var(--text)',
                    fontWeight: isToday ? 700 : 400,
                    fontSize: 14,
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                  }}
                >
                  {day}
                  {hasRenewals && (
                    <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-subs)' }} />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Agenda */}
        <section style={{ padding: 24, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text)' }}>
            {selectedDate ? `Renewals on ${formatDate(selectedDate)}` : 'Upcoming Renewals'}
          </h3>

          {selectedDate && selectedDayData ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {selectedDayData.renewals.map((r) => (
                <Link
                  key={r.subscriptionId}
                  href={`/subs/${r.subscriptionId}`}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'var(--glass)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.categoryColor, flexShrink: 0 }} />
                    <span style={{ fontWeight: 500 }}>{r.subscriptionName}</span>
                  </div>
                  <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-secondary)' }}>{formatCurrency(r.amountCents)}</span>
                </Link>
              ))}
            </div>
          ) : selectedDate && !selectedDayData ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No renewals on this date.</p>
          ) : agendaDays.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No renewals this month.</p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {agendaDays.map((day) => (
                <div key={day.date}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {formatDate(day.date)}
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {day.renewals.map((r) => (
                      <Link
                        key={r.subscriptionId}
                        href={`/subs/${r.subscriptionId}`}
                        style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: 'var(--glass)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.categoryColor, flexShrink: 0 }} />
                          <span style={{ fontWeight: 500, fontSize: 14 }}>{r.subscriptionName}</span>
                        </div>
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, color: 'var(--text-secondary)' }}>{formatCurrency(r.amountCents)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
