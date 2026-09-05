import { resolveAppeal } from './actions';
import { requireModerator } from '@/lib/auth';
import { planAppealReversal } from '@/lib/decisions';
import { sanitizeErrorCode } from '@/lib/errors';
import { fetchOpenAppeals, type AppealQueueItem, type QueuePage } from '@/lib/queries';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface SearchParams {
  ok?: string;
  error?: string;
}

function AppealRow({ appeal }: { appeal: AppealQueueItem }) {
  // Preview only: the action re-derives the reversal plan from the appeal's
  // decision row server-side; no decision data rides in the form.
  const reversal = appeal.decision
    ? planAppealReversal(appeal.decision.kind, appeal.decision.targetId, appeal.decision.decision)
    : null;
  return (
    <tr>
      <td>
        <div>
          <strong>@{appeal.appellantHandle ?? '?'}</strong>{' '}
          <span className="muted mono">{appeal.createdAt}</span>
        </div>
        <div>{appeal.body}</div>
      </td>
      <td>
        {appeal.decision ? (
          <>
            <span className="badge">{appeal.decision.kind}</span>{' '}
            <span className="badge warn">{appeal.decision.decision}</span>
            <div className="muted">{appeal.decision.reason ?? 'no reason recorded'}</div>
            <div className="muted mono">
              {appeal.decision.targetId} · {appeal.decision.decidedAt}
            </div>
          </>
        ) : (
          <span className="muted">original decision missing</span>
        )}
      </td>
      <td>
        <form
          className="inline"
          action={resolveAppeal}
          style={{ flexDirection: 'column', alignItems: 'stretch' }}
        >
          <input type="hidden" name="appealId" value={appeal.appealId} />
          <label className="muted">
            <input type="radio" name="outcome" value="upheld" defaultChecked /> uphold decision
          </label>
          <label className="muted">
            <input type="radio" name="outcome" value="overturned" /> overturn decision
          </label>
          {reversal ? (
            <label className="muted">
              <input type="checkbox" name="reverse" defaultChecked /> on overturn, also reverse
              content (<span className="mono">{reversal.decision}</span>)
            </label>
          ) : (
            <span className="muted">no automatic content reversal available</span>
          )}
          <textarea
            name="reason"
            placeholder="statement of reasons (required, shown to the user)"
            required
          />
          <button type="submit">Resolve appeal</button>
        </form>
      </td>
    </tr>
  );
}

export default async function AppealsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireModerator();
  const params = await searchParams;
  const admin = createAdminClient();

  let page: QueuePage<AppealQueueItem> = { items: [], total: 0 };
  let loadError: string | null = null;
  try {
    page = await fetchOpenAppeals(admin);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'load_failed';
  }
  const errorCode = sanitizeErrorCode(params.error);

  return (
    <>
      <h1>
        Appeals (DSA Art. 20) <span className="muted">({page.total})</span>
      </h1>
      {errorCode ? <div className="banner error">{errorCode}</div> : null}
      {params.ok ? <div className="banner ok">Appeal {sanitizeErrorCode(params.ok)}.</div> : null}
      {loadError ? (
        <div className="banner error">
          Failed to load appeals ({loadError}). Details are in the server logs.
        </div>
      ) : null}

      <div className="card">
        {page.items.length < page.total ? (
          <div className="banner error">
            Showing the oldest {page.items.length} of {page.total}.
          </div>
        ) : null}
        {page.items.length === 0 && !loadError ? (
          <p className="muted" style={{ margin: 0 }}>
            No open appeals.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Appeal</th>
                <th>Original decision</th>
                <th>Resolution</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((appeal) => (
                <AppealRow key={appeal.appealId} appeal={appeal} />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="muted">
        Overturning reverses the enforcement first (derived server-side from the appealed
        decision), then records the outcome and statement of reasons via{' '}
        <span className="mono">bc_resolve_appeal</span>; a reversal failure leaves the appeal open
        and retryable.
      </p>
    </>
  );
}
