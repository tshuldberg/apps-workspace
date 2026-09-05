'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  doCreateDailyReading,
  fetchDailyReading,
  fetchDailyReadingsAction,
  fetchProfiles,
  fetchTarotReadingsAction,
} from '../actions';
import {
  MOON_PHASE_INTERPRETATIONS,
  getMoonPhase,
  getMoonSign,
  getTarotCardOfDay,
  type BirthProfile,
  type DailyReading,
  type TarotReading,
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
  formatShortDate,
  ghostButtonStyle,
  panelStyle,
  secondaryButtonStyle,
  withAlpha,
} from '../ui';

type HistoryFilter = 'all' | 'daily' | 'tarot';

export default function ReadingsPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const moonPhase = useMemo(() => getMoonPhase(today), [today]);
  const moonSign = useMemo(() => getMoonSign(today), [today]);
  const todayCard = useMemo(() => getTarotCardOfDay(today), [today]);
  const [profiles, setProfiles] = useState<BirthProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [todayReading, setTodayReading] = useState<DailyReading | null>(null);
  const [dailyHistory, setDailyHistory] = useState<DailyReading[]>([]);
  const [tarotHistory, setTarotHistory] = useState<TarotReading[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profileItems = await fetchProfiles();
        const primary = profileItems[0] ?? null;
        const [currentReading, dailyItems, tarotItems] = primary
          ? await Promise.all([
              fetchDailyReading(primary.id, today),
              fetchDailyReadingsAction(primary.id, 20),
              fetchTarotReadingsAction(primary.id, 20),
            ])
          : [null, [], []];
        if (!cancelled) {
          setProfiles(profileItems);
          setSelectedProfileId(primary?.id ?? '');
          setTodayReading(currentReading);
          setDailyHistory(dailyItems);
          setTarotHistory(tarotItems);
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError('Failed to load reading archive');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [today]);

  async function handleGenerate() {
    if (!selectedProfileId) {
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const generated = await doCreateDailyReading({
        profileId: selectedProfileId,
        date: today,
        moonPhase,
        moonSign,
        summary: `${MOON_PHASE_INTERPRETATIONS[moonPhase]} Today's tarot card is ${todayCard.name}.`,
        tarotCard: todayCard.name,
      });
      setTodayReading(generated);
      setDailyHistory((current) => [generated, ...current.filter((item) => item.id !== generated.id)]);
    } catch (generateError) {
      console.error(generateError);
      setError('Failed to generate daily reading');
    } finally {
      setGenerating(false);
    }
  }

  const historyItems = useMemo(() => {
    const dailyItems = dailyHistory.map((reading) => ({
      id: `daily-${reading.id}`,
      date: reading.date,
      kind: 'daily' as const,
      title: formatLongDate(reading.date),
      subtitle: reading.tarotCard ?? 'Daily reading',
      body: reading.summary ?? 'No summary saved.',
    }));
    const tarotItems = tarotHistory.map((reading) => ({
      id: `tarot-${reading.id}`,
      date: reading.readingDate,
      kind: 'tarot' as const,
      title: reading.title,
      subtitle: reading.cards[0]?.cardName ?? 'Tarot spread',
      body: reading.narrative ?? 'No narrative saved.',
    }));

    const combined = [...dailyItems, ...tarotItems].sort((left, right) => right.date.localeCompare(left.date));
    if (filter === 'daily') {
      return combined.filter((item) => item.kind === 'daily');
    }
    if (filter === 'tarot') {
      return combined.filter((item) => item.kind === 'tarot');
    }
    return combined;
  }, [dailyHistory, filter, tarotHistory]);

  if (error && loading) {
    return (
      <EmptyState
        title="Reading archive unavailable"
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

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ ...panelStyle({ minHeight: 220, glow: true }) }} />
        <div style={{ ...panelStyle({ minHeight: 620 }) }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="stars-card-glow" style={{ ...panelStyle({ padding: 28, tone: '#15151B', glow: true }), display: 'grid', gap: 18 }}>
        <SectionTitle
          eyebrow="Reading Archive"
          title="Daily readings and tarot history"
          detail="Keep both the structured daily reading feed and the tarot spread archive in one desktop surface, with filters that collapse the library down to exactly the ritual you need."
          actions={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['all', 'daily', 'tarot'] as HistoryFilter[]).map((item) => (
                <button key={item} type="button" onClick={() => setFilter(item)} style={filter === item ? ghostButtonStyle(true) : secondaryButtonStyle()}>
                  {item === 'all' ? 'All' : item === 'daily' ? 'Daily' : 'Tarot'}
                </button>
              ))}
            </div>
          }
        />
        {error ? <p style={{ margin: 0, color: '#FFB4AB', fontSize: 13 }}>{error}</p> : null}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.04fr) minmax(320px, 0.96fr)', gap: 18 }}>
        <section style={{ ...panelStyle({ padding: 22, tone: '#15151B', glow: true }), display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Today's reading
            </span>
            <strong style={{ color: STARS_TEXT, fontSize: 30, letterSpacing: '-0.05em' }}>
              {todayReading ? formatLongDate(todayReading.date) : 'No reading generated'}
            </strong>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <InlineBadge label={`${moonPhase.replace(/_/g, ' ')}`} icon="dark_mode" />
              <InlineBadge label={`Moon in ${moonSign}`} icon="brightness_2" />
              <InlineBadge label={`Tarot ${todayCard.name}`} tone={withAlpha(STARS_ACCENT, 0.16)} textColor={STARS_ACCENT_LIGHT} />
            </div>
            <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 15, lineHeight: 1.85 }}>
              {todayReading?.summary ?? `${MOON_PHASE_INTERPRETATIONS[moonPhase]} Today's tarot thread is ${todayCard.name}, asking for a slower and more observant read of the day.`}
            </p>
            {!todayReading ? (
              <button type="button" onClick={() => void handleGenerate()} disabled={generating || !selectedProfileId} style={ghostButtonStyle(true)}>
                <StarsSymbol name="auto_awesome" size={18} color={STARS_BG} filled />
                {generating ? 'Generating...' : 'Generate today'}
              </button>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {historyItems.map((item) => (
              <div key={item.id} style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ color: STARS_TEXT, fontSize: 17 }}>{item.title}</strong>
                  <InlineBadge label={`${item.kind === 'daily' ? 'Daily' : 'Tarot'} · ${formatShortDate(item.date)}`} tone={item.kind === 'daily' ? withAlpha(STARS_GOLD, 0.16) : withAlpha(STARS_ACCENT, 0.16)} textColor={item.kind === 'daily' ? STARS_GOLD : STARS_ACCENT_LIGHT} />
                </div>
                <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12 }}>{item.subtitle}</span>
                <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.75 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <aside style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 16, alignContent: 'start' }}>
          <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 8 }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Archive stats
            </span>
            <InlineBadge label={`${dailyHistory.length} daily reading${dailyHistory.length === 1 ? '' : 's'}`} />
            <InlineBadge label={`${tarotHistory.length} tarot spread${tarotHistory.length === 1 ? '' : 's'}`} tone={withAlpha(STARS_ACCENT, 0.16)} textColor={STARS_ACCENT_LIGHT} />
          </div>

          <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 8 }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Next steps
            </span>
            <Link href="/stars/tarot" style={secondaryButtonStyle()}>
              <StarsSymbol name="style" size={18} color={STARS_ACCENT_LIGHT} />
              Tarot sanctuary
            </Link>
            <Link href="/stars/journal" style={secondaryButtonStyle()}>
              <StarsSymbol name="menu_book" size={18} color={STARS_ACCENT_LIGHT} />
              Journal archive
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
