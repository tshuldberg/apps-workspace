import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { claimNotice, escalateNotice, runDmcaAction } from '../../actions';
import { requireModerator } from '@/lib/auth';
import { newActionToken } from '@/lib/console-integrity';
import { AssignmentControls, ResultBanner } from '@/app/components/integrity';
import { fetchAssignments } from '@/lib/console-queries';
import { fetchDmcaEvents, fetchDmcaItemById } from '@/lib/dmca';
import {
  acknowledgmentSla,
  dmcaAgeLabel,
  dmcaStatusLabel,
  waitingPeriodLabel,
  type DmcaQueueItem,
} from '@/lib/dmca-workflow';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * The hidden fields every DMCA workflow form carries (plan 48 WP9).
 *
 * `version` is the notice's console_version at render time, so a step submitted
 * against a file another moderator just moved is refused as a stale action rather
 * than appended to a record that has changed underneath it. `token` is minted per
 * rendered form, so a resubmission replays instead of adding a second event to a
 * legal file.
 */
function HiddenAction({
  item,
  action,
}: {
  item: Pick<DmcaQueueItem, 'id' | 'consoleVersion'>;
  action: string;
}) {
  return (
    <>
      <input type="hidden" name="noticeId" value={item.id} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="version" value={item.consoleVersion} />
      <input type="hidden" name="token" value={`${newActionToken()}-${action}`} />
    </>
  );
}

function CommonActions({ item }: { item: DmcaQueueItem }) {
  return (
    <div className="action-grid">
      <form className="card action-card" action={runDmcaAction}>
        <HiddenAction item={item} action="assign" />
        <h3>Assignment</h3>
        <input name="value" type="text" placeholder="assignee email (blank assigns to me)" />
        <input name="reason" required maxLength={2000} type="text" placeholder="assignment note" />
        <button type="submit">Assign</button>
      </form>

      <form className="card action-card" action={runDmcaAction}>
        <HiddenAction item={item} action="add_note" />
        <h3>Communication log</h3>
        <textarea name="reason" required maxLength={2000} placeholder="claimant or poster communication summary" />
        <button type="submit">Append communication</button>
      </form>

      {!item.acknowledgedAt ? (
        <form className="card action-card" action={runDmcaAction}>
          <HiddenAction item={item} action="acknowledge" />
          <h3>Acknowledge</h3>
          <input name="reason" required maxLength={2000} type="text" placeholder="acknowledgment note" />
          <button type="submit">Record acknowledgment</button>
        </form>
      ) : null}

      {item.status === 'needs_resolution' ? (
        <form className="card action-card" action={runDmcaAction}>
          <HiddenAction item={item} action="resolve_url" />
          <h3>URL resolution</h3>
          <input name="reason" required maxLength={2000} type="text" placeholder="resolution attempt note" />
          <button type="submit">Retry server resolution</button>
        </form>
      ) : null}
    </div>
  );
}

function TakedownActions({ item }: { item: DmcaQueueItem }) {
  return (
    <div className="action-grid">
      <form className="card action-card" action={runDmcaAction}>
        <HiddenAction item={item} action="forward" />
        <h3>Forwarding record</h3>
        <p className="action-caveat">
          No automated email is configured. Send the forwarding email yourself first; this action
          only records that manual delivery (the event is stamped manual-attested).
        </p>
        <input name="value" type="email" placeholder="recipient email" required />
        <input name="reason" required maxLength={2000} type="text" placeholder="what was sent" />
        <button type="submit">Record forwarding</button>
      </form>

      <form className="card action-card" action={runDmcaAction}>
        <HiddenAction item={item} action="link_strike" />
        <h3>Strike linkage</h3>
        <input name="value" type="text" placeholder="moderation action UUID" required />
        <input name="reason" required maxLength={2000} type="text" placeholder="linkage note" />
        <button type="submit">Link strike audit</button>
      </form>

      <form className="card action-card" action={runDmcaAction}>
        <HiddenAction item={item} action="close" />
        <h3>Close with disposition</h3>
        <textarea name="reason" required maxLength={2000} placeholder="required final disposition" />
        <button type="submit">Close notice</button>
      </form>
    </div>
  );
}

