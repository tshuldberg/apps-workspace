import { claimCase, clearCase, ensureRemoved, escalateCase, escalateCaseOwnership } from './actions';
import {
  AssignmentControls,
  ConfirmField,
  IntegrityFields,
  Pager,
  ReasonField,
  ResultBanner,
  RoleGate,
  SearchBar,
} from '../components/integrity';
import { requireModerator } from '@/lib/auth';
import { newActionToken } from '@/lib/console-integrity';
import { fetchAssignments, type QueueAssignment } from '@/lib/console-queries';
import { caseClassLabel, nciiDeadlineLabel, nciiStatusLabel } from '@/lib/moderation';
import { fetchNciiQueuePage, type NciiCaseRow } from '@/lib/queue';
import type { ModeratorRole } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

function hashBadge(status: NciiCaseRow['hashMatchStatus']) {
  const label: Record<string, string> = {
    pending: 'hash: pending (human review)',
    match: 'hash: MATCH',
    no_match: 'hash: no match',
    error: 'hash: vendor error',
  };
  return <span className="badge">{label[status] ?? status}</span>;
}

function CaseRow({
  item,
  nowMs,
  assignment,
  role,
  moderatorEmail,
}: {
  item: NciiCaseRow;
  nowMs: number;
  assignment: QueueAssignment | null;
  role: ModeratorRole;
  moderatorEmail: string;
}) {
  const deadline = nciiDeadlineLabel(item.deadlineAt, nowMs);
  const token = newActionToken();
  return (
    <tr>
      <td>
        <span className={`badge ${deadline.overdue ? 'warn' : ''}`}>{deadline.label}</span>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          due {new Date(item.deadlineAt).toLocaleString()}
        </div>
      </td>
      <td>
        <span className={`badge ${item.caseClass === 'child-safety' ? 'warn' : ''}`}>
          {caseClassLabel(item.caseClass)}
        </span>
        <div style={{ marginTop: 4 }}>
          <span className="badge">{item.targetKind}</span>
        </div>
        <div className="mono" style={{ marginTop: 4 }}>
          {item.targetId}
        </div>
        <div style={{ marginTop: 4 }}>{nciiStatusLabel(item.status)}</div>
        <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
          v{item.consoleVersion}
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {hashBadge(item.hashMatchStatus)}
          <span className="muted" style={{ fontSize: 12 }}>
            NCMEC ref: {item.ncmecRef ? <span className="mono">{item.ncmecRef}</span> : 'none'}
          </span>
          {item.note ? <span className="muted" style={{ fontSize: 12 }}>{item.note}</span> : null}
        </div>
      </td>
      <td>
        <AssignmentControls
          idName="caseId"
          idValue={item.id}
          token={`${token}-assign`}
          assignment={assignment}
          moderatorEmail={moderatorEmail}
          claimAction={claimCase}
          escalateAction={escalateCaseOwnership}
        />
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <form className="row-form inline" action={ensureRemoved}>
            <IntegrityFields
              idName="caseId"
              idValue={item.id}
              version={item.consoleVersion}
              token={`${token}-ensure`}
            />
            <ReasonField placeholder="reason (required, audited)" />
            <button className="danger" type="submit">
              Ensure removed
            </button>
          </form>
          <form className="row-form inline" action={escalateCase}>
            <IntegrityFields
              idName="caseId"
              idValue={item.id}
              version={item.consoleVersion}
              token={`${token}-escalate`}
            />
            <ReasonField placeholder="reason (required, audited)" />
            <button type="submit">Escalate</button>
          </form>
          <RoleGate role={role} minimum="senior" what="Clearing a case">
            <form className="row-form inline" action={clearCase}>
              <IntegrityFields
                idName="caseId"
                idValue={item.id}
                version={item.consoleVersion}
                token={`${token}-clear`}
              />
              <ReasonField placeholder="reason for clearing (required, audited)" />
              <ConfirmField label="confirm lift takedown" />
              <button type="submit">Clear (human review)</button>
            </form>
          </RoleGate>
        </div>
      </td>
    </tr>
  );
}

export default async function NciiPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string; cursor?: string }>;
}) {
  const moderator = await requireModerator();
  const params = await searchParams;
  const admin = createAdminClient();
  const page = await fetchNciiQueuePage(admin, {
    limit: PAGE_SIZE,
    cursor: params.cursor ?? null,
    search: params.q ?? null,
  });
  const cases = page.items;
  const assignments = await fetchAssignments(
    admin,
    'ncii',
    cases.map((item) => item.id),
  );
  const nowMs = Date.now();
  const overdue = cases.filter((c) => nciiDeadlineLabel(c.deadlineAt, nowMs).overdue).length;

  return (
    <>
      <h1>Urgent queue: NCII and child safety</h1>
      <p className="muted">
        Reports in the urgent lane are taken down immediately (take-down-first). The clock is the
        window for human review, not for the content to stay up: 48 hours for NCII under the TAKE IT
        DOWN Act, 24 hours for child safety. Default is keep-removed; clearing a case lifts the
        takedown and needs explicit confirmation. Hash matching and NCMEC filing are operator
        decisions and stay unconfigured until that onboarding is done, so nothing here is ever
        auto-reported to an authority.
      </p>
      <ResultBanner ok={params.ok} error={params.error} />

      <div className="stat-grid">
        <div className="stat">
          <div className="value">{cases.length}</div>
          <div className="label">cases on this page</div>
        </div>
        <div className="stat">
          <div className="value">{overdue}</div>
          <div className="label">on this page, past their SLA deadline</div>
        </div>
      </div>

      <div className="card">
        <SearchBar
          basePath="/ncii"
          search={params.q}
          placeholder="case id, report id, target id, or lane"
        />
      </div>

      {cases.length === 0 ? (
        <div className="card muted">
          {page.searched ? 'No open cases match that search.' : 'No open NCII cases.'}
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>SLA</th>
                <th>Target / status</th>
                <th>Hash / NCMEC</th>
                <th>Owner</th>
                <th>Enforce</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => (
                <CaseRow
                  key={item.id}
                  item={item}
                  nowMs={nowMs}
                  assignment={assignments.get(item.id) ?? null}
                  role={moderator.role}
                  moderatorEmail={moderator.email}
                />
              ))}
            </tbody>
          </table>
          <Pager basePath="/ncii" nextCursor={page.nextCursor} search={params.q} />
        </div>
      )}
    </>
  );
}
