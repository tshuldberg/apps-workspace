'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getChallengeTemplatesAction,
  getSeasonalChallengesAction,
} from '../challenge-actions';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChallengeGoalTemplate {
  description: string;
  targetCount: number;
  metricType: string;
}

interface ChallengeTemplate {
  id: string;
  name: string;
  description: string;
  season: string;
  durationDays: number;
  goals: ChallengeGoalTemplate[];
  badgeReward: string;
  icon: string;
}

type SeasonTab = 'all' | 'spring' | 'summer' | 'fall' | 'winter';

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
  accent: '#22C55E',
  accentLight: '#4ADE80',
  gold: '#C9894D',
  goldLight: '#FFB877',
  dimText: 'rgba(228,225,233,0.45)',
} as const;

const SEASON_TABS: { key: SeasonTab; label: string }[] = [
  { key: 'all', label: 'All Seasons' },
  { key: 'spring', label: '\u{1F33F} Spring' },
  { key: 'summer', label: '\u{2600}\u{FE0F} Summer' },
  { key: 'fall', label: '\u{1F342} Fall' },
  { key: 'winter', label: '\u{2744}\u{FE0F} Winter' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ChallengesPage() {
  const [activeTab, setActiveTab] = useState<SeasonTab>('all');
  const [templates, setTemplates] = useState<ChallengeTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result =
        activeTab === 'all'
          ? await getChallengeTemplatesAction()
          : await getSeasonalChallengesAction(activeTab);

      if (result.ok && result.data) {
        setTemplates(result.data as unknown as ChallengeTemplate[]);
      }
    } catch (err) {
      console.error('[challenges] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Link
          href="/recipes"
          style={{
            color: T.textSecondary,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            marginBottom: 16,
            display: 'inline-block',
          }}
        >
          &#x2190; Back to Dashboard
        </Link>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
          {'\u{1F3C6}'} Cooking Challenges
        </h1>
        <p style={{ fontSize: 14, color: T.textSecondary }}>
          Join seasonal challenges, compete with other chefs, and earn badges.
        </p>
      </div>

      {/* Season tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
        {SEASON_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            style={{
              padding: '10px 24px',
              borderRadius: 9999,
              border: 'none',
              background: activeTab === key ? T.accent : T.surfaceLow,
              color: activeTab === key ? '#131318' : T.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: T.dimText, fontSize: 14 }}>
          Loading challenges...
        </div>
      ) : templates.length === 0 ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: T.dimText }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F3C6}'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>
            No challenges for this season
          </div>
          <div style={{ fontSize: 14 }}>
            Check back later or browse all seasons.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {templates.map((template) => (
            <div
              key={template.id}
              style={{
                padding: 24,
                borderRadius: 20,
                background: T.surfaceLow,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 36 }}>{template.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>
                    {template.name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: T.goldLight,
                    }}>
                      {template.season === 'any' ? 'Year-round' : template.season}
                    </span>
                    <span style={{ fontSize: 10, color: T.dimText }}>{'\u00B7'}</span>
                    <span style={{ fontSize: 11, color: T.textSecondary }}>
                      {template.durationDays} days
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p style={{ fontSize: 13, lineHeight: 1.5, color: T.dimText, margin: 0 }}>
                {template.description}
              </p>

              {/* Goals */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {template.goals.map((goal, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: T.accent,
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 12, color: T.textSecondary }}>
                      {goal.description}
                    </span>
                  </div>
                ))}
              </div>

              {/* Join button */}
              <button
                type="button"
                style={{
                  padding: '12px 0',
                  borderRadius: 12,
                  border: 'none',
                  background: T.accent,
                  color: '#131318',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  marginTop: 'auto',
                }}
              >
                Join Challenge
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
