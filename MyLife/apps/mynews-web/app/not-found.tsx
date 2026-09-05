import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';

/**
 * The site's 404 (plan 48 WP10).
 *
 * Two reasons it exists. First, honest copy: a reader who lands here should be
 * told that the address does not match anything, and told plainly that this is
 * NOT the message they would see during an outage, because the two used to be
 * indistinguishable on this site. Second, the nav: Next's built-in 404 is a bare
 * page with no way back into the site.
 *
 * `await connection()` opts the route out of prerendering. Every route here is
 * dynamic because the CSP carries a per-response nonce, and Next can only stamp
 * that nonce while rendering; a prerendered 404's scripts would be blocked.
 */
export const metadata: Metadata = {
  title: 'Page not found | MyNews',
  robots: { index: false, follow: true },
};

export default async function NotFound() {
  await connection();

  return (
    <main className="shell">
      <h1>That page does not exist</h1>
      <p>
        Nothing on MyNews matches this address. It may have been mistyped, or the link that brought
        you here may have been wrong from the start.
      </p>
      <p className="muted">
        This is not an outage message. Our servers answered and told us there is no such page, so
        reloading will not change the answer.
      </p>
      <p>
        <Link className="card-link" href="/">
          Back to the home page
        </Link>
      </p>
    </main>
  );
}
