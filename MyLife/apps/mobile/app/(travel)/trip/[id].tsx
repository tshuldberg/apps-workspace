import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { DatabaseAdapter } from '@mylife/db';
import {
  ActivityInsertSchema,
  BookingInputSchema,
  BookingUpdateSchema,
  createActivity,
  createBooking,
  createDay,
  createListFromTemplate,
  createPackingList,
  deleteActivity,
  deleteBooking,
  deleteDay,
  deletePackingList,
  getTripById,
  ItineraryDayInsertSchema,
  listActivitiesByDay,
  listBookings,
  listDaysByTrip,
  listPackingItems,
  listPackingListsByTrip,
  listUpcomingBookings,
  PACKING_TEMPLATES,
  PackingListInputSchema,
  updateBooking,
  type ActivityRow,
  type BookingInput,
  type BookingRow,
  type BookingType,
  type BookingUpdate,
  type ItineraryDayRow,
  type PackingListRow,
  type PackingTemplateKey,
  type TripRow,
} from '@mylife/travel';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from '../_ui';

type Tab = 'itinerary' | 'bookings' | 'packing' | 'notes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'packing', label: 'Packing' },
  { id: 'notes', label: 'Notes' },
];

function parseDestinations(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'Dates not set';
  if (start && end) return `${start} to ${end}`;
  return start ?? end ?? 'Dates not set';
}

