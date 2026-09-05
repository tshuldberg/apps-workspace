'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  ActivityInsertSchema,
  BookingInputSchema,
  BookingUpdateSchema,
  bulkAddPackingItems,
  createActivity,
  createBooking,
  createDay,
  createJournalEntry,
  createJournalMemory,
  createListFromTemplate,
  createPackingItem,
  createPackingList,
  createTrip,
  deleteActivity,
  deleteBooking,
  deleteDay,
  deleteDestination,
  deleteJournalEntry,
  deleteJournalMemory,
  deletePackingItem,
  deletePackingList,
  DestinationUpdateSchema,
  duplicatePackingList,
  getBooking,
  getJournalEntry,
  getPackingItem,
  ItineraryDayInsertSchema,
  JournalEntryInputSchema,
  JournalEntryUpdateSchema,
  JournalMemoryInputSchema,
  JournalMemoryKindSchema,
  JournalMemoryUpdateSchema,
  listDaysByTrip,
  markVisited,
  PackingItemInputSchema,
  PackingItemUpdateSchema,
  PackingListInputSchema,
  PackingTemplateKeySchema,
  reorderJournalMemories,
  reorderPackingItems,
  togglePackingItem,
  TripInsertSchema,
  updateBooking,
  updateDestination,
  updateJournalEntry,
  updateJournalMemory,
  updatePackingItem,
  type ActivityInsert,
  type BookingInput,
  type BookingType,
  type BookingUpdate,
  type DestinationUpdate,
  type ItineraryDayInsert,
  type JournalEntryInput,
  type JournalEntryUpdate,
  type JournalMemoryInput,
  type JournalMemoryKind,
  type JournalMemoryUpdate,
  type PackingItemInput,
  type PackingItemUpdate,
  type PackingListInput,
  type PackingTemplateKey,
  type TripInsert,
} from '@mylife/travel';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('travel');
  return adapter;
}

export interface CreateTripFormResult {
  ok: boolean;
  error?: string;
}

export async function createTripAction(
  _prev: CreateTripFormResult | null,
  formData: FormData,
): Promise<CreateTripFormResult> {
  const name = String(formData.get('name') ?? '').trim();
  const destination = String(formData.get('destination') ?? '').trim();
  const startDate = String(formData.get('start_date') ?? '').trim();
  const endDate = String(formData.get('end_date') ?? '').trim();
  const tripType = String(formData.get('trip_type') ?? '').trim();

  const candidate: TripInsert = {
    name,
    destination_ids: destination ? [destination] : undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    trip_type: (tripType || undefined) as TripInsert['trip_type'],
  };

  const parsed = TripInsertSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid trip details.',
    };
  }

  let tripId: string;
  try {
    const trip = createTrip(db(), parsed.data);
    tripId = trip.id;
  } catch {
    return { ok: false, error: 'Could not save trip. Please try again.' };
  }

  revalidatePath('/travel');
  revalidatePath(`/travel/trip/${tripId}`);
  redirect(`/travel/trip/${tripId}`);
}

// ---------------------------------------------------------------------------
// Itinerary day + activity actions (P1-C)
// ---------------------------------------------------------------------------

export interface MutationResult {
  ok: boolean;
  error?: string;
}

export async function createDayAction(formData: FormData): Promise<MutationResult> {
  const tripId = String(formData.get('trip_id') ?? '').trim();
  const dateRaw = String(formData.get('date') ?? '').trim();
  const location = String(formData.get('location') ?? '').trim();

  if (!tripId) return { ok: false, error: 'Missing trip id.' };

  let nextNumber = 1;
  try {
    nextNumber = listDaysByTrip(db(), tripId).length + 1;
  } catch {
    return { ok: false, error: 'Failed to read itinerary.' };
  }

  const candidate: ItineraryDayInsert = {
    trip_id: tripId,
    day_number: nextNumber,
    date: dateRaw || undefined,
    location: location || undefined,
  };

  const parsed = ItineraryDayInsertSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid day.',
    };
  }

  try {
    createDay(db(), parsed.data);
  } catch {
    return { ok: false, error: 'Could not save day.' };
  }

  revalidatePath(`/travel/trip/${tripId}`);
  return { ok: true };
}

