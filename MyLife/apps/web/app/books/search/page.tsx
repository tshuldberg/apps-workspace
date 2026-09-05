'use client';

import { useState, useCallback, useRef } from 'react';
import { addBookToLibrary } from '../actions';

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  cover_edition_key?: string;
  first_publish_year?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  subject?: string[];
}

type SortOption = 'relevance' | 'year' | 'title';

const ACCENT = 'var(--accent-books)';
const ACCENT_DIM = 'rgba(201,137,77,0.15)';
const ACCENT_BORDER = 'rgba(201,137,77,0.25)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const TEXT_TER = 'var(--text-tertiary)';
const SURFACE = 'var(--surface)';
const SURFACE_EL = 'var(--surface-elevated)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const DANGER = 'var(--danger)';

const GENRE_OPTIONS = ['Philosophy', 'Fiction', 'History', 'Science', 'Art', 'Biography', 'Psychology', 'Poetry'];

function SkeletonCard() {
  return (
    <div
      style={{
        borderRadius: 16,
        backgroundColor: SURFACE,
        border: `1px solid ${BORDER}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '3/4',
          background: `linear-gradient(110deg, ${SURFACE} 30%, ${SURFACE_EL} 50%, ${SURFACE} 70%)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        }}
      />
      <div style={{ padding: 14, display: 'grid', gap: 8 }}>
        <div style={{ height: 14, width: '80%', borderRadius: 4, backgroundColor: SURFACE_EL }} />
        <div style={{ height: 10, width: '60%', borderRadius: 4, backgroundColor: SURFACE_EL }} />
        <div style={{ height: 10, width: '50%', borderRadius: 4, backgroundColor: SURFACE_EL }} />
      </div>
    </div>
  );
}

