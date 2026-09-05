'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  doDeleteDailyNote,
  doUpsertDailyNote,
  fetchDailyNotes,
} from '../actions';
import {
  NUTRITION_CHROME,
  alpha,
  formatNutritionDate,
  humanizeNutritionValue,
} from '../_lib/design';
import {
  MaterialSymbol,
  NutritionBadge,
  NutritionButton,
  NutritionEmptyState,
  NutritionModal,
  NutritionPageHeader,
  NutritionPanel,
} from '../_components/NutritionPrimitives';

type DailyNote = Awaited<ReturnType<typeof fetchDailyNotes>>[number];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NutritionNotesPage() {
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [activeTag, setActiveTag] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [editingDate, setEditingDate] = useState(todayIso);
  const [editingContent, setEditingContent] = useState('');
  const [editingTags, setEditingTags] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchDailyNotes(120, 0);
      setNotes(rows as DailyNote[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load nutrition notes.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tags = useMemo(() => {
    const allTags = new Set<string>();
    notes.forEach((note) => {
      note.tags?.forEach((tag) => allTags.add(tag));
    });
    return ['all', ...Array.from(allTags).sort()];
  }, [notes]);

  const visibleNotes = useMemo(() => {
    return notes.filter((note) => {
      if (activeTag !== 'all' && !(note.tags ?? []).includes(activeTag)) return false;
      if (!query.trim()) return true;
      const haystack = `${note.content} ${(note.tags ?? []).join(' ')}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });
  }, [activeTag, notes, query]);

  const grouped = useMemo(() => {
    return visibleNotes.reduce<Record<string, DailyNote[]>>((accumulator, note) => {
      const month = formatNutritionDate(note.date, { month: 'long', year: 'numeric' });
      accumulator[month] ??= [];
      accumulator[month].push(note);
      return accumulator;
    }, {});
  }, [visibleNotes]);

  function openEditor(note?: DailyNote) {
    setEditingDate(note?.date ?? todayIso());
    setEditingContent(note?.content ?? '');
    setEditingTags((note?.tags ?? []).join(', '));
    setModalOpen(true);
  }

  async function handleSave() {
    try {
      await doUpsertDailyNote(crypto.randomUUID(), {
        date: editingDate,
        content: editingContent,
        tags: editingTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      setModalOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save note.');
    }
  }

  async function handleDelete(date: string) {
    try {
      await doDeleteDailyNote(date);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to delete note.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <NutritionPageHeader
        title="Daily Notes"
        description="Keep reflection close to the diary: what happened, how you felt, and what each meal pattern taught you."
        action={<NutritionButton tone="accent" onClick={() => openEditor()}>New Note</NutritionButton>}
      />

      <NutritionPanel tone="focus" style={{ padding: 22 }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes, moods, cravings, tags..."
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                style={{
                  minHeight: 36,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTag === tag ? alpha(NUTRITION_CHROME.accent, 0.16) : alpha('#FFFFFF', 0.04),
                  color: activeTag === tag ? NUTRITION_CHROME.text : NUTRITION_CHROME.textMuted,
                  boxShadow: activeTag === tag ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.accent, 0.24)}` : 'none',
                  fontWeight: 700,
                }}
              >
                {tag === 'all' ? 'All tags' : humanizeNutritionValue(tag)}
              </button>
            ))}
          </div>
        </div>
      </NutritionPanel>

      {error ? (
        <NutritionPanel style={{ padding: 16, color: NUTRITION_CHROME.danger }}>{error}</NutritionPanel>
      ) : null}

      {visibleNotes.length > 0 ? (
        <div style={{ display: 'grid', gap: 20 }}>
          {Object.entries(grouped).map(([month, monthNotes]) => (
            <section key={month} style={{ display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{month}</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {monthNotes.map((note) => (
                  <NutritionPanel key={note.id} style={{ padding: 18 }}>
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'grid', gap: 6 }}>
                          <strong>{formatNutritionDate(note.date, { weekday: 'long', month: 'short', day: 'numeric' })}</strong>
                          <span style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>{note.content}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <NutritionButton tone="ghost" onClick={() => openEditor(note)}>Edit</NutritionButton>
                          <button type="button" onClick={() => void handleDelete(note.date)} style={deleteButtonStyle}>
                            <MaterialSymbol name="delete" size={18} color={NUTRITION_CHROME.danger} />
                          </button>
                        </div>
                      </div>
                      {(note.tags ?? []).length > 0 ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {(note.tags ?? []).map((tag) => (
                            <NutritionBadge key={tag}>{tag}</NutritionBadge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </NutritionPanel>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <NutritionEmptyState
          title="No notes match the current filter"
          description="Write a quick reflection, tag a restaurant day, or capture an energy note to start building your nutrition memory."
          action={<NutritionButton tone="accent" onClick={() => openEditor()}>Write Note</NutritionButton>}
        />
      )}

      <NutritionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nutrition Note"
        footer={(
          <>
            <NutritionButton tone="ghost" onClick={() => setModalOpen(false)}>Cancel</NutritionButton>
            <NutritionButton tone="accent" onClick={() => void handleSave()}>Save Note</NutritionButton>
          </>
        )}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <input type="date" value={editingDate} onChange={(event) => setEditingDate(event.target.value)} style={inputStyle} />
          <textarea
            value={editingContent}
            onChange={(event) => setEditingContent(event.target.value)}
            rows={7}
            style={{ ...inputStyle, minHeight: 180, paddingTop: 14 }}
            placeholder="What did you notice about energy, hunger, satiety, mood, or cravings today?"
          />
          <input
            value={editingTags}
            onChange={(event) => setEditingTags(event.target.value)}
            placeholder="Tags separated by commas"
            style={inputStyle}
          />
        </div>
      </NutritionModal>
    </div>
  );
}

const inputStyle: CSSProperties = {
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 14,
  border: `1.5px solid ${alpha('#FFFFFF', 0.08)}`,
  background: alpha('#FFFFFF', 0.04),
  color: NUTRITION_CHROME.text,
};

const deleteButtonStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 14,
  border: 'none',
  background: alpha(NUTRITION_CHROME.danger, 0.14),
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
};
