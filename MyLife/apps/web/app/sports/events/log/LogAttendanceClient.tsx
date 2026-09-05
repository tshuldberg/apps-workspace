'use client';

import {
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import { useRouter } from 'next/navigation';
import type { StarRating, Venue } from '@mylife/sports';
import {
  sportsCreateVenue,
  sportsLogAttendance,
  sportsMarkVenueVisited,
} from '../../actions';
import { SPORTS_ACCENT } from '../../_ui';

type Props = {
  venues: Venue[];
  isWatchParty?: boolean;
};

function parseDollarsToCents(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function toDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDatetimeLocal(v: string): number {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

export function LogAttendanceClient({
  venues,
  isWatchParty = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueName, setVenueName] = useState('');
  const [addingVenue, setAddingVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueCity, setNewVenueCity] = useState('');

  const [section, setSection] = useState('');
  const [rowLabel, setRowLabel] = useState('');
  const [seat, setSeat] = useState('');

  const [companions, setCompanions] = useState<string[]>([]);
  const [companionDraft, setCompanionDraft] = useState('');

  const [costDollars, setCostDollars] = useState('');
  const [tailgate, setTailgate] = useState('');
  const [parking, setParking] = useState('');
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<StarRating | null>(null);
  const [attendedAt, setAttendedAt] = useState<number>(() => Date.now());

  const canSave = useMemo(
    () =>
      isWatchParty
        ? venueName.trim() !== ''
        : addingVenue
          ? newVenueName.trim() !== ''
          : venueName.trim() !== '',
    [addingVenue, isWatchParty, newVenueName, venueName],
  );

  const addCompanion = () => {
    const v = companionDraft.trim();
    if (!v) return;
    setCompanions((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setCompanionDraft('');
  };

  const removeCompanion = (name: string) => {
    setCompanions((prev) => prev.filter((c) => c !== name));
  };

  const handleSave = () => {
    if (!canSave) {
      setError('Venue name is required.');
      return;
    }
    setError(null);
    startTransition(async () => {
      let resolvedVenueId: string | null = venueId;
      let resolvedVenueName = venueName.trim();

      if (addingVenue && !isWatchParty) {
        const createRes = await sportsCreateVenue({
          name: newVenueName.trim(),
          city: newVenueCity.trim() === '' ? null : newVenueCity.trim(),
        });
        if (!createRes.ok) {
          setError(createRes.error);
          return;
        }
        resolvedVenueId = createRes.venue.id;
        resolvedVenueName = createRes.venue.name;
        await sportsMarkVenueVisited(createRes.venue.id, attendedAt);
      } else if (resolvedVenueId && !isWatchParty) {
        await sportsMarkVenueVisited(resolvedVenueId, attendedAt);
      }

      const res = await sportsLogAttendance({
        venue_id: resolvedVenueId,
        venue_name: resolvedVenueName,
        section: isWatchParty
          ? null
          : section.trim() === ''
            ? null
            : section.trim(),
        row_label: isWatchParty
          ? null
          : rowLabel.trim() === ''
            ? null
            : rowLabel.trim(),
        seat: isWatchParty
          ? null
          : seat.trim() === ''
            ? null
            : seat.trim(),
        companions,
        cost_cents: parseDollarsToCents(costDollars),
        tailgate_notes_md: tailgate.trim() === '' ? null : tailgate.trim(),
        parking_notes_md: isWatchParty
          ? null
          : parking.trim() === ''
            ? null
            : parking.trim(),
        notes_md: notes.trim() === '' ? null : notes.trim(),
        rating,
        attended_at: attendedAt,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      if (isWatchParty) {
        router.push('/sports/events/watch-party');
        router.refresh();
        return;
      }

      router.push(`/sports/events/${encodeURIComponent(res.row.id)}`);
      router.refresh();
    });
  };

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>
        {isWatchParty ? 'Log watch party' : 'Log attendance'}
      </p>
      <h2 style={styles.title}>
        {isWatchParty ? 'New watch party' : 'New game attended'}
      </h2>

      <Field label={isWatchParty ? 'Where did you watch?' : 'Venue'}>
        {isWatchParty ? (
          <>
            <div style={styles.chipRow}>
              {["Home", "Bar", "Friend's"].map((preset) => {
                const active = venueName === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setVenueId(null);
                      setVenueName(preset);
                    }}
                    style={{
                      ...styles.chip,
                      ...(active ? styles.chipActive : {}),
                    }}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={venueName}
              onChange={(e) => {
                setVenueName(e.target.value);
                setVenueId(null);
              }}
              placeholder="Or type a custom location"
              style={styles.input}
            />
          </>
        ) : addingVenue ? (
          <div style={styles.newVenueCard}>
            <input
              type="text"
              value={newVenueName}
              onChange={(e) => setNewVenueName(e.target.value)}
              placeholder="Venue name (e.g. Oracle Park)"
              style={styles.input}
            />
            <input
              type="text"
              value={newVenueCity}
              onChange={(e) => setNewVenueCity(e.target.value)}
              placeholder="City (optional)"
              style={styles.input}
            />
            <button
              type="button"
              onClick={() => {
                setAddingVenue(false);
                setNewVenueName('');
                setNewVenueCity('');
              }}
              style={styles.ghostBtn}
            >
              Cancel new venue
            </button>
          </div>
        ) : (
          <>
            <div style={styles.chipRow}>
              {venues.map((v) => {
                const active = v.id === venueId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setVenueId(v.id);
                      setVenueName(v.name);
                    }}
                    style={{
                      ...styles.chip,
                      ...(active ? styles.chipActive : {}),
                    }}
                  >
                    {v.name}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setAddingVenue(true)}
                style={styles.addChip}
              >
                + New venue
              </button>
            </div>
            <input
              type="text"
              value={venueName}
              onChange={(e) => {
                setVenueName(e.target.value);
                setVenueId(null);
              }}
              placeholder="Or type a venue name"
              style={styles.input}
            />
          </>
        )}
      </Field>

      {isWatchParty ? null : (
        <Field label="Seat (optional)">
          <div style={styles.rowInline}>
            <input
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="Section"
              style={{ ...styles.input, flex: 1 }}
            />
            <input
              type="text"
              value={rowLabel}
              onChange={(e) => setRowLabel(e.target.value)}
              placeholder="Row"
              style={{ ...styles.input, flex: 1 }}
            />
            <input
              type="text"
              value={seat}
              onChange={(e) => setSeat(e.target.value)}
              placeholder="Seat"
              style={{ ...styles.input, flex: 1 }}
            />
          </div>
        </Field>
      )}

      <Field label="Companions (optional)">
        <div style={styles.rowInline}>
          <input
            type="text"
            value={companionDraft}
            onChange={(e) => setCompanionDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCompanion();
              }
            }}
            placeholder="Add a name + press Enter"
            style={{ ...styles.input, flex: 1 }}
          />
          <button
            type="button"
            onClick={addCompanion}
            style={styles.addBtn}
          >
            Add
          </button>
        </div>
        {companions.length > 0 ? (
          <div style={styles.chipRow}>
            {companions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => removeCompanion(name)}
                style={styles.companionChip}
              >
                {name} ×
              </button>
            ))}
          </div>
        ) : null}
      </Field>

      <Field label="Cost (USD, optional)">
        <input
          type="text"
          inputMode="decimal"
          value={costDollars}
          onChange={(e) => setCostDollars(e.target.value)}
          placeholder="0.00"
          style={styles.input}
        />
      </Field>

      <Field label="Rating">
        <div style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => {
            const active = rating !== null && n <= rating;
            return (
              <button
                key={n}
                type="button"
                onClick={() =>
                  setRating((prev) =>
                    prev === n ? null : (n as StarRating),
                  )
                }
                style={styles.starBtn}
              >
                <span
                  style={{
                    ...styles.star,
                    ...(active ? styles.starActive : {}),
                  }}
                >
                  {active ? '★' : '☆'}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Attended at">
        <input
          type="datetime-local"
          value={toDatetimeLocal(attendedAt)}
          onChange={(e) => setAttendedAt(parseDatetimeLocal(e.target.value))}
          style={styles.input}
        />
      </Field>

      <Field label="Tailgate notes (optional)">
        <textarea
          value={tailgate}
          onChange={(e) => setTailgate(e.target.value)}
          rows={3}
          placeholder="Food, drinks, who hosted…"
          style={styles.textarea}
        />
      </Field>

      {isWatchParty ? null : (
        <Field label="Parking notes (optional)">
          <textarea
            value={parking}
            onChange={(e) => setParking(e.target.value)}
            rows={3}
            placeholder="Where you parked, cost, walk time…"
            style={styles.textarea}
          />
        </Field>
      )}

      <Field label="General notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="How did it go? Memorable plays, weather…"
          style={styles.textarea}
        />
      </Field>

      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.actionRow}>
        <button
          type="button"
          onClick={() => router.back()}
          style={styles.secondaryBtn}
          disabled={isPending}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={styles.primaryBtn}
          disabled={isPending || !canSave}
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 14 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: SPORTS_ACCENT,
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--text)',
  },
  field: { display: 'grid', gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  input: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
  },
  textarea: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  rowInline: { display: 'flex', gap: 8, alignItems: 'center' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  chipActive: {
    background: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
    color: '#0E0E13',
  },
  addChip: {
    padding: '8px 12px',
    borderRadius: 999,
    border: `1px solid ${SPORTS_ACCENT}`,
    background: 'var(--surface)',
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  companionChip: {
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 13,
    cursor: 'pointer',
  },
  newVenueCard: {
    display: 'grid',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  ghostBtn: {
    alignSelf: 'flex-start',
    padding: '8px 12px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  addBtn: {
    padding: '10px 14px',
    borderRadius: 10,
    border: 'none',
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  starsRow: { display: 'flex', gap: 6 },
  starBtn: {
    padding: 4,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  star: {
    fontSize: 28,
    color: 'var(--text-secondary)',
  },
  starActive: {
    color: SPORTS_ACCENT,
  },
  error: { margin: 0, color: '#F87171', fontSize: 13 },
  actionRow: { display: 'flex', gap: 10, marginTop: 6 },
  primaryBtn: {
    flex: 1,
    padding: '12px 18px',
    borderRadius: 12,
    border: 'none',
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1,
    padding: '12px 18px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
};
