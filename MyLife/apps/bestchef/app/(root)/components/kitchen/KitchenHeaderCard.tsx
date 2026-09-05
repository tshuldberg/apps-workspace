import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UtensilsCrossed } from 'lucide-react-native';
import { HERO_GRADIENT, JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../../i18n/I18nProvider';

interface KitchenHeaderCardProps {
  pantryCount: number;
  groceryCount: number;
}

export function KitchenHeaderCard({ pantryCount, groceryCount }: KitchenHeaderCardProps) {
  const { t, formatNumber } = useI18n();

  return (
    <LinearGradient
      colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.hstack}>
        <View style={styles.iconCircle}>
          <UtensilsCrossed size={24} color="#FFFFFF" strokeWidth={2} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.caption}>{t('Your kitchen')}</Text>
          <Text style={styles.headline}>
            {t('{pantry} in pantry · {grocery} on list', {
              pantry: formatNumber(pantryCount),
              grocery: formatNumber(groceryCount),
            })}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  hstack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  caption: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
  },
  headline: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    color: '#FFFFFF',
    lineHeight: 26,
  },
});
