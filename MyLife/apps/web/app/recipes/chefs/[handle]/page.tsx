'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getChefProfileByHandleAction,
  getChefSubmissionsAction,
  getCuisineBreakdownAction,
} from '../../chef-actions';
import { getPostsByAuthorAction } from '../../creator-actions';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChefProfile {
  profileId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number;
  totalSubmissions: number;
  totalVotesReceived: number;
  dishesWon: number;
  avgScore: number;
  topCuisine: string | null;
  activeSince: string;
  signatureDishes: SignatureDish[];
  badges: Badge[];
}

interface SignatureDish {
  submissionId: string;
  dishId: string;
  dishName: string;
  cuisine: string;
  voteScore: number;
  rank: number | null;
  photoUrl: string | null;
}

interface Badge {
  id: string;
  badgeId: string;
  earnedAt: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

interface SubmissionRow {
  id: string;
  dishId: string;
  profileId: string;
  photoUrl: string | null;
  chefLocation: string | null;
  voteScore: number;
  rank: number | null;
  createdAt: string;
}

interface CuisineEntry {
  cuisine: string;
  count: number;
  avgScore: number;
}

interface PostRow {
  id: string;
  title: string;
  body: string;
  postType: string;
  visibility: string;
  coverImageUrl: string | null;
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

const BADGE_TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ChefProfilePage() {
  const params = useParams();
  const handle = params.handle as string;

  const [profile, setProfile] = useState<ChefProfile | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [cuisineBreakdown, setCuisineBreakdown] = useState<CuisineEntry[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subsPage, setSubsPage] = useState(0);

  const PAGE_SIZE = 20;

  const loadProfile = useCallback(async () => {
    try {
      const profileResult = await getChefProfileByHandleAction(handle);
      if (!profileResult.ok || !profileResult.data) {
        setError('Chef not found');
        setLoading(false);
        return;
      }
      const p = profileResult.data as unknown as ChefProfile;
      setProfile(p);

      // Load submissions, cuisine breakdown, and posts in parallel
      const [subsResult, cuisineResult, postsResult] = await Promise.all([
        getChefSubmissionsAction(p.profileId, { limit: PAGE_SIZE, offset: 0 }),
        getCuisineBreakdownAction(p.profileId),
        getPostsByAuthorAction(p.profileId, { limit: 3 }),
      ]);

      if (subsResult.ok && subsResult.data) {
        setSubmissions(subsResult.data as unknown as SubmissionRow[]);
      }
      if (cuisineResult.ok && cuisineResult.data) {
        setCuisineBreakdown(cuisineResult.data as unknown as CuisineEntry[]);
      }
      if (postsResult.ok && postsResult.data) {
        setPosts(postsResult.data as unknown as PostRow[]);
      }
    } catch {
      setError('Failed to load chef profile');
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loadMoreSubmissions = async () => {
    if (!profile) return;
    const nextPage = subsPage + 1;
    const result = await getChefSubmissionsAction(profile.profileId, {
      limit: PAGE_SIZE,
      offset: nextPage * PAGE_SIZE,
    });
    if (result.ok && result.data) {
      setSubmissions((prev) => [...prev, ...(result.data as unknown as SubmissionRow[])]);
      setSubsPage(nextPage);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render states                                                    */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center', color: T.dimText, fontSize: 14 }}>
          Loading chef profile...
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F468}\u{200D}\u{1F373}'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#FFB4AB', marginBottom: 8 }}>
            {error ?? 'Chef not found'}
          </div>
          <Link
            href="/recipes/chefs"
            style={{ color: T.accent, fontSize: 14, textDecoration: 'none', fontWeight: 600 }}
          >
            Browse all chefs
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Main render                                                      */
  /* ---------------------------------------------------------------- */

  const maxCuisineCount = cuisineBreakdown.length > 0
    ? Math.max(...cuisineBreakdown.map((c) => c.count))
    : 1;

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Breadcrumb */}
      <Link
        href="/recipes/chefs"
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
        &#x2190; All Chefs
      </Link>

      {/* Hero section */}
      <section style={{
        background: T.surfaceLow,
        borderRadius: 16,
        padding: '40px 32px',
        marginBottom: 32,
        display: 'flex',
        gap: 32,
        alignItems: 'flex-start',
      }}>
        {/* Avatar */}
        <div style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          border: `3px solid ${T.accent}`,
          overflow: 'hidden',
          flexShrink: 0,
          background: T.surfaceHigh,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: 36, color: T.accent, fontWeight: 700 }}>
              {profile.displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Name + bio */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
            {profile.displayName}
          </h1>
          <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 12 }}>
            @{profile.handle}
          </div>
          {profile.bio && (
            <p style={{ fontSize: 14, lineHeight: 1.6, color: T.textSecondary, marginBottom: 16, maxWidth: 600 }}>
              {profile.bio}
            </p>
          )}
          {profile.activeSince && (
            <div style={{ fontSize: 11, color: T.dimText }}>
              Cooking since {new Date(profile.activeSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end' }}>
          <button
            type="button"
            style={{
              padding: '12px 28px',
              borderRadius: 9999,
              border: 'none',
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentLight})`,
              color: '#131318',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
          >
            Follow
          </button>
        </div>
      </section>

      {/* Stats row */}
      <section style={{
        display: 'flex',
        gap: 16,
        marginBottom: 32,
      }}>
        <StatCard value={profile.totalSubmissions} label="Submissions" />
        <StatCard value={profile.totalVotesReceived} label="Votes Received" />
        <StatCard value={profile.dishesWon} label="Dishes Won" />
        <StatCard value={profile.followerCount} label="Followers" />
      </section>

      {/* Badges */}
      {profile.badges.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            marginBottom: 16,
          }}>
            Badges
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {profile.badges.map((badge) => (
              <div
                key={badge.id}
                title={`${badge.name}: ${badge.description}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 9999,
                  background: T.surfaceLow,
                  border: `1px solid ${BADGE_TIER_COLORS[badge.tier] ?? T.surfaceHigh}33`,
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: `${BADGE_TIER_COLORS[badge.tier] ?? T.surfaceHigh}33`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}>
                  {badge.icon || '\u{1F3C5}'}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                    {badge.name}
                  </div>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: BADGE_TIER_COLORS[badge.tier] ?? T.textSecondary,
                  }}>
                    {badge.tier}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Two-column: Signature dishes + Cuisine breakdown */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
        marginBottom: 40,
      }}>
        {/* Signature dishes */}
        <section>
          <h2 style={{
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            marginBottom: 16,
          }}>
            Signature Dishes
          </h2>
          {profile.signatureDishes.length === 0 ? (
            <div style={{
              background: T.surfaceLow,
              borderRadius: 16,
              padding: '40px 24px',
              textAlign: 'center',
              color: T.dimText,
              fontSize: 13,
            }}>
              No signature dishes yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {profile.signatureDishes.map((dish) => (
                <div
                  key={dish.submissionId}
                  style={{
                    background: T.surfaceLow,
                    borderRadius: 16,
                    overflow: 'hidden',
                    display: 'flex',
                    gap: 16,
                    padding: 16,
                    alignItems: 'center',
                  }}
                >
                  {/* Photo */}
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: T.surfaceHigh,
                    flexShrink: 0,
                  }}>
                    {dish.photoUrl ? (
                      <img
                        src={dish.photoUrl}
                        alt={dish.dishName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24,
                      }}>
                        {'\u{1F373}'}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: T.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {dish.dishName}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: T.textSecondary,
                      textTransform: 'capitalize',
                      marginTop: 2,
                    }}>
                      {dish.cuisine}
                    </div>
                  </div>

                  {/* Score + rank */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: T.accent }}>
                      {(dish.voteScore * 100).toFixed(1)}
                    </div>
                    {dish.rank != null && (
                      <div style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        color: T.goldLight,
                      }}>
                        #{dish.rank}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Cuisine breakdown */}
        <section>
          <h2 style={{
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            marginBottom: 16,
          }}>
            Cuisine Breakdown
          </h2>
          {cuisineBreakdown.length === 0 ? (
            <div style={{
              background: T.surfaceLow,
              borderRadius: 16,
              padding: '40px 24px',
              textAlign: 'center',
              color: T.dimText,
              fontSize: 13,
            }}>
              No cuisine data yet.
            </div>
          ) : (
            <div style={{
              background: T.surfaceLow,
              borderRadius: 16,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}>
              {cuisineBreakdown.map((entry) => (
                <div key={entry.cuisine}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 6,
                  }}>
                    <span style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.text,
                      textTransform: 'capitalize',
                    }}>
                      {entry.cuisine}
                    </span>
                    <span style={{ fontSize: 11, color: T.textSecondary }}>
                      {entry.count} {entry.count === 1 ? 'dish' : 'dishes'}
                    </span>
                  </div>
                  {/* Bar */}
                  <div style={{
                    height: 6,
                    borderRadius: 3,
                    background: T.surfaceHigh,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(entry.count / maxCuisineCount) * 100}%`,
                      borderRadius: 3,
                      background: `linear-gradient(90deg, ${T.accent}, ${T.accentLight})`,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Blog posts (if chef is a creator) */}
      {posts.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            marginBottom: 16,
          }}>
            Latest Posts
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {posts.map((post) => (
              <div
                key={post.id}
                style={{
                  background: T.surfaceLow,
                  borderRadius: 16,
                  padding: 20,
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                {post.coverImageUrl && (
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: T.surfaceHigh,
                    flexShrink: 0,
                  }}>
                    <img
                      src={post.coverImageUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      padding: '2px 8px',
                      borderRadius: 9999,
                      background: post.visibility === 'public'
                        ? `${T.accent}22`
                        : `${T.gold}22`,
                      color: post.visibility === 'public'
                        ? T.accent
                        : T.goldLight,
                    }}>
                      {post.postType.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 15,
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {post.title}
                  </div>
                  <div style={{ fontSize: 11, color: T.dimText, marginTop: 2 }}>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All submissions */}
      <section>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <h2 style={{
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}>
            All Submissions
          </h2>
          <span style={{ fontSize: 12, color: T.textSecondary }}>
            {profile.totalSubmissions} total
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
            <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F4E4}'}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>
              No submissions yet
            </div>
            <div style={{ fontSize: 14 }}>
              This chef hasn&apos;t submitted any recipes yet.
            </div>
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 16,
            }}>
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    background: T.surfaceLow,
                    borderRadius: 16,
                    overflow: 'hidden',
                    transition: 'background 0.2s',
                  }}
                >
                  {/* Photo */}
                  <div style={{
                    aspectRatio: '4/3',
                    overflow: 'hidden',
                    background: T.surfaceHigh,
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
                        fontSize: 36,
                        background: `linear-gradient(135deg, ${T.surfaceLow}, ${T.surfaceHigh})`,
                      }}>
                        {'\u{1F373}'}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: 16 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: T.accent }}>
                        {(sub.voteScore * 100).toFixed(1)}
                      </div>
                      {sub.rank != null && (
                        <div style={{
                          padding: '3px 10px',
                          borderRadius: 9999,
                          background: sub.rank <= 3
                            ? sub.rank === 1 ? '#FFD700' : sub.rank === 2 ? '#C0C0C0' : '#CD7F32'
                            : T.surfaceHigh,
                          fontSize: 11,
                          fontWeight: 700,
                          color: sub.rank <= 3 ? '#131318' : T.text,
                        }}>
                          #{sub.rank}
                        </div>
                      )}
                    </div>
                    {sub.chefLocation && (
                      <div style={{ fontSize: 11, color: T.textSecondary }}>
                        {sub.chefLocation}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: T.dimText, marginTop: 4 }}>
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load more */}
            {submissions.length >= PAGE_SIZE * (subsPage + 1) && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
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
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div style={{
      flex: 1,
      background: '#1B1B20',
      borderRadius: 16,
      padding: '20px 16px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#E4E1E9', marginBottom: 4 }}>
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
