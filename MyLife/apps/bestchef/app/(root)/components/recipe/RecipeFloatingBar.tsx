import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bookmark, Share2 } from 'lucide-react-native';
import { CircleIconButton } from '@mylife/bestchef/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { BackChevron } from '../DirectionalIcons';

export interface RecipeFloatingBarProps {
  onShare: () => void;
  onSaveToggle: () => void;
  isSaved: boolean;
}

/**
 * Absolute-positioned top bar: back chevron (left), share + bookmark (right).
 * Sits over the hero image. Buttons use CircleIconButton (blur/glass surface).
 */
export function RecipeFloatingBar({ onShare, onSaveToggle, isSaved }: RecipeFloatingBarProps) {
  const router = useRouter();
  const { t } = useI18n();
  const tc = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { top: insets.top + 12 }]}>
      <CircleIconButton
        icon={<BackChevron size={20} color="#FFFFFF" strokeWidth={2.5} />}
        onPress={() => router.back()}
        accessibilityLabel={t('Back')}
      />

      <View style={styles.rightGroup}>
        <CircleIconButton
          icon={<Share2 size={18} color="#FFFFFF" strokeWidth={2} />}
          onPress={onShare}
          accessibilityLabel={t('Share')}
        />
        <CircleIconButton
          icon={
            <Bookmark
              size={18}
              color={isSaved ? '#FFD159' : '#FFFFFF'}
              fill={isSaved ? '#FFD159' : 'transparent'}
              strokeWidth={2}
            />
          }
          onPress={onSaveToggle}
          accessibilityLabel={isSaved ? t('Remove saved recipe') : t('Save recipe to Kitchen')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    zIndex: 10,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
