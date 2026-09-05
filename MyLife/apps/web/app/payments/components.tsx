import type { ReactNode } from 'react';

export function PaymentsWebShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>{title}</h1>
            <p style={styles.subtitle}>{subtitle}</p>
          </div>
          <nav style={styles.nav}>
            <a style={styles.navLink} href="/payments">Wallet</a>
            <a style={styles.navLink} href="/payments/activity">Activity</a>
            <a style={styles.navLink} href="/payments/send">Send</a>
            <a style={styles.navLink} href="/payments/request">Request</a>
            <a style={styles.navLink} href="/payments/settings">Settings</a>
          </nav>
        </header>
        {children}
      </section>
    </main>
  );
}

export function PaymentsPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={styles.panel}>
      <p style={styles.eyebrow}>{eyebrow}</p>
      <h2 style={styles.panelTitle}>{title}</h2>
      {children}
    </section>
  );
}

export function PaymentsLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.line}>
      <span style={styles.lineLabel}>{label}</span>
      <strong style={styles.lineValue}>{value}</strong>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#061511',
    color: '#F5FBF8',
    padding: 32,
  },
  shell: {
    maxWidth: 1120,
    margin: '0 auto',
    display: 'grid',
    gap: 20,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 20,
    alignItems: 'flex-start',
  },
  title: {
    margin: 0,
    fontSize: 36,
    letterSpacing: 0,
  },
  subtitle: {
    margin: '8px 0 0',
    color: 'rgba(245,251,248,0.68)',
    lineHeight: 1.5,
  },
  nav: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  navLink: {
    color: '#BAE6FD',
    textDecoration: 'none',
    border: '1px solid rgba(186,230,253,0.20)',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 700,
  },
  panel: {
    border: '1px solid rgba(171,244,215,0.18)',
    background: 'rgba(17,54,42,0.88)',
    borderRadius: 24,
    padding: 20,
    display: 'grid',
    gap: 12,
  },
  eyebrow: {
    margin: 0,
    color: '#BAE6FD',
    textTransform: 'uppercase' as const,
    fontSize: 12,
    fontWeight: 800,
  },
  panelTitle: {
    margin: 0,
    fontSize: 20,
    letterSpacing: 0,
  },
  line: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 10,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  lineLabel: {
    color: 'rgba(245,251,248,0.60)',
  },
  lineValue: {
    color: '#F5FBF8',
    textAlign: 'right' as const,
  },
};