export async function deleteDayAction(formData: FormData): Promise<MutationResult> {
  const tripId = String(formData.get('trip_id') ?? '').trim();
  const dayId = String(formData.get('day_id') ?? '').trim();
  if (!tripId || !dayId) return { ok: false, error: 'Missing id.' };

  try {
    deleteDay(db(), dayId);
  } catch {
    return { ok: false, error: 'Could not delete day.' };
  }
  revalidatePath(`/travel/trip/${tripId}`);
  return { ok: true };
}

export async function createActivityAction(
  formData: FormData,
): Promise<MutationResult> {
  const tripId = String(formData.get('trip_id') ?? '').trim();
  const dayId = String(formData.get('day_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const time = String(formData.get('time') ?? '').trim();
  const location = String(formData.get('location') ?? '').trim();

  if (!tripId || !dayId) return { ok: false, error: 'Missing trip or day id.' };

  const candidate: ActivityInsert = {
    trip_id: tripId,
    day_id: dayId,
    title,
    time: time || undefined,
    location: location || undefined,
  };

  const parsed = ActivityInsertSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid activity.',
    };
  }

  try {
    createActivity(db(), parsed.data);
  } catch {
    return { ok: false, error: 'Could not save activity.' };
  }

  revalidatePath(`/travel/trip/${tripId}`);
  return { ok: true };
}

