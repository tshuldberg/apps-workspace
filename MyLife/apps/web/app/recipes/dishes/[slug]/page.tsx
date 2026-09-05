'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getDishBySlugAction,
  getSubmissionsForDishAction,
  castVoteAction,
} from '../../cloud-actions';
import { getPublicNotesAction } from '../../moderation-actions';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DishDetail {
  id: string;
  name: string;
  slug: string;
  nativeName: string | null;
  category: string;
  cuisine: string;
  region: string | null;
  description: string | null;
  photoUrl: string | null;
  submissionCount: number;
}

interface SubmissionRow {
  id: string;
  dishId: string;
  recipeSnapshotId: string;
  profileId: string;
  photoUrl: string | null;
  photoVerified: boolean;
  chefLocation: string | null;
  chefOrigin: string | null;
  voteScore: number;
  rank: number | null;
  createdAt: string;
}

interface NoteRow {
  id: string;
  body: string;
  authorId: string;
  helpfulCount: number;
  unhelpfulCount: number;
  status: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const T = {
  bg: '#131318',
  surfaceLow: '#1B1B20',
  surface: '#1F1F25',
  surfaceHigh: '#2A292F',
  surfaceHighest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  accent: '#22C55E',
  accentLight: '#4ADE80',
  gold: '#C9894D',
  goldLight: '#FFB877',
  dimText: 'rgba(228,225,233,0.45)',
} as const;

const VOTE_TIERS = [
  { tier: 0, label: 'Not for me', emoji: '\u{1F44E}', color: '#6B7280' },
  { tier: 1, label: "I'd eat that", emoji: '\u{1F44D}', color: '#3B82F6' },
  { tier: 2, label: "Momma's", emoji: '\u{2764}\u{FE0F}', color: '#F59E0B' },
  { tier: 3, label: 'Best Chef', emoji: '\u{1F451}', color: '#22C55E' },
] as const;

const CATEGORY_EMOJI: Record<string, string> = {
  appetizer: '\u{1F960}',
  soup: '\u{1F35C}',
  salad: '\u{1F957}',
  main: '\u{1F356}',
  side: '\u{1F954}',
  dessert: '\u{1F370}',
  bread: '\u{1F35E}',
  beverage: '\u{1F376}',
  condiment: '\u{1F9C2}',
  snack: '\u{1F36A}',
  breakfast: '\u{1F373}',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DishDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [dish, setDish] = useState<DishDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [notesMap, setNotesMap] = useState<Record<string, NoteRow[]>>({});

  const PAGE_SIZE = 20;

  const loadDish = useCallback(async () => {
    try {
      const dishResult = await getDishBySlugAction(slug);
      if (!dishResult.ok || !dishResult.data) {
        setError('Dish not found');
        setLoading(false);
        return;
      }
      const d = dishResult.data as unknown as DishDetail;
      setDish(d);

      const subsResult = await getSubmissionsForDishAction(d.id, {
        limit: PAGE_SIZE,
        offset: 0,
      });
      if (subsResult.ok && subsResult.data) {
        const subs = subsResult.data as unknown as SubmissionRow[];
        setSubmissions(subs);

        // Load public community notes for each submission
        const noteEntries = await Promise.all(
          subs.map(async (sub) => {
            const notesResult = await getPublicNotesAction('submission', sub.id);
            const subNotes = notesResult.ok && notesResult.data
              ? (notesResult.data as unknown as NoteRow[])
              : [];
            return [sub.id, subNotes] as const;
          }),
        );
        setNotesMap(Object.fromEntries(noteEntries));
      }
    } catch (err) {
      setError('Failed to load dish');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadDish();
  }, [loadDish]);

  const handleVote = async (submissionId: string, tier: number) => {
    setVotingId(submissionId);
    try {
      // Using a placeholder voter ID - in production this comes from auth
      await castVoteAction(submissionId, 'current-user', tier);
      // Refresh submissions to show updated scores
      if (dish) {
        const result = await getSubmissionsForDishAction(dish.id, {
          limit: PAGE_SIZE,
          offset: 0,
        });
        if (result.ok && result.data) {
          setSubmissions(result.data as unknown as SubmissionRow[]);
        }
      }
    } catch {
      // Ignore vote errors silently for now
    } finally {
      setVotingId(null);
    }
  };

  const loadMoreSubmissions = async () => {
    if (!dish) return;
    const nextPage = page + 1;
    const result = await getSubmissionsForDishAction(dish.id, {
      limit: PAGE_SIZE,
      offset: nextPage * PAGE_SIZE,
    });
    if (result.ok && result.data) {
      setSubmissions((prev) => [...prev, ...(result.data as unknown as SubmissionRow[])]);
      setPage(nextPage);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render states                                                    */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center', color: T.dimText, fontSize: 14 }}>
          Loading dish...
        </div>
      </div>
    );
  }

  if (error || !dish) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F614}'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#FFB4AB', marginBottom: 8 }}>
            {error ?? 'Dish not found'}
          </div>
          <Link
            href="/recipes/dishes"
            style={{ color: T.accent, fontSize: 14, textDecoration: 'none', fontWeight: 600 }}
          >
            Browse all dishes
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Main render                                                      */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Breadcrumb */}
      <Link
        href="/recipes/dishes"
        style={{
          color: T.textSecondary,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          marginBottom: 24,
          display: 'inline-block',
        }}
      >
        &#x2190; All Dishes
      </Link>

      {/* Hero */}
      <section style={{
        position: 'relative',
        height: 320,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 32,
      }}>
        {dish.photoUrl ? (
          <img
            src={dish.photoUrl}
            alt={dish.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, ${T.surfaceLow} 0%, ${T.surfaceHigh} 50%, ${T.accent}33 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 80,
          }}>
            {CATEGORY_EMOJI[dish.category] ?? '\u{1F372}'}
          </div>
        )}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, #131318 0%, rgba(19,19,24,0.3) 40%, transparent 100%)',
        }} />
        <div style={{ position: 'absolute', bottom: 32, left: 32, right: 32 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span style={{
              padding: '4px 12px',
              borderRadius: 9999,
              background: `${T.accent}33`,
              color: T.accent,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              backdropFilter: 'blur(12px)',
            }}>
              {dish.category}
            </span>
            <span style={{
              padding: '4px 12px',
              borderRadius: 9999,
              background: `${T.goldLight}33`,
              color: T.goldLight,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              backdropFilter: 'blur(12px)',
            }}>
              {dish.cuisine}
            </span>
            {dish.region && (
              <span style={{
                padding: '4px 12px',
                borderRadius: 9999,
                background: 'rgba(255,255,255,0.1)',
                color: T.textSecondary,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                backdropFilter: 'blur(12px)',
              }}>
                {dish.region}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
            {dish.name}
          </h1>
          {dish.nativeName && (
            <p style={{ fontSize: 16, color: T.textSecondary, fontStyle: 'italic' }}>
              {dish.nativeName}
            </p>
          )}
        </div>
      </section>

      {/* Description + CTA */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 40, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          {dish.description && (
            <p style={{ fontSize: 15, lineHeight: 1.7, color: T.textSecondary }}>
              {dish.description}
            </p>
          )}
        </div>
        <Link
          href={`/recipes/submit?dish=${dish.slug}`}
          style={{
            padding: '14px 32px',
            borderRadius: 9999,
            background: `linear-gradient(135deg, ${T.accent}, ${T.accentLight})`,
            color: '#131318',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        >
          Submit Your Recipe
        </Link>
      </div>

      {/* Leaderboard */}
      <section>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}>
          <h2 style={{
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}>
            Leaderboard
          </h2>
          <span style={{ fontSize: 12, color: T.textSecondary }}>
            {dish.submissionCount} {dish.submissionCount === 1 ? 'submission' : 'submissions'}
          </span>
        </div>

        {submissions.length === 0 ? (
          <div style={{
            background: T.surfaceLow,
            borderRadius: 16,
            padding: '60px 24px',
            textAlign: 'center',
            color: T.dimText,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F3C6}'}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>
              No submissions yet
            </div>
            <div style={{ fontSize: 14, marginBottom: 16 }}>
              Be the first to submit your recipe for {dish.name}!
            </div>
            <Link
              href={`/recipes/submit?dish=${dish.slug}`}
              style={{
                color: T.accent,
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              Submit a Recipe
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {submissions.map((sub, idx) => {
              const rank = idx + 1;
              const isExpanded = expandedId === sub.id;
              const isVoting = votingId === sub.id;
              const subNotes = notesMap[sub.id] ?? [];

              return (
                <div
                  key={sub.id}
                  style={{
                    background: T.surfaceLow,
                    borderRadius: 16,
                    overflow: 'hidden',
                    transition: 'background 0.2s',
                  }}
                >
                  {/* Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '16px 20px',
                      cursor: 'pointer',
                    }}
                    onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                  >
                    {/* Rank badge */}
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 9999,
                      background: rank <= 3
                        ? rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32'
                        : T.surfaceHigh,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: rank <= 3 ? '#131318' : T.text,
                      flexShrink: 0,
                    }}>
                      {rank}
                    </div>

                    {/* Photo thumbnail */}
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: T.surfaceHigh,
                      flexShrink: 0,
                      position: 'relative',
                    }}>
                      {sub.photoUrl ? (
                        <img
                          src={sub.photoUrl}
                          alt="Submission"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                        }}>
                          {'\u{1F373}'}
                        </div>
                      )}
                      {/* Verified badge overlay */}
                      {sub.photoVerified && (
                        <div
                          title="Photo verified"
                          style={{
                            position: 'absolute',
                            bottom: -2,
                            right: -2,
                            width: 18,
                            height: 18,
                            borderRadius: 9999,
                            background: '#131318',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6.5L4.5 9L10 3" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <span style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: T.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          Chef {sub.profileId.slice(0, 8)}
                        </span>
                        {sub.photoVerified && (
                          <span
                            title="Verified photo"
                            style={{
                              color: '#22C55E',
                              fontSize: 13,
                              flexShrink: 0,
                            }}
                          >
                            {'\u2713'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {sub.chefLocation && (
                          <span style={{ fontSize: 12, color: T.textSecondary }}>
                            {sub.chefLocation}
                          </span>
                        )}
                        <Link
                          href={`/recipes/report?type=submission&targetId=${sub.id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            fontSize: 11,
                            color: T.dimText,
                            textDecoration: 'none',
                            fontWeight: 500,
                          }}
                        >
                          Report
                        </Link>
                      </div>
                    </div>

                    {/* Score */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: T.accent }}>
                        {(sub.voteScore * 100).toFixed(1)}
                      </div>
                      <div style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        color: T.textSecondary,
                      }}>
                        Score
                      </div>
                    </div>

                    {/* Vote buttons */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {VOTE_TIERS.map((vt) => (
                        <button
                          key={vt.tier}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(sub.id, vt.tier);
                          }}
                          disabled={isVoting}
                          title={vt.label}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 9999,
                            border: 'none',
                            background: T.surfaceHigh,
                            cursor: isVoting ? 'default' : 'pointer',
                            fontSize: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s, transform 0.15s',
                            opacity: isVoting ? 0.5 : 1,
                          }}
                        >
                          {vt.emoji}
                        </button>
                      ))}
                    </div>

                    {/* Expand arrow */}
                    <span style={{
                      fontSize: 12,
                      color: T.textSecondary,
                      transition: 'transform 0.2s',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}>
                      &#x25BC;
                    </span>
                  </div>

                  {/* Inline community notes */}
                  {subNotes.length > 0 && (
                    <div style={{
                      padding: '0 20px 12px 20px',
                    }}>
                      {subNotes.map((note) => (
                        <div
                          key={note.id}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            background: 'rgba(245,158,11,0.05)',
                            border: '1px solid rgba(245,158,11,0.20)',
                            marginBottom: 6,
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 4,
                          }}>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.1em',
                              color: '#F59E0B',
                            }}>
                              Community Note
                            </span>
                            <span style={{ fontSize: 10, color: T.dimText }}>
                              {'\u2022'} {'\u{1F44D}'} {note.helpfulCount}
                            </span>
                          </div>
                          <p style={{
                            fontSize: 13,
                            lineHeight: 1.6,
                            color: T.text,
                            margin: 0,
                          }}>
                            {note.body}
                          </p>
                        </div>
                      ))}
                      <Link
                        href={`/recipes/community-notes?targetType=submission&targetId=${sub.id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontSize: 11,
                          color: '#F59E0B',
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        View all notes
                      </Link>
                    </div>
                  )}

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{
                      padding: '0 20px 20px 92px',
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <div style={{ paddingTop: 16 }}>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                          {sub.chefOrigin && (
                            <span style={{ fontSize: 12, color: T.textSecondary }}>
                              Origin: {sub.chefOrigin}
                            </span>
                          )}
                          <span style={{ fontSize: 12, color: T.textSecondary }}>
                            Submitted: {new Date(sub.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Vote tier labels */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {VOTE_TIERS.map((vt) => (
                            <div
                              key={vt.tier}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 12px',
                                borderRadius: 9999,
                                background: T.surfaceHigh,
                                fontSize: 11,
                                color: T.textSecondary,
                              }}
                            >
                              <span>{vt.emoji}</span>
                              <span>{vt.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Load more */}
            {submissions.length >= PAGE_SIZE && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <button
                  type="button"
                  onClick={loadMoreSubmissions}
                  style={{
                    padding: '12px 32px',
                    borderRadius: 9999,
                    border: 'none',
                    background: T.surfaceHigh,
                    color: T.text,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  Load More Submissions
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
