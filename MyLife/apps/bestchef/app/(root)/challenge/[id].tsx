import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, Award, CheckCircle2, Clock } from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  claimReward,
  getChallengeDetail,
  joinChallenge,
  leaveChallenge,
  type ChallengeDetailView,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import {
  useAppThemeColors as useThemeColors,
  useAppThemeProfile as useTheme,
} from '../providers/AppThemeProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { useI18n } from '../i18n/I18nProvider';
import { BackArrow } from '../components/DirectionalIcons';

function formatExpiry(deadlineIso: string | null): string | null {
  if (!deadlineIso) return null;
  const ms = new Date(deadlineIso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return null;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, language } = useI18n();
  const { supabase } = useBestChefCloud();

  const [view, setView] = useState<ChallengeDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !id) {
      setLoading(false);
      return;
    }
    try {
      const result = await getChallengeDetail(supabase, { challengeId: id });
      if (result.ok) {
        setView(result.data);
        setError(null);
      } else {
        setView(null);
        // "Challenge not found" is a genuine empty state; any other error is
        // a real query failure that must not masquerade as not-found
        // (audit C12 UI half).
        setError(result.error === 'Challenge not found' ? null : result.error);
      }
    } catch (err) {
      setView(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [supabase, id]);

  useEffect(() => {
    load();
  }, [load]);

  const onToggleJoin = useCallback(async () => {
    if (!supabase || !id || busy) return;
    setBusy(true);
    try {
      if (view?.enrollment) {
        await leaveChallenge(supabase, { challengeId: id });
      } else {
        await joinChallenge(supabase, { challengeId: id });
      }
      await load();
    } finally {
      setBusy(false);
    }
  }, [supabase, id, view, busy, load]);

  const onClaim = useCallback(async () => {
    if (!supabase || !id || busy) return;
    setBusy(true);
    try {
      await claimReward(supabase, { challengeId: id });
      await load();
    } finally {
      setBusy(false);
    }
  }, [supabase, id, busy, load]);

  const expiryLabel = useMemo(() => {
    if (!view?.challenge) return null;
    const deadline = view.challenge.claimDeadline ?? view.challenge.endsAt;
    return formatExpiry(deadline);
  }, [view]);

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Challenges')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={tc.accent} />
        </View>
      ) : error ? (
        <Pressable
          style={styles.loadingWrap}
          onPress={() => load()}
          accessibilityRole="button"
          accessibilityLabel={t('Tap to retry')}
        >
          <AlertCircle size={40} color={tc.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.headerTitle, { color: tc.text }]}>{t('Could not load challenges')}</Text>
          <Text style={[styles.description, { color: tc.textSecondary }]}>{t('Tap to retry')}</Text>
        </Pressable>
      ) : !view ? (
        <View style={styles.loadingWrap}>
          <Text style={[styles.headerTitle, { color: tc.text }]}>{t('No active challenges yet')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.headerCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <View style={[styles.iconBox, { backgroundColor: `${tc.accent}1A` }]}>
              <Award size={28} color={tc.accent} strokeWidth={2} />
            </View>
            <Text style={[styles.headerTitle, { color: tc.text }]}>{view.challenge.title}</Text>
            <Text style={[styles.reward, { color: tc.accent }]}>{view.challenge.reward}</Text>
            <Text style={[styles.description, { color: tc.textSecondary }]}>{view.challenge.description}</Text>
            {view.challenge.endsAt ? (
              <Text style={[styles.metaText, { color: tc.textTertiary }]}>
                {new Date(view.challenge.endsAt).toLocaleDateString(language)}
              </Text>
            ) : null}
          </View>

          <View style={[styles.progressCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: tc.text }]}>{t('Progress')}</Text>
            {view.enrollment ? (
              <>
                <View style={[styles.progressBar, { backgroundColor: theme.glass.cardBorder }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(
                          100,
                          Math.round(
                            (view.currentCount /
                              Math.max(1, view.challenge.targetCount)) *
                              100,
                          ),
                        )}%`,
                        backgroundColor: view.isComplete ? tc.primaryContainer : tc.accent,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressLabel, { color: tc.textSecondary }]}>
                  {t('challenges_progress', {
                    x: view.currentCount,
                    y: view.challenge.targetCount,
                  })}
                </Text>
              </>
            ) : (
              <Text style={[styles.progressLabel, { color: tc.textSecondary }]}>
                {t('challenges_not_joined')}
              </Text>
            )}
          </View>

          {view.isComplete && view.enrollment?.rewardClaimedAt == null ? (
            <Pressable
              disabled={busy}
              onPress={onClaim}
              style={[styles.primaryAction, { backgroundColor: tc.accent, opacity: busy ? 0.6 : 1 }]}
            >
              <Award size={18} color="#0E0E13" strokeWidth={2.4} />
              <Text style={[styles.primaryActionLabel, { color: '#0E0E13' }]}>
                {t('challenges_claim_reward')}
              </Text>
              {expiryLabel ? (
                <View style={styles.expiryRow}>
                  <Clock size={12} color="#0E0E13" strokeWidth={2.2} />
                  <Text style={[styles.expiryLabel, { color: '#0E0E13' }]}>
                    {t('challenges_expires_in', { time: expiryLabel })}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : view.enrollment?.rewardClaimedAt != null ? (
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              style={[styles.claimedBadge, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
            >
              <CheckCircle2 size={18} color={tc.primaryContainer} strokeWidth={2.4} />
              <Text style={[styles.claimedLabel, { color: tc.text }]}>
                {t('challenges_reward_claimed')}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            disabled={busy}
            onPress={onToggleJoin}
            style={[
              styles.secondaryAction,
              {
                backgroundColor: view.enrollment ? 'transparent' : tc.accent,
                borderColor: view.enrollment ? tc.accent : 'transparent',
                borderWidth: view.enrollment ? 1 : 0,
                opacity: busy ? 0.6 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.secondaryActionLabel,
                { color: view.enrollment ? tc.accent : '#0E0E13' },
              ]}
            >
              {view.enrollment ? t('challenges_leave') : t('challenges_join')}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    gap: 12,
  },
  topBarTitle: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 17,
    textAlign: 'center',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 16 },

  headerCard: { borderRadius: 20, padding: 20, gap: 8, borderWidth: 1, alignItems: 'flex-start' },
  iconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 22 },
  reward: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14 },
  description: { fontFamily: JAKARTA_FONTS.regular, fontSize: 14, lineHeight: 20 },
  metaText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },

  progressCard: { borderRadius: 20, padding: 20, gap: 12, borderWidth: 1 },
  sectionTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },

  primaryAction: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  expiryLabel: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },

  claimedBadge: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  claimedLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14 },

  secondaryAction: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
});
