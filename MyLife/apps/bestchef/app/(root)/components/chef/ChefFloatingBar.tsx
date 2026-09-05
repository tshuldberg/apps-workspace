import { Share, StyleSheet, View } from 'react-native';
import { Share2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleIconButton } from '@mylife/bestchef/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { BackChevron } from '../DirectionalIcons';

export interface ChefFloatingBarChef {
  id: string;
  displayName: string;
}

interface Props {
  chef: ChefFloatingBarChef;
  onShare?: () => void;
}

const ICON_COLOR = '#FFFFFF';

export function ChefFloatingBar({ chef, onShare }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  function handleShare() {
    if (onShare) {
      onShare();
      return;
    }
    void Share.share({
      message: `Check out chef ${chef.displayName} on BestChef!\nhttps://bestchef.app/chef/${chef.id}`,
    });
  }

  return (
    <View style={[styles.bar, { top: insets.top + 12 }]}>
      <CircleIconButton
        icon={<BackChevron size={18} color={ICON_COLOR} strokeWidth={2.5} />}
        onPress={() => router.back()}
        accessibilityLabel={t('Back')}
      />
      <CircleIconButton
        icon={<Share2 size={16} color={ICON_COLOR} strokeWidth={2.5} />}
        onPress={handleShare}
        accessibilityLabel={t('Share')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
});
