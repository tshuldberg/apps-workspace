import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DishVisual } from '@mylife/bestchef/ui';
import { getCuisineGradient } from '@mylife/bestchef';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';

export interface ChefBannerChef {
  id: string;
  displayName: string;
  primaryCuisine?: string | null;
  avatarColor?: string | null;
  initials: string;
}

interface Props {
  chef: ChefBannerChef;
  isRestaurant?: boolean;
}

/** 220pt full-bleed banner + 96pt avatar overflowing the bottom by 48pt. */
export function ChefBanner({ chef }: Props) {
  const tc = useThemeColors();
  const gradient = getCuisineGradient(chef.primaryCuisine ?? '');
  const avatarBg = chef.avatarColor ?? gradient.from;

  const dishSource = {
    name: chef.displayName,
    cuisine: chef.primaryCuisine ?? undefined,
    gradientFrom: gradient.from,
    gradientTo: gradient.to,
  };

  return (
    <View style={styles.bannerContainer}>
      {/* Gradient + emoji backdrop */}
      <DishVisual dish={dishSource} size={BANNER_HEIGHT} radius={0} style={styles.bannerVisual} />

      {/* Bottom scrim */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.45)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.scrim]}
      />

      {/* Avatar overflowing */}
      <View style={[styles.avatarOuter, { borderColor: tc.background }]}>
        <View style={[styles.avatarInner, { backgroundColor: avatarBg }]}>
          <Text style={styles.initials}>{chef.initials}</Text>
        </View>
      </View>
    </View>
  );
}

const BANNER_HEIGHT = 220;

const styles = StyleSheet.create({
  bannerContainer: {
    height: BANNER_HEIGHT + 48, // extra 48pt for avatar overflow space
    width: '100%',
  },
  bannerVisual: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
  } as never,
  scrim: {
    top: 0,
    height: BANNER_HEIGHT,
    position: 'absolute',
    left: 0,
    right: 0,
  },
  avatarOuter: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: 96 + 10, // 96 + 2*5pt border
    height: 96 + 10,
    borderRadius: 58,
    borderWidth: 5,
    overflow: 'hidden',
  },
  avatarInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 32,
    lineHeight: 42,
    includeFontPadding: false,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
