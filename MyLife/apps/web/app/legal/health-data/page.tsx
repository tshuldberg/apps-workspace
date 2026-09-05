import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Health Data Details - MyLife',
  description:
    'Detailed breakdown of consumer health data collected by each MyLife module.',
};

const HEALTH_MODULES = [
  {
    name: 'MyHealth',
    icon: '\u{1F3E5}',
    id: 'health',
    dataTypes: [
      'Vital signs (heart rate, blood pressure, blood oxygen, temperature)',
      'Sleep data (duration, quality)',
      'Body measurements (weight, height, BMI)',
      'Health events and notes',
    ],
    purpose:
      'Personal health vital tracking and trend visualization. Not a medical device.',
  },
  {
    name: 'MyMeds',
    icon: '\u{1F48A}',
    id: 'meds',
    dataTypes: [
      'Medication names and descriptions',
      'Dosage amounts and schedules',
      'Medication adherence records',
      'Refill dates and pharmacy notes',
      'Drug interaction warnings (locally computed)',
      'Side-effect and mood logs',
    ],
    purpose:
      'Personal medication tracking and adherence reminders. Not a substitute for pharmacist or physician advice.',
  },
  {
    name: 'MyCycle',
    icon: '\u{1F338}',
    id: 'cycle',
    dataTypes: [
      'Menstrual cycle start and end dates',
      'Cycle symptoms and severity',
      'Reproductive health notes',
      'Cycle predictions (locally computed)',
    ],
    purpose:
      'Personal menstrual cycle tracking and prediction. This data is especially sensitive and is stored exclusively on your device with no cloud transmission.',
  },
  {
    name: 'MyMood',
    icon: '\u{1F60A}',
    id: 'mood',
    dataTypes: [
      'Mood ratings and timestamps',
      'Emotional state descriptions',
      'Mental health journal entries',
      'Activity tags associated with mood',
    ],
    purpose:
      'Personal mood and emotional wellness tracking. Not a mental health diagnostic tool.',
  },
  {
    name: 'MyNutrition',
    icon: '\u{1F966}',
    id: 'nutrition',
    dataTypes: [
      'Food intake logs with quantities',
      'Calorie and macronutrient totals',
      'Meal timing and categories',
      'Nutritional goal progress',
    ],
    purpose: 'Personal dietary tracking and nutritional awareness.',
  },
  {
    name: 'MyWorkouts',
    icon: '\u{1F3CB}',
    id: 'workouts',
    dataTypes: [
      'Exercise types and descriptions',
      'Sets, reps, weight, and duration',
      'Workout session timestamps',
      'Body measurements and progress photos',
      'Personal records and progression data',
    ],
    purpose: 'Personal fitness tracking and workout logging.',
  },
  {
    name: 'MyFast',
    icon: '\u{23F1}',
    id: 'fast',
    dataTypes: [
      'Fasting start and end times',
      'Fasting duration and streaks',
      'Fasting protocol preferences',
      'Metabolic health indicators (self-reported)',
    ],
    purpose: 'Personal intermittent fasting tracking.',
  },
  {
    name: 'MyHabits',
    icon: '\u{2705}',
    id: 'habits',
    dataTypes: [
      'Health and wellness habit definitions',
      'Daily completion records and streaks',
      'Timed habit session durations',
      'Self-reported measurements (weight, reps, etc.)',
    ],
    purpose: 'Personal habit tracking for health and wellness routines.',
  },
  {
    name: 'MyPresence',
    icon: '\u{1F4F1}',
    id: 'presence',
    dataTypes: [
      'Screen time duration per app category',
      'App usage session timestamps',
      'Digital wellness goal progress',
      'Focus session records',
    ],
    purpose: 'Personal digital wellness and screen time awareness.',
  },
];

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: 'var(--background)',
    color: 'var(--text)',
    padding: '48px 24px',
    maxWidth: 720,
    margin: '0 auto',
    lineHeight: 1.7,
  } as React.CSSProperties,
  h1: {
    fontSize: 28,
    fontWeight: 600,
    marginBottom: 8,
  } as React.CSSProperties,
  lastUpdated: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 32,
  } as React.CSSProperties,
  h2: {
    fontSize: 20,
    fontWeight: 600,
    marginTop: 32,
    marginBottom: 12,
  } as React.CSSProperties,
  p: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    marginBottom: 16,
  } as React.CSSProperties,
  moduleCard: {
    backgroundColor: 'var(--surface, #12121A)',
    border: '1px solid var(--border, rgba(255,255,255,0.06))',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  } as React.CSSProperties,
  moduleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  } as React.CSSProperties,
  moduleIcon: {
    fontSize: 24,
  } as React.CSSProperties,
  moduleName: {
    fontSize: 17,
    fontWeight: 600,
  } as React.CSSProperties,
  ul: {
    paddingLeft: 20,
    marginBottom: 12,
    color: 'var(--text-secondary)',
    fontSize: 14,
  } as React.CSSProperties,
  li: {
    marginBottom: 4,
  } as React.CSSProperties,
  purpose: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    fontStyle: 'italic' as const,
  } as React.CSSProperties,
  link: {
    color: 'var(--accent, #3B82F6)',
    textDecoration: 'underline',
  } as React.CSSProperties,
  backLink: {
    display: 'inline-block',
    marginBottom: 24,
    fontSize: 14,
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  banner: {
    backgroundColor: 'rgba(255,159,10,0.08)',
    border: '1px solid rgba(255,159,10,0.2)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  } as React.CSSProperties,
};

export default function HealthDataDetailsPage() {
  return (
    <div style={styles.page}>
      <Link href="/settings" style={styles.backLink}>
        &larr; Back to Settings
      </Link>

      <h1 style={styles.h1}>Consumer Health Data Details</h1>
      <p style={styles.lastUpdated}>Last updated: April 4, 2026</p>

      <p style={styles.p}>
        This page provides a detailed breakdown of the consumer health data collected
        by each MyLife health module. This information is provided in compliance with
        the Washington My Health My Data Act (MHMDA), Nevada SB 370, Connecticut CTDPA,
        and similar state health privacy laws.
      </p>

      <div style={styles.banner}>
        <p style={{ ...styles.p, marginBottom: 0, color: '#FF9F0A', fontSize: 14 }}>
          MyLife is not a medical device and does not provide medical advice,
          diagnosis, or treatment. All health modules are for personal tracking
          and informational purposes only. Always consult a qualified healthcare
          professional for medical decisions.
        </p>
      </div>

      <h2 style={styles.h2}>Data Storage</h2>
      <p style={styles.p}>
        All consumer health data listed below is stored exclusively on your device
        in a local SQLite database. None of this data is transmitted to our servers,
        third parties, or any external service. We never sell, share, or provide
        access to your health data.
      </p>

      <h2 style={styles.h2}>Per-Module Data Collection</h2>

      {HEALTH_MODULES.map((mod) => (
        <div key={mod.id} style={styles.moduleCard}>
          <div style={styles.moduleHeader}>
            <span style={styles.moduleIcon}>{mod.icon}</span>
            <span style={styles.moduleName}>{mod.name}</span>
          </div>
          <ul style={styles.ul}>
            {mod.dataTypes.map((dt) => (
              <li key={dt} style={styles.li}>
                {dt}
              </li>
            ))}
          </ul>
          <p style={styles.purpose}>{mod.purpose}</p>
        </div>
      ))}

      <h2 style={styles.h2}>Your Rights</h2>
      <p style={styles.p}>
        You can manage your health data consent for each module individually in
        Settings &gt; Health Data Consent. You may withdraw consent at any time,
        and you may request deletion of all health data. For full details, see
        our <Link href="/legal/privacy" style={styles.link}>Privacy Policy</Link>.
      </p>

      <p style={{ ...styles.p, marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        See also: <Link href="/legal/privacy" style={styles.link}>Privacy Policy</Link>
        {' | '}
        <Link href="/legal/terms" style={styles.link}>Terms of Service</Link>
      </p>
    </div>
  );
}
