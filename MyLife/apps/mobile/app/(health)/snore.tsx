import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  getSnoreHistory,
  getScoreCategory,
  getScoreColor,
  SNORE_DISCLAIMER,
  HEALTH_ACCENT,
  HEALTH_ACCENT_LIGHT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  HEALTH_CTA_GRADIENT,
  JAKARTA_FONTS,
  GlassCard,
  SectionHeader,
  GradientButton,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

type MonitorStatus = 'idle' | 'recording';

const WAVEFORM_BARS = 24;

function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'quiet': return 'QUIET NIGHT';
    case 'light': return 'LIGHT SNORING';
    case 'moderate': return 'MODERATE';
    case 'heavy': return 'HEAVY SNORING';
    case 'severe': return 'SEVERE';
    default: return category.toUpperCase();
  }
}

function getStatusIcon(score: number): string {
  if (score <= 30) return '\u2705';
  if (score <= 60) return '\u2139\uFE0F';
  return '\u26A0\uFE0F';
}

function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Last Night';

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SnoreScreen() {
  const db = useDatabase();
  const sessions = useMemo(() => getSnoreHistory(db, 30), [db]);

  const [status, setStatus] = useState<MonitorStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [ambientDb, setAmbientDb] = useState(32);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulated waveform heights for visual effect
  const [waveformHeights, setWaveformHeights] = useState<number[]>(
    () => Array.from({ length: WAVEFORM_BARS }, () => 4 + Math.random() * 12)
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startDetection = useCallback(() => {
    setStatus('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
      // Simulate ambient noise fluctuation
      setAmbientDb(30 + Math.floor(Math.random() * 10));
      setWaveformHeights(
        Array.from({ length: WAVEFORM_BARS }, () => 4 + Math.random() * 28)
      );
    }, 1000);
  }, []);

  const stopDetection = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setStatus('idle');
    setElapsed(0);
  }, []);

  const statusLabel = status === 'idle' ? 'READY TO MONITOR' : 'RECORDING';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Start Detection button */}
      <View style={styles.startSection}>
        <Pressable
          onPress={status === 'idle' ? startDetection : stopDetection}
          style={styles.startBtnOuter}
        >
          <LinearGradient
            colors={status === 'idle'
              ? [HEALTH_CTA_GRADIENT.from, HEALTH_CTA_GRADIENT.to]
              : [HEALTH_ACCENT, HEALTH_ACCENT_LIGHT]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.startBtnGradient}
          >
            <Text style={styles.startBtnIcon}>
              {status === 'idle' ? '\uD83C\uDF99\uFE0F' : '\u23F9'}
            </Text>
          </LinearGradient>
        </Pressable>
        <Text style={styles.startLabel}>
          {status === 'idle' ? 'START DETECTION' : 'STOP DETECTION'}
        </Text>
      </View>

      {/* Timer and status */}
      <View style={styles.timerSection}>
        <Text style={styles.timerText}>{formatTimer(elapsed)}</Text>
        <Text style={styles.statusText}>{statusLabel}</Text>
      </View>

      {/* Current Session Events */}
      <SectionHeader
        title="Current Session Events"
        action={status === 'recording' ? { text: 'LIVE MONITOR', onPress: () => {} } : undefined}
      />

      {/* Acoustic Profile */}
      <GlassCard level={2} style={styles.acousticCard}>
        <Text style={styles.cardLabel}>ACOUSTIC PROFILE</Text>
        <Text style={styles.acousticDb}>Ambient Noise: {ambientDb}dB</Text>
        <View style={styles.waveform}>
          {waveformHeights.map((h, i) => (
            <View
              key={i}
              style={[
                styles.waveBar,
                {
                  height: status === 'recording' ? h : 4,
                  backgroundColor: status === 'recording'
                    ? HEALTH_CTA_GRADIENT.from
                    : HEALTH_SURFACES.focus,
                },
              ]}
            />
          ))}
        </View>
      </GlassCard>

      {/* Last Event */}
      <GlassCard level={2} style={styles.eventCard}>
        <View style={styles.eventRow}>
          <Text style={styles.eventIcon}>{'\uD83C\uDF19'}</Text>
          <View>
            <Text style={styles.eventLabel}>LAST EVENT</Text>
            <Text style={styles.eventValue}>
              {status === 'recording' ? 'Monitoring...' : 'None detected'}
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* Table header */}
      <GlassCard level={2} style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableCol}>TIMESTAMP</Text>
          <Text style={styles.tableCol}>INTENSITY</Text>
        </View>
        <View style={styles.tablePlaceholder}>
          <Text style={styles.tablePlaceholderText}>No active data streams</Text>
          <View style={styles.waitingBadge}>
            <Text style={styles.waitingText}>WAITING</Text>
          </View>
        </View>
      </GlassCard>

      {/* Session History */}
      {sessions.length > 0 && (
        <>
          <SectionHeader title="Session History" />
          {sessions.slice(0, 10).map((session) => {
            const score = session.snore_score ?? 0;
            const category = getScoreCategory(score);
            const scoreColor = getScoreColor(score);
            const icon = getStatusIcon(score);
            const durationStr = formatDuration(session.duration_minutes ?? 0);
            const dateStr = formatSessionDate(session.start_time);
            const events = session.event_count ?? 0;

            return (
              <GlassCard key={session.id} level={2} style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <Text style={styles.historyIcon}>{icon}</Text>
                  <View style={styles.historyInfo}>
                    <View style={styles.historyTopRow}>
                      <Text style={styles.historyDate}>{dateStr}</Text>
                      <View style={[styles.categoryBadge, { backgroundColor: `${scoreColor}20` }]}>
                        <Text style={[styles.categoryText, { color: scoreColor }]}>
                          {getCategoryLabel(category)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.historyMeta}>
                      {durationStr} monitored {'\u00B7'} {events} event{events !== 1 ? 's' : ''}
                    </Text>
                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreLabel}>Score</Text>
                      <Text style={[styles.scoreValue, { color: scoreColor }]}>{score}</Text>
                    </View>
                  </View>
                </View>
              </GlassCard>
            );
          })}

          <View style={styles.reportBtnWrapper}>
            <GradientButton
              title="VIEW FULL REPORT"
              onPress={() => router.push('/(health)/sleep' as never)}
              variant="secondary"
            />
          </View>
        </>
      )}

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>{SNORE_DISCLAIMER}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HEALTH_SURFACES.depth },
  content: { paddingBottom: 100, gap: 12 },

  // Start detection
  startSection: {
    alignItems: 'center',
    paddingTop: 24,
    gap: 12,
  },
  startBtnOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  startBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnIcon: {
    fontSize: 40,
  },
  startLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 13,
    letterSpacing: 0.1 * 13,
    color: colors.text,
  },

  // Timer
  timerSection: {
    alignItems: 'center',
    gap: 4,
    paddingBottom: 8,
  },
  timerText: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 32,
    letterSpacing: -0.02 * 32,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statusText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },

  // Acoustic Profile
  acousticCard: { marginHorizontal: 16, gap: 10 },
  cardLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },
  acousticDb: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 36,
  },
  waveBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 4,
  },

  // Last Event
  eventCard: { marginHorizontal: 16 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventIcon: { fontSize: 24 },
  eventLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  eventValue: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.text,
    marginTop: 2,
  },

  // Table
  tableCard: { marginHorizontal: 16, gap: 10 },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tableCol: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textTertiary,
  },
  tablePlaceholder: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  tablePlaceholderText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textTertiary,
  },
  waitingBadge: {
    backgroundColor: HEALTH_SURFACES.focus,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  waitingText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },

  // Session History
  historyCard: { marginHorizontal: 16 },
  historyRow: {
    flexDirection: 'row',
    gap: 12,
  },
  historyIcon: { fontSize: 20, marginTop: 2 },
  historyInfo: { flex: 1, gap: 4 },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyDate: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  categoryBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
  },
  historyMeta: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  scoreLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textTertiary,
  },
  scoreValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },

  // Report button
  reportBtnWrapper: {
    marginHorizontal: 16,
    marginTop: 4,
  },

  // Disclaimer
  disclaimer: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
    marginTop: 8,
  },
});
