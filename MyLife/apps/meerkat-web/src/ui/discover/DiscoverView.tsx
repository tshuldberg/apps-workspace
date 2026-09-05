// DiscoverView (Plan 19 P6, web): the public Discover/Browse pane. Mirrors the
// mobile Discover tab (apps/meerkat/app/(root)/(tabs)/discover.tsx) using the web
// kit + .mk-* classes. It runs the REAL directory probe (warm device-local cache
// first, then probePublicDirectory over @mylife/sync's open browse/search client,
// browser-native global WebSocket) and renders the verbatim section 7.1 copy
// across all 5 states. Honest metrics only: "{N} posts · served by {M} host{s} ·
// updated {when}" from signed + serving signals; never likes or views. Opening a
// result mounts the read-only Public Reader (verified snapshot, not live data).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicCategory } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  getDirectoryCacheEntries,
  probePublicDirectory,
  type ProbePublicDirectoryResult,
} from '../../lib/public-directory-client';
import {
  DISCOVER_COPY,
  PUBLIC_CATEGORIES,
  PUBLIC_CATEGORY_LABELS,
  formatPublicMetric,
  rankTrending,
  selectDiscoverState,
  stillVerifyingLabel,
  type VerifiedPublicEntry,
} from '../../lib/discover-core';
import { shortHex } from '../format';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { PublicReaderView } from './PublicReaderView';

