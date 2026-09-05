'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getPublicNotesAction,
  createNoteAction,
  rateNoteAction,
} from '../moderation-actions';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NoteRow {
  id: string;
  flagId: string;
  authorId: string;
  body: string;
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
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  accent: '#22C55E',
  dimText: 'rgba(228,225,233,0.45)',
  danger: '#FFB4AB',
  dangerBg: '#93000A',
  amberBg: 'rgba(245,158,11,0.05)',
  amberBorder: 'rgba(245,158,11,0.20)',
  amberText: '#F59E0B',
} as const;

const MAX_NOTE_LENGTH = 1000;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function CommunityNotesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const targetType = searchParams.get('targetType') ?? 'submission';
  const targetId = searchParams.get('targetId') ?? '';
  const flagId = searchParams.get('flagId') ?? '';

  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Write form state
  const [noteBody, setNoteBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Track which notes the user has rated
  const [ratedNotes, setRatedNotes] = useState<Record<string, 'helpful' | 'unhelpful'>>({});
  const [ratingInProgress, setRatingInProgress] = useState<string | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Load notes                                                       */
  /* ---------------------------------------------------------------- */

  const loadNotes = useCallback(async () => {
    if (!targetId) {
      setLoading(false);
      return;
    }

    try {
      const result = await getPublicNotesAction(targetType, targetId);
      if (result.ok && result.data) {
        setNotes(result.data as unknown as NoteRow[]);
      } else {
        setError(result.error ?? 'Failed to load notes');
      }
    } catch {
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                         */
  /* ---------------------------------------------------------------- */

  const handleSubmitNote = async () => {
    if (!noteBody.trim() || !flagId) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const result = await createNoteAction(
        flagId,
        'current-user', // placeholder for auth
        noteBody.trim(),
      );

      if (!result.ok) {
        setSubmitError(result.error ?? 'Failed to submit note');
        return;
      }

      setNoteBody('');
      setSubmitSuccess(true);
      // Refresh notes
      await loadNotes();
    } catch {
      setSubmitError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRate = async (noteId: string, rating: 'helpful' | 'unhelpful') => {
    if (ratingInProgress) return;
    if (ratedNotes[noteId] === rating) return;

    setRatingInProgress(noteId);

    try {
      const result = await rateNoteAction(noteId, 'current-user', rating);
      if (result.ok) {
        setRatedNotes((prev) => ({ ...prev, [noteId]: rating }));
        // Optimistically update counts
        setNotes((prev) =>
          prev.map((n) => {
            if (n.id !== noteId) return n;
            const oldRating = ratedNotes[noteId];
            let { helpfulCount, unhelpfulCount } = n;

            if (oldRating === 'helpful') helpfulCount = Math.max(0, helpfulCount - 1);
            if (oldRating === 'unhelpful') unhelpfulCount = Math.max(0, unhelpfulCount - 1);

            if (rating === 'helpful') helpfulCount += 1;
            if (rating === 'unhelpful') unhelpfulCount += 1;

            return { ...n, helpfulCount, unhelpfulCount };
          }),
        );
      }
    } catch {
      // Silently fail on rating errors
    } finally {
      setRatingInProgress(null);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Missing params                                                    */
  /* ---------------------------------------------------------------- */

  if (!targetId) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F4DD}'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.danger, marginBottom: 8 }}>
            Missing target
          </div>
          <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 24 }}>
            No content was specified to view notes for.
          </div>
          <Link
            href="/recipes"
            style={{ color: T.accent, fontSize: 14, textDecoration: 'none', fontWeight: 600 }}
          >
            Back to Recipes
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Loading                                                           */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center', color: T.dimText, fontSize: 14 }}>
          Loading community notes...
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Error                                                             */
  /* ---------------------------------------------------------------- */

  if (error) {
    return (
      <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ padding: '120px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F614}'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.danger, marginBottom: 8 }}>
            {error}
          </div>
          <button
            type="button"
            onClick={() => { setError(null); setLoading(true); loadNotes(); }}
            style={{
              color: T.accent,
              fontSize: 14,
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Main render                                                       */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Breadcrumb */}
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          background: 'none',
          border: 'none',
          color: T.textSecondary,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          marginBottom: 24,
          display: 'inline-block',
          padding: 0,
        }}
      >
        &#x2190; Back
      </button>

      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
        Community Notes
      </h1>
      <p style={{ fontSize: 14, color: T.textSecondary, marginBottom: 32, lineHeight: 1.6 }}>
        Community Notes add context to flagged content, helping readers make informed decisions.
        Notes rated helpful by the community are shown publicly.
      </p>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div style={{
          background: T.surfaceLow,
          borderRadius: 16,
          padding: '48px 24px',
          textAlign: 'center',
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F4AD}'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            No community notes yet
          </div>
          <div style={{ fontSize: 14, color: T.dimText }}>
            {flagId
              ? 'Be the first to add context to this flagged content.'
              : 'No notes have been published for this content.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {notes.map((note) => {
            const isShown = note.status === 'shown';
            const userRating = ratedNotes[note.id];
            const isRating = ratingInProgress === note.id;

            return (
              <div
                key={note.id}
                style={{
                  padding: '16px 20px',
                  borderRadius: 14,
                  background: isShown ? T.amberBg : T.surfaceLow,
                  border: `1px solid ${isShown ? T.amberBorder : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                {/* Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: T.textSecondary,
                    }}>
                      Contributor {note.authorId.slice(0, 8)}
                    </span>
                    {isShown && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: T.amberText,
                        padding: '2px 8px',
                        borderRadius: 9999,
                        background: 'rgba(245,158,11,0.15)',
                      }}>
                        Shown
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: T.dimText }}>
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Body */}
                <p style={{
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: T.text,
                  marginBottom: 14,
                  whiteSpace: 'pre-wrap',
                }}>
                  {note.body}
                </p>

                {/* Rating bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <button
                    type="button"
                    onClick={() => handleRate(note.id, 'helpful')}
                    disabled={isRating}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 12px',
                      borderRadius: 9999,
                      border: 'none',
                      background: userRating === 'helpful' ? 'rgba(34,197,94,0.15)' : T.surfaceHigh,
                      color: userRating === 'helpful' ? T.accent : T.textSecondary,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isRating ? 'default' : 'pointer',
                      opacity: isRating ? 0.5 : 1,
                      transition: 'background 0.2s, color 0.2s',
                    }}
                  >
                    {'\u{1F44D}'} {note.helpfulCount}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRate(note.id, 'unhelpful')}
                    disabled={isRating}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 12px',
                      borderRadius: 9999,
                      border: 'none',
                      background: userRating === 'unhelpful' ? 'rgba(239,68,68,0.15)' : T.surfaceHigh,
                      color: userRating === 'unhelpful' ? T.danger : T.textSecondary,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isRating ? 'default' : 'pointer',
                      opacity: isRating ? 0.5 : 1,
                      transition: 'background 0.2s, color 0.2s',
                    }}
                  >
                    {'\u{1F44E}'} {note.unhelpfulCount}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Write a note form */}
      {flagId && (
        <section style={{
          background: T.surfaceLow,
          borderRadius: 16,
          padding: '24px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <h2 style={{
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            marginBottom: 16,
          }}>
            Write a Note
          </h2>
          <p style={{
            fontSize: 13,
            color: T.textSecondary,
            marginBottom: 16,
            lineHeight: 1.6,
          }}>
            Add helpful context for other users. Notes rated helpful by the community
            will be shown publicly on the content.
          </p>

          <textarea
            value={noteBody}
            onChange={(e) => {
              setNoteBody(e.target.value);
              setSubmitSuccess(false);
            }}
            placeholder="Provide factual context that helps readers evaluate this content..."
            maxLength={MAX_NOTE_LENGTH}
            rows={5}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              background: T.surface,
              border: '1px solid rgba(255,255,255,0.06)',
              color: T.text,
              fontSize: 14,
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              resize: 'vertical',
              outline: 'none',
              marginBottom: 8,
            }}
          />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 11, color: T.dimText }}>
              {noteBody.length}/{MAX_NOTE_LENGTH}
            </span>
            {submitSuccess && (
              <span style={{ fontSize: 12, color: T.accent, fontWeight: 600 }}>
                Note submitted for review
              </span>
            )}
          </div>

          {submitError && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: T.dangerBg,
              color: T.danger,
              fontSize: 13,
              marginBottom: 12,
            }}>
              {submitError}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmitNote}
            disabled={!noteBody.trim() || submitting}
            style={{
              padding: '12px 28px',
              borderRadius: 9999,
              border: 'none',
              background: !noteBody.trim() || submitting ? T.surfaceHigh : T.accent,
              color: !noteBody.trim() || submitting ? T.dimText : '#131318',
              fontWeight: 700,
              fontSize: 14,
              cursor: !noteBody.trim() || submitting ? 'default' : 'pointer',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Note'}
          </button>
        </section>
      )}
    </div>
  );
}

export default function CommunityNotesPage() {
  return (
    <Suspense fallback={null}>
      <CommunityNotesPageContent />
    </Suspense>
  );
}
