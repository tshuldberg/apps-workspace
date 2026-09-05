'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { savePrimaryClustersAction } from '@/app/actions';

const TEXT = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const ACCENT = '#FFB877';
const GLASS_BORDER = 'rgba(255,255,255,0.10)';

const CLUSTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'body', label: 'Body' },
  { id: 'mind', label: 'Mind' },
  { id: 'home', label: 'Home' },
  { id: 'money', label: 'Money' },
  { id: 'social', label: 'Social' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'knowledge', label: 'Knowledge' },
];

interface TodayFocusEditorProps {
  clusters: string[];
}

/**
 * Inline editor for the `today.primary_clusters` preference. Cards from
 * modules inside the selected clusters get a ranking boost on the Today
 * surface, and QuickActions follow the same selection.
 */
export function TodayFocusEditor({ clusters }: TodayFocusEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(clusters));
  const [pending, startTransition] = useTransition();

  const allSelected = selected.size === CLUSTER_OPTIONS.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    const next = CLUSTER_OPTIONS.filter((c) => selected.has(c.id)).map((c) => c.id);
    startTransition(async () => {
      const saved = await savePrimaryClustersAction(next);
      setSelected(new Set(saved));
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: TEXT_SECONDARY,
          fontSize: 13,
          cursor: 'pointer',
          textDecoration: 'underline',
          textUnderlineOffset: 3,
        }}
      >
        Focus: {allSelected ? 'everything' : clusters.join(', ')} · tune
      </button>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${GLASS_BORDER}`,
        borderRadius: 12,
        padding: 14,
        marginTop: 8,
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>
        Pick what your Today feed should prioritize. Cards from these areas rank higher.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CLUSTER_OPTIONS.map((option) => {
          const active = selected.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              style={{
                borderRadius: 20,
                padding: '5px 12px',
                fontSize: 13,
                cursor: 'pointer',
                border: `1px solid ${active ? ACCENT : GLASS_BORDER}`,
                background: active ? 'rgba(255,184,119,0.14)' : 'transparent',
                color: active ? ACCENT : TEXT,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          style={{
            background: '#C9894D',
            color: '#131318',
            fontWeight: 600,
            fontSize: 13,
            padding: '6px 14px',
            borderRadius: 8,
            border: 'none',
            cursor: pending ? 'wait' : 'pointer',
          }}
        >
          {pending ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelected(new Set(clusters));
            setEditing(false);
          }}
          style={{
            background: 'none',
            border: `1px solid ${GLASS_BORDER}`,
            color: TEXT_SECONDARY,
            fontSize: 13,
            padding: '6px 14px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
