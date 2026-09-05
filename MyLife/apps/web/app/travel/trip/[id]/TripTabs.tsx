'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  ActivityRow,
  BookingRow,
  BookingType,
  ItineraryDayRow,
  PackingListRow,
  PackingTemplateKey,
} from '@mylife/travel';
import {
  createActivityAction,
  createBookingAction,
  createDayAction,
  createPackingListAction,
  createPackingListFromTemplateAction,
  deleteActivityAction,
  deleteBookingAction,
  deleteDayAction,
  deletePackingListAction,
  updateBookingAction,
  type MutationResult,
} from '../../actions';

type Tab = 'itinerary' | 'bookings' | 'packing' | 'notes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'packing', label: 'Packing' },
  { id: 'notes', label: 'Notes' },
];

const PLACEHOLDER_COPY: Record<
  'notes',
  { title: string; body: string }
> = {
  notes: {
    title: 'Notes coming soon',
    body: 'Free-form trip notes and journal entries will land here.',
  },
};

export interface PackingListSummary {
  list: PackingListRow;
  total: number;
  packed: number;
}

interface TripTabsProps {
  tripId: string;
  days: ItineraryDayRow[];
  activitiesByDay: Record<string, ActivityRow[]>;
  itineraryError: string | null;
  bookings: BookingRow[];
  upcomingBookings: BookingRow[];
  bookingsError: string | null;
  packingLists: PackingListSummary[];
  packingError: string | null;
}

