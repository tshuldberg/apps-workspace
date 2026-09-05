import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../../providers/AppThemeProvider';
import { useBestChefCloud } from '../../providers/BestChefCloudProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { BackArrow } from '../../components/DirectionalIcons';

interface ReviewRow {
  id: string;
  tier: string;
  created_at: string;
  voter_profile_id: string | null;
}

export default function RecipeReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tc = useThemeColors();
  const theme = useTheme();
  const cloud = useBestChefCloud();
  const { t, language } = useI18n();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!cloud.supabase || !id) {
      setReviews([]);
      return () => {
        cancelled = true;
      };
    }

    void cloud.supabase
      .from('bc_votes')
      .select('id,tier,created_at,voter_profile_id')
      .eq('submission_id', id)
      .in('tier', ['gold', 'silver', 'bronze'])
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled) setReviews((data ?? []) as ReviewRow[]);
      });

    return () => {
      cancelled = true;
    };
  }, [cloud.supabase, id]);

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topTitle, { color: tc.text }]}>{t('Reviewed votes')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {reviews.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <BadgeCheck size={28} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('No reviewed votes yet')}</Text>
            <Text style={[styles.emptyBody, { color: tc.textSecondary }]}>
              {t('CookProof reviews will appear here after voters submit verified proof.')}
            </Text>
          </View>
        ) : reviews.map((review) => (
          <View key={review.id} style={[styles.reviewRow, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <BadgeCheck size={18} color={tc.accent} strokeWidth={2.2} />
            <View style={styles.reviewCopy}>
              <Text style={[styles.reviewTier, { color: tc.text }]}>{review.tier}</Text>
              <Text style={[styles.reviewMeta, { color: tc.textSecondary }]}>
                {new Date(review.created_at).toLocaleDateString(language)}
              </Text>
            </View>
          </View>
        ))}
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
  topTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  emptyCard: { borderWidth: 1, borderRadius: 18, padding: 22, alignItems: 'center', gap: 10 },
  emptyTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  emptyBody: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  reviewRow: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 16, padding: 16 },
  reviewCopy: { flex: 1, gap: 4 },
  reviewTier: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 14, textTransform: 'capitalize' },
  reviewMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
});