export default function TripDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const tripId = typeof params.id === 'string' ? params.id : null;

  const [trip, setTrip] = useState<TripRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('itinerary');

  useEffect(() => {
    if (!tripId) {
      setError('Missing trip id.');
      setLoading(false);
      return;
    }
    try {
      const row = getTripById(db, tripId);
      if (!row) {
        setError('Trip not found.');
      } else {
        setTrip(row);
      }
    } catch {
      setError('Failed to load trip.');
    } finally {
      setLoading(false);
    }
  }, [db, tripId]);

  const destinations = useMemo(
    () => parseDestinations(trip?.destination_ids ?? null),
    [trip?.destination_ids],
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={TRAVEL_ACCENT} />
      </View>
    );
  }

  if (error || !trip) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.errorTitle}>Could not load trip</Text>
        <Text style={styles.errorBody}>{error ?? 'Unknown error.'}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{trip.status.toUpperCase()}</Text>
        <Text style={styles.title}>{trip.name}</Text>
        <Text style={styles.meta}>
          {destinations.length > 0 ? destinations.join(', ') : 'Destination not set'}
        </Text>
        <Text style={styles.meta}>
          {formatDateRange(trip.start_date, trip.end_date)}
        </Text>
        {trip.trip_type ? (
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText}>{trip.trip_type.replace('_', ' ')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'itinerary' ? (
        <ItineraryPanel db={db} tripId={trip.id} />
      ) : tab === 'bookings' ? (
        <BookingsPanel db={db} tripId={trip.id} />
      ) : tab === 'packing' ? (
        <PackingPanel db={db} tripId={trip.id} />
      ) : (
        <View style={styles.panel}>
          <PlaceholderPanel tab={tab} />
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Packing panel (P5-B)
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

interface PackingListSummary {
  list: PackingListRow;
  total: number;
  packed: number;
}

function PackingPanel({
  db,
  tripId,
}: {
  db: DatabaseAdapter;
  tripId: string;
}) {
  const router = useRouter();
  const [summaries, setSummaries] = useState<PackingListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newError, setNewError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const reload = useCallback(() => {
    try {
      setLoadError(null);
      const lists = listPackingListsByTrip(db, tripId);
      const next: PackingListSummary[] = lists.map((list) => {
        const items = listPackingItems(db, { listId: list.id });
        const packed = items.filter((i) => i.packed === 1).length;
        return { list, total: items.length, packed };
      });
      setSummaries(next);
    } catch {
      setLoadError('Failed to load packing lists.');
    } finally {
      setLoading(false);
    }
  }, [db, tripId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleCreateBlank = useCallback(() => {
    const name = newName.trim();
    const candidate = { trip_id: tripId, name, template: false };
    const parsed = PackingListInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setNewError(parsed.error.issues[0]?.message ?? 'Invalid list name.');
      return;
    }
    try {
      const created = createPackingList(db, parsed.data);
      setNewName('');
      setNewError(null);
      setShowNew(false);
      reload();
      router.push(`/(travel)/trip/${tripId}/packing/${created.id}`);
    } catch {
      setNewError('Could not create list.');
    }
  }, [db, newName, reload, router, tripId]);

  const handleCreateFromTemplate = useCallback(
    (key: PackingTemplateKey) => {
      try {
        const created = createListFromTemplate(db, tripId, key);
        setTemplateError(null);
        setShowTemplates(false);
        reload();
        router.push(`/(travel)/trip/${tripId}/packing/${created.id}`);
      } catch {
        setTemplateError('Could not seed template.');
      }
    },
    [db, reload, router, tripId],
  );

  const handleDelete = useCallback(
    (listId: string) => {
      Alert.alert('Delete this packing list?', 'All items on it will be removed.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deletePackingList(db, listId);
              reload();
            } catch {
              Alert.alert('Could not delete list.');
            }
          },
        },
      ]);
    },
    [db, reload],
  );

  if (loading) {
    return (
      <View style={[styles.panel, styles.center]}>
        <ActivityIndicator color={TRAVEL_ACCENT} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.panel}>
        <Text style={styles.errorTitle}>{loadError}</Text>
        <Pressable style={styles.secondaryButton} onPress={reload}>
          <Text style={styles.secondaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.itineraryWrap}>
      {summaries.length === 0 ? (
        <View style={styles.panel}>
          <Text style={styles.placeholderTitle}>No packing lists yet</Text>
          <Text style={styles.placeholderBody}>
            Create a blank list or seed one from a template like Weekend, Beach,
            Ski, Business, or Backpacking.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {summaries.map(({ list, total, packed }) => {
            const pct = total === 0 ? 0 : Math.round((packed / total) * 100);
            return (
              <Pressable
                key={list.id}
                style={styles.bookingCard}
                onPress={() =>
                  router.push(`/(travel)/trip/${tripId}/packing/${list.id}`)
                }
              >
                <Text style={styles.bookingIcon}>🎒</Text>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.bookingProvider}>{list.name}</Text>
                  <Text style={styles.bookingMeta}>
                    {packed} / {total} packed · {pct}%
                  </Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${pct}%` },
                      ]}
                    />
                  </View>
                </View>
                <Pressable
                  onPress={() => handleDelete(list.id)}
                  hitSlop={8}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      )}

      {showTemplates ? (
        <View style={styles.inlineForm}>
          <Text style={styles.formLabel}>Pick a template</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {PACKING_TEMPLATE_KEYS.map((key) => (
              <Pressable
                key={key}
                style={styles.filterChip}
                onPress={() => handleCreateFromTemplate(key)}
              >
                <Text style={styles.filterChipText}>
                  {PACKING_TEMPLATE_LABELS[key]} ({PACKING_TEMPLATES[key].length})
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {templateError ? (
            <Text style={styles.formError}>{templateError}</Text>
          ) : null}
          <View style={styles.formActions}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setShowTemplates(false);
                setTemplateError(null);
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showNew ? (
        <View style={styles.inlineForm}>
          <Text style={styles.formLabel}>List name</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="My packing list"
            placeholderTextColor={colors.textSecondary}
            style={styles.formInput}
          />
          {newError ? <Text style={styles.formError}>{newError}</Text> : null}
          <View style={styles.formActions}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setShowNew(false);
                setNewError(null);
                setNewName('');
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleCreateBlank}>
              <Text style={styles.primaryButtonText}>Create list</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!showNew && !showTemplates ? (
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Pressable
            style={styles.addDayButton}
            onPress={() => {
              setShowNew(true);
              setShowTemplates(false);
            }}
          >
            <Text style={styles.addDayButtonText}>+ New list</Text>
          </Pressable>
          <Pressable
            style={styles.addDayButton}
            onPress={() => {
              setShowTemplates(true);
              setShowNew(false);
            }}
          >
            <Text style={styles.addDayButtonText}>+ From template</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function PlaceholderPanel({ tab }: { tab: 'notes' }) {
  const copy: Record<'notes', { title: string; body: string }> = {
    notes: {
      title: 'Notes coming soon',
      body: 'Free-form trip notes and journal entries will land here.',
    },
  };
  const { title, body } = copy[tab];
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderBody}>{body}</Text>
    </View>
  );
}

function ItineraryPanel({
  db,
  tripId,
}: {
  db: DatabaseAdapter;
  tripId: string;
}) {
  const [days, setDays] = useState<ItineraryDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddDay, setShowAddDay] = useState(false);
  const [newDayDate, setNewDayDate] = useState('');
  const [newDayLocation, setNewDayLocation] = useState('');
  const [addDayError, setAddDayError] = useState<string | null>(null);

  const reload = useCallback(() => {
    try {
      setLoadError(null);
      setDays(listDaysByTrip(db, tripId));
    } catch {
      setLoadError('Failed to load itinerary.');
    } finally {
      setLoading(false);
    }
  }, [db, tripId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleAddDay = useCallback(() => {
    const nextNumber = days.length + 1;
    const candidate = {
      trip_id: tripId,
      day_number: nextNumber,
      date: newDayDate.trim() || undefined,
      location: newDayLocation.trim() || undefined,
    };
    const parsed = ItineraryDayInsertSchema.safeParse(candidate);
    if (!parsed.success) {
      setAddDayError(parsed.error.issues[0]?.message ?? 'Invalid day.');
      return;
    }
    try {
      createDay(db, parsed.data);
      setNewDayDate('');
      setNewDayLocation('');
      setAddDayError(null);
      setShowAddDay(false);
      reload();
    } catch {
      setAddDayError('Could not save day.');
    }
  }, [db, days.length, newDayDate, newDayLocation, reload, tripId]);

  const handleDeleteDay = useCallback(
    (dayId: string) => {
      Alert.alert('Delete this day?', 'Activities on this day will be removed.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteDay(db, dayId);
              if (expandedId === dayId) setExpandedId(null);
              reload();
            } catch {
              Alert.alert('Could not delete day.');
            }
          },
        },
      ]);
    },
    [db, expandedId, reload],
  );

  if (loading) {
    return (
      <View style={[styles.panel, styles.center]}>
        <ActivityIndicator color={TRAVEL_ACCENT} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.panel}>
        <Text style={styles.errorTitle}>{loadError}</Text>
        <Pressable style={styles.secondaryButton} onPress={reload}>
          <Text style={styles.secondaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.itineraryWrap}>
      {days.length === 0 ? (
        <View style={styles.panel}>
          <Text style={styles.placeholderTitle}>No days yet</Text>
          <Text style={styles.placeholderBody}>
            Start your itinerary by adding the first day.
          </Text>
          <Pressable
            style={[styles.primaryButton, { marginTop: 8 }]}
            onPress={() => setShowAddDay(true)}
          >
            <Text style={styles.primaryButtonText}>+ Add first day</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {days.map((day) => (
            <DayAccordion
              key={day.id}
              db={db}
              day={day}
              tripId={tripId}
              expanded={expandedId === day.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === day.id ? null : day.id))
              }
              onDelete={() => handleDeleteDay(day.id)}
            />
          ))}
          <Pressable
            style={styles.addDayButton}
            onPress={() => setShowAddDay(true)}
          >
            <Text style={styles.addDayButtonText}>+ Add day</Text>
          </Pressable>
        </View>
      )}

      {showAddDay ? (
        <View style={styles.inlineForm}>
          <Text style={styles.formLabel}>Date (YYYY-MM-DD)</Text>
          <TextInput
            value={newDayDate}
            onChangeText={setNewDayDate}
            placeholder="2026-05-04"
            placeholderTextColor={colors.textSecondary}
            style={styles.formInput}
            autoCapitalize="none"
          />
          <Text style={styles.formLabel}>Location (optional)</Text>
          <TextInput
            value={newDayLocation}
            onChangeText={setNewDayLocation}
            placeholder="City or area"
            placeholderTextColor={colors.textSecondary}
            style={styles.formInput}
          />
          {addDayError ? (
            <Text style={styles.formError}>{addDayError}</Text>
          ) : null}
          <View style={styles.formActions}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setShowAddDay(false);
                setAddDayError(null);
                setNewDayDate('');
                setNewDayLocation('');
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleAddDay}>
              <Text style={styles.primaryButtonText}>Save day</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function DayAccordion({
  db,
  day,
  tripId,
  expanded,
  onToggle,
  onDelete,
}: {
  db: DatabaseAdapter;
  day: ItineraryDayRow;
  tripId: string;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [actError, setActError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(() => {
    try {
      setActError(null);
      setActivities(listActivitiesByDay(db, day.id));
    } catch {
      setActError('Failed to load activities.');
    }
  }, [db, day.id]);

  useEffect(() => {
    if (expanded) reload();
  }, [expanded, reload]);

  const handleAdd = useCallback(() => {
    const candidate = {
      trip_id: tripId,
      day_id: day.id,
      title: newTitle.trim(),
      time: newTime.trim() || undefined,
      location: newLocation.trim() || undefined,
    };
    const parsed = ActivityInsertSchema.safeParse(candidate);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Invalid activity.');
      return;
    }
    try {
      createActivity(db, parsed.data);
      setNewTitle('');
      setNewTime('');
      setNewLocation('');
      setFormError(null);
      setShowAdd(false);
      reload();
    } catch {
      setFormError('Could not save activity.');
    }
  }, [db, day.id, newLocation, newTime, newTitle, reload, tripId]);

  const handleDeleteActivity = useCallback(
    (activityId: string) => {
      Alert.alert('Delete this activity?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteActivity(db, activityId);
              reload();
            } catch {
              Alert.alert('Could not delete activity.');
            }
          },
        },
      ]);
    },
    [db, reload],
  );

  return (
    <View style={styles.dayCard}>
      <Pressable style={styles.dayHeader} onPress={onToggle}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dayEyebrow}>DAY {day.day_number}</Text>
          <Text style={styles.dayTitle}>
            {day.date ?? 'Date not set'}
            {day.location ? ` · ${day.location}` : ''}
          </Text>
        </View>
        <Text style={styles.dayChevron}>{expanded ? '−' : '+'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.dayBody}>
          {actError ? (
            <Text style={styles.formError}>{actError}</Text>
          ) : activities.length === 0 ? (
            <Text style={styles.placeholderBody}>No activities yet.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {activities.map((act) => (
                <View key={act.id} style={styles.activityRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>{act.title}</Text>
                    <Text style={styles.activityMeta}>
                      {[act.time, act.location].filter(Boolean).join(' · ') ||
                        'No time set'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleDeleteActivity(act.id)}
                    style={styles.deleteBtn}
                  >
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {showAdd ? (
            <View style={styles.inlineForm}>
              <Text style={styles.formLabel}>Title</Text>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Visit the Louvre"
                placeholderTextColor={colors.textSecondary}
                style={styles.formInput}
              />
              <Text style={styles.formLabel}>Time (optional)</Text>
              <TextInput
                value={newTime}
                onChangeText={setNewTime}
                placeholder="09:30"
                placeholderTextColor={colors.textSecondary}
                style={styles.formInput}
                autoCapitalize="none"
              />
              <Text style={styles.formLabel}>Location (optional)</Text>
              <TextInput
                value={newLocation}
                onChangeText={setNewLocation}
                placeholder="Paris"
                placeholderTextColor={colors.textSecondary}
                style={styles.formInput}
              />
              {formError ? (
                <Text style={styles.formError}>{formError}</Text>
              ) : null}
              <View style={styles.formActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    setShowAdd(false);
                    setFormError(null);
                    setNewTitle('');
                    setNewTime('');
                    setNewLocation('');
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={handleAdd}>
                  <Text style={styles.primaryButtonText}>Save</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={styles.addActivityButton}
              onPress={() => setShowAdd(true)}
            >
              <Text style={styles.addActivityButtonText}>+ Add activity</Text>
            </Pressable>
          )}

          <Pressable
            onPress={onDelete}
            style={[styles.secondaryButton, styles.dangerButton]}
          >
            <Text style={[styles.secondaryButtonText, styles.dangerButtonText]}>
              Delete day
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bookings panel (P1-E)
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

interface BookingFormFields {
  type: BookingType;
  provider: string;
  confirmation_code: string;
  start_ts: string;
  end_ts: string;
  location: string;
  cost: string;
  currency: string;
  notes: string;
}

function emptyBookingForm(): BookingFormFields {
  return {
    type: 'flight',
    provider: '',
    confirmation_code: '',
    start_ts: '',
    end_ts: '',
    location: '',
    cost: '',
    currency: '',
    notes: '',
  };
}

function bookingToForm(b: BookingRow): BookingFormFields {
  return {
    type: b.type,
    provider: b.provider,
    confirmation_code: b.confirmation_code ?? '',
    start_ts: b.start_ts,
    end_ts: b.end_ts ?? '',
    location: b.location ?? '',
    cost: b.cost_cents != null ? (b.cost_cents / 100).toFixed(2) : '',
    currency: b.currency ?? '',
    notes: b.notes ?? '',
  };
}

function BookingsPanel({
  db,
  tripId,
}: {
  db: DatabaseAdapter;
  tripId: string;
}) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [upcoming, setUpcoming] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BookingFormFields>(emptyBookingForm());
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(() => {
    try {
      setLoadError(null);
      setBookings(listBookings(db, { tripId }));
      setUpcoming(listUpcomingBookings(db, { tripId, withinDays: 30 }));
    } catch {
      setLoadError('Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  }, [db, tripId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    if (filter === 'all') return bookings;
    return bookings.filter((b) => b.type === filter);
  }, [bookings, filter]);

  const resetForm = useCallback(() => {
    setForm(emptyBookingForm());
    setFormError(null);
    setEditingId(null);
    setShowAdd(false);
  }, []);

  const handleSave = useCallback(() => {
    const costStr = form.cost.trim();
    const costNum = costStr ? Number(costStr) : undefined;
    if (costStr && (costNum === undefined || !Number.isFinite(costNum) || costNum < 0)) {
      setFormError('Cost must be a non-negative number.');
      return;
    }
    const costCents =
      costNum !== undefined ? Math.round(costNum * 100) : undefined;

    if (editingId) {
      const patch: BookingUpdate = {
        type: form.type,
        provider: form.provider.trim(),
        confirmation_code: form.confirmation_code.trim() || undefined,
        start_ts: form.start_ts.trim(),
        end_ts: form.end_ts.trim() || undefined,
        location: form.location.trim() || undefined,
        cost_cents: costCents,
        currency: form.currency.trim().toUpperCase() || undefined,
        notes: form.notes.trim() || undefined,
      };
      const parsed = BookingUpdateSchema.safeParse(patch);
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? 'Invalid booking.');
        return;
      }
      try {
        updateBooking(db, editingId, parsed.data);
      } catch {
        setFormError('Could not save booking.');
        return;
      }
    } else {
      const candidate: BookingInput = {
        trip_id: tripId,
        type: form.type,
        provider: form.provider.trim(),
        confirmation_code: form.confirmation_code.trim() || undefined,
        start_ts: form.start_ts.trim(),
        end_ts: form.end_ts.trim() || undefined,
        location: form.location.trim() || undefined,
        cost_cents: costCents,
        currency: form.currency.trim().toUpperCase() || undefined,
        notes: form.notes.trim() || undefined,
      };
      const parsed = BookingInputSchema.safeParse(candidate);
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? 'Invalid booking.');
        return;
      }
      try {
        createBooking(db, parsed.data);
      } catch {
        setFormError('Could not save booking.');
        return;
      }
    }

    resetForm();
    reload();
  }, [db, editingId, form, reload, resetForm, tripId]);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert('Delete this booking?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteBooking(db, id);
              if (editingId === id) resetForm();
              reload();
            } catch {
              Alert.alert('Could not delete booking.');
            }
          },
        },
      ]);
    },
    [db, editingId, reload, resetForm],
  );

  const startEdit = useCallback((b: BookingRow) => {
    setEditingId(b.id);
    setForm(bookingToForm(b));
    setFormError(null);
    setShowAdd(true);
  }, []);

  if (loading) {
    return (
      <View style={[styles.panel, styles.center]}>
        <ActivityIndicator color={TRAVEL_ACCENT} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.panel}>
        <Text style={styles.errorTitle}>{loadError}</Text>
        <Pressable style={styles.secondaryButton} onPress={reload}>
          <Text style={styles.secondaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.itineraryWrap}>
      {upcoming.length > 0 ? (
        <View style={styles.upcomingStrip}>
          <Text style={styles.upcomingEyebrow}>UPCOMING IN NEXT 30 DAYS</Text>
          <View style={{ gap: 6 }}>
            {upcoming.map((b) => (
              <Text key={b.id} style={styles.upcomingRow}>
                {BOOKING_ICONS[b.type]} {b.provider} · {formatBookingDate(b.start_ts)}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {BOOKING_FILTERS.map((f) => {
          const active = f === filter;
          const label = f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1);
          return (
            <Pressable
              key={f}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.panel}>
          <Text style={styles.placeholderTitle}>
            {bookings.length === 0 ? 'No bookings yet' : 'No matching bookings'}
          </Text>
          <Text style={styles.placeholderBody}>
            {bookings.length === 0
              ? 'Add flights, hotels, cars, trains, or tours to keep everything in one place.'
              : 'Try a different filter or add a new booking.'}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((b) => {
            const cost = formatCost(b.cost_cents, b.currency);
            return (
              <Pressable
                key={b.id}
                style={styles.bookingCard}
                onPress={() => startEdit(b)}
              >
                <Text style={styles.bookingIcon}>{BOOKING_ICONS[b.type]}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.bookingProvider}>{b.provider}</Text>
                  <Text style={styles.bookingMeta}>
                    {formatBookingDate(b.start_ts)}
                    {b.end_ts ? ` → ${formatBookingDate(b.end_ts)}` : ''}
                  </Text>
                  {b.confirmation_code ? (
                    <Text style={styles.bookingMeta}>
                      Confirmation: {b.confirmation_code}
                    </Text>
                  ) : null}
                  {b.location ? (
                    <Text style={styles.bookingMeta}>{b.location}</Text>
                  ) : null}
                  {cost ? <Text style={styles.bookingCost}>{cost}</Text> : null}
                </View>
                <Pressable
                  onPress={() => handleDelete(b.id)}
                  hitSlop={8}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      )}

      {!showAdd ? (
        <Pressable
          style={styles.addDayButton}
          onPress={() => {
            setShowAdd(true);
            setEditingId(null);
            setForm(emptyBookingForm());
            setFormError(null);
          }}
        >
          <Text style={styles.addDayButtonText}>+ Add booking</Text>
        </Pressable>
      ) : (
        <View style={styles.inlineForm}>
          <Text style={styles.formLabel}>Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {BOOKING_TYPES.map((t) => {
              const active = form.type === t;
              return (
                <Pressable
                  key={t}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setForm((f) => ({ ...f, type: t }))}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {BOOKING_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.formLabel}>Provider</Text>
          <TextInput
            value={form.provider}
            onChangeText={(v) => setForm((f) => ({ ...f, provider: v }))}
            placeholder="Delta Airlines"
            placeholderTextColor={colors.textSecondary}
            style={styles.formInput}
          />

          <Text style={styles.formLabel}>Confirmation code (optional)</Text>
          <TextInput
            value={form.confirmation_code}
            onChangeText={(v) =>
              setForm((f) => ({ ...f, confirmation_code: v }))
            }
            placeholder="ABC123"
            placeholderTextColor={colors.textSecondary}
            style={styles.formInput}
            autoCapitalize="characters"
          />

          <Text style={styles.formLabel}>Start (ISO-8601)</Text>
          <TextInput
            value={form.start_ts}
            onChangeText={(v) => setForm((f) => ({ ...f, start_ts: v }))}
            placeholder="2026-05-04T09:30:00Z"
            placeholderTextColor={colors.textSecondary}
            style={styles.formInput}
            autoCapitalize="none"
          />

          <Text style={styles.formLabel}>End (optional)</Text>
          <TextInput
            value={form.end_ts}
            onChangeText={(v) => setForm((f) => ({ ...f, end_ts: v }))}
            placeholder="2026-05-04T12:45:00Z"
            placeholderTextColor={colors.textSecondary}
            style={styles.formInput}
            autoCapitalize="none"
          />

          <Text style={styles.formLabel}>Location (optional)</Text>
          <TextInput
            value={form.location}
            onChangeText={(v) => setForm((f) => ({ ...f, location: v }))}
            placeholder="JFK → CDG"
            placeholderTextColor={colors.textSecondary}
            style={styles.formInput}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 2, gap: 6 }}>
              <Text style={styles.formLabel}>Cost</Text>
              <TextInput
                value={form.cost}
                onChangeText={(v) => setForm((f) => ({ ...f, cost: v }))}
                placeholder="1234.56"
                placeholderTextColor={colors.textSecondary}
                style={styles.formInput}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.formLabel}>Currency</Text>
              <TextInput
                value={form.currency}
                onChangeText={(v) =>
                  setForm((f) => ({ ...f, currency: v.toUpperCase() }))
                }
                placeholder="USD"
                placeholderTextColor={colors.textSecondary}
                style={styles.formInput}
                autoCapitalize="characters"
                maxLength={3}
              />
            </View>
          </View>

          <Text style={styles.formLabel}>Notes (optional)</Text>
          <TextInput
            value={form.notes}
            onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
            placeholder="Seat 14A, window"
            placeholderTextColor={colors.textSecondary}
            style={[styles.formInput, { minHeight: 60 }]}
            multiline
          />

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <View style={styles.formActions}>
            <Pressable style={styles.secondaryButton} onPress={resetForm}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleSave}>
              <Text style={styles.primaryButtonText}>
                {editingId ? 'Save changes' : 'Save booking'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 16,
  },
  header: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: TRAVEL_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  typeChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(14,165,233,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.32)',
  },
  typeChipText: {
    color: TRAVEL_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: TRAVEL_ACCENT, borderColor: TRAVEL_ACCENT },
  tabText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: { color: '#0E0E13' },
  panel: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  placeholderTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  placeholderBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  errorBody: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  primaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: TRAVEL_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  dangerButton: {
    marginTop: 6,
    borderColor: 'rgba(255,180,171,0.3)',
    backgroundColor: 'rgba(255,180,171,0.08)',
  },
  dangerButtonText: { color: '#FFB4AB' },
  itineraryWrap: { gap: 12 },
  dayCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.low,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  dayEyebrow: {
    color: TRAVEL_ACCENT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  dayTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  dayChevron: {
    color: colors.textSecondary,
    fontSize: 22,
    fontWeight: '600',
    paddingHorizontal: 6,
  },
  dayBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  activityMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.3)',
  },
  deleteBtnText: { color: '#FFB4AB', fontSize: 12, fontWeight: '700' },
  addActivityButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
  },
  addActivityButtonText: {
    color: TRAVEL_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  addDayButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
  },
  addDayButtonText: {
    color: TRAVEL_ACCENT,
    fontSize: 14,
    fontWeight: '700',
  },
  inlineForm: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  formInput: {
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formError: {
    color: '#FFB4AB',
    fontSize: 13,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  upcomingStrip: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(14,165,233,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.24)',
  },
  upcomingEyebrow: {
    color: TRAVEL_ACCENT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  upcomingRow: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: TRAVEL_ACCENT,
    borderColor: TRAVEL_ACCENT,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: { color: '#0E0E13' },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bookingIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  bookingProvider: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  bookingMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  bookingCost: {
    color: TRAVEL_ACCENT,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: TRAVEL_ACCENT,
  },
});
