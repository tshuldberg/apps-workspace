import Link from 'next/link';
import { Pager, ResultBanner } from '../components/integrity';
import { requireModerator } from '@/lib/auth';
import { fetchDmcaQueue, fetchDmcaQueuePage } from '@/lib/dmca';
import {
  acknowledgmentSla,
  dmcaAgeLabel,
  dmcaStatusLabel,
  isDmcaAgeFilter,
  isDmcaOpen,
  waitingPeriodLabel,
  type DmcaQueueItem,
} from '@/lib/dmca-workflow';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

function QueueRow({ item, nowMs }: { item: DmcaQueueItem; nowMs: number }) {
  const acknowledgment = acknowledgmentSla(
    item.acknowledgmentDueAt,
    item.acknowledgedAt,
    nowMs,
  );
  const waiting = waitingPeriodLabel(item, nowMs);
  return (
    <tr>
      <td>
        <span className={`badge ${item.kind === 'counter' ? 'warn' : ''}`}>{item.kind}</span>
        {item.legacy ? <span className="badge warn">legacy incomplete</span> : null}
        <div className="muted">{dmcaAgeLabel(item.createdAt, nowMs)}</div>
      </td>
      <td>
        <span className={`badge ${item.status === 'needs_resolution' ? 'warn' : ''}`}>
          {dmcaStatusLabel(item.status)}
        </span>
        <div>
          <span className={`badge ${acknowledgment.overdue ? 'warn' : acknowledgment.complete ? 'ok' : ''}`}>
            {acknowledgment.label}
          </span>
        </div>
        {waiting ? <div className={`badge ${waiting.urgent ? 'warn' : ''}`}>{waiting.label}</div> : null}
      </td>
      <td>
        <strong>{item.submitterName}</strong>
        <div className="muted">{item.submitterEmail}</div>
        <div className="muted">assigned: {item.assignedModeratorRef ?? 'unassigned'}</div>
      </td>
      <td>
        <div className="mono">{item.publicUrl}</div>
        {item.targetKind && item.targetId ? (
          <div className="muted">
            {item.targetKind}: <span className="mono">{item.targetId}</span>
          </div>
        ) : (
          <div className="muted">target requires manual resolution</div>
        )}
      </td>
      <td>
        <Link className="evidence-link" href={`/dmca/${item.kind}/${item.id}`}>
          Open detail
        </Link>
      </td>
    </tr>
  );
}

export default async function DmcaQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    status?: string;
    age?: string;
    error?: string;
    ok?: string;
    q?: string;
    cursor?: string;
  }>;
}) {
  await requireModerator();
  const params = await searchParams;
  const admin = createAdminClient();
  const nowMs = Date.now();
  const kind = params.kind === 'takedown' || params.kind === 'counter' ? params.kind : 'all';
  const age = params.age && isDmcaAgeFilter(params.age) ? params.age : 'all';
  const status = params.status?.trim() || 'open';
  // The filters run in SQL and the queue is keyset-paginated, so a filtered view
  // can still be walked to the end instead of stopping at a fetch cap.
  const page = await fetchDmcaQueuePage(admin, {
    limit: PAGE_SIZE,
    cursor: params.cursor ?? null,
    search: params.q ?? null,
    filters: { kind, status, age },
    nowMs,
  });
  const items = page.items;
  // The headline counts are a separate bounded read of the OPEN queue, which is
  // what the numbers claim to describe; they are not a count of this page.
  const openItems = (await fetchDmcaQueue(admin, 500)).filter(isDmcaOpen);
  const acknowledgmentOverdue = openItems.filter(
    (item) =>
      acknowledgmentSla(item.acknowledgmentDueAt, item.acknowledgedAt, nowMs).overdue,
  ).length;
  const needsResolution = openItems.filter((item) => item.status === 'needs_resolution').length;
  const waiting = openItems.filter((item) => item.status === 'waiting_period').length;
  const statuses = [...new Set(openItems.map((item) => item.status))].sort();

  return (
    <>
      <h1>DMCA and counter-notice queue</h1>
      <p className="muted">
        This queue is authoritative and includes every legal submission whether or not it has a
        linked copyright report. Intake records and communication events are service-role-only.
      </p>
      <ResultBanner ok={params.ok} error={params.error} />

      <div className="stat-grid">
        <div className="stat">
          <div className="value">{openItems.length}</div>
          <div className="label">open submissions</div>
        </div>
        <div className="stat">
          <div className="value">{acknowledgmentOverdue}</div>
          <div className="label">past 72h acknowledgment target</div>
        </div>
        <div className="stat">
          <div className="value">{needsResolution}</div>
          <div className="label">need URL resolution</div>
        </div>
        <div className="stat">
          <div className="value">{waiting}</div>
          <div className="label">in restoration waiting period</div>
        </div>
      </div>

      <form className="card filter-form" method="get">
        <label>
          Kind
          <select name="kind" defaultValue={kind}>
            <option value="all">All</option>
            <option value="takedown">Takedown</option>
            <option value="counter">Counter-notice</option>
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="open">All open</option>
            <option value="all">All including closed</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {dmcaStatusLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Age
          <select name="age" defaultValue={age}>
            <option value="all">Any age</option>
            <option value="under_24h">Under 24 hours</option>
            <option value="24_to_72h">24 to 72 hours</option>
            <option value="over_72h">Over 72 hours</option>
          </select>
        </label>
        <label>
          Search
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="notice id, email, name, or URL"
          />
        </label>
        <button type="submit">Apply filters</button>
      </form>

      {items.length === 0 ? (
        <div className="card muted">
          {page.searched
            ? 'No submissions match that search and these filters.'
            : 'No submissions match these filters.'}
        </div>
      ) : (
        <div className="card table-scroll">
          <table>
            <thead>
              <tr>
                <th>Kind / age</th>
                <th>Status / SLA</th>
                <th>Submitter / assignment</th>
                <th>URL / target</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <QueueRow key={`${item.workflowKind}:${item.id}`} item={item} nowMs={nowMs} />
              ))}
            </tbody>
          </table>
          <Pager
            basePath="/dmca"
            nextCursor={page.nextCursor}
            search={params.q}
            extraParams={{ kind, status, age }}
          />
        </div>
      )}
    </>
  );
}
