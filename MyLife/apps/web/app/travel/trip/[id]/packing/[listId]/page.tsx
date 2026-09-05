import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getPackingList,
  getTripById,
  listPackingItems,
  type PackingItemRow,
} from '@mylife/travel';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import { PackingListDetail } from './PackingListDetail';

export default async function TravelPackingListPage({
  params,
}: {
  params: Promise<{ id: string; listId: string }>;
}) {
  const { id, listId } = await params;
  ensureModuleMigrations('travel');
  const adapter = getAdapter();

  const trip = getTripById(adapter, id);
  if (!trip) notFound();

  const list = getPackingList(adapter, listId);
  if (!list || list.trip_id !== trip.id) notFound();

  let items: PackingItemRow[] = [];
  let loadError: string | null = null;
  try {
    items = listPackingItems(adapter, { listId });
  } catch {
    loadError = 'Failed to load packing items.';
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={styles.backRow}>
        <Link href={`/travel/trip/${trip.id}`} style={styles.backLink}>
          ← Back to {trip.name}
        </Link>
      </div>

      <PackingListDetail
        tripId={trip.id}
        listId={list.id}
        listName={list.name}
        items={items}
        loadError={loadError}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backRow: { display: 'flex' },
  backLink: {
    color: '#7DD3FC',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
  },
};
