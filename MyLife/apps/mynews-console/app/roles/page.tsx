import { grantRole, revokeRole } from './actions';
import { ConfirmField, ResultBanner } from '../components/integrity';
import { moderatorAllowlist, requireLevel, requireModerator } from '@/lib/auth';
import { fetchModeratorRoles } from '@/lib/console-queries';
import { ROLE_LABEL } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Role administration and access review.
 *
 * Two lists that have to be read together: the email allowlist (who MAY hold a
 * console session, set in the deployment environment) and the role table (who
 * currently HAS enforcement powers, set here). An address in one and not the other
 * is the thing an access review is looking for, so both are shown side by side and
 * the mismatches are called out rather than left to be noticed.
 */
export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const moderator = await requireModerator();
  const params = await searchParams;
  if (!requireLevel(moderator, 'admin')) {
    return (
      <>
        <h1>Roles</h1>
        <div className="card">
          <p>
            Role administration is admin-only. You are signed in as{' '}
            <span className="mono">{moderator.email}</span> with the{' '}
            {ROLE_LABEL[moderator.role]} role.
          </p>
        </div>
      </>
    );
  }

  const admin = createAdminClient();
  const roles = await fetchModeratorRoles(admin);
  const allowlist = moderatorAllowlist();
  const activeRefs = new Set(roles.filter((row) => row.isActive).map((row) => row.moderatorRef));
  const allowlistSet = new Set(allowlist);
  const allowlistedWithoutRole = allowlist.filter((email) => !activeRefs.has(email));
  const roleWithoutAllowlist = [...activeRefs].filter((email) => !allowlistSet.has(email));
  const activeAdmins = roles.filter((row) => row.isActive && row.role === 'admin').length;

  return (
    <>
      <h1>Roles and access review</h1>
      <ResultBanner ok={params.ok} error={params.error} />

      <div className="stat-grid">
        <div className="stat">
          <div className="value">{activeRefs.size}</div>
          <div className="label">active roles</div>
        </div>
        <div className="stat">
          <div className="value">{activeAdmins}</div>
          <div className="label">active admins</div>
        </div>
        <div className="stat">
          <div className="value">{allowlist.length}</div>
          <div className="label">addresses on the sign-in allowlist</div>
        </div>
      </div>

      {roleWithoutAllowlist.length > 0 ? (
        <div className="banner error">
          {roleWithoutAllowlist.length} active role
          {roleWithoutAllowlist.length === 1 ? '' : 's'} belong to addresses that are NOT on the
          sign-in allowlist, so they cannot sign in: {roleWithoutAllowlist.join(', ')}. Either add
          them to MYNEWS_CONSOLE_MODERATOR_EMAILS or revoke the role.
        </div>
      ) : null}
      {allowlistedWithoutRole.length > 0 ? (
        <div className="banner">
          {allowlistedWithoutRole.length} allowlisted address
          {allowlistedWithoutRole.length === 1 ? '' : 'es'} hold no role and can sign in but do
          nothing: {allowlistedWithoutRole.join(', ')}.
        </div>
      ) : null}

      <div className="card">
        <h2>Grant or change a role</h2>
        <form className="row-form inline" action={grantRole}>
          <input
            type="email"
            name="targetRef"
            required
            placeholder="moderator@example.com"
            list="allowlist-options"
          />
          <datalist id="allowlist-options">
            {allowlist.map((email) => (
              <option key={email} value={email} />
            ))}
          </datalist>
          <select name="role" defaultValue="reviewer">
            <option value="reviewer">Reviewer</option>
            <option value="senior">Senior moderator</option>
            <option value="admin">Admin</option>
          </select>
          <input type="text" name="note" maxLength={2000} placeholder="note (optional)" />
          <button type="submit">Grant</button>
        </form>
        <p className="muted" style={{ fontSize: 12 }}>
          A role does not let anyone sign in on its own: the address also has to be on
          MYNEWS_CONSOLE_MODERATOR_EMAILS and clear two-factor verification.
        </p>
      </div>

      <div className="card">
        <h2>Roles</h2>
        {roles.length === 0 ? (
          <p className="muted">
            No roles exist yet. The first admin is seeded with the bootstrap procedure in the console
            README; it works only while no active admin exists.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Moderator</th>
                <th>Role</th>
                <th>State</th>
                <th>History</th>
                <th>Revoke</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((row) => (
                <tr key={row.moderatorRef}>
                  <td className="mono">{row.moderatorRef}</td>
                  <td>{ROLE_LABEL[row.role]}</td>
                  <td>
                    {row.isActive ? (
                      <span className="badge">active</span>
                    ) : (
                      <span className="badge warn">revoked</span>
                    )}
                    {!allowlistSet.has(row.moderatorRef) && row.isActive ? (
                      <div style={{ marginTop: 4 }}>
                        <span className="badge warn">not on allowlist</span>
                      </div>
                    ) : null}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    granted {new Date(row.grantedAt).toLocaleDateString()}
                    {row.grantedBy ? ` by ${row.grantedBy}` : ''}
                    {row.revokedAt
                      ? ` · revoked ${new Date(row.revokedAt).toLocaleDateString()}${
                          row.revokedBy ? ` by ${row.revokedBy}` : ''
                        }`
                      : ''}
                    {row.note ? ` · ${row.note}` : ''}
                  </td>
                  <td>
                    {row.isActive ? (
                      <form className="row-form inline" action={revokeRole}>
                        <input type="hidden" name="targetRef" value={row.moderatorRef} />
                        <input
                          type="text"
                          name="note"
                          required
                          maxLength={2000}
                          placeholder="reason (required)"
                        />
                        <ConfirmField label="Remove their access" />
                        <button className="danger" type="submit">
                          Revoke
                        </button>
                      </form>
                    ) : (
                      <span className="muted">already revoked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
