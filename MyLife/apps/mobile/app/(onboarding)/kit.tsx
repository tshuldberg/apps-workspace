import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import {
  MODULE_METADATA,
  type ModuleId,
} from '@mylife/module-registry';
import { enableModule, setPreference } from '@mylife/db';
import { useDatabase } from '../../components/DatabaseProvider';

/**
 * Cluster -> modules map. Inlined per Track Y1 constraint (do not modify
 * packages/module-registry). Source of truth:
 * packages/module-registry/src/dashboard.ts (CLUSTER_MODULES) and
 * docs/plans/consolidation/04-onboarding-goal-based.md.
 */
const CLUSTER_MODULES: Record<string, readonly ModuleId[]> = {
  body: ['health', 'workouts', 'nutrition', 'fast', 'mood', 'cycle', 'meds'],
  mind: ['journal', 'notes', 'mood', 'voice', 'books', 'flash', 'words'],
  home: ['homes', 'car', 'garden', 'pets', 'closet'],
  money: ['budget', 'subs', 'market'],
  social: ['rsvp', 'forums', 'presence', 'mail'],
  outdoor: ['trails', 'surf', 'stars', 'garden'],
  knowledge: ['books', 'flash', 'words', 'notes', 'habits'],
};

/**
 * First-action route per cluster. Modules whose creation flow is multi-step
 * or gated by native capabilities fall back to /(hub). Paths are literal
 * strings expo-router resolves at runtime; bad paths will be redirected
 * back to the hub via the fallback handler.
 */
const CLUSTER_FIRST_ACTION: Record<string, Href> = {
  body: '/(mood)/log-mood',
  mind: '/(journal)/new-entry',
  home: '/(hub)',
  money: '/(budget)/create',
  social: '/(hub)',
  outdoor: '/(hub)',
  knowledge: '/(books)/discover',
};

const FALLBACK_ROUTE: Href = '/(hub)';

interface KitRow {
  id: ModuleId;
  name: string;
  tagline: string;
  icon: string;
}

function buildKitRows(clusters: readonly string[]): KitRow[] {
  const seen = new Set<ModuleId>();
  const rows: KitRow[] = [];
  for (const clusterId of clusters) {
    const modules = CLUSTER_MODULES[clusterId];
    if (!modules) continue;
    for (const moduleId of modules) {
      if (seen.has(moduleId)) continue;
      seen.add(moduleId);
      const meta = MODULE_METADATA[moduleId];
      if (!meta) continue;
      rows.push({
        id: moduleId,
        name: meta.name,
        tagline: meta.tagline,
        icon: meta.icon,
      });
    }
  }
  return rows;
}

function parseClusters(raw: string | string[] | undefined): readonly string[] {
  if (!raw) return [];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s in CLUSTER_MODULES);
}

export default function KitScreen() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{ clusters?: string | string[] }>();
  const clusters = useMemo(() => parseClusters(params.clusters), [params.clusters]);
  const rows = useMemo(() => buildKitRows(clusters), [clusters]);
  const [enabledIds, setEnabledIds] = useState<Set<ModuleId>>(
    () => new Set(rows.map((r) => r.id)),
  );

  const toggle = useCallback((id: ModuleId) => {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    setPreference(db, 'today.primary_clusters', JSON.stringify(clusters));
    setPreference(db, 'onboarding.completed_at', new Date().toISOString());
    for (const id of enabledIds) {
      try {
        enableModule(db, id);
      } catch (err) {
        console.error(`[MyLife] Failed to enable module "${id}":`, err);
      }
    }
    const primary = clusters[0];
    const target = (primary && CLUSTER_FIRST_ACTION[primary]) ?? FALLBACK_ROUTE;
    router.replace(target);
  }, [db, clusters, enabledIds, router]);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Your starter kit</Text>
        <Text style={s.subtitle}>
          Turn off any modules you don't want. You can enable more later from
          Discover.
        </Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {rows.length === 0 ? (
          <Text style={s.emptyText}>No modules matched your selection.</Text>
        ) : (
          rows.map((row) => {
            const isOn = enabledIds.has(row.id);
            return (
              <Pressable
                key={row.id}
                accessibilityRole="switch"
                accessibilityState={{ checked: isOn }}
                accessibilityLabel={`${row.name}: ${row.tagline}`}
                style={({ pressed }) => [
                  s.row,
                  isOn && s.rowOn,
                  pressed && s.rowPressed,
                ]}
                onPress={() => toggle(row.id)}
              >
                <Text style={s.rowIcon}>{row.icon}</Text>
                <View style={s.rowText}>
                  <Text style={s.rowName}>{row.name}</Text>
                  <Text style={s.rowTagline} numberOfLines={1}>
                    {row.tagline}
                  </Text>
                </View>
                <View style={[s.toggleTrack, isOn && s.toggleTrackOn]}>
                  <View style={[s.toggleThumb, isOn && s.toggleThumbOn]} />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <View style={s.footer}>
        <Text style={s.footerHint}>
          {enabledIds.size} module{enabledIds.size === 1 ? '' : 's'} will be
          enabled
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start"
          style={({ pressed }) => [s.primaryBtn, pressed && s.btnPressed]}
          onPress={handleStart}
        >
          <Text style={s.primaryBtnText}>Start</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 72,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowOn: {
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderColor: colors.accent,
  },
  rowPressed: { opacity: 0.85 },
  rowIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  rowText: { flex: 1 },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  rowTagline: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  toggleTrack: {
    width: 42,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.glassStrong,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackOn: { backgroundColor: colors.accent },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.text,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  footerHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
