import { approvePending, cancelPending, expireStaleProposals, rejectPending } from './actions';
import { ConfirmField, Pager, ReasonField, ResultBanner } from '../components/integrity';
import { requireModerator } from '@/lib/auth';
import { newActionToken } from '@/lib/console-integrity';
import { fetchPendingActionPage, type PendingActionRow } from '@/lib/console-queries';
import {
  PENDING_APPROVAL_MIN_ROLE,
  PENDING_KIND_LABEL,
  ROLE_LABEL,
  canApprovePending,
  type ModeratorRole,
} from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

function describeParams(row: PendingActionRow): string {
  const parts: string[] = [];
  const until = row.params.until;
  if (typeof until === 'string') parts.push(`until ${new Date(until).toLocaleString()}`);
  if (row.params.permanent === true) parts.push('permanent');
  const previous = row.params.previousState;
  if (typeof previous === 'string') parts.push(`was ${previous}`);
  const noticeKind = row.params.noticeKind;
  if (typeof noticeKind === 'string') parts.push(`${noticeKind} notice`);
  return parts.join(' · ');
}

function PendingRow({
  row,
  role,
  moderatorEmail,
}: {
  row: PendingActionRow;
  role: ModeratorRole;
  moderatorEmail: string;
}) {
  const token = newActionToken();
  const isProposer = row.proposedBy.trim().toLowerCase() === moderatorEmail;
  const roleAllows = canApprovePending(role, row.kind);
  const expired = Date.parse(row.expiresAt) <= Date.now();
  const open = row.state === 'pending';

  return (
    <tr>
      <td>
        <strong>{PENDING_KIND_LABEL[row.kind]}</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {describeParams(row) || 'no extra parameters'}
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
          needs {ROLE_LABEL[PENDING_APPROVAL_MIN_ROLE[row.kind]]} to approve
        </div>
      </td>
      <td>
        <span className="badge">{row.targetKind}</span>
        {row.targetHandle ? <div style={{ marginTop: 4 }}>@{row.targetHandle}</div> : null}
        <div className="mono" style={{ fontSize: 12 }}>
          {row.targetId}
        </div>
        {row.targetVersion !== null ? (
          <div className="muted" style={{ fontSize: 11 }}>
            proposed at v{row.targetVersion}
          </div>
        ) : null}
      </td>
      <td>
        <div className="mono" style={{ fontSize: 12 }}>
          {row.proposedBy}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          {new Date(row.proposedAt).toLocaleString()}
        </div>
        <div style={{ marginTop: 6 }}>{row.reason}</div>
      </td>
      <td>
        <span className={`badge ${row.state === 'failed' ? 'warn' : ''}`}>{row.state}</span>
        {expired && open ? (
          <div style={{ marginTop: 4 }}>
            <span className="badge warn">expired</span>
          </div>
        ) : null}
        {row.decidedBy ? (
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {row.state} by {row.decidedBy}
          </div>
        ) : null}
        {row.executionOutcome ? (
          <div className="muted" style={{ fontSize: 12 }}>
            outcome: {row.executionOutcome}
          </div>
        ) : null}
      </td>
      <td>
        {!open ? (
          <span className="muted">already decided</span>
        ) : isProposer ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="banner error" style={{ fontSize: 12 }}>
              You proposed this, so you cannot approve it. A second moderator has to.
            </div>
            <form className="row-form inline" action={cancelPending}>
              <input type="hidden" name="pendingId" value={row.id} />
              <input type="hidden" name="token" value={`${token}-cancel`} />
              <ReasonField placeholder="why you are withdrawing it" />
              <button type="submit">Withdraw</button>
            </form>
          </div>
        ) : !roleAllows ? (
          <span className="muted" style={{ fontSize: 12 }}>
            Approving this needs {ROLE_LABEL[PENDING_APPROVAL_MIN_ROLE[row.kind]]}.
          </span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <form className="row-form inline" action={approvePending}>
              <input type="hidden" name="pendingId" value={row.id} />
              <input type="hidden" name="token" value={`${token}-approve`} />
              <ReasonField placeholder="reason (required, audited)" />
              <ConfirmField label="Approve and apply now" />
              <button className="danger" type="submit">
                Approve
              </button>
            </form>
            <form className="row-form inline" action={rejectPending}>
              <input type="hidden" name="pendingId" value={row.id} />
              <input type="hidden" name="token" value={`${token}-reject`} />
              <ReasonField placeholder="reason (required, audited)" />
              <button type="submit">Reject</button>
            </form>
          </div>
        )}
      </td>
    </tr>
  );
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; view?: string; cursor?: string }>;
}) {
  const moderator = await requireModerator();
  const params = await searchParams;
  const showAll = params.view === 'all';
  const admin = createAdminClient();
  const page = await fetchPendingActionPage(admin, {
    openOnly: !showAll,
    limit: PAGE_SIZE,
    cursor: params.cursor ?? null,
  });

  return (
    <>
      <h1>Approvals</h1>
      <ResultBanner ok={params.ok} error={params.error} />

      <div className="card">
        <p className="muted" style={{ fontSize: 13 }}>
          High-impact actions land here instead of taking effect: suspensions over seven days,
          account terminations, restoring removed content, and blocking or unblocking payouts. The
          moderator who proposed an action can never approve it, and approving executes the action in
          the same transaction, so an approved proposal is either applied or rolled back and marked
          failed.
        </p>
        <div className="row-form inline">
          <a className="nav-link" href="/approvals">
            Waiting
          </a>
          <a className="nav-link" href="/approvals?view=all">
            All proposals
          </a>
          <form action={expireStaleProposals}>
            <button type="submit">Expire stale proposals</button>
          </form>
        </div>
      </div>

      {page.items.length === 0 ? (
        <div className="card muted">
          {showAll ? 'No proposals have been made.' : 'Nothing is waiting for a second moderator.'}
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Target</th>
                <th>Proposed by</th>
                <th>State</th>
                <th>Decide</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((row) => (
                <PendingRow
                  key={row.id}
                  row={row}
                  role={moderator.role}
                  moderatorEmail={moderator.email}
                />
              ))}
            </tbody>
          </table>
          <Pager
            basePath="/approvals"
            nextCursor={page.nextCursor}
            extraParams={showAll ? { view: 'all' } : undefined}
          />
        </div>
      )}
    </>
  );
}