export async function deleteActivityAction(
  formData: FormData,
): Promise<MutationResult> {
  const tripId = String(formData.get('trip_id') ?? '').trim();
  const activityId = String(formData.get('activity_id') ?? '').trim();
  if (!tripId || !activityId) return { ok: false, error: 'Missing id.' };

  try {
    deleteActivity(db(), activityId);
  } catch {
    return { ok: false, error: 'Could not delete activity.' };
  }
  revalidatePath(`/travel/trip/${tripId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Destination detail actions (P2-C)
// ---------------------------------------------------------------------------

function revalidateDestination(id: string): void {
  revalidatePath('/travel/destinations');
  revalidatePath('/travel/bucket-list');
  revalidatePath('/travel/map');
  revalidatePath(`/travel/destination/${id}`);
}

export async function updateDestinationAction(
  formData: FormData,
): Promise<MutationResult> {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing destination id.' };

  const name = String(formData.get('name') ?? '').trim();
  const country = String(formData.get('country') ?? '').trim();
  const countryCode = String(formData.get('country_code') ?? '').trim();
  const region = String(formData.get('region') ?? '').trim();
  const latStr = String(formData.get('lat') ?? '').trim();
  const lngStr = String(formData.get('lng') ?? '').trim();
  const notes = String(formData.get('notes_md') ?? '');
  const bestSeason = String(formData.get('best_season') ?? '').trim();
  const bucketListStr = String(formData.get('bucket_list') ?? '').trim();

  const candidate: DestinationUpdate = {
    name: name || undefined,
    country: country || undefined,
    country_code: countryCode || undefined,
    region: region || undefined,
    lat: latStr ? Number(latStr) : undefined,
    lng: lngStr ? Number(lngStr) : undefined,
    notes_md: notes.length > 0 ? notes : undefined,
    best_season: bestSeason || undefined,
    bucket_list:
      bucketListStr === 'true'
        ? true
        : bucketListStr === 'false'
          ? false
          : undefined,
  };

  const parsed = DestinationUpdateSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid destination details.',
    };
  }

  try {
    updateDestination(db(), id, parsed.data);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not update destination.',
    };
  }

  revalidateDestination(id);
  return { ok: true };
}

export async function deleteDestinationAction(
  formData: FormData,
): Promise<MutationResult> {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing destination id.' };

  try {
    deleteDestination(db(), id);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not delete destination.',
    };
  }

  revalidatePath('/travel/destinations');
  revalidatePath('/travel/bucket-list');
  revalidatePath('/travel/map');
  redirect('/travel/destinations');
}

export async function visitDestinationAction(
  formData: FormData,
): Promise<MutationResult> {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing destination id.' };

  const dateRaw = String(formData.get('visited_date') ?? '').trim();
  const today = new Date().toISOString().slice(0, 10);
  const visitedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : today;

  try {
    markVisited(db(), id, visitedDate);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not mark as visited.',
    };
  }

  revalidateDestination(id);
  return { ok: true };
}

/**
 * Toggles bucket_list off. True unvisit is not supported by the travel module;
 * this action clears the wishlist flag so visited destinations no longer show
 * on the bucket list.
 */
export async function unvisitDestinationAction(
  formData: FormData,
): Promise<MutationResult> {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, error: 'Missing destination id.' };

  try {
    updateDestination(db(), id, { bucket_list: false });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not update destination.',
    };
  }

  revalidateDestination(id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Booking actions (P1-E)
// ---------------------------------------------------------------------------

function parseOptionalCostCents(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

export async function createBookingAction(
  formData: FormData,
): Promise<MutationResult> {
  try {
    const tripId = String(formData.get('trip_id') ?? '').trim();
    const type = String(formData.get('type') ?? '').trim() as BookingType;
    const provider = String(formData.get('provider') ?? '').trim();
    const confirmation = String(formData.get('confirmation_code') ?? '').trim();
    const startTs = String(formData.get('start_ts') ?? '').trim();
    const endTs = String(formData.get('end_ts') ?? '').trim();
    const location = String(formData.get('location') ?? '').trim();
    const cost = String(formData.get('cost') ?? '');
    const currency = String(formData.get('currency') ?? '').trim().toUpperCase();
    const notes = String(formData.get('notes') ?? '').trim();

    if (!tripId) return { ok: false, error: 'Missing trip id.' };

    const candidate: BookingInput = {
      trip_id: tripId,
      type,
      provider,
      confirmation_code: confirmation || undefined,
      start_ts: startTs,
      end_ts: endTs || undefined,
      location: location || undefined,
      cost_cents: parseOptionalCostCents(cost),
      currency: currency || undefined,
      notes: notes || undefined,
    };

    const parsed = BookingInputSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid booking.',
      };
    }

    try {
      createBooking(db(), parsed.data);
    } catch {
      return { ok: false, error: 'Could not save booking.' };
    }

    revalidatePath(`/travel/trip/${tripId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unexpected error creating booking.' };
  }
}

export async function updateBookingAction(
  formData: FormData,
): Promise<MutationResult> {
  try {
    const id = String(formData.get('id') ?? '').trim();
    const tripId = String(formData.get('trip_id') ?? '').trim();
    if (!id) return { ok: false, error: 'Missing booking id.' };

    const type = String(formData.get('type') ?? '').trim() as BookingType;
    const provider = String(formData.get('provider') ?? '').trim();
    const confirmation = String(formData.get('confirmation_code') ?? '').trim();
    const startTs = String(formData.get('start_ts') ?? '').trim();
    const endTs = String(formData.get('end_ts') ?? '').trim();
    const location = String(formData.get('location') ?? '').trim();
    const cost = String(formData.get('cost') ?? '');
    const currency = String(formData.get('currency') ?? '').trim().toUpperCase();
    const notes = String(formData.get('notes') ?? '').trim();

    const patch: BookingUpdate = {
      type: type || undefined,
      provider: provider || undefined,
      confirmation_code: confirmation || undefined,
      start_ts: startTs || undefined,
      end_ts: endTs || undefined,
      location: location || undefined,
      cost_cents: parseOptionalCostCents(cost),
      currency: currency || undefined,
      notes: notes || undefined,
    };

    const parsed = BookingUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid booking.',
      };
    }

    try {
      updateBooking(db(), id, parsed.data);
    } catch {
      return { ok: false, error: 'Could not update booking.' };
    }

    const resolvedTripId =
      tripId || (() => {
        try {
          return getBooking(db(), id)?.trip_id ?? '';
        } catch {
          return '';
        }
      })();
    if (resolvedTripId) {
      revalidatePath(`/travel/trip/${resolvedTripId}`);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unexpected error updating booking.' };
  }
}