export function TripTabs({
  tripId,
  days,
  activitiesByDay,
  itineraryError,
  bookings,
  upcomingBookings,
  bookingsError,
  packingLists,
  packingError,
}: TripTabsProps) {
  const [tab, setTab] = useState<Tab>('itinerary');

  return (
    <section style={styles.wrapper}>
      <div style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{ ...styles.tab, ...(active ? styles.tabActive : null) }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'itinerary' ? (
        <ItineraryTab
          tripId={tripId}
          days={days}
          activitiesByDay={activitiesByDay}
          error={itineraryError}
        />
      ) : tab === 'bookings' ? (
        <BookingsTab
          tripId={tripId}
          bookings={bookings}
          upcoming={upcomingBookings}
          error={bookingsError}
        />
      ) : tab === 'packing' ? (
        <PackingTab
          tripId={tripId}
          summaries={packingLists}
          error={packingError}
        />
      ) : (
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>{PLACEHOLDER_COPY[tab].title}</h3>
          <p style={styles.panelBody}>{PLACEHOLDER_COPY[tab].body}</p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Packing tab (P5-B)
// ---------------------------------------------------------------------------

const PACKING_TEMPLATE_KEYS: PackingTemplateKey[] = [
  'weekend',
  'beach',
  'ski',
  'business',
  'backpacking',
];

const PACKING_TEMPLATE_LABELS: Record<PackingTemplateKey, string> = {
  weekend: 'Weekend',
  beach: 'Beach',
  ski: 'Ski',
  business: 'Business',
  backpacking: 'Backpacking',
};

function PackingTab({
  tripId,
  summaries,
  error,
}: {
  tripId: string;
  summaries: PackingListSummary[];
  error: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function run(
    fn: () => Promise<MutationResult & { listId?: string }>,
    onSuccess?: (result: MutationResult & { listId?: string }) => void,
  ) {
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          setFormError(result.error ?? 'Something went wrong.');
          return;
        }
        setFormError(null);
        onSuccess?.(result);
        router.refresh();
      } catch {
        setFormError('Unexpected error. Please try again.');
      }
    });
  }

  function handleCreateBlank(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    run(
      () => createPackingListAction(tripId, fd),
      (result) => {
        form.reset();
        setShowNew(false);
        if (result.listId) {
          router.push(`/travel/trip/${tripId}/packing/${result.listId}`);
        }
      },
    );
  }

  function handleFromTemplate(key: PackingTemplateKey) {
    run(
      () => createPackingListFromTemplateAction(tripId, key),
      (result) => {
        setShowTemplates(false);
        if (result.listId) {
          router.push(`/travel/trip/${tripId}/packing/${result.listId}`);
        }
      },
    );
  }

  function handleDelete(listId: string) {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Delete this packing list?');
      if (!ok) return;
    }
    run(() => deletePackingListAction(listId));
  }

  if (error) {
    return (
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Could not load packing lists</h3>
        <p style={styles.panelBody}>{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.itineraryWrap}>
      {summaries.length === 0 ? (
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>No packing lists yet</h3>
          <p style={styles.panelBody}>
            Create a blank list or seed one from a template like Weekend, Beach,
            Ski, Business, or Backpacking.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {summaries.map(({ list, total, packed }) => {
            const pct = total === 0 ? 0 : Math.round((packed / total) * 100);
            return (
              <div key={list.id} style={styles.bookingCard}>
                <span style={styles.bookingIcon}>🎒</span>
                <Link
                  href={`/travel/trip/${tripId}/packing/${list.id}`}
                  style={{ ...styles.bookingBody, textDecoration: 'none' }}
                >
                  <span style={styles.bookingProvider}>{list.name}</span>
                  <span style={styles.bookingMeta}>
                    {packed} / {total} packed · {pct}%
                  </span>
                  <span style={styles.progressTrack}>
                    <span
                      style={{ ...styles.progressFill, width: `${pct}%` }}
                    />
                  </span>
                </Link>
                <button
                  type="button"
                  style={styles.deleteBtn}
                  onClick={() => handleDelete(list.id)}
                  disabled={isPending}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showTemplates ? (
        <div style={styles.inlineForm}>
          <span style={styles.label}>Pick a template</span>
          <div style={styles.filterRow}>
            {PACKING_TEMPLATE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                style={styles.filterChip}
                onClick={() => handleFromTemplate(key)}
                disabled={isPending}
              >
                {PACKING_TEMPLATE_LABELS[key]}
              </button>
            ))}
          </div>
          {formError ? <p style={styles.errorText}>{formError}</p> : null}
          <div style={styles.formActions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => {
                setShowTemplates(false);
                setFormError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {showNew ? (
        <form onSubmit={handleCreateBlank} style={styles.inlineForm}>
          <label style={styles.label} htmlFor="packing-new-name">
            List name
          </label>
          <input
            id="packing-new-name"
            name="name"
            placeholder="My packing list"
            style={styles.input}
            required
            autoComplete="off"
          />
          {formError ? <p style={styles.errorText}>{formError}</p> : null}
          <div style={styles.formActions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => {
                setShowNew(false);
                setFormError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.primaryButton}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Create list'}
            </button>
          </div>
        </form>
      ) : null}

      {!showNew && !showTemplates ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={styles.addDayButton}
            onClick={() => {
              setShowNew(true);
              setShowTemplates(false);
              setFormError(null);
            }}
          >
            + New list
          </button>
          <button
            type="button"
            style={styles.addDayButton}
            onClick={() => {
              setShowTemplates(true);
              setShowNew(false);
              setFormError(null);
            }}
          >
            + From template
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bookings tab (P1-E)
// ---------------------------------------------------------------------------

const BOOKING_TYPES: BookingType[] = [
  'flight',
  'hotel',
  'car',
  'train',
  'ferry',
  'tour',
  'other',
];

const BOOKING_ICONS: Record<BookingType, string> = {
  flight: '✈️',
  hotel: '🏨',
  car: '🚗',
  train: '🚆',
  ferry: '⛴️',
  tour: '🎟️',
  other: '📌',
};

type BookingFilter = 'all' | BookingType;
const BOOKING_FILTERS: BookingFilter[] = ['all', ...BOOKING_TYPES];

function formatCost(
  cents: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (cents == null) return null;
  if (currency && currency.length === 3) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      }).format(cents / 100);
    } catch {
      // fall through
    }
  }
  return `${(cents / 100).toFixed(2)}`;
}

function formatBookingDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}

function BookingsTab({
  tripId,
  bookings,
  upcoming,
  error,
}: {
  tripId: string;
  bookings: BookingRow[];
  upcoming: BookingRow[];
  error: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return bookings;
    return bookings.filter((b) => b.type === filter);
  }, [bookings, filter]);

  function run(fn: () => Promise<MutationResult>, onSuccess?: () => void) {
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          setFormError(result.error ?? 'Something went wrong.');
          return;
        }
        setFormError(null);
        onSuccess?.();
        router.refresh();
      } catch {
        setFormError('Unexpected error. Please try again.');
      }
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    // Normalize datetime-local to ISO-8601 strings.
    const startLocal = String(fd.get('start_ts_local') ?? '');
    const endLocal = String(fd.get('end_ts_local') ?? '');
    fd.set('start_ts', fromLocalInput(startLocal));
    fd.set('end_ts', endLocal ? fromLocalInput(endLocal) : '');

    if (editingId) {
      fd.set('id', editingId);
      fd.set('trip_id', tripId);
      run(() => updateBookingAction(fd), () => {
        form.reset();
        setShowAdd(false);
        setEditingId(null);
      });
    } else {
      fd.set('trip_id', tripId);
      run(() => createBookingAction(fd), () => {
        form.reset();
        setShowAdd(false);
      });
    }
  }

  function handleDelete(id: string) {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Delete this booking?');
      if (!ok) return;
    }
    const fd = new FormData();
    fd.set('id', id);
    fd.set('trip_id', tripId);
    run(() => deleteBookingAction(fd), () => {
      if (editingId === id) {
        setEditingId(null);
        setShowAdd(false);
      }
    });
  }

  function startEdit(b: BookingRow) {
    setEditingId(b.id);
    setShowAdd(true);
    setFormError(null);
  }

  const editingBooking = editingId
    ? bookings.find((b) => b.id === editingId) ?? null
    : null;

  if (error) {
    return (
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Could not load bookings</h3>
        <p style={styles.panelBody}>{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.itineraryWrap}>
      {upcoming.length > 0 ? (
        <div style={styles.upcomingStrip}>
          <span style={styles.upcomingEyebrow}>UPCOMING IN NEXT 30 DAYS</span>
          <div style={{ display: 'grid', gap: 4 }}>
            {upcoming.map((b) => (
              <span key={b.id} style={styles.upcomingRow}>
                {BOOKING_ICONS[b.type]} {b.provider} ·{' '}
                {formatBookingDate(b.start_ts)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div style={styles.filterRow}>
        {BOOKING_FILTERS.map((f) => {
          const active = f === filter;
          const label =
            f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1);
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterChip,
                ...(active ? styles.filterChipActive : null),
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>
            {bookings.length === 0 ? 'No bookings yet' : 'No matching bookings'}
          </h3>
          <p style={styles.panelBody}>
            {bookings.length === 0
              ? 'Add flights, hotels, cars, trains, or tours to keep everything in one place.'
              : 'Try a different filter or add a new booking.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((b) => {
            const cost = formatCost(b.cost_cents, b.currency);
            return (
              <div key={b.id} style={styles.bookingCard}>
                <span style={styles.bookingIcon}>{BOOKING_ICONS[b.type]}</span>
                <button
                  type="button"
                  style={styles.bookingBody}
                  onClick={() => startEdit(b)}
                  disabled={isPending}
                >
                  <span style={styles.bookingProvider}>{b.provider}</span>
                  <span style={styles.bookingMeta}>
                    {formatBookingDate(b.start_ts)}
                    {b.end_ts ? ` → ${formatBookingDate(b.end_ts)}` : ''}
                  </span>
                  {b.confirmation_code ? (
                    <span style={styles.bookingMeta}>
                      Confirmation: {b.confirmation_code}
                    </span>
                  ) : null}
                  {b.location ? (
                    <span style={styles.bookingMeta}>{b.location}</span>
                  ) : null}
                  {cost ? <span style={styles.bookingCost}>{cost}</span> : null}
                </button>
                <button
                  type="button"
                  style={styles.deleteBtn}
                  onClick={() => handleDelete(b.id)}
                  disabled={isPending}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!showAdd ? (
        <button
          type="button"
          style={styles.addDayButton}
          onClick={() => {
            setShowAdd(true);
            setEditingId(null);
            setFormError(null);
          }}
        >
          + Add booking
        </button>
      ) : (
        <form
          key={editingId ?? 'new'}
          onSubmit={handleSubmit}
          style={styles.inlineForm}
        >
          <label style={styles.label} htmlFor="booking-type">
            Type
          </label>
          <select
            id="booking-type"
            name="type"
            defaultValue={editingBooking?.type ?? 'flight'}
            style={styles.input}
          >
            {BOOKING_TYPES.map((t) => (
              <option key={t} value={t}>
                {BOOKING_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>

          <label style={styles.label} htmlFor="booking-provider">
            Provider
          </label>
          <input
            id="booking-provider"
            name="provider"
            defaultValue={editingBooking?.provider ?? ''}
            placeholder="Delta Airlines"
            style={styles.input}
            required
          />

          <label style={styles.label} htmlFor="booking-confirmation">
            Confirmation code (optional)
          </label>
          <input
            id="booking-confirmation"
            name="confirmation_code"
            defaultValue={editingBooking?.confirmation_code ?? ''}
            placeholder="ABC123"
            style={styles.input}
            autoComplete="off"
          />

          <label style={styles.label} htmlFor="booking-start">
            Start
          </label>
          <input
            id="booking-start"
            name="start_ts_local"
            type="datetime-local"
            defaultValue={toLocalInput(editingBooking?.start_ts)}
            style={styles.input}
            required
          />

          <label style={styles.label} htmlFor="booking-end">
            End (optional)
          </label>
          <input
            id="booking-end"
            name="end_ts_local"
            type="datetime-local"
            defaultValue={toLocalInput(editingBooking?.end_ts)}
            style={styles.input}
          />

          <label style={styles.label} htmlFor="booking-location">
            Location (optional)
          </label>
          <input
            id="booking-location"
            name="location"
            defaultValue={editingBooking?.location ?? ''}
            placeholder="JFK → CDG"
            style={styles.input}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={styles.label} htmlFor="booking-cost">
                Cost
              </label>
              <input
                id="booking-cost"
                name="cost"
                type="number"
                step="0.01"
                min="0"
                defaultValue={
                  editingBooking?.cost_cents != null
                    ? (editingBooking.cost_cents / 100).toFixed(2)
                    : ''
                }
                placeholder="1234.56"
                style={styles.input}
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={styles.label} htmlFor="booking-currency">
                Currency
              </label>
              <input
                id="booking-currency"
                name="currency"
                defaultValue={editingBooking?.currency ?? ''}
                placeholder="USD"
                maxLength={3}
                style={styles.input}
              />
            </div>
          </div>

          <label style={styles.label} htmlFor="booking-notes">
            Notes (optional)
          </label>
          <textarea
            id="booking-notes"
            name="notes"
            defaultValue={editingBooking?.notes ?? ''}
            placeholder="Seat 14A, window"
            style={{ ...styles.input, minHeight: 60 }}
          />

          {formError ? <p style={styles.errorText}>{formError}</p> : null}

          <div style={styles.formActions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => {
                setShowAdd(false);
                setEditingId(null);
                setFormError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.primaryButton}
              disabled={isPending}
            >
              {isPending
                ? 'Saving…'
                : editingId
                  ? 'Save changes'
                  : 'Save booking'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ItineraryTab({
  tripId,
  days,
  activitiesByDay,
  error,
}: {
  tripId: string;
  days: ItineraryDayRow[];
  activitiesByDay: Record<string, ActivityRow[]>;
  error: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddDay, setShowAddDay] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  function run(
    fn: () => Promise<MutationResult>,
    onSuccess?: () => void,
  ) {
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          setFormError(result.error ?? 'Something went wrong.');
          return;
        }
        setFormError(null);
        onSuccess?.();
        refresh();
      } catch {
        setFormError('Unexpected error. Please try again.');
      }
    });
  }

  function handleAddDaySubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    run(() => createDayAction(fd), () => {
      form.reset();
      setShowAddDay(false);
    });
  }

  function handleDeleteDay(dayId: string) {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Delete this day? Activities will be removed.');
      if (!ok) return;
    }
    const fd = new FormData();
    fd.set('trip_id', tripId);
    fd.set('day_id', dayId);
    run(() => deleteDayAction(fd), () => {
      if (expandedId === dayId) setExpandedId(null);
    });
  }

  if (error) {
    return (
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Could not load itinerary</h3>
        <p style={styles.panelBody}>{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.itineraryWrap}>
      {days.length === 0 ? (
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>No days yet</h3>
          <p style={styles.panelBody}>
            Start your itinerary by adding the first day.
          </p>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => setShowAddDay(true)}
            disabled={isPending}
          >
            + Add first day
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {days.map((day) => (
            <DayAccordion
              key={day.id}
              tripId={tripId}
              day={day}
              activities={activitiesByDay[day.id] ?? []}
              expanded={expandedId === day.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === day.id ? null : day.id))
              }
              onDelete={() => handleDeleteDay(day.id)}
              onMutate={refresh}
              setError={setFormError}
              isPending={isPending}
              run={run}
            />
          ))}
          <button
            type="button"
            style={styles.addDayButton}
            onClick={() => setShowAddDay((v) => !v)}
          >
            {showAddDay ? 'Close' : '+ Add day'}
          </button>
        </div>
      )}

      {showAddDay ? (
        <form onSubmit={handleAddDaySubmit} style={styles.inlineForm}>
          <input type="hidden" name="trip_id" value={tripId} />
          <label style={styles.label} htmlFor="day-date">
            Date (YYYY-MM-DD)
          </label>
          <input
            id="day-date"
            name="date"
            placeholder="2026-05-04"
            style={styles.input}
            autoComplete="off"
          />
          <label style={styles.label} htmlFor="day-location">
            Location (optional)
          </label>
          <input
            id="day-location"
            name="location"
            placeholder="City or area"
            style={styles.input}
            autoComplete="off"
          />
          {formError ? <p style={styles.errorText}>{formError}</p> : null}
          <div style={styles.formActions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => {
                setShowAddDay(false);
                setFormError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.primaryButton}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Save day'}
            </button>
          </div>
        </form>
      ) : null}

      {formError && !showAddDay ? (
        <p style={styles.errorText}>{formError}</p>
      ) : null}
    </div>
  );
}

function DayAccordion({
  tripId,
  day,
  activities,
  expanded,
  onToggle,
  onDelete,
  onMutate: _onMutate,
  setError,
  isPending,
  run,
}: {
  tripId: string;
  day: ItineraryDayRow;
  activities: ActivityRow[];
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onMutate: () => void;
  setError: (msg: string | null) => void;
  isPending: boolean;
  run: (fn: () => Promise<MutationResult>, onSuccess?: () => void) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);

  function handleAddActivity(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    run(() => createActivityAction(fd), () => {
      form.reset();
      setShowAdd(false);
    });
  }

  function handleDeleteActivity(activityId: string) {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Delete this activity?');
      if (!ok) return;
    }
    const fd = new FormData();
    fd.set('trip_id', tripId);
    fd.set('activity_id', activityId);
    run(() => deleteActivityAction(fd));
  }

  return (
    <div style={styles.dayCard}>
      <button
        type="button"
        style={styles.dayHeader}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div style={{ flex: 1, textAlign: 'left' }}>
          <span style={styles.dayEyebrow}>DAY {day.day_number}</span>
          <span style={styles.dayTitle}>
            {day.date ?? 'Date not set'}
            {day.location ? ` · ${day.location}` : ''}
          </span>
        </div>
        <span style={styles.dayChevron}>{expanded ? '−' : '+'}</span>
      </button>

      {expanded ? (
        <div style={styles.dayBody}>
          {activities.length === 0 ? (
            <p style={styles.panelBody}>No activities yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {activities.map((act) => (
                <div key={act.id} style={styles.activityRow}>
                  <div style={{ flex: 1 }}>
                    <span style={styles.activityTitle}>{act.title}</span>
                    <span style={styles.activityMeta}>
                      {[act.time, act.location].filter(Boolean).join(' · ') ||
                        'No time set'}
                    </span>
                  </div>
                  <button
                    type="button"
                    style={styles.deleteBtn}
                    onClick={() => handleDeleteActivity(act.id)}
                    disabled={isPending}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAdd ? (
            <form onSubmit={handleAddActivity} style={styles.inlineForm}>
              <input type="hidden" name="trip_id" value={tripId} />
              <input type="hidden" name="day_id" value={day.id} />
              <label style={styles.label}>Title</label>
              <input
                name="title"
                placeholder="Visit the Louvre"
                style={styles.input}
                required
                autoComplete="off"
              />
              <label style={styles.label}>Time (optional)</label>
              <input
                name="time"
                placeholder="09:30"
                style={styles.input}
                autoComplete="off"
              />
              <label style={styles.label}>Location (optional)</label>
              <input
                name="location"
                placeholder="Paris"
                style={styles.input}
                autoComplete="off"
              />
              <div style={styles.formActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => {
                    setShowAdd(false);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={isPending}
                >
                  {isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              style={styles.addActivityButton}
              onClick={() => setShowAdd(true)}
            >
              + Add activity
            </button>
          )}

          <button
            type="button"
            style={{ ...styles.secondaryButton, ...styles.dangerButton }}
            onClick={onDelete}
            disabled={isPending}
          >
            Delete day
          </button>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'grid',
    gap: 12,
  },
  tabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  tab: {
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text-secondary)',
    borderRadius: 999,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  tabActive: {
    background: '#0EA5E9',
    borderColor: '#0EA5E9',
    color: '#0E0E13',
  },
  panel: {
    display: 'grid',
    gap: 8,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  panelTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--text)',
  },
  panelBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  itineraryWrap: {
    display: 'grid',
    gap: 12,
  },
  dayCard: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  dayHeader: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: 16,
    gap: 12,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text)',
  },
  dayEyebrow: {
    display: 'block',
    color: '#0EA5E9',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
  },
  dayTitle: {
    display: 'block',
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 700,
    marginTop: 2,
  },
  dayChevron: {
    color: 'var(--text-secondary)',
    fontSize: 22,
    fontWeight: 600,
    paddingInline: 6,
  },
  dayBody: {
    padding: 16,
    display: 'grid',
    gap: 12,
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  activityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  activityTitle: {
    display: 'block',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
  },
  activityMeta: {
    display: 'block',
    color: 'var(--text-secondary)',
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid rgba(255,180,171,0.3)',
    background: 'transparent',
    color: '#FFB4AB',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  addActivityButton: {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px dashed rgba(255,255,255,0.2)',
    background: 'transparent',
    color: '#0EA5E9',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  addDayButton: {
    padding: '14px 18px',
    borderRadius: 16,
    border: '1px dashed rgba(255,255,255,0.2)',
    background: 'transparent',
    color: '#0EA5E9',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  inlineForm: {
    display: 'grid',
    gap: 8,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  input: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    fontSize: 14,
  },
  errorText: {
    margin: 0,
    color: '#FFB4AB',
    fontSize: 13,
  },
  primaryButton: {
    justifySelf: 'start',
    padding: '10px 16px',
    borderRadius: 12,
    border: 'none',
    background: '#0EA5E9',
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryButton: {
    justifySelf: 'start',
    padding: '10px 16px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  dangerButton: {
    border: '1px solid rgba(255,180,171,0.3)',
    background: 'rgba(255,180,171,0.08)',
    color: '#FFB4AB',
  },
  formActions: {
    display: 'flex',
    gap: 10,
    marginTop: 4,
  },
  upcomingStrip: {
    display: 'grid',
    gap: 8,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(14,165,233,0.24)',
    background: 'rgba(14,165,233,0.08)',
  },
  upcomingEyebrow: {
    color: '#0EA5E9',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
  },
  upcomingRow: {
    color: 'var(--text)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  filterChipActive: {
    background: '#0EA5E9',
    borderColor: '#0EA5E9',
    color: '#0E0E13',
  },
  bookingCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  bookingIcon: {
    fontSize: 22,
    lineHeight: 1.2,
    marginTop: 2,
  },
  bookingBody: {
    flex: 1,
    display: 'grid',
    gap: 2,
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    textAlign: 'left',
    padding: 0,
  },
  bookingProvider: {
    display: 'block',
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 700,
  },
  bookingMeta: {
    display: 'block',
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.4,
  },
  bookingCost: {
    display: 'block',
    color: '#0EA5E9',
    fontSize: 13,
    fontWeight: 700,
    marginTop: 2,
  },
  progressTrack: {
    display: 'block',
    position: 'relative',
    height: 6,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    display: 'block',
    height: '100%',
    background: '#0EA5E9',
  },
};
