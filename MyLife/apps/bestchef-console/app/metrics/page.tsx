import { requireModerator } from '@/lib/auth';
import { sanitizeErrorCode } from '@/lib/errors';
import { labelForMetric, type MetricsWindow } from '@/lib/metrics';
import { fetchAggregateMetrics } from '@/lib/queries';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface SearchParams {
  error?: string;
}

const labelFor = labelForMetric;

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireModerator();
  const params = await searchParams;
  const admin = createAdminClient();

  let metrics: MetricsWindow = { days: [], series: [] };
  let loadError: string | null = null;
  try {
    metrics = await fetchAggregateMetrics(admin, 30);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'load_failed';
  }
  const errorCode = sanitizeErrorCode(params.error);

  const windowStart = metrics.days[0] ?? '';
  const windowEnd = metrics.days[metrics.days.length - 1] ?? '';

  return (
    <>
      <h1>Metrics</h1>
      {errorCode ? <div className="banner error">{errorCode}</div> : null}
      {loadError ? (
        <div className="banner error">
          Failed to load metrics ({loadError}). Details are in the server logs.
        </div>
      ) : null}

      <p className="muted">
        Aggregate-only, privacy-respecting launch counters (plan 45 item 2.5). Each number is a
        per-day integer count of an action the server already processes. No device identifiers, no
        per-user event trail, and no client-side tracking SDK feed these counts. Votes, submissions,
        and reports double as coarse engagement proxies; there is no distinct-user (DAU/MAU) table
        by design.
      </p>

      <h2>
        Last 30 days
        {windowStart ? (
          <span className="muted mono">
            {' '}
            ({windowStart} to {windowEnd}, UTC)
          </span>
        ) : null}
      </h2>

      <div className="card">
        {metrics.series.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No counts recorded in this window yet.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th style={{ textAlign: 'right' }}>30-day total</th>
                <th>What it counts</th>
              </tr>
            </thead>
            <tbody>
              {metrics.series.map((s) => {
                const meta = labelFor(s.metric);
                return (
                  <tr key={s.metric}>
                    <td>
                      <div>{meta.label}</div>
                      <div className="muted mono">{s.metric}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{s.total.toLocaleString('en-US')}</strong>
                    </td>
                    <td className="muted">{meta.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {metrics.series.length > 0 ? (
        <>
          <h2 id="daily">Daily breakdown</h2>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Day (UTC)</th>
                  {metrics.series.map((s) => (
                    <th key={s.metric} style={{ textAlign: 'right' }}>
                      {labelFor(s.metric).label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.days
                  .slice()
                  .reverse()
                  .map((day) => (
                    <tr key={day}>
                      <td className="mono">{day}</td>
                      {metrics.series.map((s) => (
                        <td key={s.metric} style={{ textAlign: 'right' }}>
                          {(s.byDay[day] ?? 0).toLocaleString('en-US')}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
