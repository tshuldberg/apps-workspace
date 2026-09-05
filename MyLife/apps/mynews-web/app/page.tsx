import { loadLatest } from '@/lib/cloud';
import { formatDate } from '@/lib/format';

/**
 * Cache policy: dynamic. The front page is the newest published work, and the CSP
 * nonce is per response. Next serves dynamic pages `no-store`.
 */
export const dynamic = 'force-dynamic';

export default async function Home() {
  const latest = await loadLatest(20);

  return (
    <main className="shell">
      <h1>MyNews</h1>
      <p>
        Read open journalism under portable signed bylines, inspect public revision histories,
        and see how authors and editors improved each article.
      </p>
      {latest.state === 'ok' && latest.data.length > 0 ? (
        <section className="latest" aria-label="Latest articles">
          <h2 className="section-title">Latest</h2>
          <ul className="article-list">
            {latest.data.map((item) => (
              <li key={item.articleId} className="article-list-item">
                <a className="article-list-title" href={`/a/${encodeURIComponent(item.slug)}`}>
                  {item.headline}
                </a>
                <span className="article-list-meta">
                  {item.authorDisplayName}
                  {item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : latest.state === 'ok' ? (
        <p className="muted">No published articles are available right now.</p>
      ) : latest.state === 'outage' ? (
        // Distinct from the empty case on purpose. "No articles" and "we could
        // not read the articles" are different facts, and a reader told the first
        // when the second is true has been misled about the record.
        <p className="muted">
          We could not load the latest articles. The MyNews servers did not answer in time, so this
          list is missing rather than empty. Reload in about a minute.
        </p>
      ) : (
        <p className="muted">
          This reader is not connected to a MyNews server. No demo content is shown as live.
        </p>
      )}
    </main>
  );
}
