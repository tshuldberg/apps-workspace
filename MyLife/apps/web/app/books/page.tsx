'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchBooks,
  fetchShelves,
  fetchCurrentlyReading,
  fetchBookCount,
  fetchGoalProgress,
  fetchBookStatusCounts,
} from './actions';
import { parseStoredList } from './ui';

interface Shelf {
  id: string;
  slug: string;
}

interface BookSummary {
  id: string;
  title: string;
  authors: string | null;
  cover_url?: string | null;
  rating?: number | null;
  subjects?: string | null;
  page_count?: number | null;
}

interface ReadingSession {
  book_id: string;
  current_page: number;
}

interface CurrentlyReadingItem {
  id: string;
  title: string;
  authors: string | null;
  cover_url?: string | null;
  page_count?: number | null;
  current_page: number;
}

type FilterKey = 'all' | 'want' | 'reading' | 'finished' | 'dnf';

const ACCENT = '#C9894D';
const ACCENT_DIM = 'rgba(201,137,77,0.12)';
const ACCENT_BORDER = 'rgba(201,137,77,0.25)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const SURFACE = 'var(--surface-elevated, #2A292F)';

const FILTERS: { key: FilterKey; label: string; shelfSlug?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'want', label: 'Want', shelfSlug: 'want-to-read' },
  { key: 'reading', label: 'Reading', shelfSlug: 'reading' },
  { key: 'finished', label: 'Finished', shelfSlug: 'finished' },
  { key: 'dnf', label: 'DNF', shelfSlug: 'dnf' },
];

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.25;
  return (
    <span style={{ color: ACCENT, fontSize: 13, letterSpacing: 1 }}>
      {'★'.repeat(full)}
      {half ? '½' : ''}
      {'☆'.repeat(5 - full - (half ? 1 : 0))}
    </span>
  );
}

function GradientButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 24px',
        borderRadius: 14,
        background: `linear-gradient(135deg, ${ACCENT} 0%, #E8A96A 100%)`,
        color: '#0E0E13',
        fontWeight: 700,
        fontSize: 15,
        textDecoration: 'none',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {children}
    </Link>
  );
}

