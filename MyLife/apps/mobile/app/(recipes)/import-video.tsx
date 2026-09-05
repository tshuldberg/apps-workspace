import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CheckCircle2,
  Loader2,
  Play,
} from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
  type ParsedRecipe,
} from '@mylife/bestchef';
import { GlassCard, GradientButton } from '@mylife/bestchef/ui';
import { colors } from '@mylife/ui';

const PARSED_RECIPE: ParsedRecipe = {
  title: 'Truffle Butter Tagliatelle',
  description: 'Imported from video',
  prep_time_min: 5,
  cook_time_min: 10,
  servings: 2,
  ingredients: [
    '250g Fresh Tagliatelle',
    '50g Black Truffle Butter',
    '40g Parmigiano Reggiano',
  ],
  steps: [
    'Bring a large pot of salted water to boil. Cook the fresh tagliatelle for 3 to 4 minutes until al dente.',
    'While the pasta cooks, melt the truffle butter in a wide skillet over low heat, adding a splash of pasta water.',
    'Toss the drained tagliatelle with the truffle butter, finish with grated Parmigiano Reggiano and serve immediately.',
  ],
};

const TAGS = ['Italian', '15 mins'];

const INGREDIENT_DISPLAY: { name: string; weight: string }[] = [
  { name: 'Fresh Tagliatelle', weight: '250g' },
  { name: 'Black Truffle Butter', weight: '50g' },
  { name: 'Parmigiano Reggiano', weight: '40g' },
];

type StepStatus = 'pending' | 'active' | 'done';

interface PipelineStep {
  id: string;
  label: string;
  detail: string;
  status: StepStatus;
  progress?: number;
}

const INITIAL_PIPELINE: PipelineStep[] = [
  { id: 'extract', label: 'Extracting audio', detail: 'Waiting...', status: 'pending' },
  { id: 'transcribe', label: 'Transcribing', detail: 'Waiting...', status: 'pending' },
  {
    id: 'parse',
    label: 'Parsing recipe',
    detail: 'Analyzing ingredients and steps...',
    status: 'pending',
    progress: 0,
  },
];

const SUCCESS_GREEN = '#22C55E';

