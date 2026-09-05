/**
 * Phase 4a Insights screen.
 *
 * Three sections (Correlations / Trends / Discoveries) rendering output of
 * the already-built @mylife/intelligence engine. NO LLM, NO tool calling,
 * NO local model — just statistics over permitted on-device data.
 *
 * The whole screen is gated by the AI permission record in hub_ai_permissions.
 * Users with no `can_read=1` row for any module see a single opt-in banner.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing, surfaceTiers } from '@mylife/ui';
import { useEnabledModules } from '@mylife/module-registry';
import { getPermittedModules } from '@mylife/intelligence';
import { useDatabase } from '../../../components/DatabaseProvider';
import { CorrelationPanel } from '../../../components/insights/CorrelationPanel';
import { TrendsPanel } from '../../../components/insights/TrendsPanel';
import { DiscoveriesPanel } from '../../../components/insights/DiscoveriesPanel';
import { HUB_TAB_BAR_CLEARANCE } from '../_layout';

type Section = 'correlations' | 'trends' | 'discoveries';

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'correlations', label: 'Correlations' },
  { id: 'trends', label: 'Trends' },
  { id: 'discoveries', label: 'Discoveries' },
];

export default function InsightsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const enabledModules = useEnabledModules();
  const [section, setSection] = useState<Section>('correlations');

  const hasAIPermission = useMemo(() => {
    try {
      return getPermittedModules(db).length > 0;
    } catch {
      return false;
    }
  }, [db]);

  if (!hasAIPermission) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
      >
        <OptInBanner onCta={() => router.push('/(hub)/settings/automations')} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>
          On-device statistics across permitted modules. No AI, no cloud, no
          data leaves your device.
        </Text>
      </View>

      <View style={styles.segmentRow}>
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setSection(s.id)}
              style={[styles.segment, active && styles.segmentActive]}
              accessibilityRole="button"
              accessibilityLabel={`section-${s.id}`}
            >
              <Text
                style={[
                  styles.segmentText,
                  active ? styles.segmentTextActive : styles.segmentTextInactive,
                ]}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.panel}>
        {section === 'correlations' ? (
          <CorrelationPanel db={db} modules={enabledModules} />
        ) : section === 'trends' ? (
          <TrendsPanel db={db} modules={enabledModules} />
        ) : (
          <DiscoveriesPanel db={db} modules={enabledModules} />
        )}
      </View>
    </ScrollView>
  );
}

function OptInBanner({ onCta }: { onCta: () => void }) {
  return (
    <View style={styles.bannerCard} accessibilityLabel="insights-optin-banner">
      <Text style={styles.bannerTitle}>Requires AI opt-in</Text>
      <Text style={styles.bannerBody}>
        Insights read permitted modules' metrics to compute correlations on
        device. No data leaves MyLife. Turn on AI access from Settings to see
        trends, correlations, and discoveries.
      </Text>
      <Pressable
        style={styles.bannerButton}
        onPress={onCta}
        accessibilityRole="button"
        accessibilityLabel="enable-ai-access"
      >
        <Text style={styles.bannerButtonText}>Manage AI access</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    paddingBottom: HUB_TAB_BAR_CLEARANCE,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: surfaceTiers.lowest,
    borderRadius: 999,
    padding: 3,
    marginBottom: spacing.sm,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  segmentActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.hubAccent,
  },
  segmentTextInactive: {
    color: colors.text,
    opacity: 0.5,
  },
  panel: {
    minHeight: 120,
  },
  bannerCard: {
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  bannerBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  bannerButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.hubAccent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    marginTop: spacing.xs,
  },
  bannerButtonText: {
    color: '#131318',
    fontSize: 14,
    fontWeight: '700',
  },
});
