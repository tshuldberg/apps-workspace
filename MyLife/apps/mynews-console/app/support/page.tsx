import { requireModerator } from '@/lib/auth';
import { supportRunLabel } from '@/lib/support-runs';
import {
  fetchSupportReconciliationRuns,
  type SupportReconciliationRunRow,
} from '@/lib/queue';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Read-only view of the support-ledger reconciliation worker's output. There are
 * no actions here on purpose: the support ledger is append-only by database
 * trigger, so a mismatch is an engineering signal, not something a moderator can
 * edit away.
 */
function RunRow({ run, nowMs }: { run: SupportReconciliationRunRow; nowMs: number }) {
  const label = supportRunLabel(run, nowMs);
  return (
    <tr>
      <td>
        <span className={`badge ${run.ok ? 'ok' : 'warn'}`}>{label.outcome}</span>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          {label.age}
        </div>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          {new Date(run.finishedAt).toLocaleString()}
        </div>
      </td>
      <td>
        <div>{run.ledgerRows} ledger rows</div>
        <div className="muted" style={{ fontSize: 12 }}>
          {run.pairCount} support pairs
        </div>
        <div className="mono" style={{ marginTop: 4, fontSize: 12 }}>
          {run.workerRef}
        </div>
      </td>
      <td>
        {run.mismatchCount === 0 ? (
          <span className="muted">No invariant violations.</span>
        ) : (
          <>
            <span className={`badge ${run.ok ? '' : 'warn'}`}>{label.mismatches}</span>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {run.findings.map((finding, index) => (
                <li key={index} style={{ fontSize: 12 }}>
                  {finding}
                </li>
              ))}
            </ul>
            {run.findings.length < run.mismatchCount ? (
              <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                Showing the first {run.findings.length}; the run recorded{' '}
                {run.mismatchCount} in total.
              </div>
            ) : null}
          </>
        )}
      </td>
    </tr>
  );
}

export default async function SupportReconciliationPage() {
  await requireModerator();
  const runs = await fetchSupportReconciliationRuns(createAdminClient());
  const nowMs = Date.now();
  const failing = runs.filter((run) => !run.ok);

  return (
    <>
      <h1>Support ledger reconciliation</h1>
      <p className="muted">
        Output of the <span className="mono">mynews-support-worker</span> pass over the append-only
        support ledger. Read-only: a mismatch is an engineering signal, not a moderation action.
      </p>

      {runs.length === 0 ? (
        <p className="muted">
          No reconciliation run has been recorded yet. The worker writes a row on every pass; an
          empty list means it has not run against this project, not that the ledger is clean.
        </p>
      ) : (
        <>
          {failing.length > 0 ? (
            <div className="banner error">
              {failing.length} of the last {runs.length} runs did not reconcile. Investigate before
              trusting journalist earnings figures.
            </div>
          ) : null}
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Scope</th>
                <th>Findings</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <RunRow key={run.id} run={run} nowMs={nowMs} />
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