function CounterActions({ item }: { item: DmcaQueueItem }) {
  return (
    <div className="action-grid">
      <form className="card action-card" action={runDmcaAction}>
        <HiddenAction item={item} action="link_original" />
        <h3>Original notice</h3>
        <input name="value" type="text" placeholder="takedown notice UUID" required />
        <input name="reason" required maxLength={2000} type="text" placeholder="linkage note" />
        <button type="submit">Link original</button>
      </form>

      {item.originalNoticeId ? (
        <form className="card action-card" action={runDmcaAction}>
          <HiddenAction item={item} action="unlink_original" />
          <h3>Remove original link</h3>
          <input name="reason" required maxLength={2000} type="text" placeholder="reason for unlinking" />
          <button type="submit">Unlink original</button>
        </form>
      ) : null}

      {item.status === 'received' ? (
        <form className="card action-card" action={runDmcaAction}>
          <HiddenAction item={item} action="forward_to_claimant" />
          <h3>Forward to claimant</h3>
          <p className="action-caveat">
            No automated email is configured. Forward the counter-notice to the claimant yourself
            first (512(g)(2)(B)); this action only records that manual delivery.
          </p>
          <textarea name="reason" required maxLength={2000} placeholder="forwarding record" />
          <button type="submit">Record claimant forwarding</button>
        </form>
      ) : null}

      {item.status === 'forwarded_to_claimant' ? (
        <form className="card action-card" action={runDmcaAction}>
          <HiddenAction item={item} action="start_waiting_period" />
          <h3>Start waiting period</h3>
          <textarea name="reason" required maxLength={2000} placeholder="delivery confirmation or reference" />
          <button type="submit">Start 10 to 14 business days</button>
        </form>
      ) : null}

      {item.status === 'waiting_period' ? (
        <form className="card action-card" action={runDmcaAction}>
          <HiddenAction item={item} action="restore_content" />
          <h3>Restore content</h3>
          <textarea name="reason" required maxLength={2000} placeholder="required restoration reason" />
          <label className="confirm-row">
            <input type="checkbox" name="confirm" />
            confirm restoration after the minimum waiting period
          </label>
          <button className="approve" type="submit">Restore transactionally</button>
        </form>
      ) : null}

      {item.status === 'forwarded_to_claimant' || item.status === 'waiting_period' ? (
        <form className="card action-card" action={runDmcaAction}>
          <HiddenAction item={item} action="litigation_hold" />
          <h3>Litigation hold</h3>
          <textarea name="reason" required maxLength={2000} placeholder="required proceeding or hold reference" />
          <button className="danger" type="submit">Place litigation hold</button>
        </form>
      ) : null}

      <form className="card action-card" action={runDmcaAction}>
        <HiddenAction item={item} action="close" />
        <h3>Close with disposition</h3>
        <textarea name="reason" required maxLength={2000} placeholder="required final disposition" />
        <button type="submit">Close counter-notice</button>
      </form>
    </div>
  );
}

