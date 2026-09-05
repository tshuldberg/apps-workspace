import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { signOut } from './auth/actions';
import './globals.css';
import { getModeratorEmail } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'BestChef Moderator Console',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const moderatorEmail = await getModeratorEmail();
  return (
    <html lang="en">
      <body>
        <nav className="top-nav">
          <span className="brand">
            Best<em>Chef</em> console
          </span>
          {moderatorEmail ? (
            <>
              <a className="nav-link" href="/">
                Overview
              </a>
              <a className="nav-link" href="/submissions">
                Submissions
              </a>
              <a className="nav-link" href="/proofs">
                Vote proofs
              </a>
              <a className="nav-link" href="/reports">
                Reports
              </a>
              <a className="nav-link" href="/appeals">
                Appeals
              </a>
              <a className="nav-link" href="/media">
                Media
              </a>
              <a className="nav-link" href="/dishes">
                Dishes
              </a>
              <a className="nav-link" href="/metrics">
                Metrics
              </a>
              <span className="spacer" />
              <span className="whoami">{moderatorEmail}</span>
              <form action={signOut}>
                <button type="submit">Sign out</button>
              </form>
            </>
          ) : (
            <span className="spacer" />
          )}
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
