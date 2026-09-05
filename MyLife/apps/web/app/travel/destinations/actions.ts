'use server';

import { revalidatePath } from 'next/cache';
import {
  createDestination,
  markVisited,
  DestinationInputSchema,
  type DestinationInput,
} from '@mylife/travel';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('travel');
  return adapter;
}

export interface CreateDestinationResult {
  ok: boolean;
  error?: string;
}

export async function createDestinationAction(
  _prev: CreateDestinationResult | null,
  formData: FormData,
): Promise<CreateDestinationResult> {
  const name = String(formData.get('name') ?? '').trim();
  const country = String(formData.get('country') ?? '').trim();
  const countryCode = String(formData.get('country_code') ?? '').trim();
  const region = String(formData.get('region') ?? '').trim();
  const latStr = String(formData.get('lat') ?? '').trim();
  const lngStr = String(formData.get('lng') ?? '').trim();
  const kind = String(formData.get('kind') ?? 'wishlist').trim();

  const candidate: DestinationInput = {
    name,
    country: country || undefined,
    country_code: countryCode || undefined,
    region: region || undefined,
    lat: latStr ? Number(latStr) : undefined,
    lng: lngStr ? Number(lngStr) : undefined,
    bucket_list: kind === 'wishlist',
  };

  const parsed = DestinationInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid destination details.',
    };
  }

  try {
    const adapter = db();
    const created = createDestination(adapter, parsed.data);
    if (kind === 'visited') {
      const today = new Date().toISOString().slice(0, 10);
      markVisited(adapter, created.id, today);
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not save destination.',
    };
  }

  revalidatePath('/travel/destinations');
  revalidatePath('/travel/map');
  return { ok: true };
}
