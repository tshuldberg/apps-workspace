import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  createPackingList,
  getAverageWearsBetweenWashes,
  listClothingItems,
  listDirtyClothingItems,
  listOutfits,
  listPackingLists,
  listWearLogs,
  logWearEvent,
  markLaundryItemsClean,
  togglePackingListItemPacked,
} from '@mylife/closet';
import type { PackingListMode } from '@mylife/closet';
import { getAdapter } from '@/lib/db';

const PACKING_MODES: PackingListMode[] = ['quick_list', 'outfit_planning'];

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 980, margin: '0 auto' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  subtitle: { color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: '1.25rem' },
  nav: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' as const },
  navLink: { color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem', padding: '0.35rem 0.75rem', borderRadius: '999px', border: '1px solid var(--border)', background: 'var(--surface)' },
  navLinkActive: { color: 'var(--background)', textDecoration: 'none', fontSize: '0.875rem', padding: '0.35rem 0.75rem', borderRadius: '999px', border: '1px solid var(--accent-closet)', background: 'var(--accent-closet)', fontWeight: 600 },
  card: { background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' },
  sectionTitle: { fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' },
  form: { display: 'grid', gap: '0.75rem' },
  row: { display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' },
  input: { padding: '0.7rem 0.85rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' },
  checklist: { display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' },
  small: { color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 },
  button: { background: 'var(--accent-closet)', color: 'var(--background)', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 700, cursor: 'pointer' },
  secondaryButton: { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.55rem 0.9rem', fontWeight: 600, cursor: 'pointer' },
  list: { display: 'grid', gap: '0.75rem' },
  chipRow: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' as const },
  chip: { padding: '0.45rem 0.8rem', borderRadius: '999px', border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' },
};

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export default function ClosetCalendarPage() {
  const db = getAdapter();
  const items = listClothingItems(db, { status: 'active', limit: 200 });
  const outfits = listOutfits(db);
  const wearLogs = listWearLogs(db, { limit: 20 });
  const dirtyItems = listDirtyClothingItems(db);
  const packingLists = listPackingLists(db);
  const itemMap = new Map(items.map((item) => [item.id, item]));

  async function addWearLog(formData: FormData) {
    'use server';

    const today = new Date().toISOString().slice(0, 10);
    const outfitId = String(formData.get('outfitId') ?? '').trim() || null;
    const itemIds = formData.getAll('itemIds').map((value) => String(value));
    if (!outfitId && itemIds.length === 0) {
      return;
    }

    try {
      logWearEvent(getAdapter(), crypto.randomUUID(), {
        date: today,
        outfitId,
        itemIds,
        notes: String(formData.get('notes') ?? '').trim() || null,
      });
    } finally {
      revalidatePath('/closet/calendar');
      revalidatePath('/closet/stats');
      revalidatePath('/closet');
      revalidatePath('/closet/settings');
    }
  }

  async function markClean(formData: FormData) {
    'use server';

    const itemIds = formData.getAll('itemIds').map((value) => String(value));
    if (itemIds.length === 0) {
      return;
    }

    try {
      markLaundryItemsClean(getAdapter(), {
        itemIds,
        eventDate: new Date().toISOString().slice(0, 10),
      });
    } finally {
      revalidatePath('/closet/calendar');
      revalidatePath('/closet');
      revalidatePath('/closet/settings');
    }
  }

  async function addPackingList(formData: FormData) {
    'use server';

    const name = String(formData.get('name') ?? '').trim();
    const mode = String(formData.get('mode') ?? 'quick_list') as PackingListMode;
    if (!name || !PACKING_MODES.includes(mode)) {
      return;
    }

    try {
      createPackingList(getAdapter(), crypto.randomUUID(), {
        name,
        startDate: String(formData.get('startDate') ?? '').trim(),
        endDate: String(formData.get('endDate') ?? '').trim(),
        occasions: splitList(String(formData.get('occasions') ?? '')),
        mode,
      });
    } finally {
      revalidatePath('/closet/calendar');
    }
  }

  async function togglePacked(formData: FormData) {
    'use server';

    const packingListItemId = String(formData.get('packingListItemId') ?? '');
    if (!packingListItemId) {
      return;
    }

    try {
      togglePackingListItemPacked(getAdapter(), packingListItemId);
    } finally {
      revalidatePath('/closet/calendar');
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Closet Calendar</h1>
      <p style={styles.subtitle}>Log what you wore, run laundry day, and manage trip packing lists</p>

      <div style={styles.nav}>
        <Link href="/closet" style={styles.navLink}>Wardrobe</Link>
        <Link href="/closet/outfits" style={styles.navLink}>Outfits</Link>
        <Link href="/closet/calendar" style={styles.navLinkActive}>Calendar</Link>
        <Link href="/closet/stats" style={styles.navLink}>Stats</Link>
        <Link href="/closet/settings" style={styles.navLink}>Settings</Link>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Log today&apos;s wear</div>
        <form action={addWearLog} style={styles.form}>
          <div style={styles.row}>
            <select name="outfitId" defaultValue="" style={styles.input}>
              <option value="">No saved outfit</option>
              {outfits.map((outfit) => (
                <option key={outfit.id} value={outfit.id}>{outfit.name}</option>
              ))}
            </select>
            <input name="notes" placeholder="Notes" style={styles.input} />
          </div>
          <div style={styles.checklist}>
            {items.map((item) => (
              <label key={item.id} style={styles.small}>
                <input type="checkbox" name="itemIds" value={item.id} /> {item.name}
              </label>
            ))}
          </div>
          <button type="submit" style={styles.button}>Log wear</button>
        </form>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Laundry Day</div>
        {dirtyItems.length === 0 ? (
          <div style={styles.small}>Everything is clean. No laundry needed.</div>
        ) : (
          <form action={markClean} style={styles.form}>
            <div style={styles.checklist}>
              {dirtyItems.map((item) => (
                <label key={item.id} style={styles.small}>
                  <input type="checkbox" name="itemIds" value={item.id} /> {item.name} · {item.careInstructions.replaceAll('_', ' ')} · wears since wash {item.wearsSinceWash} · avg {getAverageWearsBetweenWashes(db, item.id) ?? 'N/A'}
                </label>
              ))}
            </div>
            <button type="submit" style={styles.button}>Mark selected clean</button>
          </form>
        )}
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Packing Lists</div>
        <form action={addPackingList} style={styles.form}>
          <div style={styles.row}>
            <input name="name" placeholder="Trip name" style={styles.input} />
            <input name="startDate" defaultValue={new Date().toISOString().slice(0, 10)} style={styles.input} />
            <input name="endDate" defaultValue={new Date().toISOString().slice(0, 10)} style={styles.input} />
            <input name="occasions" placeholder="Occasions, comma separated" style={styles.input} />
            <select name="mode" defaultValue="quick_list" style={styles.input}>
              {PACKING_MODES.map((mode) => (
                <option key={mode} value={mode}>{mode.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </div>
          <button type="submit" style={styles.button}>Create packing list</button>
        </form>
        <div style={styles.list}>
          {packingLists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🧳</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>Plan your next trip</div>
              <div style={styles.small}>Create a packing list to never forget what to bring.</div>
            </div>
          ) : packingLists.map((list) => {
            const packedCount = list.items.filter((item) => item.isPacked).length;
            return (
              <div key={list.id} style={{ ...styles.card, marginBottom: 0 }}>
                <div style={{ color: 'var(--text)', fontWeight: 600 }}>{list.name}</div>
                <div style={styles.small}>
                  {list.startDate} to {list.endDate} · {packedCount}/{list.items.length} packed
                </div>
                <div style={styles.list}>
                  {list.items.slice(0, 8).map((item) => (
                    <form key={item.id} action={togglePacked}>
                      <input type="hidden" name="packingListItemId" value={item.id} />
                      <button type="submit" style={styles.secondaryButton}>
                        {item.isPacked ? '✓ ' : ''}
                        {item.customName ?? itemMap.get(item.clothingItemId ?? '')?.name ?? 'Wardrobe item'}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Recent wear</div>
        <div style={styles.list}>
          {wearLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📅</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>Start your style journal</div>
              <div style={styles.small}>Log what you wear each day to discover your patterns.</div>
            </div>
          ) : wearLogs.map((log) => (
            <div key={log.id} style={{ ...styles.card, marginBottom: 0 }}>
              <div style={{ color: 'var(--text)', fontWeight: 600 }}>{log.date}</div>
              <div style={styles.small}>
                {log.itemIds.map((itemId) => itemMap.get(itemId)?.name ?? 'Unknown').join(', ')}
              </div>
              {log.notes ? <div style={styles.small}>{log.notes}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
