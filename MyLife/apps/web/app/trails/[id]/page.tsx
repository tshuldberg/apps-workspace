'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  fetchTrail, editTrail, fetchRecordingsByTrail, fetchSegmentsByTrail,
  fetchPersonalBest, fetchReviewsByTrail, fetchAverageRating, fetchReviewCount,
  fetchRatingDistribution, addReview, removeReview,
} from '../actions';
import {
  ACCENT, TEXT, TEXT_SEC, TEXT_TER,
  SURFACE, BORDER, GLASS, difficultyColor, activityIcon,
  formatDistance, formatElevation, formatDurationDisplay,
} from '../ui';

interface Trail {
  id: string; name: string; difficulty: string; distanceMeters: number;
  elevationGainMeters: number; estimatedMinutes: number | null;
  lat: number; lng: number; region: string | null; description: string | null;
  isSaved: boolean;
}
interface Recording {
  id: string; name: string; activityType: string; distanceMeters: number;
  durationSeconds: number; startedAt: string;
}
interface Segment {
  id: string; name: string; distanceMeters: number; elevationGainMeters: number;
}
interface SegmentEffort { id: string; durationSeconds: number; isPersonalBest: boolean; startedAt: string; }
interface Review {
  id: string; rating: number; title: string | null; body: string | null;
  conditions: string | null; visitedAt: string | null; createdAt: string;
}

