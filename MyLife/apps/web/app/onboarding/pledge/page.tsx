import { redirect } from 'next/navigation';
import { acceptPledgeAction } from '@/app/actions';

// ── Tokens (Cool Obsidian) ──────────────────────────────────────────

const BACKGROUND = '#131318';
const SURFACE = '#2A292F';
const TEXT = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const PRIMARY = '#FFB877';
const PRIMARY_CONTAINER = '#C9894D';

const COMMITMENTS: ReadonlyArray<{ icon: string; title: string; body: string }> = [
  { icon: '\u{1F6AB}', title: 'No ads, ever.', body: 'Nothing in the app is sold to advertisers.' },
  { icon: '\u{1F512}', title: 'No data sale, ever.', body: 'Your personal data is never sold to anyone.' },
  { icon: '\u{1F381}', title: 'Free features stay free.', body: "We don't paywall things you already rely on." },
  { icon: '\u{1F4E4}', title: 'Export everything, anytime.', body: 'Your data, your hands. One tap to back it all up.' },
  { icon: '\u{1F5D1}\uFE0F', title: 'Delete everything, anytime.', body: 'Remove any module or all of your data in one action.' },
  { icon: '\u{1F6E1}\uFE0F', title: 'Content filters are your choice.', body: 'Everything is opt-in. Default is show-all.' },
  { icon: '\u{1F6AA}', title: 'Exit door is always open.', body: 'You can leave at any time with a full export.' },
];

async function handleAccept(): Promise<void> {
  'use server';
  await acceptPledgeAction();
  redirect('/onboarding/goal');
}

export default function PledgeOnboardingPage() {
  return (
    <main style={styles.wrapper}>
      <header style={styles.header}>
        <h1 style={styles.title}>Our pledge to you</h1>
        <p style={styles.subtitle}>
          Seven commitments. No fine print. Agree once and we stand by them.
        </p>
      </header>

      <ol style={styles.list}>
        {COMMITMENTS.map((c) => (
          <li key={c.title} style={styles.item}>
            <span style={styles.itemIcon} aria-hidden>{c.icon}</span>
            <div style={styles.itemBody}>
              <div style={styles.itemTitle}>{c.title}</div>
              <div style={styles.itemDescription}>{c.body}</div>
            </div>
          </li>
        ))}
      </ol>

      <form action={handleAccept} style={styles.footer}>
        <button type="submit" style={styles.primaryButton}>
          I accept
        </button>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: BACKGROUND,
    color: TEXT,
    minHeight: '100vh',
    maxWidth: 720,
    margin: '0 auto',
    padding: '48px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 700,
    lineHeight: '38px',
    color: TEXT,
  },
  subtitle: {
    margin: 0,
    color: TEXT_SECONDARY,
    fontSize: 16,
    lineHeight: '24px',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  item: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
    background: SURFACE,
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
  },
  itemIcon: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
    flexShrink: 0,
    paddingTop: 2,
  },
  itemBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: TEXT,
  },
  itemDescription: {
    fontSize: 14,
    lineHeight: '20px',
    color: TEXT_SECONDARY,
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  primaryButton: {
    border: 'none',
    background: PRIMARY,
    color: BACKGROUND,
    borderRadius: 10,
    padding: '14px 24px',
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
    boxShadow: `0 1px 0 ${PRIMARY_CONTAINER}`,
  },
};
