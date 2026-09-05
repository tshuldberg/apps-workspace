// OwnerPublicReports (Plan 19 P8b): the owner "Public reports" queue inside the
// community owner-review panel. For each publication this device OWNS in the
// community, it fetches the host-stored abuse reports with the owner-signed GET,
// renders them priority-first (csam/illegal flagged), and offers a per-report
// "Reviewed" (local) and a per-publication "Unpublish" (real: re-register the
// unpublished revision on every host so it 404s + re-announce so the directory
// drops it). Honest empty/error states; never claims removal that did not happen.

import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity } from '@mylife/sync';
import { getSetting } from '../data/db';
import { PUBLIC_DIRECTORY_URL_SETTING } from '../data/sync-core';
import { PUBLIC_CATEGORY_LABELS } from '../data/discover-core';
import {
  PUBLIC_REPORTS_COPY,
  fetchOwnerPublicReports,
  listOwnedPublications,
  listReviewedReportSigs,
  markPublicReportReviewed,
  unpublishPublicly,
  type OwnedPublication,
  type OwnerPublicReport,
} from '../data/public-publish';
import { HonestNotice, SectionHeader } from './kit';
import { type MkColors, MK_RADIUS, shortHex } from '../theme/tokens';
import { useMkStyles } from '../providers/AppThemeProvider';

type PubReportsState =
  | { kind: 'loading' }
  | { kind: 'error'; reason: 'no_hosts' | 'unreachable' }
  | { kind: 'ready'; reports: OwnerPublicReport[] };

export function OwnerPublicReports({
  db,
  identity,
  communityId,
}: {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  communityId: string;
}): React.ReactElement | null {
  const styles = useMkStyles(makeStyles);
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

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const onReviewed = useCallback((publicationId: string, sig: string) => {
    markPublicReportReviewed(db, publicationId, sig);
    setReviewed((prev) => {
      const next = new Set(prev[publicationId] ?? []);
      next.add(sig);
      return { ...prev, [publicationId]: next };
    });
  }, [db]);

  const onUnpublish = useCallback((publicationId: string, title: string) => {
    Alert.alert(
      PUBLIC_REPORTS_COPY.unpublishAction,
      `Unpublish "${title}"? This removes it from the public directory and tells every serving host to stop serving it. Copies already cached on a reader's device cannot be recalled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: PUBLIC_REPORTS_COPY.unpublishAction,
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const directoryUrl = (getSetting(db, PUBLIC_DIRECTORY_URL_SETTING) ?? '').trim();
              const result = await unpublishPublicly({}, { db, identity, publicationId, directoryUrl });
              setNotice(result.message);
              reload();
            })();
          },
        },
      ],
    );
  }, [db, identity, reload]);

  if (pubs.length === 0) return null;

  return (
    <View style={styles.panel}>
      <SectionHeader title={PUBLIC_REPORTS_COPY.sectionTitle} hint={PUBLIC_REPORTS_COPY.hint} />
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {pubs.map((p) => {
        const state: PubReportsState = byPub[p.publicationId] ?? { kind: 'loading' };
        const reviewedSet = reviewed[p.publicationId] ?? new Set<string>();
        const status = statusByPub[p.publicationId] ?? p.status;
        const visible = state.kind === 'ready' ? state.reports.filter((r) => !reviewedSet.has(r.signature)) : [];
        return (
          <View key={p.publicationId} style={styles.pubBlock}>
            <View style={styles.pubHeader}>
              <Text style={styles.pubTitle} numberOfLines={1}>{p.title}</Text>
              <Text style={styles.pubMeta} numberOfLines={1}>
                {(PUBLIC_CATEGORY_LABELS[p.category] ?? p.category)}{status !== 'active' ? ' · unpublished' : ''}
              </Text>
            </View>
            {state.kind === 'loading' ? (
              <Text style={styles.muted}>{PUBLIC_REPORTS_COPY.loading}</Text>
            ) : state.kind === 'error' ? (
              <Text style={styles.muted}>
                {state.reason === 'no_hosts' ? PUBLIC_REPORTS_COPY.noHosts : PUBLIC_REPORTS_COPY.unreachable}
              </Text>
            ) : visible.length === 0 ? (
              <Text style={styles.muted}>{PUBLIC_REPORTS_COPY.empty}</Text>
            ) : (
              visible.map((r) => (
                <View key={r.signature} style={styles.reportRow}>
                  <View style={styles.reportText}>
                    <View style={styles.reportTitleRow}>
                      {r.priority ? <Text style={styles.priorityBadge}>{PUBLIC_REPORTS_COPY.priorityBadge}</Text> : null}
                      <Text style={styles.reportTitle} numberOfLines={1}>
                        {r.report.reason} · {r.report.targetKind} {shortHex(r.report.targetId)}
                      </Text>
                    </View>
                    <Text style={styles.reportMeta} numberOfLines={1}>by {shortHex(r.report.reporterDeviceId)}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mark report reviewed"
                    onPress={() => onReviewed(p.publicationId, r.signature)}
                    style={({ pressed }) => [styles.tinyAction, pressed && styles.pressed]}
                  >
                    <Text style={styles.tinyActionText}>{PUBLIC_REPORTS_COPY.reviewedAction}</Text>
                  </Pressable>
                </View>
              ))
            )}
            {status === 'active' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Unpublish ${p.title}`}
                onPress={() => onUnpublish(p.publicationId, p.title)}
                style={({ pressed }) => [styles.unpublishBtn, pressed && styles.pressed]}
              >
                <Text style={styles.unpublishText}>{PUBLIC_REPORTS_COPY.unpublishAction}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      <HonestNotice text="Reports come from the serving host's open abuse intake, fetched with your owner signature. Unpublish removes the publication from the directory and tells hosts to stop serving it; copies already cached on a reader's device cannot be recalled." />
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  panel: {
    marginTop: 12,
    padding: 12,
    borderRadius: MK_RADIUS.md,
    backgroundColor: c.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    gap: 8,
  },
  notice: { color: c.text, fontSize: 13 },
  pubBlock: { gap: 6, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  pubHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pubTitle: { color: c.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  pubMeta: { color: c.textSecondary, fontSize: 12 },
  muted: { color: c.textSecondary, fontSize: 13 },
  reportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reportText: { flexShrink: 1, gap: 2 },
  reportTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reportTitle: { color: c.text, fontSize: 13, flexShrink: 1 },
  reportMeta: { color: c.textSecondary, fontSize: 12 },
  priorityBadge: {
    color: c.danger,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: MK_RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.danger,
    overflow: 'hidden',
  },
  tinyAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  tinyActionText: { color: c.text, fontSize: 12, fontWeight: '600' },
  unpublishBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: MK_RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.danger,
  },
  unpublishText: { color: c.danger, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