export default async function DmcaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const moderator = await requireModerator();
  const route = await params;
  const query = await searchParams;
  if (route.kind !== 'takedown' && route.kind !== 'counter') notFound();
  const admin = createAdminClient();
  const item = await fetchDmcaItemById(admin, route.id);
  if (!item) notFound();
  if (route.kind !== item.kind) redirect(`/dmca/${item.kind}/${item.id}`);
  const events = await fetchDmcaEvents(admin, item);
  const assignment = (await fetchAssignments(admin, 'dmca', [item.id])).get(item.id) ?? null;
  const nowMs = Date.now();
  const acknowledgment = acknowledgmentSla(
    item.acknowledgmentDueAt,
    item.acknowledgedAt,
    nowMs,
  );
  const waiting = waitingPeriodLabel(item, nowMs);

  return (
    <>
      <p>
        <Link href="/dmca">Back to DMCA queue</Link>
      </p>
      <h1>{item.kind === 'counter' ? 'Counter-notice' : 'Takedown notice'} detail</h1>
      <ResultBanner ok={query.ok} error={query.error} />
      {item.legacy ? (
        <div className="banner error">
          Legacy counter-shaped row. It predates the separate 512(g)(3) schema and requires manual
          legal review before any action.
        </div>
      ) : null}

      <div className="card detail-grid">
        <div>
          <span className="badge">{item.kind}</span>{' '}
          <span className={`badge ${item.status === 'needs_resolution' ? 'warn' : ''}`}>
            {dmcaStatusLabel(item.status)}
          </span>
        </div>
        <div className="mono">Reference: {item.id}</div>
        <div>{dmcaAgeLabel(item.createdAt, nowMs)}</div>
        <div>
          <span className={`badge ${acknowledgment.overdue ? 'warn' : acknowledgment.complete ? 'ok' : ''}`}>
            {acknowledgment.label}
          </span>
        </div>
        {waiting ? <div className={`badge ${waiting.urgent ? 'warn' : ''}`}>{waiting.label}</div> : null}
        <div>Assigned: {item.assignedModeratorRef ?? 'unassigned'}</div>
      </div>

      <h2>Submission</h2>
      <div className="card detail-grid">
        <div><strong>Name:</strong> {item.submitterName}</div>
        <div><strong>Email:</strong> {item.submitterEmail}</div>
        <div><strong>Address:</strong> {item.submitterAddress || '(not supplied)'}</div>
        {item.submitterPhone ? <div><strong>Phone:</strong> {item.submitterPhone}</div> : null}
        <div><strong>Material:</strong> {item.material}</div>
        <div><strong>Public location:</strong> <span className="mono">{item.publicUrl}</span></div>
        <div><strong>Signature:</strong> {item.signature}</div>
        <div>
          <strong>Resolved target:</strong>{' '}
          {item.targetKind && item.targetId ? `${item.targetKind}:${item.targetId}` : 'needs resolution'}
        </div>
        {item.originalNoticeId ? (
          <div>
            <strong>Original notice:</strong>{' '}
            <Link href={`/dmca/takedown/${item.originalNoticeId}`}>{item.originalNoticeId}</Link>
          </div>
        ) : item.originalNoticeReference ? (
          <div><strong>Unmatched original reference:</strong> {item.originalNoticeReference}</div>
        ) : null}
        {item.reportId ? (
          <div>
            <strong>Copyright report / strike jump:</strong>{' '}
            <Link href={`/queue#report-${item.reportId}`}>{item.reportId}</Link>
          </div>
        ) : null}
        {item.strikeActionId ? <div><strong>Strike action:</strong> {item.strikeActionId}</div> : null}
        {item.strikeProfileId ? <div><strong>Struck profile:</strong> {item.strikeProfileId}</div> : null}
        {item.forwardedAt ? <div><strong>Forwarded:</strong> {new Date(item.forwardedAt).toLocaleString()}</div> : null}
        {item.forwardedToEmail ? <div><strong>Forwarded to:</strong> {item.forwardedToEmail}</div> : null}
        {item.disposition ? <div><strong>Disposition:</strong> {item.disposition}</div> : null}
      </div>

      <h2>Recorded attestations</h2>
      <div className="card">
        {item.attestations.map((attestation) => (
          <div className="attestation-row" key={attestation.label}>
            <span className={`badge ${attestation.accepted ? 'ok' : 'warn'}`}>
              {attestation.accepted ? 'accepted' : 'missing'}
            </span>
            <strong>{attestation.label}</strong>
            <div>{attestation.text}</div>
            <div className="muted">text version {attestation.version}</div>
          </div>
        ))}
      </div>

      <h2>Workflow actions</h2>
      <div className="card">
        <h3>Ownership and escalation</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          Assignment inside the DMCA workflow (above) is the legal record. This is the shared console
          ownership row, so an escalated notice shows up in the same escalation view as every other
          queue.
        </p>
        <AssignmentControls
          idName="noticeId"
          idValue={item.id}
          token={`${newActionToken()}-own`}
          assignment={assignment}
          moderatorEmail={moderator.email}
          claimAction={claimNotice}
          escalateAction={escalateNotice}
          extraFields={<input type="hidden" name="kind" value={item.kind} />}
        />
      </div>

      <CommonActions item={item} />
      {item.workflowKind === 'takedown' ? <TakedownActions item={item} /> : <CounterActions item={item} />}

      <h2>Immutable communication and disposition log</h2>
      {events.length === 0 ? (
        <div className="card muted">No events found. Intake should always create the first event.</div>
      ) : (
        <div className="card table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Note / metadata</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td>{dmcaStatusLabel(event.event)}</td>
                  <td>{event.actorRef}</td>
                  <td>
                    <div>{event.note || '(no note)'}</div>
                    {Object.keys(event.metadata).length > 0 ? (
                      <div className="mono">{JSON.stringify(event.metadata)}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
