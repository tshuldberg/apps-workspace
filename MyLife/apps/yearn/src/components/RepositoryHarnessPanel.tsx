import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  runYearnRepositoryHarness,
  type YearnRepositoryHarnessResult,
} from '../dev/repositoryHarness';
import { openYearnSQLiteCache } from '../lib/sqliteYearnOfflineCache';
import type { YearnOfflineCache } from '../lib/offlineCache';
import { useYearnCloud } from '../providers/YearnCloudProvider';
import {
  yearnColors,
  yearnRadius,
  yearnSpacing,
  yearnTypography,
} from '../theme/yearnTheme';

function statusLabel(status: YearnRepositoryHarnessResult['status']): string {
  switch (status) {
  case 'not_configured':
    return 'Not configured';
  case 'no_session':
    return 'No session';
  case 'passed':
    return 'Passed';
  case 'failed':
    return 'Failed';
  }
}

function statusColor(status: YearnRepositoryHarnessResult['status']): string {
  switch (status) {
  case 'passed':
    return yearnColors.success;
  case 'failed':
    return yearnColors.alarm;
  case 'no_session':
    return yearnColors.gold;
  case 'not_configured':
    return yearnColors.textTertiary;
  }
}

export function RepositoryHarnessPanel() {
  const cloud = useYearnCloud();
  const [cache, setCache] = useState<YearnOfflineCache | null>(null);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [result, setResult] = useState<YearnRepositoryHarnessResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let mounted = true;

    try {
      const nextCache = openYearnSQLiteCache();
      if (mounted) {
        setCache(nextCache);
        setCacheError(null);
      }
    } catch (err) {
      if (mounted) {
        setCache(null);
        setCacheError(err instanceof Error ? err.message : String(err));
      }
    }

    return () => {
      mounted = false;
    };
  }, []);

  const cloudDetail = useMemo(() => {
    if (!cloud.isConfigured) return 'Add Yearn Supabase env vars to enable live RPC checks.';
    if (!cloud.isReady) return 'Restoring secure Supabase session.';
    if (!cloud.userId) return 'Supabase is configured. Sign in to run authenticated RPC checks.';
    return `Ready for ${cloud.environment} RPC checks.`;
  }, [cloud.environment, cloud.isConfigured, cloud.isReady, cloud.userId]);

  const cacheDetail = useMemo(() => {
    if (cacheError) return `Offline cache unavailable: ${cacheError}`;
    if (!cache) return 'Opening offline cache.';
    return 'Offline cache ready for fallback reads and queued actions.';
  }, [cache, cacheError]);

  const runHarness = useCallback(async () => {
    setIsRunning(true);
    try {
      const nextResult = await runYearnRepositoryHarness(cloud.supabase, { cache });
      setResult(nextResult);
    } finally {
      setIsRunning(false);
    }
  }, [cache, cloud.supabase]);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.kicker}>Data layer harness</Text>
          <Text style={styles.title}>Live Yearn RPC smoke</Text>
        </View>
        {result ? (
          <View style={[styles.statusPill, { borderColor: statusColor(result.status) }]}>
            <Text style={[styles.statusText, { color: statusColor(result.status) }]}>
              {statusLabel(result.status)}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.detail}>{cloudDetail}</Text>
      <Text style={styles.detail}>{cacheDetail}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Run Yearn RPC harness"
        disabled={isRunning}
        onPress={runHarness}
        style={({ pressed }) => [
          styles.button,
          (pressed || isRunning) && styles.buttonPressed,
        ]}
      >
        {isRunning ? (
          <ActivityIndicator color={yearnColors.inkwine} size="small" />
        ) : (
          <Text style={styles.buttonText}>Run checks</Text>
        )}
      </Pressable>

      {result ? (
        <View style={styles.checks}>
          {result.checks.map((check) => (
            <View key={check.id} style={styles.checkRow}>
              <Text style={styles.checkName}>{check.label}</Text>
              <Text style={[
                styles.checkStatus,
                check.status === 'pass' && styles.checkPass,
                check.status === 'fail' && styles.checkFail,
              ]}>
                {check.status}
              </Text>
              <Text style={styles.checkDetail}>{check.detail}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: yearnColors.surface,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    gap: yearnSpacing.md,
    padding: yearnSpacing.lg,
  },
  panelHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: yearnSpacing.md,
  },
  kicker: {
    color: yearnColors.gold,
    ...yearnTypography.label,
    textTransform: 'uppercase',
  },
  title: {
    color: yearnColors.vellum,
    ...yearnTypography.title,
  },
  statusPill: {
    borderRadius: yearnRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detail: {
    color: yearnColors.textSecondary,
    ...yearnTypography.body,
  },
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: yearnColors.coral,
    borderRadius: yearnRadius.pill,
    minHeight: 42,
    justifyContent: 'center',
    minWidth: 118,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  buttonPressed: {
    backgroundColor: yearnColors.coralPressed,
  },
  buttonText: {
    color: yearnColors.inkwine,
    fontSize: 14,
    fontWeight: '700',
  },
  checks: {
    borderTopColor: yearnColors.line,
    borderTopWidth: 1,
    gap: yearnSpacing.sm,
    paddingTop: yearnSpacing.md,
  },
  checkRow: {
    gap: 3,
  },
  checkName: {
    color: yearnColors.vellum,
    fontSize: 13,
    fontWeight: '700',
  },
  checkStatus: {
    color: yearnColors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  checkPass: {
    color: yearnColors.success,
  },
  checkFail: {
    color: yearnColors.alarm,
  },
  checkDetail: {
    color: yearnColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
});
