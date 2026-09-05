import { actOnFlag, hideReportedSubmission, resolvePhotoReport } from './actions';
import { requireModerator } from '@/lib/auth';
import { flagKindToDecisionKind } from '@/lib/decisions';
import { sanitizeErrorCode } from '@/lib/errors';
import {
  fetchOpenFlags,
  fetchOpenPhotoReports,
  type FlagQueueItem,
  type PhotoReportItem,
  type QueuePage,
} from '@/lib/queries';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface SearchParams {
  ok?: string;
  error?: string;
}

function FlagRow({ flag }: { flag: FlagQueueItem }) {
  // targetType is used for RENDERING only; the action re-derives the real
  // target from the bc_flags row server-side.
  const decisionKind = flagKindToDecisionKind(flag.targetType);
  return (
    <tr>
      <td>
        <span className="badge">{flag.targetType}</span>
        <div>{flag.targetLabel}</div>
        <div className="muted mono">{flag.targetId}</div>
      </td>
      <td>
        <div>{flag.reason}</div>
        <div className="muted">
          by @{flag.flaggerHandle ?? '?'} · {flag.status}
        </div>
        <div className="muted mono">{flag.createdAt}</div>
      </td>
      <td>
        {decisionKind ? (
          <form className="inline" action={actOnFlag}>
            <input type="hidden" name="flagId" value={flag.flagId} />
            <select name="action" defaultValue="hidden">
              <option value="hidden">Hide</option>
              <option value="removed">Remove</option>
              <option value="rejected">Reject</option>
              <option value="restored">Restore</option>
              <option value="approved">Approve (keep up)</option>
            </select>
            <input type="text" name="reason" placeholder="statement of reasons" />
            <button type="submit">Decide</button>
          </form>
        ) : (
          <span className="muted">no content decision path for {flag.targetType}</span>
        )}
        <form className="inline row-form" action={actOnFlag}>
          <input type="hidden" name="flagId" value={flag.flagId} />
          <input type="hidden" name="action" value="dismiss_flag" />
          <input type="text" name="reason" placeholder="optional note" />
          <button type="submit">Dismiss flag</button>
        </form>
      </td>
    </tr>
  );
}

function PhotoReportRow({ report }: { report: PhotoReportItem }) {
  return (
    <tr>
      <td>
        <div>{report.submissionLabel}</div>
        <div className="muted mono">{report.submissionId}</div>
      </td>
      <td>
        <span className="badge">{report.reason}</span>
        <div className="muted">
          by @{report.reporterHandle ?? '?'} · <span className="mono">{report.createdAt}</span>
        </div>
      </td>
      <td>
        <form className="inline" action={hideReportedSubmission}>
          <input type="hidden" name="submissionId" value={report.submissionId} />
          <input type="text" name="reason" placeholder="statement of reasons" required />
          <button className="danger" type="submit">
            Hide submission
          </button>
        </form>
        <form className="inline row-form" action={resolvePhotoReport}>
          <input type="hidden" name="reportId" value={report.reportId} />
          <input type="hidden" name="outcome" value="resolved" />
          <button type="submit">Resolve</button>
        </form>
        <form className="inline row-form" action={resolvePhotoReport}>
          <input type="hidden" name="reportId" value={report.reportId} />
          <input type="hidden" name="outcome" value="dismissed" />
          <button type="submit">Dismiss</button>
        </form>
      </td>
    </tr>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireModerator();
  const params = await searchParams;
  const admin = createAdminClient();

  let flags: QueuePage<FlagQueueItem> = { items: [], total: 0 };
  let photoReports: QueuePage<PhotoReportItem> = { items: [], total: 0 };
  let loadError: string | null = null;
  try {
    [flags, photoReports] = await Promise.all([
      fetchOpenFlags(admin),
      fetchOpenPhotoReports(admin),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'load_failed';
  }
  const errorCode = sanitizeErrorCode(params.error);

  return (
    <>
      <h1>Reports</h1>
      {errorCode ? <div className="banner error">{errorCode}</div> : null}
      {params.ok ? <div className="banner ok">Done: {sanitizeErrorCode(params.ok)}</div> : null}
      {loadError ? (
        <div className="banner error">
          Failed to load the queues ({loadError}). Details are in the server logs.
        </div>
      ) : null}

      <h2>Content flags ({flags.total})</h2>
      <div className="card">
        {flags.items.length < flags.total ? (
          <div className="banner error">
            Showing the oldest {flags.items.length} of {flags.total}.
          </div>
        ) : null}
        {flags.items.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No open flags.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Target</th>
                <th>Report</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flags.items.map((flag) => (
                <FlagRow key={flag.flagId} flag={flag} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 id="photo-reports">Photo reports ({photoReports.total})</h2>
      <div className="card">
        {photoReports.items.length < photoReports.total ? (
          <div className="banner error">
            Showing the oldest {photoReports.items.length} of {photoReports.total}.
          </div>
        ) : null}
        {photoReports.items.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No open photo reports.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Submission</th>
                <th>Report</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {photoReports.items.map((report) => (
                <PhotoReportRow key={report.reportId} report={report} />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="muted">
        Hide/Remove/Reject require a DSA statement of reasons. Content decisions resolve every
        open flag on the same target; hiding a submission from a photo report also resolves all
        its open reports.
      </p>
    </>
  );
}
