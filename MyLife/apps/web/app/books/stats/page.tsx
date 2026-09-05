'use client';

import { useEffect, useState } from 'react';
import {
  fetchBookCount,
  fetchBookStatusCounts,
  fetchGoalProgress,
  fetchReadingStats,
} from '../actions';
import { formatMonthLabel } from '../ui';

interface ReadingStats {
  totalBooks: number;
  totalPages: number;
  averageRating: number;
  averagePagesPerBook: number;
  booksPerMonth: Record<string, number>;
  topAuthors: Array<{ author: string; count: number }>;
}

interface GoalProgress {
  booksRead: number;
  goal?: { target_books?: number | null } | null;
}

interface StatusCounts {
  reading: number;
  wantToRead: number;
  finished: number;
  dnf: number;
}

const ACCENT = 'var(--accent-books)';
const ACCENT_DIM = 'rgba(201,137,77,0.15)';
const ACCENT_BORDER = 'rgba(201,137,77,0.25)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const SURFACE_ELEVATED = 'var(--surface-elevated)';
const BORDER = 'var(--border)';

export default function BooksStatsPage() {
  const currentYear = new Date().getFullYear();
  const [readingStats, setReadingStats] = useState<ReadingStats | null>(null);
  const [goalProgress, setGoalProgress] = useState<GoalProgress | null>(null);
  const [bookCount, setBookCount] = useState<number>(0);
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchReadingStats(),
      fetchGoalProgress(currentYear),
      fetchBookCount(),
      fetchBookStatusCounts(),
    ]).then(([nextReadingStats, nextGoalProgress, nextBookCount, nextStatusCounts]) => {
      if (cancelled) return;
      setReadingStats(nextReadingStats as ReadingStats);
      setGoalProgress(nextGoalProgress as GoalProgress);
      setBookCount(nextBookCount as number);
      setStatusCounts(nextStatusCounts as StatusCounts);
    });

    return () => {
      cancelled = true;
    };
  }, [currentYear]);

  const goalTarget = goalProgress?.goal?.target_books ?? 0;
  const progressPercent = goalTarget > 0
    ? Math.round(((goalProgress?.booksRead ?? 0) / goalTarget) * 100)
    : 0;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section
        style={{
          padding: 24,
          borderRadius: 24,
          background: ACCENT_DIM,
          border: `1px solid ${ACCENT_BORDER}`,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 32, color: TEXT }}>Reading Stats</h1>
        <p style={{ margin: '10px 0 0', color: TEXT_SEC }}>
          Your reading journey at a glance
        </p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
        {[
          ['Total books', String(readingStats?.totalBooks ?? bookCount ?? 0)],
          ['Pages read', String(readingStats?.totalPages ?? 0)],
          ['Average rating', readingStats ? readingStats.averageRating.toFixed(1) : '0.0'],
          ['Avg. pages / book', readingStats ? String(Math.round(readingStats.averagePagesPerBook)) : '0'],
        ].map(([label, value]) => (
          <article
            key={label}
            style={{
              padding: 18,
              borderRadius: 20,
              border: `1px solid ${BORDER}`,
              backgroundColor: SURFACE,
            }}
          >
            <div style={{ color: TEXT_SEC, fontWeight: 700 }}>{label}</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: ACCENT }}>{value}</div>
          </article>
        ))}
      </section>

      <section
        style={{
          padding: 24,
          borderRadius: 24,
          border: `1px solid ${BORDER}`,
          backgroundColor: SURFACE,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, color: TEXT }}>{currentYear} Reading Goal</h2>
        <p style={{ margin: '12px 0 0', fontSize: 24, fontWeight: 800, color: ACCENT }}>
          {(goalProgress?.booksRead ?? 0)} / {goalTarget} books
        </p>
        <p style={{ margin: '6px 0 0', color: TEXT_SEC }}>{progressPercent}% complete</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <article
          style={{
            padding: 24,
            borderRadius: 24,
            border: `1px solid ${BORDER}`,
            backgroundColor: SURFACE,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22, color: TEXT }}>Monthly pace</h2>
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {Object.entries(readingStats?.booksPerMonth ?? {}).map(([month, count]) => (
              <div key={month} style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontWeight: 700, color: TEXT }}>{formatMonthLabel(month)}</span>
                  <span style={{ color: TEXT_SEC }}>{count}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, backgroundColor: SURFACE_ELEVATED, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(12, count * 24))}%`,
                      height: '100%',
                      backgroundColor: ACCENT,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article
          style={{
            padding: 24,
            borderRadius: 24,
            border: `1px solid ${BORDER}`,
            backgroundColor: SURFACE,
            display: 'grid',
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22, color: TEXT }}>Library mix</h2>
          <div style={{ color: TEXT_SEC }}>Reading</div>
          <strong style={{ color: ACCENT }}>{statusCounts?.reading ?? 0}</strong>
          <div style={{ color: TEXT_SEC }}>Want to Read</div>
          <strong style={{ color: ACCENT }}>{statusCounts?.wantToRead ?? 0}</strong>
          <div style={{ color: TEXT_SEC }}>Finished</div>
          <strong style={{ color: ACCENT }}>{statusCounts?.finished ?? 0}</strong>
          <div style={{ color: TEXT_SEC }}>DNF</div>
          <strong style={{ color: ACCENT }}>{statusCounts?.dnf ?? 0}</strong>
        </article>
      </section>

      <section
        style={{
          padding: 24,
          borderRadius: 24,
          border: `1px solid ${BORDER}`,
          backgroundColor: SURFACE,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, color: TEXT }}>Top authors</h2>
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          {(readingStats?.topAuthors ?? []).map((author) => (
            <div key={author.author} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: TEXT }}>{author.author}</span>
              <strong style={{ color: ACCENT }}>{author.count}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
