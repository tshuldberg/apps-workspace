import type { Metadata } from 'next';
import { BASE_POINTS } from '@mylife/mynews/engines';

/**
 * Explainer page with no data reads. It is nonetheless rendered per request
 * (plan 48 WP10): the site's Content-Security-Policy carries a per-response
 * nonce, and Next can only stamp that nonce onto its script tags while
 * rendering. A prerendered page's scripts were emitted at build time without
 * one, so under this CSP they would be blocked and the page would never
 * hydrate. Every route on this site is dynamic for that reason, and
 * `test/shell.test.ts` enforces it.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'How editing works | MyNews',
  description:
    'The MyNews editing desk: typed, cited suggestions from volunteer editors, author-controlled merges, and a public credibility ledger.',
};

const LIFECYCLE: Array<{ stage: string; copy: string }> = [
  { stage: 'DRAFT', copy: 'A journalist writes, alone or in a newsroom. Drafts are private to the author and newsroom members.' },
  { stage: 'PUBLISH', copy: 'The author signs and publishes revision 1 under a portable byline. The signed record is public from that moment.' },
  { stage: 'SUGGEST', copy: 'Any editor proposes a typed change with a rationale; corrections and context require citations. Near-duplicate suggestions collapse into endorsements.' },
  { stage: 'REVIEW', copy: 'The author reads each suggestion side by side with the live text and accepts, counter-edits, or rejects it, with a public thread.' },
  { stage: 'MERGE', copy: 'Accepted work lands as a new signed revision. The changelog credits every editor, and credibility points are awarded from the public ledger.' },
];

const TYPES: Array<{ type: keyof typeof BASE_POINTS; what: string; requirements: string }> = [
  { type: 'correction', what: 'A factual error fixed', requirements: 'At least one https citation' },
  { type: 'context', what: 'Missing background or context added', requirements: 'At least one https citation' },
  { type: 'translation', what: 'A translation of the piece', requirements: 'Rationale' },
  { type: 'clarity', what: 'Clearer wording, same meaning', requirements: 'Rationale' },
  { type: 'headline', what: 'A better headline or dek', requirements: 'Rationale' },
  { type: 'copyedit', what: 'Typos, grammar, punctuation', requirements: 'Rationale' },
];

export default function AboutEditingPage() {
  return (
    <main className="shell">
      <h1>How editing works</h1>
      <p>
        Journalists publish. Volunteer editors make articles better. The author stays in
        control, and every accepted improvement is credited publicly.
      </p>

      <section aria-label="Lifecycle">
        <h2 className="section-title">The lifecycle</h2>
        <ol className="lifecycle">
          {LIFECYCLE.map((step) => (
            <li key={step.stage} className="lifecycle-step">
              <span className="lifecycle-stage">{step.stage}</span>
              <span className="lifecycle-copy">{step.copy}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="The author-only rule">
        <h2 className="section-title">The author-only rule</h2>
        <blockquote className="rule">
          only the article&apos;s author can change the article&apos;s words
        </blockquote>
        <p>
          Editors propose; authors decide. Nothing merges without the author&apos;s signature,
          and every published revision keeps its full history public.
        </p>
      </section>

      <section aria-label="Suggestion types">
        <h2 className="section-title">The six suggestion types</h2>
        <table className="type-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>What it is</th>
              <th>Requirements</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {TYPES.map((row) => (
              <tr key={row.type}>
                <td>{row.type}</td>
                <td>{row.what}</td>
                <td>{row.requirements}</td>
                <td>{BASE_POINTS[row.type]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Credibility">
        <h2 className="section-title">Credibility, all math public</h2>
        <p>
          Each accepted suggestion earns its base weight, multiplied by acceptance diversity
          (0.3 to 1.5, more distinct authors is better), by author standing (0.5 to 1.2), and
          by a 12-month half-life decay so recent work counts most. Self-edits earn zero.
          Editors below 20% acceptance over their last 30 decided suggestions are throttled to
          3 open suggestions. The full ledger and the formula are public; nothing is
          hand-assigned.
        </p>
      </section>

      <footer className="footer-note">
        Suggesting happens in the MyNews app. This site is the public, read-only record.
      </footer>
    </main>
  );
}
