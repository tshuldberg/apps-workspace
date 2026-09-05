import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeCheck, MapPin, ThumbsUp } from 'lucide-react-native';
import { getVerifiedRestaurantSubmissions, JAKARTA_FONTS, type Submission } from '@mylife/bestchef';
import { BCSectionHeader, DishVisual } from '@mylife/bestchef/ui';
import { Text } from '@mylife/ui';
import { useAppThemeColors } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { ForwardChevron } from '../DirectionalIcons';

const INFO_BLUE = '#60A5FA';

interface RestaurantRowProps {
  item: Submission;
  onPress: () => void;
}

function RestaurantRow({ item, onPress }: RestaurantRowProps) {
  const tc = useAppThemeColors();
  const upvotesK = item.upvoteCount >= 1000
    ? `${(item.upvoteCount / 1000).toFixed(1)}k`
    : String(item.upvoteCount);

  const dishSource = {
    name: item.dishId,
    photoUrl: item.photoUrl ?? undefined,
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: tc.surface, borderColor: tc.border },
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
    >
      <DishVisual dish={dishSource} size={60} radius={14} />

      <View style={styles.rowBody}>
        <View style={styles.chefNameRow}>
          <Text style={[styles.chefName, { color: tc.text }]} numberOfLines={1}>
            {item.profileId}
          </Text>
          <BadgeCheck size={13} color={INFO_BLUE} strokeWidth={2} />
        </View>
        <Text style={[styles.recipeTitle, { color: tc.textSecondary }]} numberOfLines={1}>
          {item.chefOrigin ?? item.dishId}
        </Text>
        <View style={styles.metaRow}>
          <ThumbsUp size={11} color={tc.textSecondary} strokeWidth={2} />
          <Text style={[styles.metaText, { color: tc.textSecondary }]}>{upvotesK}</Text>
          {item.region ? (
            <>
              <MapPin size={11} color={tc.textSecondary} strokeWidth={2} />
              <Text style={[styles.metaText, { color: tc.textSecondary }]}>{item.region}</Text>
            </>
          ) : null}
        </View>
      </View>

      <ForwardChevron size={16} color={tc.textSecondary} strokeWidth={2} />
    </Pressable>
  );
}

export function RestaurantSpotlight() {
  const router = useRouter();
  const { t } = useI18n();
  const [items, setItems] = useState<Submission[]>([]);

  useEffect(() => {
    let active = true;
    getVerifiedRestaurantSubmissions({ limit: 3 })
      .then((result) => {
        if (active && result.ok && result.data.length > 0) {
          setItems(result.data);
        }
      })
      .catch(() => {
        // Network unavailable -- hide section
      });
    return () => { active = false; };
  }, []);

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <BCSectionHeader
        title={t('Restaurant Spotlight')}
        subtitle={t('Verified kitchens')}
        action={{ text: t('Explore'), onPress: () => router.push('/discover') }}
      />
      <View style={styles.list}>
        {items.map((item) => (
          <RestaurantRow
            key={item.id}
            item={item}
            onPress={() => router.push(`/chef/${item.profileId}` as never)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  list: {
    gap: 10,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  chefNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chefName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
  },
  recipeTitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
  },
});