export function DiscoverView(): React.ReactElement {
  const m = useMeerkat();
  const db = m.db;

  const [category, setCategory] = useState<PublicCategory | null>(null);
  const [searchText, setSearchText] = useState('');
  const [shownEntries, setShownEntries] = useState<VerifiedPublicEntry[]>([]);
  const [probe, setProbe] = useState<ProbePublicDirectoryResult | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const probeSeq = useRef(0);
  const searchRef = useRef(searchText);
  searchRef.current = searchText;

  const runProbe = useCallback(
    (opts: { category: PublicCategory | null; terms: string[] }) => {
      const seq = probeSeq.current + 1;
      probeSeq.current = seq;
      // Warm cache first so a refresh shows verified rows immediately (Partial),
      // then a real probe resolves the live state.
      const warm = getDirectoryCacheEntries(db, opts.category ?? undefined);
      setShownEntries(warm);
      setInFlight(true);
      void (async () => {
        const result = await probePublicDirectory(db, {
          category: opts.terms.length > 0 ? undefined : opts.category ?? undefined,
          searchTerms: opts.terms,
        });
        if (probeSeq.current !== seq) return; // a newer probe superseded this one
        setProbe(result);
        if (result.respondedAt !== null) setShownEntries(result.entries);
        setInFlight(false);
      })();
    },
    [db],
  );

  useEffect(() => {
    const terms = searchRef.current.trim().length > 0 ? searchRef.current.trim().split(/\s+/) : [];
    runProbe({ category, terms });
    // Re-probe when the pane mounts or the selected category changes; committed
    // search runs through onSubmitSearch directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, runProbe]);

  const onSelectCategory = useCallback((next: PublicCategory) => {
    setSearchText('');
    setCategory((current) => (current === next ? null : next));
  }, []);

  const onSubmitSearch = useCallback(() => {
    const terms = searchText.trim().length > 0 ? searchText.trim().split(/\s+/) : [];
    setCategory(null);
    runProbe({ category: null, terms });
  }, [runProbe, searchText]);

  const onRetry = useCallback(() => {
    const terms = searchText.trim().length > 0 ? searchText.trim().split(/\s+/) : [];
    runProbe({ category, terms });
  }, [runProbe, category, searchText]);

  const state = useMemo(
    () => selectDiscoverState({ inFlight, shownEntries, probe }),
    [inFlight, shownEntries, probe],
  );

  const trending = useMemo(() => {
    if (state.kind === 'success' || state.kind === 'partial') return rankTrending(state.entries);
    return [];
  }, [state]);

  if (selected) {
    return <PublicReaderView publicationId={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="mk-main-scroll mk-discover">
      <header className="mk-discover-head">
        <h1 className="mk-h1">{DISCOVER_COPY.headerTitle}</h1>
        <p className="mk-muted">{DISCOVER_COPY.headerSubtitle}</p>
      </header>

      <div className="mk-discover-search">
        <span aria-hidden>🔍</span>
        <input
          className="mk-input"
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmitSearch();
          }}
          placeholder={DISCOVER_COPY.searchPlaceholder}
          aria-label={DISCOVER_COPY.searchPlaceholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      <div className="mk-discover-chips" role="group" aria-label="Categories">
        {PUBLIC_CATEGORIES.map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              type="button"
              className={`mk-discover-chip ${active ? 'is-active' : ''}`}
              aria-pressed={active}
              aria-label={`Category ${PUBLIC_CATEGORY_LABELS[cat]}`}
              onClick={() => onSelectCategory(cat)}
            >
              {PUBLIC_CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      <section className="mk-discover-panel" aria-label={DISCOVER_COPY.trendingTitle}>
        <div className="mk-discover-section-head">
          <h2 className="mk-h2">{DISCOVER_COPY.trendingTitle}</h2>
          <p className="mk-muted">{DISCOVER_COPY.trendingHint}</p>
        </div>

        {state.kind === 'loading' ? (
          <div className="mk-discover-state">
            <p className="mk-discover-state-text">{DISCOVER_COPY.loading}</p>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : null}

        {state.kind === 'error' ? (
          <div className="mk-discover-state">
            <p className="mk-discover-state-title">{DISCOVER_COPY.errorTitle}</p>
            <p className="mk-discover-state-text">{DISCOVER_COPY.errorBody}</p>
            <Button onClick={onRetry}>{DISCOVER_COPY.errorRetry}</Button>
          </div>
        ) : null}

        {state.kind === 'empty' ? (
          <div className="mk-discover-state">
            <p className="mk-discover-state-title">{DISCOVER_COPY.emptyTitle}</p>
            <p className="mk-discover-state-text">{DISCOVER_COPY.emptyBody}</p>
          </div>
        ) : null}

        {state.kind === 'success' || state.kind === 'partial'
          ? trending.map((entry) => (
              <ResultCard
                key={entry.publication_id}
                entry={entry}
                onOpen={() => setSelected(entry.publication_id)}
              />
            ))
          : null}

        {state.kind === 'partial' ? (
          <p className="mk-discover-partial">{stillVerifyingLabel(state.verifying)}</p>
        ) : null}
      </section>

      <HonestNotice>{DISCOVER_COPY.honestNotice}</HonestNotice>
    </div>
  );
}

function ResultCard({
  entry,
  onOpen,
}: {
  entry: VerifiedPublicEntry;
  onOpen: () => void;
}): React.ReactElement {
  const categoryLabel = PUBLIC_CATEGORY_LABELS[entry.category as PublicCategory] ?? entry.category;
  return (
    <button
      type="button"
      className="mk-discover-card"
      aria-label={`Open public ${entry.kind}: ${entry.title}`}
      onClick={onOpen}
    >
      <span className="mk-discover-card-top">
        <span className="mk-discover-card-title">{entry.title}</span>
        <span className="mk-discover-card-cat">{categoryLabel}</span>
      </span>
      {entry.description ? <span className="mk-discover-card-desc">{entry.description}</span> : null}
      <span className="mk-discover-card-owner">by {shortHex(entry.owner_device_id)}</span>
      <span className="mk-discover-card-foot">
        <span className="mk-discover-card-metric">{formatPublicMetric(entry)}</span>
        <span aria-hidden>›</span>
      </span>
    </button>
  );
}

function SkeletonCard(): React.ReactElement {
  return (
    <div className="mk-discover-skeleton" aria-hidden>
      <div className="mk-discover-skel-line is-wide" />
      <div className="mk-discover-skel-line" />
      <div className="mk-discover-skel-line is-short" />
    </div>
  );
}
