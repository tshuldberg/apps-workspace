'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  fetchPerson,
  fetchJournalForPerson,
  fetchJournalCounts,
  addJournalEntry,
  removeJournalEntry,
} from './actions';
import type { JournalEntryRecord, JournalCountByType, PersonRecord } from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const SURFACE = 'var(--surface-elevated, #2A292F)';

const GRATITUDE_COLOR = '#10B981';
const PROCESSING_COLOR = '#6B7280';
const GROWTH_COLOR = '#8BCFF0';

type JournalType = 'gratitude' | 'conflict' | 'growth';

const SECTION_CONFIG: {
  type: JournalType;
  label: string;
  color: string;
  prompt: string;
  formPrompt: string;
  placeholder: string;
}[] = [
  {
    type: 'gratitude',
    label: 'Gratitude',
    color: GRATITUDE_COLOR,
    prompt: 'What do you appreciate about this friendship?',
    formPrompt: 'What do you appreciate?',
    placeholder: 'I appreciate how they always...',
  },
  {
    type: 'conflict',
    label: 'Processing',
    color: PROCESSING_COLOR,
    prompt: "What's on your mind about this friendship?",
    formPrompt: "What's on your mind?",
    placeholder: "I've been thinking about...",
  },
  {
    type: 'growth',
    label: 'Growth',
    color: GROWTH_COLOR,
    prompt: 'How has this friendship changed?',
    formPrompt: 'How has this friendship changed?',
    placeholder: 'Looking back, our friendship has...',
  },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function JournalPage() {
  const params = useParams<{ id: string }>();
  const [person, setPerson] = useState<PersonRecord | null>(null);
  const [entries, setEntries] = useState<Record<JournalType, JournalEntryRecord[]>>({
    gratitude: [],
    conflict: [],
    growth: [],
  });
  const [counts, setCounts] = useState<JournalCountByType>({
    gratitude: 0,
    conflict: 0,
    growth: 0,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Add form state
  const [showForm, setShowForm] = useState<JournalType | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!params.id) return;
    try {
      const [p, c, g, conf, gr] = await Promise.all([
        fetchPerson(params.id),
        fetchJournalCounts(params.id),
        fetchJournalForPerson(params.id, 'gratitude'),
        fetchJournalForPerson(params.id, 'conflict'),
        fetchJournalForPerson(params.id, 'growth'),
      ]);
      setPerson(p);
      setCounts(c);
      setEntries({ gratitude: g, conflict: conf, growth: gr });
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!params.id || !showForm || !formTitle.trim()) return;
    setSaving(true);
    try {
      await addJournalEntry({
        person_id: params.id,
        type: showForm,
        title: formTitle.trim(),
        description_md: formDescription.trim() || undefined,
      });
      setShowForm(null);
      setFormTitle('');
      setFormDescription('');
      await load();
    } catch {
      // silently handle
    } finally {
      setSaving(false);
    }
  }, [params.id, showForm, formTitle, formDescription, load]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this journal entry? This cannot be undone.')) return;
      try {
        await removeJournalEntry(id);
        await load();
      } catch {
        // silently handle
      }
    },
    [load],
  );

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: TEXT_SEC }}>
        Loading...
      </div>
    );
  }

  if (!person) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: TEXT }}>Person not found</h2>
        <Link
          href="/friends"
          style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600 }}
        >
          Back to people
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 28, maxWidth: 720 }}>
      <Link
        href={`/friends/${params.id}`}
        style={{ color: TEXT_SEC, textDecoration: 'none', fontSize: 14 }}
      >
        &larr; Back to {person.display_name}
      </Link>

      {/* Title */}
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: TEXT }}>
          Journal
        </h1>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 14,
            color: TEXT_SEC,
            lineHeight: 1.5,
          }}
        >
          A private space to reflect on your friendship with{' '}
          {person.display_name}
        </p>
      </div>

      {/* Summary counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {SECTION_CONFIG.map(({ type, label, color }) => (
          <div
            key={type}
            style={{
              ...glassCardStyle,
              padding: 12,
              textAlign: 'center',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
                color,
              }}
            >
              {counts[type]}
            </p>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 11,
                fontWeight: 600,
                color: TEXT_SEC,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Add form (inline) */}
      {showForm && (
        <div style={{ ...glassCardStyle, padding: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: SECTION_CONFIG.find((s) => s.type === showForm)!.color,
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: SECTION_CONFIG.find((s) => s.type === showForm)!.color,
              }}
            >
              {SECTION_CONFIG.find((s) => s.type === showForm)!.formPrompt}
            </span>
          </div>

          <input
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="A short title for this entry"
            maxLength={120}
            style={{
              width: '100%',
              padding: '12px 14px',
              backgroundColor: SURFACE,
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              color: TEXT,
              marginBottom: 10,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder={SECTION_CONFIG.find((s) => s.type === showForm)!.placeholder}
            rows={5}
            style={{
              width: '100%',
              padding: '12px 14px',
              backgroundColor: SURFACE,
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              color: TEXT,
              resize: 'vertical',
              marginBottom: 12,
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !formTitle.trim()}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 10,
                backgroundColor: SECTION_CONFIG.find((s) => s.type === showForm)!.color,
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                cursor: saving || !formTitle.trim() ? 'not-allowed' : 'pointer',
                opacity: saving || !formTitle.trim() ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(null);
                setFormTitle('');
                setFormDescription('');
              }}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                backgroundColor: SURFACE,
                color: TEXT_SEC,
                fontWeight: 600,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sections */}
      {SECTION_CONFIG.map(({ type, label, color, prompt }) => (
        <section key={type}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: color,
                display: 'inline-block',
              }}
            />
            <h3 style={{ ...sectionTitleStyle, flex: 1, margin: 0 }}>{label}</h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(type);
                setFormTitle('');
                setFormDescription('');
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                backgroundColor: `${color}20`,
                color,
                fontWeight: 600,
                fontSize: 13,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Add
            </button>
          </div>

          {entries[type].length === 0 ? (
            <div
              style={{
                ...glassCardStyle,
                padding: 20,
                textAlign: 'center',
                cursor: 'pointer',
              }}
              onClick={() => {
                setShowForm(type);
                setFormTitle('');
                setFormDescription('');
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: '#9F8E81',
                  fontStyle: 'italic',
                }}
              >
                {prompt}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {entries[type].map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    ...glassCardStyle,
                    borderLeft: `3px solid ${color}`,
                    padding: 14,
                    cursor: 'pointer',
                  }}
                  onClick={() =>
                    setExpandedId(expandedId === entry.id ? null : entry.id)
                  }
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: TEXT,
                        flex: 1,
                        marginRight: 8,
                      }}
                    >
                      {entry.title}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#9F8E81' }}>
                        {formatDate(entry.created_at)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(entry.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#9F8E81',
                          cursor: 'pointer',
                          fontSize: 12,
                          padding: '2px 4px',
                        }}
                      >
                        &times;
                      </button>
                    </span>
                  </div>
                  {entry.description_md && expandedId !== entry.id && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: TEXT_SEC,
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {entry.description_md}
                    </p>
                  )}
                  {entry.description_md && expandedId === entry.id && (
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: 14,
                        color: TEXT,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {entry.description_md}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: TEXT_SEC,
  textTransform: 'uppercase',
  letterSpacing: 1,
};

const glassCardStyle: React.CSSProperties = {
  backgroundColor: GLASS,
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 16,
};
