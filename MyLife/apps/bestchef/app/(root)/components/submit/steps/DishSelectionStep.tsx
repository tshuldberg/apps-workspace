import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Search } from 'lucide-react-native';
import { DishVisual } from '@mylife/bestchef/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { loadDishCatalog, type CatalogDish } from '../../../data/cloud-dishes';
import { useI18n } from '../../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../../../providers/AppThemeProvider';
import { INPUT_CAPS } from '../../../utils/validation';
import { ForwardChevron } from '../../DirectionalIcons';

interface DishSelectionStepProps {
  onSelectDish: (dish: {
    id: string;
    name: string;
    isProposed?: boolean;
    cuisine?: string;
    category?: string;
  }) => void;
}

export function DishSelectionStep({ onSelectDish }: DishSelectionStepProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();

  const [query, setQuery] = useState('');
  const [showPropose, setShowPropose] = useState(false);
  const [proposeName, setProposeName] = useState('');
  const [proposeCuisine, setProposeCuisine] = useState('');
  const [proposeCategory, setProposeCategory] = useState('');
  const [catalog, setCatalog] = useState<CatalogDish[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadDishCatalog().then((result) => {
      if (!cancelled) setCatalog(result.dishes);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = catalog.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase()) ||
    d.cuisine.toLowerCase().includes(query.toLowerCase()),
  ).slice(0, 20);

  const categories = ['appetizer', 'soup', 'salad', 'main', 'side', 'dessert', 'bread', 'beverage', 'snack', 'breakfast'];

  return (
    <>
      <View style={[styles.searchBar, { backgroundColor: tc.surface }]}>
        <Search size={18} color={tc.textSecondary} strokeWidth={2} />
        <TextInput
          style={[styles.searchInput, { color: tc.text }]}
          placeholder={t('Search for a dish...')}
          placeholderTextColor={tc.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          maxLength={INPUT_CAPS.proposeName}
        />
      </View>

      {/* 2-col grid */}
      <View style={styles.grid}>
        {filtered.map((dish) => (
          <Pressable
            key={dish.id}
            style={({ pressed }) => [
              styles.dishCard,
              { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => onSelectDish({ id: dish.id, name: dish.name })}
          >
            <DishVisual
              dish={{ name: dish.name, emoji: dish.emoji, gradientFrom: dish.gradientFrom, gradientTo: dish.gradientTo }}
              size={64}
              radius={10}
            />
            <Text style={[styles.dishName, { color: tc.text }]} numberOfLines={2}>{dish.name}</Text>
            <Text style={[styles.dishMeta, { color: tc.textTertiary }]}>
              {dish.cuisine}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.proposeLink} onPress={() => setShowPropose(!showPropose)}>
        <Text style={[styles.proposeLinkText, { color: tc.accent }]}>
          {showPropose ? t('Back to search') : t('Propose new dish')}
        </Text>
      </Pressable>

      {showPropose && (
        <View style={[styles.proposeForm, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Dish Name')}</Text>
            <TextInput
              style={[styles.fieldInput, { color: tc.text, backgroundColor: tc.surface }]}
              placeholder={t('e.g. Khachapuri, Pupusas, Jerk Chicken')}
              placeholderTextColor={tc.textTertiary}
              value={proposeName}
              onChangeText={setProposeName}
              maxLength={INPUT_CAPS.proposeName}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Cuisine')}</Text>
            <TextInput
              style={[styles.fieldInput, { color: tc.text, backgroundColor: tc.surface }]}
              placeholder={t('e.g. Georgian, Salvadoran, Jamaican')}
              placeholderTextColor={tc.textTertiary}
              value={proposeCuisine}
              onChangeText={setProposeCuisine}
              maxLength={INPUT_CAPS.proposeCuisine}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Category')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {categories.map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.catChip,
                    { backgroundColor: tc.surface },
                    proposeCategory === cat && { backgroundColor: `${tc.accent}24` },
                  ]}
                  onPress={() => setProposeCategory(cat)}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      { color: tc.textSecondary },
                      proposeCategory === cat && { color: tc.accent },
                    ]}
                  >
                    {t(cat.charAt(0).toUpperCase() + cat.slice(1) as never)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Pressable
            style={[
              styles.proposeSubmit,
              { backgroundColor: tc.accent },
              (!proposeName.trim() || !proposeCuisine.trim() || !proposeCategory) && { opacity: 0.4 },
            ]}
            disabled={!proposeName.trim() || !proposeCuisine.trim() || !proposeCategory}
            onPress={() => onSelectDish({
              id: `proposed:${proposeName.trim().toLowerCase()}:${proposeCuisine.trim().toLowerCase()}`,
              name: proposeName.trim(),
              isProposed: true,
              cuisine: proposeCuisine.trim(),
              category: proposeCategory,
            })}
          >
            <Text style={[styles.proposeSubmitText, { color: tc.background }]}>
              {t('Continue with "{dishName}"', { dishName: proposeName.trim() })}
            </Text>
            <ForwardChevron size={18} color={tc.background} strokeWidth={2.5} />
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, fontFamily: JAKARTA_FONTS.regular, fontSize: 15, padding: 0 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dishCard: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    alignItems: 'flex-start',
  },
  dishName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  dishMeta: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
  },
  proposeLink: { alignItems: 'center', paddingVertical: 16 },
  proposeLinkText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  proposeForm: { borderRadius: 20, padding: 20, gap: 16, borderWidth: 1 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  fieldInput: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    borderRadius: 14,
    padding: 14,
  },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  catChipText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },
  proposeSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 16,
    marginTop: 8,
  },
  proposeSubmitText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
});
