import { decideVoteProof } from './actions';
import { requireModerator } from '@/lib/auth';
import { sanitizeErrorCode } from '@/lib/errors';
import { collectLanguages, type ProofQueueItem } from '@/lib/mappers';
import { fetchProofQueue, type QueuePage } from '@/lib/queries';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface SearchParams {
  ok?: string;
  error?: string;
  lang?: string;
}

function EvidenceCell({ item }: { item: ProofQueueItem }) {
  if (!item.proof) return null;
  if (item.proof.evidenceUrl) {
    return (
      <>
        <a className="evidence-link" href={item.proof.evidenceUrl} target="_blank" rel="noreferrer">
          view {item.proof.mediaKind ?? 'evidence'}
        </a>
        <div className="muted mono" title="content hash">
          {item.proof.contentHash.slice(0, 16)}…
        </div>
      </>
    );
  }
  // Evidence EXISTS but the signed URL could not be produced: the moderator
  // must never mistake this for "no evidence" and decide blind.
  if (item.proof.mediaAssetId) {
    return (
      <>
        <span className="badge warn">evidence unavailable (URL signing failed)</span>
        <div className="muted">Retry by reloading; details are in the server logs.</div>
      </>
    );
  }
  return <span className="muted">no evidence file</span>;
}

function ProofRow({ item }: { item: ProofQueueItem }) {
  return (
    <tr>
      <td>
        {item.proof ? (
          <>
            <div>
              <strong>{item.proof.dishName ?? 'unknown dish'}</strong>
            </div>
            <div className="muted">
              @{item.proof.chefHandle ?? '?'}
              {item.proof.chefDisplayName ? ` (${item.proof.chefDisplayName})` : ''}
            </div>
            <div className="muted mono">captured {item.proof.capturedAt}</div>
          </>
        ) : (
          <span className="muted">
            proof row missing (vote deleted); queue entry <span className="mono">{item.proofId}</span>
          </span>
        )}
        {item.crossUserHashReuse ? (
          <div>
            <span className="badge reuse">cross-user hash reuse</span>
          </div>
        ) : null}
        {item.queueStatus === 'failed' ? (
          <div className="muted">
            <span className="badge warn">failed x{item.attempts}</span> {item.failureReason}
          </div>
        ) : null}
      </td>
      <td>{item.language ?? <span className="muted">-</span>}</td>
      <td>
        <EvidenceCell item={item} />
      </td>
      <td className="mono muted">{item.queuedAt}</td>
      <td>
        {item.proof ? (
          <>
            <form className="inline" action={decideVoteProof}>
              <input type="hidden" name="proofId" value={item.proofId} />
              <input type="hidden" name="decision" value="approved" />
              <button className="approve" type="submit">
                Approve
              </button>
            </form>
            <form className="inline row-form" action={decideVoteProof}>
              <input type="hidden" name="proofId" value={item.proofId} />
              <input type="hidden" name="decision" value="rejected" />
              <input type="text" name="reason" placeholder="statement of reasons" required />
              <button className="danger" type="submit">
                Reject
              </button>
            </form>
          </>
        ) : null}
      </td>
    </tr>
  );
}

export default async function ProofsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireModerator();
  const params = await searchParams;
  const admin = createAdminClient();

  let page: QueuePage<ProofQueueItem> = { items: [], total: 0 };
  let loadError: string | null = null;
  try {
    page = await fetchProofQueue(admin, params.lang ?? null);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'load_failed';
  }
  const languages = collectLanguages(page.items.map((i) => i.language));
  const errorCode = sanitizeErrorCode(params.error);

  return (
    <>
      <h1>
        Vote-proof queue <span className="muted">({page.total})</span>
      </h1>
      {errorCode ? <div className="banner error">{errorCode}</div> : null}
      {params.ok ? <div className="banner ok">Decision recorded.</div> : null}
      {loadError ? (
        <div className="banner error">
          Failed to load the queue ({loadError}). Details are in the server logs.
        </div>
      ) : null}

      <form className="inline" method="get" action="/proofs">
        <label className="muted">Language</label>
        <select name="lang" defaultValue={params.lang ?? ''}>
          <option value="">all</option>
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
        <button type="submit">Filter</button>
        {languages.length === 0 ? (
          <span className="muted">
            (language tags activate with Phase 2.5 UGC language tagging)
          </span>
        ) : null}
      </form>

      <div className="card" style={{ marginTop: 12 }}>
        {page.items.length < page.total ? (
          <div className="banner error">
            Showing the oldest {page.items.length} of {page.total}. Work the queue top-down and
            reload for more.
          </div>
        ) : null}
        {page.items.length === 0 && !loadError ? (
          <p className="muted" style={{ margin: 0 }}>
            Queue is empty.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Proof</th>
                <th>Lang</th>
                <th>Evidence</th>
                <th>Queued</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((item) => (
                <ProofRow key={item.queueId} item={item} />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="muted">
        Decisions run through <span className="mono">bc_apply_moderation_decision</span>; approval
        publishes the proof media, rejection quarantines it and flips the vote to{' '}
        <span className="mono">proof_rejected</span>. Rejections require a DSA statement of
        reasons.
      </p>
    </>
  );
}
