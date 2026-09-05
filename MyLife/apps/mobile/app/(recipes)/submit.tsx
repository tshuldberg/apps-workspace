import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ChevronLeft, ChevronRight, Search, ShieldCheck } from 'lucide-react-native';
import {
  type CloudDish,
  type Recipe,
  getRecipes,
  searchDishes,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SURFACES,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { EmptyState, LoadingState, Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const TOTAL_STEPS = 5;
const STEP_LABELS = [
  'Pick a Dish',
  'Select Recipe',
  'Add Photos',
  'Set Location',
  'Review',
];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function SubmitScreen() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{ dishId?: string; dishName?: string }>();

  const [step, setStep] = useState(params.dishId ? 1 : 0);
  const [selectedDish, setSelectedDish] = useState<CloudDish | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [chefLocation, setChefLocation] = useState('');
  const [chefOrigin, setChefOrigin] = useState('');

  // Step 0: Dish search
  const [dishQuery, setDishQuery] = useState('');
  const [dishResults, setDishResults] = useState<CloudDish[]>([]);
  const [dishLoading, setDishLoading] = useState(false);

  // Step 1: Local recipes
  const [localRecipes, setLocalRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load local recipes for step 1
  useEffect(() => {
    if (step === 1) {
      setRecipesLoading(true);
      try {
        const recipes = getRecipes(db, { limit: 100 });
        setLocalRecipes(recipes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recipes');
      } finally {
        setRecipesLoading(false);
      }
    }
  }, [step, db]);

  // Search dishes for step 0
  useEffect(() => {
    if (step !== 0) return;
    if (dishQuery.length < 2) {
      setDishResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setDishLoading(true);
      try {
        // status null: RLS scopes visibility, and a proposer must still find
        // their own pending dish here (searchDishes defaults to 'active').
        const result = await searchDishes(dishQuery, { limit: 20, status: null });
        if (result.ok) setDishResults(result.data);
      } catch {
        // Silently fail search
      } finally {
        setDishLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [dishQuery, step]);

  const handleSelectDish = (dish: CloudDish) => {
    setSelectedDish(dish);
    setStep(1);
  };

  const handleSelectRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedDish || !selectedRecipe) return;
    setSubmitting(true);
    setError(null);
    try {
      // publishRecipeToCloud is not yet implemented.
      // For now, show a placeholder success.
      setTimeout(() => {
        setSubmitting(false);
        router.back();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
      setSubmitting(false);
    }
  };

  const canGoBack = step > 0;
  const canGoForward =
    (step === 0 && selectedDish != null) ||
    (step === 1 && selectedRecipe != null) ||
    step === 2 ||
    step === 3 ||
    step === 4;

  return (
    <View style={styles.screen}>
      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((step + 1) / TOTAL_STEPS) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.stepLabel}>
          Step {step + 1} of {TOTAL_STEPS}: {STEP_LABELS[step]}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 0: Pick a Dish */}
        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Which dish are you submitting?</Text>
            <View style={styles.searchBar}>
              <Search size={18} color={colors.textSecondary} strokeWidth={2} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search dishes..."
                placeholderTextColor={colors.textTertiary}
                value={dishQuery}
                onChangeText={setDishQuery}
                autoCapitalize="none"
              />
            </View>
            {dishLoading ? (
              <LoadingState rows={3} />
            ) : dishResults.length > 0 ? (
              <View style={styles.resultList}>
                {dishResults.map((dish) => (
                  <GlassCard
                    key={dish.id}
                    level={2}
                    style={styles.resultCard}
                    onPress={() => handleSelectDish(dish)}
                  >
                    <Text style={styles.resultTitle}>{dish.name}</Text>
                    <Text style={styles.resultMeta}>
                      {dish.cuisine} {'\u00B7'} {capitalize(dish.category)}
                    </Text>
                  </GlassCard>
                ))}
              </View>
            ) : dishQuery.length >= 2 ? (
              <Text style={styles.noResults}>No dishes found for "{dishQuery}"</Text>
            ) : (
              <Text style={styles.hint}>
                Type at least 2 characters to search for a dish
              </Text>
            )}
          </View>
        )}

        {/* Step 1: Select Recipe */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>
              Select a recipe to submit for {selectedDish?.name ?? 'this dish'}
            </Text>
            {recipesLoading ? (
              <LoadingState rows={4} />
            ) : localRecipes.length === 0 ? (
              <EmptyState
                icon="fork.knife"
                title="No local recipes"
                message="Add a recipe first, then submit it"
              />
            ) : (
              <View style={styles.resultList}>
                {localRecipes.map((recipe) => (
                  <GlassCard
                    key={recipe.id}
                    level={2}
                    style={[
                      styles.resultCard,
                      selectedRecipe?.id === recipe.id && styles.resultCardSelected,
                    ]}
                    onPress={() => handleSelectRecipe(recipe)}
                  >
                    <Text style={styles.resultTitle}>{recipe.title}</Text>
                    {recipe.description != null && (
                      <Text style={styles.resultMeta} numberOfLines={1}>
                        {recipe.description}
                      </Text>
                    )}
                  </GlassCard>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Step 2: Photos */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add Photos</Text>

            {/* Verification info banner */}
            <GlassCard level={3} style={styles.verificationBanner}>
              <ShieldCheck size={18} color={RECIPES_ACCENT} strokeWidth={2} />
              <Text style={styles.verificationBannerText}>
                Photos require verification before they appear on your submission
              </Text>
            </GlassCard>

            {/* Photo upload area */}
            <GlassCard level={2} style={styles.photoPlaceholder}>
              <View style={styles.cameraIconWrap}>
                <Camera size={32} color={colors.textSecondary} strokeWidth={1.5} />
              </View>
              <Text style={styles.photoTitle}>Add a photo of your dish</Text>
              <Text style={styles.photoHint}>
                Upload your first photo to start the verification process.
                Photos are checked for AI-generated images and stock photos.
              </Text>
              <Pressable style={styles.photoButton}>
                <Text style={styles.photoButtonText}>Add Photo</Text>
              </Pressable>
            </GlassCard>

            {/* Verification status indicator */}
            <View style={styles.verificationStatusRow}>
              <View style={[styles.verificationDot, styles.verificationDotPending]} />
              <Text style={styles.verificationStatusText}>
                Pending verification
              </Text>
            </View>

            <Text style={styles.photoNote}>
              Real cooking photos earn a verified badge. Verification checks
              for AI-generated images, stock photos, and content from other sources.
            </Text>
          </View>
        )}

        {/* Step 3: Location */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Where are you cooking from?</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CHEF LOCATION</Text>
              <TextInput
                style={styles.textField}
                placeholder="e.g. New York, USA"
                placeholderTextColor={colors.textTertiary}
                value={chefLocation}
                onChangeText={setChefLocation}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CHEF ORIGIN</Text>
              <TextInput
                style={styles.textField}
                placeholder="e.g. Italian, Mexican"
                placeholderTextColor={colors.textTertiary}
                value={chefOrigin}
                onChangeText={setChefOrigin}
              />
            </View>
            <Text style={styles.hint}>
              Origin helps match you with regional rankings.
            </Text>
          </View>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review Your Submission</Text>
            <GlassCard level={2} style={styles.reviewCard}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>DISH</Text>
                <Text style={styles.reviewValue}>{selectedDish?.name ?? 'None'}</Text>
              </View>
              <View style={styles.reviewDivider} />
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>RECIPE</Text>
                <Text style={styles.reviewValue}>{selectedRecipe?.title ?? 'None'}</Text>
              </View>
              <View style={styles.reviewDivider} />
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>LOCATION</Text>
                <Text style={styles.reviewValue}>{chefLocation || 'Not set'}</Text>
              </View>
              <View style={styles.reviewDivider} />
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>ORIGIN</Text>
                <Text style={styles.reviewValue}>{chefOrigin || 'Not set'}</Text>
              </View>
            </GlassCard>

            {error != null && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                (submitting || !selectedDish || !selectedRecipe) && styles.submitButtonDisabled,
                pressed && styles.submitButtonPressed,
              ]}
              onPress={() => void handleSubmit()}
              disabled={submitting || !selectedDish || !selectedRecipe}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Submitting...' : 'Submit Recipe'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Navigation footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
          onPress={() => canGoBack && setStep((s) => s - 1)}
          disabled={!canGoBack}
        >
          <ChevronLeft size={20} color={canGoBack ? colors.text : colors.textTertiary} strokeWidth={2} />
          <Text style={[styles.navButtonText, !canGoBack && styles.navButtonTextDisabled]}>
            Back
          </Text>
        </Pressable>

        {step < TOTAL_STEPS - 1 && (
          <Pressable
            style={[styles.navButton, styles.navButtonForward, !canGoForward && styles.navButtonDisabled]}
            onPress={() => canGoForward && setStep((s) => s + 1)}
            disabled={!canGoForward}
          >
            <Text
              style={[
                styles.navButtonText,
                styles.navButtonTextForward,
                !canGoForward && styles.navButtonTextDisabled,
              ]}
            >
              Next
            </Text>
            <ChevronRight
              size={20}
              color={canGoForward ? '#0E0E13' : colors.textTertiary}
              strokeWidth={2}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  progressWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: RECIPES_SURFACES.focus,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: RECIPES_ACCENT,
  },
  stepLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: RECIPES_ACCENT,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
  },
  stepContent: {
    gap: 16,
  },
  stepTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    color: colors.text,
    letterSpacing: -0.3,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },

  // Results
  resultList: {
    gap: 8,
  },
  resultCard: {
    gap: 4,
  },
  resultCardSelected: {
    borderWidth: 1,
    borderColor: RECIPES_ACCENT,
  },
  resultTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: colors.text,
  },
  resultMeta: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  noResults: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  hint: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Verification
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  verificationBannerText: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  verificationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  verificationDotPending: {
    backgroundColor: '#F59E0B',
  },
  verificationStatusText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  cameraIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: RECIPES_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Photos
  photoPlaceholder: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 28,
  },
  photoTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 17,
    color: colors.text,
  },
  photoHint: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  photoButton: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  photoButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  photoNote: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textTertiary,
  },

  // Location fields
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: 'rgba(214, 195, 181, 0.5)',
  },
  textField: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: colors.text,
  },

  // Review
  reviewCard: {
    gap: 0,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  reviewLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(214, 195, 181, 0.5)',
  },
  reviewValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  errorText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: RECIPES_ACCENT,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: '#0E0E13',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 36,
    backgroundColor: RECIPES_SURFACES.base,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: RECIPES_SURFACES.lift,
  },
  navButtonForward: {
    backgroundColor: RECIPES_ACCENT,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  navButtonTextForward: {
    color: '#0E0E13',
  },
  navButtonTextDisabled: {
    color: colors.textTertiary,
  },
});
