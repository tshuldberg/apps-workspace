import { StyleSheet } from 'react-native';
import { FilterChips } from '@mylife/bestchef/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { useHomeFilter, type HomeFilterId } from '../../state/useHomeFilter';
import type { FilterChipOption } from '@mylife/bestchef/ui';

const FILTER_IDS: HomeFilterId[] = ['trending', 'nearby', 'following', 'restaurants'];

export function HomeFilterChips() {
  const { t } = useI18n();
  const { selected, setSelected } = useHomeFilter();

  const options: FilterChipOption[] = [
    { id: 'trending', label: t('Trending') },
    { id: 'nearby', label: t('Nearby') },
    { id: 'following', label: t('Following') },
    { id: 'restaurants', label: t('Restaurants') },
  ];

  return (
    <FilterChips
      options={options}
      selected={selected}
      onChange={(id) => setSelected(id as HomeFilterId)}
      style={styles.chips}
    />
  );
}

const styles = StyleSheet.create({
  chips: {
    paddingHorizontal: 0,
  },
});
