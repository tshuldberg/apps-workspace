import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Globe, Star, TrendingUp, Users } from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  getMyCreatorApplication,
  submitCreatorApplication,
  withdrawCreatorApplication,
  type CreatorApplication,
  type CreatorApplicationStatusValue,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { useBestChefCloud } from './providers/BestChefCloudProvider';
import { useI18n } from './i18n/I18nProvider';
import { INPUT_CAPS, sanitizeFreeText } from './utils/validation';
import { BackArrow } from './components/DirectionalIcons';

const REAPPLY_COOLDOWN_DAYS = 30;
const STATUS_POLL_INTERVAL_MS = 60_000;

function isOpenStatus(status: CreatorApplicationStatusValue): boolean {
  return status === 'submitted' || status === 'under_review' || status === 'more_info_needed';
}

function daysSince(date: Date | null): number {
  if (!date) return 0;
  const ms = Date.now() - date.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date | null, language: string): string {
  if (!date) return '';
  try {
    return date.toLocaleDateString(language);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export default function CreatorProgramScreen() {
  const router = useRouter();
  const tc = useThemeColors();
  const { t } = useI18n();
  const cloud = useBestChefCloud();
  const supabase = cloud.supabase;

  const [portfolio, setPortfolio] = useState('');
  const [socialLinks, setSocialLinks] = useState('');
  const [why, setWhy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const refreshApplication = useCallback(async () => {
    if (!supabase) {
      setLoadingStatus(false);
      return;
    }
    const result = await getMyCreatorApplication(supabase);
    if (!isMountedRef.current) return;
    if (result.ok) {
      setApplication(result.data);
    }
    setLoadingStatus(false);
  }, [supabase]);

  useEffect(() => {
    void refreshApplication();
  }, [refreshApplication]);

  // Poll while screen is open. The realtime channel below covers most cases,
  // but the 60s poll is the backstop required by F-028.
  useEffect(() => {
    if (!supabase || !application) return;
    if (!isOpenStatus(application.status)) return;
    const interval = setInterval(() => { void refreshApplication(); }, STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [supabase, application, refreshApplication]);

  // Realtime subscription so admin updates land instantly.
  useEffect(() => {
    if (!supabase || !cloud.profile?.id) return;
    const channel = supabase
      .channel(`bc_creator_applications:${cloud.profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bc_creator_applications',
          filter: `profile_id=eq.${cloud.profile.id}`,
        },
        () => { void refreshApplication(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, cloud.profile?.id, refreshApplication]);

  const canApply = portfolio.trim().length > 0 && why.trim().length > 0 && !submitting;

  const handleApply = useCallback(async () => {
    if (!supabase) {
      Alert.alert(t('Error'), t('Sign in to apply for the creator program.'));
      return;
    }
    const cleanPortfolio = sanitizeFreeText(portfolio, INPUT_CAPS.portfolio);
    const cleanSocial = sanitizeFreeText(socialLinks, INPUT_CAPS.socialLinks);
    const cleanWhy = sanitizeFreeText(why, INPUT_CAPS.motivation);
    setSubmitting(true);
    try {
      const result = await submitCreatorApplication(supabase, {
        reason: cleanWhy,
        links: { portfolio: cleanPortfolio, social: cleanSocial },
        audience: null,
      });
      if (!isMountedRef.current) return;
      if (!result.ok) {
        Alert.alert(t('Error'), result.error);
        return;
      }
      setApplication(result.data);
      Alert.alert(
        t('creator_application_submitted'),
        `Reference id: ${result.data.id.slice(0, 8)}`,
      );
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  }, [supabase, portfolio, socialLinks, why, t]);

  const handleWithdraw = useCallback(async () => {
    if (!supabase || !application) return;
    setWithdrawing(true);
    try {
      const result = await withdrawCreatorApplication(supabase, { applicationId: application.id });
      if (!isMountedRef.current) return;
      if (!result.ok) {
        Alert.alert(t('Error'), result.error);
        return;
      }
      setApplication(result.data);
    } finally {
      if (isMountedRef.current) setWithdrawing(false);
    }
  }, [supabase, application, t]);

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Creator Program')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loadingStatus ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator color={tc.accent} />
          </View>
        ) : application && application.status !== 'declined' && application.status !== 'withdrawn' ? (
          <StatusCard
            application={application}
            onWithdraw={handleWithdraw}
            onUpdate={() => setApplication(null)}
            withdrawing={withdrawing}
          />
        ) : application && (application.status === 'declined' || application.status === 'withdrawn') ? (
          <DeclinedCard
            application={application}
            onApplyAgain={() => setApplication(null)}
          />
        ) : (
          <ApplyForm
            portfolio={portfolio}
            socialLinks={socialLinks}
            why={why}
            setPortfolio={setPortfolio}
            setSocialLinks={setSocialLinks}
            setWhy={setWhy}
            onApply={handleApply}
            canApply={canApply}
            submitting={submitting}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ── Apply form ────────────────────────────────────────────────────────

interface ApplyFormProps {
  portfolio: string;
  socialLinks: string;
  why: string;
  setPortfolio: (v: string) => void;
  setSocialLinks: (v: string) => void;
  setWhy: (v: string) => void;
  onApply: () => void;
  canApply: boolean;
  submitting: boolean;
}

function ApplyForm({
  portfolio, socialLinks, why,
  setPortfolio, setSocialLinks, setWhy,
  onApply, canApply, submitting,
}: ApplyFormProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <>
      <View style={[styles.heroCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
        <View style={[styles.heroIcon, { backgroundColor: `${tc.accent}1A` }]}>
          <Globe size={36} color={tc.accent} strokeWidth={1.5} />
        </View>
        <Text style={[styles.heroTitle, { color: tc.text }]}>{t('Become a Verified Creator')}</Text>
        <Text style={[styles.heroDesc, { color: tc.textSecondary }]}>
          {t('Get a verified badge and a featured chef profile to share your culinary expertise with the world.')}
        </Text>
      </View>

      <View style={styles.benefitsRow}>
        {[
          { icon: <Star size={18} color={tc.accent} strokeWidth={2} />, label: t('Verified Badge') },
          { icon: <Users size={18} color={tc.accent} strokeWidth={2} />, label: t('Featured Profile') },
          { icon: <TrendingUp size={18} color={tc.accent} strokeWidth={2} />, label: t('Analytics') },
        ].map((benefit) => (
          <View key={benefit.label} style={[styles.benefitCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            {benefit.icon}
            <Text style={[styles.benefitLabel, { color: tc.text }]}>{benefit.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Portfolio / Website')}</Text>
        <TextInput
          style={[styles.fieldInput, { color: tc.text, backgroundColor: tc.surface }]}
          placeholder="https://yoursite.com"
          placeholderTextColor={tc.textTertiary}
          value={portfolio}
          onChangeText={setPortfolio}
          keyboardType="url"
          autoCapitalize="none"
          maxLength={INPUT_CAPS.portfolio}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Social Media Links')}</Text>
        <TextInput
          style={[styles.fieldInput, { color: tc.text, backgroundColor: tc.surface }]}
          placeholder={t('Instagram, YouTube, TikTok, etc.')}
          placeholderTextColor={tc.textTertiary}
          value={socialLinks}
          onChangeText={setSocialLinks}
          maxLength={INPUT_CAPS.socialLinks}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Why do you want to be a creator?')}</Text>
        <TextInput
          style={[styles.fieldInput, { color: tc.text, backgroundColor: tc.surface, minHeight: 100 }]}
          placeholder={t("Tell us about your cooking journey and what you'd bring to the community...")}
          placeholderTextColor={tc.textTertiary}
          value={why}
          onChangeText={setWhy}
          multiline
          textAlignVertical="top"
          maxLength={INPUT_CAPS.motivation}
        />
      </View>

      <Pressable
        style={[styles.applyButton, { backgroundColor: tc.accent }, !canApply && { opacity: 0.4 }]}
        disabled={!canApply}
        onPress={onApply}
      >
        {submitting
          ? <ActivityIndicator color={tc.background} />
          : <Check size={18} color={tc.background} strokeWidth={2.5} />}
        <Text style={[styles.applyButtonText, { color: tc.background }]}>{t('Submit Application')}</Text>
      </Pressable>
    </>
  );
}

// ── Status card (open / approved / more-info) ────────────────────────

interface StatusCardProps {
  application: CreatorApplication;
  onWithdraw: () => void;
  onUpdate: () => void;
  withdrawing: boolean;
}

function StatusCard({ application, onWithdraw, onUpdate, withdrawing }: StatusCardProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, language } = useI18n();

  const pillBackground = (() => {
    switch (application.status) {
      case 'approved': return tc.success;
      case 'under_review': return tc.primary;
      case 'more_info_needed': return tc.accent;
      case 'submitted':
      default: return tc.textSecondary;
    }
  })();

  const statusLabel = (() => {
    switch (application.status) {
      case 'approved': return t('creator_approved');
      case 'under_review': return t('creator_under_review');
      case 'more_info_needed': return t('creator_more_info_needed');
      case 'submitted':
      default: return t('creator_application_submitted');
    }
  })();

  return (
    <View style={[styles.statusCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
      <View style={[styles.statusPill, { backgroundColor: pillBackground }]}>
        <Text style={[styles.statusPillText, { color: tc.background }]}>{statusLabel}</Text>
      </View>

      <View style={styles.statusMetaRow}>
        <Text style={[styles.statusMetaLabel, { color: tc.textSecondary }]}>{t('Submitted')}</Text>
        <Text style={[styles.statusMetaValue, { color: tc.text }]}>{formatDate(application.createdAt, language)}</Text>
      </View>

      {application.reviewedAt ? (
        <View style={styles.statusMetaRow}>
          <Text style={[styles.statusMetaLabel, { color: tc.textSecondary }]}>{t('Last reviewed')}</Text>
          <Text style={[styles.statusMetaValue, { color: tc.text }]}>{formatDate(application.reviewedAt, language)}</Text>
        </View>
      ) : null}

      {application.reviewNotes ? (
        <View style={[styles.notesBox, { backgroundColor: tc.surface }]}>
          <Text style={[styles.notesLabel, { color: tc.textSecondary }]}>{t('Notes from reviewer')}</Text>
          <Text style={[styles.notesText, { color: tc.text }]}>{application.reviewNotes}</Text>
        </View>
      ) : null}

      {application.status === 'approved' ? null : application.status === 'more_info_needed' ? (
        <Pressable
          style={[styles.applyButton, { backgroundColor: tc.accent }]}
          onPress={onUpdate}
        >
          <Text style={[styles.applyButtonText, { color: tc.background }]}>{t('creator_update_application')}</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.applyButton, styles.applyButtonOutline, { borderColor: tc.border }]}
          onPress={onWithdraw}
          disabled={withdrawing}
        >
          {withdrawing ? <ActivityIndicator color={tc.text} /> : null}
          <Text style={[styles.applyButtonText, { color: tc.text }]}>{t('creator_withdraw_application')}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Declined / withdrawn card ────────────────────────────────────────

interface DeclinedCardProps {
  application: CreatorApplication;
  onApplyAgain: () => void;
}

function DeclinedCard({ application, onApplyAgain }: DeclinedCardProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();

  const since = daysSince(application.reviewedAt ?? application.createdAt);
  const remaining = Math.max(0, REAPPLY_COOLDOWN_DAYS - since);
  const canReapply = remaining === 0;

  const label = application.status === 'withdrawn'
    ? t('creator_withdraw_application')
    : t('creator_declined');

  return (
    <View style={[styles.statusCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
      <View style={[styles.statusPill, { backgroundColor: tc.danger }]}>
        <Text style={[styles.statusPillText, { color: tc.background }]}>{label}</Text>
      </View>

      {application.reviewNotes ? (
        <View style={[styles.notesBox, { backgroundColor: tc.surface }]}>
          <Text style={[styles.notesLabel, { color: tc.textSecondary }]}>{t('Notes from reviewer')}</Text>
          <Text style={[styles.notesText, { color: tc.text }]}>{application.reviewNotes}</Text>
        </View>
      ) : null}

      {canReapply ? (
        <Pressable
          style={[styles.applyButton, { backgroundColor: tc.accent }]}
          onPress={onApplyAgain}
        >
          <Text style={[styles.applyButtonText, { color: tc.background }]}>{t('Submit Application')}</Text>
        </Pressable>
      ) : (
        <View style={[styles.applyButton, styles.applyButtonOutline, { borderColor: tc.border }]}>
          <Text style={[styles.applyButtonText, { color: tc.textSecondary }]}>
            {t('creator_apply_again_in_days', { days: remaining })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 56, paddingBottom: 12, gap: 12,
  },
  topBarTitle: { flex: 1, fontFamily: JAKARTA_FONTS.bold, fontSize: 17, textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 20 },

  loaderRow: { paddingVertical: 60, alignItems: 'center' },

  heroCard: {
    borderRadius: 24, padding: 28,
    alignItems: 'center', gap: 12, borderWidth: 1,
  },
  heroIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 22, textAlign: 'center' },
  heroDesc: { fontFamily: JAKARTA_FONTS.regular, fontSize: 13, lineHeight: 20, textAlign: 'center' },

  benefitsRow: { flexDirection: 'row', gap: 10 },
  benefitCard: {
    flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16,
    borderRadius: 16, borderWidth: 1,
  },
  benefitLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 11, textAlign: 'center' },

  fieldGroup: { gap: 8 },
  fieldLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, letterSpacing: 1.4 },
  fieldInput: {
    fontFamily: JAKARTA_FONTS.regular, fontSize: 15,
    borderRadius: 14, padding: 14,
  },

  applyButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 999, paddingVertical: 16,
  },
  applyButtonOutline: {
    backgroundColor: 'transparent', borderWidth: 1,
  },
  applyButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },

  statusCard: {
    borderRadius: 24, padding: 24, gap: 16, borderWidth: 1,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12, letterSpacing: 0.5 },
  statusMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusMetaLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  statusMetaValue: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },
  notesBox: { borderRadius: 14, padding: 14, gap: 6 },
  notesLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  notesText: { fontFamily: JAKARTA_FONTS.regular, fontSize: 13, lineHeight: 19 },
});
