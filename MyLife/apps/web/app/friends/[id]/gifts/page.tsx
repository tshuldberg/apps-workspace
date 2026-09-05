'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  fetchGiftsForPerson,
  fetchIdeasForPerson,
  fetchGiftSpending,
  addGift,
  addIdea,
  removeGift,
  removeIdea,
  purchaseIdea,
} from './actions';
import { fetchPerson } from '../../actions';
import type { GiftRecord, GiftIdeaRecord, PersonRecord } from '@mylife/friends';

const ACCENT = '#EC4899';
const BLUE = '#8BCFF0';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const SURFACE = 'var(--surface-elevated, #2A292F)';

const OCCASION_COLORS: Record<string, string> = {
  birthday: '#F59E0B', holiday: '#EF4444', just_because: '#8B5CF6',
  thank_you: '#10B981', anniversary: '#EC4899', graduation: '#06B6D4', other: '#9F8E81',
};
const OCCASION_LABELS: Record<string, string> = {
  birthday: 'Birthday', holiday: 'Holiday', just_because: 'Just because',
  thank_you: 'Thank you', anniversary: 'Anniversary', graduation: 'Graduation', other: 'Other',
};
const OCCASIONS = Object.entries(OCCASION_LABELS).map(([value, label]) => ({
  value,
  label,
  color: OCCASION_COLORS[value],
}));

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

type Tab = 'ideas' | 'history';

