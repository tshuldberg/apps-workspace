'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { searchMessagesAction } from '../actions';
import { formatTime, generateInitials, getAvatarColor, MAIL_COLORS as C } from '../ui';

const { accent: ACCENT, text: TEXT, textSec: TEXT_SEC, textTert: TEXT_TERT, surface: SURFACE, border: BORDER, glass: GLASS } = C;

interface Message {
  id: string; subject: string; from: string; body: string;
  folder: string; receivedAt: string; isRead: boolean; isStarred: boolean;
}

type QuickFilter = 'unread' | 'starred';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<QuickFilter>>(new Set());
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const doSearch = useCallback(async (term: string) => {
    if (!term.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setSearched(true);
      const msgs = await searchMessagesAction(term.trim());
      let filtered = msgs as Message[];
      if (activeFilters.has('unread')) filtered = filtered.filter((m) => !m.isRead);
      if (activeFilters.has('starred')) filtered = filtered.filter((m) => m.isStarred);
      setResults(filtered);
      setRecentSearches((prev) => {
        const next = [term.trim(), ...prev.filter((s) => s !== term.trim())];
        return next.slice(0, 8);
      });
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeFilters]);

  const toggleFilter = useCallback((filter: QuickFilter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }, []);

  useEffect(() => {
    if (searched && query.trim()) void doSearch(query);
  }, [activeFilters]); // intentionally omit query/doSearch to only re-search on filter change

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px 32px' }}>
      {/* Back link */}
      <Link href="/mail" style={{ color: ACCENT, fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 16 }}>
        Back to Inbox
      </Link>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void doSearch(query); }}
          placeholder="Search mail..."
          autoFocus
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8,
            backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
            color: TEXT, fontSize: 15, outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void doSearch(query)}
          style={{
            padding: '10px 20px', borderRadius: 8, backgroundColor: ACCENT,
            color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
          }}
        >
          Search
        </button>
      </div>

      {/* Quick filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['unread', 'starred'] as QuickFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => toggleFilter(f)}
            style={{
              padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${activeFilters.has(f) ? 'rgba(59,130,246,0.25)' : BORDER}`,
              backgroundColor: activeFilters.has(f) ? 'rgba(59,130,246,0.15)' : GLASS,
              color: activeFilters.has(f) ? ACCENT : TEXT_SEC,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 10, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
                <div style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: GLASS, opacity: 0.6 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ width: '40%', height: 14, borderRadius: 4, backgroundColor: GLASS, opacity: 0.6 }} />
                  <div style={{ width: '70%', height: 12, borderRadius: 4, backgroundColor: GLASS, opacity: 0.6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <p style={{ color: '#FF453A', fontSize: 14 }}>{error}</p>
            <button
              type="button"
              onClick={() => void doSearch(query)}
              style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, backgroundColor: ACCENT, color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        ) : searched && results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <p style={{ fontSize: 16, color: TEXT_SEC }}>No messages match &apos;{query}&apos;</p>
            <p style={{ fontSize: 13, color: TEXT_TERT, marginTop: 4 }}>Try searching for sender name, subject, or message content</p>
          </div>
        ) : searched ? (
          <>
            <p style={{ fontSize: 12, color: TEXT_TERT, marginBottom: 12 }}>{results.length} result{results.length !== 1 ? 's' : ''}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.map((msg) => (
                <Link
                  key={msg.id}
                  href={`/mail/message/${msg.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                    borderRadius: 10, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
                    textDecoration: 'none', color: TEXT,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 999, backgroundColor: getAvatarColor(msg.from),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                    {generateInitials(msg.from.split('@')[0])}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {msg.from.split('@')[0]}
                    </div>
                    <div style={{ fontSize: 13, color: TEXT_SEC, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {msg.subject || '(no subject)'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: TEXT_TERT }}>{formatTime(msg.receivedAt)}</div>
                    <span style={{
                      display: 'inline-block', marginTop: 2, padding: '1px 6px', borderRadius: 4,
                      backgroundColor: GLASS, border: `1px solid ${BORDER}`, fontSize: 10, color: TEXT_TERT,
                    }}>
                      {msg.folder}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : recentSearches.length > 0 ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_TERT }}>Recent Searches</span>
              <button type="button" onClick={() => setRecentSearches([])} style={{ background: 'none', border: 'none', color: TEXT_TERT, fontSize: 12, cursor: 'pointer' }}>
                Clear
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => { setQuery(term); void doSearch(term); }}
                  style={{
                    padding: '6px 12px', borderRadius: 999, backgroundColor: GLASS,
                    border: `1px solid ${BORDER}`, color: TEXT_SEC, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 32, color: TEXT_TERT }}>
            <p style={{ fontSize: 15 }}>Search your mail</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Find messages by sender, subject, or content</p>
          </div>
        )}
      </div>
    </div>
  );
}
