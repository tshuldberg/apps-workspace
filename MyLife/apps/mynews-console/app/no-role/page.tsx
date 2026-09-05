import { redirect } from 'next/navigation';

import { getModeratorSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * A moderator who is on the email allowlist and has cleared MFA, but holds no
 * active role in nw_moderator_roles.
 *
 * This is deliberately a wall rather than a read-only console: the allowlist says
 * who MAY moderate, and the role table says who currently DOES. Someone who has
 * been stood down keeps their mailbox access but loses the queues, and nothing
 * here leaks queue contents to them in the meantime.
 */
export default async function NoRolePage() {
  const session = await getModeratorSession();
  if (session.status === 'signed-out') redirect('/login');
  if (session.status === 'needs-mfa') redirect('/mfa');
  if (session.status === 'ok') redirect('/');

  // Both states refuse access. They are told apart on purpose: during a database
  // outage, telling a moderator their access was revoked would be false, and this
  // is the worst moment to be misinformed about it.
  if (session.status === 'role-unavailable') {
    return (
      <>
        <h1>Roles cannot be read right now</h1>
        <div className="card">
          <p>
            You are signed in as <span className="mono">{session.email}</span> with two-factor
            verification complete, but the console could not read the role table, so it cannot tell
            what you are allowed to do.
          </p>
          <p>
            This is <strong>not</strong> a statement that your access was removed. The console
            refuses every action while it cannot check, which is the safe answer, but the cause is
            almost certainly the database or its configuration rather than your account. Check the
            server logs, then reload.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>No moderator role</h1>
      <div className="card">
        <p>
          You are signed in as <span className="mono">{session.email}</span> with two-factor
          verification complete, but no active role is granted to that address.
        </p>
        <p>
          An admin has to grant you <strong>reviewer</strong>, <strong>senior</strong>, or{' '}
          <strong>admin</strong> on the Roles screen. Until then no queue is readable and no action
          will run.
        </p>
        <p className="muted" style={{ fontSize: 12 }}>
          If you previously had a role, it may have been revoked as part of an access review. The
          revocation is recorded in the console audit log with who did it and why.
        </p>
      </div>
    </>
  );
}
