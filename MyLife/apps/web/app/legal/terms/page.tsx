import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service - MyLife',
  description: 'MyLife terms of service.',
};

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
  ul: {
    paddingLeft: 24,
    marginBottom: 16,
    color: 'var(--text-secondary)',
    fontSize: 15,
  } as React.CSSProperties,
  li: {
    marginBottom: 6,
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
};

export default function TermsOfServicePage() {
  return (
    <div style={styles.page}>
      <Link href="/settings" style={styles.backLink}>
        &larr; Back to Settings
      </Link>

      <h1 style={styles.h1}>Terms of Service</h1>
      <p style={styles.lastUpdated}>Last updated: April 4, 2026</p>

      <p style={styles.p}>
        These Terms of Service (&quot;Terms&quot;) govern your use of the MyLife
        application (&quot;Service&quot;) provided by MyLife (&quot;we,&quot;
        &quot;us,&quot; or &quot;our&quot;). By using MyLife, you agree to these Terms.
      </p>

      <h2 style={styles.h2}>1. Description of Service</h2>
      <p style={styles.p}>
        MyLife is a privacy-first personal life management application that consolidates
        multiple personal modules (budgeting, health tracking, reading, recipes, etc.)
        into a single unified hub. Your data is stored locally on your device unless
        you opt into cloud-enabled features.
      </p>

      <h2 style={styles.h2}>2. Accounts</h2>
      <p style={styles.p}>
        Account creation is optional. MyLife works fully offline with local-only data
        storage. An account is only required for cloud module features, purchase
        restoration, and cross-device sync.
      </p>

      <h2 style={styles.h2}>3. Subscriptions and Billing</h2>
      <p style={styles.p}>
        MyLife offers free and premium tiers. Premium subscriptions are billed through
        Apple App Store (RevenueCat) or Stripe (web). Subscription terms, pricing,
        and renewal policies are displayed at the point of purchase.
      </p>
      <ul style={styles.ul}>
        <li style={styles.li}>Subscriptions auto-renew unless cancelled before the renewal date</li>
        <li style={styles.li}>Refunds are handled by the respective platform (Apple, Google, Stripe)</li>
        <li style={styles.li}>Free tier modules remain accessible without a subscription</li>
      </ul>

      <h2 style={styles.h2}>4. Your Data</h2>
      <p style={styles.p}>
        You own your data. MyLife does not claim any ownership rights to the content
        you create within the application. You may export or delete your data at
        any time.
      </p>

      <h2 style={styles.h2}>5. Acceptable Use</h2>
      <p style={styles.p}>You agree not to:</p>
      <ul style={styles.ul}>
        <li style={styles.li}>Use the Service for any unlawful purpose</li>
        <li style={styles.li}>Attempt to reverse-engineer, decompile, or disassemble the application</li>
        <li style={styles.li}>Use community features (Forums, Market) to harass, spam, or post illegal content</li>
        <li style={styles.li}>Circumvent subscription or entitlement systems</li>
      </ul>

      <h2 style={styles.h2}>6. Health Data Disclaimer</h2>
      <p style={styles.p}>
        MyLife is not a medical device and does not provide medical advice, diagnosis,
        or treatment. Health-related modules (Health, Meds, Cycle, Mood, Nutrition,
        Workouts, Fast, Habits, Presence) are for personal tracking purposes only.
        Always consult a qualified healthcare professional for medical decisions.
      </p>

      <h2 style={styles.h2}>7. Limitation of Liability</h2>
      <p style={styles.p}>
        To the maximum extent permitted by law, MyLife shall not be liable for any
        indirect, incidental, special, consequential, or punitive damages arising
        from your use of the Service, including but not limited to loss of data,
        loss of profits, or health-related decisions made based on data in the
        application.
      </p>

      <h2 style={styles.h2}>8. Data Loss</h2>
      <p style={styles.p}>
        Since MyLife stores data locally on your device, you are responsible for
        maintaining backups. We provide backup and restore tools within the
        application, but we are not liable for data loss due to device failure,
        accidental deletion, or other causes.
      </p>

      <h2 style={styles.h2}>9. Modifications</h2>
      <p style={styles.p}>
        We may update these Terms from time to time. Material changes will be
        communicated through the application. Continued use after changes
        constitutes acceptance.
      </p>

      <h2 style={styles.h2}>10. Termination</h2>
      <p style={styles.p}>
        You may stop using MyLife at any time. Your local data remains on your
        device unless you choose to delete it. We may suspend or terminate access
        to cloud features for violations of these Terms.
      </p>

      <h2 style={styles.h2}>11. Governing Law</h2>
      <p style={styles.p}>
        These Terms are governed by the laws of the State of Washington, United
        States, without regard to conflict of law provisions.
      </p>

      <p style={{ ...styles.p, marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        See also: <Link href="/legal/privacy" style={styles.link}>Privacy Policy</Link>
        {' | '}
        <Link href="/legal/health-data" style={styles.link}>Health Data Details</Link>
      </p>
    </div>
  );
}
