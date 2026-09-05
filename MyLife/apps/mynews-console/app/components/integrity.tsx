import type { ReactNode } from 'react';

import type { QueueAssignment } from '@/lib/console-queries';
import { describeResult, describeSuccess } from '@/lib/console-result';
import { type ModeratorRole, ROLE_LABEL, hasLevel } from '@/lib/roles';

/**
 * Shared console controls (plan 48 WP9). Server components with no client
 * JavaScript: every one of these is a plain form posting to a server action, which
 * is what lets the console keep the service-role key server-side.
 */

export function ResultBanner({ ok, error }: { ok?: string; error?: string }) {
  return (
    <>
      {ok ? <div className="banner ok">{describeSuccess(ok)}</div> : null}
      {error ? <div className="banner error">{describeResult(error)}</div> : null}
    </>
  );
}

/**
 * The three fields every enforcement form carries.
 *
 * `version` is the row's console_version at render time: the RPC refuses a
 * version that moved, which is how two moderators acting at once produce one
 * enforcement instead of two.
 *
 * `token` is generated per RENDER, so every resubmission of this form (double
 * click, back button, refresh-repost) carries the same token and the RPC treats
 * the second one as a replay.
 */
export function IntegrityFields({
  idName,
  idValue,
  version,
  token,
}: {
  idName: string;
  idValue: string;
  version: number;
  token: string;
}) {
  return (
    <>
      <input type="hidden" name={idName} value={idValue} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="token" value={token} />
    </>
  );
}

/**
 * Required reason input. The label says who reads it, because for enforcement
 * actions this text becomes the DSA Art 17 statement of reasons the author sees.
 */
export function ReasonField({
  placeholder = 'reason (required, shown to the author)',
  defaultValue,
  rows,
}: {
  placeholder?: string;
  defaultValue?: string;
  rows?: number;
}) {
  return rows && rows > 1 ? (
    <textarea
      name="reason"
      required
      maxLength={2000}
      rows={rows}
      placeholder={placeholder}
      defaultValue={defaultValue}
    />
  ) : (
    <input
      type="text"
      name="reason"
      required
      maxLength={2000}
      placeholder={placeholder}
      defaultValue={defaultValue}
    />
  );
}

/** Explicit confirmation for an action that is hard to walk back. */
export function ConfirmField({ label }: { label: string }) {
  return (
    <label className="confirm">
      <input type="checkbox" name="confirm" /> {label}
    </label>
  );
}

/** Why a control is missing, instead of silently not rendering it. */
export function RoleGate({
  role,
  minimum,
  what,
  children,
}: {
  role: ModeratorRole;
  minimum: ModeratorRole;
  what: string;
  children: ReactNode;
}) {
  if (hasLevel(role, minimum)) return <>{children}</>;
  return (
    <span className="muted" style={{ fontSize: 12 }}>
      {what} needs {ROLE_LABEL[minimum]}.
    </span>
  );
}

/** Assignment and escalation state for one queue row. */
export function AssignmentBadges({ assignment }: { assignment: QueueAssignment | null }) {
  if (!assignment) return <span className="muted">unassigned</span>;
  return (
    <>
      {assignment.assigneeRef ? (
        <div className="mono" style={{ fontSize: 12 }}>
          {assignment.assigneeRef}
        </div>
      ) : (
        <span className="muted">unassigned</span>
      )}
      {assignment.escalationLevel !== 'none' ? (
        <div style={{ marginTop: 4 }}>
          <span className="badge warn">escalated to {assignment.escalationLevel}</span>
          {assignment.escalationReason ? (
            <div className="muted" style={{ fontSize: 12 }}>
              {assignment.escalationReason}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** Claim / release plus escalate, for any queue. */
export function AssignmentControls({
  idName,
  idValue,
  token,
  assignment,
  moderatorEmail,
  claimAction,
  escalateAction,
  extraFields,
}: {
  idName: string;
  idValue: string;
  token: string;
  assignment: QueueAssignment | null;
  moderatorEmail: string;
  claimAction: (formData: FormData) => Promise<void>;
  escalateAction: (formData: FormData) => Promise<void>;
  extraFields?: ReactNode;
}) {
  const mine = assignment?.assigneeRef === moderatorEmail;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <AssignmentBadges assignment={assignment} />
      <form className="row-form inline" action={claimAction}>
        <input type="hidden" name={idName} value={idValue} />
        <input type="hidden" name="token" value={token} />
        {extraFields}
        {mine ? <input type="hidden" name="release" value="on" /> : null}
        <button type="submit">{mine ? 'Release' : 'Claim'}</button>
      </form>
      <form className="row-form inline" action={escalateAction}>
        <input type="hidden" name={idName} value={idValue} />
        <input type="hidden" name="token" value={`${token}-esc`} />
        {extraFields}
        <select name="level" defaultValue="senior">
          <option value="senior">Escalate to senior</option>
          <option value="admin">Escalate to admin</option>
          <option value="none">Clear escalation</option>
        </select>
        <input type="text" name="reason" maxLength={2000} placeholder="why" />
        <button type="submit">Set</button>
      </form>
    </div>
  );
}

/**
 * Keyset pager. There is no page number and no "last page" link on purpose: with
 * a keyset cursor those would need a count and an offset, and both go stale on a
 * queue that is being worked while it is being read.
 */
export function Pager({
  basePath,
  nextCursor,
  search,
  extraParams,
}: {
  basePath: string;
  nextCursor: string | null;
  search?: string | null;
  extraParams?: Record<string, string>;
}) {
  if (!nextCursor) return <div className="muted">End of the queue.</div>;
  const params = new URLSearchParams({ cursor: nextCursor });
  if (search) params.set('q', search);
  for (const [key, value] of Object.entries(extraParams ?? {})) params.set(key, value);
  return (
    <div style={{ marginTop: 12 }}>
      <a className="nav-link" href={`${basePath}?${params.toString()}`}>
        Next page
      </a>
    </div>
  );
}

/** Search box. GET, so a search is a shareable URL. */
export function SearchBar({
  basePath,
  search,
  placeholder,
}: {
  basePath: string;
  search?: string | null;
  placeholder: string;
}) {
  return (
    <form className="row-form inline" method="get" action={basePath}>
      <input type="search" name="q" defaultValue={search ?? ''} placeholder={placeholder} />
      <button type="submit">Search</button>
      {search ? (
        <a className="nav-link" href={basePath}>
          Clear
        </a>
      ) : null}
    </form>
  );
}
