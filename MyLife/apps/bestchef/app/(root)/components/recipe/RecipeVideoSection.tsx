import { Pressable, StyleSheet, View } from 'react-native';
import { PlayCircle } from 'lucide-react-native';
import { DishVisual, BCSectionHeader, Card } from '@mylife/bestchef/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../../i18n/I18nProvider';

export interface RecipeVideoItem {
  videoUrl: string;
  duration: number;
  dishName: string;
  cuisine?: string | null;
  photoUrl?: string | null;
}

interface RecipeVideoSectionProps {
  video: RecipeVideoItem | null;
  onPress?: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RecipeVideoSection({ video, onPress }: RecipeVideoSectionProps) {
  const { t } = useI18n();

  if (!video) return null;

  return (
    <Card>
      <View style={styles.container}>
        <BCSectionHeader title={t('5-min cook-along')} style={styles.header} />
        <Pressable
          style={({ pressed }) => [styles.thumbnailWrap, pressed && { opacity: 0.88 }]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={t('Play cook-along video')}
        >
          <DishVisual
            dish={{
              name: video.dishName,
              cuisine: video.cuisine ?? null,
              photoUrl: video.photoUrl ?? null,
            }}
            size={200}
            radius={18}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.overlay}>
            <PlayCircle size={64} color="#FFFFFF" strokeWidth={1.5} />
            <View style={styles.durationPill}>
              <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
            </View>
          </View>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  header: { paddingHorizontal: 0, paddingVertical: 0 },
  thumbnailWrap: {
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  durationPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  durationText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
