import { approveHold, disposeAppeal, rejectHold } from './actions';
import {
  AssignmentControls,
  ConfirmField,
  IntegrityFields,
  Pager,
  ReasonField,
  ResultBanner,
  RoleGate,
  SearchBar,
} from '../components/integrity';
import { claimDecision, escalateDecision } from './actions';
import { requireModerator } from '@/lib/auth';
import { newActionToken } from '@/lib/console-integrity';
import { fetchAssignments, type QueueAssignment } from '@/lib/console-queries';
import type { ModeratorRole } from '@/lib/roles';
import {
  fetchScreeningMeasurement,
  fetchScreeningQueuePage,
  type ScreeningDecisionRow,
} from '@/lib/screening';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

const CLASS_LABEL: Record<string, string> = {
  'child-safety': 'child safety',
  'self-harm': 'self-harm',
  threats: 'threats',
  hate: 'hate',
  'doxxing-privacy': 'private information',
  'fraud-scam': 'fraud or scam',
  spam: 'spam',
};

function ageLabel(createdAt: string, nowMs: number): { label: string; stale: boolean } {
  const hours = Math.max(0, (nowMs - Date.parse(createdAt)) / 3_600_000);
  if (hours < 1) return { label: `${Math.round(hours * 60)}m waiting`, stale: false };
  if (hours < 48) return { label: `${Math.round(hours)}h waiting`, stale: hours >= 24 };
  return { label: `${Math.round(hours / 24)}d waiting`, stale: true };
}

function previewText(row: ScreeningDecisionRow): { title: string; body: string } {
  const preview = row.preview;
  if (!preview) return { title: '(content no longer present)', body: '' };
  if (preview.kind === 'article') return { title: preview.headline, body: preview.body };
  if (preview.kind === 'revision-proposal') {
    return { title: preview.headline, body: preview.body };
  }
  if (preview.kind === 'suggestion') return { title: preview.rationale, body: '' };
  return { title: 'comment', body: preview.body };
}

function ClassScores({ scores, topClass }: { scores: Record<string, number>; topClass: string | null }) {
  const entries = Object.entries(scores)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return <span className="muted">no class scored above zero</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {entries.map(([cls, value]) => (
        <span key={cls} className={`badge ${cls === topClass ? 'warn' : ''}`}>
          {CLASS_LABEL[cls] ?? cls} {value.toFixed(2)}
        </span>
      ))}
    </div>
  );
}

