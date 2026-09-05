'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  fetchTrip, editTrip, fetchTripDays, addTripDay, removeTripDay,
  fetchTripActivities, addTripActivity, removeTripActivity,
} from '../../actions';
import {
  ACCENT, ACCENT_BORDER, TEXT, TEXT_SEC, TEXT_TER, SURFACE, BORDER, GLASS,
  tripActivityIcon,
} from '../../ui';

interface Trip {
  id: string; name: string; startDate: string | null; endDate: string | null;
  notes: string | null; packingTemplateId: string | null;
}
interface TripDay {
  id: string; tripId: string; dayNumber: number; date: string | null;
  title: string | null; notes: string | null;
}
interface TripActivity {
  id: string; dayId: string; trailId: string | null; type: string;
  name: string; description: string | null; sortOrder: number;
}

export default function TripDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<TripDay[]>([]);
  const [activities, setActivities] = useState<Record<string, TripActivity[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesVal, setNotesVal] = useState('');
  const [addingActivityForDay, setAddingActivityForDay] = useState<string | null>(null);
  const [newActName, setNewActName] = useState('');
  const [newActType, setNewActType] = useState('hike');

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchTrip(id)
      .then(async (t) => {
        if (!t) { setError('Trip not found'); setLoading(false); return; }
        setTrip(t as Trip);
        setNameVal((t as Trip).name);
        setNotesVal((t as Trip).notes ?? '');
        const d = await fetchTripDays(id) as TripDay[];
        setDays(d);
        const acts: Record<string, TripActivity[]> = {};
        for (const day of d) {
          acts[day.id] = await fetchTripActivities(day.id) as TripActivity[];
        }
        setActivities(acts);
      })
      .catch(() => setError('Failed to load trip'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveName = async () => {
    if (!nameVal.trim() || !trip) return;
    try {
      await editTrip(id, { name: nameVal.trim() });
      setTrip({ ...trip, name: nameVal.trim() });
      setEditingName(false);
    } catch { setError('Failed to save name'); }
  };

  const handleSaveNotes = async () => {
    if (!trip) return;
    try {
      await editTrip(id, { notes: notesVal || null });
      setTrip({ ...trip, notes: notesVal || null });
      setEditingNotes(false);
    } catch { setError('Failed to save notes'); }
  };

  const handleAddDay = async () => {
    try {
      const nextNumber = days.length + 1;
      await addTripDay({ tripId: id, dayNumber: nextNumber });
      loadData();
    } catch { setError('Failed to add day'); }
  };

  const handleRemoveDay = async (dayId: string) => {
    if (!confirm('Delete this day and all its activities?')) return;
    try { await removeTripDay(dayId); loadData(); }
    catch { setError('Failed to delete day'); }
  };

  const handleAddActivity = async (dayId: string) => {
    if (!newActName.trim()) return;
    try {
      const existingActs = activities[dayId] ?? [];
      await addTripActivity({
        dayId,
        type: newActType as 'hike' | 'drive' | 'camp' | 'rest' | 'other',
        name: newActName.trim(),
        sortOrder: existingActs.length,
      });
      setNewActName('');
      setAddingActivityForDay(null);
      loadData();
    } catch { setError('Failed to add activity'); }
  };

  const handleRemoveActivity = async (actId: string) => {
    try { await removeTripActivity(actId); loadData(); }
    catch { setError('Failed to remove activity'); }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 20 }}>
        <div style={{ height: 80, borderRadius: 16, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        {[1, 2, 3].map((i) => <div key={i} style={{ height: 120, borderRadius: 16, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: TEXT_SEC }}>{error ?? 'Trip not found'}</p>
        <Link href="/trails/trips" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Back to trips</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link href="/trails/trips" style={{ color: TEXT_SEC, fontSize: 13, textDecoration: 'none' }}>&larr; Back to trips</Link>

      {/* Header */}
      <div>
        {editingName ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={nameVal} onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              autoFocus style={{ ...inputStyle, fontSize: 24, fontWeight: 800 }} />
            <button type="button" onClick={handleSaveName} style={smallBtnStyle}>Save</button>
            <button type="button" onClick={() => { setEditingName(false); setNameVal(trip.name); }} style={{ ...smallBtnStyle, backgroundColor: GLASS, color: TEXT_SEC }}>Cancel</button>
          </div>
        ) : (
          <h1 onClick={() => setEditingName(true)} style={{ margin: 0, fontSize: 28, fontWeight: 800, cursor: 'pointer' }} title="Click to edit">
            {trip.name}
          </h1>
        )}
        {trip.startDate && (
          <p style={{ margin: '6px 0 0', color: TEXT_SEC, fontSize: 14 }}>
            {new Date(trip.startDate).toLocaleDateString()}
            {trip.endDate && ` - ${new Date(trip.endDate).toLocaleDateString()}`}
          </p>
        )}
        {trip.packingTemplateId && (
          <Link href={`/trails/packing/${trip.packingTemplateId}`} style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>
            View packing list &rarr;
          </Link>
        )}
      </div>

      {/* Notes */}
      <section>
        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, color: TEXT_TER }}>NOTES</p>
        {editingNotes ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <textarea value={notesVal} onChange={(e) => setNotesVal(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={handleSaveNotes} style={smallBtnStyle}>Save</button>
              <button type="button" onClick={() => { setEditingNotes(false); setNotesVal(trip.notes ?? ''); }} style={{ ...smallBtnStyle, backgroundColor: GLASS, color: TEXT_SEC }}>Cancel</button>
            </div>
          </div>
        ) : (
          <p onClick={() => setEditingNotes(true)} style={{ margin: 0, color: trip.notes ? TEXT_SEC : TEXT_TER, fontSize: 14, cursor: 'pointer', lineHeight: 1.5 }}>
            {trip.notes || 'Click to add notes...'}
          </p>
        )}
      </section>

      {/* Days */}
      {days.length === 0 ? (
        <section style={{ padding: 32, borderRadius: 20, border: `1px dashed ${ACCENT_BORDER}`, backgroundColor: GLASS, textAlign: 'center' }}>
          <p style={{ fontSize: 36, margin: '0 0 8px' }}>{'\uD83D\uDCC5'}</p>
          <h3 style={{ margin: 0, fontSize: 18, color: TEXT }}>Add your first day</h3>
          <p style={{ margin: '8px 0 0', color: TEXT_SEC, fontSize: 14 }}>Build your itinerary day by day</p>
          <button type="button" onClick={handleAddDay} style={{ marginTop: 16, ...primaryBtnStyle }}>+ Add Day</button>
        </section>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {days.map((day) => {
            const dayActs = activities[day.id] ?? [];
            return (
              <section key={day.id} style={{ padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>
                      Day {day.dayNumber}
                      {day.date && <span style={{ fontWeight: 400, color: TEXT_SEC }}> - {new Date(day.date).toLocaleDateString()}</span>}
                    </h3>
                    {day.title && <p style={{ margin: '2px 0 0', fontSize: 13, color: TEXT_SEC }}>{day.title}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => { setAddingActivityForDay(addingActivityForDay === day.id ? null : day.id); setNewActName(''); }} style={{
                      background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}>
                      + Activity
                    </button>
                    <button type="button" onClick={() => handleRemoveDay(day.id)} style={{ background: 'none', border: 'none', color: TEXT_TER, cursor: 'pointer', fontSize: 12 }}>
                      Delete
                    </button>
                  </div>
                </div>

                {/* Add activity form */}
                {addingActivityForDay === day.id && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                    <select value={newActType} onChange={(e) => setNewActType(e.target.value)} style={{ ...inputStyle, width: 100, flex: 'none' }}>
                      <option value="hike">Hike</option>
                      <option value="drive">Drive</option>
                      <option value="camp">Camp</option>
                      <option value="rest">Rest</option>
                      <option value="other">Other</option>
                    </select>
                    <input type="text" placeholder="Activity name..." value={newActName}
                      onChange={(e) => setNewActName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddActivity(day.id)}
                      autoFocus style={inputStyle} />
                    <button type="button" onClick={() => handleAddActivity(day.id)} disabled={!newActName.trim()} style={{
                      ...smallBtnStyle, opacity: newActName.trim() ? 1 : 0.5,
                    }}>Add</button>
                  </div>
                )}

                {/* Activities */}
                {dayActs.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: TEXT_TER }}>No activities yet</p>
                ) : (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {dayActs.map((act) => (
                      <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, backgroundColor: 'var(--background)' }}>
                        <span style={{ fontSize: 16 }}>{tripActivityIcon(act.type)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{act.name}</p>
                          {act.description && <p style={{ margin: '1px 0 0', fontSize: 11, color: TEXT_SEC }}>{act.description}</p>}
                        </div>
                        {act.trailId && (
                          <Link href={`/trails/${act.trailId}`} style={{ fontSize: 11, color: ACCENT, textDecoration: 'none' }}>Trail</Link>
                        )}
                        <button type="button" onClick={() => handleRemoveActivity(act.id)} style={{ background: 'none', border: 'none', color: TEXT_TER, cursor: 'pointer', fontSize: 11 }}>
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          <button type="button" onClick={handleAddDay} style={{ ...primaryBtnStyle, justifySelf: 'start' }}>+ Add Day</button>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`,
  backgroundColor: 'var(--background)', color: TEXT, fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none',
};

const smallBtnStyle: React.CSSProperties = {
  borderRadius: 999, backgroundColor: ACCENT, color: 'var(--background)', padding: '6px 14px',
  fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer',
};

const primaryBtnStyle: React.CSSProperties = {
  borderRadius: 999, backgroundColor: ACCENT, color: 'var(--background)', padding: '10px 20px',
  fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
};
