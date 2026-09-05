import { StyleSheet, View } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';

interface Props {
  chef: {
    displayName: string;
    primaryCuisine?: string | null;
    region?: string | null;
    bio?: string | null;
    isRestaurant?: boolean;
  };
}

export function ChefIdentityBlock({ chef }: Props) {
  const tc = useThemeColors();

  const subtitle = [chef.primaryCuisine, chef.region].filter(Boolean).join(' · ');

  return (
    <View style={styles.container}>
      <View style={styles.nameRow}>
        <Text style={[styles.displayName, { color: tc.text }]}>{chef.displayName}</Text>
        {chef.isRestaurant && (
          <BadgeCheck size={14} color="#8BCFF0" strokeWidth={2} />
        )}
      </View>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: tc.textSecondary }]}>{subtitle}</Text>
      ) : null}
      {chef.bio ? (
        <Text style={[styles.bio, { color: tc.textSecondary }]} numberOfLines={4}>
          {chef.bio}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 26,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    textAlign: 'center',
  },
  bio: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
    marginTop: 4,
  },
});
