import { setActionKillSwitch, setProviderKillSwitch, updateActionLimit } from './overview-actions';
import { requireModerator } from '@/lib/auth';
import { sanitizeErrorCode } from '@/lib/errors';
import { buildHealthRows, type JobHealthPayload } from '@/lib/mappers';
import {
  fetchJobHealth,
  fetchOpsLevers,
  fetchQueueCounts,
  type OpsLevers,
  type QueueCounts,
} from '@/lib/queries';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface SearchParams {
  ok?: string;
  error?: string;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireModerator();
  const params = await searchParams;
  const admin = createAdminClient();

  let counts: QueueCounts | null = null;
  let health: JobHealthPayload | null = null;
  let levers: OpsLevers | null = null;
  let loadError: string | null = null;
  try {
    [counts, health, levers] = await Promise.all([
      fetchQueueCounts(admin),
      fetchJobHealth(admin),
      fetchOpsLevers(admin),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'load_failed';
  }
  const errorCode = sanitizeErrorCode(params.error);

  return (
    <>
      <h1>Overview</h1>
      {errorCode ? <div className="banner error">{errorCode}</div> : null}
      {params.ok ? <div className="banner ok">{sanitizeErrorCode(params.ok)}</div> : null}
      {loadError ? (
        <div className="banner error">
          Failed to load dashboard data ({loadError}). Details are in the server logs.
        </div>
      ) : null}

      {counts ? (
        <div className="stat-grid">
          <a className="stat" href="/submissions">
            <div className="value">{counts.pendingSubmissions}</div>
            <div className="label">submissions pending review</div>
          </a>
          <a className="stat" href="/proofs">
            <div className="value">{counts.voteProofs}</div>
            <div className="label">vote proofs pending</div>
          </a>
          <a className="stat" href="/reports">
            <div className="value">{counts.flags}</div>
            <div className="label">open flags</div>
          </a>
          <a className="stat" href="/reports#photo-reports">
            <div className="value">{counts.photoReports}</div>
            <div className="label">open photo reports</div>
          </a>
          <a className="stat" href="/appeals">
            <div className="value">{counts.appeals}</div>
            <div className="label">open appeals</div>
          </a>
          <a className="stat" href="/media">
            <div className="value">{counts.pendingVideos}</div>
            <div className="label">videos pending review</div>
          </a>
          <a className="stat" href="/media">
            <div className="value">{counts.pendingImages}</div>
            <div className="label">images pending review</div>
          </a>
        </div>
      ) : null}

      {health ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>
            Job health{' '}
            {health.healthy === true ? (
              <span className="badge ok">healthy</span>
            ) : (
              <span className="badge warn">attention</span>
            )}
          </h2>
          <table>
            <thead>
              <tr>
                <th>Check</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {buildHealthRows(health, new Date()).map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>
                    {row.ok ? (
                      <span className="badge ok">ok</span>
                    ) : (
                      <span className="badge warn">fail</span>
                    )}
                  </td>
                  <td className="muted mono">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ marginBottom: 0 }}>
            Source: <span className="mono">bc_job_health()</span>, checked{' '}
            <span className="mono">{health.checked_at ?? 'now'}</span>
          </p>
        </div>
      ) : null}

      {levers ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Ops levers</h2>
          <table>
            <tbody>
              <tr>
                <td>
                  Social-write kill switch{' '}
                  <span className="muted">(freezes rate-limited actions; not vote deletion)</span>
                </td>
                <td>
                  {levers.actionKillSwitch ? (
                    <span className="badge warn">FROZEN</span>
                  ) : (
                    <span className="badge ok">live</span>
                  )}
                </td>
                <td>
                  <form className="inline" action={setActionKillSwitch}>
                    <input
                      type="hidden"
                      name="value"
                      value={levers.actionKillSwitch ? 'off' : 'on'}
                    />
                    <button type="submit" className={levers.actionKillSwitch ? 'approve' : 'danger'}>
                      {levers.actionKillSwitch ? 'Unfreeze' : 'Freeze'}
                    </button>
                  </form>
                </td>
              </tr>
              <tr>
                <td>
                  Provider kill switch{' '}
                  <span className="muted">(vision/nutrition provider brokers, CHF-1)</span>
                </td>
                <td>
                  {levers.providerKillSwitch ? (
                    <span className="badge warn">FROZEN</span>
                  ) : (
                    <span className="badge ok">live</span>
                  )}
                  <div className="muted">daily cap {levers.providerGlobalDailyCap}</div>
                </td>
                <td>
                  <form className="inline" action={setProviderKillSwitch}>
                    <input
                      type="hidden"
                      name="value"
                      value={levers.providerKillSwitch ? 'off' : 'on'}
                    />
                    <button
                      type="submit"
                      className={levers.providerKillSwitch ? 'approve' : 'danger'}
                    >
                      {levers.providerKillSwitch ? 'Unfreeze' : 'Freeze'}
                    </button>
                  </form>
                </td>
              </tr>
            </tbody>
          </table>

          <h2>Action limits (durable caps)</h2>
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Max</th>
                <th>Window (s)</th>
                <th>Enabled</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {levers.actionLimits.map((limit) => (
                <tr key={limit.action}>
                  <td className="mono">{limit.action}</td>
                  <td colSpan={4}>
                    <form className="inline" action={updateActionLimit}>
                      <input type="hidden" name="action" value={limit.action} />
                      <input
                        type="number"
                        name="maxCount"
                        defaultValue={limit.maxCount}
                        min={0}
                        style={{ width: 90 }}
                      />
                      <input
                        type="number"
                        name="windowSeconds"
                        defaultValue={limit.windowSeconds}
                        min={1}
                        style={{ width: 110 }}
                      />
                      <label className="muted">
                        <input type="checkbox" name="enabled" defaultChecked={limit.enabled} />{' '}
                        enabled
                      </label>
                      <button type="submit">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ marginBottom: 0 }}>
            A missing/disabled row means no cap is enforced for that action (logged, allowed).
          </p>
        </div>
      ) : null}
    </>
  );
}
