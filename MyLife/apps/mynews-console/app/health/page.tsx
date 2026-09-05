import type { ComponentStatus } from '@mylife/mynews';

import { requireModerator } from '@/lib/auth';
import {
  ageLabel,
  componentLabel,
  depthLabel,
  levelBadgeClass,
  levelText,
  needsAttention,
  statusHeadline,
} from '@/lib/health';
import { readHealthReport } from '@/lib/health-data';

export const dynamic = 'force-dynamic';

/**
 * Read-only service health (plan 48 WP11). Queue ages against their configured
 * alarm thresholds, plus the worker heartbeats that say whether anything is
 * draining those queues at all.
 *
 * There are no actions here by design. Every number on this page is a signal to
 * go and work a queue on its own page, or to page an engineer; nothing about
 * service health is something a moderator can resolve by clicking here.
 *
 * Thresholds live in `nw_health_thresholds` so an operator can retune them
 * during a spike without a deploy. That table is service-role only, so it is
 * edited through the database, not through this page.
 */
function ComponentRow({ component }: { component: ComponentStatus }) {
  return (
    <tr>
      <td>
        <span className={levelBadgeClass(component.level)}>{levelText(component.level)}</span>
      </td>
      <td>
        <div>{componentLabel(component.component)}</div>
        <div className="mono muted" style={{ marginTop: 4, fontSize: 12 }}>
          {component.component}
        </div>
      </td>
      <td>{ageLabel(component.ageSeconds)}</td>
      <td>{depthLabel(component)}</td>
      <td className="muted" style={{ fontSize: 12 }}>
        {component.reason}
      </td>
    </tr>
  );
}

export default async function HealthPage() {
  await requireModerator();
  const result = await readHealthReport();

  if (result.state === 'unavailable') {
    return (
      <>
        <h1>Service health</h1>
        <div className="banner error">
          The health snapshot could not be read: {result.reason}
        </div>
        <p className="muted">
          Nothing below this line is available. An unreadable snapshot is not the same as a healthy
          one, so this page shows no figures rather than zeros. Check the database connection and
          the console service-role credential, then reload.
        </p>
      </>
    );
  }

  const { report } = result;
  const attention = needsAttention(report.components);

  return (
    <>
      <h1>Service health</h1>
      <p className="muted">
        Queue ages against their configured thresholds, plus worker heartbeats. Read-only: fix a
        deep queue by working it on its own page, and a dead worker by paging engineering.
      </p>

      {report.status === 'ok' ? (
        <div className="banner">{statusHeadline(report.status)}</div>
      ) : (
        <div className="banner error">
          {statusHeadline(report.status)} {attention.length} of {report.components.length}{' '}
          component(s) need attention.
        </div>
      )}

      <p className="muted" style={{ fontSize: 12 }}>
        Snapshot taken {report.checkedAt}. A component with no threshold row, or whose worker has
        never recorded a run, reports UNKNOWN rather than OK: an unwatched queue is not a healthy
        queue.
      </p>

      <table>
        <thead>
          <tr>
            <th>Level</th>
            <th>Component</th>
            <th>Oldest age</th>
            <th>Depth</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {report.components.map((component) => (
            <ComponentRow key={component.component} component={component} />
          ))}
        </tbody>
      </table>
    </>
  );
}