function DecisionRow({
  row,
  nowMs,
  view,
  role,
  moderatorEmail,
  assignment,
}: {
  row: ScreeningDecisionRow;
  nowMs: number;
  view: 'queue' | 'appeals';
  role: ModeratorRole;
  moderatorEmail: string;
  assignment: QueueAssignment | null;
}) {
  const age = ageLabel(row.createdAt, nowMs);
  const preview = previewText(row);
  const token = newActionToken();
  // Nobody rules on an appeal against their own decision. The RPC refuses it, so
  // saying it here keeps the button from being a trap.
  const ownDecision =
    row.reviewerRef !== null && row.reviewerRef.trim().toLowerCase() === moderatorEmail;
  return (
    <tr>
      <td>
        <span className={`badge ${age.stale ? 'warn' : ''}`}>{age.label}</span>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          {new Date(row.createdAt).toLocaleString()}
        </div>
        <div style={{ marginTop: 4 }}>
          <span className="badge">{row.contentKind}</span>
          {row.requiresHumanReview ? <span className="badge warn">human only</span> : null}
        </div>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          by {row.authorHandle ? `@${row.authorHandle}` : row.authorProfileId}
        </div>
      </td>
      <td>
        <div style={{ fontWeight: 600 }}>{preview.title || '(no title)'}</div>
        {preview.body ? (
          <pre
            style={{
              marginTop: 6,
              maxHeight: 180,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              fontSize: 12,
            }}
          >
            {preview.body.slice(0, 4000)}
          </pre>
        ) : null}
        <div className="mono muted" style={{ marginTop: 4, fontSize: 11 }}>
          {row.contentId}
          {row.contentRev !== null ? ` rev ${row.contentRev}` : ''}
        </div>
      </td>
      <td>
        <div>
          <strong>{row.riskScore.toFixed(2)}</strong>{' '}
          <span className="muted">{row.thresholdHit ?? 'no threshold recorded'}</span>
        </div>
        <div style={{ marginTop: 6 }}>
          <ClassScores scores={row.classScores} topClass={row.topClass} />
        </div>
        <ul style={{ marginTop: 8, paddingLeft: 16, fontSize: 12 }}>
          {row.explanations.map((explanation, index) => (
            <li key={index}>{explanation}</li>
          ))}
        </ul>
        <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>
          engine {row.engineVersion} · provider {row.provider} ({row.providerState})
        </div>
        {view === 'appeals' ? (
          <div style={{ marginTop: 8 }}>
            <div className="badge">appeal: {row.appealState}</div>
            <div style={{ marginTop: 4, fontSize: 12 }}>{row.appealReason || '(no reason given)'}</div>
            {row.reviewReason ? (
              <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                original decision ({row.decision}): {row.reviewReason}
              </div>
            ) : null}
          </div>
        ) : null}
      </td>
      <td>
        <AssignmentControls
          idName="decisionId"
          idValue={row.id}
          token={`${token}-assign`}
          assignment={assignment}
          moderatorEmail={moderatorEmail}
          claimAction={claimDecision}
          escalateAction={escalateDecision}
          extraFields={<input type="hidden" name="view" value={view} />}
        />
      </td>
      <td>
        {view === 'queue' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <form className="row-form inline" action={approveHold}>
              <IntegrityFields
                idName="decisionId"
                idValue={row.id}
                version={row.consoleVersion}
                token={`${token}-approve`}
              />
              <input type="hidden" name="view" value={view} />
              <ReasonField />
              <button type="submit">Approve and release</button>
            </form>
            <form className="row-form inline" action={rejectHold}>
              <IntegrityFields
                idName="decisionId"
                idValue={row.id}
                version={row.consoleVersion}
                token={`${token}-reject`}
              />
              <input type="hidden" name="view" value={view} />
              <ReasonField />
              <button className="danger" type="submit">
                Reject and keep held
              </button>
            </form>
          </div>
        ) : ownDecision ? (
          <div className="banner error" style={{ fontSize: 12 }}>
            You decided this hold, so you cannot rule on the appeal against it. Leave it for another
            moderator.
          </div>
        ) : (
          <RoleGate role={role} minimum="senior" what="Deciding an appeal">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <form className="row-form inline" action={disposeAppeal}>
                <IntegrityFields
                  idName="decisionId"
                  idValue={row.id}
                  version={row.consoleVersion}
                  token={`${token}-grant`}
                />
                <input type="hidden" name="view" value={view} />
                <input type="hidden" name="grant" value="grant" />
                <ReasonField />
                <ConfirmField label="Grant and release the content" />
                <button type="submit">Grant appeal</button>
              </form>
              <form className="row-form inline" action={disposeAppeal}>
                <IntegrityFields
                  idName="decisionId"
                  idValue={row.id}
                  version={row.consoleVersion}
                  token={`${token}-deny`}
                />
                <input type="hidden" name="view" value={view} />
                <input type="hidden" name="grant" value="deny" />
                <ReasonField />
                <button className="danger" type="submit">
                  Deny appeal
                </button>
              </form>
            </div>
          </RoleGate>
        )}
      </td>
    </tr>
  );
}

