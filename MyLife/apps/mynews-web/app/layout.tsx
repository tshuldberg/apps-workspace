import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from './components/SiteChrome';
import { publicOrigin } from '@/lib/origin';
import { readReaderSession } from '@/lib/reader-auth';
import './globals.css';

/**
 * Root layout (plan 48 WP10).
 *
 * `metadataBase` makes every relative OpenGraph and canonical URL resolve against
 * this deployment's origin instead of Next's guess. `app/icon.svg` is picked up by
 * the file convention, which is what finally puts a favicon on the site.
 *
 * Locale: `lang="en"` is an explicit declaration, not a leftover default. The
 * product ships in English only, and declaring it lets a screen reader choose the
 * right voice and pronunciation rules. Full localization is a product decision;
 * until it is made, the honest markup is one correct locale rather than none.
 */
export const metadata: Metadata = {
  metadataBase: new URL(publicOrigin()),
  title: 'MyNews: open journalism',
  description:
    'Journalists publish. Volunteers make it better. Reading is free, with zero ads.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Anonymous readers pay nothing for this: the session read short-circuits on a
  // missing auth cookie before it touches the network.
  const session = await readReaderSession();

  return (
    <html lang="en">
      <body>
        {/* First focusable element on the page, so keyboard and screen-reader
            users skip the nav instead of tabbing through it on every article. */}
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <div id="main">{children}</div>
        <SiteFooter signedInEmail={session?.email ?? null} />
      </body>
    </html>
  );
}
