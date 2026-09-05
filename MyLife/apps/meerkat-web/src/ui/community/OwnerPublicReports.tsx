// OwnerPublicReports (Plan 19 P8b, web twin of the mobile component): the owner
// "Public reports" queue inside the community owner-review panel. For each
// publication this device OWNS in the community, it fetches the host-stored abuse
// reports with the owner-signed GET, renders them priority-first (csam/illegal
// flagged), and offers a per-report "Reviewed" (local) and a per-publication
// "Unpublish" (real: re-register the unpublished revision on every host so it
// 404s + re-announce so the directory drops it). Honest empty/error states.

import { useCallback, useEffect, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { getSetting, PUBLIC_DIRECTORY_URL_SETTING } from '../../lib/meerkat-data';
import { PUBLIC_CATEGORY_LABELS } from '../../lib/discover-core';
import {
  PUBLIC_REPORTS_COPY,
  fetchOwnerPublicReports,
  listOwnedPublications,
  listReviewedReportSigs,
  markPublicReportReviewed,
  unpublishPublicly,
  type OwnedPublication,
  type OwnerPublicReport,
} from '../../lib/public-publish';
import { Button } from '../shell/Button';
import { shortHex } from '../format';

type PubReportsState =
  | { kind: 'loading' }
  | { kind: 'error'; reason: 'no_hosts' | 'unreachable' }
  | { kind: 'ready'; reports: OwnerPublicReport[] };

export function OwnerPublicReports({ communityId }: { communityId: string }): React.ReactElement | null {
  const m = useMeerkat();
  const db = m.db;
  const identity = m.identity;

  const [pubs, setPubs] = useState<OwnedPublication[]>([]);
  const [byPub, setByPub] = useState<Record<string, PubReportsState>>({});
  const [reviewed, setReviewed] = useState<Record<string, Set<string>>>({});
  const [statusByPub, setStatusByPub] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(() => {
    const owned = listOwnedPublications(db, identity.publicKey, communityId);
    setPubs(owned);
    setStatusByPub(Object.fromEntries(owned.map((p) => [p.publicationId, p.status])));
    setReviewed(Object.fromEntries(owned.map((p) => [p.publicationId, listReviewedReportSigs(db, p.publicationId)])));
    for (const p of owned) {
      setByPub((prev) => ({ ...prev, [p.publicationId]: { kind: 'loading' } }));
      void (async () => {
        const res = await fetchOwnerPublicReports({ identity, publicationId: p.publicationId, hostUrls: p.hostUrls });
        setByPub((prev) => ({
          ...prev,
          [p.publicationId]: res.ok
            ? { kind: 'ready', reports: res.reports }
            : { kind: 'error', reason: res.reason },
        }));
      })();
    }
  }, [db, identity, communityId]);

  useEffect(() => { reload(); }, [reload]);

  const onReviewed = useCallback((publicationId: string, sig: string) => {
    markPublicReportReviewed(db, publicationId, sig);
    setReviewed((prev) => {
      const next = new Set(prev[publicationId] ?? []);
      next.add(sig);
      return { ...prev, [publicationId]: next };
    });
  }, [db]);

  const onUnpublish = useCallback((publicationId: string, title: string) => {
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Unpublish "${title}"? This removes it from the public directory and tells every serving host to stop serving it. Copies already cached on a reader's device cannot be recalled.`);
    if (!confirmed) return;
    void (async () => {
      const directoryUrl = (getSetting(db, PUBLIC_DIRECTORY_URL_SETTING) ?? '').trim();
      const result = await unpublishPublicly({}, { db, identity, publicationId, directoryUrl });
      setNotice(result.message);
      reload();
    })();
  }, [db, identity, reload]);

  if (pubs.length === 0) return null;

  return (
    <section className="mk-owner-public-reports" aria-label="Public reports">
      <h2 className="mk-h2">{PUBLIC_REPORTS_COPY.sectionTitle}</h2>
      <p className="mk-muted" style={{ fontSize: 12 }}>{PUBLIC_REPORTS_COPY.hint}</p>
      {notice ? <div className="mk-box is-info">{notice}</div> : null}
      {pubs.map((p) => {
        const state: PubReportsState = byPub[p.publicationId] ?? { kind: 'loading' };
        const reviewedSet = reviewed[p.publicationId] ?? new Set<string>();
        const status = statusByPub[p.publicationId] ?? p.status;
        const visible = state.kind === 'ready' ? state.reports.filter((r) => !reviewedSet.has(r.signature)) : [];
        return (
          <div key={p.publicationId} className="mk-public-report-pub">
            <div className="mk-public-report-head">
              <span className="mk-member-name">{p.title}</span>
              <span className="mk-muted" style={{ fontSize: 12 }}>
                {(PUBLIC_CATEGORY_LABELS[p.category] ?? p.category)}{status !== 'active' ? ' · unpublished' : ''}
              </span>
            </div>
            {state.kind === 'loading' ? (
              <p className="mk-muted">{PUBLIC_REPORTS_COPY.loading}</p>
            ) : state.kind === 'error' ? (
              <p className="mk-muted">
                {state.reason === 'no_hosts' ? PUBLIC_REPORTS_COPY.noHosts : PUBLIC_REPORTS_COPY.unreachable}
              </p>
            ) : visible.length === 0 ? (
              <p className="mk-muted">{PUBLIC_REPORTS_COPY.empty}</p>
            ) : (
              visible.map((r) => (
                <div key={r.signature} className="mk-review-row">
                  <div>
                    <div className="mk-member-name">
                      {r.priority ? <span className="mk-priority-badge">{PUBLIC_REPORTS_COPY.priorityBadge}</span> : null}
                      {r.report.reason} · {r.report.targetKind} {shortHex(r.report.targetId)}
                    </div>
                    <div className="mk-muted" style={{ fontSize: 12 }}>by {shortHex(r.report.reporterDeviceId)}</div>
                  </div>
                  <Button variant="ghost" small onClick={() => onReviewed(p.publicationId, r.signature)}>
                    {PUBLIC_REPORTS_COPY.reviewedAction}
                  </Button>
                </div>
              ))
            )}
            {status === 'active' ? (
              <Button variant="ghost" small onClick={() => onUnpublish(p.publicationId, p.title)}>
                {PUBLIC_REPORTS_COPY.unpublishAction}
              </Button>
            ) : null}
          </div>
        );
      })}
      <p className="mk-muted" style={{ fontSize: 12 }}>
        Reports come from the serving host&apos;s open abuse intake, fetched with your owner signature. Unpublish
        removes the publication from the directory and tells hosts to stop serving it; copies already cached on a
        reader&apos;s device cannot be recalled.
      </p>
    </section>
  );
}
