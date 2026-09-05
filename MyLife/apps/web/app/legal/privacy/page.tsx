import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - MyLife',
  description: 'MyLife privacy policy, including consumer health data privacy policy.',
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
  h3: {
    fontSize: 16,
    fontWeight: 600,
    marginTop: 24,
    marginBottom: 8,
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
  healthBanner: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    marginTop: 16,
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

export default function PrivacyPolicyPage() {
  return (
    <div style={styles.page}>
      <Link href="/settings" style={styles.backLink}>
        &larr; Back to Settings
      </Link>

      <h1 style={styles.h1}>Privacy Policy</h1>
      <p style={styles.lastUpdated}>Last updated: April 4, 2026</p>

      <p style={styles.p}>
        MyLife (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy.
        This Privacy Policy describes how we collect, use, and safeguard your information
        when you use the MyLife application.
      </p>

      <h2 style={styles.h2}>1. Data Storage and Privacy Model</h2>
      <p style={styles.p}>
        MyLife is designed as a privacy-first, local-only application. The vast majority
        of your data is stored exclusively on your device in a local SQLite database.
        We do not collect analytics, telemetry, or crash reports that contain personally
        identifiable information.
      </p>
      <p style={styles.p}>
        Certain modules (Forums, Homes, Market, Surf) use cloud storage (Supabase)
        for community features. This data syncs only with your authenticated account
        and is protected by Row Level Security policies.
      </p>

      <h2 style={styles.h2}>2. Information We Collect</h2>
      <p style={styles.p}>
        We collect only the information necessary to provide the MyLife service:
      </p>
      <ul style={styles.ul}>
        <li style={styles.li}>Account information (email, display name) when you optionally create an account</li>
        <li style={styles.li}>Subscription status for billing purposes</li>
        <li style={styles.li}>Error reports that do not contain personally identifiable data</li>
      </ul>
      <p style={styles.p}>
        All module data (health records, financial data, journal entries, etc.) stays
        on your device unless you explicitly use a cloud-enabled module.
      </p>

      <h2 style={styles.h2}>3. Data We Do NOT Collect</h2>
      <ul style={styles.ul}>
        <li style={styles.li}>We do not track your location, browsing activity, or app usage patterns</li>
        <li style={styles.li}>We do not sell, share, or transmit your personal data to third parties</li>
        <li style={styles.li}>We do not serve advertisements or use your data for ad targeting</li>
        <li style={styles.li}>We do not use your data to train machine learning models</li>
      </ul>

      <h2 style={styles.h2}>4. Consumer Health Data Privacy Policy</h2>
      <div style={styles.healthBanner}>
        <p style={{ ...styles.p, marginBottom: 0, color: '#10B981' }}>
          This section constitutes our Consumer Health Data Privacy Policy as required
          by the Washington My Health My Data Act (MHMDA), Nevada SB 370, Connecticut
          CTDPA, and similar state health privacy laws.
        </p>
      </div>

      <h3 style={styles.h3}>4.1 Health Data Modules</h3>
      <p style={styles.p}>
        The following MyLife modules collect consumer health data: Health, Meds, Cycle,
        Mood, Nutrition, Workouts, Fast, Habits, and Presence. Each module requires
        your explicit, affirmative consent before any health data collection begins.
      </p>

      <h3 style={styles.h3}>4.2 Types of Health Data Collected</h3>
      <p style={styles.p}>
        Depending on which modules you enable, the types of consumer health data
        may include: vital signs, medication records, menstrual cycle data, mood
        and mental health entries, dietary intake, exercise data, fasting periods,
        wellness habits, and screen time metrics. A detailed breakdown is provided
        in the consent dialog for each module and on
        our <Link href="/legal/health-data" style={styles.link}>Health Data Details</Link> page.
      </p>

      <h3 style={styles.h3}>4.3 How Health Data Is Stored</h3>
      <p style={styles.p}>
        All consumer health data is stored locally on your device in an encrypted
        SQLite database. We never transmit, sell, share, or provide access to your
        health data to any third party for any purpose.
      </p>

      <h3 style={styles.h3}>4.4 Your Rights</h3>
      <ul style={styles.ul}>
        <li style={styles.li}>
          <strong>Consent:</strong> You may grant or withdraw consent for health data
          collection at any time in Settings &gt; Health Data Consent.
        </li>
        <li style={styles.li}>
          <strong>Deletion:</strong> You may request deletion of all consumer health
          data at any time. We will complete deletion within 30 days of your request.
        </li>
        <li style={styles.li}>
          <strong>Access:</strong> You may export your health data at any time using
          the data export feature in Settings.
        </li>
        <li style={styles.li}>
          <strong>No sale:</strong> We will never sell your consumer health data.
        </li>
      </ul>

      <h3 style={styles.h3}>4.5 Health and Wellness Disclaimer</h3>
      <p style={styles.p}>
        MyLife is not a medical device and does not provide medical advice, diagnosis,
        or treatment. Health-related modules are for personal tracking and
        informational purposes only. Always consult a qualified healthcare
        professional for medical decisions. Do not disregard professional medical
        advice or delay seeking treatment based on information in this application.
      </p>

      <h2 style={styles.h2}>5. Data Sharing</h2>
      <p style={styles.p}>
        MyLife includes optional social sharing features that are entirely opt-in.
        No data is shared unless you explicitly enable sharing for specific modules.
        All sharing can be anonymized. You control sharing preferences in
        Settings &gt; Sharing Preferences.
      </p>

      <h2 style={styles.h2}>6. Data Retention and Deletion</h2>
      <p style={styles.p}>
        Since your data is stored locally, you have full control over retention.
        You can delete individual module data or all data at any time through
        the Privacy Dashboard in Settings. When you disable a module, its data
        is preserved but not actively used. You can permanently delete it
        through the Privacy Dashboard.
      </p>

      <h2 style={styles.h2}>7. Children&apos;s Privacy</h2>
      <p style={styles.p}>
        MyLife is not directed at children under 13. We do not knowingly collect
        personal information from children under 13.
      </p>

      <h2 style={styles.h2}>8. Changes to This Policy</h2>
      <p style={styles.p}>
        We may update this Privacy Policy from time to time. We will notify you
        of material changes through the application. Your continued use of MyLife
        after changes constitutes acceptance of the updated policy.
      </p>

      <h2 style={styles.h2}>9. Contact</h2>
      <p style={styles.p}>
        For privacy-related questions or to exercise your data rights, contact us
        through the Settings screen in the application.
      </p>

      <p style={{ ...styles.p, marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        See also: <Link href="/legal/terms" style={styles.link}>Terms of Service</Link>
        {' | '}
        <Link href="/legal/health-data" style={styles.link}>Health Data Details</Link>
      </p>
    </div>
  );
}
