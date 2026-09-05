import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_DELETION_REMOVED,
  ACCOUNT_DELETION_RETAINED,
  DELETION_CONFIRMATION_PHRASE,
} from '@mylife/mynews/cloud-fetch';
import { readWebLegalContext } from '@/lib/capabilities';

// Public account-deletion information page (plan 48 WP5).
//
// Honesty boundary: this site has no sign-in yet, and the deletion request has
// to be attributable to an account, so there is deliberately NO form here. A
// form that collected an email address would either do nothing or imply an
// email-verified deletion channel that is not wired (mail delivery is a
// founder-ops step). The page explains exactly where deletion happens, what the
// grace period is, and what is kept versus removed, and it publishes the legal
// contact only when this deployment actually has one.
//
// Rendered per request because the contact line is capability-dependent.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Delete your account | MyNews',
  description:
    'How to delete your MyNews account, the grace period you can cancel inside, and exactly what is kept versus removed.',
};

export default function AccountDeletePage() {
  const { capabilities, contacts } = readWebLegalContext();

  return (
    <main className="shell">
      <p className="muted">
        <Link className="card-link" href="/legal">
          Legal
        </Link>{' '}
        / Delete your account
      </p>
      <h1>Delete your account</h1>
      <p>
        You delete your MyNews account from inside the MyNews app, on the device where you are
        signed in: open <strong>Me</strong>, then <strong>Delete my account</strong>. The app asks
        you to type <strong>{DELETION_CONFIRMATION_PHRASE}</strong> and to have signed in recently,
        then starts the grace period.
      </p>
      <p>
        There is no form on this page on purpose. Deletion has to be tied to your account, and this
        website does not sign you in yet. A form here could not verify who you are, so it would
        either do nothing or pretend to.
      </p>

      <section aria-label="Grace period">
        <h2 className="section-title">The {ACCOUNT_DELETION_GRACE_DAYS}-day grace period</h2>
        <p>
          Confirming deletion does not remove anything straight away. It schedules the deletion for{' '}
          {ACCOUNT_DELETION_GRACE_DAYS} days later and you can cancel at any point inside that
          window from the same screen. Your account and content stay exactly as they were until the
          window ends. Once the window ends and deletion starts, it can no longer be cancelled.
        </p>
        <p>
          When the deletion runs, the app shows you the outcome of each step. If a step is not
          configured on the server your account lives on, the app says so rather than reporting it
          as done.
        </p>
      </section>

      <section aria-label="Export your data first">
        <h2 className="section-title">Export your data first</h2>
        <p>
          Before you delete anything, use <strong>Me</strong>, then{' '}
          <strong>Export my data</strong> in the app. It builds one JSON file containing everything
          your account owns, including your articles and their full revision history. Deletion
          cannot be undone once the grace period ends.
        </p>
      </section>

      <section aria-label="What is kept">
        <h2 className="section-title">What we keep</h2>
        <ul className="legal-index">
          {ACCOUNT_DELETION_RETAINED.map((line) => (
            <li key={line} className="legal-index-item">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="What is deleted">
        <h2 className="section-title">What we delete</h2>
        <ul className="legal-index">
          {ACCOUNT_DELETION_REMOVED.map((line) => (
            <li key={line} className="legal-index-item">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Contact">
        <h2 className="section-title">If you cannot use the app</h2>
        {capabilities.emailContact ? (
          <p>
            Write to {contacts.dsaContactEmail}. Include the handle of the account so we can
            identify it. We will confirm your identity before acting on the request.
          </p>
        ) : (
          <p>
            This deployment has not published a contact address yet, so the app is the only way to
            delete an account today. We will not list an address here that nobody reads.
          </p>
        )}
        <p className="muted">
          The{' '}
          <Link className="card-link" href="/legal/privacy">
            Privacy Policy
          </Link>{' '}
          describes deletion and export as part of your rights.
        </p>
      </section>
    </main>
  );
}
