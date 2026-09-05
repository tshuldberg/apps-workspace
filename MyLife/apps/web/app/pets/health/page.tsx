import Link from 'next/link';
import {
  getPetHealthTimeline,
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
  list: { display: 'grid', gap: '0.4rem' },
  line: { color: 'var(--text-secondary)', fontSize: '0.9rem' },
};

function countForPet(db: ReturnType<typeof getAdapter>, table: string, petId: string): number {
  return (db.query<{ count: number }>(`SELECT COUNT(*) as count FROM ${table} WHERE pet_id = ?`, [petId])[0]?.count ?? 0);
}

export default function PetsHealthPage() {
  let db: ReturnType<typeof getAdapter>;
  try {
    // Ensure pt_ tables exist before querying: without this the page
    // crashed on any fresh database (and broke hermetic production builds).
    ensureModuleMigrations('pets');
    db = getAdapter();
  } catch {
    return <div style={styles.page}><div style={styles.card}>Failed to load database.</div></div>;
  }

  const pets = listPets(db);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Pet Health</h1>
      <p style={styles.subtitle}>Pet health records and care tracker</p>

      <div style={styles.nav}>
        <Link href="/pets" style={styles.navLink}>Pets</Link>
        <Link href="/pets/health" style={styles.navLink}>Health</Link>
        <Link href="/pets/reminders" style={styles.navLink}>Reminders</Link>
        <Link href="/pets/settings" style={styles.navLink}>Settings</Link>
      </div>

      {pets.length === 0 ? (
        <div style={styles.card}>No pets added yet.</div>
      ) : (
        pets.map((pet) => {
          const timeline = getPetHealthTimeline(db, pet.id, 3);

          return (
            <div key={pet.id} style={styles.card}>
              <div style={styles.sectionTitle}>{pet.name}</div>
              <div style={styles.list}>
                <div style={styles.line}>Vet visits: {countForPet(db, 'pt_vet_visits', pet.id)}</div>
                <div style={styles.line}>Vaccinations: {countForPet(db, 'pt_vaccinations', pet.id)}</div>
                <div style={styles.line}>Active medications: {(db.query<{ count: number }>(`SELECT COUNT(*) as count FROM pt_medications WHERE pet_id = ? AND is_active = 1`, [pet.id])[0]?.count ?? 0)}</div>
                <div style={styles.line}>Weight logs: {countForPet(db, 'pt_weight_entries', pet.id)}</div>
                <div style={styles.line}>Exercise logs: {countForPet(db, 'pt_exercise_logs', pet.id)}</div>
                <div style={styles.line}>Grooming records: {countForPet(db, 'pt_grooming_records', pet.id)}</div>
                <div style={styles.line}>Training sessions: {countForPet(db, 'pt_training_logs', pet.id)}</div>
                {timeline[0] ? (
                  <div style={styles.line}>
                    Latest timeline event: {timeline[0].title} on {timeline[0].occurredAt.slice(0, 10)}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
