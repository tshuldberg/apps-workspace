import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadArticle, loadSuggestions } from '@/lib/cloud';
import { OutageNotice, outageMetadata } from '@/app/components/OutageNotice';
import { ReportButton } from '@/app/components/ReportButton';
import { buildImprovedBy, buildMarginalia } from '@/lib/editing';
import { publicOrigin } from '@/lib/origin';
import { readReportContext } from '@/lib/report-context';
import { formatDate, shortKey, splitParagraphs } from '@/lib/format';

/**
 * Always rendered per request. Three things force it and none of them are
 * negotiable: the report card reflects THIS reader's session, the CSP nonce is
 * per response, and an article's revision history and open-suggestion counts
 * change whenever an editor's work is accepted. A cached copy of any of those is
 * a copy that is wrong. Next serves dynamic pages `no-store`, which is also what
 * keeps an outage response from being held by a CDN.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadArticle(slug);
  // An outage response must never be indexed as this URL's content.
  if (result.state === 'outage') return outageMetadata();
  if (result.state !== 'ok') return { title: 'MyNews' };
  const article = result.data;
  const description = article.dek ?? article.headline;
  const url = `${publicOrigin()}/a/${encodeURIComponent(slug)}`;
  return {
    title: `${article.headline} | MyNews`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: article.headline,
      description,
      url,
      siteName: 'MyNews',
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const result = await loadArticle(slug);
  if (result.state === 'outage') return <OutageNotice subject="this article" />;
  if (result.state !== 'ok') notFound();
  const article = result.data;

  const paragraphs = splitParagraphs(article.bodyMd);
  const revisions = [...article.revisionSummaries].sort((a, b) => b.rev - a.rev);
  const improvedBy = buildImprovedBy(article.revisionSummaries);
  const suggestions = await loadSuggestions(article.articleId);
  // A failed suggestions read does not take the article down with it: the
  // marginalia card is omitted rather than shown as a confident zero.
  const marginalia = suggestions.state === 'ok' ? buildMarginalia(suggestions.data) : null;
  const report = await readReportContext();
  const suggestionsHref = `/a/${encodeURIComponent(slug)}/suggestions`;

  return (
    <main className="shell">
      <article className="article">
        <header className="article-header">
          <h1 className="headline">{article.headline}</h1>
          {article.dek ? <p className="dek">{article.dek}</p> : null}
          <div className="byline">
            <a className="byline-name" href={`/j/${encodeURIComponent(article.authorHandle)}`}>
              {article.authorDisplayName}
            </a>
            {article.authorTier === 'verified' ? (
              <span className="badge badge-verified" title="Verified journalist">
                Verified
              </span>
            ) : null}
            <span className="byline-sep">·</span>
            <span className="byline-meta">rev {article.rev}</span>
            {article.publishedAt ? (
              <>
                <span className="byline-sep">·</span>
                <time className="byline-meta" dateTime={article.publishedAt}>
                  {formatDate(article.publishedAt)}
                </time>
              </>
            ) : null}
          </div>
        </header>

        <div className="article-body">
          {paragraphs.length > 0 ? (
            paragraphs.map((block, i) => <p key={i}>{block}</p>)
          ) : (
            <p className="muted">This revision has no body text.</p>
          )}
        </div>

        <section className="revisions" aria-label="Revision history">
          <h2 className="revisions-title">Revision history</h2>
          <ol className="revision-list">
            {revisions.map((r) => (
              <li key={r.rev} className="revision">
                <div className="revision-head">
                  <span className="revision-rev">rev {r.rev}</span>
                  {r.createdAt ? (
                    <time className="revision-date" dateTime={r.createdAt}>
                      {formatDate(r.createdAt)}
                    </time>
                  ) : null}
                </div>
                {r.changelog.length > 0 ? (
                  <ul className="revision-credits">
                    {r.changelog.map((c, i) => (
                      <li key={`${r.rev}-${i}`}>
                        {c.type} suggested by {shortKey(c.editorKey)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="revision-credits muted">
                    {r.rev === 1 ? 'First published.' : 'No external credits.'}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className="editing-cards" aria-label="Editing">
          {improvedBy ? (
            <div className="card">
              <h2 className="card-title">
                Improved by {improvedBy.editorCount}{' '}
                {improvedBy.editorCount === 1 ? 'editor' : 'editors'}
              </h2>
              <ul className="card-lines">
                {improvedBy.typeCounts.map((t) => (
                  <li key={t.type}>
                    {t.type}: {t.count} accepted
                  </li>
                ))}
              </ul>
              <p className="card-meta">
                Latest: {improvedBy.latest.entries[0]!.type} by{' '}
                {shortKey(improvedBy.latest.entries[0]!.editorKey)} accepted in rev{' '}
                {improvedBy.latest.rev}
                {improvedBy.latest.entries.length > 1
                  ? ` with ${improvedBy.latest.entries.length - 1} more in this revision`
                  : ''}
                {improvedBy.latest.createdAt
                  ? ` on ${formatDate(improvedBy.latest.createdAt)}`
                  : ''}
              </p>
            </div>
          ) : null}

          {marginalia && marginalia.open > 0 ? (
            <a className="card card-link" href={suggestionsHref}>
              {marginalia.open} open suggestion{marginalia.open === 1 ? '' : 's'},{' '}
              {marginalia.correctionsWithCitations} correction
              {marginalia.correctionsWithCitations === 1 ? '' : 's'} with citations
            </a>
          ) : null}

          {article.status === 'published' ? (
            <div className="card">
              <h2 className="card-title">Suggest an edit</h2>
              <p className="card-body">
                Spotted an error? Propose a fix; {article.authorDisplayName} decides. Accepted
                work is credited publicly. Suggesting happens in the MyNews app.
              </p>
              <a className="card-more" href="/about/editing">
                How editing works
              </a>
            </div>
          ) : null}
        </section>

        <section className="report-section" aria-label="Report">
          <ReportButton
            targetKind="article"
            targetId={article.articleId}
            label="Report this article"
            {...report}
          />
        </section>

        <footer className="footer-note">Reading is free. No ads.</footer>
      </article>
    </main>
  );
}
