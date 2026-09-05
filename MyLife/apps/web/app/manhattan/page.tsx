'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addManualEventAction,
  fetchDiscoveryFeed,
  getSourceInfo,
  saveFeedEventAction,
  unsaveEventAction,
  type DiscoveryEvent,
  type DiscoveryFeed,
} from './actions';

/* ── tokens ─────────────────────────────────────────── */

const ACCENT = 'var(--accent-manhattan)';
const ACCENT_DIM = 'color-mix(in srgb, var(--accent-manhattan) 15%, transparent)';
const SURFACE = 'var(--surface)';
const SURFACE_EL = 'var(--surface-elevated)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const GLASS_BORDER = 'var(--glass-border)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const TEXT_TER = 'var(--text-tertiary)';

/* ── helpers ────────────────────────────────────────── */

function stripHtml(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDate(startAt: string | undefined): string {
  if (!startAt) return 'Date to be announced';
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return startAt.slice(0, 10);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(startAt: string | undefined, endAt: string | undefined): string | null {
  if (!startAt) return null;
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return null;
  // Midnight is the source's "no specific time" sentinel; skip it.
  if (start.getHours() === 0 && start.getMinutes() === 0) return null;
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const startStr = fmt(start);
  if (endAt) {
    const end = new Date(endAt);
    if (!Number.isNaN(end.getTime()) && !(end.getHours() === 0 && end.getMinutes() === 0)) {
      return `${startStr} – ${fmt(end)}`;
    }
  }
  return startStr;
}

function mapsUrl(event: DiscoveryEvent): string | null {
  const place = event.venueName ?? event.address;
  if (!place) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place} New York NY`)}`;
}

/* ── page ───────────────────────────────────────────── */

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export default function ManhattanDiscoverPage() {
  const [feed, setFeed] = useState<DiscoveryFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  // Three filter axes, mobile-parity semantics: OR within an axis, AND
  // across axes; an empty axis selection means "everything".
  const [selCategories, setSelCategories] = useState<Set<string>>(new Set());
  const [selTimes, setSelTimes] = useState<Set<string>>(new Set());
  const [selPrices, setSelPrices] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualStartAt, setManualStartAt] = useState('');
  const [manualVenue, setManualVenue] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualFree, setManualFree] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, source] = await Promise.all([fetchDiscoveryFeed(), getSourceInfo()]);
      setFeed(result);
      setPortalUrl(source.portal);
    } catch {
      setError('Could not reach NYC Open Data. Check your connection and try again.');
      setFeed(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => feed?.categories ?? [], [feed]);
  const timeOptions = useMemo(
    () => Array.from(new Set((feed?.events ?? []).map((e) => e.timeBucket))).sort(),
    [feed],
  );
  const priceOptions = useMemo(
    () =>
      Array.from(new Set((feed?.events ?? []).map((e) => e.priceBucket))).sort(
        (a, b) => {
          const order = ['Free', 'Under $20', '$20-50', '$50-100', '$100+', 'Unknown'];
          return order.indexOf(a) - order.indexOf(b);
        },
      ),
    [feed],
  );

  const visibleEvents = useMemo(() => {
    if (!feed) return [];
    const q = search.trim().toLowerCase();
    return feed.events.filter((e) => {
      if (selCategories.size > 0 && (!e.category || !selCategories.has(e.category))) {
        return false;
      }
      if (selTimes.size > 0 && !selTimes.has(e.timeBucket)) return false;
      if (selPrices.size > 0 && !selPrices.has(e.priceBucket)) return false;
      if (q.length > 0) {
        const haystack = [e.title, e.venueName, e.neighborhood, e.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [feed, selCategories, selTimes, selPrices, search]);

  const handleSave = useCallback(
    async (event: DiscoveryEvent) => {
      setSavingId(event.feedId);
      setSaveError(null);
      try {
        if (event.isLocal && event.localId && event.saved) {
          await unsaveEventAction(event.localId);
        } else {
          const result = await saveFeedEventAction({
            sourceId: event.sourceId,
            externalId: event.externalId,
            title: event.title,
            description: event.description,
            venueName: event.venueName,
            address: event.address,
            neighborhood: event.neighborhood,
            startAt: event.startAt,
            endAt: event.endAt,
            category: event.category,
            purchaseUrl: event.purchaseUrl,
            priceMin: event.priceMin,
            priceMax: event.priceMax,
            isFree: event.isFree,
          });
          if (!result.ok) {
            setSaveError(result.error ?? 'Could not save the event.');
            return;
          }
        }
        await load();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Could not save the event.');
      } finally {
        setSavingId(null);
      }
    },
    [load],
  );

  const handleManualAdd = useCallback(async () => {
    setAddBusy(true);
    setAddError(null);
    try {
      const result = await addManualEventAction({
        title: manualTitle,
        startAt: manualStartAt ? new Date(manualStartAt).toISOString() : undefined,
        venueName: manualVenue,
        category: manualCategory,
        isFree: manualFree,
      });
      if (!result.ok) {
        setAddError(result.error ?? 'Could not add the event.');
        return;
      }
      setManualTitle('');
      setManualStartAt('');
      setManualVenue('');
      setManualCategory('');
      setAddOpen(false);
      await load();
    } finally {
      setAddBusy(false);
    }
  }, [load, manualTitle, manualStartAt, manualVenue, manualCategory, manualFree]);

  const tonight = useMemo(
    () => visibleEvents.filter((e) => e.timeBucket === 'Tonight'),
    [visibleEvents],
  );
  const upcoming = useMemo(
    () => visibleEvents.filter((e) => e.timeBucket !== 'Tonight'),
    [visibleEvents],
  );

  /* ── loading ─────────────────────────────────────── */
  if (loading) {
    return (
      <div style={s.page}>
        <div style={{ ...s.skeleton, height: 64 }} />
        <div style={s.chipRow}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ ...s.skeleton, width: 88, height: 32, borderRadius: 999 }} />
          ))}
        </div>
        <div style={s.grid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ ...s.skeleton, height: 150 }} />
          ))}
        </div>
      </div>
    );
  }

  /* ── error ───────────────────────────────────────── */
  if (error) {
    return (
      <div style={s.centerCard}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📡</div>
        <h2 style={{ margin: 0, color: TEXT }}>Could not load events</h2>
        <p style={{ color: TEXT_SEC, margin: '8px 0 16px', maxWidth: 420, textAlign: 'center' }}>
          {error}
        </p>
        <button style={s.btnPrimary} onClick={() => void load()}>
          Try Again
        </button>
      </div>
    );
  }

  const isEmptyFeed = !feed || feed.events.length === 0;

  return (
    <div style={s.page}>
      {/* ── honest provenance banner ────────────────── */}
      <div style={s.banner}>
        <div style={{ fontWeight: 700, color: TEXT, fontSize: 14 }}>
          Live from NYC Open Data
        </div>
        <p style={{ margin: '4px 0 0', color: TEXT_SEC, fontSize: 13, lineHeight: 1.5 }}>
          These events come straight from the City of New York&apos;s public NYC Parks Events
          dataset, with no API key. It is a city archive, so listings can be historical rather
          than this week. Live ticketed concerts (SeatGeek) are a separate, key-gated source that
          is not connected yet.
          {portalUrl && (
            <>
              {' '}
              <a href={portalUrl} target="_blank" rel="noopener noreferrer" style={s.bannerLink}>
                View the dataset
              </a>
              .
            </>
          )}
        </p>
      </div>

      {/* ── search + add ────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title, venue, neighborhood..."
          style={s.searchInput}
        />
        <button style={s.btnGhostInline} onClick={() => setAddOpen((v) => !v)}>
          {addOpen ? 'Close' : '+ Add event'}
        </button>
        <button style={s.btnGhostInline} onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {/* ── manual add ──────────────────────────────── */}
      {addOpen && (
        <div style={s.addCard}>
          <div style={{ fontWeight: 700, color: TEXT, fontSize: 14 }}>Add an event manually</div>
          <p style={{ margin: '2px 0 6px', color: TEXT_TER, fontSize: 12 }}>
            For things you heard about outside any feed. Saved on this device, shown in the
            feed and on your Today dashboard.
          </p>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Title (required)" style={s.searchInput} />
            <input type="datetime-local" value={manualStartAt} onChange={(e) => setManualStartAt(e.target.value)} style={s.searchInput} />
            <input value={manualVenue} onChange={(e) => setManualVenue(e.target.value)} placeholder="Venue" style={s.searchInput} />
            <input value={manualCategory} onChange={(e) => setManualCategory(e.target.value)} placeholder="Category (e.g. Music)" style={s.searchInput} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: TEXT_SEC, fontSize: 13 }}>
            <input type="checkbox" checked={manualFree} onChange={(e) => setManualFree(e.target.checked)} />
            Free event
          </label>
          {addError && <div style={{ color: 'var(--danger, #FFB4AB)', fontSize: 13 }}>{addError}</div>}
          <div>
            <button style={s.btnPrimary} onClick={() => void handleManualAdd()} disabled={addBusy}>
              {addBusy ? 'Adding...' : 'Add event'}
            </button>
          </div>
        </div>
      )}

      {saveError && (
        <div style={{ color: 'var(--danger, #FFB4AB)', fontSize: 13 }}>
          Save failed: {saveError}
        </div>
      )}

      {/* ── three filter axes: category, time, price ── */}
      {!isEmptyFeed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <FilterAxis
            label="Category"
            options={categories}
            selected={selCategories}
            onToggle={(v) => setSelCategories((prev) => toggleInSet(prev, v))}
          />
          <FilterAxis
            label="When"
            options={timeOptions}
            selected={selTimes}
            onToggle={(v) => setSelTimes((prev) => toggleInSet(prev, v))}
          />
          <FilterAxis
            label="Price"
            options={priceOptions}
            selected={selPrices}
            onToggle={(v) => setSelPrices((prev) => toggleInSet(prev, v))}
          />
        </div>
      )}

      {/* ── empty feed ──────────────────────────────── */}
      {isEmptyFeed ? (
        <div style={s.centerCard}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🗽</div>
          <h2 style={{ margin: 0, fontSize: 22, color: TEXT }}>No events came back</h2>
          <p style={{ color: TEXT_SEC, margin: '8px 0 20px', maxWidth: 420, textAlign: 'center' }}>
            NYC Open Data did not return any events right now. This usually clears up on a retry.
          </p>
          <button style={s.btnPrimary} onClick={() => void load()}>
            Refresh
          </button>
        </div>
      ) : visibleEvents.length === 0 ? (
        <div style={s.centerCard}>
          <p style={{ color: TEXT_SEC }}>Nothing matches the current filters and search.</p>
          <button
            style={s.btnGhost}
            onClick={() => {
              setSelCategories(new Set());
              setSelTimes(new Set());
              setSelPrices(new Set());
              setSearch('');
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <Section
            title="Tonight"
            subtitle="Happening today in the city"
            events={tonight}
            emptyHint="Nothing in this batch lands on today's date. Most of the archive sits under Upcoming."
            savingId={savingId}
            onSave={handleSave}
          />
          <Section
            title="Upcoming"
            subtitle={`${upcoming.length} event${upcoming.length === 1 ? '' : 's'}`}
            events={upcoming}
            savingId={savingId}
            onSave={handleSave}
          />
        </>
      )}
    </div>
  );
}

