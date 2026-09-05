// Storage & Backup screen kit (Plan 41 WP-41B3). Small, palette-aware building
// blocks shared across the storage hub, add-destination, detail, backup, and
// restore screens. Pure presentation over the pure view-model core; no data
// access here.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import type {
  StorageChipTone,
  StorageJobLine,
  StorageQuotaLine,
} from '../data/storage-destinations/storage-ui-core';
import { MK_RADIUS, formatBytes, type MkColors } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export function toneColor(tone: StorageChipTone, c: MkColors): string {
  switch (tone) {
    case 'ok':
      return c.success;
    case 'warn':
      return c.warning;
    case 'danger':
      return c.danger;
    case 'info':
      return c.info;
    case 'muted':
      return c.textTertiary;
  }
}

export function StatusChip({ label, tone }: { label: string; tone: StorageChipTone }): React.ReactElement {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const color = toneColor(tone, c);
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

export function QuotaBar({ quota }: { quota: StorageQuotaLine }): React.ReactElement | null {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  if (!quota.hasQuota) return null;
  const usedLabel = quota.usedBytes === null ? 'Unknown' : formatBytes(quota.usedBytes);
  const capLabel = quota.capBytes === null ? null : formatBytes(quota.capBytes);
  return (
    <View style={styles.quotaWrap}>
      {quota.fraction !== null ? (
        <View style={styles.quotaTrack}>
          <View
            style={[
              styles.quotaFill,
              { width: `${Math.round(quota.fraction * 100)}%`, backgroundColor: quota.fraction >= 1 ? c.danger : c.accent },
            ]}
          />
        </View>
      ) : null}
      <Text style={styles.quotaLabel}>
        {capLabel ? `${usedLabel} of ${capLabel} used` : `${usedLabel} used`}
      </Text>
    </View>
  );
}

export function JobRow({ job }: { job: StorageJobLine }): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  const detail = job.totalBytes > 0
    ? `${formatBytes(job.completedBytes)} of ${formatBytes(job.totalBytes)}`
    : `${job.completedObjects} of ${job.totalObjects}`;
  return (
    <View style={styles.jobRow}>
      <View style={styles.jobText}>
        <Text style={styles.jobTitle}>{job.title}</Text>
        <Text style={styles.jobDetail}>
          {detail}
          {job.errorCode ? ` · ${job.errorCode}` : ''}
        </Text>
      </View>
      <StatusChip label={job.stateLabel} tone={job.tone} />
    </View>
  );
}

export function StorageHeader({
  title,
  subtitle,
  backFallback = '/storage',
}: {
  title: string;
  subtitle?: string;
  /** Where back lands when this screen was deep-linked as the first route. */
  backFallback?: string;
}): React.ReactElement {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace(backFallback as never);
        }}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
      >
        <ChevronLeft size={22} color={c.text} />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  chipText: { fontSize: 11, fontWeight: '800' },
  quotaWrap: { gap: 6 },
  quotaTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.surfaceHigh,
    overflow: 'hidden',
  },
  quotaFill: { height: 6, borderRadius: 3 },
  quotaLabel: { color: c.textSecondary, fontSize: 12.5 },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  jobText: { flex: 1, minWidth: 0, gap: 2 },
  jobTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  jobDetail: { color: c.textSecondary, fontSize: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  headerTitle: { color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  headerSubtitle: { color: c.textSecondary, fontSize: 13 },
});