export default function TrailDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [trail, setTrail] = useState<Trail | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentPBs, setSegmentPBs] = useState<Record<string, SegmentEffort | null>>({});
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [distribution, setDistribution] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetchTrail(id)
      .then(async (t) => {
        if (!t) { setError('Trail not found'); setLoading(false); return; }
        setTrail(t as Trail);
        const [recs, segs, revs, avg, cnt, dist] = await Promise.all([
          fetchRecordingsByTrail(id),
          fetchSegmentsByTrail(id),
          fetchReviewsByTrail(id),
          fetchAverageRating(id),
          fetchReviewCount(id),
          fetchRatingDistribution(id),
        ]);
        setRecordings(recs as Recording[]);
        setSegments(segs as Segment[]);
        setReviews(revs as Review[]);
        setAvgRating(avg);
        setReviewCount(cnt);
        setDistribution(dist as Record<number, number>);
        const pbs: Record<string, SegmentEffort | null> = {};
        for (const seg of segs as Segment[]) {
          pbs[seg.id] = await fetchPersonalBest(seg.id) as SegmentEffort | null;
        }
        setSegmentPBs(pbs);
      })
      .catch(() => setError('Failed to load trail'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [id]);

  const handleToggleSave = async () => {
    if (!trail) return;
    try {
      await editTrail(id, { isSaved: !trail.isSaved });
      setTrail({ ...trail, isSaved: !trail.isSaved });
    } catch {
      setError('Failed to update save status');
    }
  };

  const handleSubmitReview = async () => {
    try {
      await addReview({ trailId: id, rating: reviewRating, title: reviewTitle || null, body: reviewBody || null });
      setShowReviewForm(false);
      setReviewTitle('');
      setReviewBody('');
      setReviewRating(5);
      loadData();
    } catch {
      setError('Failed to submit review');
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Delete this review?')) return;
    try {
      await removeReview(reviewId);
      loadData();
    } catch {
      setError('Failed to delete review');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 20 }}>
        <div style={{ height: 80, borderRadius: 16, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 60, borderRadius: 12, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
        {[1, 2, 3].map((i) => <div key={i} style={{ height: 100, borderRadius: 16, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
      </div>
    );
  }

  if (error || !trail) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: TEXT_SEC }}>{error ?? 'Trail not found'}</p>
        <Link href="/trails/list" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Back to trails</Link>
      </div>
    );
  }

  const dColor = difficultyColor(trail.difficulty);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Back link */}
      <Link href="/trails/list" style={{ color: TEXT_SEC, fontSize: 13, textDecoration: 'none' }}>&larr; Back to trails</Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{trail.name}</h1>
          {trail.region && <p style={{ margin: '6px 0 0', color: TEXT_SEC, fontSize: 15 }}>{trail.region}</p>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ padding: '4px 12px', borderRadius: 999, backgroundColor: `color-mix(in srgb, ${dColor} 15%, transparent)`, color: dColor, fontWeight: 600, fontSize: 13 }}>
            {trail.difficulty}
          </span>
          <button type="button" onClick={handleToggleSave} style={{
            borderRadius: 999, border: `1px solid ${trail.isSaved ? ACCENT : BORDER}`,
            backgroundColor: trail.isSaved ? ACCENT : GLASS, color: trail.isSaved ? 'var(--background)' : TEXT_SEC,
            padding: '6px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13,
          }}>
            {trail.isSaved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard label="Distance" value={formatDistance(trail.distanceMeters)} />
        <StatCard label="Elevation" value={formatElevation(trail.elevationGainMeters)} />
        {trail.estimatedMinutes && <StatCard label="Est. Time" value={`${trail.estimatedMinutes} min`} />}
      </div>

      {/* Description */}
      {trail.description && (
        <section>
          <SectionHeader title="Description" />
          <p style={{ margin: 0, color: TEXT_SEC, fontSize: 15, lineHeight: 1.6 }}>{trail.description}</p>
        </section>
      )}

      {/* Recordings */}
      <section>
        <SectionHeader title={`Recordings (${recordings.length})`} />
        {recordings.length === 0 ? (
          <p style={{ color: TEXT_TER, fontSize: 14 }}>No recordings on this trail yet</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {recordings.map((rec) => (
              <Link key={rec.id} href={`/trails/recordings/${rec.id}`} style={listItemStyle}>
                <span style={{ fontSize: 18 }}>{activityIcon(rec.activityType)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>{rec.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_SEC }}>
                    {formatDistance(rec.distanceMeters)} · {formatDurationDisplay(rec.durationSeconds)}
                  </p>
                </div>
                <span style={{ fontSize: 12, color: TEXT_TER }}>{new Date(rec.startedAt).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Segments */}
      {segments.length > 0 && (
        <section>
          <SectionHeader title={`Segments (${segments.length})`} />
          <div style={{ display: 'grid', gap: 8 }}>
            {segments.map((seg) => {
              const pb = segmentPBs[seg.id];
              return (
                <div key={seg.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>{seg.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_SEC }}>
                      {formatDistance(seg.distanceMeters)} · {formatElevation(seg.elevationGainMeters)} gain
                    </p>
                  </div>
                  {pb && (
                    <span style={{ padding: '3px 10px', borderRadius: 999, backgroundColor: `color-mix(in srgb, ${ACCENT} 15%, transparent)`, color: ACCENT, fontSize: 12, fontWeight: 600 }}>
                      PB: {formatDurationDisplay(pb.durationSeconds)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <SectionHeader title={`Reviews (${reviewCount})`} />
            {avgRating !== null && (
              <p style={{ margin: '4px 0 0', fontSize: 14, color: ACCENT, fontWeight: 700 }}>
                {'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))} {avgRating.toFixed(1)} / 5
              </p>
            )}
          </div>
          <button type="button" onClick={() => setShowReviewForm(!showReviewForm)} style={{
            borderRadius: 999, backgroundColor: ACCENT, color: 'var(--background)', padding: '8px 16px',
            fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
          }}>
            {showReviewForm ? 'Cancel' : 'Write Review'}
          </button>
        </div>

        {/* Rating distribution */}
        {reviewCount > 0 && (
          <div style={{ display: 'grid', gap: 4, marginBottom: 16 }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution[star] ?? 0;
              const pct = reviewCount > 0 ? (count / reviewCount) * 100 : 0;
              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: TEXT_TER, width: 16, textAlign: 'right' }}>{star}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: SURFACE }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, backgroundColor: ACCENT }} />
                  </div>
                  <span style={{ fontSize: 11, color: TEXT_TER, width: 20 }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Review form */}
        {showReviewForm && (
          <div style={{ ...cardStyle, display: 'grid', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: TEXT_SEC, display: 'block', marginBottom: 4 }}>Rating</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" onClick={() => setReviewRating(s)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 24,
                    color: s <= reviewRating ? ACCENT : TEXT_TER,
                  }}>
                    {s <= reviewRating ? '★' : '☆'}
                  </button>
                ))}
              </div>
            </div>
            <input type="text" placeholder="Title (optional)" value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} style={inputStyle} />
            <textarea placeholder="Your review..." value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            <button type="button" onClick={handleSubmitReview} style={{
              borderRadius: 999, backgroundColor: ACCENT, color: 'var(--background)', padding: '10px 20px',
              fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', justifySelf: 'start',
            }}>
              Submit Review
            </button>
          </div>
        )}

        {/* Review list */}
        {reviews.length === 0 && !showReviewForm ? (
          <p style={{ color: TEXT_TER, fontSize: 14 }}>No reviews yet. Be the first!</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {reviews.map((rev) => (
              <div key={rev.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: ACCENT, fontWeight: 700, fontSize: 14 }}>
                    {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                  </span>
                  <button type="button" onClick={() => handleDeleteReview(rev.id)} style={{
                    background: 'none', border: 'none', color: TEXT_TER, cursor: 'pointer', fontSize: 12,
                  }}>
                    Delete
                  </button>
                </div>
                {rev.title && <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: TEXT }}>{rev.title}</p>}
                {rev.body && <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC, lineHeight: 1.5 }}>{rev.body}</p>}
                <p style={{ margin: 0, fontSize: 11, color: TEXT_TER }}>
                  {new Date(rev.createdAt).toLocaleDateString()}
                  {rev.visitedAt && ` · Visited ${new Date(rev.visitedAt).toLocaleDateString()}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '12px 16px', borderRadius: 12, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
      <p style={{ margin: 0, fontSize: 11, color: TEXT_SEC }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: ACCENT }}>{value}</p>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' as const, color: TEXT_TER }}>
      {title}
    </p>
  );
}

const listItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
  border: `1px solid ${BORDER}`, backgroundColor: SURFACE, textDecoration: 'none', color: TEXT,
};

const cardStyle: React.CSSProperties = {
  padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE,
  display: 'grid', gap: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`,
  backgroundColor: 'var(--background)', color: TEXT, fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none',
};
