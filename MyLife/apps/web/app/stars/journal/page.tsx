'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  doCreateJournalEntry,
  doDeleteJournalEntry,
  doSearchJournalEntries,
  fetchJournalCount,
  fetchJournalEntries,
  fetchProfiles,
} from '../actions';
import {
  JOURNAL_MOODS,
  captureAstrologicalContext,
  computeRetrogradeStatuses,
  getActiveRetrogrades,
  type BirthProfile,
  type JournalEntryRow,
} from '@mylife/stars';
import {
  EmptyState,
  InlineBadge,
  STARS_ACCENT,
  STARS_ACCENT_LIGHT,
  STARS_BG,
  STARS_GOLD,
  STARS_TEXT,
  STARS_TEXT_SECONDARY,
  SectionTitle,
  StarsSymbol,
  formatLongDate,
  formatMonthLabel,
  formatShortDate,
  ghostButtonStyle,
  panelStyle,
  secondaryButtonStyle,
  withAlpha,
} from '../ui';
import { deriveJournalTitle, groupByMonth } from '../view-models';

export default function JournalPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [entries, setEntries] = useState<JournalEntryRow[]>([]);
  const [profiles, setProfiles] = useState<BirthProfile[]>([]);
  const [count, setCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMood, setFilterMood] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadJournal();
  }, []);

  async function loadJournal() {
    setLoading(true);
    try {
      const [entryItems, entryCount, profileItems] = await Promise.all([
        fetchJournalEntries(60),
        fetchJournalCount(),
        fetchProfiles(),
      ]);
      setEntries(entryItems);
      setCount(entryCount);
      setProfiles(profileItems);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load your cosmic journal');
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    setLoading(true);
    try {
      if (!searchQuery.trim()) {
        const entryItems = await fetchJournalEntries(60);
        setEntries(entryItems);
      } else {
        const entryItems = await doSearchJournalEntries(searchQuery.trim(), 60);
        setEntries(entryItems);
      }
    } catch (searchError) {
      console.error(searchError);
      setError('Search failed inside the journal archive');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await doDeleteJournalEntry(id);
      setEntries((current) => current.filter((entry) => entry.id !== id));
      setCount((current) => Math.max(0, current - 1));
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete journal entry');
    }
  }

  const filteredEntries = useMemo(() => {
    const byMood = filterMood === 'all' ? entries : entries.filter((entry) => (entry.mood ?? 'unknown') === filterMood);
    return byMood;
  }, [entries, filterMood]);

  const groups = useMemo(() => groupByMonth(filteredEntries), [filteredEntries]);

  if (error) {
    return (
      <EmptyState
        title="Journal archive unavailable"
        detail={error}
        action={
          <button type="button" onClick={() => location.reload()} style={ghostButtonStyle(true)}>
            <StarsSymbol name="refresh" size={18} color={STARS_BG} filled />
            Reload archive
          </button>
        }
      />
    );
  }

  return (
    <>
      <div style={{ display: 'grid', gap: 18 }}>
        <section className="stars-card-glow" style={{ ...panelStyle({ padding: 28, tone: '#15151B', glow: true }), display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Cosmic Journal"
            title={`Private reflections (${count})`}
            detail="Search your archive, filter by mood, and expand entries inline with their moon phase, retrograde weather, and tarot context."
            actions={
              <>
                <button type="button" onClick={() => setShowCompose(true)} style={ghostButtonStyle(true)}>
                  <StarsSymbol name="edit_note" size={18} color={STARS_BG} filled />
                  Compose ritual
                </button>
                <Link href="/stars/journal/compose" style={secondaryButtonStyle()}>
                  <StarsSymbol name="open_in_new" size={18} color={STARS_ACCENT_LIGHT} />
                  Full editor
                </Link>
              </>
            }
          />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <InlineBadge label={`${count} archived entries`} icon="menu_book" />
            <InlineBadge label={`${profiles.length} linked profile${profiles.length === 1 ? '' : 's'}`} icon="group" />
            <InlineBadge label="Markdown supported" tone={withAlpha(STARS_GOLD, 0.16)} textColor={STARS_GOLD} icon="code" />
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.34fr) minmax(0, 0.66fr)', gap: 18 }}>
          <aside style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 16, alignContent: 'start' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Search archive
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <label
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: 18,
                    background: withAlpha('#1B1B20', 0.9),
                    boxShadow: `inset 0 0 0 1.5px ${withAlpha(STARS_ACCENT_LIGHT, 0.08)}`,
                  }}
                >
                  <StarsSymbol name="search" size={18} color={STARS_ACCENT_LIGHT} />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void handleSearch();
                      }
                    }}
                    placeholder="Search titles, notes, reflections..."
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: STARS_TEXT,
                      fontSize: 13,
                    }}
                  />
                </label>
                <button type="button" onClick={() => void handleSearch()} style={secondaryButtonStyle()}>
                  Go
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Mood filter
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['all', ...JOURNAL_MOODS].map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => setFilterMood(mood)}
                    style={filterMood === mood ? ghostButtonStyle(true) : secondaryButtonStyle()}
                  >
                    {mood === 'all' ? 'All moods' : capitalizeWord(mood)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 8 }}>
              <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Archive cues
              </span>
              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.75 }}>
                Expand any entry to see markdown-rendered reflections, moon context, retrograde flags, and tarot notes without leaving the archive.
              </p>
            </div>
          </aside>

          <section style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 18 }}>
            {loading ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {[1, 2, 3].map((value) => (
                  <div key={value} style={{ ...panelStyle({ minHeight: 180, tone: '#111117' }) }} />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <EmptyState
                title="No entries match this filter"
                detail="Try another search term, clear the mood filter, or start a fresh journal entry from the compose ritual panel."
              />
            ) : (
              groups.map((group) => (
                <div key={group.label} style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <strong style={{ color: STARS_TEXT, fontSize: 24, letterSpacing: '-0.04em' }}>{group.label}</strong>
                    <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 700 }}>
                      {group.items.length} entr{group.items.length === 1 ? 'y' : 'ies'}
                    </span>
                  </div>
                  {group.items.map((entry) => {
                    const expanded = entry.id === expandedId;
                    return (
                      <article key={entry.id} style={{ ...panelStyle({ padding: 20, tone: '#111117', glow: expanded }), display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                          <div style={{ display: 'grid', gap: 8 }}>
                            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 700 }}>{formatLongDate(entry.date)}</span>
                            <strong style={{ color: STARS_TEXT, fontSize: 24, letterSpacing: '-0.04em' }}>{deriveJournalTitle(entry)}</strong>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {entry.mood ? <InlineBadge label={capitalizeWord(entry.mood)} tone={withAlpha(STARS_ACCENT, 0.16)} textColor={STARS_ACCENT_LIGHT} /> : null}
                              {entry.intention ? <InlineBadge label={entry.intention} tone={withAlpha(STARS_GOLD, 0.16)} textColor={STARS_GOLD} /> : null}
                              <InlineBadge label={`${moonEmoji(entry.moonPhase)} ${phaseLabel(entry.moonPhase)}`} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => setExpandedId(expanded ? null : entry.id)} style={expanded ? ghostButtonStyle(true) : secondaryButtonStyle()}>
                              <StarsSymbol name={expanded ? 'expand_less' : 'expand_more'} size={18} color={expanded ? STARS_BG : STARS_ACCENT_LIGHT} filled={expanded} />
                              {expanded ? 'Collapse' : 'Expand'}
                            </button>
                            <button type="button" onClick={() => void handleDelete(entry.id)} style={secondaryButtonStyle()}>
                              <StarsSymbol name="delete" size={18} color={STARS_ACCENT_LIGHT} />
                              Delete
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gap: 10 }}>
                          <CelestialContext entry={entry} />
                          <div className="stars-markdown">
                            {expanded ? (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.content}</ReactMarkdown>
                            ) : (
                              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>
                                {truncate(entry.content, 240)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Link href={`/stars/journal/${entry.id}`} style={{ color: STARS_ACCENT_LIGHT, fontSize: 13, fontWeight: 700 }}>
                            Open detail page
                          </Link>
                          <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12 }}>
                            {entry.photoUris.length} attachment{entry.photoUris.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      {showCompose ? (
        <ComposeModal
          profiles={profiles}
          onClose={() => setShowCompose(false)}
          onCreated={(entry) => {
            setEntries((current) => [entry, ...current]);
            setCount((current) => current + 1);
            setExpandedId(entry.id);
            setShowCompose(false);
          }}
          today={today}
        />
      ) : null}
    </>
  );
}

function CelestialContext({ entry }: { entry: JournalEntryRow }) {
  return (
    <div style={{ ...panelStyle({ padding: 16, tone: '#15151D' }), display: 'grid', gap: 8 }}>
      <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
        Celestial context
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <InlineBadge label={`${moonEmoji(entry.moonPhase)} ${phaseLabel(entry.moonPhase)}`} />
        <InlineBadge label={`Sun in ${capitalizeWord(entry.sunSign)}`} icon="sunny" />
        <InlineBadge label={`Moon in ${capitalizeWord(entry.moonSign)}`} icon="brightness_2" />
        {entry.tarotCardName ? <InlineBadge label={entry.tarotCardName} tone={withAlpha(STARS_ACCENT, 0.16)} textColor={STARS_ACCENT_LIGHT} icon="style" /> : null}
      </div>
      {entry.retrogradePlanets && entry.retrogradePlanets !== '[]' ? (
        <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
          Retrogrades active: {entry.retrogradePlanets.replace(/[[\]"]/g, '').replace(/,/g, ', ')}
        </p>
      ) : null}
    </div>
  );
}

function ComposeModal({
  profiles,
  onClose,
  onCreated,
  today,
}: {
  profiles: BirthProfile[];
  onClose: () => void;
  onCreated: (entry: JournalEntryRow) => void;
  today: string;
}) {
  const retroStatuses = useMemo(() => computeRetrogradeStatuses(today), [today]);
  const activeRetrogrades = useMemo(() => getActiveRetrogrades(retroStatuses), [retroStatuses]);
  const retroPlanets = activeRetrogrades.map((item) => item.body);
  const astroContext = useMemo(() => captureAstrologicalContext(today, retroPlanets), [today, retroPlanets]);

  const [date, setDate] = useState(today);
  const [profileId, setProfileId] = useState('');
  const [mood, setMood] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!content.trim()) {
      setError('Write something before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const entry = await doCreateJournalEntry({
        profileId: profileId || null,
        date,
        title: title.trim() || null,
        content: content.trim(),
        mood: mood || null,
        intention: null,
        moonPhase: astroContext.moonPhase,
        moonSign: astroContext.moonSign,
        sunSign: astroContext.sunSign,
        retrogradePlanets: retroPlanets.length > 0 ? JSON.stringify(retroPlanets) : null,
        tarotCardName: astroContext.tarotCardName,
      });
      onCreated(entry);
    } catch (saveError) {
      console.error(saveError);
      setError('Failed to save journal entry.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8,8,12,0.72)',
        backdropFilter: 'blur(18px)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        zIndex: 60,
      }}
    >
      <div style={{ width: 'min(920px, 100%)', maxHeight: 'calc(100vh - 48px)', overflow: 'auto', ...panelStyle({ padding: 24, tone: '#15151B', glow: true }) }} className="stars-scroll">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Compose ritual
            </span>
            <strong style={{ color: STARS_TEXT, fontSize: 28, letterSpacing: '-0.04em' }}>New journal entry</strong>
          </div>
          <button type="button" onClick={onClose} style={secondaryButtonStyle()}>
            <StarsSymbol name="close" size={18} color={STARS_ACCENT_LIGHT} />
            Close
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 18, marginTop: 18 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            {error ? <p style={{ margin: 0, color: '#FFB4AB', fontSize: 13 }}>{error}</p> : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <label style={fieldLabelStyle}>
                Date
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={fieldStyle} />
              </label>
              <label style={fieldLabelStyle}>
                Mood
                <select value={mood} onChange={(event) => setMood(event.target.value)} style={fieldStyle}>
                  <option value="">Select mood</option>
                  {JOURNAL_MOODS.map((item) => (
                    <option key={item} value={item}>
                      {capitalizeWord(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label style={fieldLabelStyle}>
                Profile
                <select value={profileId} onChange={(event) => setProfileId(event.target.value)} style={fieldStyle}>
                  <option value="">No profile</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label style={fieldLabelStyle}>
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional title" style={fieldStyle} />
            </label>

            <label style={fieldLabelStyle}>
              Reflection
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write your reflection in markdown..."
                style={{
                  ...fieldStyle,
                  minHeight: 260,
                  resize: 'vertical',
                  lineHeight: 1.8,
                  fontFamily: 'inherit',
                }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12 }}>{content.length} characters</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={onClose} style={secondaryButtonStyle()}>
                  Cancel
                </button>
                <button type="button" onClick={() => void handleSave()} disabled={saving} style={ghostButtonStyle(true)}>
                  <StarsSymbol name="check" size={18} color={STARS_BG} filled />
                  {saving ? 'Saving...' : 'Save entry'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 10, alignContent: 'start' }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Current sky context
            </span>
            <InlineBadge label={`${moonEmoji(astroContext.moonPhase)} ${phaseLabel(astroContext.moonPhase)}`} />
            <InlineBadge label={`Moon in ${capitalizeWord(astroContext.moonSign)}`} icon="brightness_2" />
            <InlineBadge label={`Sun in ${capitalizeWord(astroContext.sunSign)}`} icon="sunny" />
            {astroContext.tarotCardName ? <InlineBadge label={astroContext.tarotCardName} tone={withAlpha(STARS_ACCENT, 0.16)} textColor={STARS_ACCENT_LIGHT} icon="style" /> : null}
            {retroPlanets.length > 0 ? (
              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                Retrogrades active: {retroPlanets.map(capitalizeWord).join(', ')}.
              </p>
            ) : null}
            <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
              Use this modal for fast capture. The full editor route stays available when you need a larger canvas or attachment workflow.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const fieldLabelStyle = {
  display: 'grid',
  gap: 6,
  color: STARS_TEXT_SECONDARY,
  fontSize: 12,
  fontWeight: 700,
};

const fieldStyle = {
  border: 'none',
  outline: 'none',
  borderRadius: 16,
  padding: '12px 14px',
  background: withAlpha('#1B1B20', 0.96),
  boxShadow: `inset 0 0 0 1.5px ${withAlpha(STARS_ACCENT_LIGHT, 0.08)}`,
  color: STARS_TEXT,
  fontSize: 14,
};

function capitalizeWord(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function phaseLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function moonEmoji(value: string) {
  return {
    new_moon: '\u{1F311}',
    waxing_crescent: '\u{1F312}',
    first_quarter: '\u{1F313}',
    waxing_gibbous: '\u{1F314}',
    full_moon: '\u{1F315}',
    waning_gibbous: '\u{1F316}',
    last_quarter: '\u{1F317}',
    waning_crescent: '\u{1F318}',
  }[value] ?? '\u{1F319}';
}

function truncate(value: string, length: number) {
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length).trim()}...`;
}
