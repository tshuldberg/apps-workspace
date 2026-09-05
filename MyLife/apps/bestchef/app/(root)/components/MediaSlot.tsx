import { Image } from 'expo-image';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  BookOpen,
  Camera,
  FileText,
  Image as ImageIcon,
  Package,
  Play,
} from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import {
  MEDIA_SLOT_ASPECT_RATIOS,
  isRenderableMediaUri,
  mediaSlotFallbackLabel,
  type MediaSlotKind,
} from '../utils/media';

interface MediaSlotProps {
  kind: MediaSlotKind;
  uri?: string | null;
  label?: string | null;
  meta?: string | null;
  compact?: boolean;
  aspectRatio?: number;
  onPress?: () => void;
}

function MediaIcon({ kind, color, size }: { kind: MediaSlotKind; color: string; size: number }) {
  switch (kind) {
    case 'recipe':
      return <BookOpen size={size} color={color} strokeWidth={1.8} />;
    case 'pantryBatch':
      return <Package size={size} color={color} strokeWidth={1.8} />;
    case 'receipt':
      return <FileText size={size} color={color} strokeWidth={1.8} />;
    case 'foodPhoto':
      return <Camera size={size} color={color} strokeWidth={1.8} />;
    case 'video':
      return <Play size={size} color={color} fill={color} strokeWidth={1.8} />;
  }
}

export function MediaSlot({
  kind,
  uri,
  label,
  meta,
  compact = false,
  aspectRatio = MEDIA_SLOT_ASPECT_RATIOS[kind],
  onPress,
}: MediaSlotProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const fallbackLabel = label ?? mediaSlotFallbackLabel(kind);
  const renderableImageUri = kind !== 'video' && isRenderableMediaUri(uri) ? uri : null;
  const content = (
    <View
      style={[
        styles.slot,
        compact && styles.compactSlot,
        {
          aspectRatio,
          backgroundColor: theme.glass.cardFill,
          borderColor: theme.glass.cardBorder,
        },
      ]}
    >
      {renderableImageUri ? (
        <Image source={{ uri: renderableImageUri }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={[styles.fallback, { backgroundColor: tc.surface }]}>
          <View style={[styles.iconWrap, compact && styles.compactIconWrap, { backgroundColor: `${tc.accent}1A` }]}>
            <MediaIcon kind={kind} color={tc.accent} size={compact ? 18 : 30} />
          </View>
          <Text
            style={[styles.fallbackTitle, compact && styles.compactTitle, { color: tc.text }]}
            numberOfLines={compact ? 1 : 2}
          >
            {t(fallbackLabel)}
          </Text>
          {meta ? (
            <Text style={[styles.fallbackMeta, { color: tc.textTertiary }]} numberOfLines={1}>
              {t(meta)}
            </Text>
          ) : null}
        </View>
      )}
      {kind === 'video' || isRenderableMediaUri(uri) ? (
        <View style={[styles.kindBadge, { backgroundColor: 'rgba(0, 0, 0, 0.48)' }]}>
          {kind === 'video' ? <Play size={11} color="white" fill="white" strokeWidth={1.8} /> : <ImageIcon size={11} color="white" strokeWidth={1.8} />}
          <Text style={styles.kindBadgeText}>{t(kind === 'video' ? 'Video' : 'Media')}</Text>
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      style={({ pressed }) => [pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(fallbackLabel)}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: '100%',
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  compactSlot: {
    minHeight: 58,
    borderRadius: 14,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
  },
  fallbackTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  compactTitle: {
    fontSize: 10,
    lineHeight: 13,
  },
  fallbackMeta: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    textAlign: 'center',
  },
  kindBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kindBadgeText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 9,
    color: 'white',
  },
});
