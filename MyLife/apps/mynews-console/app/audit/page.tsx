import { exportAudit } from './actions';
import { describeChainResult, verifyAuditExport } from '@/lib/audit-chain';
import { requireLevel, requireModerator } from '@/lib/auth';
import {
  exportAuditChain,
  fetchAuditChainHead,
  fetchConsoleAudit,
  verifyAuditChainInSql,
} from '@/lib/console-queries';
import { ROLE_LABEL } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/** How many recent rows the page re-verifies in TypeScript on every load. */
const INDEPENDENT_WINDOW = 500;

function summarizeSqlVerdict(verdict: unknown): { ok: boolean; text: string } {
  if (!verdict || typeof verdict !== 'object') {
    return { ok: false, text: 'The chain could not be verified.' };
  }
  const value = verdict as Record<string, unknown>;
  if (value.ok === true) {
    const checked = typeof value.checked === 'number' ? value.checked : 0;
    if (checked === 0) return { ok: true, text: 'No audit rows yet.' };
    return {
      ok: true,
      text: `Chain intact across ${checked} rows (seq ${String(value.firstSeq)} to ${String(
        value.lastSeq,
      )}).`,
    };
  }
  return {
    ok: false,
    text: `Chain broken at seq ${String(value.badSeq)}: ${String(value.reason)}.`,
  };
}

/**
 * The console audit log and its chain verification.
 *
 * nw_console_audit records every console action including the refusals: an
 * insufficient role, a stale version, a self-approval attempt, and a rolled-back
 * multi-step enforcement all leave a row. That is deliberate, because an attempt
 * that was refused is exactly what an investigation wants to see.
 *
 * The table refuses UPDATE, DELETE, and TRUNCATE by trigger, and each row hashes
 * the one before it, so editing history requires breaking a hash the export
 * verifies.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    exported?: string;
    from?: string;
    verified?: string;
    reason?: string;
    badSeq?: string;
    actor?: string;
    action?: string;
  }>;
}) {
  const moderator = await requireModerator();
  const params = await searchParams;
  if (!requireLevel(moderator, 'admin')) {
    return (
      <>
        <h1>Console audit</h1>
        <div className="card">
          <p>
            The audit log and its export are admin-only. You are signed in as{' '}
            <span className="mono">{moderator.email}</span> with the {ROLE_LABEL[moderator.role]}{' '}
            role.
          </p>
        </div>
      </>
    );
  }

  const admin = createAdminClient();
  const [rows, head, sqlVerdict] = await Promise.all([
    fetchConsoleAudit(admin, {
      limit: 100,
      actorRef: params.actor ?? null,
      action: params.action ?? null,
    }),
    fetchAuditChainHead(admin),
    verifyAuditChainInSql(admin),
  ]);
  const verdict = summarizeSqlVerdict(sqlVerdict);

  // The independent check. The SQL verdict above is the database reporting on
  // itself; this recomputes every hash in TypeScript from the exported bytes, so
  // the screen shows an answer that does not depend on the same code path. It is
  // bounded to the most recent window because verifying the whole chain on every
  // page load would grow without limit; the export screen below covers the rest.
  const windowFrom = head ? Math.max(0, head.seq - INDEPENDENT_WINDOW) : 0;
  const recentExport = await exportAuditChain(admin, {
    fromSeq: windowFrom,
    limit: INDEPENDENT_WINDOW,
  });
  const independent = recentExport
    ? describeChainResult(verifyAuditExport(recentExport))
    : 'The independent check could not read the chain.';
  const independentOk = recentExport ? verifyAuditExport(recentExport).ok : false;

  return (
    <>
      <h1>Console audit</h1>

      {params.error ? (
        <div className="banner error">The export failed ({params.error}).</div>
      ) : null}
      {params.verified === 'ok' ? (
        <div className="banner ok">
          Exported {params.exported} rows from seq {params.from}. The chain verified independently in
          TypeScript from the exported bytes. Download it below to keep a copy.
        </div>
      ) : null}
      {params.verified === 'broken' ? (
        <div className="banner error">
          The exported window did NOT verify: {params.reason}
          {params.badSeq ? ` at seq ${params.badSeq}` : ''}. Treat the audit log as compromised and
          investigate before relying on it.
        </div>
      ) : null}

      <div className={`banner ${verdict.ok ? 'ok' : 'error'}`}>
        Database check: {verdict.text}
      </div>
      <div className={`banner ${independentOk ? 'ok' : 'error'}`}>
        Independent check (recomputed here, last {INDEPENDENT_WINDOW} rows): {independent}
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="value">{head ? head.seq : 0}</div>
          <div className="label">chain length (last seq)</div>
        </div>
        <div className="stat">
          <div className="value mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
            {head ? head.rowHash.slice(0, 16) : 'empty'}
          </div>
          <div className="label">head hash (first 16 hex)</div>
        </div>
      </div>

      <div className="card">
        <h2>Verifiable export</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          The export carries each row&apos;s exact payload text, its hashes, and the anchor hash the
          window starts from, so a recipient recomputes every hash without database access. The
          document also states the verification recipe.
        </p>
        <form className="row-form inline" action={exportAudit}>
          <input type="number" name="fromSeq" min={0} defaultValue={0} placeholder="from seq" />
          <button type="submit">Verify export window</button>
        </form>
        <p style={{ marginTop: 8 }}>
          <a className="nav-link" href="/audit/export?from=0" download>
            Download the full export
          </a>
        </p>
      </div>

      <div className="card">
        <h2>Recent actions</h2>
        <form className="row-form inline" method="get" action="/audit">
          <input type="text" name="actor" defaultValue={params.actor ?? ''} placeholder="actor email" />
          <input
            type="text"
            name="action"
            defaultValue={params.action ?? ''}
            placeholder="action, e.g. hide_article"
          />
          <button type="submit">Filter</button>
          {params.actor || params.action ? (
            <a className="nav-link" href="/audit">
              Clear
            </a>
          ) : null}
        </form>
        {rows.length === 0 ? (
          <p className="muted">No audit rows match.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Seq</th>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Outcome</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.seq}>
                  <td className="mono">{row.seq}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {row.actorRef}
                    <div className="muted">{row.actorRole}</div>
                  </td>
                  <td>{row.action}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {row.targetKind}
                    <div>{row.targetId}</div>
                  </td>
                  <td>
                    <span className={`badge ${row.outcome === 'ok' ? '' : 'warn'}`}>
                      {row.outcome}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
