import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Flame } from 'lucide-react-native';
import { getTrendingDishes } from '@mylife/bestchef';
import { BCSectionHeader, FlowChips, HERO_GRADIENT } from '@mylife/bestchef/ui';
import type { FlowChipOption } from '@mylife/bestchef/ui';
import { useI18n } from '../../i18n/I18nProvider';

export function TrendingDishesChips() {
  const router = useRouter();
  const { t } = useI18n();
  const [options, setOptions] = useState<FlowChipOption[]>([]);

  useEffect(() => {
    getTrendingDishes({ limit: 8 })
      .then((result) => {
        if (result.ok && result.data.length > 0) {
          setOptions(
            result.data.map((d) => ({ id: d.dishId, label: d.dishName })),
          );
        }
      })
      .catch(() => {
        // Network unavailable -- render nothing
      });
  }, []);

  if (options.length === 0) return null;

  const flameIcon = (
    <Flame size={12} color={HERO_GRADIENT.from} fill={HERO_GRADIENT.from} strokeWidth={0} />
  );

  return (
    <View style={styles.section}>
      <BCSectionHeader
        title={t('Trending Dishes')}
        subtitle={t('Vote your favorite')}
      />
      <FlowChips
        options={options}
        leadingIcon={flameIcon}
        onChange={(id) => router.push(`/dish/${id}`)}
        style={styles.chips}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  chips: {
    paddingHorizontal: 18,
  },
});