export async function deleteBookingAction(
  formData: FormData,
): Promise<MutationResult> {
  try {
    const id = String(formData.get('id') ?? '').trim();
    const tripId = String(formData.get('trip_id') ?? '').trim();
    if (!id) return { ok: false, error: 'Missing booking id.' };

    try {
      deleteBooking(db(), id);
    } catch {
      return { ok: false, error: 'Could not delete booking.' };
    }

    if (tripId) revalidatePath(`/travel/trip/${tripId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unexpected error deleting booking.' };
  }
}

// ---------------------------------------------------------------------------
// Packing actions (P5-B)
// ---------------------------------------------------------------------------

function revalidatePackingPaths(
  tripId: string | null | undefined,
  listId?: string,
): void {
  if (tripId) revalidatePath(`/travel/trip/${tripId}`);
  if (tripId && listId) {
    revalidatePath(`/travel/trip/${tripId}/packing/${listId}`);
  }
}

export async function createPackingListAction(
  tripId: string,
  formData: FormData,
): Promise<MutationResult & { listId?: string }> {
  try {
    if (!tripId.trim()) return { ok: false, error: 'Missing trip id.' };
    const name = String(formData.get('name') ?? '').trim();
    const candidate: PackingListInput = {
      trip_id: tripId,
      name,
      template: false,
    };
    const parsed = PackingListInputSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid list name.',
      };
    }
    const created = createPackingList(db(), parsed.data);
    revalidatePackingPaths(tripId);
    return { ok: true, listId: created.id };
  } catch {
    return { ok: false, error: 'Unexpected error creating packing list.' };
  }
}

export async function createPackingListFromTemplateAction(
  tripId: string,
  templateKey: string,
  customName?: string,
): Promise<MutationResult & { listId?: string }> {
  try {
    if (!tripId.trim()) return { ok: false, error: 'Missing trip id.' };
    const parsed = PackingTemplateKeySchema.safeParse(templateKey);
    if (!parsed.success) {
      return { ok: false, error: 'Unknown template.' };
    }
    const key: PackingTemplateKey = parsed.data;
    const created = createListFromTemplate(
      db(),
      tripId,
      key,
      customName?.trim() || undefined,
    );
    revalidatePackingPaths(tripId);
    return { ok: true, listId: created.id };
  } catch {
    return { ok: false, error: 'Unexpected error seeding template.' };
  }
}

export async function duplicatePackingListAction(
  listId: string,
  tripId: string,
  newName?: string,
): Promise<MutationResult & { listId?: string }> {
  try {
    if (!listId.trim() || !tripId.trim()) {
      return { ok: false, error: 'Missing id.' };
    }
    const created = duplicatePackingList(db(), listId, {
      tripId,
      name: newName?.trim() || undefined,
    });
    revalidatePackingPaths(tripId);
    return { ok: true, listId: created.id };
  } catch {
    return { ok: false, error: 'Could not duplicate list.' };
  }
}

export async function deletePackingListAction(
  listId: string,
): Promise<MutationResult> {
  try {
    if (!listId.trim()) return { ok: false, error: 'Missing list id.' };
    // Look up trip id before delete so we can revalidate.
    let tripId: string | null = null;
    try {
      const items = db().query<{ trip_id: string | null }>(
        `SELECT trip_id FROM tv_packing_lists WHERE id = ?`,
        [listId],
      );
      tripId = items[0]?.trip_id ?? null;
    } catch {
      // ignore lookup failure
    }
    deletePackingList(db(), listId);
    if (tripId) revalidatePath(`/travel/trip/${tripId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not delete list.' };
  }
}

export async function createPackingItemAction(
  listId: string,
  formData: FormData,
): Promise<MutationResult> {
  try {
    if (!listId.trim()) return { ok: false, error: 'Missing list id.' };
    const label = String(formData.get('label') ?? '').trim();
    const qtyRaw = String(formData.get('quantity') ?? '').trim();
    const category = String(formData.get('category') ?? '').trim();
    const tripId = String(formData.get('trip_id') ?? '').trim() || null;

    const qty = qtyRaw ? Number(qtyRaw) : undefined;
    const candidate: PackingItemInput = {
      list_id: listId,
      label,
      quantity:
        qty !== undefined && Number.isFinite(qty) && qty > 0
          ? Math.round(qty)
          : undefined,
      category: category || undefined,
    };
    const parsed = PackingItemInputSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid item.',
      };
    }
    createPackingItem(db(), parsed.data);
    revalidatePackingPaths(tripId, listId);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unexpected error creating item.' };
  }
}

