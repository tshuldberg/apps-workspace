'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getCommentsAction,
  addCommentAction,
  markHelpfulAction,
  unmarkHelpfulAction,
} from '../comment-actions';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CommentRow {
  id: string;
  submissionId: string;
  profileId: string;
  body: string;
  commentType: 'comment' | 'tried_this' | 'chefs_tip';
  photoUrl: string | null;
  isPinned: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

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
  gold: '#FFD700',
  goldBorder: 'rgba(255,215,0,0.30)',
  dimText: 'rgba(228,225,233,0.45)',
  glass: 'rgba(255,255,255,0.03)',
  glassBorder: 'rgba(255,255,255,0.10)',
  danger: '#FFB4AB',
} as const;

const TYPE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  comment: { label: 'Comment', bg: 'rgba(255,255,255,0.08)', color: T.textSecondary },
  tried_this: { label: 'I tried this!', bg: 'rgba(34,197,94,0.15)', color: '#4ADE80' },
  chefs_tip: { label: "Chef's Tip", bg: 'rgba(255,215,0,0.15)', color: T.gold },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function CommentsPageContent() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get('submissionId') ?? '';

  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New comment form
  const [body, setBody] = useState('');
  const [commentType, setCommentType] = useState<'comment' | 'tried_this' | 'chefs_tip'>('comment');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Helpful vote tracking
  const [votingId, setVotingId] = useState<string | null>(null);
  const [helpfulSet, setHelpfulSet] = useState<Set<string>>(new Set());

  const loadComments = useCallback(async () => {
    if (!submissionId) {
      setError('No submission ID provided');
      setLoading(false);
      return;
    }
    try {
      const result = await getCommentsAction(submissionId);
      if (result.ok && result.data) {
        setComments(result.data as unknown as CommentRow[]);
      } else {
        setError(result.error ?? 'Failed to load comments');
      }
    } catch {
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await addCommentAction(
        submissionId,
        'current-user',
        body.trim(),
        { commentType },
      );
      if (result.ok && result.data) {
        setComments((prev) => [...prev, result.data as unknown as CommentRow]);
        setBody('');
        setCommentType('comment');
      } else {
        setSubmitError(result.error ?? 'Failed to post comment');
      }
    } catch {
      setSubmitError('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHelpful = async (commentId: string) => {
    setVotingId(commentId);
    const alreadyVoted = helpfulSet.has(commentId);
    try {
      const result = alreadyVoted
        ? await unmarkHelpfulAction(commentId, 'current-user')
        : await markHelpfulAction(commentId, 'current-user');
      if (result.ok) {
        const delta = alreadyVoted ? -1 : 1;
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, helpfulCount: Math.max(0, c.helpfulCount + delta) }
              : c,
          ),
        );
        setHelpfulSet((prev) => {
          const next = new Set(prev);
          if (alreadyVoted) {
            next.delete(commentId);
          } else {
            next.add(commentId);
          }
          return next;
        });
      }
    } catch {
      // Ignore vote errors
    } finally {
      setVotingId(null);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render states                                                    */
  /* ---------------------------------------------------------------- */

  if (!submissionId) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F4AC}'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.danger, marginBottom: 8 }}>
            Missing submission ID
          </div>
          <Link
            href="/recipes"
            style={{ color: T.accent, fontSize: 14, textDecoration: 'none', fontWeight: 600 }}
          >
            Back to recipes
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center', color: T.dimText, fontSize: 14 }}>
          Loading comments...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F614}'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.danger, marginBottom: 8 }}>
            {error}
          </div>
          <Link
            href="/recipes"
            style={{ color: T.accent, fontSize: 14, textDecoration: 'none', fontWeight: 600 }}
          >
            Back to recipes
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Separate pinned vs regular                                       */
  /* ---------------------------------------------------------------- */

  const pinned = comments.filter((c) => c.isPinned);
  const regular = comments.filter((c) => !c.isPinned);

  /* ---------------------------------------------------------------- */
  /*  Main render                                                      */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Breadcrumb */}
      <Link
        href="/recipes"
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
        &#x2190; Back
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
        Comments
      </h1>
      <p style={{ fontSize: 13, color: T.dimText, marginBottom: 32 }}>
        {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
      </p>

      {/* Pinned Chef's Tips */}
      {pinned.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {pinned.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              pinned
              votingId={votingId}
              onHelpful={handleHelpful}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {comments.length === 0 && (
        <div style={{
          background: T.surfaceLow,
          borderRadius: 16,
          padding: '60px 24px',
          textAlign: 'center',
          color: T.dimText,
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F4AD}'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>
            No comments yet
          </div>
          <div style={{ fontSize: 14 }}>
            Be the first to share your thoughts on this recipe.
          </div>
        </div>
      )}

      {/* Regular comments */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
        {regular.map((c) => (
          <CommentCard
            key={c.id}
            comment={c}
            pinned={false}
            votingId={votingId}
            onHelpful={handleHelpful}
          />
        ))}
      </div>

      {/* Add comment form */}
      <div style={{
        background: T.glass,
        border: `1px solid ${T.glassBorder}`,
        borderRadius: 16,
        padding: 24,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
          Add a Comment
        </h3>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['comment', 'tried_this', 'chefs_tip'] as const).map((ct) => {
            const badge = TYPE_BADGE[ct];
            const isActive = commentType === ct;
            return (
              <button
                key={ct}
                type="button"
                onClick={() => setCommentType(ct)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 9999,
                  border: isActive ? `1px solid ${badge.color}` : '1px solid rgba(255,255,255,0.06)',
                  background: isActive ? badge.bg : 'transparent',
                  color: isActive ? badge.color : T.dimText,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {badge.label}
              </button>
            );
          })}
        </div>

        {/* Text area */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share your thoughts..."
          maxLength={2000}
          style={{
            width: '100%',
            minHeight: 100,
            background: T.surfaceLow,
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '12px 16px',
            color: T.text,
            fontSize: 14,
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 11, color: T.dimText }}>
            {body.length}/2000
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !body.trim()}
            style={{
              padding: '10px 24px',
              borderRadius: 9999,
              border: 'none',
              background: !body.trim()
                ? T.surfaceHigh
                : `linear-gradient(135deg, ${T.accent}, #4ADE80)`,
              color: !body.trim() ? T.dimText : '#131318',
              fontWeight: 700,
              fontSize: 13,
              cursor: !body.trim() || submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
        {submitError && (
          <p style={{ fontSize: 13, color: T.danger, marginTop: 8 }}>{submitError}</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Comment card                                                       */
/* ------------------------------------------------------------------ */

function CommentCard({
  comment,
  pinned,
  votingId,
  onHelpful,
}: {
  comment: CommentRow;
  pinned: boolean;
  votingId: string | null;
  onHelpful: (id: string) => void;
}) {
  const badge = TYPE_BADGE[comment.commentType] ?? TYPE_BADGE.comment;
  const isVoting = votingId === comment.id;

  return (
    <div style={{
      background: T.glass,
      border: pinned ? `1px solid ${T.goldBorder}` : `1px solid ${T.glassBorder}`,
      borderRadius: 14,
      padding: '16px 20px',
      transition: 'border-color 0.2s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {/* Author */}
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
          Chef {comment.profileId.slice(0, 8)}
        </span>

        {/* Type badge */}
        <span style={{
          padding: '2px 10px',
          borderRadius: 9999,
          background: badge.bg,
          color: badge.color,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}>
          {badge.label}
        </span>

        {pinned && (
          <span style={{
            padding: '2px 10px',
            borderRadius: 9999,
            background: 'rgba(255,215,0,0.12)',
            color: T.gold,
            fontSize: 10,
            fontWeight: 700,
          }}>
            Pinned
          </span>
        )}

        {/* Timestamp */}
        <span style={{ fontSize: 11, color: T.dimText, marginLeft: 'auto' }}>
          {new Date(comment.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Body */}
      <p style={{ fontSize: 14, lineHeight: 1.65, color: T.text, margin: '0 0 12px 0' }}>
        {comment.body}
      </p>

      {/* Photo preview for "tried this" */}
      {comment.photoUrl && (
        <div style={{
          width: 120,
          height: 80,
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 12,
          background: T.surfaceHigh,
        }}>
          <img
            src={comment.photoUrl}
            alt="Recipe attempt"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Helpful button */}
      <button
        type="button"
        onClick={() => onHelpful(comment.id)}
        disabled={isVoting}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: 9999,
          border: '1px solid rgba(255,255,255,0.10)',
          background: 'transparent',
          color: T.textSecondary,
          fontSize: 12,
          fontWeight: 600,
          cursor: isVoting ? 'default' : 'pointer',
          transition: 'border-color 0.2s',
          opacity: isVoting ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isVoting) (e.currentTarget.style.borderColor = 'rgba(34,197,94,0.50)');
        }}
        onMouseLeave={(e) => {
          (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)');
        }}
      >
        {'\u{1F44D}'} {comment.helpfulCount > 0 ? comment.helpfulCount : 'Helpful'}
      </button>
    </div>
  );
}

export default function CommentsPage() {
  return (
    <Suspense fallback={null}>
      <CommentsPageContent />
    </Suspense>
  );
}
