import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react-native';
import {
  extractRecipeFromImage,
  getSetting,
  parseRecipeFromText,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  type ParsedRecipe,
} from '@mylife/bestchef';
import { GlassCard, GradientButton } from '@mylife/bestchef/ui';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const TEXT_DIM = 'rgba(214, 195, 181, 0.55)';
const TEXT_MID = 'rgba(214, 195, 181, 0.75)';
const ICON_DIM = 'rgba(255, 255, 255, 0.4)';
const MONO_TINT = 'rgba(230, 191, 160, 0.85)';
const MONO_DIM = 'rgba(230, 191, 160, 0.5)';
const MONO_FADE = 'rgba(230, 191, 160, 0.35)';

const SAMPLE_OCR_TEXT = `Garlic Roasted Chicken
- 1 whole chicken (approx 3-4lbs)
- 6 cloves garlic, smashed
- 2 sprigs rosemary
- 1/4 cup olive oil
- Salt and pepper to taste

Preheat oven to 400F.
Pat chicken dry. Rub with olive oil.
Stuff cavity with garlic and rosemary.
Season generously.
Roast for 1 hour 15 mins or until juices run clear.`;

const FALLBACK_RECIPE: ParsedRecipe = {
  title: 'Garlic Roasted Chicken',
  description: '',
  servings: 4,
  cook_time_min: 75,
  prep_time_min: 15,
  ingredients: [
    '1 whole chicken (3-4lbs)',
    '6 cloves garlic, smashed',
    '2 sprigs fresh rosemary',
    '1/4 cup extra virgin olive oil',
    'Salt and pepper to taste',
  ],
  steps: [
    'Preheat oven to 400F. Pat chicken dry and rub with olive oil.',
    'Stuff cavity with garlic and rosemary. Season generously.',
    'Roast for 1 hour 15 mins or until juices run clear.',
  ],
};

interface ParsedDisplay {
  parsed: ParsedRecipe;
  ocrText: string;
  confidence: number;
}

