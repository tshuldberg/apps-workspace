import { claimAppeal, disposeAppeal, escalateAppeal } from './actions';
import {
  AssignmentControls,
  ConfirmField,
  Pager,
  ReasonField,
  ResultBanner,
  RoleGate,
} from '../components/integrity';
import { requireModerator } from '@/lib/auth';
import { newActionToken } from '@/lib/console-integrity';
import {
  fetchAppealPage,
  fetchAssignments,
  type ConsoleAppealRow,
  type QueueAssignment,
} from '@/lib/console-queries';
import type { ModeratorRole } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

const SUBJECT_LABEL: Record<string, string> = {
  hide_article: 'Article removed',
  hide_suggestion: 'Suggestion removed',
  suspend_profile: 'Account suspended',
  screening_held: 'Held before publication',
  screening_quarantined: 'Quarantined before publication',
};

function subjectLabel(action: string): string {
  return SUBJECT_LABEL[action] ?? action;
}

function AppealRow({
  appeal,
  assignment,
  role,
  moderatorEmail,
}: {
  appeal: ConsoleAppealRow;
  assignment: QueueAssignment | null;
  role: ModeratorRole;
  moderatorEmail: string;
}) {
  const token = newActionToken();
  // A moderator cannot rule on an appeal against their own decision. The RPC
  // refuses it; saying so here means the button is not a trap.
  const ownDecision =
    appeal.decidedAgainstBy !== null &&
    appeal.decidedAgainstBy.trim().toLowerCase() === moderatorEmail;

  return (
    <tr>
      <td>
        <span className="badge">{appeal.source}</span>
        <div style={{ marginTop: 4 }}>{subjectLabel(appeal.subjectAction)}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {new Date(appeal.createdAt).toLocaleString()}
        </div>
        <div className="muted" style={{ fontSize: 11 }}>
          v{appeal.consoleVersion}
        </div>
      </td>
      <td>
        <div>
          <strong>@{appeal.appellantHandle ?? '(unknown)'}</strong>
        </div>
        <div className="mono" style={{ fontSize: 12 }}>
          {appeal.targetKind} {appeal.targetId}
        </div>
        {appeal.decidedAgainstBy ? (
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            decided by {appeal.decidedAgainstBy}
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            no moderator recorded on the original decision
          </div>
        )}
      </td>
      <td>
        <div>{appeal.appealReason || <span className="muted">no reason given</span>}</div>
        {appeal.subjectNote ? (
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Original reason: {appeal.subjectNote}
          </div>
        ) : null}
      </td>
      <td>
        <AssignmentControls
          idName="appealId"
          idValue={appeal.appealId}
          token={`${token}-assign`}
          assignment={assignment}
          moderatorEmail={moderatorEmail}
          claimAction={claimAppeal}
          escalateAction={escalateAppeal}
        />
      </td>
      <td>
        {ownDecision ? (
          <div className="banner error" style={{ fontSize: 12 }}>
            You took the action being appealed, so you cannot decide this appeal. Escalate it or leave
            it for another moderator.
          </div>
        ) : (
          <RoleGate role={role} minimum="senior" what="Deciding an appeal">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <form className="row-form inline" action={disposeAppeal}>
                <input type="hidden" name="source" value={appeal.source} />
                <input type="hidden" name="appealId" value={appeal.appealId} />
                <input type="hidden" name="version" value={appeal.consoleVersion} />
                <input type="hidden" name="token" value={`${token}-grant`} />
                <input type="hidden" name="grant" value="grant" />
                <ReasonField placeholder="reason (required, shown to the appellant)" />
                <ConfirmField label="Grant and reverse the action" />
                <button type="submit">Grant appeal</button>
              </form>
              <form className="row-form inline" action={disposeAppeal}>
                <input type="hidden" name="source" value={appeal.source} />
                <input type="hidden" name="appealId" value={appeal.appealId} />
                <input type="hidden" name="version" value={appeal.consoleVersion} />
                <input type="hidden" name="token" value={`${token}-deny`} />
                <input type="hidden" name="grant" value="deny" />
                <ReasonField placeholder="reason (required, shown to the appellant)" />
                <button type="submit">Deny appeal</button>
              </form>
            </div>
          </RoleGate>
        )}
      </td>
    </tr>
  );
}

export default async function AppealsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; view?: string; cursor?: string }>;
}) {
  const moderator = await requireModerator();
  const params = await searchParams;
  const showAll = params.view === 'all';
  const admin = createAdminClient();
  const page = await fetchAppealPage(admin, {
    openOnly: !showAll,
    limit: PAGE_SIZE,
    cursor: params.cursor ?? null,
  });
  const appeals = page.items;
  const assignments = await fetchAssignments(
    admin,
    'appeal',
    appeals.map((appeal) => appeal.appealId),
  );

  return (
    <>
      <h1>Appeals</h1>
      <ResultBanner ok={params.ok} error={params.error} />

      <div className="card">
        <p className="muted" style={{ fontSize: 13 }}>
          One queue over two sources: appeals against moderation actions, and appeals against
          pre-publication screening holds. Granting an appeal reverses the original action inside the
          same transaction, so a granted appeal restores content rather than only changing a label.
        </p>
        <div className="row-form inline">
          <a className="nav-link" href="/appeals">
            Waiting
          </a>
          <a className="nav-link" href="/appeals?view=all">
            All appeals
          </a>
        </div>
      </div>

      {appeals.length === 0 ? (
        <div className="card muted">
          {showAll ? 'No appeals have been filed.' : 'No appeals are waiting for a decision.'}
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Appellant</th>
                <th>Their reason</th>
                <th>Owner</th>
                <th>Decide</th>
              </tr>
            </thead>
            <tbody>
              {appeals.map((appeal) => (
                <AppealRow
                  key={`${appeal.source}-${appeal.appealId}`}
                  appeal={appeal}
                  assignment={assignments.get(appeal.appealId) ?? null}
                  role={moderator.role}
                  moderatorEmail={moderator.email}
                />
              ))}
            </tbody>
          </table>
          <Pager
            basePath="/appeals"
            nextCursor={page.nextCursor}
            extraParams={showAll ? { view: 'all' } : undefined}
          />
        </div>
      )}
    </>
  );
}
