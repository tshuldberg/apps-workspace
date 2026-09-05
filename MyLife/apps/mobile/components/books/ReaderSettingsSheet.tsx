import { useCallback, useRef } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  Text,
  type LayoutChangeEvent,
} from 'react-native';
import { colors } from '@mylife/ui';
import { useReaderPreferences } from '../../hooks/books/use-reader-preferences';
import { BOOKS_SURFACES, JAKARTA_FONTS } from '@mylife/books/ui';
import { icons } from 'lucide-react-native';

const XIcon = icons.X;
const BOOKS_ACCENT = colors.modules.books;

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 48;

const THEMES = [
  { key: 'light' as const, label: 'LIGHT', bg: '#FFFFFF', text: '#1D1D1D' },
  { key: 'sepia' as const, label: 'SEPIA', bg: '#F3E8D4', text: '#3B2C1C' },
  { key: 'dark' as const, label: 'OBSIDIAN', bg: '#131318', text: '#F5F2ED' },
];

interface ReaderSettingsSheetProps {
  documentId: string;
  visible: boolean;
  onClose: () => void;
}

export function ReaderSettingsSheet({
  documentId,
  visible,
  onClose,
}: ReaderSettingsSheetProps) {
  const { preferences, save } = useReaderPreferences(documentId);
  const trackWidthRef = useRef(0);

  const fontSize = preferences?.font_size ?? 20;
  const fontFamily = preferences?.font_family ?? 'serif';
  const theme = preferences?.theme ?? 'dark';

  const update = useCallback(
    (key: string, value: number | string) => {
      save({
        font_size: preferences?.font_size ?? 20,
        line_height: preferences?.line_height ?? 1.6,
        font_family: preferences?.font_family ?? 'serif',
        theme: preferences?.theme ?? 'dark',
        margin_size: preferences?.margin_size ?? 20,
        [key]: value,
      });
    },
    [preferences, save],
  );

  const handleSliderTouch = useCallback(
    (locationX: number) => {
      if (trackWidthRef.current <= 0) return;
      const ratio = Math.max(
        0,
        Math.min(1, locationX / trackWidthRef.current),
      );
      const newSize = Math.round(
        FONT_SIZE_MIN + ratio * (FONT_SIZE_MAX - FONT_SIZE_MIN),
      );
      update('font_size', newSize);
    },
    [update],
  );

  const sliderRatio =
    (fontSize - FONT_SIZE_MIN) / (FONT_SIZE_MAX - FONT_SIZE_MIN);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Drag Handle */}
          <View style={styles.handle} />

          {/* Title Row */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>Reader Settings</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={styles.closeButton}
            >
              <XIcon size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Font Size */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.sectionLabel}>FONT SIZE</Text>
              <Text style={styles.fontSizeValue}>{fontSize}px</Text>
            </View>
            <View style={styles.sliderRow}>
              <Text style={styles.smallA}>A</Text>
              <View
                style={styles.sliderTrackContainer}
                onLayout={(e: LayoutChangeEvent) => {
                  trackWidthRef.current = e.nativeEvent.layout.width;
                }}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(e) =>
                  handleSliderTouch(e.nativeEvent.locationX)
                }
                onResponderMove={(e) =>
                  handleSliderTouch(e.nativeEvent.locationX)
                }
              >
                <View style={styles.sliderTrack}>
                  <View
                    style={[
                      styles.sliderFill,
                      { width: `${sliderRatio * 100}%` },
                    ]}
                  />
                </View>
                <View
                  style={[
                    styles.sliderThumb,
                    { left: `${sliderRatio * 100}%` },
                  ]}
                  pointerEvents="none"
                />
              </View>
              <Text style={styles.largeA}>A</Text>
            </View>
          </View>

          {/* Typography */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TYPOGRAPHY</Text>
            <View style={styles.toggleRow}>
              <Pressable
                style={[
                  styles.togglePill,
                  fontFamily === 'serif' && styles.togglePillActive,
                ]}
                onPress={() => update('font_family', 'serif')}
              >
                <Text
                  style={[
                    styles.toggleIcon,
                    { fontFamily: 'serif' },
                    fontFamily === 'serif' && styles.toggleTextActive,
                  ]}
                >
                  Tr
                </Text>
                <Text
                  style={[
                    styles.toggleText,
                    fontFamily === 'serif' && styles.toggleTextActive,
                  ]}
                >
                  Serif
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.togglePill,
                  fontFamily === 'sans-serif' && styles.togglePillActive,
                ]}
                onPress={() => update('font_family', 'sans-serif')}
              >
                <Text
                  style={[
                    styles.toggleIcon,
                    { fontFamily: 'sans-serif' },
                    fontFamily === 'sans-serif' && styles.toggleTextActive,
                  ]}
                >
                  A
                </Text>
                <Text
                  style={[
                    styles.toggleText,
                    fontFamily === 'sans-serif' && styles.toggleTextActive,
                  ]}
                >
                  Sans-serif
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Appearance */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>APPEARANCE</Text>
            <View style={styles.themeRow}>
              {THEMES.map((t) => (
                <Pressable
                  key={t.key}
                  style={styles.themeCard}
                  onPress={() => update('theme', t.key)}
                >
                  <View
                    style={[
                      styles.themePreview,
                      { backgroundColor: t.bg },
                      theme === t.key && styles.themePreviewActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.themePreviewText,
                        { color: t.text },
                      ]}
                    >
                      Aa
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.themeLabel,
                      theme === t.key && styles.themeLabelActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: BOOKS_SURFACES.base,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: BOOKS_SURFACES.highest,
    alignSelf: 'center',
  },

  // Title
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 22,
    color: '#E4E1E9',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sections
  section: {
    gap: 14,
  },
  sectionLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#9F8E81',
    textTransform: 'uppercase',
  },

  // Font Size
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fontSizeValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: BOOKS_ACCENT,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  smallA: {
    fontFamily: 'serif',
    fontSize: 14,
    color: '#9F8E81',
  },
  largeA: {
    fontFamily: 'serif',
    fontSize: 22,
    color: '#9F8E81',
  },
  sliderTrackContainer: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BOOKS_SURFACES.highest,
    overflow: 'hidden',
  },
  sliderFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BOOKS_ACCENT,
  },
  sliderThumb: {
    position: 'absolute',
    top: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BOOKS_ACCENT,
    marginLeft: -10,
  },

  // Typography Toggles
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: BOOKS_SURFACES.focus,
  },
  togglePillActive: {
    backgroundColor: '#C9894D',
  },
  toggleIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D6C3B5',
  },
  toggleText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: '#D6C3B5',
  },
  toggleTextActive: {
    color: '#1a1008',
  },

  // Theme Cards
  themeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  themeCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  themePreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themePreviewActive: {
    borderColor: BOOKS_ACCENT,
  },
  themePreviewText: {
    fontSize: 28,
    fontWeight: '600',
  },
  themeLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    letterSpacing: 1,
    color: '#9F8E81',
    textTransform: 'uppercase',
  },
  themeLabelActive: {
    color: BOOKS_ACCENT,
  },
});
