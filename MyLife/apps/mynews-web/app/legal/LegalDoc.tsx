import Link from 'next/link';
import type { LegalDocument } from '@mylife/mynews/cloud-fetch';

// Server component: renders a shared LegalDocument (from the module cloud-fetch
// subpath) as SSR HTML. Plain React + CSS only, no data reads. The same document
// data backs the in-app legal screens so the two surfaces never diverge.

export function LegalDoc({ doc }: { doc: LegalDocument }) {
  return (
    <main className="shell">
      <p className="muted">
        <Link className="card-link" href="/legal">
          Legal
        </Link>{' '}
        / {doc.title}
      </p>
      <h1>{doc.title}</h1>
      <p className="muted">Effective {doc.effectiveDate}</p>
      <p>{doc.intro}</p>

      {doc.sections.map((section) => (
        <section key={section.heading} aria-label={section.heading}>
          <h2 className="section-title">{section.heading}</h2>
          {section.paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </section>
      ))}

      <footer className="footer-note">
        This document is part of the MyNews legal hub. It describes how the service works; it is not
        legal advice.
      </footer>
    </main>
  );
}
