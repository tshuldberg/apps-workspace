import Link from 'next/link';

import {
  claimReport,
  dismissReport,
  escalateReport,
  hideArticle,
  hideSuggestion,
  strikeAuthor,
  suspendProfile,
} from './actions';
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
import { isCurrentlySuspended, reasonLabel, reportSlaLabel } from '@/lib/moderation';
import {
  fetchDmcaForReport,
  fetchReportQueuePage,
  type DmcaNoticeRow,
  type QueueItem,
} from '@/lib/queue';
import type { ModeratorRole } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

function DmcaBlock({ notice }: { notice: DmcaNoticeRow }) {
  return (
    <div className="card" style={{ marginTop: 6, fontSize: 12 }}>
      <div>
        <span className="badge warn">DMCA {notice.kind}</span>
      </div>
      <div style={{ marginTop: 4 }}>
        <strong>{notice.complainantName}</strong> <span className="muted">{notice.complainantEmail}</span>
      </div>
      {notice.complainantAddress ? <div className="muted">{notice.complainantAddress}</div> : null}
      <div style={{ marginTop: 4 }}>Work: {notice.copyrightedWork}</div>
      <div className="mono">{notice.infringingUrl}</div>
      <div className="muted" style={{ marginTop: 4 }}>
        Signed: {notice.signature} - attested good-faith + accuracy under penalty of perjury
      </div>
      <div style={{ marginTop: 6 }}>
        <Link href={`/dmca/${notice.kind}/${notice.id}`}>Open first-class DMCA detail</Link>
      </div>
    </div>
  );
}

