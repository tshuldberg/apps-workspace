import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadJournalist } from '@/lib/cloud';
import { OutageNotice, outageMetadata } from '@/app/components/OutageNotice';
import { ReportButton } from '@/app/components/ReportButton';
import { readReportContext } from '@/lib/report-context';
import { publicOrigin } from '@/lib/origin';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const result = await loadJournalist(handle);
  if (result.state === 'outage') return outageMetadata();
  if (result.state !== 'ok') return { title: 'MyNews' };
  const journalist = result.data;
  const description = journalist.bio || `Articles by ${journalist.displayName} on MyNews.`;
  const url = `${publicOrigin()}/j/${encodeURIComponent(handle)}`;
  return {
    title: `${journalist.displayName} (@${journalist.handle}) | MyNews`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'profile',
      title: `${journalist.displayName} (@${journalist.handle})`,
      description,
      url,
      siteName: 'MyNews',
    },
  };
}

export default async function JournalistPage({ params }: PageProps) {
  const { handle } = await params;
  const result = await loadJournalist(handle);
  if (result.state === 'outage') return <OutageNotice subject="this journalist profile" />;
  if (result.state !== 'ok') notFound();
  const journalist = result.data;
  const report = await readReportContext();

  return (
    <main className="shell">
      <header className="journalist-header">
        <h1 className="journalist-name">
          {journalist.displayName}
          {/* Plan 48 WP8: only a live approved verification renders a badge, so
              a tier column that drifted from the verification record cannot
              claim one. */}
          {journalist.verificationState === 'approved' ? (
            <span className="badge badge-verified" title="Verified journalist">
              Verified
            </span>
          ) : null}
        </h1>
        <p className="journalist-handle">@{journalist.handle}</p>
        {journalist.bio ? <p className="journalist-bio">{journalist.bio}</p> : null}
        {journalist.beats.length > 0 ? (
          <ul className="beats">
            {journalist.beats.map((beat) => (
              <li key={beat} className="beat">
                {beat}
              </li>
            ))}
          </ul>
        ) : null}
        {journalist.id ? (
          <div className="journalist-report">
            <ReportButton
              targetKind="profile"
              targetId={journalist.id}
              label="Report this profile"
              {...report}
            />
          </div>
        ) : null}
      </header>

      <section className="article-list-section" aria-label="Published articles">
        <h2 className="section-title">Published articles</h2>
        {journalist.articles.length > 0 ? (
          <ul className="article-list">
            {journalist.articles.map((item) => (
              <li key={item.articleId} className="article-list-item">
                <a className="article-list-title" href={`/a/${encodeURIComponent(item.slug)}`}>
                  {item.headline}
                </a>
                {item.dek ? <span className="article-list-dek">{item.dek}</span> : null}
                {item.publishedAt ? (
                  <time className="article-list-meta" dateTime={item.publishedAt}>
                    {formatDate(item.publishedAt)}
                  </time>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No published articles yet.</p>
        )}
      </section>
    </main>
  );
}
