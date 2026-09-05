import { proposeBlock, proposeUnblock } from './actions';
import { ConfirmField, ReasonField, ResultBanner } from '../components/integrity';
import { requireLevel, requireModerator } from '@/lib/auth';
import { newActionToken } from '@/lib/console-integrity';
import { fetchPayoutAccounts } from '@/lib/console-queries';
import { ROLE_LABEL } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Payout accounts, for the payment-adjacent dual-control actions.
 *
 * Read-only plus two propose buttons. Nothing on this page changes an account
 * directly: both actions create a pending action that a second admin has to
 * approve, and the approval executes it in one transaction.
 */
export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const moderator = await requireModerator();
  const params = await searchParams;
  if (!requireLevel(moderator, 'admin')) {
    return (
      <>
        <h1>Payout accounts</h1>
        <div className="card">
          <p>
            Payment-adjacent actions are admin-only. You are signed in as{' '}
            <span className="mono">{moderator.email}</span> with the {ROLE_LABEL[moderator.role]}{' '}
            role.
          </p>
        </div>
      </>
    );
  }

  const admin = createAdminClient();
  const accounts = await fetchPayoutAccounts(admin, { limit: 100 });

  return (
    <>
      <h1>Payout accounts</h1>
      <ResultBanner ok={params.ok} error={params.error} />

      <div className="card">
        <p className="muted" style={{ fontSize: 13 }}>
          Blocking a payout account stops money reaching that journalist while leaving every recorded
          support charge intact; the support ledger is append-only and nothing here edits it. Both
          blocking and unblocking are proposals: a second admin has to approve them on Approvals
          before the account changes.
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="card muted">
          No payout accounts exist yet. An empty list means no journalist has started payout
          onboarding on this project, not that payouts are configured.
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Journalist</th>
                <th>State</th>
                <th>Provider</th>
                <th>Last reason</th>
                <th>Propose</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const token = newActionToken();
                const blocked = account.onboardingState === 'blocked';
                return (
                  <tr key={account.journalistProfileId}>
                    <td>
                      <div>@{account.handle ?? '(unknown)'}</div>
                      <div className="mono" style={{ fontSize: 12 }}>
                        {account.journalistProfileId}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${blocked ? 'warn' : ''}`}>
                        {account.onboardingState}
                      </span>
                      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                        v{account.consoleVersion}
                      </div>
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {account.provider ?? 'none'}
                    </td>
                    <td style={{ fontSize: 12 }}>{account.statusReason ?? ''}</td>
                    <td>
                      {account.onboardingState === 'none' ? (
                        <span className="muted" style={{ fontSize: 12 }}>
                          nothing to block: no provider account
                        </span>
                      ) : blocked ? (
                        <form className="row-form inline" action={proposeUnblock}>
                          <input
                            type="hidden"
                            name="profileId"
                            value={account.journalistProfileId}
                          />
                          <input type="hidden" name="version" value={account.consoleVersion} />
                          <input type="hidden" name="token" value={`${token}-unblock`} />
                          <ReasonField placeholder="reason (required, audited)" />
                          <ConfirmField label="Propose unblocking payouts" />
                          <button type="submit">Propose unblock</button>
                        </form>
                      ) : (
                        <form className="row-form inline" action={proposeBlock}>
                          <input
                            type="hidden"
                            name="profileId"
                            value={account.journalistProfileId}
                          />
                          <input type="hidden" name="version" value={account.consoleVersion} />
                          <input type="hidden" name="token" value={`${token}-block`} />
                          <ReasonField placeholder="reason (required, audited)" />
                          <ConfirmField label="Propose blocking payouts" />
                          <button className="danger" type="submit">
                            Propose block
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
