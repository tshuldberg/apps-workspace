import Link from 'next/link';
import {
  buildPetSitterCard,
  exportPetData,
  formatPetSitterCard,
  listDueVaccinationReminders,
  listEmergencyContacts,
  listPets,
} from '@mylife/pets';
import { getAdapter, ensureModuleMigrations } from '@/lib/db';

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 980, margin: '0 auto' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  subtitle: { color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: '1.25rem' },
  nav: { display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' as const },
  navLink: { color: 'var(--accent-pets)', textDecoration: 'none', fontSize: '0.9rem' },
  card: { background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' },
  line: { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 },
  pre: { whiteSpace: 'pre-wrap' as const, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 },
};

export default function PetsSettingsPage() {
  let db: ReturnType<typeof getAdapter>;
  try {
    // Ensure pt_ tables exist before querying: without this the page
    // crashed on any fresh database (and broke hermetic production builds).
    ensureModuleMigrations('pets');
    db = getAdapter();
  } catch {
    return <div style={styles.page}><div style={styles.card}>Failed to load database.</div></div>;
  }
  const pets = listPets(db, { includeArchived: true });
  const activePet = pets.find((pet) => !pet.isArchived) ?? pets[0] ?? null;
  const dueVaccines = listDueVaccinationReminders(db, new Date().toISOString().slice(0, 10), 30);
  const contacts = listEmergencyContacts(db);
  const exportBundle = exportPetData(db, activePet?.id);
  const sitterCard = activePet ? buildPetSitterCard(db, activePet.id) : null;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Pets Settings</h1>
      <p style={styles.subtitle}>Pet health records and care tracker</p>

      <div style={styles.nav}>
        <Link href="/pets" style={styles.navLink}>Pets</Link>
        <Link href="/pets/health" style={styles.navLink}>Health</Link>
        <Link href="/pets/reminders" style={styles.navLink}>Reminders</Link>
        <Link href="/pets/settings" style={styles.navLink}>Settings</Link>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Snapshot</div>
        <div style={styles.line}>Tracked pets: {pets.length}</div>
        <div style={styles.line}>Vaccines due in 30 days: {dueVaccines.length}</div>
        <div style={styles.line}>Emergency contacts: {contacts.length}</div>
        <div style={styles.line}>Export timeline items: {exportBundle.timeline.length}</div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Current Coverage</div>
        <div style={styles.line}>
          The hub now includes emergency contacts, exercise logs, grooming schedules, training logs,
          health timelines, breed alerts, sitter card generation, and structured export data on top of
          the earlier profile, medication, vaccine, weight, feeding, and expense work.
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Pet Sitter Preview</div>
        <pre style={styles.pre}>
          {sitterCard ? formatPetSitterCard(sitterCard) : 'Add an active pet to preview sitter instructions.'}
        </pre>
      </div>
    </div>
  );
}
