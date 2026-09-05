import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { DishVisual } from '@mylife/bestchef/ui';
import { HERO_GRADIENT, JAKARTA_FONTS, getDishVisuals } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import type { SubmitDraftState } from '../../state/useSubmitDraft';
import { isCloudSubmissionId } from '../../data/cloud-submissions';

interface SubmitSuccessViewProps {
  draft: SubmitDraftState;
  submissionId: string;
  onSubmitAnother: () => void;
}

export function SubmitSuccessView({ draft, submissionId, onSubmitAnother }: SubmitSuccessViewProps) {
  const tc = useThemeColors();
  const router = useRouter();
  const { t, tp } = useI18n();

  const dishVisuals = draft.selectedDish
    ? getDishVisuals(draft.selectedDish.name)
    : null;

  const photoCount = draft.finalPhotos.length;
  const ingCount = draft.ingredients.length;
  const totalVideoSec = draft.videoClip?.durationSeconds ?? 0;
  const videoLabel = draft.videoClip
    ? `${Math.floor(totalVideoSec / 60)}:${String(Math.floor(totalVideoSec % 60)).padStart(2, '0')}`
    : '—';

  function handleViewRecipe() {
    router.replace(`/recipe/${submissionId}`);
  }

  function handleShare() {
    void Share.share({
      message: t('Check out {dishName} on BestChef!', {
        dishName: draft.selectedDish?.name ?? draft.title,
      }),
      ...(isCloudSubmissionId(submissionId)
        ? { url: `https://bestchef.app/recipe/${submissionId}` }
        : {}),
    }).catch(() => {});
  }

  return (
    <View style={[styles.sheet, { backgroundColor: tc.background }]}>
      {/* Hero circle */}
      <View style={styles.heroSection}>
        <View style={[styles.outerRing, { backgroundColor: `${tc.accent}2E` }]}>
          <View style={[styles.innerRing, { backgroundColor: `${tc.accent}4D` }]}>
            <LinearGradient
              colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
              style={styles.checkCircle}
            >
              <Check size={44} color="#fff" strokeWidth={3} />
            </LinearGradient>
          </View>
        </View>
      </View>

      {/* Title + subtitle */}
      <View style={styles.textSection}>
        <Text style={[styles.title, { color: tc.text }]}>{t('Recipe submitted!')}</Text>
        <Text style={[styles.subtitle, { color: tc.textSecondary }]}>
          {t('Your recipe will appear after moderation review (~24h)')}
        </Text>
        {draft.selectedDish && (
          <View style={[styles.competingPill, { backgroundColor: `${tc.accent}1A`, borderColor: `${tc.accent}40` }]}>
            <Text style={[styles.competingText, { color: tc.accent }]}>
              {t("You're now competing for the Top 100 of {dishName}", { dishName: draft.selectedDish.name })}
            </Text>
          </View>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard icon="📸" value={String(photoCount)} label={tp(photoCount, 'photo', 'photos')} tc={tc} />
        <StatCard icon="🥕" value={String(ingCount)} label={t('ingredients')} tc={tc} />
        <StatCard icon="🎬" value={videoLabel} label={t('video')} tc={tc} />
      </View>

      {/* Optional dish preview */}
      {dishVisuals && draft.selectedDish && (
        <View style={[styles.previewCard, { backgroundColor: tc.surface }]}>
          <DishVisual
            dish={{ name: draft.selectedDish?.name ?? '', emoji: dishVisuals.emoji, gradientFrom: dishVisuals.from, gradientTo: dishVisuals.to }}
            size={52}
            radius={12}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.previewTitle, { color: tc.text }]} numberOfLines={1}>
              {draft.title || draft.selectedDish.name}
            </Text>
            <Text style={[styles.previewChef, { color: tc.textSecondary }]}>
              {draft.selectedDish.name}
            </Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          onPress={handleViewRecipe}
        >
          <LinearGradient
            colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtnGradient}
          >
            <Text style={styles.primaryBtnText}>{t('View recipe')}</Text>
          </LinearGradient>
        </Pressable>
        <Pressable
          style={[styles.secondaryBtn, { backgroundColor: tc.surface }]}
          onPress={handleShare}
          accessibilityRole="button"
        >
          <Text style={[styles.secondaryBtnText, { color: tc.text }]}>{t('Share your recipe')}</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryBtn, { backgroundColor: tc.surface }]}
          onPress={onSubmitAnother}
        >
          <Text style={[styles.secondaryBtnText, { color: tc.text }]}>{t('Submit another')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StatCard({
  icon, value, label, tc,
}: {
  icon: string;
  value: string;
  label: string;
  tc: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: tc.surface }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color: tc.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: tc.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  competingPill: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'center',
  },
  competingText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    textAlign: 'center',
  },
  sheet: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 48,
    gap: 24,
  },
  heroSection: { alignItems: 'center' },
  outerRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textSection: { alignItems: 'center', gap: 8 },
  title: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 26, textAlign: 'center' },
  subtitle: { fontFamily: JAKARTA_FONTS.regular, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 4,
  },
  statIcon: { fontSize: 16 },
  statValue: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16 },
  statLabel: { fontFamily: JAKARTA_FONTS.regular, fontSize: 11 },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 14,
  },
  previewTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  previewChef: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12 },
  actions: { gap: 12, marginTop: 4 },
  primaryBtn: { borderRadius: 18, overflow: 'hidden' },
  primaryBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  primaryBtnText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16, color: '#fff' },
  secondaryBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
});
