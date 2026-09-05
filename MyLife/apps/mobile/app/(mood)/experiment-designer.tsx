import { useState, useEffect } from 'react';
import { uuid } from '../../lib/uuid';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createExperiment,
  getTemplateById,
  getActiveExperiment,
  abandonExperiment,
  GlassCard,
  GradientButton,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_SURFACES,
  StatBadge,
} from '@mylife/mood';
import { Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const PERIOD_OPTIONS = [7, 14, 21, 30] as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ExperimentDesignerScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();

  const [hypothesis, setHypothesis] = useState('');
  const [intervention, setIntervention] = useState('');
  const [periodDays, setPeriodDays] = useState<7 | 14 | 21 | 30>(14);
  const [baselineStart] = useState(todayIso());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (templateId) {
      const tpl = getTemplateById(db, templateId);
      if (tpl) {
        setHypothesis(tpl.hypothesis);
        setIntervention(tpl.interventionDescription);
        setPeriodDays(tpl.suggestedDays as typeof periodDays);
        setSelectedTemplateId(tpl.id);
      }
    }
  }, [db, templateId]);

  const totalDays = periodDays * 2;
  const totalWeeks = Math.round(totalDays / 7);
  const confidence = periodDays >= 14 ? 84 : periodDays >= 7 ? 70 : 60;

  const handleStart = () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const active = getActiveExperiment(db);
      if (active) {
        abandonExperiment(db, active.id);
      }

      createExperiment(db, uuid(), {
        hypothesis: hypothesis.trim(),
        interventionDescription: intervention.trim(),
        periodDays,
        baselineStart,
        templateId: selectedTemplateId,
      });

      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create experiment.');
      setSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    // Save as draft by navigating back without starting
    router.back();
  };

  const canStart = hypothesis.trim().length > 0 && intervention.trim().length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>SCIENTIFIC SELF-DISCOVERY</Text>
        <Text style={styles.headerTitle}>Experiment Designer</Text>
        <Text style={styles.headerDescription}>
          Systematically test lifestyle changes to find what truly drives your emotional well-being using clinical-grade A/B testing logic.
        </Text>
      </View>

      {/* Core Hypothesis */}
      <GlassCard level={2} style={styles.hypothesisCard}>
        <Text style={styles.cardLabel}>CORE HYPOTHESIS</Text>
        <TextInput
          value={hypothesis}
          onChangeText={setHypothesis}
          placeholder={'"Morning meditation improves my mood"'}
          placeholderTextColor={MOOD_SURFACES.highest}
          style={styles.hypothesisInput}
          multiline
          maxLength={500}
        />
        <View style={styles.variableRow}>
          <Text style={styles.variableIcon}>{'\u{1F4CA}'}</Text>
          <Text style={styles.variableText}>Variable: Mood Score (1-10)</Text>
        </View>
      </GlassCard>

      {/* Experiment Timeline */}
      <GlassCard level={2} style={styles.timelineCard}>
        <View style={styles.timelineHeader}>
          <Text style={styles.timelineIcon}>{'\u{1F9EA}'}</Text>
          <Text style={styles.timelineTitle}>Experiment Timeline</Text>
        </View>

        {/* Phase A: Baseline */}
        <View style={styles.phaseBlock}>
          <Text style={styles.phaseLabel}>PHASE A: BASELINE</Text>
          <View style={styles.phaseRow}>
            <Text style={styles.phaseDescription}>Observe current patterns without changes</Text>
            <View style={styles.daysBadge}>
              <Text style={styles.daysNumber}>{periodDays}</Text>
              <Text style={styles.daysText}>Days</Text>
            </View>
          </View>
          <View style={styles.phaseBar}>
            <View style={[styles.phaseBarFill, styles.baselineFill]} />
          </View>
        </View>

        {/* Phase B: Intervention */}
        <View style={styles.phaseBlock}>
          <Text style={[styles.phaseLabel, { color: MOOD_ACCENT }]}>PHASE B: INTERVENTION</Text>
          <View style={styles.phaseRow}>
            <TextInput
              value={intervention}
              onChangeText={setIntervention}
              placeholder="e.g., Meditate for 10 minutes every morning"
              placeholderTextColor={MOOD_SURFACES.highest}
              style={styles.interventionInput}
              multiline
              maxLength={500}
            />
            <View style={styles.daysBadge}>
              <Text style={[styles.daysNumber, { color: MOOD_ACCENT }]}>{periodDays}</Text>
              <Text style={[styles.daysText, { color: MOOD_ACCENT }]}>Days</Text>
            </View>
          </View>
          <View style={styles.phaseBar}>
            <View style={[styles.phaseBarFill, styles.interventionFill]} />
          </View>
        </View>

        {/* Period Duration Selector */}
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((p) => (
            <Pressable
              key={p}
              style={[styles.periodChip, periodDays === p && styles.periodChipActive]}
              onPress={() => setPeriodDays(p)}
            >
              <Text style={[
                styles.periodChipText,
                periodDays === p && styles.periodChipTextActive,
              ]}>
                {p}d
              </Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>

      {/* Ready to Launch Card */}
      {canStart && (
        <GlassCard level={3} style={styles.launchCard}>
          <Text style={styles.launchTitle}>Ready to Launch?</Text>
          <Text style={styles.launchDescription}>
            Your experiment is structured to provide statistical significance after {totalDays} days of data collection.
          </Text>
          <GradientButton
            title={submitting ? 'Starting...' : '\u{25B6} Start Experiment'}
            onPress={handleStart}
          />
          <GradientButton
            title="Save as Draft"
            variant="secondary"
            onPress={handleSaveDraft}
          />
        </GlassCard>
      )}

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatBadge value={`${confidence}%`} label="CONFIDENCE" icon={'\u{2728}'} />
        <StatBadge value={`${totalWeeks}w`} label="DURATION" icon={'\u{23F1}'} />
      </View>

      {/* Tracking Info */}
      <GlassCard level={2} style={styles.trackingCard}>
        <View style={styles.trackingRow}>
          <View>
            <Text style={styles.trackingLabel}>TRACKING FREQUENCY</Text>
            <Text style={styles.trackingValue}>Daily at 8:00 PM</Text>
          </View>
          <Text style={styles.trackingIcon}>{'\u{1F570}'}</Text>
        </View>
      </GlassCard>

      {/* Pro Tip */}
      <View style={styles.proTip}>
        <Text style={styles.proTipDot}>{'\u{1F7E0}'}</Text>
        <Text style={styles.proTipTitle}>Pro-Tip</Text>
        <Text style={styles.proTipText}>
          To maintain integrity, try to keep all other habits constant during the {totalDays}-day window. Significant changes in diet or sleep may skew your mood results.
        </Text>
      </View>

      {/* Visualized Outcome Preview */}
      <View style={styles.previewSection}>
        <Text style={[styles.sectionLabel, { color: MOOD_ACCENT }]}>VISUALIZED OUTCOME PREVIEW</Text>
        <View style={styles.previewBars}>
          {Array.from({ length: 4 }, (_, i) => {
            const isIntervention = i >= 2;
            const height = isIntervention ? 100 + i * 30 : 60 + i * 15;
            return (
              <View key={i} style={styles.previewBarCol}>
                <View
                  style={[
                    styles.previewBar,
                    {
                      height,
                      backgroundColor: isIntervention ? MOOD_ACCENT : MOOD_SURFACES.focus,
                      borderRadius: 8,
                    },
                  ]}
                />
                <Text style={[
                  styles.previewBarLabel,
                  isIntervention && { color: MOOD_ACCENT },
                ]}>
                  WEEK {i + 1}{isIntervention ? '*' : ''}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MOOD_SURFACES.depth },
  content: { padding: 20, paddingBottom: 120, gap: 16 },

  // Header
  header: { gap: 8 },
  headerLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: MOOD_ACCENT,
  },
  headerTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerDescription: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  // Hypothesis
  hypothesisCard: { gap: 12 },
  cardLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: MOOD_ACCENT,
  },
  hypothesisInput: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 20,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
    padding: 0,
  },
  variableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: MOOD_SURFACES.focus,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  variableIcon: { fontSize: 14 },
  variableText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Timeline
  timelineCard: { gap: 16 },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineIcon: { fontSize: 18 },
  timelineTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  phaseBlock: { gap: 8 },
  phaseLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: '#8BCFF0',
  },
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  phaseDescription: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  daysBadge: { alignItems: 'flex-end' },
  daysNumber: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 22,
    color: '#8BCFF0',
  },
  daysText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: '#8BCFF0',
  },
  phaseBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: MOOD_SURFACES.highest,
    overflow: 'hidden',
  },
  phaseBarFill: {
    height: '100%',
    width: '100%',
    borderRadius: 3,
  },
  baselineFill: { backgroundColor: '#8BCFF0' },
  interventionFill: { backgroundColor: MOOD_ACCENT },
  interventionInput: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    minHeight: 40,
    textAlignVertical: 'top',
    padding: 0,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  periodChip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: MOOD_SURFACES.focus,
  },
  periodChipActive: {
    backgroundColor: MOOD_ACCENT,
  },
  periodChipText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.05 * 12,
    color: colors.textSecondary,
  },
  periodChipTextActive: {
    color: '#1a1008',
  },

  // Launch
  launchCard: { gap: 12, alignItems: 'center' },
  launchTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  launchDescription: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  errorText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: '#FFB4AB',
    textAlign: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Tracking
  trackingCard: { gap: 4 },
  trackingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackingLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
  },
  trackingValue: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  trackingIcon: { fontSize: 24 },

  // Pro Tip
  proTip: { gap: 6, paddingHorizontal: 4 },
  proTipDot: { fontSize: 12 },
  proTipTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: colors.text,
  },
  proTipText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  // Preview
  previewSection: { gap: 12 },
  sectionLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
  },
  previewBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 200,
    paddingTop: 20,
  },
  previewBarCol: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  previewBar: {
    width: 40,
  },
  previewBarLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.05 * 9,
    color: colors.textSecondary,
  },
});
