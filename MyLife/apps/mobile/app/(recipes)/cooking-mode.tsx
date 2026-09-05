import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Timer,
  X,
} from 'lucide-react-native';
import {
  detectStepTimerMinutes,
  formatQuantity,
  getRecipeById,
  getStructuredIngredients,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  type Recipe,
  type Step,
  type StructuredIngredient,
} from '@mylife/bestchef';
import type { DatabaseAdapter } from '@mylife/db';
import { EmptyState, LoadingState, Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = RECIPES_ACCENT;
const GOLD = RECIPES_SECONDARY;

function getSteps(db: DatabaseAdapter, recipeId: string): Step[] {
  return db.query<Step>(
    `SELECT id, recipe_id, step_number, instruction, timer_minutes, sort_order
     FROM rc_steps
     WHERE recipe_id = ?
     ORDER BY sort_order ASC, step_number ASC`,
    [recipeId],
  );
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ingredientLabel(ing: StructuredIngredient): string {
  const qty = formatQuantity(ing.quantity_value);
  const parts: string[] = [];
  if (qty != null && qty.length > 0) parts.push(qty);
  else if (ing.quantity != null && ing.quantity.length > 0) parts.push(ing.quantity);
  if (ing.unit != null && ing.unit.length > 0) parts.push(ing.unit);
  parts.push(ing.item || ing.name);
  return parts.join(' ');
}

/**
 * Match an ingredient to the current step by checking if its item name
 * (or significant words) appear in the step instruction.
 */
function ingredientsForStep(
  ingredients: StructuredIngredient[],
  step: Step | undefined,
): StructuredIngredient[] {
  if (step == null) return [];
  const text = step.instruction.toLowerCase();
  return ingredients.filter((ing) => {
    const target = (ing.item || ing.name || '').toLowerCase().trim();
    if (target.length === 0) return false;
    // Match on full ingredient name
    if (text.includes(target)) return true;
    // Match on significant words (>3 chars) of the ingredient name
    const words = target.split(/\s+/).filter((w) => w.length > 3);
    return words.some((w) => text.includes(w));
  });
}

export default function CookingModeScreen() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const router = useRouter();
  const db = useDatabase();

  // Note: expo-keep-awake should be wired here once added to apps/mobile deps.
  // For now we rely on the device's natural sleep timer.

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [ingredients, setIngredients] = useState<StructuredIngredient[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedTimerRef = useRef<boolean>(false);

  useEffect(() => {
    if (!recipeId) return;
    setRecipe(getRecipeById(db, recipeId));
    setSteps(getSteps(db, recipeId));
    setIngredients(getStructuredIngredients(db, recipeId));
    setLoading(false);
  }, [db, recipeId]);

  // Timer tick
  useEffect(() => {
    if (timerRunning && timerSeconds !== null && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev === null || prev <= 1) {
            setTimerRunning(false);
            if (!completedTimerRef.current) {
              completedTimerRef.current = true;
              Vibration.vibrate([0, 500, 200, 500]);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timerRunning, timerSeconds]);

  const step = steps[currentStep];
  const totalSteps = steps.length;
  const progressPct = totalSteps > 0 ? Math.round(((currentStep + 1) / totalSteps) * 100) : 0;

  const stepTimerMinutes = step
    ? step.timer_minutes ?? detectStepTimerMinutes(step.instruction)
    : null;

  const stepIngredients = useMemo(
    () => ingredientsForStep(ingredients, step),
    [ingredients, step],
  );

  const goNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((p) => p + 1);
      resetTimer();
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep((p) => p - 1);
      resetTimer();
    }
  };

  const initTimerIfNeeded = () => {
    if (timerSeconds === null && stepTimerMinutes != null) {
      setTimerSeconds(stepTimerMinutes * 60);
      completedTimerRef.current = false;
    }
  };

  const toggleTimer = () => {
    initTimerIfNeeded();
    if (timerSeconds === 0) {
      // Restart finished timer
      if (stepTimerMinutes != null) {
        setTimerSeconds(stepTimerMinutes * 60);
        completedTimerRef.current = false;
        setTimerRunning(true);
      }
      return;
    }
    setTimerRunning((r) => !r);
  };

  const resetTimer = () => {
    setTimerSeconds(null);
    setTimerRunning(false);
    completedTimerRef.current = false;
  };

  const toggleIngredientCheck = (id: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Swipe-to-navigate gesture
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gs) =>
        Math.abs(gs.dx) > 30 && Math.abs(gs.dy) < 60,
      onPanResponderRelease: (_evt, gs) => {
        if (gs.dx < -60) goNext();
        else if (gs.dx > 60) goPrev();
      },
    }),
  ).current;

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState rows={3} />
      </View>
    );
  }

  if (!recipe || steps.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="🍳"
          title={!recipe ? 'Recipe not found' : 'No steps to cook'}
          message={
            !recipe
              ? 'This recipe may have been deleted'
              : 'Add cooking steps to use cooking mode'
          }
          actionLabel="Go Back"
          onAction={() => router.back()}
          accentColor={ACCENT}
        />
      </View>
    );
  }

  const displayedTimerSeconds =
    timerSeconds !== null
      ? timerSeconds
      : stepTimerMinutes != null
        ? stepTimerMinutes * 60
        : null;
  const timerDone = timerSeconds === 0;

  return (
    <View style={styles.screen} {...panResponder.panHandlers}>
      {/* Top Floating Bar */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.iconButton}
            accessibilityLabel="Exit cooking mode"
          >
            <X size={20} color={colors.text} strokeWidth={1.6} />
          </Pressable>
          <View style={styles.divider} />
          <Text style={styles.topTitle}>Cooking Mode</Text>
        </View>
        <View style={styles.voicePill}>
          <Mic size={12} color={GOLD} strokeWidth={2.2} />
          <Text style={styles.voicePillText}>VOICE ACTIVE</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Indicator */}
        <View style={styles.progressBlock}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressLabel}>CURRENT PROGRESS</Text>
              <Text style={styles.progressTitle}>
                Step {currentStep + 1}{' '}
                <Text style={styles.progressTitleMuted}>of {totalSteps}</Text>
              </Text>
            </View>
            <View style={styles.progressPctPill}>
              <Text style={styles.progressPctText}>{progressPct}% COMPLETE</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progressPct}%` }]}
            />
          </View>
        </View>

        {/* Instruction Hero Card */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionLabel}>INSTRUCTION</Text>
          <Text style={styles.instructionText}>{step.instruction}</Text>

          {stepTimerMinutes != null && displayedTimerSeconds != null ? (
            <View style={styles.timerRow}>
              <Pressable
                onPress={toggleTimer}
                style={[
                  styles.timerPill,
                  timerDone && styles.timerPillDone,
                ]}
                accessibilityLabel="Toggle timer"
              >
                <Timer size={22} color="#1a1008" strokeWidth={2.2} />
                <Text style={styles.timerPillText}>
                  {timerDone ? 'Done!' : formatTimer(displayedTimerSeconds)}
                </Text>
              </Pressable>
              <Pressable
                onPress={toggleTimer}
                style={styles.timerCircle}
                accessibilityLabel={timerRunning ? 'Pause timer' : 'Start timer'}
              >
                {timerRunning ? (
                  <Pause size={22} color={colors.text} strokeWidth={2} />
                ) : (
                  <Play size={22} color={colors.text} strokeWidth={2} />
                )}
              </Pressable>
              {timerSeconds !== null ? (
                <Pressable
                  onPress={resetTimer}
                  style={styles.timerCircle}
                  accessibilityLabel="Reset timer"
                >
                  <RotateCcw size={20} color={colors.text} strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Step Ingredients */}
        <View style={styles.ingredientsCard}>
          <Text style={styles.sectionLabel}>STEP INGREDIENTS</Text>
          {stepIngredients.length === 0 ? (
            <View style={styles.waitBox}>
              <Text style={styles.waitText}>No specific ingredients for this step</Text>
            </View>
          ) : (
            <View style={styles.ingredientList}>
              {stepIngredients.map((ing) => {
                const checked = checkedIngredients.has(ing.id);
                return (
                  <Pressable
                    key={ing.id}
                    style={[
                      styles.ingredientRow,
                      checked && styles.ingredientRowChecked,
                    ]}
                    onPress={() => toggleIngredientCheck(ing.id)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        checked && styles.checkboxChecked,
                      ]}
                    >
                      {checked ? (
                        <Check size={16} color="#1a1008" strokeWidth={3} />
                      ) : null}
                    </View>
                    <Text style={styles.ingredientText}>{ingredientLabel(ing)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Visual Guide Image */}
        {recipe.image_uri ? (
          <View style={styles.visualCard}>
            <Image
              source={{ uri: recipe.image_uri }}
              style={styles.visualImage}
              resizeMode="cover"
            />
            <View style={styles.visualOverlay} />
            <View style={styles.visualBadge}>
              <Text style={styles.visualBadgeText}>VISUAL GUIDE</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom Floating Nav Bar */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={goPrev}
          disabled={currentStep === 0}
          style={[
            styles.prevButton,
            currentStep === 0 && styles.prevButtonDisabled,
          ]}
          accessibilityLabel="Previous step"
        >
          <ArrowLeft
            size={18}
            color={currentStep === 0 ? 'rgba(228,225,233,0.3)' : colors.text}
            strokeWidth={2}
          />
          <Text
            style={[
              styles.prevButtonText,
              currentStep === 0 && styles.prevButtonTextDisabled,
            ]}
          >
            Previous{'\n'}Step
          </Text>
        </Pressable>

        <View style={styles.listeningWrap}>
          <View style={styles.micButton}>
            <Mic size={18} color={GOLD} strokeWidth={2.2} />
          </View>
          <Text style={styles.listeningText}>LISTENING</Text>
        </View>

        {currentStep < totalSteps - 1 ? (
          <Pressable
            onPress={goNext}
            style={styles.nextButton}
            accessibilityLabel="Next step"
          >
            <Text style={styles.nextButtonText}>Next{'\n'}Step</Text>
            <ArrowRight size={18} color="#131318" strokeWidth={2.4} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.back()}
            style={styles.nextButton}
            accessibilityLabel="Finish cooking"
          >
            <Text style={styles.nextButtonText}>Finish</Text>
            <Check size={18} color="#131318" strokeWidth={2.4} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const TOP_BAR_HEIGHT = 96;
const BOTTOM_BAR_HEIGHT = 120;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ---- Top Bar ----
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    height: TOP_BAR_HEIGHT,
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(19,19,24,0.85)',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(159,142,129,0.3)',
  },
  topTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.4,
  },
  voicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(201,137,77,0.12)',
  },
  voicePillText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    color: GOLD,
    letterSpacing: 1,
  },

  // ---- Scroll content ----
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: TOP_BAR_HEIGHT + 8,
    paddingBottom: BOTTOM_BAR_HEIGHT + 24,
    paddingHorizontal: 20,
    gap: 20,
  },

  // ---- Progress block ----
  progressBlock: {
    marginBottom: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  progressLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    color: 'rgba(228,225,233,0.5)',
    letterSpacing: 2,
    marginBottom: 4,
  },
  progressTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 28,
    color: colors.text,
    letterSpacing: -0.6,
  },
  progressTitleMuted: {
    fontFamily: JAKARTA_FONTS.regular,
    color: 'rgba(228,225,233,0.3)',
  },
  progressPctPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(201,137,77,0.12)',
  },
  progressPctText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    color: GOLD,
    letterSpacing: 0.4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: RECIPES_SURFACES.focus,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: GOLD,
    borderRadius: 3,
  },

  // ---- Instruction hero card ----
  instructionCard: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 24,
    padding: 28,
  },
  instructionLabel: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 10,
    color: GOLD,
    letterSpacing: 2,
    marginBottom: 16,
  },
  instructionText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.text,
    letterSpacing: -0.6,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 28,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  timerPillDone: {
    backgroundColor: '#30D158',
  },
  timerPillText: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 24,
    color: '#1a1008',
    letterSpacing: -0.6,
  },
  timerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // ---- Ingredients card ----
  ingredientsCard: {
    backgroundColor: RECIPES_SURFACES.focus,
    borderRadius: 24,
    padding: 20,
  },
  sectionLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    color: 'rgba(228,225,233,0.5)',
    letterSpacing: 2,
    marginBottom: 16,
  },
  ingredientList: {
    gap: 10,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(53,52,58,0.5)',
  },
  ingredientRowChecked: {
    backgroundColor: 'rgba(201,137,77,0.10)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  checkboxChecked: {
    backgroundColor: GOLD,
  },
  ingredientText: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 16,
    color: colors.text,
  },
  waitBox: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(53,52,58,0.3)',
  },
  waitText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: 'rgba(228,225,233,0.4)',
  },

  // ---- Visual guide ----
  visualCard: {
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: RECIPES_SURFACES.focus,
  },
  visualImage: {
    width: '100%',
    height: '100%',
  },
  visualOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(19,19,24,0.35)',
  },
  visualBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  visualBadgeText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  // ---- Bottom Bar ----
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    height: BOTTOM_BAR_HEIGHT,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(19,19,24,0.92)',
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  prevButtonDisabled: {
    opacity: 0.5,
  },
  prevButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: 'rgba(228,225,233,0.6)',
    letterSpacing: -0.2,
    lineHeight: 16,
  },
  prevButtonTextDisabled: {
    color: 'rgba(228,225,233,0.3)',
  },
  listeningWrap: {
    alignItems: 'center',
    gap: 6,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RECIPES_SURFACES.focus,
  },
  listeningText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 9,
    color: GOLD,
    letterSpacing: 1.5,
    opacity: 0.7,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  nextButtonText: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 13,
    color: '#131318',
    letterSpacing: -0.2,
    lineHeight: 16,
  },
});