export default function GiftTrackerPage() {
  const params = useParams<{ id: string }>();
  const personId = params.id;

  const [person, setPerson] = useState<PersonRecord | null>(null);
  const [tab, setTab] = useState<Tab>('ideas');
  const [ideas, setIdeas] = useState<GiftIdeaRecord[]>([]);
  const [gifts, setGifts] = useState<GiftRecord[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showGiftForm, setShowGiftForm] = useState(false);
  const [showIdeaForm, setShowIdeaForm] = useState(false);

  // Gift form
  const [gDirection, setGDirection] = useState<'given' | 'received'>('given');
  const [gDesc, setGDesc] = useState('');
  const [gOccasion, setGOccasion] = useState('');
  const [gAmount, setGAmount] = useState('');
  const [gDate, setGDate] = useState(new Date().toISOString().slice(0, 10));
  const [gReaction, setGReaction] = useState('');

  // Idea form
  const [iDesc, setIDesc] = useState('');
  const [iPrice, setIPrice] = useState('');
  const [iSource, setISource] = useState('');
  const [iLink, setILink] = useState('');

  const load = useCallback(async () => {
    if (!personId) return;
    try {
      const [p, g, i, s] = await Promise.all([
        fetchPerson(personId),
        fetchGiftsForPerson(personId),
        fetchIdeasForPerson(personId),
        fetchGiftSpending(personId),
      ]);
      setPerson(p);
      setGifts(g);
      setIdeas(i);
      setTotalSpent(s);
    } catch { /* silently handle */ }
    setLoading(false);
  }, [personId]);

  useEffect(() => { void load(); }, [load]);

  const handleAddGift = useCallback(async () => {
    if (!gDesc.trim()) return;
    const amountCents = gAmount ? Math.round(parseFloat(gAmount) * 100) : undefined;
    try {
      await addGift({
        person_id: personId,
        direction: gDirection,
        description: gDesc.trim(),
        occasion: (gOccasion || undefined) as 'birthday' | 'holiday' | 'just_because' | 'thank_you' | 'anniversary' | 'graduation' | 'other' | undefined,
        amount_cents: amountCents,
        date: gDate || undefined,
        reaction_notes: gReaction.trim() || undefined,
      });
      setGDesc(''); setGAmount(''); setGReaction(''); setGOccasion('');
      setShowGiftForm(false);
      void load();
    } catch { /* silently handle */ }
  }, [personId, gDirection, gDesc, gOccasion, gAmount, gDate, gReaction, load]);

  const handleAddIdea = useCallback(async () => {
    if (!iDesc.trim()) return;
    const priceCents = iPrice ? Math.round(parseFloat(iPrice) * 100) : undefined;
    try {
      await addIdea({
        person_id: personId,
        description: iDesc.trim(),
        estimated_price_cents: priceCents,
        source_note: iSource.trim() || undefined,
        link_url: iLink.trim() || undefined,
      });
      setIDesc(''); setIPrice(''); setISource(''); setILink('');
      setShowIdeaForm(false);
      void load();
    } catch { /* silently handle */ }
  }, [personId, iDesc, iPrice, iSource, iLink, load]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: TEXT_SEC }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 720 }}>
      <Link href={`/friends/${personId}`} style={{ color: TEXT_SEC, textDecoration: 'none', fontSize: 14 }}>
        &larr; Back to {person?.display_name ?? 'person'}
      </Link>

      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>
        Gifts {person ? `for ${person.display_name}` : ''}
      </h1>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, backgroundColor: GLASS, borderRadius: 12, padding: 4 }}>
        {(['ideas', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, cursor: 'pointer',
              backgroundColor: tab === t ? SURFACE : 'transparent',
              color: tab === t ? TEXT : TEXT_SEC,
              fontWeight: 600, fontSize: 14, textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'ideas' ? (
        <>
          <button
            type="button"
            onClick={() => setShowIdeaForm(!showIdeaForm)}
            style={{ ...btnStyle, backgroundColor: ACCENT, color: '#fff', fontWeight: 700 }}
          >
            {showIdeaForm ? 'Cancel' : '+ Add Idea'}
          </button>

          {showIdeaForm && (
            <div style={formCard}>
              <input style={inputStyle} placeholder="Gift idea *" value={iDesc} onChange={(e) => setIDesc(e.target.value)} autoFocus />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: ACCENT }}>$</span>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Price estimate" value={iPrice} onChange={(e) => setIPrice(e.target.value)} type="number" step="0.01" min="0" />
              </div>
              <input style={inputStyle} placeholder="Where did you see this?" value={iSource} onChange={(e) => setISource(e.target.value)} />
              <input style={inputStyle} placeholder="Link URL" value={iLink} onChange={(e) => setILink(e.target.value)} />
              <button type="button" onClick={handleAddIdea} style={{ ...btnStyle, backgroundColor: ACCENT, color: '#fff', fontWeight: 700 }}>
                Save Idea
              </button>
            </div>
          )}

          {ideas.length === 0 && !showIdeaForm ? (
            <p style={{ textAlign: 'center', color: TEXT_SEC, padding: 32 }}>No gift ideas yet</p>
          ) : (
            ideas.map((idea) => (
              <div key={idea.id} style={{ ...cardStyle, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT, textDecoration: idea.is_purchased ? 'line-through' : 'none', opacity: idea.is_purchased ? 0.5 : 1 }}>
                    {idea.description}
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    {idea.estimated_price_cents != null && (
                      <span style={{ fontWeight: 700, color: ACCENT, fontSize: 14 }}>{formatCents(idea.estimated_price_cents)}</span>
                    )}
                    {idea.priority > 0 && (
                      <span style={{ fontSize: 12, color: TEXT_SEC }}>Priority {idea.priority}</span>
                    )}
                  </div>
                  {idea.source_note && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9F8E81', fontStyle: 'italic' }}>{idea.source_note}</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                  {!idea.is_purchased ? (
                    <button type="button" onClick={() => { void purchaseIdea(idea.id).then(load); }} style={{ ...smallBtn, backgroundColor: `${ACCENT}20`, color: ACCENT }}>
                      {'\u2713'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: 4 }}>Bought</span>
                  )}
                  <button type="button" onClick={() => { void removeIdea(idea.id).then(load); }} style={{ ...smallBtn, color: '#9F8E81' }}>
                    {'\u00D7'}
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      ) : (
        <>
          {totalSpent > 0 && (
            <div style={{ backgroundColor: `${ACCENT}10`, border: `1px solid ${ACCENT}20`, borderRadius: 14, padding: 16, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total spent</p>
              <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 800, color: ACCENT }}>{formatCents(totalSpent)}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowGiftForm(!showGiftForm)}
            style={{ ...btnStyle, backgroundColor: ACCENT, color: '#fff', fontWeight: 700 }}
          >
            {showGiftForm ? 'Cancel' : '+ Log Gift'}
          </button>

          {showGiftForm && (
            <div style={formCard}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['given', 'received'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setGDirection(d)}
                    style={{
                      flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, cursor: 'pointer',
                      backgroundColor: gDirection === d ? (d === 'given' ? `${ACCENT}20` : `${BLUE}20`) : SURFACE,
                      color: gDirection === d ? (d === 'given' ? ACCENT : BLUE) : TEXT_SEC,
                      fontWeight: gDirection === d ? 700 : 600, fontSize: 14, textTransform: 'capitalize',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <input style={inputStyle} placeholder="Description *" value={gDesc} onChange={(e) => setGDesc(e.target.value)} autoFocus />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {OCCASIONS.map((occ) => (
                  <button
                    key={occ.value}
                    type="button"
                    onClick={() => setGOccasion(gOccasion === occ.value ? '' : occ.value)}
                    style={{
                      padding: '6px 10px', border: `1px solid ${gOccasion === occ.value ? `${occ.color}40` : BORDER}`, borderRadius: 8, cursor: 'pointer',
                      backgroundColor: gOccasion === occ.value ? `${occ.color}20` : GLASS,
                      color: gOccasion === occ.value ? occ.color : TEXT_SEC,
                      fontSize: 12, fontWeight: 500,
                    }}
                  >
                    {occ.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: ACCENT }}>$</span>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Amount" value={gAmount} onChange={(e) => setGAmount(e.target.value)} type="number" step="0.01" min="0" />
              </div>
              <input style={inputStyle} type="date" value={gDate} onChange={(e) => setGDate(e.target.value)} />
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="Reaction notes" value={gReaction} onChange={(e) => setGReaction(e.target.value)} />
              <button type="button" onClick={handleAddGift} style={{ ...btnStyle, backgroundColor: ACCENT, color: '#fff', fontWeight: 700 }}>
                Save Gift
              </button>
            </div>
          )}

          {gifts.length === 0 && !showGiftForm ? (
            <p style={{ textAlign: 'center', color: TEXT_SEC, padding: 32 }}>No gift history</p>
          ) : (
            gifts.map((gift) => (
              <div key={gift.id} style={{ ...cardStyle, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      backgroundColor: gift.direction === 'given' ? `${ACCENT}20` : `${BLUE}20`,
                      color: gift.direction === 'given' ? ACCENT : BLUE,
                    }}>
                      {gift.direction === 'given' ? 'Given' : 'Received'}
                    </span>
                    {gift.occasion && (
                      <span style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        backgroundColor: `${OCCASION_COLORS[gift.occasion] ?? '#9F8E81'}15`,
                        color: OCCASION_COLORS[gift.occasion] ?? '#9F8E81',
                      }}>
                        {OCCASION_LABELS[gift.occasion] ?? gift.occasion}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT }}>{gift.description}</p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    {gift.amount_cents != null && (
                      <span style={{ fontWeight: 700, color: ACCENT, fontSize: 14 }}>{formatCents(gift.amount_cents)}</span>
                    )}
                    {gift.date && <span style={{ fontSize: 12, color: TEXT_SEC }}>{formatDate(gift.date)}</span>}
                  </div>
                  {gift.reaction_notes && <p style={{ margin: '6px 0 0', fontSize: 13, color: TEXT_SEC, fontStyle: 'italic' }}>{gift.reaction_notes}</p>}
                </div>
                <button type="button" onClick={() => { void removeGift(gift.id).then(load); }} style={{ ...smallBtn, color: '#9F8E81' }}>
                  {'\u00D7'}
                </button>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: GLASS,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: 14,
};

const formCard: React.CSSProperties = {
  ...cardStyle,
  display: 'grid',
  gap: 12,
};

const inputStyle: React.CSSProperties = {
  backgroundColor: GLASS,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  color: TEXT,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  padding: '12px 0',
  borderRadius: 12,
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
};

const smallBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 14,
  border: 'none',
  cursor: 'pointer',
  backgroundColor: 'transparent',
  fontSize: 16,
  fontWeight: 700,
};