export default function BooksLibraryPage() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [currentlyReading, setCurrentlyReading] = useState<CurrentlyReadingItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [totalCount, setTotalCount] = useState(0);
  const [goalProgress, setGoalProgress] = useState<{ read: number; goal: number } | null>(null);
  const [statusCounts, setStatusCounts] = useState({ reading: 0, wantToRead: 0, finished: 0, dnf: 0 });

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchShelves(),
      fetchBooks(),
      fetchCurrentlyReading(),
      fetchBookCount(),
      fetchGoalProgress(new Date().getFullYear()),
      fetchBookStatusCounts(),
    ]).then(([s, b, cr, count, goal, counts]) => {
      if (cancelled) return;
      setShelves(s as Shelf[]);
      const allBooks = b as BookSummary[];
      setBooks(allBooks);
      // Join reading sessions with book metadata
      const sessions = cr as ReadingSession[];
      const bookMap = new Map(allBooks.map((bk) => [bk.id, bk]));
      const reading: CurrentlyReadingItem[] = [];
      for (const session of sessions) {
        const bk = bookMap.get(session.book_id);
        if (bk) {
          reading.push({
            id: bk.id,
            title: bk.title,
            authors: bk.authors,
            cover_url: bk.cover_url,
            page_count: bk.page_count,
            current_page: session.current_page,
          });
        }
      }
      setCurrentlyReading(reading.slice(0, 4));
      setTotalCount(count as number);
      setGoalProgress(goal as { read: number; goal: number } | null);
      setStatusCounts(counts as typeof statusCounts);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (activeFilter === 'all') {
      void fetchBooks().then((b) => { if (!cancelled) setBooks(b as BookSummary[]); });
    } else {
      const filterDef = FILTERS.find((f) => f.key === activeFilter);
      const shelf = shelves.find((s) => s.slug === filterDef?.shelfSlug);
      if (shelf) {
        void fetchBooks({ shelf_id: shelf.id }).then((b) => { if (!cancelled) setBooks(b as BookSummary[]); });
      }
    }
    return () => { cancelled = true; };
  }, [activeFilter, shelves]);

  const recentBooks = [...books].slice(0, 6);
  const goalRead = goalProgress?.read ?? statusCounts.finished;
  const goalTarget = goalProgress?.goal ?? 15;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 32, alignItems: 'start' }}>
      {/* Main content */}
      <div style={{ display: 'grid', gap: 28 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: TEXT_SEC,
            }}>
              Collections
            </p>
            <h1 style={{ margin: '6px 0 0', fontSize: 38, fontWeight: 800, color: TEXT }}>
              MyBooks
            </h1>
          </div>
          <GradientButton href="/books/search">+ Add Book</GradientButton>
        </div>

        {/* Currently Reading */}
        {currentlyReading.length > 0 && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT }}>Currently Reading</h2>
              <Link href="/books" style={{ color: ACCENT, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                View all archive
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {currentlyReading.slice(0, 2).map((item) => {
                const authors = parseStoredList(item.authors).join(', ') || 'Unknown';
                const progress = item.current_page && item.page_count
                  ? Math.round((item.current_page / item.page_count) * 100)
                  : null;
                return (
                  <Link
                    key={item.id}
                    href={`/books/${item.id}`}
                    style={{
                      display: 'flex',
                      gap: 16,
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: SURFACE,
                      border: `1px solid ${BORDER}`,
                      textDecoration: 'none',
                      color: TEXT,
                    }}
                  >
                    <div style={{
                      width: 80,
                      minWidth: 80,
                      aspectRatio: '2/3',
                      borderRadius: 10,
                      background: item.cover_url
                        ? `center/cover no-repeat url(${item.cover_url})`
                        : `linear-gradient(135deg, ${ACCENT_DIM} 0%, ${ACCENT} 100%)`,
                    }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h3>
                      <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>{authors}</p>
                      {progress !== null && (
                        <div style={{ marginTop: 'auto' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TEXT_SEC, marginBottom: 4 }}>
                            <span>{progress}%</span>
                            <span>p.{item.current_page}</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                            <div style={{ height: '100%', borderRadius: 2, width: `${progress}%`, background: `linear-gradient(90deg, ${ACCENT}, #E8A96A)` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Filter chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setActiveFilter(f.key)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 999,
                  border: isActive ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                  backgroundColor: isActive ? ACCENT : 'transparent',
                  color: isActive ? '#0E0E13' : TEXT_SEC,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            );
          })}
          <div style={{ marginLeft: 'auto' }}>
            <span style={{
              padding: '8px 16px',
              borderRadius: 999,
              border: `1px solid ${BORDER}`,
              backgroundColor: GLASS,
              color: TEXT_SEC,
              fontWeight: 600,
              fontSize: 13,
            }}>
              Sort: Recent
            </span>
          </div>
        </div>

        {/* Book grid */}
        {books.length === 0 ? (
          <section style={{
            padding: 40,
            borderRadius: 20,
            border: `1px dashed ${ACCENT_BORDER}`,
            backgroundColor: GLASS,
            textAlign: 'center',
          }}>
            <h2 style={{ margin: 0, fontSize: 22, color: TEXT }}>Your library is waiting</h2>
            <p style={{ margin: '12px 0 0', color: TEXT_SEC }}>
              Search Open Library or import from Goodreads to get started.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 20 }}>
              <Link href="/books/search" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Search Books</Link>
              <Link href="/books/import" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Import Library</Link>
            </div>
          </section>
        ) : (
          <section style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 20,
          }}>
            {books.map((book) => {
              const authors = parseStoredList(book.authors).join(', ') || 'Unknown';
              return (
                <Link
                  key={book.id}
                  href={`/books/${book.id}`}
                  style={{ textDecoration: 'none', color: TEXT }}
                >
                  <div style={{
                    width: '100%',
                    aspectRatio: '2/3',
                    borderRadius: 14,
                    overflow: 'hidden',
                    background: book.cover_url
                      ? `center/cover no-repeat url(${book.cover_url})`
                      : `linear-gradient(135deg, #1B1B20 0%, ${ACCENT} 100%)`,
                    border: `1px solid ${BORDER}`,
                    marginBottom: 10,
                  }} />
                  <h3 style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {book.title}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_SEC, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {authors}
                  </p>
                  {typeof book.rating === 'number' && (
                    <div style={{ marginTop: 6 }}>
                      <Stars rating={book.rating} />
                    </div>
                  )}
                </Link>
              );
            })}
            {/* Missing something card */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              aspectRatio: '2/3',
              borderRadius: 14,
              border: `2px dashed rgba(255,255,255,0.08)`,
              backgroundColor: GLASS,
              textAlign: 'center',
              padding: 20,
            }}>
              <span style={{ fontSize: 28, opacity: 0.4 }}>?</span>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, lineHeight: 1.5 }}>
                Missing something?
              </p>
              <Link href="/books/import" style={{ fontSize: 12, color: ACCENT, fontWeight: 600, textDecoration: 'none' }}>
                Check your import settings
              </Link>
            </div>
          </section>
        )}

        {/* Recently Added */}
        {recentBooks.length > 0 && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT }}>Recently Added</h2>
              <span style={{ color: TEXT_SEC, fontSize: 13, cursor: 'pointer' }}>&rarr;</span>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {recentBooks.slice(0, 3).map((book) => {
                const authors = parseStoredList(book.authors).join(', ') || 'Unknown';
                return (
                  <Link
                    key={`recent-${book.id}`}
                    href={`/books/${book.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '12px 16px',
                      borderRadius: 14,
                      backgroundColor: SURFACE,
                      border: `1px solid ${BORDER}`,
                      textDecoration: 'none',
                      color: TEXT,
                    }}
                  >
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      flexShrink: 0,
                      background: book.cover_url
                        ? `center/cover no-repeat url(${book.cover_url})`
                        : `linear-gradient(135deg, ${ACCENT_DIM}, ${ACCENT})`,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_SEC }}>{authors}</p>
                    </div>
                    <span style={{ color: TEXT_SEC, fontSize: 12, flexShrink: 0 }}>Last week</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Sidebar: Reading Rhythm */}
      <aside style={{ position: 'sticky', top: 24 }}>
        <div style={{
          borderRadius: 20,
          padding: 28,
          background: 'linear-gradient(145deg, #2A2218 0%, #1F1A14 50%, #0E0E13 100%)',
          border: `1px solid ${ACCENT_BORDER}`,
        }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#E8CBA8' }}>Your Reading Rhythm</h3>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(228,225,233,0.6)', lineHeight: 1.5 }}>
            You&apos;ve read {goalRead} of {goalTarget} of your annual goal.
            {goalRead > 0 ? ' Keep the momentum.' : ' Start your first book.'}
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginTop: 24,
          }}>
            <span style={{ fontSize: 48, fontWeight: 800, color: ACCENT }}>{goalRead}</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(228,225,233,0.5)' }}>/{goalTarget}</span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(228,225,233,0.4)' }}>
            Books completed
          </p>
          {/* Progress bar */}
          <div style={{ marginTop: 20, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <div style={{
              height: '100%',
              borderRadius: 3,
              width: `${Math.min(100, goalTarget > 0 ? (goalRead / goalTarget) * 100 : 0)}%`,
              background: `linear-gradient(90deg, ${ACCENT}, #E8A96A)`,
            }} />
          </div>
          {/* Quick stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginTop: 24,
            paddingTop: 20,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT }}>{statusCounts.reading}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reading</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT }}>{statusCounts.wantToRead}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.5 }}>Want to Read</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT }}>{totalCount}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT }}>{statusCounts.dnf}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.5 }}>DNF</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
