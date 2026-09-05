import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { UtensilsCrossed } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Text } from '@mylife/ui';
import { DishVisual } from '@mylife/bestchef/ui';
import { JAKARTA_FONTS, getChefSubmissions } from '@mylife/bestchef';
import type { Submission } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useAppThemeProfile as useTheme } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';

interface Props {
  chefId: string;
}

function shortNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

function SkeletonCard() {
  return <View style={styles.skeletonCard} />;
}

export function ChefRecipesPane({ chefId }: Props) {
  const router = useRouter();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getChefSubmissions(chefId, { limit: 24, sortBy: 'vote_score' }).then((result) => {
      if (!cancelled) setSubmissions(result.ok ? result.data : []);
    }).catch(() => {
      if (!cancelled) setSubmissions([]);
    });
    return () => { cancelled = true; };
  }, [chefId]);

  if (submissions === null) {
    return (
      <View style={styles.grid}>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </View>
    );
  }

  if (submissions.length === 0) {
    return (
      <View style={styles.empty}>
        <UtensilsCrossed size={36} color={tc.textSecondary} strokeWidth={1.5} />
        <Text style={[styles.emptyText, { color: tc.text }]}>{t('No recipes yet')}</Text>
        <Text style={[styles.emptySubtitle, { color: tc.textSecondary }]}>
          {t('Their latest public recipe map is cached locally and ready for follower updates.')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {submissions.map((sub) => {
        const dish = {
          name: sub.dishId,
          photoUrl: sub.photoUrl ?? undefined,
        };
        return (
          <Pressable
            key={sub.id}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            onPress={() => router.push(`/recipe/${sub.id}` as never)}
          >
            <DishVisual dish={dish} size={CARD_SIZE} radius={14} />
            <View style={styles.cardMeta}>
              <Text style={[styles.cardTitle, { color: tc.text }]} numberOfLines={1}>
                {sub.dishId}
              </Text>
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreTxt, { color: tc.textSecondary }]}>
                  {shortNum(sub.upvoteCount)} ↑
                </Text>
                {sub.reviewedCount > 0 && (
                  <Text style={[styles.scoreTxt, { color: tc.textSecondary }]}>
                    ✓ {sub.reviewedCount}
                  </Text>
                )}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const CARD_SIZE = 156;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: CARD_SIZE,
    gap: 6,
  },
  cardMeta: {
    gap: 2,
  },
  cardTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreTxt: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
  },
  skeletonCard: {
    width: CARD_SIZE,
    height: CARD_SIZE + 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  emptyText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
  },
  emptySubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    textAlign: 'center',
  },
});
