import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { ChefHat, Pencil, Trophy } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { JAKARTA_FONTS, RECIPES_TYPOGRAPHY } from '@mylife/bestchef';
import type { SignatureDish } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';

interface Props {
  dishes: SignatureDish[];
  loading?: boolean;
  onPressEdit?: () => void;
  onPressDish?: (dish: SignatureDish) => void;
  /** When true, render the editor CTA (own profile). Visitor screens omit it. */
  canEdit?: boolean;
}

export function SignatureDishesSection({
  dishes,
  loading = false,
  onPressEdit,
  onPressDish,
  canEdit = false,
}: Props) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: tc.text }]}>{t('profile_signature_dishes')}</Text>
        {canEdit && onPressEdit && (
          <Pressable
            style={({ pressed }) => [styles.editLink, pressed && { opacity: 0.7 }]}
            onPress={onPressEdit}
            accessibilityRole="button"
            accessibilityLabel={t('profile_edit_signature_dishes')}
          >
            <Pencil size={13} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.editText, { color: tc.accent }]}>
              {t('profile_edit_signature_dishes')}
            </Text>
          </Pressable>
        )}
      </View>

      {dishes.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <Trophy size={32} color={tc.textTertiary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: tc.text }]}>
            {loading ? t('Loading') : t('profile_no_signatures_yet')}
          </Text>
          {!loading && (
            <Text style={[styles.emptyMessage, { color: tc.textSecondary }]}>
              {canEdit
                ? t('profile_pick_up_to_three')
                : t('Your top-ranked submissions will appear here')}
            </Text>
          )}
          {canEdit && !loading && onPressEdit && (
            <Pressable
              style={({ pressed }) => [
                styles.ctaPill,
                { backgroundColor: `${tc.accent}1F` },
                pressed && { opacity: 0.85 },
              ]}
              onPress={onPressEdit}
              accessibilityRole="button"
            >
              <Text style={[styles.ctaText, { color: tc.accent }]}>
                {t('profile_edit_signature_dishes')}
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.cardList}>
          {dishes.map((dish) => (
            <Pressable
              key={dish.submissionId}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
                pressed && { opacity: 0.85 },
              ]}
              onPress={onPressDish ? () => onPressDish(dish) : undefined}
              accessibilityRole={onPressDish ? 'button' : undefined}
              accessibilityLabel={dish.dishName}
            >
              <View style={[styles.thumb, { backgroundColor: tc.surface }]}>
                {dish.photoUrl ? (
                  <Image source={{ uri: dish.photoUrl }} style={styles.thumbImage} contentFit="cover" />
                ) : (
                  <ChefHat size={20} color={tc.accent} strokeWidth={1.8} />
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: tc.text }]} numberOfLines={1}>
                  {dish.dishName || t('Dish')}
                </Text>
                <Text style={[styles.cardMeta, { color: tc.textSecondary }]} numberOfLines={1}>
                  {`${Math.round(dish.voteScore)} ↑${dish.cuisine ? `  ·  ${dish.cuisine}` : ''}`}
                </Text>
              </View>
              {dish.rank != null && (
                <View style={[styles.rankBadge, { backgroundColor: `${tc.accent}22`, borderColor: `${tc.accent}55` }]}>
                  <Text style={[styles.rankText, { color: tc.accent }]}>{`#${dish.rank}`}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: { ...RECIPES_TYPOGRAPHY.headlineMd },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  cardList: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: '100%', height: '100%' },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  cardMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  rankBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  rankText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 11 },

  emptyCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16, marginTop: 4 },
  emptyMessage: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, textAlign: 'center' },
  ctaPill: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
});
