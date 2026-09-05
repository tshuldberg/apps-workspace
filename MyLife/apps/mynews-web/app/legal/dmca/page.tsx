import type { Metadata } from 'next';
import Link from 'next/link';
import {
  DMCA_DESIGNATED_AGENT_EMAIL,
  DMCA_REPEAT_INFRINGER_THRESHOLD,
  DMCA_RESPONSE_SLA_HOURS,
} from '@mylife/mynews/cloud-fetch';
import { DmcaForm } from './DmcaForm';

/**
 * Rendered per request (plan 48 WP10). This page carries the only interactive
 * form on the public site, and the site's Content-Security-Policy carries a
 * per-response nonce that Next can only stamp onto script tags while rendering.
 * Prerendered, this page's scripts would be blocked by that CSP and the notice
 * form would silently stop working, which is the one regression this deliverable
 * could not afford.
 */
export const dynamic = 'force-dynamic';

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'A notice arrives',
    body: 'A copyright owner (or their agent) sends a DMCA notice through the form below or by email. The notice must identify the work, the infringing URL, and include the good-faith and accuracy statements and a signature.',
  },
  {
    title: 'We review it',
    body: 'Our moderation team reviews the notice against the reported material. Complete, good-faith notices are actioned; the infringing material is retracted.',
  },
  {
    title: 'A strike is recorded',
    body: 'When we remove material for copyright infringement, we record a copyright strike against the account that posted it. Strikes are audited.',
  },
  {
    title: 'Counter-notice',
    body: 'The poster may file a complete counter-notice if they believe the removal was a mistake or misidentification. After forwarding it to the claimant, restoration is tracked through the statutory 10 to 14 business-day window unless litigation is reported.',
  },
];

// Static shell + a client form. No data reads, safe to prerender.

export const metadata: Metadata = {
  title: 'DMCA notice | MyNews',
  description:
    'File a DMCA takedown notice or a counter-notice. The required elements, the response process, and the repeat-infringer policy.',
};

export default function DmcaPage() {
  return (
    <main className="shell">
      <h1>DMCA notices</h1>
      <p>
        MyNews responds to notices of claimed copyright infringement that comply with the Digital
        Millennium Copyright Act. You do not need a MyNews account to file a notice. Notices are
        reviewed by our moderation team and, where warranted, the material is removed and a copyright
        strike is recorded against the poster.
      </p>
      <p className="muted">
        We aim to review properly formed notices within {DMCA_RESPONSE_SLA_HOURS} hours. You can also
        email a notice to <strong>{DMCA_DESIGNATED_AGENT_EMAIL}</strong>. Back to the{' '}
        <Link className="card-link" href="/legal">
          legal hub
        </Link>
        .
      </p>
      <p className="muted">
        We are in the process of registering a designated agent with the U.S. Copyright Office. Until
        that registration is confirmed, the address above is the point of contact for copyright
        notices. We do not claim a completed registration we have not made.
      </p>

      <section aria-label="Notice and takedown">
        <h2 className="section-title">Notice and takedown</h2>
        <ol className="lifecycle">
          {STEPS.map((step) => (
            <li key={step.title} className="lifecycle-step">
              <span className="lifecycle-stage">{step.title}</span>
              <span className="lifecycle-copy">{step.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Repeat infringer policy">
        <h2 className="section-title">Repeat-infringer policy</h2>
        <p>
          MyNews suspends the accounts of repeat infringers. Each time we remove material for
          copyright infringement, we record a strike against the posting account. An account that
          reaches {DMCA_REPEAT_INFRINGER_THRESHOLD} copyright strikes is suspended. Strikes and
          suspensions are recorded in an internal audit trail.
        </p>
      </section>

      <section aria-label="File a DMCA submission">
        <h2 className="section-title">File a takedown notice or counter-notice</h2>
        <p>
          Choose the submission type first. Takedown notices and counter-notices have different
          required statements. The server resolves the public URL and queues submissions that need
          manual URL or original-notice matching rather than dropping them.
        </p>
        <DmcaForm />
      </section>

      <footer className="footer-note">
        This form provides the DMCA-required elements and a record of your attestations. It is not
        legal advice. Filing a knowingly false notice may carry liability under 17 U.S.C. 512(f).
      </footer>
    </main>
  );
}