export async function togglePackingItemAction(
  itemId: string,
): Promise<MutationResult> {
  try {
    if (!itemId.trim()) return { ok: false, error: 'Missing item id.' };
    // Look up list + trip so we can revalidate both paths.
    let listId: string | null = null;
    let tripId: string | null = null;
    try {
      const item = getPackingItem(db(), itemId);
      listId = item?.list_id ?? null;
      if (listId) {
        const rows = db().query<{ trip_id: string | null }>(
          `SELECT trip_id FROM tv_packing_lists WHERE id = ?`,
          [listId],
        );
        tripId = rows[0]?.trip_id ?? null;
      }
    } catch {
      // ignore
    }
    togglePackingItem(db(), itemId);
    revalidatePackingPaths(tripId, listId ?? undefined);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not toggle item.' };
  }
}

export async function deletePackingItemAction(
  itemId: string,
): Promise<MutationResult> {
  try {
    if (!itemId.trim()) return { ok: false, error: 'Missing item id.' };
    let listId: string | null = null;
    let tripId: string | null = null;
    try {
      const item = getPackingItem(db(), itemId);
      listId = item?.list_id ?? null;
      if (listId) {
        const rows = db().query<{ trip_id: string | null }>(
          `SELECT trip_id FROM tv_packing_lists WHERE id = ?`,
          [listId],
        );
        tripId = rows[0]?.trip_id ?? null;
      }
    } catch {
      // ignore
    }
    deletePackingItem(db(), itemId);
    revalidatePackingPaths(tripId, listId ?? undefined);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not delete item.' };
  }
}

export async function reorderPackingItemsAction(
  listId: string,
  ids: string[],
): Promise<MutationResult> {
  try {
    if (!listId.trim()) return { ok: false, error: 'Missing list id.' };
    if (!Array.isArray(ids) || ids.length === 0) {
      return { ok: false, error: 'No items to reorder.' };
    }
    reorderPackingItems(db(), ids);
    let tripId: string | null = null;
    try {
      const rows = db().query<{ trip_id: string | null }>(
        `SELECT trip_id FROM tv_packing_lists WHERE id = ?`,
        [listId],
      );
      tripId = rows[0]?.trip_id ?? null;
    } catch {
      // ignore
    }
    revalidatePackingPaths(tripId, listId);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reorder items.' };
  }
}

export async function bulkAddPackingItemsAction(
  listId: string,
  labels: string[],
): Promise<MutationResult> {
  try {
    if (!listId.trim()) return { ok: false, error: 'Missing list id.' };
    const cleaned = Array.isArray(labels)
      ? labels.map((l) => String(l ?? '').trim()).filter((l) => l.length > 0)
      : [];
    if (cleaned.length === 0) {
      return { ok: false, error: 'Enter at least one item.' };
    }
    bulkAddPackingItems(db(), listId, cleaned);
    let tripId: string | null = null;
    try {
      const rows = db().query<{ trip_id: string | null }>(
        `SELECT trip_id FROM tv_packing_lists WHERE id = ?`,
        [listId],
      );
      tripId = rows[0]?.trip_id ?? null;
    } catch {
      // ignore
    }
    revalidatePackingPaths(tripId, listId);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not bulk-add items.' };
  }
}

