import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClothingItem, getClosetDashboard, listClothingItems, listDirtyClothingItems } from '@mylife/closet';
import type { CareInstruction, ClothingCategory, LaundryStatus } from '@mylife/closet';
import { getAdapter } from '@/lib/db';

const CATEGORIES: ClothingCategory[] = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories', 'activewear', 'underwear', 'other'];
const CARE_OPTIONS: CareInstruction[] = ['machine_wash', 'hand_wash', 'dry_clean', 'delicate'];
const LAUNDRY_FILTERS: Array<'all' | LaundryStatus> = ['all', 'clean', 'dirty'];

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 980, margin: '0 auto' },
  header: { marginBottom: '1.5rem' },
  title: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  subtitle: { color: 'var(--text-secondary)', marginTop: '0.25rem' },
  nav: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' as const },
  navLink: { color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem', padding: '0.35rem 0.75rem', borderRadius: '999px', border: '1px solid var(--border)', background: 'var(--surface)' },
  navLinkActive: { color: 'var(--background)', textDecoration: 'none', fontSize: '0.875rem', padding: '0.35rem 0.75rem', borderRadius: '999px', border: '1px solid var(--accent-closet)', background: 'var(--accent-closet)', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' },
  card: { background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' },
  statValue: { fontSize: '2rem', fontWeight: 700, color: 'var(--accent-closet)' },
  sectionTitle: { fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' },
  form: { display: 'grid', gap: '0.75rem' },
  row: { display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' },
  input: { padding: '0.7rem 0.85rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' },
  button: { background: 'var(--accent-closet)', color: 'var(--background)', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 700, cursor: 'pointer' },
  small: { color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 },
  list: { display: 'grid', gap: '0.75rem' },
  chipRow: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' as const, marginTop: '0.75rem' },
  chip: { padding: '0.45rem 0.8rem', borderRadius: '999px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-secondary)', background: 'var(--surface)' },
};

function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default async function ClosetPage({
  searchParams,
}: {
  searchParams: Promise<{ laundry?: string | string[]; q?: string | string[] }>;
}) {
  const params = await searchParams;
  const search = Array.isArray(params.q) ? params.q[0] ?? '' : params.q ?? '';
  const requestedLaundry = Array.isArray(params.laundry) ? params.laundry[0] : params.laundry;
  const laundryFilter = LAUNDRY_FILTERS.includes((requestedLaundry ?? 'all') as 'all' | LaundryStatus)
    ? (requestedLaundry as 'all' | LaundryStatus)
    : 'all';
  const db = getAdapter();
  const items = listClothingItems(db, {
    status: 'active',
    limit: 200,
    search: search || undefined,
    laundryStatus: laundryFilter === 'all' ? undefined : laundryFilter,
  });
  const dashboard = getClosetDashboard(db);
  const dirtyItems = listDirtyClothingItems(db);

  async function addItem(formData: FormData) {
    'use server';

    const name = String(formData.get('name') ?? '').trim();
    const category = String(formData.get('category') ?? 'tops') as ClothingCategory;
    const careInstructions = String(formData.get('careInstructions') ?? 'machine_wash') as CareInstruction;
    if (!name || !CATEGORIES.includes(category) || !CARE_OPTIONS.includes(careInstructions)) {
      return;
    }

    try {
      const price = String(formData.get('price') ?? '').trim();
      createClothingItem(getAdapter(), crypto.randomUUID(), {
        name,
        category,
        brand: String(formData.get('brand') ?? '').trim() || null,
        color: String(formData.get('color') ?? '').trim() || null,
        purchasePriceCents: price ? Math.round(Number(price) * 100) : null,
        tags: splitTags(String(formData.get('tags') ?? '')),
        careInstructions,
        autoDirtyOnWear: String(formData.get('autoDirtyOnWear') ?? '1') === '1',
      });
    } finally {
      revalidatePath('/closet');
      revalidatePath('/closet/outfits');
      revalidatePath('/closet/calendar');
      revalidatePath('/closet/stats');
      revalidatePath('/closet/settings');
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>MyCloset</h1>
        <p style={styles.subtitle}>Local wardrobe catalog, outfits, laundry tracking, and trip planning</p>
      </div>

      <div style={styles.nav}>
        <Link href="/closet" style={styles.navLinkActive}>Wardrobe</Link>
        <Link href="/closet/outfits" style={styles.navLink}>Outfits</Link>
        <Link href="/closet/calendar" style={styles.navLink}>Calendar</Link>
        <Link href="/closet/stats" style={styles.navLink}>Stats</Link>
        <Link href="/closet/settings" style={styles.navLink}>Settings</Link>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.statValue}>{dashboard.totalItems}</div>
          <div style={styles.small}>Active items</div>
        </div>
        <div style={styles.card}>
          <div style={styles.statValue}>{dirtyItems.length}</div>
          <div style={styles.small}>Dirty items</div>
        </div>
        <div style={styles.card}>
          <div style={styles.statValue}>${(dashboard.wardrobeValueCents / 100).toFixed(0)}</div>
          <div style={styles.small}>Wardrobe value</div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Add item</div>
        <form action={addItem} style={styles.form}>
          <div style={styles.row}>
            <input name="name" placeholder="Item name" style={styles.input} />
            <select name="category" defaultValue="tops" style={styles.input}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select name="careInstructions" defaultValue="machine_wash" style={styles.input}>
              {CARE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>
              ))}
            </select>
            <select name="autoDirtyOnWear" defaultValue="1" style={styles.input}>
              <option value="1">Auto dirty on wear</option>
              <option value="0">Track only</option>
            </select>
            <input name="brand" placeholder="Brand" style={styles.input} />
            <input name="color" placeholder="Color" style={styles.input} />
            <input name="price" placeholder="Price in dollars" style={styles.input} />
            <input name="tags" placeholder="Tags, comma separated" style={styles.input} />
          </div>
          <button type="submit" style={styles.button}>Save item</button>
        </form>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Catalog filters</div>
        <form method="get" style={styles.form}>
          <div style={styles.row}>
            <input name="q" defaultValue={search} placeholder="Search name, brand, or color" style={styles.input} />
            <select name="laundry" defaultValue={laundryFilter} style={styles.input}>
              {LAUNDRY_FILTERS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <button type="submit" style={styles.button}>Apply</button>
          </div>
        </form>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Catalog</div>
        <div style={styles.list}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>👚</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>Your wardrobe is waiting</div>
              <div style={styles.small}>Add your first item above to start building your closet.</div>
            </div>
          ) : items.map((item) => (
            <div key={item.id} style={{ ...styles.card, marginBottom: 0 }}>
              <div style={{ color: 'var(--text)', fontWeight: 600 }}>{item.name}</div>
              <div style={styles.small}>
                {item.category}
                {item.brand ? ` · ${item.brand}` : ''}
                {item.color ? ` · ${item.color}` : ''}
              </div>
              <div style={styles.small}>
                {item.laundryStatus} · {item.careInstructions.replaceAll('_', ' ')} · wears since wash {item.wearsSinceWash}
              </div>
              <div style={styles.small}>
                Worn {item.timesWorn} times
                {item.tags.length > 0 ? ` · ${item.tags.join(', ')}` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
