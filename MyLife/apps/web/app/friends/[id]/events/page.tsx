'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  fetchEventsForPerson,
  addLifeEvent,
  ackEvent,
  removeLifeEvent,
} from './actions';
import { fetchPerson } from '../../actions';
import type { LifeEventRecord, PersonRecord } from '@mylife/friends';
import {
  formatLifeEventLabel,
  getLifeEventIcon,
  getResponseSuggestion,
} from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const SUCCESS = '#30D158';

const EVENT_TYPES = [
  { value: 'move', label: 'Moved', color: '#8BCFF0' },
  { value: 'job', label: 'New job', color: '#F59E0B' },
  { value: 'baby', label: 'Baby', color: '#EC4899' },
  { value: 'engaged', label: 'Engaged', color: '#8B5CF6' },
  { value: 'married', label: 'Married', color: '#EF4444' },
  { value: 'graduated', label: 'Graduated', color: '#06B6D4' },
  { value: 'other', label: 'Other', color: '#9F8E81' },
] as const;

type EventTypeValue = (typeof EVENT_TYPES)[number]['value'];

function formatDate(iso: string | null): string {
  if (!iso) return '';
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

export default function LifeEventsPage() {
  const params = useParams<{ id: string }>();
  const personId = params.id;

  const [person, setPerson] = useState<PersonRecord | null>(null);
  const [events, setEvents] = useState<LifeEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [type, setType] = useState<EventTypeValue | null>(null);
  const [description, setDescription] = useState('');
  const [dateText, setDateText] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notesMd, setNotesMd] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([
        fetchPerson(personId),
        fetchEventsForPerson(personId),
      ]);
      setPerson(p);
      setEvents(e);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!type) return;
    try {
      await addLifeEvent({
        person_id: personId,
        type,
        description: description.trim() || undefined,
        happened_at: dateText ? new Date(dateText).toISOString() : undefined,
        notes_md: notesMd.trim() || undefined,
      });
      setShowForm(false);
      setType(null);
      setDescription('');
      setNotesMd('');
      load();
    } catch {
      // silent
    }
  };

  const handleAck = async (id: string) => {
    try {
      await ackEvent(id);
      load();
    } catch {
      // silent
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeLifeEvent(id);
      load();
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, color: TEXT_SEC }}>Loading...</div>
    );
  }

  const suggestion = type ? getResponseSuggestion(type) : null;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link
          href={`/friends/${personId}`}
          style={{ color: TEXT, textDecoration: 'none', fontSize: 20 }}
        >
          {'\u2190'}
        </Link>
        <div>
          <h1 style={{ color: TEXT, fontSize: 20, fontWeight: 700, margin: 0 }}>
            Life Events
          </h1>
          {person && (
            <p style={{ color: TEXT_SEC, fontSize: 13, margin: '2px 0 0' }}>
              for {person.display_name}
            </p>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: ACCENT,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div
          style={{
            background: GLASS,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <p style={{ color: TEXT_SEC, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
            What happened?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {EVENT_TYPES.map((et) => (
              <button
                key={et.value}
                onClick={() => setType(et.value)}
                style={{
                  background: type === et.value ? `${et.color}20` : GLASS,
                  border: `1px solid ${type === et.value ? `${et.color}40` : BORDER}`,
                  borderRadius: 8,
                  padding: '6px 12px',
                  color: type === et.value ? et.color : TEXT_SEC,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {getLifeEventIcon(et.value)} {et.label}
              </button>
            ))}
          </div>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ color: TEXT_SEC, fontSize: 12, fontWeight: 700 }}>
              {type === 'move' ? 'NEW CITY' : 'DESCRIPTION'}
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'move' ? 'City name' : 'Brief description'}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                background: GLASS,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: '10px 12px',
                color: TEXT,
                fontSize: 14,
              }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ color: TEXT_SEC, fontSize: 12, fontWeight: 700 }}>WHEN</span>
            <input
              type="date"
              value={dateText}
              onChange={(e) => setDateText(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                background: GLASS,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: '10px 12px',
                color: TEXT,
                fontSize: 14,
              }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ color: TEXT_SEC, fontSize: 12, fontWeight: 700 }}>NOTES</span>
            <textarea
              value={notesMd}
              onChange={(e) => setNotesMd(e.target.value)}
              placeholder="Any details"
              rows={3}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                background: GLASS,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: '10px 12px',
                color: TEXT,
                fontSize: 14,
                resize: 'vertical',
              }}
            />
          </label>

          {suggestion && (
            <div
              style={{
                background: 'rgba(139,207,240,0.08)',
                border: '1px solid rgba(139,207,240,0.15)',
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
              }}
            >
              <p style={{ color: '#8BCFF0', fontSize: 11, fontWeight: 700, margin: '0 0 4px' }}>
                CONSIDER:
              </p>
              <p style={{ color: TEXT_SEC, fontSize: 13, fontStyle: 'italic', margin: 0 }}>
                {suggestion}
              </p>
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={!type}
            style={{
              background: type ? ACCENT : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontWeight: 600,
              cursor: type ? 'pointer' : 'not-allowed',
            }}
          >
            Save Event
          </button>
        </div>
      )}

      {/* Events list */}
      {events.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 48 }}>
          <p style={{ color: TEXT_SEC, fontWeight: 600 }}>No life events yet</p>
          <p style={{ color: '#9F8E81', fontSize: 13, marginTop: 4 }}>
            Tap + Add to record a milestone
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map((event) => (
            <div
              key={event.id}
              style={{
                background: GLASS,
                border: `1px solid ${BORDER}`,
                borderRadius: 14,
                padding: 14,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: 'rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {getLifeEventIcon(event.type)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: TEXT, fontWeight: 700, fontSize: 14 }}>
                    {formatLifeEventLabel(event.type)}
                  </span>
                  {event.acknowledged && (
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        background: `${SUCCESS}20`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        color: SUCCESS,
                      }}
                    >
                      {'\u2713'}
                    </span>
                  )}
                </div>
                {event.description && (
                  <p style={{ color: TEXT_SEC, fontSize: 14, margin: '4px 0 0' }}>
                    {event.description}
                  </p>
                )}
                <p style={{ color: '#9F8E81', fontSize: 12, margin: '4px 0 0' }}>
                  {formatDate(event.happened_at)}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {!event.acknowledged && (
                  <button
                    onClick={() => handleAck(event.id)}
                    title="Acknowledge"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      background: `${SUCCESS}20`,
                      border: 'none',
                      color: SUCCESS,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    {'\u2713'}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(event.id)}
                  title="Delete"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9F8E81',
                    fontSize: 18,
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  {'\u00D7'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
