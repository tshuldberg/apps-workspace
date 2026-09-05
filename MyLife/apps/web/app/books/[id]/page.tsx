'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  fetchBook,
  fetchReviewForBook,
  fetchSessionsForBook,
  fetchTimedSessionsForBook,
  fetchSeriesForBookAction,
} from '../actions';
import { formatBookStatus, parseStoredList } from '../ui';

interface BookDetail {
  id: string;
  title: string;
  subtitle?: string | null;
  authors: string | null;
  publisher?: string | null;
  publish_year?: number | null;
  page_count?: number | null;
  description?: string | null;
  subjects?: string | null;
  cover_url?: string | null;
  format?: string | null;
  isbn_13?: string | null;
  isbn_10?: string | null;
}

interface SessionSummary {
  id: string;
  status: string;
  current_page?: number | null;
  started_at?: string | null;
  finished_at?: string | null;
}

interface ReviewSummary {
  rating?: number | null;
  review_text?: string | null;
  favorite_quote?: string | null;
  created_at?: string | null;
}

interface TimedSessionRow {
  id: string;
  started_at: string;
  ended_at?: string | null;
  duration_ms?: number | null;
  start_page?: number | null;
  end_page?: number | null;
  pages_read?: number | null;
}

interface SeriesInfo {
  id: string;
  name: string;
  position?: number | null;
  total_books?: number | null;
}

const ACCENT = '#C9894D';
const ACCENT_WARM = '#FFB877';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const BORDER = 'var(--border)';
const SURFACE = 'var(--surface)';
const SURFACE_ELEVATED = 'var(--surface-elevated, #2A292F)';
const GLASS = 'var(--glass)';

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.25;
  return (
    <span style={{ color: ACCENT_WARM, fontSize: size, letterSpacing: 2 }}>
      {'★'.repeat(full)}
      {half ? '★' : ''}
      {'☆'.repeat(5 - full - (half ? 1 : 0))}
    </span>
  );
}

function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: '6px 14px',
        borderRadius: 999,
        backgroundColor: SURFACE_ELEVATED,
        border: `1px solid ${BORDER}`,
        color: TEXT_SEC,
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatFormat(format: string | null | undefined): string {
  if (!format) return '';
  const map: Record<string, string> = {
    physical: 'Hardcover',
    ebook: 'eBook',
    audiobook: 'Audiobook',
  };
  return map[format] ?? format;
}

