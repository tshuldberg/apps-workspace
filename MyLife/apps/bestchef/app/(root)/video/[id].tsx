import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ResizeMode, Video } from 'expo-av';
import { MessageCircle, Share2, ThumbsUp } from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { type DemoVideo } from '../data/demo-videos';
import { loadFeedVideoById } from '../data/cloud-videos';
import { BackArrow } from '../components/DirectionalIcons';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export default function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, formatNumber } = useI18n();
  const [video, setVideo] = useState<DemoVideo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Cloud video catalog first; demo fixtures only when policy allows.
    void loadFeedVideoById(id ?? '').then((found) => {
      if (cancelled) return;
      setVideo(found);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading || !video) {
    return (
      <View style={[styles.screen, { backgroundColor: tc.background }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('Back')}>
            <BackArrow size={24} color={tc.text} strokeWidth={2} />
          </Pressable>
          <Text style={[styles.topTitle, { color: tc.text }]}>{t('Cook-along')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.stateWrap}>
          {loading ? (
            <ActivityIndicator color={tc.accent} />
          ) : (
            <Text style={[styles.title, { color: tc.text }]}>{t('No videos yet')}</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topTitle, { color: tc.text }]}>{t('Cook-along')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.videoFrame, { backgroundColor: tc.surface }]}>
          <Video
            source={{ uri: video.videoUrl }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            useNativeControls
            shouldPlay={false}
          />
        </View>

        <View style={[styles.detailCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <Text style={[styles.title, { color: tc.text }]}>{video.title}</Text>
          <Text style={[styles.meta, { color: tc.textSecondary }]}>
            {video.dishName} · {video.cuisine} · {formatDuration(video.duration)}
          </Text>
          <Text style={[styles.description, { color: tc.textSecondary }]}>{video.description}</Text>

          <View style={styles.statsRow}>
            <Stat icon={<ThumbsUp size={15} color={tc.accent} strokeWidth={2.2} />} label={formatNumber(video.likes)} color={tc.text} />
            <Stat icon={<MessageCircle size={15} color={tc.accent} strokeWidth={2.2} />} label={formatNumber(video.comments)} color={tc.text} />
            <Stat icon={<Share2 size={15} color={tc.accent} strokeWidth={2.2} />} label={formatNumber(video.shares)} color={tc.text} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ icon, label, color }: { icon: ReactNode; label: string; color: string }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    minHeight: 92,
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  videoFrame: { height: 236, borderRadius: 18, overflow: 'hidden' },
  video: { width: '100%', height: '100%' },
  detailCard: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 10 },
  title: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 22, lineHeight: 28 },
  meta: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  description: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14, lineHeight: 21 },
  statsRow: { flexDirection: 'row', gap: 12, paddingTop: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
});
