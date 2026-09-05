'use client';

import type { CSSProperties } from 'react';

const ACCENT = 'var(--accent-surf, #3B82F6)';
const GLASS = 'var(--glass, rgba(255,255,255,0.04))';
const GLASS_BORDER = 'var(--glass-border, rgba(255,255,255,0.06))';
const TEXT = 'var(--text, #F0F0F5)';
const TEXT_SEC = 'var(--text-secondary, rgba(240,240,245,0.65))';
const TEXT_TER = 'var(--text-tertiary, rgba(240,240,245,0.35))';

const STOKE_EMOJI = ['', '\u{1F610}', '\u{1F642}', '\u{1F919}', '\u{1F525}', '\u{1F92F}'];

interface FeedItem {
  id: string;
  userName: string;
  spotName: string;
  caption?: string;
  waveCount?: number;
  stokeLevel: number;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

const PLACEHOLDER_FEED: FeedItem[] = [
  {
    id: '1',
    userName: 'KellySlater',
    spotName: 'Pipeline',
    caption: 'Perfect morning barrels',
    waveCount: 8,
    stokeLevel: 5,
    likesCount: 42,
    commentsCount: 7,
    createdAt: '2h ago',
  },
  {
    id: '2',
    userName: 'SurfJane',
    spotName: 'Ocean Beach',
    caption: 'Fun waist-high session',
    waveCount: 15,
    stokeLevel: 3,
    likesCount: 12,
    commentsCount: 2,
    createdAt: '4h ago',
  },
];

export default function FeedPage() {
  return (
    <div style={{ padding: '24px 32px', maxWidth: 700 }}>
      <h1 style={{ color: TEXT, fontSize: 28, fontWeight: 700, margin: 0 }}>Surf Feed</h1>
      <p style={{ color: TEXT_SEC, fontSize: 15, marginTop: 4, marginBottom: 24 }}>
        Sessions from your crew
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {PLACEHOLDER_FEED.map((item) => (
          <div key={item.id} style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div style={s.avatar}>
                {item.userName[0]}
              </div>
              <div style={{ flex: 1, marginLeft: 10 }}>
                <div style={{ color: TEXT, fontSize: 15, fontWeight: 600 }}>{item.userName}</div>
                <div style={{ color: ACCENT, fontSize: 13, marginTop: 1 }}>{item.spotName}</div>
              </div>
              <span style={{ color: TEXT_TER, fontSize: 12 }}>{item.createdAt}</span>
            </div>

            {item.caption && (
              <p style={{ color: TEXT, fontSize: 15, lineHeight: '21px', margin: '0 0 12px 0' }}>
                {item.caption}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{STOKE_EMOJI[item.stokeLevel]}</span>
                {item.waveCount != null && (
                  <span style={{ color: TEXT_SEC, fontSize: 13 }}>
                    {item.waveCount} waves
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button style={s.actionBtn}>
                  {'\u{1F919}'} {item.likesCount}
                </button>
                <button style={s.actionBtn}>
                  {'\u{1F4AC}'} {item.commentsCount}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  card: {
    background: GLASS,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 14,
    padding: 20,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: 'color-mix(in srgb, var(--accent-surf, #3B82F6) 20%, transparent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: ACCENT,
    fontSize: 16,
    fontWeight: 700,
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    color: TEXT_SEC,
    fontSize: 14,
    cursor: 'pointer',
    padding: '4px 8px',
  },
};