export async function updatePackingItemAction(
  itemId: string,
  formData: FormData,
): Promise<MutationResult> {
  try {
    if (!itemId.trim()) return { ok: false, error: 'Missing item id.' };
    const label = String(formData.get('label') ?? '').trim();
    const qtyRaw = String(formData.get('quantity') ?? '').trim();
    const category = String(formData.get('category') ?? '').trim();
    const qty = qtyRaw ? Number(qtyRaw) : undefined;

    const patch: PackingItemUpdate = {
      label: label || undefined,
      quantity:
        qty !== undefined && Number.isFinite(qty) && qty > 0
          ? Math.round(qty)
          : undefined,
      category: category || undefined,
    };
    const parsed = PackingItemUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid item.',
      };
    }
    updatePackingItem(db(), itemId, parsed.data);

    let listId: string | null = null;
    let tripId: string | null = null;
    try {
      const item = getPackingItem(db(), itemId);
      listId = item?.list_id ?? null;
      if (listId) {
        const rows = db().query<{ trip_id: string | null }>(
          `SELECT trip_id FROM tv_packing_lists WHERE id = ?`,
          [listId],
        );
        tripId = rows[0]?.trip_id ?? null;
      }
    } catch {
      // ignore
    }
    revalidatePackingPaths(tripId, listId ?? undefined);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not update item.' };
  }
}

// ---------------------------------------------------------------------------
// Journal actions (P3-B)
// ---------------------------------------------------------------------------

function revalidateJournalPaths(entryId?: string): void {
  revalidatePath('/travel/journal');
  if (entryId) revalidatePath(`/travel/journal/${entryId}`);
}

function parseOptionalMood(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n);
}

export async function createJournalEntryAction(
  formData: FormData,
): Promise<MutationResult> {
  try {
    const entryDate = String(formData.get('entry_date') ?? '').trim();
    const title = String(formData.get('title') ?? '').trim();
    const body = String(formData.get('body_md') ?? '');
    const moodRaw = String(formData.get('mood') ?? '');
    const weather = String(formData.get('weather') ?? '').trim();
    const location = String(formData.get('location_label') ?? '').trim();
    const tripId = String(formData.get('trip_id') ?? '').trim();
    const destId = String(formData.get('destination_id') ?? '').trim();

    const candidate: JournalEntryInput = {
      entry_date: entryDate,
      title: title || undefined,
      body_md: body,
      mood: parseOptionalMood(moodRaw),
      weather: weather || undefined,
      location_label: location || undefined,
      trip_id: tripId || undefined,
      destination_id: destId || undefined,
    };

    const parsed = JournalEntryInputSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid entry.',
      };
    }

    try {
      createJournalEntry(db(), parsed.data);
    } catch {
      return { ok: false, error: 'Could not save entry.' };
    }

    revalidateJournalPaths();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unexpected error creating entry.' };
  }
}

export async function updateJournalEntryAction(
  id: string,
  formData: FormData,
): Promise<MutationResult> {
  try {
    if (!id.trim()) return { ok: false, error: 'Missing entry id.' };

    const entryDate = String(formData.get('entry_date') ?? '').trim();
    const title = String(formData.get('title') ?? '').trim();
    const body = String(formData.get('body_md') ?? '');
    const moodRaw = String(formData.get('mood') ?? '').trim();
    const weather = String(formData.get('weather') ?? '').trim();
    const location = String(formData.get('location_label') ?? '').trim();

    const patch: JournalEntryUpdate = {
      entry_date: entryDate || undefined,
      title: title || null,
      body_md: body,
      mood: moodRaw === '' ? null : parseOptionalMood(moodRaw) ?? null,
      weather: weather || null,
      location_label: location || null,
    };

    const parsed = JournalEntryUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid entry.',
      };
    }

    try {
      updateJournalEntry(db(), id, parsed.data);
    } catch {
      return { ok: false, error: 'Could not update entry.' };
    }

    revalidateJournalPaths(id);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unexpected error updating entry.' };
  }
}

