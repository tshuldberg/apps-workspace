import Link from 'next/link';
import {
  collectMedicationReminders,
  listDueGroomingReminders,
  listDueMedications,
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
  list: { display: 'grid', gap: '0.4rem' },
  line: { color: 'var(--text-secondary)', fontSize: '0.9rem' },
};

export default function PetsRemindersPage() {
  let db: ReturnType<typeof getAdapter>;
  try {
    // Ensure pt_ tables exist before querying: without this the page
    // crashed on any fresh database (and broke hermetic production builds).
    ensureModuleMigrations('pets');
    db = getAdapter();
  } catch {
    return <div style={styles.page}><div style={styles.card}>Failed to load database.</div></div>;
  }
  const pets = listPets(db).map((pet) => ({ id: pet.id, name: pet.name }));
  const vaccinationReminders = listDueVaccinationReminders(db, new Date().toISOString().slice(0, 10), 30);
  const medicationReminders = collectMedicationReminders(
    pets,
    listDueMedications(db, new Date().toISOString(), 48),
    new Date().toISOString(),
    2,
  );
  const groomingReminders = listDueGroomingReminders(db, new Date().toISOString().slice(0, 10), 14);
  const emergencyContacts = listEmergencyContacts(db);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Care Reminders</h1>
      <p style={styles.subtitle}>Pet health records and care tracker</p>

      <div style={styles.nav}>
        <Link href="/pets" style={styles.navLink}>Pets</Link>
        <Link href="/pets/health" style={styles.navLink}>Health</Link>
        <Link href="/pets/reminders" style={styles.navLink}>Reminders</Link>
        <Link href="/pets/settings" style={styles.navLink}>Settings</Link>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Vaccines</div>
        <div style={styles.list}>
          {vaccinationReminders.length === 0 ? (
            <div style={styles.line}>No vaccines due soon.</div>
          ) : vaccinationReminders.map((reminder) => (
            <div key={reminder.vaccinationId} style={styles.line}>
              {reminder.petName}: {reminder.vaccineName} on {reminder.nextDueDate} ({reminder.status})
            </div>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Medications</div>
        <div style={styles.list}>
          {medicationReminders.length === 0 ? (
            <div style={styles.line}>No medication reminders due soon.</div>
          ) : medicationReminders.map((reminder) => (
            <div key={reminder.medicationId} style={styles.line}>
              {reminder.petName}: {reminder.medicationName} at {reminder.nextDueAt} ({reminder.status})
            </div>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Grooming</div>
        <div style={styles.list}>
          {groomingReminders.length === 0 ? (
            <div style={styles.line}>No grooming reminders due soon.</div>
          ) : groomingReminders.map((reminder) => (
            <div key={reminder.groomingRecordId} style={styles.line}>
              {reminder.petName}: {reminder.groomingType.replaceAll('_', ' ')} on {reminder.nextDueDate} ({reminder.status})
            </div>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Emergency Contacts</div>
        <div style={styles.list}>
          {emergencyContacts.length === 0 ? (
            <div style={styles.line}>No emergency contacts saved.</div>
          ) : emergencyContacts.map((contact) => (
            <div key={contact.id} style={styles.line}>
              {contact.label}: {contact.clinicName} · {contact.phone}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