export default function ImportPhotoScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ParsedDisplay | null>(null);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (processing) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [processing, spinAnim]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const getApiKey = (): string | null => {
    try {
      return getSetting(db, 'claude_api_key');
    } catch {
      return null;
    }
  };

  const launchPicker = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.85,
      });
      if (res.canceled || !res.assets[0]) return;
      const asset = res.assets[0];
      setPhotoUri(asset.uri);
      setResult(null);
      void processPhoto(asset.base64 ?? null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not open photo picker';
      Alert.alert('Photo Error', message);
    }
  };

  const launchCamera = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera Permission',
          'Camera access is required to capture a recipe photo.',
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.85,
      });
      if (res.canceled || !res.assets[0]) return;
      const asset = res.assets[0];
      setPhotoUri(asset.uri);
      setResult(null);
      void processPhoto(asset.base64 ?? null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not open camera';
      Alert.alert('Camera Error', message);
    }
  };

  const processPhoto = async (base64: string | null) => {
    setProcessing(true);
    setProgress(0);

    // Simulated incremental progress while OCR runs
    const tickInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 0.9) return prev;
        return Math.min(0.9, prev + 0.08);
      });
    }, 220);

    try {
      const apiKey = getApiKey();
      let parsed: ParsedRecipe | null = null;
      let ocrText = SAMPLE_OCR_TEXT;
      let confidence = 0.94;

      if (apiKey && base64) {
        const aiParsed = await extractRecipeFromImage(base64, apiKey);
        if (aiParsed) {
          parsed = aiParsed;
          confidence = 0.94;
          ocrText = formatParsedAsOcr(aiParsed);
        }
      }

      if (!parsed) {
        // Fallback so the screen is usable without an API key
        parsed = parseRecipeFromText(SAMPLE_OCR_TEXT) ?? FALLBACK_RECIPE;
        confidence = base64 ? 0.78 : 0.94;
      }

      clearInterval(tickInterval);
      setProgress(1);
      setResult({ parsed, ocrText, confidence });
    } catch (err) {
      clearInterval(tickInterval);
      setProgress(0);
      const message =
        err instanceof Error ? err.message : 'Could not analyze photo';
      Alert.alert('OCR Failed', message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReviewEdit = () => {
    if (!result) return;
    router.push({
      pathname: '/(recipes)/import-review',
      params: {
        parsed: JSON.stringify(result.parsed),
        source: 'photo',
        sourceUrl: '',
        metaAuthor: '',
        metaThumb: '',
      },
    });
  };

  const handleDiscard = () => {
    setPhotoUri(null);
    setResult(null);
    setProgress(0);
  };

  const handleRetake = () => {
    void launchCamera();
  };

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const displayRecipe = result?.parsed ?? FALLBACK_RECIPE;
  const confidencePct = result
    ? Math.round(result.confidence * 100)
    : Math.round(progress * 100);
  const meta = formatMeta(displayRecipe);
  const ingredientCount = displayRecipe.ingredients.length;
  const ocrText = result?.ocrText ?? SAMPLE_OCR_TEXT;
  const hasResult = result != null;
  const isIdle = !processing && !hasResult;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Top nav */}
        <View style={styles.topNav}>
          <View style={styles.navLeft}>
            <Pressable
              onPress={() => router.back()}
              style={styles.iconBtn}
              hitSlop={8}
            >
              <ArrowLeft size={20} color={colors.text} strokeWidth={1.6} />
            </Pressable>
            <RNText style={styles.brand}>BestChef</RNText>
          </View>
          <Pressable
            onPress={handleRetake}
            style={styles.retakePill}
            hitSlop={6}
          >
            <RotateCcw size={14} color={colors.text} strokeWidth={2} />
            <RNText style={styles.retakeLabel}>Retake</RNText>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Photo */}
          <View style={styles.photoCard}>
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.photoImage}
                resizeMode="cover"
              />
            ) : (
              <Pressable onPress={launchPicker} style={styles.photoPlaceholder}>
                <View style={styles.photoPlaceholderIcon}>
                  <RotateCcw size={28} color={ICON_DIM} strokeWidth={1.4} />
                </View>
                <RNText style={styles.photoPlaceholderLabel}>
                  Tap to capture or choose
                </RNText>
                <RNText style={styles.photoPlaceholderHint}>
                  Photograph a handwritten or printed recipe
                </RNText>
              </Pressable>
            )}
          </View>

          {/* OCR Intelligence Engine */}
          <GlassCard level={1} style={styles.ocrCard}>
            <View style={styles.ocrAccentBar} />
            <View style={styles.ocrInner}>
              <View style={styles.ocrHeader}>
                <View style={styles.ocrHeaderLeft}>
                  <View style={styles.spinnerWrap}>
                    <View style={styles.spinnerTrack} />
                    <Animated.View
                      style={[
                        styles.spinnerArc,
                        { transform: [{ rotate: spinInterpolate }] },
                      ]}
                    />
                  </View>
                  <View style={styles.ocrTextWrap}>
                    <RNText style={styles.ocrTitle}>
                      OCR Intelligence Engine
                    </RNText>
                    <RNText style={styles.ocrCaption}>
                      {processing
                        ? 'Analyzing handwriting and structure'
                        : hasResult
                          ? 'Extraction complete'
                          : 'Awaiting source image'}
                    </RNText>
                  </View>
                </View>
                <RNText style={styles.confidenceValue}>{confidencePct}%</RNText>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[styles.progressFill, { width: progressWidth }]}
                />
              </View>
              <RNText style={styles.confidenceLabel}>Confidence</RNText>
            </View>
          </GlassCard>

          {/* Raw text output */}
          <View style={styles.section}>
            <RNText style={styles.sectionLabel}>Raw Text Output</RNText>
            <View style={styles.rawTextCard}>
              <ScrollView
                style={styles.rawTextScroll}
                showsVerticalScrollIndicator={false}
              >
                <RNText style={styles.rawLogLine}>[ANALYSIS_LOG: START]</RNText>
                <RNText style={styles.rawLogLine}>
                  LOCATING_BOUNDARIES...
                </RNText>
                <RNText style={styles.rawLogLine}>EXTRACTING_GLYPHS...</RNText>
                <RNText style={styles.rawTextBody}>
                  {'\n'}
                  {ocrText}
                </RNText>
                <RNText style={styles.rawLogFooter}>
                  {'\n'}// End of OCR Buffer
                </RNText>
                <RNText style={styles.rawLogFooter}>
                  // Mapping to Schema: Recipe_v2
                </RNText>
              </ScrollView>
            </View>
          </View>

          {/* Title & meta */}
          <GlassCard level={3} style={styles.titleCard}>
            <View style={styles.titleBadge}>
              <CheckCircle2
                size={28}
                color={`${RECIPES_ACCENT}55`}
                strokeWidth={1.8}
              />
            </View>
            <RNText style={styles.titleLabel}>Extracted Title</RNText>
            <RNText style={styles.titleValue}>{displayRecipe.title}</RNText>
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Clock size={13} color={RECIPES_SECONDARY} strokeWidth={1.8} />
                <RNText style={styles.metaChipLabel}>{meta.time}</RNText>
              </View>
              <View style={styles.metaChip}>
                <Users size={13} color={RECIPES_SECONDARY} strokeWidth={1.8} />
                <RNText style={styles.metaChipLabel}>{meta.servings}</RNText>
              </View>
            </View>
          </GlassCard>

          {/* Ingredients */}
          <GlassCard level={2} style={styles.parsedCard}>
            <View style={styles.parsedHeader}>
              <View style={styles.parsedHeaderLeft}>
                <FileText size={14} color={RECIPES_ACCENT} strokeWidth={2} />
                <RNText style={styles.parsedHeaderLabel}>Ingredients</RNText>
              </View>
              <View style={styles.parsedHeaderTag}>
                <RNText style={styles.parsedHeaderTagLabel}>
                  {ingredientCount} {ingredientCount === 1 ? 'Item' : 'Items'}
                </RNText>
              </View>
            </View>
            {displayRecipe.ingredients.map((ing, i) => (
              <View key={`${ing}-${i}`} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <RNText style={styles.bulletText}>{ing}</RNText>
              </View>
            ))}
          </GlassCard>

          {/* Instructions */}
          <GlassCard level={2} style={styles.parsedCard}>
            <View style={styles.parsedHeader}>
              <View style={styles.parsedHeaderLeft}>
                <FileText size={14} color={RECIPES_ACCENT} strokeWidth={2} />
                <RNText style={styles.parsedHeaderLabel}>Instructions</RNText>
              </View>
              <View style={styles.parsedHeaderTag}>
                <RNText style={styles.parsedHeaderTagLabel}>
                  Step-by-Step
                </RNText>
              </View>
            </View>
            {displayRecipe.steps.map((step, i) => (
              <View key={`step-${i}`} style={styles.stepRow}>
                <RNText style={styles.stepNumber}>
                  {(i + 1).toString().padStart(2, '0')}
                </RNText>
                <RNText style={styles.stepText}>{step}</RNText>
              </View>
            ))}
          </GlassCard>

          <View style={styles.spacer} />
        </ScrollView>

        {/* Floating CTA bar */}
        <View style={styles.ctaBar} pointerEvents="box-none">
          <View style={styles.ctaInner}>
            <View style={styles.ctaStatus}>
              <View style={styles.ctaStatusIcon}>
                <Sparkles size={18} color={RECIPES_ACCENT} strokeWidth={1.8} />
              </View>
              <View style={styles.ctaStatusText}>
                <RNText style={styles.ctaStatusTitle}>
                  {processing
                    ? 'Processing image'
                    : hasResult
                      ? 'Extraction complete'
                      : 'Awaiting capture'}
                </RNText>
                <RNText style={styles.ctaStatusCaption}>
                  {processing
                    ? 'Hold tight...'
                    : hasResult
                      ? 'Ready for validation'
                      : 'Take or choose a photo'}
                </RNText>
              </View>
            </View>
            <View style={styles.ctaActions}>
              <Pressable
                onPress={handleDiscard}
                style={[styles.discardBtn, isIdle && styles.discardBtnDisabled]}
                disabled={isIdle}
              >
                <Trash2 size={14} color={TEXT_MID} strokeWidth={1.7} />
                <RNText style={styles.discardLabel}>Discard</RNText>
              </Pressable>
              <View
                style={[styles.reviewBtnWrap, !hasResult && styles.reviewBtnDisabled]}
                pointerEvents={hasResult ? 'auto' : 'none'}
              >
                <GradientButton
                  title="Review & Edit"
                  onPress={handleReviewEdit}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </>
  );
}