/* ── section ────────────────────────────────────────── */

function FilterAxis({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ color: TEXT_TER, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, minWidth: 62 }}>
        {label}
      </span>
      {options.map((option) => (
        <button
          key={option}
          aria-pressed={selected.has(option)}
          style={selected.has(option) ? s.chipActive : s.chip}
          onClick={() => onToggle(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function Section({
  title,
  subtitle,
  events,
  emptyHint,
  savingId,
  onSave,
}: {
  title: string;
  subtitle?: string;
  events: DiscoveryEvent[];
  emptyHint?: string;
  savingId: string | null;
  onSave: (event: DiscoveryEvent) => void;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={s.sectionHead}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT }}>{title}</h2>
        {subtitle && <span style={{ color: TEXT_TER, fontSize: 13 }}>{subtitle}</span>}
      </div>
      {events.length === 0 ? (
        emptyHint ? (
          <p style={{ color: TEXT_TER, fontSize: 13, margin: 0 }}>{emptyHint}</p>
        ) : null
      ) : (
        <div style={s.grid}>
          {events.map((event) => (
            <EventCard key={event.feedId} event={event} savingId={savingId} onSave={onSave} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── event card ─────────────────────────────────────── */

function EventCard({
  event,
  savingId,
  onSave,
}: {
  event: DiscoveryEvent;
  savingId: string | null;
  onSave: (event: DiscoveryEvent) => void;
}) {
  const time = formatTime(event.startAt, event.endAt);
  const blurb = stripHtml(event.description);
  const maps = mapsUrl(event);
  const priceFacet = event.priceBucket;
  const busy = savingId === event.feedId;

  return (
    <article style={s.card}>
      <div style={s.cardTags}>
        {event.category && <span style={s.tagAccent}>{event.category}</span>}
        {event.isFree ? (
          <span style={s.tagFree}>Free</span>
        ) : priceFacet && priceFacet !== 'Unknown' ? (
          <span style={s.tag}>{priceFacet}</span>
        ) : null}
        {event.sourceId === 'manual' && <span style={s.tag}>Added by you</span>}
        {event.saved && <span style={s.tagFree}>Saved</span>}
      </div>

      <h3 style={s.cardTitle}>{event.title}</h3>

      <div style={s.cardMeta}>
        <span>{formatDate(event.startAt)}</span>
        {time && <span> · {time}</span>}
      </div>

      {event.venueName && (
        <div style={s.cardVenue}>📍 {event.venueName}</div>
      )}

      {blurb && <p style={s.cardBlurb}>{blurb.length > 180 ? `${blurb.slice(0, 180)}…` : blurb}</p>}

      <div style={s.cardLinks}>
        {maps && (
          <a href={maps} target="_blank" rel="noopener noreferrer" style={s.link}>
            Open in Maps →
          </a>
        )}
        <button style={s.saveBtn} onClick={() => onSave(event)} disabled={busy}>
          {busy ? '...' : event.saved ? 'Unsave' : 'Save'}
        </button>
      </div>
    </article>
  );
}

/* ── styles ─────────────────────────────────────────── */

const s: Record<string, CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  banner: {
    background: `linear-gradient(135deg, ${ACCENT_DIM} 0%, ${SURFACE} 100%)`,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 16,
    padding: '16px 20px',
  },
  bannerLink: {
    color: ACCENT,
    fontWeight: 600,
    textDecoration: 'none',
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 14,
  },
  card: {
    background: GLASS,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 16,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardTags: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: TEXT,
    lineHeight: 1.3,
  },
  cardMeta: {
    color: TEXT_SEC,
    fontSize: 13,
    fontWeight: 600,
  },
  cardVenue: {
    color: TEXT_TER,
    fontSize: 13,
  },
  cardBlurb: {
    margin: '4px 0 0',
    color: TEXT_SEC,
    fontSize: 13,
    lineHeight: 1.5,
  },
  cardLinks: {
    marginTop: 6,
    display: 'flex',
    gap: 14,
  },
  link: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
  },
  tag: {
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
    background: SURFACE_EL,
    color: TEXT_SEC,
    padding: '2px 10px',
    fontSize: 11,
    fontWeight: 600,
  },
  tagAccent: {
    borderRadius: 999,
    border: `1px solid ${ACCENT}`,
    background: ACCENT_DIM,
    color: ACCENT,
    padding: '2px 10px',
    fontSize: 11,
    fontWeight: 700,
  },
  tagFree: {
    borderRadius: 999,
    border: '1px solid color-mix(in srgb, var(--success) 40%, transparent)',
    background: 'color-mix(in srgb, var(--success) 15%, transparent)',
    color: 'var(--success)',
    padding: '2px 10px',
    fontSize: 11,
    fontWeight: 700,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
    background: GLASS,
    color: TEXT_SEC,
    padding: '6px 14px',
    fontSize: 13,
    cursor: 'pointer',
  },
  chipActive: {
    borderRadius: 999,
    border: `1px solid ${ACCENT}`,
    background: ACCENT,
    color: 'var(--background)',
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  centerCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    background: GLASS,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 16,
    minHeight: 280,
  },
  btnPrimary: {
    background: ACCENT,
    border: 'none',
    borderRadius: 8,
    color: 'var(--background)',
    fontWeight: 700,
    padding: '8px 16px',
    fontSize: 13,
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'transparent',
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    color: TEXT,
    padding: '8px 16px',
    fontSize: 13,
    cursor: 'pointer',
    marginTop: 12,
  },
  skeleton: {
    background: `linear-gradient(90deg, ${SURFACE_EL} 0%, ${GLASS} 50%, ${SURFACE_EL} 100%)`,
    backgroundSize: '200% 100%',
    animation: 'skeleton-pulse 1.5s ease infinite',
    borderRadius: 12,
    height: 60,
  },
  searchInput: {
    flex: '1 1 240px',
    minHeight: 40,
    padding: '0 14px',
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
    background: GLASS,
    color: TEXT,
    fontSize: 14,
  },
  btnGhostInline: {
    background: 'transparent',
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    color: TEXT,
    padding: '9px 16px',
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  addCard: {
    background: GLASS,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 16,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  saveBtn: {
    background: 'transparent',
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    color: TEXT_SEC,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    marginLeft: 'auto',
  },
};
