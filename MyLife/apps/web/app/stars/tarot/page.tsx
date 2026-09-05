'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  doCreateTarotReading,
  fetchProfiles,
  fetchTarotReadingsAction,
} from '../actions';
import {
  TAROT_SPREADS,
  getTarotCardOfDay,
  type BirthProfile,
  type TarotCard,
  type TarotReading,
  type TarotReadingCard,
  type TarotSpreadType,
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
import {
  createTarotDraftReading,
  tarotReadingPreview,
} from '../view-models';

const SPREAD_LAYOUT_COLUMNS: Record<TarotSpreadType, string> = {
  daily_card: '1fr',
  one_card: '1fr',
  three_card: 'repeat(3, minmax(0, 1fr))',
  celtic_cross: 'repeat(4, minmax(0, 1fr))',
  relationship: 'repeat(3, minmax(0, 1fr))',
  horseshoe: 'repeat(4, minmax(0, 1fr))',
};

export default function TarotPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayCard = useMemo(() => getTarotCardOfDay(today), [today]);
  const [profiles, setProfiles] = useState<BirthProfile[]>([]);
  const [history, setHistory] = useState<TarotReading[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [question, setQuestion] = useState('');
  const [activeSpread, setActiveSpread] = useState<TarotSpreadType>('three_card');
  const [draft, setDraft] = useState<ReturnType<typeof createTarotDraftReading> | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [selectedCard, setSelectedCard] = useState<TarotReadingCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [profileItems, readingItems] = await Promise.all([
          fetchProfiles(),
          fetchTarotReadingsAction(undefined, 18),
        ]);
        if (!cancelled) {
          setProfiles(profileItems);
          setSelectedProfileId(profileItems[0]?.id ?? '');
          setHistory(readingItems);
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError('Failed to load tarot sanctuary');
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
  }, []);

  useEffect(() => {
    if (!draft) {
      return;
    }
    setRevealedCount(0);
    const timers = draft.cards.map((_, index) =>
      window.setTimeout(() => {
        setRevealedCount((current) => Math.max(current, index + 1));
      }, 220 + index * 160),
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [draft]);

  async function handleDraw() {
    setDrawing(true);
    setError(null);
    try {
      const nextDraft = createTarotDraftReading(activeSpread, question, today);
      setDraft(nextDraft);
      const saved = await doCreateTarotReading({
        profileId: selectedProfileId || null,
        readingDate: today,
        spreadType: nextDraft.spread.type,
        title: nextDraft.title,
        question: nextDraft.question || null,
        narrative: nextDraft.narrative,
        notes: null,
        cards: nextDraft.cards,
      });
      setHistory((current) => [saved, ...current.filter((item) => item.id !== saved.id)].slice(0, 18));
    } catch (drawError) {
      console.error(drawError);
      setError('Failed to draw tarot spread');
    } finally {
      setDrawing(false);
    }
  }

  if (error) {
    return (
      <EmptyState
        title="Tarot sanctuary unavailable"
        detail={error}
        action={
          <button type="button" onClick={() => location.reload()} style={ghostButtonStyle(true)}>
            <StarsSymbol name="refresh" size={18} color={STARS_BG} filled />
            Reload sanctuary
          </button>
        }
      />
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ ...panelStyle({ minHeight: 240, glow: true }) }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1.04fr 0.96fr', gap: 18 }}>
          <div style={{ ...panelStyle({ minHeight: 560 }) }} />
          <div style={{ ...panelStyle({ minHeight: 560 }) }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="stars-card-glow" style={{ ...panelStyle({ padding: 28, tone: '#15151B', glow: true }), display: 'grid', gap: 18 }}>
        <SectionTitle
          eyebrow="Tarot Sanctuary"
          title={`Today's card is ${todayCard.name}`}
          detail={`${formatLongDate(today)} opens under ${todayCard.name}, a card that speaks through ${todayCard.keywords.slice(0, 3).join(', ')}. Use a spread below to expand the daily signal into a fuller conversation.`}
          actions={
            <>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 14px',
                  borderRadius: 999,
                  background: withAlpha('#35343A', 0.9),
                  boxShadow: `inset 0 0 0 1.5px ${withAlpha(STARS_ACCENT_LIGHT, 0.08)}`,
                }}
              >
                <StarsSymbol name="group" size={18} color={STARS_ACCENT_LIGHT} />
                <select
                  value={selectedProfileId}
                  onChange={(event) => setSelectedProfileId(event.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: STARS_TEXT,
                    fontSize: 13,
                    fontWeight: 700,
                    minWidth: 120,
                  }}
                >
                  <option value="">No profile</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => void handleDraw()} disabled={drawing} style={ghostButtonStyle(true)}>
                <StarsSymbol name="style" size={18} color={STARS_BG} filled />
                {drawing ? 'Drawing...' : 'Draw spread'}
              </button>
            </>
          }
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.74fr) minmax(320px, 1.26fr)', gap: 18 }}>
          <div style={{ ...panelStyle({ padding: 22, tone: '#111117', glow: true }), display: 'grid', gap: 12 }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Card of the day
            </span>
            <div style={{ display: 'grid', gap: 8 }}>
              <strong style={{ color: STARS_TEXT, fontSize: 34, letterSpacing: '-0.05em' }}>{todayCard.name}</strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {todayCard.keywords.slice(0, 3).map((keyword) => (
                  <InlineBadge key={keyword} label={keyword} tone={withAlpha(STARS_GOLD, 0.14)} textColor={STARS_GOLD} />
                ))}
              </div>
              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.85 }}>
                {todayCard.uprightMeaning}
              </p>
            </div>
          </div>

          <div style={{ ...panelStyle({ padding: 22, tone: '#111117' }), display: 'grid', gap: 12 }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Question and spread
            </span>
            <label
              style={{
                display: 'grid',
                gap: 6,
                color: STARS_TEXT_SECONDARY,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Question
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="What wants clarity right now?"
                style={{
                  minHeight: 92,
                  resize: 'vertical',
                  border: 'none',
                  outline: 'none',
                  borderRadius: 18,
                  padding: '14px 16px',
                  background: withAlpha('#1B1B20', 0.96),
                  boxShadow: `inset 0 0 0 1.5px ${withAlpha(STARS_ACCENT_LIGHT, 0.08)}`,
                  color: STARS_TEXT,
                  fontSize: 14,
                  lineHeight: 1.7,
                  fontFamily: 'inherit',
                }}
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {TAROT_SPREADS.filter((spread) => ['one_card', 'three_card', 'celtic_cross', 'relationship'].includes(spread.type)).map((spread) => (
                <button
                  key={spread.type}
                  type="button"
                  onClick={() => setActiveSpread(spread.type)}
                  style={{
                    ...panelStyle({ padding: 16, tone: activeSpread === spread.type ? '#1C1B25' : '#15151B', glow: activeSpread === spread.type }),
                    border: 'none',
                    cursor: 'pointer',
                    display: 'grid',
                    gap: 6,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StarsSymbol name={spread.icon} size={18} color={activeSpread === spread.type ? STARS_GOLD : STARS_ACCENT_LIGHT} />
                    <strong style={{ color: STARS_TEXT }}>{spread.name}</strong>
                  </div>
                  <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                    {spread.description}
                  </p>
                  <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12 }}>{spread.cardCount} cards</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.08fr) minmax(300px, 0.92fr)', gap: 18 }}>
        <section style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Active reading
              </span>
              <h2 style={{ margin: '4px 0 0', color: STARS_TEXT, fontSize: 30, letterSpacing: '-0.04em' }}>
                {draft ? draft.title : 'No spread drawn yet'}
              </h2>
            </div>
            {draft ? (
              <InlineBadge label={`${revealedCount}/${draft.cards.length} revealed`} tone={withAlpha(STARS_ACCENT, 0.16)} textColor={STARS_ACCENT_LIGHT} />
            ) : null}
          </div>

          {!draft ? (
            <EmptyState
              title="Choose a spread and draw"
              detail="The sanctuary stores each draw in your local archive, then reveals cards one by one so the reading feels deliberate rather than instant."
            />
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: SPREAD_LAYOUT_COLUMNS[draft.spread.type],
                  gap: 12,
                }}
              >
                {draft.cards.map((card, index) => (
                  <TarotTile
                    key={`${card.cardId}-${card.positionLabel}`}
                    card={card}
                    revealed={index < revealedCount}
                    onClick={() => setSelectedCard(card)}
                  />
                ))}
              </div>

              <div style={{ ...panelStyle({ padding: 18, tone: '#111117' }), display: 'grid', gap: 8 }}>
                <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                  Narrative
                </span>
                <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.85 }}>{draft.narrative}</p>
              </div>
            </>
          )}
        </section>

        <aside style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 16, alignContent: 'start' }}>
          {selectedCard ? (
            <div style={{ ...panelStyle({ padding: 18, tone: '#111117', glow: true }), display: 'grid', gap: 8 }}>
              <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Card detail
              </span>
              <strong style={{ color: STARS_TEXT, fontSize: 24, letterSpacing: '-0.04em' }}>{selectedCard.cardName}</strong>
              <span style={{ color: STARS_ACCENT_LIGHT, fontSize: 12, fontWeight: 700 }}>
                {selectedCard.positionLabel} {selectedCard.reversed ? '· Reversed' : '· Upright'}
              </span>
              <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>
                {selectedCard.interpretation}
              </p>
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Reading history
            </span>
            {history.length === 0 ? (
              <div style={{ ...panelStyle({ padding: 16, tone: '#111117' }), color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                Draw a spread to seed the local archive.
              </div>
            ) : (
              history.map((reading) => (
                <button
                  key={reading.id}
                  type="button"
                  onClick={() => {
                    setDraft({
                      spread: TAROT_SPREADS.find((spread) => spread.type === reading.spreadType) ?? TAROT_SPREADS[0],
                      title: reading.title,
                      question: reading.question ?? '',
                      cards: reading.cards,
                      narrative: reading.narrative ?? '',
                    });
                    setSelectedCard(reading.cards[0] ?? null);
                  }}
                  style={{
                    ...panelStyle({ padding: 16, tone: '#111117' }),
                    border: 'none',
                    cursor: 'pointer',
                    display: 'grid',
                    gap: 4,
                    textAlign: 'left',
                  }}
                >
                  <strong style={{ color: STARS_TEXT, fontSize: 15 }}>{reading.title}</strong>
                  <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12 }}>
                    {formatShortDate(reading.readingDate)} · {reading.spreadType.replace(/_/g, ' ')}
                  </span>
                  <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
                    {tarotReadingPreview(reading)}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function TarotTile({
  card,
  revealed,
  onClick,
}: {
  card: TarotReadingCard;
  revealed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...panelStyle({ padding: 18, tone: revealed ? '#111117' : '#1B1622', glow: revealed }),
        border: 'none',
        cursor: 'pointer',
        minHeight: 220,
        display: 'grid',
        gap: 10,
        alignContent: 'start',
        textAlign: 'left',
        transform: `translateY(${revealed ? 0 : 20}px) scale(${revealed ? 1 : 0.96})`,
        opacity: revealed ? 1 : 0.55,
        transition: 'transform 320ms ease, opacity 320ms ease, box-shadow 320ms ease',
      }}
    >
      <span style={{ color: STARS_TEXT_SECONDARY, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
        {card.positionLabel}
      </span>
      <strong style={{ color: STARS_TEXT, fontSize: 24, letterSpacing: '-0.04em' }}>
        {revealed ? card.cardName : 'Hidden card'}
      </strong>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <InlineBadge label={card.reversed ? 'Reversed' : 'Upright'} tone={withAlpha(STARS_ACCENT, 0.16)} textColor={STARS_ACCENT_LIGHT} />
      </div>
      <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.8 }}>
        {revealed ? card.interpretation : 'Reveal unfolds in sequence so the spread lands with rhythm.'}
      </p>
    </button>
  );
}
