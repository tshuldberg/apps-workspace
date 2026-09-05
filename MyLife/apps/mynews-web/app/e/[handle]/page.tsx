import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadEditorProfile } from '@/lib/cloud';
import { OutageNotice, outageMetadata } from '@/app/components/OutageNotice';
import { buildEditorBreakdown, lineItemText } from '@/lib/editing';
import { publicOrigin } from '@/lib/origin';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ handle: string }>;
}

const KIND_LABELS = { reader: 'Reader', editor: 'Editor', journalist: 'Journalist' } as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const result = await loadEditorProfile(handle);
  if (result.state === 'outage') return outageMetadata();
  if (result.state !== 'ok') return { title: 'MyNews' };
  const profile = result.data;
  const url = `${publicOrigin()}/e/${encodeURIComponent(handle)}`;
  return {
    title: `${profile.profile.displayName} (@${profile.profile.handle}): editor profile | MyNews`,
    description: `Public credibility record for @${profile.profile.handle}, computed from the signed ledger.`,
    alternates: { canonical: url },
  };
}

export default async function EditorProfilePage({ params }: PageProps) {
  const { handle } = await params;
  const result = await loadEditorProfile(handle);
  if (result.state === 'outage') return <OutageNotice subject="this editor profile" />;
  if (result.state !== 'ok') notFound();

  const b = buildEditorBreakdown(result.data, Date.now());

  return (
    <main className="shell">
      <header className="journalist-header">
        <h1 className="journalist-name">
          {b.displayName}
          <span className="badge badge-kind">{KIND_LABELS[b.kind]}</span>
        </h1>
        <p className="journalist-handle">@{b.handle}</p>
        <p className="provenance">
          Computed from the public signed ledger · nothing hand-assigned
        </p>
      </header>

      <section className="cred" aria-label="Credibility breakdown">
        <div className="cred-total">
          <span className="cred-total-value">{b.total.toFixed(1)}</span>
          <span className="cred-total-label">weighted points</span>
          <span className="status-chip level-chip">{b.levelName}</span>
        </div>

        {b.emptyLedger ? (
          <p className="muted">No accepted suggestions yet.</p>
        ) : (
          <ul className="cred-lines">
            {b.lineItems.map((item) => (
              <li key={item.type}>{lineItemText(item)}</li>
            ))}
          </ul>
        )}

        <ul className="cred-mults">
          <li>
            Acceptance diversity: {b.distinctAuthors} distinct author
            {b.distinctAuthors === 1 ? '' : 's'} · x{b.diversityMult.toFixed(2)}
          </li>
          <li>Author standing (mean across awards) · x{b.standingMult.toFixed(2)}</li>
          <li>Every award decays with a 12-month half-life; recent work counts most.</li>
        </ul>

        {b.nextLevel ? (
          <div className="cred-next">
            <h2 className="section-title">Next level: {b.nextLevel.name}</h2>
            <ul className="cred-lines">
              {b.nextLevel.requirements.map((req) => (
                <li key={req}>{req}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="cred-guards">
          <h2 className="section-title">Anti-gaming</h2>
          <ul className="cred-lines">
            {b.pair ? (
              <li>
                Pair concentration: {b.pair.status}, top author is {b.pair.maxSharePct}% of
                awards
              </li>
            ) : null}
            <li>Self-edits: 0 pts</li>
            <li>Open-suggestion cap: {b.openCap}</li>
          </ul>
        </div>
      </section>

      <footer className="footer-note">
        The formula and the full ledger are public. <a href="/about/editing">How editing works</a>
      </footer>
    </main>
  );
}
