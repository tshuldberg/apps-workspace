'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCreatorAnalyticsAction } from '../creator-actions';

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const T = {
  bg: '#131318',
  surfaceLow: '#1B1B20',
  surface: '#1F1F25',
  surfaceHigh: '#2A292F',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  green: '#22C55E',
  greenLight: '#4ADE80',
  gold: '#C9894D',
  goldLight: '#FFB877',
  dimText: 'rgba(228,225,233,0.45)',
  danger: '#FFB4AB',
} as const;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Analytics {
  totalSubmissions: number;
  totalVotesReceived: number;
  dishesWon: number;
  avgScore: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CreatorDashboardPage() {
  // Placeholder profileId; in production this comes from auth context
  const profileId = 'current-user';

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getCreatorAnalyticsAction(profileId);
        if (res.ok && res.data) {
          setAnalytics(res.data as unknown as Analytics);
        } else {
          setError(res.error ?? 'Failed to load analytics');
        }
      } catch {
        setError('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, [profileId]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center', color: T.dimText, fontSize: 14 }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F4CA}'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.danger, marginBottom: 8 }}>
            {error ?? 'Something went wrong'}
          </div>
          <Link
            href="/recipes/creator/apply"
            style={{ color: T.green, fontSize: 14, textDecoration: 'none', fontWeight: 600 }}
          >
            Apply to become a creator
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32,
        gap: 16,
      }}>
        <div>
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: T.green,
            marginBottom: 8,
          }}>
            Creator Space
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Creator dashboard
          </h1>
          <p style={{ fontSize: 14, color: T.textSecondary }}>
            Your performance at a glance
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <Link
            href="/recipes/creator/posts"
            style={{
              padding: '10px 20px',
              borderRadius: 9999,
              background: T.surfaceHigh,
              color: T.text,
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Manage Posts
          </Link>
        </div>
      </div>

      {/* Payouts unavailable card */}
      <section
        style={{
          background: T.surfaceLow,
          borderRadius: 16,
          padding: '28px 24px',
          marginBottom: 32,
          textAlign: 'center',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            margin: '0 auto 16px',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(34,197,94,0.1)',
            fontSize: 28,
          }}
        >
          {'\u{1F4B0}'}
        </div>
        <div
          style={{
            width: 'fit-content',
            margin: '0 auto 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '6px 14px',
            borderRadius: 9999,
            background: T.surfaceHigh,
            color: T.green,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.1em',
          }}
        >
          <span
            aria-hidden="true"
            style={{ width: 6, height: 6, borderRadius: '50%', background: T.green }}
          />
          PAYOUTS UNAVAILABLE
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>
          You are not earning yet
        </h2>
        <p style={{
          maxWidth: 480,
          margin: '0 auto',
          color: T.textSecondary,
          fontSize: 14,
          lineHeight: 1.6,
        }}>
          Creator payouts have not launched. BestChef is not collecting tips
          or paid chef subscriptions, and no earnings balance is being
          tracked.
        </p>
      </section>

      {/* Real performance stats */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 32,
      }}>
        <StatCard label="Submissions" value={String(analytics.totalSubmissions)} color={T.text} />
        <StatCard label="Votes Received" value={String(analytics.totalVotesReceived)} color={T.text} />
        <StatCard label="Dishes Won" value={String(analytics.dishesWon)} color={T.goldLight} />
        <StatCard label="Avg Score" value={(analytics.avgScore * 100).toFixed(1)} color={T.green} />
      </section>

      {/* Create without a paywall */}
      <section style={{
        background: T.surfaceLow,
        borderRadius: 16,
        padding: 24,
      }}>
        <h2 style={{
          fontSize: 11,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: T.dimText,
          marginBottom: 16,
        }}>
          Create without a paywall
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{'\u{1F468}‍\u{1F373}'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
                Publish your cooking
              </div>
              <div style={{ color: T.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
                Submit recipes and take part in the BestChef community for free.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{'\u{2764}️'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
                Grow your creator presence
              </div>
              <div style={{ color: T.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
                Your chef profile, followers, votes, and community feedback are
                not tied to paid access.
              </div>
            </div>
          </div>
        </div>
      </section>

      <p style={{
        margin: '20px 0 0',
        color: T.dimText,
        fontSize: 12,
        textAlign: 'center',
      }}>
        BestChef&apos;s creator experience is free at launch.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div style={{
      background: '#1B1B20',
      borderRadius: 16,
      padding: '20px 16px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 22,
        fontWeight: 800,
        color,
        marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        color: '#D6C3B5',
      }}>
        {label}
      </div>
    </div>
  );
}
