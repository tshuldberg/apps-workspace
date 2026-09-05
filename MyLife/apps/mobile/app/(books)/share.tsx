import { useState, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  Share,
  Dimensions,
  Text as RNText,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import { colors } from '@mylife/ui';
import {
  GlassCard,
  GradientButton,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import { useSharing } from '../../hooks/books/use-sharing';
import { ShareCardPreview } from '../../components/books/ShareCardPreview';
import type { CardTemplateId, ColorTheme } from '@mylife/books';
import { icons } from 'lucide-react-native';

const BOOKS_ACCENT = colors.modules.books;

const XIcon = icons.X;
const CalendarIcon = icons.Calendar;
const ChartBarIcon = icons.ChartBar;
const FlameIcon = icons.Flame;
const DownloadIcon = icons.Download;

interface TemplateOption {
  id: CardTemplateId;
  label: string;
  icon: typeof CalendarIcon;
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: 'year_summary', label: 'Year summary', icon: CalendarIcon },
  { id: 'monthly_chart', label: 'Monthly chart', icon: ChartBarIcon },
  { id: 'reading_streak', label: 'Streak', icon: FlameIcon },
];

export default function ShareScreen() {
  const router = useRouter();
  const { templates, buildCard } = useSharing();
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplateId>('year_summary');
  const [selectedTheme] = useState<ColorTheme>('dark');
  const [showPageCount, setShowPageCount] = useState(true);
  const [showBookCover, setShowBookCover] = useState(false);
  const [hideProgress, setHideProgress] = useState(false);
  const [showLibraryName, setShowLibraryName] = useState(true);
  const [sharing, setSharing] = useState(false);
  const captureViewRef = useRef<View>(null);

  const cardData = buildCard(selectedTemplate, selectedTheme, '', showLibraryName);

  const handleShare = useCallback(async () => {
    if (!captureViewRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(captureViewRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Share.share({
        title: 'My Reading Stats - MyBooks',
        url: uri,
        message: 'Check out my reading stats from MyBooks!',
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes('cancel')) return;
      Alert.alert('Share Failed', 'Could not share your reading card. Please try again.');
    } finally {
      setSharing(false);
    }
  }, []);

  const handleSaveImage = useCallback(async () => {
    if (!captureViewRef.current) return;
    try {
      const uri = await captureRef(captureViewRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Share.share({
        title: 'MyBooks Stats',
        url: uri,
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes('cancel')) return;
      Alert.alert('Save Failed', 'Could not save your reading card.');
    }
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <RNText style={styles.headerTitle}>MyBooks</RNText>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeButton}>
            <XIcon size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats preview card */}
          <View style={styles.previewWrapper}>
            <View ref={captureViewRef} collapsable={false}>
              <GlassCard level={2} style={styles.previewCard}>
                {cardData && (
                  <ShareCardPreview data={cardData} width={SCREEN_WIDTH - 80} />
                )}
              </GlassCard>
            </View>
          </View>

          {/* Select Template */}
          <RNText style={styles.sectionLabel}>SELECT TEMPLATE</RNText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.templateRow}
          >
            {TEMPLATE_OPTIONS.map((opt) => {
              const isSelected = selectedTemplate === opt.id;
              const templateAvail = templates.find((t) => t.template.id === opt.id);
              const available = templateAvail?.available ?? true;
              const Icon = opt.icon;
              return (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.templateCard,
                    isSelected && styles.templateCardSelected,
                    !available && styles.templateCardDisabled,
                  ]}
                  onPress={() => available && setSelectedTemplate(opt.id)}
                  disabled={!available}
                >
                  <Icon
                    size={24}
                    color={isSelected ? BOOKS_ACCENT : 'rgba(255,255,255,0.5)'}
                  />
                  <RNText
                    style={[
                      styles.templateCardLabel,
                      isSelected && styles.templateCardLabelActive,
                    ]}
                  >
                    {opt.label}
                  </RNText>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Metrics Display */}
          <GlassCard level={1} style={styles.settingsSection}>
            <RNText style={styles.settingsSectionTitle}>METRICS DISPLAY</RNText>
            <View style={styles.settingsRow}>
              <RNText style={styles.settingsLabel}>Page Count</RNText>
              <Switch
                value={showPageCount}
                onValueChange={setShowPageCount}
                trackColor={{ true: BOOKS_ACCENT, false: BOOKS_SURFACES.focus }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingsRow}>
              <RNText style={styles.settingsLabel}>Current Book Cover</RNText>
              <Switch
                value={showBookCover}
                onValueChange={setShowBookCover}
                trackColor={{ true: BOOKS_ACCENT, false: BOOKS_SURFACES.focus }}
                thumbColor="#fff"
              />
            </View>
          </GlassCard>

          {/* Privacy */}
          <GlassCard level={1} style={styles.settingsSection}>
            <RNText style={styles.settingsSectionTitle}>PRIVACY</RNText>
            <View style={styles.settingsRow}>
              <RNText style={styles.settingsLabel}>Hide Reading Progress</RNText>
              <Switch
                value={hideProgress}
                onValueChange={setHideProgress}
                trackColor={{ true: BOOKS_ACCENT, false: BOOKS_SURFACES.focus }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingsRow}>
              <RNText style={styles.settingsLabel}>Show Library Name</RNText>
              <Switch
                value={showLibraryName}
                onValueChange={setShowLibraryName}
                trackColor={{ true: BOOKS_ACCENT, false: BOOKS_SURFACES.focus }}
                thumbColor="#fff"
              />
            </View>
          </GlassCard>

          {/* Action buttons */}
          <View style={styles.actions}>
            <GradientButton
              label={sharing ? 'Sharing...' : '  Share to Social'}
              onPress={() => void handleShare()}
              disabled={sharing}
            />
            <Pressable onPress={() => void handleSaveImage()} style={styles.outlineButton}>
              <DownloadIcon size={16} color={colors.text} />
              <RNText style={styles.outlineButtonText}>Save Image</RNText>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: BOOKS_ACCENT,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 20,
  },
  previewWrapper: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  previewCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  sectionLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: -8,
  },
  templateRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  templateCard: {
    width: 130,
    height: 120,
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateCardSelected: {
    borderColor: BOOKS_ACCENT,
  },
  templateCardDisabled: {
    opacity: 0.4,
  },
  templateCardLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  templateCardLabelActive: {
    color: colors.text,
  },
  settingsSection: {
    gap: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  settingsSectionTitle: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: colors.text,
  },
  actions: {
    gap: 12,
    paddingTop: 8,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  outlineButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: colors.text,
  },
});
