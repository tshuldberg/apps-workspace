import type { CSSProperties } from 'react';
import Link from 'next/link';
import { addSleepNapAction } from '../../actions';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function timeValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startFromNow(minutesAgo: number): { date: string; time: string } {
  const date = new Date(Date.now() - (minutesAgo * 60 * 1000));
  return {
    date: dateValue(date),
    time: timeValue(date),
  };
}

export default function SleepNapLogPage() {
  const justNapped = startFromNow(25);
  const aboutToNap = startFromNow(0);

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <p style={styles.eyebrow}>Nap Log</p>
        <h2 style={styles.heroTitle}>Log a nap without turning it into a form project.</h2>
        <p style={styles.body}>
          Pick a mode, use the presets, and keep accidental naps visible in the
          history instead of blending them into overnight sleep.
        </p>
      </section>

      <form action={addSleepNapAction} style={styles.panel}>
        <div style={styles.modeGrid}>
          <label style={styles.modeCard}>
            <input
              name="mode"
              type="radio"
              value="just_napped"
              defaultChecked
            />
            <span style={styles.modeTitle}>I just napped</span>
            <span style={styles.modeBody}>
              Defaults to a 25 minute nap that started recently.
            </span>
          </label>
          <label style={styles.modeCard}>
            <input name="mode" type="radio" value="about_to_nap" />
            <span style={styles.modeTitle}>I'm about to nap</span>
            <span style={styles.modeBody}>
              Use the current time and an intentional short rest.
            </span>
          </label>
        </div>

        <div style={styles.grid}>
          <label style={styles.field}>
            <span style={styles.label}>Date</span>
            <input
              name="date"
              defaultValue={justNapped.date}
              style={styles.input}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Start time</span>
            <input
              name="start_time"
              defaultValue={justNapped.time || aboutToNap.time}
              style={styles.input}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Duration</span>
            <select
              name="duration_minutes"
              defaultValue="25"
              style={styles.input}
            >
              {[10, 20, 25, 30, 45, 90].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Quality</span>
            <select name="quality" defaultValue="" style={styles.input}>
              <option value="">Optional</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}/5
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={styles.checkboxLabel}>
          <input name="intentional" type="checkbox" defaultChecked />
          <span>Intentional nap</span>
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Notes</span>
          <textarea
            name="notes"
            placeholder="Optional"
            rows={4}
            style={styles.textarea}
          />
        </label>

        <div style={styles.ctaRow}>
          <button type="submit" style={styles.primaryButton}>
            Save Nap
          </button>
          <Link href="/sleep/naps" style={styles.secondaryLink}>
            History
          </Link>
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: {
    display: 'grid',
    gap: 16,
  },
  hero: {
    display: 'grid',
    gap: 12,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(167,139,250,0.26)',
    background: 'rgba(167,139,250,0.10)',
  },
  eyebrow: {
    margin: 0,
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  heroTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 30,
    lineHeight: 1.08,
  },
  body: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.55,
  },
  panel: {
    display: 'grid',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  modeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  },
  modeCard: {
    display: 'grid',
    gap: 8,
    padding: 16,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: 800,
  },
  modeBody: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  field: {
    display: 'grid',
    gap: 7,
  },
  label: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 44,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '10px 12px',
    fontSize: 14,
  },
  textarea: {
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '10px 12px',
    fontSize: 14,
    resize: 'vertical',
  },
  checkboxLabel: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
  },
  ctaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    border: 0,
    borderRadius: 14,
    background: '#A78BFA',
    color: '#0E0E13',
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryLink: {
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '10px 14px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 800,
  },
};
