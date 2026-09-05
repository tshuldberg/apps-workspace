// Storage & Backup hub (Plan 41 WP-41B3). Hidden route reached from Settings.
// Renders the folded read model only: per-data-class policy, every destination
// with its REAL chip/quota/verified-count/jobs, running jobs, the prominent
// issues list, and an honest empty state that teaches what a destination is.
// Nothing here claims a backup exists until a destination verified a copy.

import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Plus } from 'lucide-react-native';
import { Button, HonestNotice, SectionHeader } from '../components/kit';
import { JobRow, QuotaBar, StatusChip, StorageHeader } from '../components/StorageKit';
import { useStorage } from '../providers/StorageProvider';
import {
  STORAGE_UI_COPY,
  buildStorageHubViewModel,
  type StorageDestinationSummary,
  type StorageIssueLine,
  type StoragePolicyLine,
} from '../data/storage-destinations/storage-ui-core';
import { MK_RADIUS, type MkColors } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export default function StorageScreen(): React.ReactElement {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { diagnostics, refresh } = useStorage();

  // Re-read the folded read model whenever this screen regains focus (after a
  // backup, verify, or connect flow elsewhere writes rows).
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const vm = useMemo(() => buildStorageHubViewModel(diagnostics), [diagnostics]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }]}
    >
      <StorageHeader title={STORAGE_UI_COPY.hubTitle} subtitle="Where your encrypted data is kept" backFallback="/settings" />

      {vm.issues.length > 0 ? (
        <View style={styles.issues}>
          {vm.issues.map((issue) => <IssueCard key={issue.kind} issue={issue} />)}
        </View>
      ) : null}

      {!vm.hasAnyDestination ? (
        <View style={styles.panel}>
          <Text style={styles.emptyTitle}>{STORAGE_UI_COPY.emptyTitle}</Text>
          <Text style={styles.emptyBody}>{STORAGE_UI_COPY.emptyBody}</Text>
          <Button title="Add a destination" onPress={() => router.push('/storage/add-destination')} />
          <HonestNotice text={STORAGE_UI_COPY.encryptBeforeLeaving} />
        </View>
      ) : (
        <>
          {vm.policies.length > 0 ? (
            <View style={styles.panel}>
              <SectionHeader title="What goes where" hint="The destination each kind of data is kept on" />
              {vm.policies.map((policy) => <PolicyRow key={policy.dataClass} policy={policy} />)}
            </View>
          ) : null}

          <View style={styles.panel}>
            <View style={styles.destHeader}>
              <SectionHeader title="Destinations" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a destination"
                onPress={() => router.push('/storage/add-destination')}
                style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.6 }]}
              >
                <Plus size={18} color={c.accent} />
              </Pressable>
            </View>
            {vm.destinations.map((destination) => (
              <DestinationRow key={destination.id} destination={destination} />
            ))}
          </View>

          <View style={styles.actions}>
            <Button title="Back up now" onPress={() => router.push('/storage/backup')} />
            <Button title="Restore from a backup" variant="secondary" onPress={() => router.push('/storage/restore')} />
          </View>

          <HonestNotice text={STORAGE_UI_COPY.notBackedUpUntilVerified} />
          <HonestNotice text={STORAGE_UI_COPY.hostedNotDefault} />
        </>
      )}
    </ScrollView>
  );
}

function IssueCard({ issue }: { issue: StorageIssueLine }): React.ReactElement {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const tint = issue.tone === 'danger' ? c.dangerSoft : c.warningSoft;
  const edge = issue.tone === 'danger' ? c.danger : c.warning;
  return (
    <View style={[styles.issueCard, { backgroundColor: tint, borderColor: edge }]}>
      <Text style={[styles.issueTitle, { color: edge }]}>{issue.title}</Text>
      <Text style={styles.issueDetail}>{issue.detail}</Text>
    </View>
  );
}

function PolicyRow({ policy }: { policy: StoragePolicyLine }): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  const mirror = policy.mirrorLabel ? ` · mirror: ${policy.mirrorLabel}` : '';
  return (
    <View style={styles.policyRow}>
      <Text style={styles.policyLabel}>{policy.label}</Text>
      <Text style={styles.policyDest} numberOfLines={1}>
        {policy.primaryLabel}
        {mirror}
      </Text>
    </View>
  );
}

function DestinationRow({ destination }: { destination: StorageDestinationSummary }): React.ReactElement {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const verified = `${destination.verifiedObjects} verified`;
  const unhealthy = destination.unhealthyObjects > 0 ? ` · ${destination.unhealthyObjects} need attention` : '';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/storage/destination/[id]', params: { id: destination.id } })}
      style={({ pressed }) => [styles.destRow, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.destText}>
        <View style={styles.destTitleRow}>
          <Text style={styles.destTitle} numberOfLines={1}>{destination.label}</Text>
          <StatusChip label={destination.chip.label} tone={destination.chip.tone} />
        </View>
        <Text style={styles.destMeta}>{destination.name}</Text>
        <QuotaBar quota={destination.quota} />
        <Text style={styles.destMeta}>
          {verified}
          {unhealthy}
          {destination.completeBackupCount > 0 ? ` · ${destination.completeBackupCount} backup${destination.completeBackupCount === 1 ? '' : 's'}` : ''}
        </Text>
        {destination.runningJobs.map((job) => <JobRow key={job.id} job={job} />)}
      </View>
      <ChevronRight size={18} color={c.textTertiary} />
    </Pressable>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14 },
  issues: { gap: 10 },
  issueCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 12,
    gap: 4,
  },
  issueTitle: { fontSize: 14, fontWeight: '800' },
  issueDetail: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  emptyTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  emptyBody: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
  destHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  actions: { gap: 10 },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    borderBottomColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  policyLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
  policyDest: { flex: 1, textAlign: 'right', color: c.textSecondary, fontSize: 13 },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  destText: { flex: 1, minWidth: 0, gap: 6 },
  destTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  destTitle: { flex: 1, color: c.text, fontSize: 15, fontWeight: '700' },
  destMeta: { color: c.textTertiary, fontSize: 12 },
});
