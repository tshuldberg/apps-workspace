import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FileWarning, Scale } from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  listPendingReports,
  retryPendingReports,
  type PendingReportRow,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors } from './providers/AppThemeProvider';
import { useDatabase } from './providers/DatabaseProvider';
import { useBestChefCloud } from './providers/BestChefCloudProvider';
import { useI18n } from './i18n/I18nProvider';
import {
  listMyModerationDecisions,
  submitAppeal,
  type MyModerationDecision,
} from './data/cloud-appeals';
import { BackArrow } from './components/DirectionalIcons';

function formatTimestamp(iso: string, language: string): string {
  try {
    return new Date(iso).toLocaleString(language);
  } catch {
    return iso;
  }
}

export default function MyReportsScreen(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const db = useDatabase();
  const cloud = useBestChefCloud();
  const { t, language } = useI18n();

  const [reports, setReports] = useState<PendingReportRow[]>([]);
  const [decisions, setDecisions] = useState<MyModerationDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appealBusyId, setAppealBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    try {
      const rows = listPendingReports(db);
      setReports(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
    if (cloud.supabase && cloud.profile?.id) {
      void listMyModerationDecisions(cloud.supabase, cloud.profile.id).then(setDecisions);
    }
  }, [db, cloud.supabase, cloud.profile?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await retryPendingReports(cloud.supabase ?? null, db);
    } catch {
      // Best-effort; result reflected in row state.
    }
    refresh();
    setRefreshing(false);
  }, [cloud.supabase, db, refresh]);

  const startAppeal = useCallback((decision: MyModerationDecision) => {
    if (!cloud.supabase) return;
    const supabase = cloud.supabase;
    // iOS-first app (app.json platforms: ["ios"]); Alert.prompt is native there.
    Alert.prompt(
      t('Appeal this decision'),
      t('Tell us why this decision should be reviewed.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Appeal'),
          onPress: (body?: string) => {
            const trimmed = (body ?? '').trim();
            if (!trimmed) return;
            setAppealBusyId(decision.id);
            void submitAppeal(supabase, decision.id, trimmed).then((result) => {
              setAppealBusyId(null);
              if (result.ok) {
                Alert.alert(t('Appeal submitted. A human will review it.'));
                refresh();
                return;
              }
              if (result.error === 'rate_limited') {
                Alert.alert(t('You are doing that too quickly. Try again later.'));
              } else if (result.error === 'already_appealed') {
                Alert.alert(t('This decision already has an appeal.'));
              } else {
                Alert.alert(t('Comment not posted. Check your connection and try again.'));
              }
            });
          },
        },
      ],
      'plain-text',
    );
  }, [cloud.supabase, refresh, t]);

  const appealStatusLabel = useCallback((decision: MyModerationDecision): string => {
    if (!decision.appeal) return '';
    if (decision.appeal.status === 'open') return t('Appeal under review');
    if (decision.appeal.status === 'overturned') return t('Decision overturned');
    return t('Decision upheld');
  }, [t]);

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: tc.text }]}>{t('my_reports')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={tc.accent} />
          <Text style={[styles.stateText, { color: tc.textSecondary }]}>{t('state_loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <FileWarning size={32} color={tc.danger} strokeWidth={1.5} />
          <Text style={[styles.stateText, { color: tc.text }]}>{error}</Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: tc.accent }]}
            onPress={() => {
              setLoading(true);
              refresh();
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.retryText, { color: tc.background }]}>{t('state_retry')}</Text>
          </Pressable>
        </View>
      ) : reports.length === 0 && decisions.length === 0 ? (
        <View style={styles.stateWrap}>
          <FileWarning size={32} color={tc.textTertiary} strokeWidth={1.5} />
          <Text style={[styles.stateText, { color: tc.textSecondary }]}>{t('state_no_data_yet')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tc.accent} />
          }
        >
          {reports.map((row) => (
            <View
              key={row.localId}
              style={[styles.reportCard, { backgroundColor: tc.surface, borderColor: tc.border }]}
            >
              <View style={styles.reportHeader}>
                <Text style={[styles.reportTitle, { color: tc.text }]} numberOfLines={1}>
                  {row.payload.reason}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: row.synced ? `${tc.accent}1F` : `${tc.danger}1F` },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: row.synced ? tc.accent : tc.danger },
                    ]}
                  >
                    {row.synced ? t('report_synced') : t('report_pending_sync')}
                  </Text>
                </View>
              </View>
              <Text style={[styles.reportMeta, { color: tc.textSecondary }]}>
                {row.payload.targetKind}
              </Text>
              <Text style={[styles.reportMeta, { color: tc.textTertiary }]}>
                {formatTimestamp(row.createdAt, language)}
              </Text>
              {row.lastError ? (
                <Text style={[styles.reportError, { color: tc.danger }]} numberOfLines={2}>
                  {row.lastError}
                </Text>
              ) : null}
            </View>
          ))}

          {decisions.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Scale size={16} color={tc.textSecondary} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { color: tc.textSecondary }]}>
                {t('Decisions about your content')}
              </Text>
            </View>
          ) : null}

          {decisions.map((decision) => (
            <View
              key={decision.id}
              style={[styles.reportCard, { backgroundColor: tc.surface, borderColor: tc.border }]}
            >
              <View style={styles.reportHeader}>
                <Text style={[styles.reportTitle, { color: tc.text }]} numberOfLines={1}>
                  {decision.decision === 'approved' ? t('Content approved') : t('Content removed')}
                </Text>
                <Text style={[styles.reportMeta, { color: tc.textTertiary }]}>
                  {decision.kind}
                </Text>
              </View>
              {decision.reason ? (
                <Text style={[styles.reportMeta, { color: tc.textSecondary }]} numberOfLines={3}>
                  {decision.reason}
                </Text>
              ) : null}
              <Text style={[styles.reportMeta, { color: tc.textTertiary }]}>
                {formatTimestamp(decision.createdAt, language)}
              </Text>
              {decision.appeal ? (
                <View style={styles.appealRow}>
                  <View style={[styles.statusPill, { backgroundColor: `${tc.accent}1F` }]}>
                    <Text style={[styles.statusPillText, { color: tc.accent }]}>
                      {appealStatusLabel(decision)}
                    </Text>
                  </View>
                  {decision.appeal.resolutionReason ? (
                    <Text style={[styles.reportMeta, { color: tc.textSecondary }]} numberOfLines={2}>
                      {decision.appeal.resolutionReason}
                    </Text>
                  ) : null}
                </View>
              ) : decision.decision === 'rejected' ? (
                <Pressable
                  style={[styles.appealButton, { borderColor: tc.border }]}
                  disabled={appealBusyId === decision.id}
                  onPress={() => startAppeal(decision)}
                  accessibilityRole="button"
                  accessibilityLabel={t('Appeal this decision')}
                >
                  {appealBusyId === decision.id ? (
                    <ActivityIndicator size="small" color={tc.accent} />
                  ) : (
                    <Text style={[styles.appealButtonText, { color: tc.accent }]}>
                      {t('Appeal')}
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  headerTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 20, letterSpacing: -0.5 },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  stateText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14 },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  listContent: { paddingHorizontal: 24, paddingBottom: 120, gap: 12 },
  reportCard: {
    borderRadius: 18,
    padding: 16,
    gap: 4,
    borderWidth: 1,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reportTitle: { flex: 1, fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  reportMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  reportError: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, marginTop: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 10, letterSpacing: 0.5 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 4,
  },
  sectionTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13, letterSpacing: 0.3 },
  appealRow: { marginTop: 8, gap: 6, alignItems: 'flex-start' },
  appealButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  appealButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
});
