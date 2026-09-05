import Link from 'next/link';
import { SignOutButton } from './SignOutButton';

/**
 * Site-wide header and footer (plan 48 WP10).
 *
 * Before this, every page was an island: an article had no link to the legal
 * documents, the DMCA page was reachable only if you already knew the URL, and
 * `/account/delete` was unreachable from anywhere on the site. Store review and
 * the DSA both expect those to be findable, and a reader should not need to guess
 * a path to read the terms they are bound by.
 *
 * Plain server components with real `<a>`/`<Link>` elements: no JavaScript is
 * required to navigate the site, and tab order follows the document.
 */

export function SiteHeader() {
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main">
        <Link className="site-brand" href="/">
          My<em>News</em>
        </Link>
        <ul className="site-nav-list">
          <li>
            <Link href="/about/editing">How editing works</Link>
          </li>
          <li>
            <Link href="/legal">Legal</Link>
          </li>
          <li>
            <a href="/feed.xml">RSS</a>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export function SiteFooter({ signedInEmail }: { signedInEmail: string | null }) {
  return (
    <footer className="site-footer">
      <nav className="site-footer-nav" aria-label="Site information">
        <ul className="site-nav-list">
          <li>
            <Link href="/legal/terms">Terms</Link>
          </li>
          <li>
            <Link href="/legal/privacy">Privacy</Link>
          </li>
          <li>
            <Link href="/legal/guidelines">Community guidelines</Link>
          </li>
          <li>
            <Link href="/legal/dmca">DMCA / copyright</Link>
          </li>
          <li>
            <Link href="/legal/appeals">Appeals</Link>
          </li>
          <li>
            <Link href="/account/delete">Delete your account</Link>
          </li>
          <li>
            <Link href="/about/editing">How editing works</Link>
          </li>
        </ul>
      </nav>
      <p className="site-footer-note">
        Reading is free. No ads. Journalists publish under signed bylines; volunteers suggest edits
        and authors decide.
      </p>
      {signedInEmail ? (
        <p className="site-footer-session">
          Signed in as {signedInEmail}. <SignOutButton />
        </p>
      ) : null}
    </footer>
  );
}