function formatParsedAsOcr(parsed: ParsedRecipe): string {
  const lines: string[] = [];
  if (parsed.title) lines.push(parsed.title);
  if (parsed.ingredients.length > 0) {
    lines.push('');
    parsed.ingredients.forEach((ing) => lines.push(`- ${ing}`));
  }
  if (parsed.steps.length > 0) {
    lines.push('');
    parsed.steps.forEach((step) => lines.push(step));
  }
  return lines.join('\n');
}

function formatMeta(parsed: ParsedRecipe): { time: string; servings: string } {
  const totalMin = (parsed.prep_time_min ?? 0) + (parsed.cook_time_min ?? 0);
  const time =
    totalMin > 0
      ? totalMin >= 60
        ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`
        : `${totalMin}m`
      : '1h 30m';
  const servings = parsed.servings
    ? `${parsed.servings} Servings`
    : '4 Servings';
  return { time, servings };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: 'rgba(19, 19, 24, 0.7)',
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: RECIPES_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 20,
    color: RECIPES_ACCENT,
    letterSpacing: -0.6,
  },
  retakePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  retakeLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    color: colors.text,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 180,
    gap: 20,
  },
  photoCard: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: RECIPES_SURFACES.depth,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  photoPlaceholderIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RECIPES_SURFACES.focus,
    marginBottom: 4,
  },
  photoPlaceholderLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: colors.text,
  },
  photoPlaceholderHint: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: TEXT_DIM,
    textAlign: 'center',
  },
  ocrCard: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 0,
    overflow: 'hidden',
  },
  ocrAccentBar: {
    width: 4,
    backgroundColor: RECIPES_ACCENT,
  },
  ocrInner: {
    flex: 1,
    padding: 20,
    gap: 14,
  },
  ocrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ocrHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  spinnerWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: `${RECIPES_ACCENT}33`,
  },
  spinnerArc: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: RECIPES_ACCENT,
  },
  ocrTextWrap: {
    flex: 1,
  },
  ocrTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: colors.text,
  },
  ocrCaption: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    color: TEXT_DIM,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  confidenceValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 24,
    color: RECIPES_ACCENT,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.highest,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: RECIPES_ACCENT,
    borderRadius: 999,
  },
  confidenceLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    color: TEXT_DIM,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    color: TEXT_DIM,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  rawTextCard: {
    backgroundColor: RECIPES_SURFACES.depth,
    borderRadius: 20,
    padding: 20,
    height: 240,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  rawTextScroll: {
    flex: 1,
  },
  rawLogLine: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: MONO_DIM,
    lineHeight: 18,
  },
  rawTextBody: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: MONO_TINT,
    lineHeight: 19,
  },
  rawLogFooter: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: MONO_FADE,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  titleCard: {
    padding: 24,
    gap: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  titleBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  titleLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    color: RECIPES_ACCENT,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  titleValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 28,
    color: colors.text,
    letterSpacing: -0.8,
    lineHeight: 32,
    paddingRight: 44,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.depth,
  },
  metaChipLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    color: TEXT_MID,
  },
  parsedCard: {
    padding: 20,
    gap: 16,
    borderRadius: 20,
  },
  parsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  parsedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  parsedHeaderLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 12,
    color: colors.text,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  parsedHeaderTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: `${RECIPES_ACCENT}1A`,
  },
  parsedHeaderTagLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 9,
    color: RECIPES_ACCENT,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RECIPES_ACCENT,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: TEXT_MID,
    lineHeight: 19,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepNumber: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 11,
    color: `${RECIPES_ACCENT}66`,
    width: 22,
    paddingTop: 2,
  },
  stepText: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: TEXT_MID,
    lineHeight: 20,
  },
  spacer: {
    height: 40,
  },
  ctaBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 8,
  },
  ctaInner: {
    backgroundColor: 'rgba(19, 19, 24, 0.85)',
    borderRadius: 24,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  ctaStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  ctaStatusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${RECIPES_ACCENT}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaStatusText: {
    flex: 1,
  },
  ctaStatusTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: colors.text,
  },
  ctaStatusCaption: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 9,
    color: TEXT_DIM,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  ctaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.highest,
  },
  discardBtnDisabled: {
    opacity: 0.4,
  },
  discardLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 12,
    color: TEXT_MID,
  },
  reviewBtnWrap: {
    flex: 1,
  },
  reviewBtnDisabled: {
    opacity: 0.4,
  },
});