export default async function ScreeningPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    error?: string;
    view?: string;
    q?: string;
    cursor?: string;
  }>;
}) {
  const moderator = await requireModerator();
  const params = await searchParams;
  const view = params.view === 'appeals' ? 'appeals' : 'queue';
  const admin = createAdminClient();
  const [page, measurement] = await Promise.all([
    fetchScreeningQueuePage(admin, {
      appealsOnly: view === 'appeals',
      limit: PAGE_SIZE,
      cursor: params.cursor ?? null,
      search: params.q ?? null,
    }),
    fetchScreeningMeasurement(admin),
  ]);
  const rows = page.items;
  const assignments = await fetchAssignments(
    admin,
    'screening',
    rows.map((row) => row.id),
  );
  const nowMs = Date.now();
  const humanOnly = rows.filter((row) => row.requiresHumanReview).length;
  const overdue = rows.filter((row) => ageLabel(row.createdAt, nowMs).stale).length;


  return (
    <>
      <h1>Screening review</h1>
      <p className="muted">
        Content held by pre-publication screening. Nothing here is public: a held article stays a
        draft, a held revision never advances the article head, and a held suggestion or comment is
        invisible to everyone but its author. Approving releases the content and lets the author
        publish those exact bytes again. Rejecting keeps it non-public and never deletes it, so an
        appeal still has the evidence. Child safety and self-harm holds can only be dispositioned by a
        person.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <a className="nav-link" href="/screening?view=queue">
          Pending holds
        </a>
        <a className="nav-link" href="/screening?view=appeals">
          Appeals
        </a>
      </div>

      <ResultBanner ok={params.ok} error={params.error} />

      <div className="stat-grid">
        <div className="stat">
          <div className="value">{rows.length}</div>
          <div className="label">
            {view === 'appeals' ? 'appeals on this page' : 'holds on this page'}
          </div>
        </div>
        <div className="stat">
          <div className="value">{humanOnly}</div>
          <div className="label">human-only classes</div>
        </div>
        <div className="stat">
          <div className="value">{overdue}</div>
          <div className="label">waiting over 24h</div>
        </div>
      </div>

      <div className="card">
        <SearchBar
          basePath="/screening"
          search={params.q}
          placeholder="decision id, content id, author id, or class"
        />
      </div>

      {rows.length === 0 ? (
        <div className="card muted">
          {page.searched
            ? 'Nothing on this queue matches that search.'
            : view === 'appeals'
              ? 'No open appeals.'
              : 'No content is waiting for review.'}
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Waiting / kind</th>
                <th>Content</th>
                <th>Why it was held</th>
                <th>Owner</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <DecisionRow
                  key={row.id}
                  row={row}
                  nowMs={nowMs}
                  view={view}
                  role={moderator.role}
                  moderatorEmail={moderator.email}
                  assignment={assignments.get(row.id) ?? null}
                />
              ))}
            </tbody>
          </table>
          <Pager
            basePath="/screening"
            nextCursor={page.nextCursor}
            search={params.q}
            extraParams={view === 'appeals' ? { view: 'appeals' } : undefined}
          />
        </div>
      )}

      <h2 style={{ marginTop: 24 }}>Measurement</h2>
      <p className="muted">
        Read straight from the decision rows. A hold a person approves was a false positive; a hold a
        person rejects was a true positive; a recorded allow later rejected was a false negative.
        Pending holds are counted separately rather than assumed correct, so the rate is null until a
        class has at least one dispositioned hold.
      </p>
      {measurement.length === 0 ? (
        <div className="card muted">No screening decisions recorded yet.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Holds</th>
                <th>Pending</th>
                <th>False positives</th>
                <th>True positives</th>
                <th>False-positive rate</th>
                <th>Recorded allows</th>
                <th>False negatives</th>
              </tr>
            </thead>
            <tbody>
              {measurement.map((row) => (
                <tr key={row.topClass}>
                  <td>{CLASS_LABEL[row.topClass] ?? row.topClass}</td>
                  <td>{row.holds}</td>
                  <td>{row.holdsPending}</td>
                  <td>{row.falsePositives}</td>
                  <td>{row.truePositives}</td>
                  <td>
                    {row.falsePositiveRate === null
                      ? 'not measurable yet'
                      : `${(row.falsePositiveRate * 100).toFixed(1)}%`}
                  </td>
                  <td>{row.recordedAllows}</td>
                  <td>{row.falseNegatives}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
