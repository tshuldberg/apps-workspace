import {
  approveMediaImage,
  approveSubmissionVideo,
  rejectMediaImage,
  rejectSubmissionVideo,
} from './actions';
import { requireModerator } from '@/lib/auth';
import { sanitizeErrorCode } from '@/lib/errors';
import {
  fetchPendingMediaImages,
  fetchPendingSubmissionVideos,
  type PendingMediaImageItem,
  type PendingVideoQueueItem,
} from '@/lib/queries';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface SearchParams {
  ok?: string;
  error?: string;
}

function formatBytes(byteSize: number | null): string {
  if (!byteSize || byteSize <= 0) return 'unknown size';
  const mb = byteSize / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

function formatDuration(durationMs: number | null): string {
  if (!durationMs || durationMs <= 0) return '';
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return ` · ${minutes}:${String(seconds).padStart(2, '0')}`;
}

function VideoRow({ item }: { item: PendingVideoQueueItem }) {
  const submissionBlocked = item.submissionStatus !== 'approved';
  return (
    <tr>
      <td>
        <div>
          <strong>{item.dishName ?? 'unknown dish'}</strong>
        </div>
        <div className="muted">{item.title ?? 'untitled recipe'}</div>
        <div className="muted">{item.chefHandle ? `@${item.chefHandle}` : 'unknown chef'}</div>
        {item.moderationStatus === 'approved' ? (
          <span className="badge warn">approved, playback URL missing - re-run Approve</span>
        ) : null}
        {submissionBlocked ? (
          <span className="badge warn">
            submission {item.submissionStatus ?? 'missing'} - approve is blocked
          </span>
        ) : null}
      </td>
      <td>
        {item.previewUrl ? (
          <>
            <a className="evidence-link" href={item.previewUrl} target="_blank" rel="noreferrer">
              watch video
            </a>
            <div className="muted">
              {formatBytes(item.byteSize)}
              {formatDuration(item.durationMs)}
            </div>
          </>
        ) : item.hasStorageObject ? (
          // The file EXISTS but signing failed: never let a moderator
          // mistake this for a missing upload and reject blind.
          <span className="badge warn">preview unavailable (URL signing failed)</span>
        ) : (
          <span className="badge warn">no storage object recorded</span>
        )}
      </td>
      <td className="mono muted">{new Date(item.createdAt).toISOString().slice(0, 16).replace('T', ' ')}</td>
      <td>
        <div className="action-row">
          <form action={approveSubmissionVideo}>
            <input type="hidden" name="assetId" value={item.assetId} />
            <button
              className="btn approve"
              type="submit"
              disabled={!item.previewUrl || submissionBlocked}
            >
              Approve
            </button>
          </form>
          <form action={rejectSubmissionVideo}>
            <input type="hidden" name="assetId" value={item.assetId} />
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
        {!item.previewUrl && item.hasStorageObject ? (
          <div className="muted">Approve is disabled until the preview signs; reload to retry.</div>
        ) : null}
      </td>
    </tr>
  );
}

function ImageRow({ item }: { item: PendingMediaImageItem }) {
  return (
    <tr>
      <td>
        <div>
          <strong>{item.ownerKind}</strong>
        </div>
        <div className="muted mono">{item.ownerId}</div>
        {item.screeningStatus === 'needs_human_review' ? (
          <span className="badge warn">routed to human review (no auto-approval)</span>
        ) : null}
        {item.ownerKind === 'submission' && item.submissionStatus && item.submissionStatus !== 'approved' ? (
          <span className="badge warn">
            submission {item.submissionStatus} - approve the submission content separately
          </span>
        ) : null}
      </td>
      <td>
        {item.previewUrl ? (
          <a className="evidence-link" href={item.previewUrl} target="_blank" rel="noreferrer">
            view image
          </a>
        ) : item.hasStorageObject ? (
          // File exists but signing failed: never let a moderator mistake this
          // for a missing upload and reject blind.
          <span className="badge warn">preview unavailable (URL signing failed)</span>
        ) : (
          <span className="badge warn">no storage object recorded</span>
        )}
      </td>
      <td className="mono muted">{new Date(item.createdAt).toISOString().slice(0, 16).replace('T', ' ')}</td>
      <td>
        <div className="action-row">
          <form action={approveMediaImage}>
            <input type="hidden" name="assetId" value={item.assetId} />
            <button className="btn approve" type="submit" disabled={!item.previewUrl}>
              Approve
            </button>
          </form>
          <form action={rejectMediaImage}>
            <input type="hidden" name="assetId" value={item.assetId} />
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
        {!item.previewUrl && item.hasStorageObject ? (
          <div className="muted">Approve is disabled until the preview signs; reload to retry.</div>
        ) : null}
      </td>
    </tr>
  );
}

export default async function MediaQueuePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireModerator();
  const params = await searchParams;
  const admin = createAdminClient();
  const [videoPage, imagePage] = await Promise.all([
    fetchPendingSubmissionVideos(admin),
    fetchPendingMediaImages(admin),
  ]);

  return (
    <main>
      <header className="page-header">
        <h1>Media review</h1>
        <p className="muted">
          Uploaded UGC media waits here private and feed-invisible until a human approves it.
          Nothing is auto-approved: the screening worker only routes items to this queue.
        </p>
      </header>

      {params.ok ? <div className="banner ok">{sanitizeErrorCode(params.ok)}</div> : null}
      {params.error ? <div className="banner error">{sanitizeErrorCode(params.error)}</div> : null}

      <h2>Images</h2>
      <p className="muted">
        {imagePage.total} pending image{imagePage.total === 1 ? '' : 's'}
        {imagePage.total > imagePage.items.length ? ` (showing oldest ${imagePage.items.length})` : ''}
      </p>
      {imagePage.items.length === 0 ? (
        <p>No images waiting for review.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Owner</th>
              <th>Image</th>
              <th>Uploaded</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {imagePage.items.map((item) => (
              <ImageRow key={item.assetId} item={item} />
            ))}
          </tbody>
        </table>
      )}

      <h2>Submission videos</h2>
      <p className="muted">
        Approving a video signs a long-lived playback URL and flips the asset public (interim
        delivery until the CDN pipeline, F4). Rejection keeps it private; storage cleanup is the
        purge worker.
      </p>
      <p className="muted">
        {videoPage.total} pending video{videoPage.total === 1 ? '' : 's'}
        {videoPage.total > videoPage.items.length ? ` (showing oldest ${videoPage.items.length})` : ''}
      </p>

      {videoPage.items.length === 0 ? (
        <p>No videos waiting for review.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Submission</th>
              <th>Video</th>
              <th>Uploaded</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {videoPage.items.map((item) => (
              <VideoRow key={item.assetId} item={item} />
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
