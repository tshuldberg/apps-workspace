import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { tokens } from '../theme/tokens';

export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={handleBack}
        hitSlop={12}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ChevronLeft color={tokens.text} size={24} />
      </Pressable>
      {/* Two lines, not one: at the larger accessibility text sizes a
          single-line screen title truncates, and the title is how the reader
          knows where they are. */}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: tokens.bg,
    borderBottomColor: tokens.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: tokens.text,
    fontSize: 17,
    fontWeight: '700',
  },
  right: {
    minWidth: 36,
    alignItems: 'flex-end',
  },
});
