import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChefHat } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import {
  getFollowers,
  JAKARTA_FONTS,
  type FollowerProfile,
} from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../providers/AppThemeProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { useI18n } from '../i18n/I18nProvider';
import { BackArrow } from '../components/DirectionalIcons';

export default function FollowersListScreen() {
  const router = useRouter();
  const tc = useThemeColors();
  const insets = useSafeAreaInsets();
  const { profile: cloudProfile } = useBestChefCloud();
  const { t } = useI18n();

  const [items, setItems] = useState<FollowerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cloudProfile?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await getFollowers({ chefId: cloudProfile.id, limit: 50 });
    if (result.ok) {
      setItems(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [cloudProfile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Followers')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={tc.textSecondary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: tc.textSecondary }]}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: tc.text }]}>
            {t('No followers yet')}
          </Text>
          <Text style={[styles.emptyText, { color: tc.textSecondary }]}>
            {t('Share your profile and submit recipes to attract your first followers.')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {items.map((row) => (
            <Pressable
              key={row.profileId}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: tc.surface },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => router.push({ pathname: '/chef/[id]', params: { id: row.profileId } })}
              accessibilityRole="button"
              accessibilityLabel={row.displayName}
            >
              <View style={[styles.avatar, { backgroundColor: `${tc.accent}1A` }]}>
                {row.avatarUrl ? (
                  <Image source={{ uri: row.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <ChefHat size={20} color={tc.accent} strokeWidth={2} />
                )}
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: tc.text }]} numberOfLines={1}>
                  {row.displayName || row.handle}
                </Text>
                <Text style={[styles.rowHandle, { color: tc.textSecondary }]} numberOfLines={1}>
                  @{row.handle}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  topBarTitle: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 17,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 17,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  rowText: { flex: 1, gap: 2 },
  rowName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
  },
  rowHandle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
  },
});