export default function BookDetailPage() {
  const params = useParams<{ id: string }>();
  const bookId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [book, setBook] = useState<BookDetail | null | undefined>(undefined);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [review, setReview] = useState<ReviewSummary | null>(null);
  const [timedSessions, setTimedSessions] = useState<TimedSessionRow[]>([]);
  const [series, setSeries] = useState<SeriesInfo[]>([]);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;

    void Promise.all([
      fetchBook(bookId),
      fetchSessionsForBook(bookId),
      fetchReviewForBook(bookId),
      fetchTimedSessionsForBook(bookId),
      fetchSeriesForBookAction(bookId),
    ]).then(([nextBook, nextSessions, nextReview, nextTimed, nextSeries]) => {
      if (cancelled) return;
      setBook(nextBook as BookDetail | null);
      setSessions(nextSessions as SessionSummary[]);
      setReview(nextReview as ReviewSummary | null);
      setTimedSessions(nextTimed as TimedSessionRow[]);
      setSeries(nextSeries as SeriesInfo[]);
    });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  if (book === undefined) {
    return <p style={{ color: TEXT_SEC, padding: 24 }}>Loading book details...</p>;
  }

  if (!book) {
    return (
      <section style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>Book not found</h1>
        <p style={{ margin: '10px 0 0', color: TEXT_SEC }}>
          This title is not in your library yet.
        </p>
        <Link href="/books" style={{ display: 'inline-block', marginTop: 16, color: ACCENT, fontWeight: 700 }}>
          Back to Library
        </Link>
      </section>
    );
  }

  const authors = parseStoredList(book.authors);
  const currentSession = sessions[0];
  const progress =
    currentSession?.current_page && book.page_count
      ? Math.round((currentSession.current_page / book.page_count) * 100)
      : null;
  const statusLabel = formatBookStatus(currentSession?.status).toUpperCase();
  const isbn = book.isbn_13 || book.isbn_10;
  const publishDate = book.publish_year ? `${book.publish_year}` : null;
  const seriesInfo = series[0];

  return (
    <div style={{ display: 'grid', gap: 32 }}>
      {/* Breadcrumb + Skip to Review */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: TEXT_SEC }}>
          <Link href="/books" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Library</Link>
          <span style={{ opacity: 0.4 }}>&gt;</span>
          <span style={{ color: TEXT_SEC }}>My Collection</span>
          <span style={{ opacity: 0.4 }}>&gt;</span>
          <span style={{ color: TEXT }}>{book.title}</span>
        </nav>
        {review && (
          <a href="#curation" style={{ color: ACCENT_WARM, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            SKIP TO REVIEW
          </a>
        )}
      </div>

      {/* Hero: Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 40, alignItems: 'start' }}>
        {/* Left column: Cover + Series */}
        <div style={{ display: 'grid', gap: 20 }}>
          <div
            style={{
              width: '100%',
              aspectRatio: '2 / 3',
              borderRadius: 16,
              overflow: 'hidden',
              background: book.cover_url
                ? `center / cover no-repeat url(${book.cover_url})`
                : `linear-gradient(135deg, #1B1B20 0%, ${ACCENT} 100%)`,
              border: `1px solid ${BORDER}`,
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
            }}
          />

          {seriesInfo && (
            <div style={{ ...cardStyle, padding: 16 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 1 }}>
                Part of a series
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 700, color: TEXT }}>
                {seriesInfo.name}
              </p>
              {seriesInfo.position && seriesInfo.total_books && (
                <p style={{ margin: '4px 0 0', fontSize: 13, color: TEXT_SEC }}>
                  Volume {seriesInfo.position} of {seriesInfo.total_books}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right column: Metadata */}
        <div style={{ display: 'grid', gap: 24 }}>
          {currentSession && (
            <span
              style={{
                display: 'inline-block',
                width: 'fit-content',
                padding: '4px 12px',
                borderRadius: 6,
                backgroundColor: SURFACE_ELEVATED,
                border: `1px solid ${BORDER}`,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.5,
                color: ACCENT_WARM,
                textTransform: 'uppercase',
              }}
            >
              {statusLabel}
            </span>
          )}

          <div>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, color: TEXT, lineHeight: 1.15 }}>
              {book.title}
            </h1>
            {book.subtitle && (
              <p style={{ margin: '6px 0 0', fontSize: 18, color: TEXT_SEC, fontStyle: 'italic' }}>
                {book.subtitle}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {progress !== null && <MetaBadge>{progress}% Done</MetaBadge>}
            {book.format && <MetaBadge>{formatFormat(book.format)}</MetaBadge>}
            {book.page_count && <MetaBadge>{book.page_count} Pages</MetaBadge>}
            {typeof review?.rating === 'number' && (
              <Stars rating={review.rating} size={14} />
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.5 }}>Author</p>
              <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: TEXT }}>
                {authors.join(', ') || 'Unknown'}
              </p>
            </div>
            {book.publisher && (
              <div>
                <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.5 }}>Publisher</p>
                <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: TEXT }}>{book.publisher}</p>
              </div>
            )}
            {publishDate && (
              <div>
                <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.5 }}>Published</p>
                <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: TEXT }}>{publishDate}</p>
              </div>
            )}
            {isbn && (
              <div>
                <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.5 }}>ISBN</p>
                <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: TEXT }}>{isbn}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Synopsis */}
      {book.description && (
        <section style={cardStyle}>
          <h2 style={sectionHeading}>Synopsis</h2>
          <p
            style={{
              margin: '16px 0 0',
              color: TEXT_SEC,
              fontSize: 15,
              lineHeight: 1.7,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: synopsisExpanded ? undefined : 4,
              WebkitBoxOrient: 'vertical' as const,
            }}
          >
            {book.description}
          </p>
          {book.description.length > 200 && (
            <button
              type="button"
              onClick={() => setSynopsisExpanded(!synopsisExpanded)}
              style={{
                marginTop: 12,
                background: 'none',
                border: 'none',
                color: ACCENT,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                padding: 0,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {synopsisExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </section>
      )}

      {/* Curation & Thoughts */}
      {review && (
        <section id="curation" style={cardStyle}>
          <h2 style={sectionHeading}>Curation &amp; Thoughts</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20 }}>
            {typeof review.rating === 'number' && <Stars rating={review.rating} size={20} />}
            {review.created_at && (
              <span style={{ fontSize: 13, color: TEXT_SEC }}>
                {formatDate(review.created_at)}
              </span>
            )}
          </div>

          {review.favorite_quote && (
            <blockquote
              style={{
                margin: '20px 0 0',
                padding: '16px 20px',
                borderLeft: `3px solid ${ACCENT}`,
                borderRadius: '0 12px 12px 0',
                backgroundColor: GLASS,
                color: TEXT,
                fontSize: 15,
                lineHeight: 1.7,
                fontStyle: 'italic',
              }}
            >
              &ldquo;{review.favorite_quote}&rdquo;
            </blockquote>
          )}

          {review.review_text && (
            <p style={{ margin: '16px 0 0', color: TEXT_SEC, fontSize: 15, lineHeight: 1.7 }}>
              {review.review_text}
            </p>
          )}
        </section>
      )}

      {/* Reading History */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={sectionHeading}>Reading History</h2>
          <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT, cursor: 'pointer' }}>
            LOG SESSION
          </span>
        </div>

        {timedSessions.length > 0 ? (
          <div style={{ marginTop: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['Date', 'Pages', 'Time', 'Notes'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timedSessions.map((ts) => (
                  <tr key={ts.id}>
                    <td style={tdStyle}>{formatDate(ts.started_at)}</td>
                    <td style={tdStyle}>
                      {ts.start_page != null && ts.end_page != null
                        ? `${ts.start_page} \u2192 ${ts.end_page}`
                        : ts.pages_read != null
                          ? `${ts.pages_read} pages`
                          : '\u2014'}
                    </td>
                    <td style={tdStyle}>{formatDuration(ts.duration_ms) || '\u2014'}</td>
                    <td style={{ ...tdStyle, color: TEXT_SEC }}>{'\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : sessions.length > 0 ? (
          <div style={{ marginTop: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['Status', 'Started', 'Finished', 'Page'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td style={tdStyle}>
                      <span style={{ textTransform: 'capitalize' }}>
                        {formatBookStatus(s.status)}
                      </span>
                    </td>
                    <td style={tdStyle}>{formatDate(s.started_at) || '\u2014'}</td>
                    <td style={tdStyle}>{formatDate(s.finished_at) || '\u2014'}</td>
                    <td style={tdStyle}>{s.current_page ?? '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: '16px 0 0', color: TEXT_SEC, fontSize: 14 }}>
            No reading sessions recorded yet. Start a session to track your progress.
          </p>
        )}
      </section>
    </div>
  );
}

const cardStyle: CSSProperties = {
  padding: 24,
  borderRadius: 20,
  backgroundColor: SURFACE,
  border: `1px solid ${BORDER}`,
};

const sectionHeading: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: TEXT_SEC,
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: 12,
  fontWeight: 700,
  color: TEXT_SEC,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  borderBottom: `1px solid ${BORDER}`,
};

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  borderBottom: `1px solid ${BORDER}`,
  color: TEXT,
};
