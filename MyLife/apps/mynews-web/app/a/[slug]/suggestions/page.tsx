import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadArticle, loadSuggestionEvents, loadSuggestions } from '@/lib/cloud';
import { OutageNotice, outageMetadata } from '@/app/components/OutageNotice';
import { ReportButton } from '@/app/components/ReportButton';
import { readReportContext } from '@/lib/report-context';
import { describeEvent, diffToBlocks } from '@/lib/editing';
import { formatDate, safeCitations } from '@/lib/format';
import { publicOrigin } from '@/lib/origin';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  accepted: 'Accepted',
  partial: 'Accepted with counter-edit',
  rejected: 'Rejected',
  stale: 'Stale',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadArticle(slug);
  if (result.state === 'outage') return outageMetadata();
  if (result.state !== 'ok') return { title: 'MyNews' };
  const article = result.data;
  const url = `${publicOrigin()}/a/${encodeURIComponent(slug)}/suggestions`;
  return {
    title: `${article.headline}: suggestions`,
    description: `Public suggestion threads for "${article.headline}" on MyNews.`,
    alternates: { canonical: url },
  };
}

export default async function ArticleSuggestionsPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await loadArticle(slug);
  if (result.state === 'outage') return <OutageNotice subject="this article" />;
  if (result.state !== 'ok') notFound();
  const article = result.data;

  const suggestionsResult = await loadSuggestions(article.articleId);
  // The suggestion list IS this page, so a failed read is an outage here rather
  // than an omitted card: rendering "no suggestions yet" would be a claim about
  // the editing record that we did not manage to read.
  if (suggestionsResult.state === 'outage') {
    return <OutageNotice subject="the suggestions on this article" />;
  }
  const suggestions = suggestionsResult.state === 'ok' ? suggestionsResult.data : [];

  // One events fetch per suggestion; article suggestion counts stay small. A
  // thread whose events fail to load renders without its thread lines rather
  // than taking the whole page down.
  const eventsBySuggestion = await Promise.all(
    suggestions.map(async (s) => {
      const events = await loadSuggestionEvents(s.id);
      return events.state === 'ok' ? events.data : [];
    }),
  );

  const report = await readReportContext();

  return (
    <main className="shell">
      <header className="suggestions-header">
        <p className="crumb">
          <a href={`/a/${encodeURIComponent(slug)}`}>{article.headline}</a>
        </p>
        <h1 className="headline">Suggestions</h1>
        <p className="muted">
          Typed, cited proposals from volunteer editors. Only the article&apos;s author can
          change the article&apos;s words; every acceptance is credited publicly.
        </p>
      </header>

      {suggestions.length === 0 ? (
        <p className="muted">No suggestions yet. Suggesting happens in the MyNews app.</p>
      ) : (
        <ol className="suggestion-list">
          {suggestions.map((s, i) => {
            const events = eventsBySuggestion[i] ?? [];
            return (
              <li key={s.id} className="suggestion">
                <div className="suggestion-head">
                  <span className={`status-chip status-${s.status}`}>
                    {STATUS_LABELS[s.status] ?? s.status}
                  </span>
                  <span className="suggestion-type">{s.type}</span>
                  <span className="byline-sep">·</span>
                  <a className="editor-link" href={`/e/${encodeURIComponent(s.editorHandle)}`}>
                    {s.editorDisplayName} (@{s.editorHandle})
                  </a>
                  <span className="byline-sep">·</span>
                  <span className="suggestion-meta">
                    rev {s.baseRev}
                    {s.createdAt ? ` · ${formatDate(s.createdAt)}` : ''}
                  </span>
                </div>

                {s.rationale ? <p className="suggestion-rationale">{s.rationale}</p> : null}

                <div className="diff" aria-label="Proposed change">
                  {diffToBlocks(s.diff).map((block) =>
                    block.kind === 'del' ? (
                      <del key={block.key} className="diff-del">
                        {block.text}
                      </del>
                    ) : (
                      <ins key={block.key} className="diff-add">
                        {block.text}
                      </ins>
                    ),
                  )}
                </div>

                {safeCitations(s.citations).length > 0 ? (
                  <ul className="citations">
                    {safeCitations(s.citations).map((url) => (
                      <li key={url}>
                        <a href={url} rel="nofollow noopener noreferrer">
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {s.endorsements > 0 ? (
                  <p className="endorsements">
                    {s.endorsements} editor{s.endorsements === 1 ? '' : 's'} endorsed this fix
                  </p>
                ) : null}

                {events.length > 0 ? (
                  <ol className="thread" aria-label="Thread">
                    {events.map((event) => {
                      const line = describeEvent(event);
                      return (
                        <li key={event.id} className="thread-row">
                          <span className="thread-head">
                            {event.actorHandle ? `@${event.actorHandle}` : 'unknown'} {line.label}
                            {event.createdAt ? ` · ${formatDate(event.createdAt)}` : ''}
                          </span>
                          {line.body ? <p className="thread-body">{line.body}</p> : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : null}

                <div className="suggestion-report">
                  <ReportButton
                    targetKind="suggestion"
                    targetId={s.id}
                    label="Report this suggestion"
                    {...report}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
