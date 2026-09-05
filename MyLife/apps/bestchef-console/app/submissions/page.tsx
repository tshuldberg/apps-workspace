import { approveSubmission, rejectSubmission } from './actions';
import { requireModerator } from '@/lib/auth';
import { sanitizeErrorCode } from '@/lib/errors';
import { fetchPendingSubmissions, type PendingSubmissionItem } from '@/lib/queries';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface SearchParams {
  ok?: string;
  error?: string;
}

function SubmissionRow({ item }: { item: PendingSubmissionItem }) {
  return (
    <tr>
      <td>
        <div>
          <strong>{item.dishName ?? 'unknown dish'}</strong>
        </div>
        <div className="muted">{item.title ?? 'untitled recipe'}</div>
        <div className="muted">{item.chefHandle ? `@${item.chefHandle}` : 'unknown chef'}</div>
      </td>
      <td>
        {item.previewUrl ? (
          <a className="evidence-link" href={item.previewUrl} target="_blank" rel="noreferrer">
            view photo
          </a>
        ) : (
          <span className="muted">no photo</span>
        )}
      </td>
      <td className="mono muted">{new Date(item.createdAt).toISOString().slice(0, 16).replace('T', ' ')}</td>
      <td>
        <div className="action-row">
          <form action={approveSubmission}>
            <input type="hidden" name="submissionId" value={item.submissionId} />
            <button className="btn approve" type="submit">
              Approve
            </button>
          </form>
          <form action={rejectSubmission}>
            <input type="hidden" name="submissionId" value={item.submissionId} />
            <input
              type="text"
              name="reason"
              placeholder="Statement of reasons (required)"
              maxLength={500}
              required
            />
            <button className="btn reject" type="submit">
              Reject
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

export default async function SubmissionsQueuePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireModerator();
  const params = await searchParams;
  const admin = createAdminClient();
  const page = await fetchPendingSubmissions(admin);

  return (
    <main>
      <header className="page-header">
        <h1>Pending submissions</h1>
        <p className="muted">
          New submissions land pending and public-invisible until approved here (audit C2).
          Approving publishes the recipe; rejecting requires a statement of reasons. A
          submission&apos;s photo/video is a separate per-asset decision on the Media queue.
        </p>
      </header>

      {params.ok ? <div className="banner ok">{sanitizeErrorCode(params.ok)}</div> : null}
      {params.error ? <div className="banner error">{sanitizeErrorCode(params.error)}</div> : null}

      <p className="muted">
        {page.total} pending submission{page.total === 1 ? '' : 's'}
        {page.total > page.items.length ? ` (showing oldest ${page.items.length})` : ''}
      </p>

      {page.items.length === 0 ? (
        <p>No submissions waiting for review.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Submission</th>
              <th>Photo</th>
              <th>Created</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((item) => (
              <SubmissionRow key={item.submissionId} item={item} />
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