function ReportRow({
  item,
  dmca,
  assignment,
  nowMs,
  role,
  moderatorEmail,
}: {
  item: QueueItem;
  dmca: DmcaNoticeRow | null;
  assignment: QueueAssignment | null;
  nowMs: number;
  role: ModeratorRole;
  moderatorEmail: string;
}) {
  const ctx = item.targetContext;
  const isCopyrightArticle =
    item.reason === 'copyright' && (item.targetKind === 'article' || item.targetKind === 'revision');
  // Plan 48 WP8: the deadline comes from the SLA routing table, so the badge and
  // the worker's clock are the same number.
  const sla = reportSlaLabel(item.reason, item.createdAt, nowMs);
  // One token per rendered row, shared by that row's forms with a per-form suffix.
  // A resubmitted form therefore replays; two different actions do not collide.
  const token = newActionToken();

  return (
    <tr id={`report-${item.id}`}>
      <td>
        <span className="badge warn">{reasonLabel(item.reason)}</span>
        <div style={{ marginTop: 4 }}>
          <span className={`badge ${sla.overdue ? 'warn' : ''}`}>{sla.label}</span>
        </div>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          {new Date(item.createdAt).toLocaleString()}
        </div>
        <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
          v{item.consoleVersion}
        </div>
      </td>
      <td>
        <span className="badge">{item.targetKind}</span>
        <div className="mono" style={{ marginTop: 4 }}>
          {item.targetId}
        </div>
        {ctx?.kind === 'article' ? (
          <div style={{ marginTop: 4 }}>
            <strong>{ctx.headline || '(no headline)'}</strong>
            <div className="muted">
              /{ctx.slug} - {ctx.status}
            </div>
          </div>
        ) : null}
        {ctx?.kind === 'suggestion' ? (
          <div style={{ marginTop: 4 }}>
            <div>{ctx.rationale || '(no rationale)'}</div>
            <div className="muted">status {ctx.status}</div>
          </div>
        ) : null}
        {ctx?.kind === 'profile' ? (
          <div style={{ marginTop: 4 }}>
            <strong>@{ctx.handle || '(unknown)'}</strong>{' '}
            {isCurrentlySuspended(ctx.suspendedUntil, nowMs) ? (
              <span className="badge warn">already suspended</span>
            ) : null}
          </div>
        ) : null}
        {ctx?.kind === 'media' ? <div className="mono">{ctx.ref}</div> : null}
        {ctx === null ? <div className="muted">target no longer resolves</div> : null}
      </td>
      <td>
        {item.detail ? <div>{item.detail}</div> : <span className="muted">no detail</span>}
        {dmca ? <DmcaBlock notice={dmca} /> : null}
      </td>
      <td>
        <AssignmentControls
          idName="reportId"
          idValue={item.id}
          token={`${token}-assign`}
          assignment={assignment}
          moderatorEmail={moderatorEmail}
          claimAction={claimReport}
          escalateAction={escalateReport}
        />
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {item.targetKind === 'article' || item.targetKind === 'revision' ? (
            <RoleGate role={role} minimum="reviewer" what="Retracting an article">
              <form className="row-form inline" action={hideArticle}>
                <IntegrityFields
                  idName="reportId"
                  idValue={item.id}
                  version={item.consoleVersion}
                  token={`${token}-hide`}
                />
                <ReasonField />
                <button className="danger" type="submit">
                  Retract article
                </button>
              </form>
            </RoleGate>
          ) : null}
          {isCopyrightArticle ? (
            <RoleGate role={role} minimum="senior" what="A copyright strike">
              <form className="row-form inline" action={strikeAuthor}>
                <IntegrityFields
                  idName="reportId"
                  idValue={item.id}
                  version={item.consoleVersion}
                  token={`${token}-strike`}
                />
                <ReasonField />
                <ConfirmField label="Strike the author (suspends at 3 strikes)" />
                <button className="danger" type="submit">
                  Retract + copyright strike
                </button>
              </form>
            </RoleGate>
          ) : null}
          {item.targetKind === 'suggestion' ? (
            <RoleGate role={role} minimum="reviewer" what="Hiding a suggestion">
              <form className="row-form inline" action={hideSuggestion}>
                <IntegrityFields
                  idName="reportId"
                  idValue={item.id}
                  version={item.consoleVersion}
                  token={`${token}-hidesug`}
                />
                <ReasonField />
                <button className="danger" type="submit">
                  Hide suggestion
                </button>
              </form>
            </RoleGate>
          ) : null}
          {item.targetKind === 'profile' ? (
            <RoleGate role={role} minimum="senior" what="Suspending an account">
              <form className="row-form inline" action={suspendProfile}>
                <IntegrityFields
                  idName="reportId"
                  idValue={item.id}
                  version={item.consoleVersion}
                  token={`${token}-suspend`}
                />
                <select name="preset" defaultValue="7d">
                  <option value="7d">7 days</option>
                  <option value="30d">30 days (needs a second moderator)</option>
                  <option value="90d">90 days (needs a second moderator)</option>
                  <option value="permanent">Permanent (needs an admin)</option>
                </select>
                <ReasonField />
                <ConfirmField label="Confirm this suspension" />
                <button className="danger" type="submit">
                  Suspend
                </button>
              </form>
              <div className="muted" style={{ fontSize: 11 }}>
                Over 7 days this only proposes the suspension. A second moderator has to approve it
                on /approvals before anything happens to the account.
              </div>
            </RoleGate>
          ) : null}
          <form className="row-form inline" action={dismissReport}>
            <IntegrityFields
              idName="reportId"
              idValue={item.id}
              version={item.consoleVersion}
              token={`${token}-dismiss`}
            />
            <ReasonField placeholder="reason (required, recorded in the audit)" />
            <button type="submit">Dismiss (no action)</button>
          </form>
        </div>
      </td>
    </tr>
  );
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string; cursor?: string }>;
}) {
  const moderator = await requireModerator();
  const params = await searchParams;
  const admin = createAdminClient();
  const page = await fetchReportQueuePage(admin, {
    limit: PAGE_SIZE,
    cursor: params.cursor ?? null,
    search: params.q ?? null,
  });
  const queue = page.items;

  // Hydrate the linked DMCA notice for every copyright report so the moderator
  // sees the 512(c)(3) elements inline before acting.
  const copyrightReports = queue.filter((q) => q.reason === 'copyright');
  const dmcaEntries = await Promise.all(
    copyrightReports.map(async (q) => [q.id, await fetchDmcaForReport(admin, q.id)] as const),
  );
  const dmcaByReport = new Map<string, DmcaNoticeRow | null>(dmcaEntries);
  const assignments = await fetchAssignments(
    admin,
    'report',
    queue.map((item) => item.id),
  );

  const nowMs = Date.now();
  const overdue = queue.filter((item) => reportSlaLabel(item.reason, item.createdAt, nowMs).overdue)
    .length;

  return (
    <>
      <h1>Open report queue</h1>
      <ResultBanner ok={params.ok} error={params.error} />

      <div className="stat-grid">
        <div className="stat">
          <div className="value">{queue.length}</div>
          <div className="label">reports on this page</div>
        </div>
        <div className="stat">
          <div className="value">{overdue}</div>
          <div className="label">past their routed SLA deadline</div>
        </div>
      </div>

      <div className="card">
        <SearchBar
          basePath="/queue"
          search={params.q}
          placeholder="report id, target id, reporter id, or reason"
        />
      </div>

      {queue.length === 0 ? (
        <div className="card muted">
          {page.searched
            ? 'No open reports match that search.'
            : 'No open reports. The queue is clear.'}
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Reason</th>
                <th>Target</th>
                <th>Reporter detail</th>
                <th>Owner</th>
                <th>Enforce</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <ReportRow
                  key={item.id}
                  item={item}
                  dmca={dmcaByReport.get(item.id) ?? null}
                  assignment={assignments.get(item.id) ?? null}
                  nowMs={nowMs}
                  role={moderator.role}
                  moderatorEmail={moderator.email}
                />
              ))}
            </tbody>
          </table>
          <Pager basePath="/queue" nextCursor={page.nextCursor} search={params.q} />
        </div>
      )}
    </>
  );
}
