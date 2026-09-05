import { sendMagicLink, verifyLoginCode } from './actions';
import { isConsoleConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

interface SearchParams {
  sent?: string;
  error?: string;
}

const ERROR_COPY: Record<string, string> = {
  send_failed: 'Could not send the sign-in email. Check Supabase auth configuration.',
  invalid_code: 'That code did not work. Request a fresh email and try again.',
  auth_failed: 'Sign-in link was invalid or expired. Request a fresh email.',
  not_authorized: 'This account is not on the moderator allowlist.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  // Only known error codes render; raw query text never reaches the banner
  // (review finding: crafted links could show attacker copy pre-auth).
  const errorCopy = params.error
    ? (ERROR_COPY[params.error] ?? 'Sign-in failed. Request a fresh email and try again.')
    : null;

  return (
    <div className="login-wrap">
      <h1>Moderator sign-in</h1>
      {!isConsoleConfigured() ? (
        <div className="banner error">
          Console env is not configured. Set the BESTCHEF_CONSOLE_* variables (see .env.example).
        </div>
      ) : null}
      {errorCopy ? <div className="banner error">{errorCopy}</div> : null}
      {params.sent ? (
        <div className="banner ok">
          If that address is on the moderator allowlist, a sign-in email is on its way.
        </div>
      ) : null}

      <form action={sendMagicLink}>
        <input type="email" name="email" placeholder="moderator email" required autoFocus />
        <button className="approve" type="submit">
          Email me a sign-in link
        </button>
      </form>

      <details style={{ marginTop: 16 }}>
        <summary>Have a 6-digit code instead?</summary>
        <form action={verifyLoginCode}>
          <input type="email" name="email" placeholder="moderator email" required />
          <input type="text" name="token" placeholder="6-digit code" required />
          <button type="submit">Verify code</button>
        </form>
      </details>
    </div>
  );
}
