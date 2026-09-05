import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createOutfit, listClothingItems, listOutfits } from '@mylife/closet';
import { getAdapter } from '@/lib/db';

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
  input: { padding: '0.7rem 0.85rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' },
  checklist: { display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' },
  small: { color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 },
  button: { background: 'var(--accent-closet)', color: 'var(--background)', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 700, cursor: 'pointer' },
  list: { display: 'grid', gap: '0.75rem' },
};

export default function ClosetOutfitsPage() {
  const db = getAdapter();
  const items = listClothingItems(db, { status: 'active', limit: 200 });
  const outfits = listOutfits(db);
  const itemMap = new Map(items.map((item) => [item.id, item]));

  async function addOutfit(formData: FormData) {
    'use server';

    const name = String(formData.get('name') ?? '').trim();
    const itemIds = formData.getAll('itemIds').map((value) => String(value));
    if (!name || itemIds.length === 0) {
      return;
    }

    try {
      createOutfit(getAdapter(), crypto.randomUUID(), {
        name,
        itemIds,
      });
    } finally {
      revalidatePath('/closet/outfits');
      revalidatePath('/closet/calendar');
      revalidatePath('/closet/stats');
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Closet Outfits</h1>
      <p style={styles.subtitle}>Build reusable looks from your active wardrobe</p>

      <div style={styles.nav}>
        <Link href="/closet" style={styles.navLink}>Wardrobe</Link>
        <Link href="/closet/outfits" style={styles.navLinkActive}>Outfits</Link>
        <Link href="/closet/calendar" style={styles.navLink}>Calendar</Link>
        <Link href="/closet/stats" style={styles.navLink}>Stats</Link>
        <Link href="/closet/settings" style={styles.navLink}>Settings</Link>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Build outfit</div>
        <form action={addOutfit} style={styles.form}>
          <input name="name" placeholder="Outfit name" style={styles.input} />
          <div style={styles.checklist}>
            {items.map((item) => (
              <label key={item.id} style={styles.small}>
                <input type="checkbox" name="itemIds" value={item.id} /> {item.name}
              </label>
            ))}
          </div>
          <button type="submit" style={styles.button}>Save outfit</button>
        </form>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Saved outfits</div>
        <div style={styles.list}>
          {outfits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🧥</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>Your looks await</div>
              <div style={styles.small}>Combine wardrobe items into reusable outfits.</div>
            </div>
          ) : outfits.map((outfit) => (
            <div key={outfit.id} style={{ ...styles.card, marginBottom: 0 }}>
              <div style={{ color: 'var(--text)', fontWeight: 600 }}>{outfit.name}</div>
              <div style={styles.small}>
                {outfit.itemIds.map((itemId) => itemMap.get(itemId)?.name ?? 'Unknown').join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
