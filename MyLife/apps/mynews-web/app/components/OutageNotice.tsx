import type { Metadata } from 'next';
import Link from 'next/link';
import { RETRY_AFTER_SECONDS } from '@/lib/load-result';

/**
 * Honest outage surface (plan 48 WP10).
 *
 * Shown when a read could not be completed: the backend was unreachable, the
 * request timed out, or it answered with an error. It deliberately does NOT say
 * the page does not exist, because that is not what happened and the reader can
 * act differently on the two answers (retry versus check the address).
 *
 * ## Why this is not an HTTP 503
 *
 * App Router pages cannot set a response status: Next exposes `notFound()` (404)
 * and `redirect()` (307/308) and nothing for 5xx, and a page that throws
 * produces a framework error page rather than an outage page we control the copy
 * of. So the crawler contract is carried by `outageMetadata()` instead: the
 * response is `noindex, nofollow`, which stops this text from being indexed as
 * an article's content, and dynamic pages already ship `Cache-Control: no-store`
 * so no CDN pins it. A crawler that sees noindex leaves the previously indexed
 * URL alone, which is the outcome a 503 would have bought.
 *
 * The routes that CAN set a status do: `/feed.xml`, `/sitemap.xml`, and the
 * `/api/*` handlers return a real 503 with `Retry-After` (see `feedStatus`).
 */
export function OutageNotice({
  /** What could not be loaded, in the reader's words: "this article". */
  subject,
}: {
  subject: string;
}) {
  return (
    <main className="shell">
      <h1>MyNews is having trouble right now</h1>
      <p>
        We could not load {subject}. The problem is on our side: the MyNews servers did not answer
        in time. Nothing is missing or deleted, and there is nothing wrong with the address you
        used.
      </p>
      <p className="muted">
        Reload in about a minute. If it keeps failing, the MyNews app keeps working on articles you
        have already opened.
      </p>
      <p>
        <Link className="card-link" href="/">
          Back to the home page
        </Link>
      </p>
    </main>
  );
}

/**
 * Metadata for an outage response. `noindex, nofollow` is the whole point: it
 * is what keeps a transient failure from being recorded as the content of a URL
 * that is fine. Titles stay generic so nothing is asserted about the record we
 * could not read.
 */
export function outageMetadata(): Metadata {
  return {
    title: 'Temporarily unavailable | MyNews',
    description: `MyNews could not load this page. Try again in about ${RETRY_AFTER_SECONDS} seconds.`,
    robots: { index: false, follow: false },
  };
}
