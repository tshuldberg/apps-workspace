import type { Metadata } from 'next';
import Link from 'next/link';
import { readWebLegalContext } from '@/lib/capabilities';

// Legal hub: links to every legal document plus the EU DSA information. No data
// reads, but rendered per request because every capability-dependent claim (the
// support rail, the published contact channels) comes from this deployment's
// server environment rather than a frozen constant.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Legal | MyNews',
  description:
    'MyNews legal hub: Terms of Service, Privacy Policy, Community Guidelines, DMCA / copyright, and EU Digital Services Act information (single point of contact, notice mechanism, statement of reasons).',
};

export default function LegalPage() {
  const { capabilities, contacts, legal } = readWebLegalContext();

  const docs: Array<{ href: string; title: string; summary: string }> = [
    { href: '/legal/terms', title: legal.terms.title, summary: legal.terms.summary },
    { href: '/legal/privacy', title: legal.privacy.title, summary: legal.privacy.summary },
    {
      href: '/legal/guidelines',
      title: legal.guidelines.title,
      summary: legal.guidelines.summary,
    },
    {
      href: '/legal/dmca',
      title: 'DMCA / Copyright',
      summary: 'File a copyright notice or counter-notice and read the repeat-infringer policy.',
    },
    {
      href: '/legal/appeals',
      title: 'Appeals',
      summary: 'How to contest a moderation decision about your own content, and who reviews it.',
    },
  ];

  return (
    <main className="shell">
      <h1>Legal</h1>
      <p>
        The documents and policies that govern MyNews. MyNews is an open-journalism platform:
        signed bylines, author-controlled edits,{' '}
        {capabilities.payments ? 'direct reader support with a 2% platform fee, and ' : 'and '}
        zero ads.
      </p>

      <section aria-label="Legal documents">
        <h2 className="section-title">Documents</h2>
        <ul className="legal-index">
          {docs.map((doc) => (
            <li key={doc.href} className="legal-index-item">
              <Link className="card-link" href={doc.href}>
                {doc.title}
              </Link>
              <span className="muted"> {doc.summary}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="EU Digital Services Act">
        <h2 className="section-title">EU Digital Services Act</h2>
        <p>
          MyNews provides the mechanisms the EU Digital Services Act (DSA) requires for users in the
          European Union.
        </p>
        <p>
          <strong>Notice and action (Art 16).</strong> Anyone can report illegal or infringing
          content for review. In the app, use the report tool on any article, revision, suggestion,
          or profile. Copyright notices can also be filed on the{' '}
          <Link className="card-link" href="/legal/dmca">
            DMCA page
          </Link>
          . We review reports and take action where warranted.
        </p>
        <p>
          <strong>Statement of reasons (Art 17).</strong> When we remove or restrict content, the
          affected author receives a statement of reasons explaining the decision. In the MyNews app,
          open <strong>Notices</strong> (in the Me tab) to see the statements of reasons for actions
          taken against your own content. A user can only see statements about their own content.
        </p>
        <p>
          <strong>Internal complaint handling (Art 20).</strong> Every adverse action can be appealed
          once, and an appeal is always read by a moderator other than the one who took the action.
          Appeals are filed in the app under <strong>Notices</strong>; the{' '}
          <Link className="card-link" href="/legal/appeals">
            appeals page
          </Link>{' '}
          explains what can be appealed and what happens when one is granted.
        </p>
        {capabilities.emailContact ? (
          <p>
            <strong>Single point of contact (Art 11 / 12).</strong> Authorities and users can reach
            our point of contact for the DSA at <strong>{contacts.dsaContactEmail}</strong>. For
            urgent safety matters, including non-consensual intimate imagery, use{' '}
            <strong>{contacts.safetyEmail}</strong>. For copyright, use{' '}
            <strong>{contacts.dmcaEmail}</strong>. English is available for communications.
          </p>
        ) : (
          <p>
            <strong>Single point of contact (Art 11 / 12).</strong> This deployment has no published
            email contact channel configured, so no address is listed here. Notices reach us through
            the in-app report tool and the{' '}
            <Link className="card-link" href="/legal/dmca">
              DMCA page
            </Link>
            .
          </p>
        )}
      </section>

      {capabilities.emailContact ? (
        <section aria-label="Contact">
          <h2 className="section-title">Contact</h2>
          <p>
            General and legal questions: <strong>{contacts.dsaContactEmail}</strong>. Safety and
            NCII: <strong>{contacts.safetyEmail}</strong>. Copyright / DMCA:{' '}
            <strong>{contacts.dmcaEmail}</strong>.
          </p>
        </section>
      ) : null}

      <footer className="footer-note">
        These pages describe how MyNews works; they are not legal advice.
      </footer>
    </main>
  );
}
