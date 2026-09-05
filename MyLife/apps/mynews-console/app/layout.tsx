import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { signOut } from './auth/actions';
import './globals.css';
import { getModeratorSession } from '@/lib/auth';
import { ROLE_LABEL, hasLevel } from '@/lib/roles';

export const metadata: Metadata = {
  title: 'MyNews Moderator Console',
  robots: { index: false, follow: false },
};

/**
 * The nav shows what the signed-in moderator can actually reach. A session that
 * has not cleared MFA, or has no role, gets no queue links at all: the pages
 * would redirect anyway, and offering them reads as a permission the moderator
 * does not have.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getModeratorSession();
  const context = session.status === 'ok' ? session.context : null;
  const email =
    session.status === 'ok'
      ? session.context.email
      : session.status === 'signed-out'
        ? null
        : session.email;

  return (
    <html lang="en">
      <body>
        <nav className="top-nav">
          <span className="brand">
            My<em>News</em> console
          </span>
          {context ? (
            <>
              <a className="nav-link" href="/queue">
                Report queue
              </a>
              <a className="nav-link" href="/ncii">
                Urgent (NCII / child safety)
              </a>
              <a className="nav-link" href="/screening">
                Screening
              </a>
              <a className="nav-link" href="/appeals">
                Appeals
              </a>
              <a className="nav-link" href="/approvals">
                Approvals
              </a>
              <a className="nav-link" href="/verification">
                Verification
              </a>
              <a className="nav-link" href="/dmca">
                DMCA
              </a>
              <a className="nav-link" href="/support">
                Support ledger
              </a>
              <a className="nav-link" href="/health">
                Health
              </a>
              {hasLevel(context.role, 'admin') ? (
                <>
                  <a className="nav-link" href="/payouts">
                    Payouts
                  </a>
                  <a className="nav-link" href="/roles">
                    Roles
                  </a>
                  <a className="nav-link" href="/audit">
                    Audit
                  </a>
                </>
              ) : null}
              <span className="spacer" />
              <span className="whoami">
                {context.email} · {ROLE_LABEL[context.role]}
              </span>
              <form action={signOut}>
                <button type="submit">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <span className="spacer" />
              {email ? (
                <>
                  <span className="whoami">{email}</span>
                  <form action={signOut}>
                    <button type="submit">Sign out</button>
                  </form>
                </>
              ) : null}
            </>
          )}
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