export default function BooksSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OpenLibraryDoc[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(['Existentialism', 'The Great Gatsby', 'Data Science 2024']);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [pubYearFrom, setPubYearFrom] = useState('');
  const [pubYearTo, setPubYearTo] = useState('');
  const [format, setFormat] = useState<'all' | 'physical' | 'paperback' | 'ebook' | 'audiobook'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async (searchQuery?: string, pageNum = 1) => {
    const trimmed = (searchQuery ?? query).trim();
    if (!trimmed) return;

    setIsLoading(true);
    setSearchError(null);
    setHasSearched(true);

    if (pageNum === 1) {
      setResults([]);
      setRecentSearches((prev) => {
        const next = [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())];
        return next.slice(0, 5);
      });
    }

    const subjectFilter = selectedGenres.length > 0 ? `+subject:${selectedGenres[0].toLowerCase()}` : '';

    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(trimmed)}${subjectFilter}&limit=12&offset=${(pageNum - 1) * 12}&fields=key,title,author_name,cover_edition_key,first_publish_year,isbn,number_of_pages_median,subject`,
      );
      if (!response.ok) throw new Error(`Search failed (${response.status})`);
      const body = await response.json() as { docs?: OpenLibraryDoc[]; numFound?: number };
      const docs = body.docs ?? [];
      setTotalResults(body.numFound ?? 0);
      setPage(pageNum);

      if (pageNum === 1) {
        setResults(docs);
      } else {
        setResults((prev) => [...prev, ...docs]);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [query, selectedGenres]);

  async function handleAdd(result: OpenLibraryDoc) {
    const isbn13 = result.isbn?.find((item) => item.length === 13);
    const isbn10 = result.isbn?.find((item) => item.length === 10);

    await addBookToLibrary({
      title: result.title,
      authors: JSON.stringify(result.author_name ?? []),
      cover_url: result.cover_edition_key
        ? `https://covers.openlibrary.org/b/olid/${result.cover_edition_key}-L.jpg`
        : null,
      isbn_13: isbn13,
      isbn_10: isbn10,
      publish_year: result.first_publish_year,
      page_count: result.number_of_pages_median,
      open_library_id: result.key,
      format: format === 'ebook' || format === 'audiobook' ? format : 'physical',
      language: 'en',
      added_source: 'search',
    });

    setAddedIds((current) => [...new Set([...current, result.key])]);
  }

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }

  const displayResults = results.filter((r) => {
    if (pubYearFrom && r.first_publish_year && r.first_publish_year < parseInt(pubYearFrom)) return false;
    if (pubYearTo && r.first_publish_year && r.first_publish_year > parseInt(pubYearTo)) return false;
    return true;
  });

  const sortedResults = [...displayResults].sort((a, b) => {
    if (sortBy === 'year') return (b.first_publish_year ?? 0) - (a.first_publish_year ?? 0);
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    return 0;
  });

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Search Bar */}
      <div
        style={{
          position: 'relative',
          width: '100%',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            color: TEXT_TER,
            fontSize: 18,
            pointerEvents: 'none',
          }}
        >
          &#x1F50D;
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleSearch();
            }
          }}
          placeholder="Search your digital sanctuary..."
          style={{
            width: '100%',
            padding: '16px 16px 16px 48px',
            borderRadius: 14,
            border: `1px solid ${BORDER}`,
            backgroundColor: SURFACE,
            color: TEXT,
            fontSize: 16,
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Recent Searches */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: TEXT_TER, textTransform: 'uppercase' }}>
          Recent Searches
        </span>
        {recentSearches.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => {
              setQuery(term);
              void handleSearch(term);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: `1px solid ${ACCENT_BORDER}`,
              backgroundColor: ACCENT_DIM,
              color: ACCENT,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {term}
          </button>
        ))}
      </div>

      {/* Main Content: Sidebar + Results */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: hasSearched ? '220px 1fr' : '1fr',
          gap: 32,
          alignItems: 'start',
        }}
      >
        {/* Filter Sidebar */}
        {hasSearched && (
          <aside style={{ display: 'grid', gap: 24, position: 'sticky', top: 24 }}>
            <div>
              <h3
                style={{
                  margin: '0 0 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  color: TEXT_TER,
                  textTransform: 'uppercase',
                }}
              >
                Refine Search
              </h3>

              {/* Genre */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: TEXT_SEC, display: 'block', marginBottom: 8 }}>
                  Genre
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {GENRE_OPTIONS.map((genre) => {
                    const active = selectedGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => toggleGenre(genre)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 999,
                          border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                          backgroundColor: active ? ACCENT : 'transparent',
                          color: active ? '#131318' : TEXT_SEC,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minimum Rating */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: TEXT_SEC, display: 'block', marginBottom: 8 }}>
                  Minimum Rating
                </label>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setMinRating(minRating === star ? 0 : star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 20,
                        color: star <= minRating ? ACCENT : TEXT_TER,
                        padding: 2,
                      }}
                    >
                      &#9733;
                    </button>
                  ))}
                </div>
              </div>

              {/* Publication Year */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: TEXT_SEC, display: 'block', marginBottom: 8 }}>
                  Publication Year
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="From"
                    value={pubYearFrom}
                    onChange={(e) => setPubYearFrom(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: `1px solid ${BORDER}`,
                      backgroundColor: SURFACE,
                      color: TEXT,
                      fontSize: 13,
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="To"
                    value={pubYearTo}
                    onChange={(e) => setPubYearTo(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: `1px solid ${BORDER}`,
                      backgroundColor: SURFACE,
                      color: TEXT,
                      fontSize: 13,
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Format */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: TEXT_SEC, display: 'block', marginBottom: 8 }}>
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as 'all' | 'physical' | 'paperback' | 'ebook' | 'audiobook')}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: `1px solid ${BORDER}`,
                    backgroundColor: SURFACE,
                    color: TEXT,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">All Formats</option>
                  <option value="physical">Hardcover</option>
                  <option value="paperback">Paperback</option>
                  <option value="ebook">eBook</option>
                  <option value="audiobook">Audiobook</option>
                </select>
              </div>
            </div>
          </aside>
        )}

        {/* Results Area */}
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Results Header */}
          {hasSearched && !isLoading && sortedResults.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 24, color: TEXT }}>
                {totalResults.toLocaleString()} Results for{' '}
                <em style={{ color: ACCENT, fontStyle: 'italic' }}>
                  &ldquo;{recentSearches[0]}&rdquo;
                </em>
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: TEXT_TER, textTransform: 'uppercase' }}>
                  Sorted by
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    backgroundColor: SURFACE,
                    color: TEXT_SEC,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    outline: 'none',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  <option value="relevance">Relevance</option>
                  <option value="year">Year</option>
                  <option value="title">Title</option>
                </select>
              </div>
            </div>
          )}

          {/* Error State */}
          {searchError && (
            <section
              style={{
                padding: 32,
                borderRadius: 20,
                border: `1px dashed ${DANGER}`,
                backgroundColor: GLASS,
                textAlign: 'center',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 24, color: DANGER }}>Search failed</h2>
              <p style={{ margin: '12px auto 0', maxWidth: 480, color: TEXT_SEC }}>{searchError}</p>
            </section>
          )}

          {/* Empty State */}
          {sortedResults.length === 0 && !isLoading && !searchError && hasSearched && (
            <section
              style={{
                padding: 48,
                borderRadius: 20,
                border: `1px dashed ${ACCENT_BORDER}`,
                backgroundColor: GLASS,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>&#128214;</div>
              <h2 style={{ margin: 0, fontSize: 24, color: TEXT }}>No matches found</h2>
              <p style={{ margin: '12px auto 0', maxWidth: 480, color: TEXT_SEC }}>
                Try a different title, author, or ISBN.
              </p>
            </section>
          )}

          {/* Loading Skeletons */}
          {isLoading && results.length === 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 20,
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {/* Results Grid */}
          {sortedResults.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 20,
              }}
            >
              {sortedResults.map((result) => {
                const alreadyAdded = addedIds.includes(result.key);
                const coverUrl = result.cover_edition_key
                  ? `https://covers.openlibrary.org/b/olid/${result.cover_edition_key}-L.jpg`
                  : null;
                const isbn = result.isbn?.find((i) => i.length === 13) ?? result.isbn?.[0];

                return (
                  <div
                    key={result.key}
                    style={{
                      borderRadius: 16,
                      backgroundColor: SURFACE,
                      border: `1px solid ${BORDER}`,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(201,137,77,0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '';
                    }}
                  >
                    {/* Cover */}
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '3/4',
                        backgroundColor: '#1B1B20',
                        backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {!coverUrl && (
                        <div style={{ fontSize: 48, opacity: 0.2 }}>&#128214;</div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 15,
                          fontWeight: 700,
                          color: TEXT,
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {result.title}
                      </h3>
                      <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, lineHeight: 1.3 }}>
                        {(result.author_name ?? []).slice(0, 2).join(', ') || 'Unknown author'}
                      </p>

                      <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div style={{ display: 'grid', gap: 2 }}>
                          {isbn && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: TEXT_TER, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                              ISBN: {isbn}
                            </span>
                          )}
                          {result.first_publish_year && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: TEXT_TER, textTransform: 'uppercase' }}>
                              PUB: {result.first_publish_year}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleAdd(result)}
                          disabled={alreadyAdded}
                          aria-label={alreadyAdded ? 'Added to library' : 'Add to library'}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 999,
                            border: alreadyAdded ? `1px solid ${ACCENT_BORDER}` : 'none',
                            backgroundColor: alreadyAdded ? 'transparent' : ACCENT,
                            color: alreadyAdded ? ACCENT : '#131318',
                            fontSize: 18,
                            fontWeight: 700,
                            cursor: alreadyAdded ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            padding: 0,
                            lineHeight: 1,
                          }}
                        >
                          {alreadyAdded ? '✓' : '+'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More */}
          {sortedResults.length > 0 && sortedResults.length < totalResults && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
              <button
                type="button"
                onClick={() => void handleSearch(undefined, page + 1)}
                disabled={isLoading}
                style={{
                  padding: '14px 32px',
                  borderRadius: 14,
                  border: `1px solid ${ACCENT_BORDER}`,
                  backgroundColor: ACCENT_DIM,
                  color: ACCENT,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  cursor: isLoading ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {isLoading ? 'Loading...' : 'Load More Curated Works'}{' '}
                {!isLoading && <span style={{ fontSize: 10 }}>&#9660;</span>}
              </button>
            </div>
          )}

          {/* Loading indicator for load more */}
          {isLoading && results.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div style={{ color: TEXT_TER, fontSize: 14, fontWeight: 600 }}>Loading more results...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
