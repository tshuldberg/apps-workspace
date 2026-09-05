import {
  approveVerification,
  denyVerification,
  expireVerifications,
  recomputeRingFlags,
  revokeApprovedVerification,
} from './actions';
import { ConfirmField, IntegrityFields, ReasonField, ResultBanner, RoleGate } from '../components/integrity';
import { requireModerator } from '@/lib/auth';
import { newActionToken } from '@/lib/console-integrity';
import type { ModeratorRole } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase-admin';
import {
  fetchRingFlags,
  fetchVerificationRequests,
  type RingFlagRow,
  type VerificationRequestRow,
} from '@/lib/verification';

export const dynamic = 'force-dynamic';

const METHOD_LABEL: Record<string, string> = {
  domain_email: 'newsroom domain email',
  orcid: 'ORCID',
  byline: 'published byline',
  manual: 'manual review',
};

function EvidenceList({ row }: { row: VerificationRequestRow }) {
  const items = [row.evidenceRef, ...row.evidence].filter((item) => item.trim() !== '');
  if (items.length === 0) return <span className="muted">no evidence supplied</span>;
  return (
    <ul style={{ paddingLeft: 16, fontSize: 12, margin: 0 }}>
      {items.map((item, index) => (
        <li key={index} className="mono" style={{ wordBreak: 'break-all' }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function TierDrift({ row }: { row: VerificationRequestRow }) {
  // A 'verified' tier with no live approval, or the reverse, is the exact drift
  // the verification center exists to remove. Surface it rather than hide it.
  const shouldBeVerified = row.liveState === 'approved';
  const isVerified = row.tier === 'verified';
  if (shouldBeVerified === isVerified) {
    return <span className="badge">tier {row.tier ?? 'unknown'}</span>;
  }
  return (
    <span className="badge warn">
      tier {row.tier ?? 'unknown'} but state {row.liveState ?? 'unknown'}
    </span>
  );
}

function PendingRow({ row }: { row: VerificationRequestRow }) {
  const token = newActionToken();
  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>
          {row.handle ? `@${row.handle}` : row.journalistId}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          {row.displayName ?? ''}
        </div>
        <div style={{ marginTop: 4 }}>
          <TierDrift row={row} />
        </div>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          requested {new Date(row.createdAt).toLocaleString()}
        </div>
      </td>
      <td>
        <span className="badge">{METHOD_LABEL[row.method] ?? row.method}</span>
        <div style={{ marginTop: 6 }}>
          <EvidenceList row={row} />
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <form className="row-form inline" action={approveVerification}>
            <IntegrityFields
              idName="verificationId"
              idValue={row.id}
              version={row.consoleVersion}
              token={`${token}-approve`}
            />
            <input
              type="number"
              name="expiryMonths"
              min={1}
              max={60}
              defaultValue={12}
              title="months until this verification expires"
              required
            />
            <ReasonField placeholder="what you checked (required, audited)" />
            <button type="submit">Approve</button>
          </form>
          <form className="row-form inline" action={denyVerification}>
            <IntegrityFields
              idName="verificationId"
              idValue={row.id}
              version={row.consoleVersion}
              token={`${token}-deny`}
            />
            <ReasonField placeholder="reason (required, shown to the requester)" />
            <button className="danger" type="submit">
              Deny
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

function ApprovedRow({ row, role }: { row: VerificationRequestRow; role: ModeratorRole }) {
  const token = newActionToken();
  const expiresAt = row.expiresAt ? new Date(row.expiresAt) : null;
  const lapsed = expiresAt !== null && expiresAt.getTime() <= Date.now();
  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>
          {row.handle ? `@${row.handle}` : row.journalistId}
        </div>
        <div style={{ marginTop: 4 }}>
          <TierDrift row={row} />
        </div>
      </td>
      <td>
        <span className="badge">{METHOD_LABEL[row.method] ?? row.method}</span>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          approved {row.decidedAt ? new Date(row.decidedAt).toLocaleString() : 'unknown'} by{' '}
          {row.reviewedBy ?? 'unknown'}
        </div>
        <div className={lapsed ? 'badge warn' : 'badge'} style={{ marginTop: 4 }}>
          {expiresAt ? `${lapsed ? 'expired' : 'expires'} ${expiresAt.toLocaleDateString()}` : 'no expiry recorded'}
        </div>
        {row.decisionReason ? (
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            {row.decisionReason}
          </div>
        ) : null}
      </td>
      <td>
        <RoleGate role={role} minimum="senior" what="Revoking a badge">
          <form className="row-form inline" action={revokeApprovedVerification}>
            <IntegrityFields
              idName="verificationId"
              idValue={row.id}
              version={row.consoleVersion}
              token={`${token}-revoke`}
            />
            <ReasonField placeholder="reason (required, audited)" />
            <ConfirmField label="confirm badge removal" />
            <button className="danger" type="submit">
              Revoke
            </button>
          </form>
        </RoleGate>
      </td>
    </tr>
  );
}

function RingRow({ row }: { row: RingFlagRow }) {
  const findings = Array.isArray(row.findings)
    ? (row.findings as Array<{ code?: string; explain?: string }>)
    : [];
  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>{row.handle ? `@${row.handle}` : row.profileId}</div>
        <div className="muted" style={{ fontSize: 12 }}>
          {new Date(row.computedAt).toLocaleString()} by {row.computedBy || 'unknown'}
        </div>
      </td>
      <td>
        <span className={`badge ${row.suspicion >= 0.6 ? 'warn' : ''}`}>
          suspicion {row.suspicion.toFixed(2)}
        </span>
      </td>
      <td>
        {findings.length === 0 ? (
          <span className="muted">no findings</span>
        ) : (
          <ul style={{ paddingLeft: 16, fontSize: 12, margin: 0 }}>
            {findings.map((finding, index) => (
              <li key={index}>
                <span className="badge">{finding.code ?? 'finding'}</span> {finding.explain ?? ''}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const moderator = await requireModerator();
  const params = await searchParams;
  const admin = createAdminClient();
  const [pending, approved, decided, ringFlags] = await Promise.all([
    fetchVerificationRequests(admin, { statuses: ['pending'] }),
    fetchVerificationRequests(admin, { statuses: ['approved'] }),
    fetchVerificationRequests(admin, { statuses: ['rejected', 'revoked', 'expired'], limit: 50 }),
    fetchRingFlags(admin),
  ]);

  const lapsed = approved.filter(
    (row) => row.expiresAt !== null && Date.parse(row.expiresAt) <= Date.now(),
  ).length;
  const flagged = ringFlags.filter((row) => row.suspicion >= 0.6).length;

  return (
    <>
      <h1>Verification center</h1>
      <p className="muted">
        Journalist verification is a claim about identity, so it has an owner, an expiry, and a
        reason. Approving stamps the expiry and sets the journalist tier in the same transaction, and
        revoking takes both down together, so a verified badge always has a record behind it.
        Evidence stays here: the public view exposes only the state and the expiry.
      </p>

      <ResultBanner ok={params.ok} error={params.error} />

      <div className="stat-grid">
        <div className="stat">
          <div className="value">{pending.length}</div>
          <div className="label">pending requests</div>
        </div>
        <div className="stat">
          <div className="value">{approved.length}</div>
          <div className="label">active verifications</div>
        </div>
        <div className="stat">
          <div className="value">{lapsed}</div>
          <div className="label">past expiry</div>
        </div>
        <div className="stat">
          <div className="value">{flagged}</div>
          <div className="label">ring-flagged profiles</div>
        </div>
      </div>

      <h2>Pending requests</h2>
      {pending.length === 0 ? (
        <div className="card muted">No verification requests are waiting.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Journalist</th>
                <th>Method and evidence</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <PendingRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ marginTop: 24 }}>Active verifications</h2>
      <form action={expireVerifications} style={{ marginBottom: 12 }}>
        <button type="submit">Expire lapsed approvals now</button>
      </form>
      {approved.length === 0 ? (
        <div className="card muted">No active verifications.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Journalist</th>
                <th>Verification</th>
                <th>Revoke</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((row) => (
                <ApprovedRow key={row.id} row={row} role={moderator.role} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ marginTop: 24 }}>Coordinated endorsement rings</h2>
      <p className="muted">
        Endorsements feed credibility, so a group of accounts endorsing each other can farm standing.
        The detector is a pure pass over the endorsement graph and takes no action on its own: a
        flagged profile does not hold elevated trust until a person clears it, because a tight group
        of genuine collaborators looks structurally similar to a ring.
      </p>
      <form action={recomputeRingFlags} style={{ marginBottom: 12 }}>
        <button type="submit">Recompute the endorsement graph</button>
      </form>
      {ringFlags.length === 0 ? (
        <div className="card muted">No ring analysis has been run yet.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Profile</th>
                <th>Suspicion</th>
                <th>Findings</th>
              </tr>
            </thead>
            <tbody>
              {ringFlags.map((row) => (
                <RingRow key={row.profileId} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ marginTop: 24 }}>Recent decisions</h2>
      {decided.length === 0 ? (
        <div className="card muted">No denied, revoked, or expired verifications yet.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Journalist</th>
                <th>Outcome</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((row) => (
                <tr key={row.id}>
                  <td>{row.handle ? `@${row.handle}` : row.journalistId}</td>
                  <td>
                    <span className="badge">{row.status}</span>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {row.decidedAt ? new Date(row.decidedAt).toLocaleString() : ''}
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{row.decisionReason || '(none recorded)'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
