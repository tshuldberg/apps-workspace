import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  exportClosetData,
  getClosetDashboard,
  getClosetSetting,
  listClothingItems,
  listDirtyClothingItems,
  serializeClosetExport,
  setClosetSetting,
} from '@mylife/closet';
import { getAdapter } from '@/lib/db';

const THRESHOLDS = ['90', '180', '365'];
const WEAR_LIMITS = ['1', '2', '3', '5'];
const REMINDER_TYPES = ['none', 'weekly'];
const REMINDER_DAYS = ['0', '1', '2', '3', '4', '5', '6'];

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 980, margin: '0 auto' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  subtitle: { color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: '1.25rem' },
  nav: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' as const },
  navLink: { color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem', padding: '0.35rem 0.75rem', borderRadius: '999px', border: '1px solid var(--border)', background: 'var(--surface)' },
  navLinkActive: { color: 'var(--background)', textDecoration: 'none', fontSize: '0.875rem', padding: '0.35rem 0.75rem', borderRadius: '999px', border: '1px solid var(--accent-closet)', background: 'var(--accent-closet)', fontWeight: 600 },
  card: { background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' },
  sectionTitle: { fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' },
  line: { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 },
  chipRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' as const, marginTop: '0.75rem' },
  button: { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.55rem 0.9rem', fontWeight: 600, cursor: 'pointer' },
  preview: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' as const, fontSize: '0.8rem', lineHeight: 1.5, marginTop: '0.75rem' },
};

export default async function ClosetSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string | string[] }>;
}) {
  const params = await searchParams;
  const formatParam = Array.isArray(params.format) ? params.format[0] : params.format;
  const exportFormat = formatParam === 'csv' ? 'csv' : 'json';
  const db = getAdapter();
  const items = listClothingItems(db, { status: 'active', limit: 500 });
  const dirtyItems = listDirtyClothingItems(db);
  const dashboard = getClosetDashboard(db);
  const donationThreshold = getClosetSetting(db, 'donationThresholdDays') ?? '365';
  const laundryAutoDirty = getClosetSetting(db, 'laundryAutoDirty') ?? '1';
  const laundryWearsBeforeDirty = getClosetSetting(db, 'laundryWearsBeforeDirty') ?? '1';
  const laundryReminder = getClosetSetting(db, 'laundryReminder') ?? 'none';
  const laundryReminderDay = getClosetSetting(db, 'laundryReminderDay') ?? '0';
  const exportPreview = serializeClosetExport(exportClosetData(db), exportFormat).slice(0, 900);

  async function updateSetting(formData: FormData) {
    'use server';

    const key = String(formData.get('key') ?? '');
    const value = String(formData.get('value') ?? '');
    if (!key) {
      return;
    }

    try {
      setClosetSetting(getAdapter(), key, value);
    } finally {
      revalidatePath('/closet');
      revalidatePath('/closet/calendar');
      revalidatePath('/closet/stats');
      revalidatePath('/closet/settings');
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Closet Settings</h1>
      <p style={styles.subtitle}>Thresholds, laundry behavior, and export previews</p>

      <div style={styles.nav}>
        <Link href="/closet" style={styles.navLink}>Wardrobe</Link>
        <Link href="/closet/outfits" style={styles.navLink}>Outfits</Link>
        <Link href="/closet/calendar" style={styles.navLink}>Calendar</Link>
        <Link href="/closet/stats" style={styles.navLink}>Stats</Link>
        <Link href="/closet/settings" style={styles.navLinkActive}>Settings</Link>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Snapshot</div>
        <div style={styles.line}>Items: {items.length}</div>
        <div style={styles.line}>Outfits: {dashboard.totalOutfits}</div>
        <div style={styles.line}>Dirty items: {dirtyItems.length}</div>
        <div style={styles.line}>Donation candidates: {dashboard.donationCandidateCount}</div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Donation threshold</div>
        <div style={styles.line}>
          Items older than this many days since last wear are suggested for donation: {donationThreshold} days.
        </div>
        <form action={updateSetting} style={styles.chipRow}>
          <input type="hidden" name="key" value="donationThresholdDays" />
          {THRESHOLDS.map((value) => (
            <button
              key={value}
              type="submit"
              name="value"
              value={value}
              style={{
                ...styles.button,
                color: value === donationThreshold ? 'var(--background)' : 'var(--text-secondary)',
                background: value === donationThreshold ? 'var(--accent-closet)' : 'var(--surface)',
                borderColor: value === donationThreshold ? 'var(--accent-closet)' : 'var(--border)',
              }}
            >
              {value}d
            </button>
          ))}
        </form>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Laundry preferences</div>
        <div style={styles.line}>Auto-dirty after wear: {laundryAutoDirty === '1' ? 'On' : 'Off'}</div>
        <form action={updateSetting} style={styles.chipRow}>
          <input type="hidden" name="key" value="laundryAutoDirty" />
          {[
            { label: 'On', value: '1' },
            { label: 'Off', value: '0' },
          ].map((option) => (
            <button
              key={option.value}
              type="submit"
              name="value"
              value={option.value}
              style={{
                ...styles.button,
                color: option.value === laundryAutoDirty ? 'var(--background)' : 'var(--text-secondary)',
                background: option.value === laundryAutoDirty ? 'var(--accent-closet)' : 'var(--surface)',
                borderColor: option.value === laundryAutoDirty ? 'var(--accent-closet)' : 'var(--border)',
              }}
            >
              {option.label}
            </button>
          ))}
        </form>
        <div style={{ ...styles.line, marginTop: '0.75rem' }}>Wears before dirty: {laundryWearsBeforeDirty}</div>
        <form action={updateSetting} style={styles.chipRow}>
          <input type="hidden" name="key" value="laundryWearsBeforeDirty" />
          {WEAR_LIMITS.map((value) => (
            <button
              key={value}
              type="submit"
              name="value"
              value={value}
              style={{
                ...styles.button,
                color: value === laundryWearsBeforeDirty ? 'var(--background)' : 'var(--text-secondary)',
                background: value === laundryWearsBeforeDirty ? 'var(--accent-closet)' : 'var(--surface)',
                borderColor: value === laundryWearsBeforeDirty ? 'var(--accent-closet)' : 'var(--border)',
              }}
            >
              {value}
            </button>
          ))}
        </form>
        <div style={{ ...styles.line, marginTop: '0.75rem' }}>Reminder: {laundryReminder}</div>
        <form action={updateSetting} style={styles.chipRow}>
          <input type="hidden" name="key" value="laundryReminder" />
          {REMINDER_TYPES.map((value) => (
            <button
              key={value}
              type="submit"
              name="value"
              value={value}
              style={{
                ...styles.button,
                color: value === laundryReminder ? 'var(--background)' : 'var(--text-secondary)',
                background: value === laundryReminder ? 'var(--accent-closet)' : 'var(--surface)',
                borderColor: value === laundryReminder ? 'var(--accent-closet)' : 'var(--border)',
              }}
            >
              {value}
            </button>
          ))}
        </form>
        {laundryReminder === 'weekly' ? (
          <form action={updateSetting} style={styles.chipRow}>
            <input type="hidden" name="key" value="laundryReminderDay" />
            {REMINDER_DAYS.map((value) => (
              <button
                key={value}
                type="submit"
                name="value"
                value={value}
                style={{
                  ...styles.button,
                  color: value === laundryReminderDay ? 'var(--background)' : 'var(--text-secondary)',
                  background: value === laundryReminderDay ? 'var(--accent-closet)' : 'var(--surface)',
                  borderColor: value === laundryReminderDay ? 'var(--accent-closet)' : 'var(--border)',
                }}
              >
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][Number(value)]}
              </button>
            ))}
          </form>
        ) : null}
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Export Preview</div>
        <div style={styles.line}>
          Current export covers wardrobe items, outfits, wear logs, laundry events, packing lists, and settings as CSV or JSON previews.
        </div>
        <div style={styles.chipRow}>
          <Link
            href="/closet/settings?format=json"
            style={{
              ...styles.button,
              color: exportFormat === 'json' ? 'var(--background)' : 'var(--text-secondary)',
              background: exportFormat === 'json' ? 'var(--accent-closet)' : 'var(--surface)',
              borderColor: exportFormat === 'json' ? 'var(--accent-closet)' : 'var(--border)',
              textDecoration: 'none',
            }}
          >
            JSON
          </Link>
          <Link
            href="/closet/settings?format=csv"
            style={{
              ...styles.button,
              color: exportFormat === 'csv' ? 'var(--background)' : 'var(--text-secondary)',
              background: exportFormat === 'csv' ? 'var(--accent-closet)' : 'var(--surface)',
              borderColor: exportFormat === 'csv' ? 'var(--accent-closet)' : 'var(--border)',
              textDecoration: 'none',
            }}
          >
            CSV
          </Link>
        </div>
        <div style={styles.preview}>{exportPreview}</div>
      </div>

    </div>
  );
}
