'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clipUrlAction } from '../actions';
import type { ClipType } from '@mylife/notes';

const ACCENT = 'var(--accent-notes)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const DANGER = '#FF453A';

export default function WebClipperPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [clipType, setClipType] = useState<ClipType>('article');
  const [clipping, setClipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; body: string; id: string } | null>(null);

  async function handleClip() {
    if (!url.trim()) return;
    setClipping(true);
    setError(null);
    setPreview(null);
    try {
      const result = await clipUrlAction(url.trim(), clipType);
      setPreview({ title: result.title, body: result.body, id: result.id });
    } catch {
      setError('Failed to clip URL. Check the address and try again.');
    } finally {
      setClipping(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TEXT }}>Web Clipper</h2>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: TEXT_SEC }}>Paste a URL to save a webpage as a markdown note.</p>
      </div>

      {/* URL input */}
      <div style={{ padding: 20, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            onKeyDown={(e) => { if (e.key === 'Enter') handleClip(); }}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`,
              backgroundColor: GLASS, color: TEXT, fontSize: 14, outline: 'none',
            }}
          />
          <button type="button" onClick={handleClip} disabled={!url.trim() || clipping}
            style={{
              padding: '10px 20px', borderRadius: 8, backgroundColor: ACCENT, color: '#0A0A0F',
              fontWeight: 700, border: 'none', cursor: url.trim() ? 'pointer' : 'default',
              opacity: !url.trim() || clipping ? 0.4 : 1,
            }}>
            {clipping ? 'Clipping...' : 'Clip'}
          </button>
        </div>

        {/* Clip type */}
        <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
          {(['article', 'full_page', 'bookmark'] as ClipType[]).map((type) => (
            <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: TEXT_SEC, cursor: 'pointer' }}>
              <input type="radio" name="clipType" checked={clipType === type} onChange={() => setClipType(type)}
                style={{ accentColor: ACCENT }} />
              {type === 'article' ? 'Article' : type === 'full_page' ? 'Full Page' : 'Bookmark'}
            </label>
          ))}
        </div>

        <p style={{ margin: '10px 0 0', fontSize: 12, color: TEXT_SEC }}>
          Content is processed on your device. No data is sent to external servers.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${DANGER}`, backgroundColor: 'rgba(255,69,58,0.1)', textAlign: 'center' }}>
          <p style={{ margin: 0, color: DANGER, fontSize: 14 }}>{error}</p>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ padding: 20, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT }}>{preview.title}</p>
            <pre style={{
              marginTop: 12, padding: 16, borderRadius: 12, backgroundColor: GLASS,
              border: `1px solid ${BORDER}`, color: TEXT_SEC, fontSize: 13, lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflow: 'auto',
            }}>
              {preview.body.slice(0, 2000)}
              {preview.body.length > 2000 && '\n\n[Preview truncated]'}
            </pre>
          </div>
          <button type="button" onClick={() => router.push(`/notes/${preview.id}`)}
            style={{ padding: '12px 20px', borderRadius: 8, backgroundColor: ACCENT, color: '#0A0A0F', fontWeight: 700, border: 'none', cursor: 'pointer', width: 'fit-content' }}>
            Open Clipped Note &rarr;
          </button>
        </div>
      )}

      {/* Empty state when no preview */}
      {!preview && !error && !clipping && (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 48, margin: 0 }}>📎</p>
          <p style={{ margin: '12px 0 0', fontSize: 16, fontWeight: 600, color: TEXT }}>Clip web articles as markdown notes</p>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: TEXT_SEC }}>Paste a URL above to get started.</p>
        </div>
      )}
    </div>
  );
}