export default function ImportVideoScreen() {
  const router = useRouter();

  const [pipeline, setPipeline] = useState<PipelineStep[]>(INITIAL_PIPELINE);
  const [titleVisible, setTitleVisible] = useState(false);
  const [ingredientCount, setIngredientCount] = useState(0);
  const [showDetectingMore, setShowDetectingMore] = useState(false);
  const [stepsRevealed, setStepsRevealed] = useState(0);
  const [step3Loading, setStep3Loading] = useState(false);

  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0.4)).current;

  // Spinner rotation for the active pipeline step
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinValue]);

  // Pulsing placeholder for the still-loading step
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseValue]);

  // Simulated pipeline progression -- pretends backend is processing the video
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(
      setTimeout(() => {
        setPipeline((prev) =>
          prev.map((step) =>
            step.id === 'extract' ? { ...step, status: 'active', detail: 'Extracting...' } : step,
          ),
        );
      }, 200),
    );

    timers.push(
      setTimeout(() => {
        setPipeline((prev) =>
          prev.map((step) =>
            step.id === 'extract' ? { ...step, status: 'done', detail: 'Completed' } : step,
          ),
        );
      }, 1100),
    );

    timers.push(
      setTimeout(() => {
        setPipeline((prev) =>
          prev.map((step) =>
            step.id === 'transcribe' ? { ...step, status: 'active', detail: 'Transcribing...' } : step,
          ),
        );
      }, 1200),
    );

    timers.push(
      setTimeout(() => {
        setPipeline((prev) =>
          prev.map((step) =>
            step.id === 'transcribe' ? { ...step, status: 'done', detail: 'Completed' } : step,
          ),
        );
      }, 2200),
    );

    timers.push(
      setTimeout(() => {
        setPipeline((prev) =>
          prev.map((step) =>
            step.id === 'parse'
              ? {
                  ...step,
                  status: 'active',
                  progress: 25,
                }
              : step,
          ),
        );
        setTitleVisible(true);
      }, 2400),
    );

    timers.push(setTimeout(() => setIngredientCount(1), 2900));
    timers.push(
      setTimeout(() => {
        setIngredientCount(2);
        setPipeline((prev) =>
          prev.map((step) =>
            step.id === 'parse' ? { ...step, progress: 50 } : step,
          ),
        );
      }, 3400),
    );
    timers.push(setTimeout(() => setIngredientCount(3), 3900));
    timers.push(
      setTimeout(() => {
        setShowDetectingMore(true);
        setPipeline((prev) =>
          prev.map((step) =>
            step.id === 'parse' ? { ...step, progress: 75 } : step,
          ),
        );
      }, 4300),
    );

    timers.push(setTimeout(() => setStepsRevealed(1), 4700));
    timers.push(setTimeout(() => setStepsRevealed(2), 5300));
    timers.push(setTimeout(() => setStep3Loading(true), 5700));

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const handleReview = () => {
    router.push({
      pathname: '/(recipes)/import-review',
      params: {
        parsed: JSON.stringify(PARSED_RECIPE),
        source: 'video',
        sourceUrl: '',
        metaAuthor: '',
        metaThumb: '',
      },
    });
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const visibleIngredients = INGREDIENT_DISPLAY.slice(0, ingredientCount);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Video Player */}
        <View style={styles.videoCard}>
          <View style={styles.videoPlaceholder}>
            <View style={styles.playButton}>
              <Play size={28} color={RECIPES_ACCENT} fill={RECIPES_ACCENT} strokeWidth={1.5} />
            </View>
          </View>
          <View style={styles.videoCenterLabel} pointerEvents="none">
            <RNText style={styles.videoCenterText}>SAFE WORK</RNText>
          </View>
          <View style={styles.videoStatusRow}>
            <View style={styles.videoBadge}>
              <RNText style={styles.videoBadgeText}>IMPORTING...</RNText>
            </View>
            <View style={styles.videoBadge}>
              <RNText style={styles.videoBadgeText}>0:45 / 3:12</RNText>
            </View>
          </View>
        </View>

        {/* Processing Pipeline */}
        <View style={styles.pipelineWrap}>
          {pipeline.map((step) => {
            const isActive = step.status === 'active';
            const isDone = step.status === 'done';
            return (
              <GlassCard
                key={step.id}
                level={isActive ? 3 : 1}
                style={[
                  styles.pipelineCard,
                  isActive && styles.pipelineCardActive,
                ]}
              >
                <View style={styles.pipelineRow}>
                  <View style={styles.pipelineLeft}>
                    <View
                      style={[
                        styles.pipelineIcon,
                        isDone && styles.pipelineIconDone,
                        isActive && styles.pipelineIconActive,
                      ]}
                    >
                      {isDone ? (
                        <CheckCircle2
                          size={22}
                          color={SUCCESS_GREEN}
                          fill={SUCCESS_GREEN}
                          strokeWidth={2}
                        />
                      ) : isActive ? (
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                          <Loader2 size={20} color={RECIPES_SECONDARY} strokeWidth={2.5} />
                        </Animated.View>
                      ) : (
                        <Loader2 size={20} color={colors.textTertiary} strokeWidth={2} />
                      )}
                    </View>
                    <View style={styles.pipelineText}>
                      <RNText
                        style={[
                          styles.pipelineLabel,
                          isActive && styles.pipelineLabelActive,
                        ]}
                      >
                        {step.label}
                      </RNText>
                      <RNText style={styles.pipelineDetail}>{step.detail}</RNText>
                    </View>
                  </View>
                  {isActive && step.progress != null ? (
                    <RNText style={styles.pipelinePercent}>{step.progress}%</RNText>
                  ) : null}
                </View>
              </GlassCard>
            );
          })}
        </View>

        {/* Parsed Recipe Preview */}
        {titleVisible ? (
          <View style={styles.parsedSection}>
            <RNText style={styles.title}>{PARSED_RECIPE.title}</RNText>
            <View style={styles.tagRow}>
              {TAGS.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <RNText style={styles.tagText}>{tag.toUpperCase()}</RNText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {ingredientCount > 0 ? (
          <View style={styles.ingredientsSection}>
            <RNText style={styles.sectionLabel}>INGREDIENTS</RNText>
            <View style={styles.ingredientList}>
              {visibleIngredients.map((ingredient) => (
                <View key={ingredient.name} style={styles.ingredientRow}>
                  <View style={styles.ingredientAccent} />
                  <RNText style={styles.ingredientName}>{ingredient.name}</RNText>
                  <RNText style={styles.ingredientWeight}>{ingredient.weight}</RNText>
                </View>
              ))}
              {showDetectingMore ? (
                <View style={[styles.ingredientRow, styles.ingredientRowGhost]}>
                  <View style={styles.ingredientAccent} />
                  <RNText style={styles.ingredientGhostText}>Detecting more...</RNText>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {stepsRevealed > 0 ? (
          <View style={styles.stepsSection}>
            <RNText style={styles.sectionLabel}>STEPS</RNText>
            <View style={styles.stepsList}>
              {PARSED_RECIPE.steps.slice(0, stepsRevealed).map((stepText, index) => (
                <View key={`step-${index}`} style={styles.stepRow}>
                  <RNText style={styles.stepNumber}>
                    {String(index + 1).padStart(2, '0')}
                  </RNText>
                  <RNText style={styles.stepText}>{stepText}</RNText>
                </View>
              ))}
              {step3Loading && stepsRevealed >= 2 ? (
                <View style={styles.stepRow}>
                  <RNText style={[styles.stepNumber, styles.stepNumberPending]}>03</RNText>
                  <Animated.View
                    style={[
                      styles.stepLoadingBar,
                      { opacity: pulseValue },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Floating CTA */}
      <View style={styles.ctaWrap} pointerEvents="box-none">
        <View style={styles.ctaInner}>
          <GradientButton title="Review & Edit Recipe" onPress={handleReview} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 180,
  },

  // Video
  videoCard: {
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: RECIPES_SURFACES.lift,
    marginBottom: 24,
    position: 'relative',
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.depth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoCenterLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 56,
    alignItems: 'center',
  },
  videoCenterText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 4,
    opacity: 0.85,
  },
  videoStatusRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  videoBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  videoBadgeText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1.4,
  },

  // Pipeline
  pipelineWrap: {
    gap: 12,
    marginBottom: 32,
  },
  pipelineCard: {
    padding: 16,
  },
  pipelineCardActive: {
    shadowColor: RECIPES_SECONDARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pipelineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  pipelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pipelineIconDone: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  pipelineIconActive: {
    backgroundColor: 'rgba(201, 137, 77, 0.18)',
  },
  pipelineText: {
    flex: 1,
  },
  pipelineLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: colors.text,
  },
  pipelineLabelActive: {
    color: RECIPES_SECONDARY,
  },
  pipelineDetail: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pipelinePercent: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 12,
    color: RECIPES_SECONDARY,
  },

  // Parsed
  parsedSection: {
    marginBottom: 24,
    gap: 12,
  },
  title: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 30,
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.highest,
  },
  tagText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textSecondary,
  },

  // Ingredients
  ingredientsSection: {
    marginBottom: 28,
    gap: 14,
  },
  sectionLabel: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 1.4,
    color: RECIPES_SECONDARY,
  },
  ingredientList: {
    gap: 10,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 12,
    paddingVertical: 12,
    paddingRight: 16,
    paddingLeft: 14,
    overflow: 'hidden',
  },
  ingredientRowGhost: {
    opacity: 0.5,
  },
  ingredientAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#C9894D',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  ingredientName: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  ingredientWeight: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: '#E6BFA0',
  },
  ingredientGhostText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },

  // Steps
  stepsSection: {
    marginBottom: 24,
    gap: 14,
  },
  stepsList: {
    gap: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepNumber: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 20,
    color: RECIPES_SURFACES.highest,
    width: 28,
  },
  stepNumberPending: {
    color: 'rgba(201, 137, 77, 0.4)',
  },
  stepText: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  stepLoadingBar: {
    flex: 1,
    height: 14,
    borderRadius: 6,
    backgroundColor: RECIPES_SURFACES.highest,
    marginTop: 4,
  },

  spacer: {
    height: 40,
  },

  // CTA
  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  ctaInner: {
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
});
