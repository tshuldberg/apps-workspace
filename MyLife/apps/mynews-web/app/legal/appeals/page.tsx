import type { Metadata } from 'next';
import Link from 'next/link';
import { readWebLegalContext } from '@/lib/capabilities';

/**
 * Appeals explainer (plan 48 WP9).
 *
 * This page does NOT carry an appeal form, and that is deliberate rather than a
 * gap. An appeal has to be attributed to the account that owns the content being
 * appealed: without that, the form would either accept unauthenticated appeals
 * (which is an abuse channel against other people's content) or collect details
 * it cannot act on. The app already holds that signed-in account, so the appeal
 * is filed there and this page says exactly where and what happens next.
 *
 * Rendered per request because every contact claim comes from this deployment's
 * environment rather than a frozen constant.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Appeals | MyNews',
  description:
    'How to appeal a MyNews moderation decision: what can be appealed, how to file an appeal in the app, who reviews it, and what happens if it is granted.',
};

export default function AppealsPage() {
  const { capabilities, contacts } = readWebLegalContext();

  return (
    <main className="shell">
      <h1>Appealing a moderation decision</h1>
      <p>
        If MyNews removed or restricted something of yours, you can contest it. Every adverse action
        comes with a statement of reasons, and every statement of reasons can be appealed once.
      </p>

      <section aria-label="What can be appealed">
        <h2 className="section-title">What can be appealed</h2>
        <ul>
          <li>An article of yours that was retracted by a moderator.</li>
          <li>An edit suggestion of yours that was removed.</li>
          <li>A suspension of your account.</li>
          <li>
            A submission held before publication by our pre-publication screening, including one
            held automatically.
          </li>
        </ul>
        <p className="muted">
          Reports you filed about other people are not appeals: an appeal contests an action taken
          against you. A report that was dismissed is not an adverse action against you, so there is
          nothing to appeal there.
        </p>
      </section>

      <section aria-label="How to appeal">
        <h2 className="section-title">How to appeal</h2>
        <p>
          Appeals are filed in the MyNews app, under <strong>Notices</strong> in the Me tab. Each
          notice carries an <strong>Appeal this decision</strong> action; held submissions are under{' '}
          <strong>Held submissions</strong> and work the same way.
        </p>
        <p>
          There is no appeal form on this website. An appeal has to be attached to the account that
          owns the content, and this site does not hold your signed-in session, so a form here would
          either take appeals from anyone about anyone (which we will not build) or collect
          information we could not act on. Rather than show you a form that cannot work, we are
          telling you where the one that does work is.
        </p>
      </section>

      <section aria-label="What happens next">
        <h2 className="section-title">What happens next</h2>
        <p>
          Your appeal goes into a review queue and is read by a person. It is never decided by the
          same moderator whose decision you are appealing: our console refuses that, so the review is
          always a second pair of eyes.
        </p>
        <p>
          If the appeal is granted, the original action is reversed in the same step as the decision:
          a retracted article is published again, a removed suggestion reopens, a suspension is
          lifted. If a reversal cannot be applied automatically, the outcome says so instead of
          implying your content came back. If the appeal is denied, you see the reason.
        </p>
        <p>
          One appeal per decision. That limit exists so a queue that people rely on for genuine
          mistakes cannot be flooded, not to cut you off: if new facts appear after a denial, use the
          contact route below.
        </p>
      </section>

      <section aria-label="Copyright is different">
        <h2 className="section-title">Copyright removals are different</h2>
        <p>
          If your content was removed after a copyright notice, a DMCA{' '}
          <strong>counter-notice</strong> is a stronger and separate route with its own statutory
          process and timelines. Start on the{' '}
          <Link className="card-link" href="/legal/dmca">
            DMCA page
          </Link>
          . You can do both, but the counter-notice is the one with legal effect.
        </p>
      </section>

      <section aria-label="Other routes">
        <h2 className="section-title">Other routes</h2>
        {capabilities.emailContact ? (
          <p>
            You can also write to <strong>{contacts.dsaContactEmail}</strong>. For safety matters,
            including non-consensual intimate imagery, use <strong>{contacts.safetyEmail}</strong>.
          </p>
        ) : (
          <p>
            This deployment has no published email contact channel configured, so no address is
            listed here. The in-app appeal route above is the working one.
          </p>
        )}
        <p className="muted">
          Under the EU Digital Services Act, the in-app appeal is our internal complaint-handling
          system (Art 20). It does not remove your right to go to a court or an out-of-court dispute
          settlement body.
        </p>
      </section>

      <footer className="footer-note">
        <Link className="card-link" href="/legal">
          Back to Legal
        </Link>
      </footer>
    </main>
  );
}