export async function deleteJournalEntryAction(
  id: string,
): Promise<MutationResult> {
  try {
    if (!id.trim()) return { ok: false, error: 'Missing entry id.' };
    try {
      deleteJournalEntry(db(), id);
    } catch {
      return { ok: false, error: 'Could not delete entry.' };
    }
    revalidateJournalPaths();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unexpected error deleting entry.' };
  }
}

export async function createJournalMemoryAction(
  entryId: string,
  formData: FormData,
): Promise<MutationResult> {
  try {
    if (!entryId.trim()) return { ok: false, error: 'Missing entry id.' };

    const kindRaw = String(formData.get('kind') ?? '').trim();
    const mediaRef = String(formData.get('media_ref') ?? '').trim();
    const caption = String(formData.get('caption') ?? '').trim();

    const kindParsed = JournalMemoryKindSchema.safeParse(kindRaw);
    if (!kindParsed.success) {
      return { ok: false, error: 'Invalid memory kind.' };
    }
    const kind: JournalMemoryKind = kindParsed.data;

    const candidate: JournalMemoryInput = {
      entry_id: entryId,
      kind,
      media_ref: mediaRef || undefined,
      caption: caption || undefined,
    };

    const parsed = JournalMemoryInputSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid memory.',
      };
    }

    try {
      createJournalMemory(db(), parsed.data);
    } catch {
      return { ok: false, error: 'Could not save memory.' };
    }

    revalidateJournalPaths(entryId);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unexpected error creating memory.' };
  }
}

export async function updateJournalMemoryAction(
  id: string,
  formData: FormData,
): Promise<MutationResult> {
  try {
    if (!id.trim()) return { ok: false, error: 'Missing memory id.' };

    const kindRaw = String(formData.get('kind') ?? '').trim();
    const mediaRef = String(formData.get('media_ref') ?? '').trim();
    const caption = String(formData.get('caption') ?? '').trim();
    const entryId = String(formData.get('entry_id') ?? '').trim();

    const patch: JournalMemoryUpdate = {
      kind: kindRaw
        ? JournalMemoryKindSchema.safeParse(kindRaw).success
          ? (kindRaw as JournalMemoryKind)
          : undefined
        : undefined,
      media_ref: mediaRef || null,
      caption: caption || null,
    };

    const parsed = JournalMemoryUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid memory.',
      };
    }

    try {
      updateJournalMemory(db(), id, parsed.data);
    } catch {
      return { ok: false, error: 'Could not update memory.' };
    }

    revalidateJournalPaths(entryId || undefined);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unexpected error updating memory.' };
  }
}

export async function deleteJournalMemoryAction(
  id: string,
): Promise<MutationResult> {
  try {
    if (!id.trim()) return { ok: false, error: 'Missing memory id.' };
    let entryId: string | null = null;
    try {
      const rows = db().query<{ entry_id: string }>(
        `SELECT entry_id FROM tv_journal_memories WHERE id = ?`,
        [id],
      );
      entryId = rows[0]?.entry_id ?? null;
    } catch {
      // ignore
    }
    try {
      deleteJournalMemory(db(), id);
    } catch {
      return { ok: false, error: 'Could not delete memory.' };
    }
    revalidateJournalPaths(entryId ?? undefined);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unexpected error deleting memory.' };
  }
}

export async function reorderJournalMemoriesAction(
  entryId: string,
  ids: string[],
): Promise<MutationResult> {
  try {
    if (!entryId.trim()) return { ok: false, error: 'Missing entry id.' };
    if (!Array.isArray(ids) || ids.length === 0) {
      return { ok: false, error: 'No memories to reorder.' };
    }
    try {
      reorderJournalMemories(db(), ids);
    } catch {
      return { ok: false, error: 'Could not reorder memories.' };
    }
    revalidateJournalPaths(entryId);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unexpected error reordering memories.' };
  }
}

// Suppress unused-import warnings for types used only for inference above.
type _JournalUnused = [typeof getJournalEntry];

