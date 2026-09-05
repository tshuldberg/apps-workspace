import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { initBestChefClient, JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useDatabase } from '../providers/DatabaseProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { DEMO_SUBMISSIONS } from '../data/demo';
import { getCloudSubmissionViewModel, isCloudSubmissionId } from '../data/cloud-submissions';
import { getAllLocalSubmissions } from '../data/local-submissions';
import { getSavedRecipeCookMode } from '../data/cook-mode';
import { shouldShowDemoContent } from '../data/public-render-policy';
import { BackArrow } from '../components/DirectionalIcons';

const FALLBACK_STEPS = [
  'Prep all ingredients before heating the pan.',
  'Cook over steady medium-high heat and taste as you go.',
  'Plate, garnish, and capture your final dish.',
];

interface CookModeRecipe {
  title: string;
  steps: string[];
}

function stepsOrFallback(steps?: string[]): string[] {
  return steps && steps.length > 0 ? steps : FALLBACK_STEPS;
}

export default function CookModeScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const router = useRouter();
  const db = useDatabase();
  const cloud = useBestChefCloud();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const [completed, setCompleted] = useState<Set<number>>(() => new Set());
  const [recipe, setRecipe] = useState<CookModeRecipe>(() => ({
    title: t('Cook mode'),
    steps: FALLBACK_STEPS,
  }));
  const [recipeLoading, setRecipeLoading] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const routeId = id ?? '';

    setCompleted(new Set());

    // Saved (private) recipes live in local SQLite and have no cloud
    // submission (audit M11). Load their steps directly and skip the
    // submission/cloud resolution below entirely.
    if (source === 'saved') {
      const saved = getSavedRecipeCookMode(db, routeId);
      setRecipe({
        title: saved?.title ?? t('Cook mode'),
        steps: stepsOrFallback(saved?.steps),
      });
      setRecipeLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    const demo = shouldShowDemoContent() ? DEMO_SUBMISSIONS.find((item) => item.id === routeId) : null;
    const local = getAllLocalSubmissions(db).find((item) => item.id === routeId);
    const baseRecipe = demo ?? local;

    setRecipe({
      title: baseRecipe?.title ?? t('Cook mode'),
      steps: stepsOrFallback(baseRecipe?.steps),
    });

    if (!routeId || !cloud.supabase || !isCloudSubmissionId(routeId)) {
      setRecipeLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    setRecipeLoading(true);
    initBestChefClient(cloud.supabase);
    void getCloudSubmissionViewModel(routeId, cloud.profile)
      .then((cloudSubmission) => {
        if (!isCurrent || !cloudSubmission) return;
        setRecipe({
          title: cloudSubmission.title,
          steps: stepsOrFallback(cloudSubmission.steps),
        });
      })
      .finally(() => {
        if (isCurrent) setRecipeLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [cloud.profile, cloud.supabase, db, id, source, t]);

  const toggleStep = (index: number) => {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topTitle, { color: tc.text }]} numberOfLines={1}>{t('Cook mode')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <Text style={[styles.recipeTitle, { color: tc.text }]}>{recipe.title}</Text>
          {recipeLoading ? (
            <Text style={[styles.loadingText, { color: tc.textSecondary }]}>{t('Loading recipe steps...')}</Text>
          ) : null}
          <Text style={[styles.progress, { color: tc.textSecondary }]}>
            {t('{done} of {total} steps complete', { done: completed.size, total: recipe.steps.length })}
          </Text>
        </View>

        <View style={styles.steps}>
          {recipe.steps.map((step, index) => {
            const done = completed.has(index);
            return (
              <Pressable
                key={`${index}:${step}`}
                style={({ pressed }) => [
                  styles.stepRow,
                  { backgroundColor: theme.glass.cardFill, borderColor: done ? tc.accent : theme.glass.cardBorder },
                  pressed && { opacity: 0.86, transform: [{ scale: 0.99 }] },
                ]}
                onPress={() => toggleStep(index)}
                accessibilityRole="button"
                accessibilityLabel={t('Toggle step {number}', { number: index + 1 })}
              >
                {done ? (
                  <CheckCircle2 size={30} color={tc.accent} strokeWidth={2.4} />
                ) : (
                  <Circle size={30} color={tc.textTertiary} strokeWidth={2} />
                )}
                <View style={styles.stepCopy}>
                  <Text style={[styles.stepNumber, { color: done ? tc.accent : tc.textTertiary }]}>
                    {t('Step {number}', { number: index + 1 })}
                  </Text>
                  <Text style={[styles.stepText, { color: tc.text }]}>{step}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    minHeight: 92,
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  headerCard: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 8 },
  recipeTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 22, lineHeight: 28 },
  loadingText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  progress: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  steps: { gap: 12 },
  stepRow: { flexDirection: 'row', gap: 14, borderWidth: 1, borderRadius: 18, padding: 18 },
  stepCopy: { flex: 1, gap: 8 },
  stepNumber: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11, textTransform: 'uppercase' },
  stepText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 19, lineHeight: 30 },
});
