import { redirect } from 'next/navigation';

import { startEnrollment, verifyEnrollment, verifyExistingFactor } from './actions';
import { getModeratorSession } from '@/lib/auth';
import { readMfaState } from '@/lib/mfa';

export const dynamic = 'force-dynamic';

const ERROR_COPY: Record<string, string> = {
  bad_code: 'Enter the 6-digit code from your authenticator app.',
  invalid_code: 'That code was not accepted. Codes expire after about 30 seconds.',
  challenge_failed: 'Could not start a verification challenge. Try again.',
  enroll_failed: 'Could not start enrolment. Try again, or check the server logs.',
  list_failed: 'Could not read your existing factors. Try again.',
  already_enrolled: 'You already have an authenticator set up. Enter a code from it.',
  no_factor: 'No verified authenticator is set up on this account yet.',
};

/**
 * Second-factor gate. Every console page and server action requires an aal2
 * session, and this is the only page a session below aal2 can reach.
 *
 * There is no bypass anywhere in this app: no environment variable, header, or
 * build flag skips it, and the escape hatch a reader might expect for local
 * development does not exist because TOTP needs no external vendor to work
 * locally. See README.md.
 */
export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; factorId?: string; secret?: string; uri?: string }>;
}) {
  const session = await getModeratorSession();
  if (session.status === 'signed-out') redirect('/login');
  if (session.status !== 'needs-mfa') redirect('/');

  const params = await searchParams;
  const state = await readMfaState();
  const errorCopy = params.error ? (ERROR_COPY[params.error] ?? 'That did not work.') : null;
  const pendingEnrollment =
    params.factorId && params.secret ? { factorId: params.factorId, secret: params.secret } : null;

  return (
    <>
      <h1>Two-factor verification required</h1>
      {errorCopy ? <div className="banner error">{errorCopy}</div> : null}

      <div className="card">
        <p>
          The moderator console holds enforcement powers over other people&apos;s accounts and
          content, so a password-equivalent email link is not enough on its own. Every session has to
          present a second factor before any console page will load.
        </p>
        <p className="muted">
          Signed in as <span className="mono">{session.email}</span>. Assurance level{' '}
          <span className="mono">{state.currentLevel ?? 'unknown'}</span>.
        </p>
      </div>

      {pendingEnrollment ? (
        <div className="card">
          <h2>Finish setting up your authenticator</h2>
          <p>
            Add this secret to your authenticator app (1Password, Authy, Google Authenticator, or any
            TOTP app), then enter the 6-digit code it shows.
          </p>
          <p className="mono" style={{ wordBreak: 'break-all' }}>
            {pendingEnrollment.secret}
          </p>
          {params.uri ? (
            <p className="muted mono" style={{ wordBreak: 'break-all', fontSize: 11 }}>
              {params.uri}
            </p>
          ) : null}
          <form className="row-form inline" action={verifyEnrollment}>
            <input type="hidden" name="factorId" value={pendingEnrollment.factorId} />
            <input
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={8}
              required
            />
            <button type="submit">Verify and continue</button>
          </form>
          <p className="muted" style={{ fontSize: 12 }}>
            This code both completes enrolment and verifies this session.
          </p>
        </div>
      ) : state.step === 'verify' ? (
        <div className="card">
          <h2>Enter your authenticator code</h2>
          <form className="row-form inline" action={verifyExistingFactor}>
            <input
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={8}
              required
            />
            <button type="submit">Verify</button>
          </form>
        </div>
      ) : (
        <div className="card">
          <h2>Set up an authenticator</h2>
          <p>
            No second factor is registered on this account yet. Enrolling takes one step: add a
            secret to your authenticator app and enter the code it generates.
          </p>
          <form action={startEnrollment}>
            <button type="submit">Start setup</button>
          </form>
        </div>
      )}

      <div className="card muted" style={{ fontSize: 12 }}>
        Lost your authenticator? An admin cannot reset this from the console: MFA reset is a Supabase
        dashboard operation on the auth project, deliberately, so console access alone can never
        remove someone else&apos;s second factor. The recovery procedure is in the console README.
      </div>
    </>
  );
}
