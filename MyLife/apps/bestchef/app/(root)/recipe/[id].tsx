import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  BookOpen,
  GitFork,
  Flag,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBasket,
  Share2,
} from 'lucide-react-native';
import {
  deleteVoteWithProof,
  initBestChefClient,
  JAKARTA_FONTS,
  listPendingSubmissions,
  retryPendingSubmission,
} from '@mylife/bestchef';
import { Card } from '@mylife/bestchef/ui';
import { RecipeHero } from '../components/recipe/RecipeHero';
import { RecipeFloatingBar } from '../components/recipe/RecipeFloatingBar';
import { RecipeChefRow } from '../components/recipe/RecipeChefRow';
import { RecipeStatsRow } from '../components/recipe/RecipeStatsRow';
import { RecipeActionPills } from '../components/recipe/RecipeActionPills';
import { RecipeStorySection } from '../components/recipe/RecipeStorySection';
import { RecipeIngredientsSection } from '../components/recipe/RecipeIngredientsSection';
import { RecipeStepsSection } from '../components/recipe/RecipeStepsSection';
import { RecipeVideoSection, type RecipeVideoItem } from '../components/recipe/RecipeVideoSection';
import { CommunityVerdictSection } from '../components/recipe/CommunityVerdictSection';
import { RecipeVoteFooter } from '../components/recipe/RecipeVoteFooter';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import {
  DEMO_SUBMISSIONS,
  getDemoCommentsForSubmission,
  type DemoSubmission,
  type DemoComment,
} from '../data/demo';
import { DEMO_VIDEOS, getVideoLikeCountForSubmission } from '../data/demo-videos';
import { useDatabase } from '../providers/DatabaseProvider';
import { getAllLocalSubmissions, getVote, addLocalComment, getLocalComments } from '../data/local-submissions';
import { useI18n } from '../i18n/I18nProvider';
import { ReportMenu } from '../components/ReportMenu';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { HealthSummary } from '../components/HealthSummary';
import { NutritionPanel } from '../components/NutritionPanel';
import { CookProofGallery } from '../components/CookProofGallery';
import {
  addCloudCommentViewModel,
  getCloudCommentViewModels,
} from '../data/cloud-comments';
import {
  ensureCloudSubmissionForAppId,
  getCloudSubmissionViewModel,
  isCloudSubmissionId,
} from '../data/cloud-submissions';
import {
  buildOptimisticSubmissionLikeState,
  getCachedSubmissionLikeState,
  getSubmissionLikeViewerId,
  setSubmissionLikeDesired,
  syncSubmissionLikeState,
} from '../data/feed-likes';
import { getSubmissionCookProofGallery, type CookProofViewModel } from '../data/cloud-vote-proofs';
import {
  addIngredientAvailabilityRowsToGroceryList,
  ensureShoppingList,
  getCommunityRecipeSaveState,
  getGroceryListBundle,
  getIngredientListAvailability,
  getSubmissionRecipeNutrition,
  removeCommunityRecipeFromKitchen,
  saveCommunityRecipeToKitchen,
  type CommunityRecipeSaveState,
  type GroceryListBundle,
  type IngredientAvailabilityRow,
} from '../data/kitchen';
import { shouldShowDemoContent } from '../data/public-render-policy';
import {
  getRecipeIngredientsForDisplay,
  getRecipeStepsForDisplay,
} from '../data/recipe-display-content';

function sanitizeShareTitle(raw: string): string {
  // Strip control characters and collapse whitespace. Cap at 120 chars.
  const cleaned = raw
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 120 ? cleaned.slice(0, 120) : cleaned;
}

function buildShareMessage(title: string, url: string): string {
  const safeTitle = sanitizeShareTitle(title);
  return `Check out "${safeTitle}" on BestChef!\n${url}`;
}

function availabilityStatusLabel(status: IngredientAvailabilityRow['status']): string {
  switch (status) {
    case 'in-pantry':
      return 'In pantry';
    case 'low':
      return 'Low';
    case 'expired':
      return 'Expired';
    case 'missing':
      return 'Missing';
  }
}

function submissionLikeFallbackCount(
  submission: DemoSubmission | null,
  routeSubmissionId: string | null | undefined,
): number {
  if (typeof submission?.likeCount === 'number') return submission.likeCount;
  const linkedVideoCount = shouldShowDemoContent()
    ? getVideoLikeCountForSubmission(routeSubmissionId ?? submission?.id ?? '')
    : null;
  return linkedVideoCount ?? 0;
}

const EMPTY_SAVE_STATE: CommunityRecipeSaveState = {
  isSaved: false,
  recipeId: null,
  sourceSubmissionId: null,
  recipe: null,
};

export default function RecipeDetailScreen() {
  const { id, proofId } = useLocalSearchParams<{ id: string; proofId?: string }>();
  const router = useRouter();
  const tc = useThemeColors();
  const theme = useTheme();
  const db = useDatabase();
  const cloud = useBestChefCloud();
  const { t, formatNumber } = useI18n();
  const likeTargetId = id ?? '';
  const viewerId = useMemo(
    () => getSubmissionLikeViewerId(db, cloud.profile),
    [cloud.profile, db],
  );
  const [submission, setSubmission] = useState<DemoSubmission | null>(null);
  const [comments, setComments] = useState<DemoComment[]>([]);
  const [selectedVote, setSelectedVote] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [showAllComments] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [openIngredientNutritionId, setOpenIngredientNutritionId] = useState<string | null>(null);
  const [cloudSubmissionId, setCloudSubmissionId] = useState<string | null>(null);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [cookProofs, setCookProofs] = useState<CookProofViewModel[]>([]);
  const [cookProofTotal, setCookProofTotal] = useState(0);
  const [proofsLoading, setProofsLoading] = useState(false);
  const [showAllCookProofs, setShowAllCookProofs] = useState(false);
  const [deletingProofId, setDeletingProofId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<GroceryListBundle>(() => getGroceryListBundle(db));
  const [showMissingListPicker, setShowMissingListPicker] = useState(false);
  const [saveState, setSaveState] = useState<CommunityRecipeSaveState>(EMPTY_SAVE_STATE);
  const [likeState, setLikeState] = useState(() => getCachedSubmissionLikeState(db, {
    localTargetId: likeTargetId,
    viewerId,
    fallbackCount: 0,
  }));
  const likeRequestRef = useRef(0);
  const [pendingSync, setPendingSync] = useState<boolean>(false);
  const [pendingSyncRetrying, setPendingSyncRetrying] = useState(false);

  // B-005: detect pending-sync state for this submission id.
  useEffect(() => {
    if (!id) return;
    try {
      const pending = listPendingSubmissions(db);
      setPendingSync(pending.some((row) => row.localId === id));
    } catch {
      setPendingSync(false);
    }
  }, [db, id]);

  const handlePendingSyncRetry = useCallback(async () => {
    if (!id || pendingSyncRetrying) return;
    setPendingSyncRetrying(true);
    try {
      const result = await retryPendingSubmission(cloud.supabase ?? null, db, id);
      if (result.ok) {
        setPendingSync(false);
        if (result.cloudSubmissionId) {
          router.replace(`/recipe/${result.cloudSubmissionId}`);
        }
      } else {
        Alert.alert(t('submit_submission_failed'), result.error ?? '');
      }
    } finally {
      setPendingSyncRetrying(false);
    }
  }, [cloud.supabase, db, id, pendingSyncRetrying, router, t]);

  useEffect(() => {
    let cancelled = false;
    setBundle(getGroceryListBundle(db));
    const routeId = id ?? '';
    const routeIsCloudSubmission = isCloudSubmissionId(routeId);
    const showDemo = shouldShowDemoContent();
    const demoSub = showDemo ? DEMO_SUBMISSIONS.find((s) => s.id === routeId) : null;
    const allLocal = getAllLocalSubmissions(db);
    const localSub = allLocal.find((s) => s.id === routeId);
    const localSubmission = demoSub ?? localSub ?? null;
    setSubmission(localSubmission);
    const demoComments = showDemo ? getDemoCommentsForSubmission(routeId) : [];
    const localComments = getLocalComments(db, routeId);
    const visibleComments = [...localComments, ...demoComments];
    setComments(visibleComments);
    setCloudSubmissionId(routeIsCloudSubmission ? routeId : null);

    const canLoadDirectCloudSubmission = routeIsCloudSubmission && cloud.supabase !== null;
    const canResolveAliasSubmission = !routeIsCloudSubmission && cloud.isReady && cloud.profile !== null;
    setSubmissionLoading((canLoadDirectCloudSubmission || canResolveAliasSubmission) && !localSubmission);

    if (canLoadDirectCloudSubmission || canResolveAliasSubmission) {
      void (async () => {
        const resolvedCloudSubmissionId = routeIsCloudSubmission
          ? routeId
          : cloud.profile
            ? await ensureCloudSubmissionForAppId(db, cloud.profile, routeId)
            : null;

        if (!cancelled) setCloudSubmissionId(resolvedCloudSubmissionId);
        if (!resolvedCloudSubmissionId) return { cloudSubmission: null, cloudComments: [] };
        if (cloud.supabase) initBestChefClient(cloud.supabase);

        const [cloudSubmission, cloudComments] = await Promise.all([
          getCloudSubmissionViewModel(resolvedCloudSubmissionId, cloud.profile),
          getCloudCommentViewModels(resolvedCloudSubmissionId, cloud.profile),
        ]);
        return { cloudSubmission, cloudComments };
      })()
        .then(({ cloudSubmission, cloudComments }) => {
          if (cancelled) return;
          if (cloudSubmission) setSubmission(cloudSubmission);
          setComments([...cloudComments, ...visibleComments]);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSubmissionLoading(false);
        });
    } else {
      setSubmissionLoading(false);
    }
    const savedVote = getVote(db, routeId);
    if (savedVote !== null) setSelectedVote(savedVote);
    return () => {
      cancelled = true;
    };
  }, [cloud.isReady, cloud.profile, cloud.supabase, id, db]);

  useEffect(() => {
    setShowAllCookProofs(false);
    setShowMissingListPicker(false);
  }, [id]);

  const likeFallbackCount = useMemo(
    () => submissionLikeFallbackCount(submission, id),
    [id, submission],
  );

  useEffect(() => {
    if (!likeTargetId) return;
    setLikeState(getCachedSubmissionLikeState(db, {
      localTargetId: likeTargetId,
      viewerId,
      fallbackCount: likeFallbackCount,
      cloudSubmissionId,
    }));
  }, [cloudSubmissionId, db, likeFallbackCount, likeTargetId, viewerId]);

  useEffect(() => {
    let cancelled = false;
    if (!likeTargetId) return () => {
      cancelled = true;
    };

    void syncSubmissionLikeState(db, {
      localTargetId: likeTargetId,
      viewerId,
      fallbackCount: likeFallbackCount,
      cloudSubmissionId,
    }, { supabase: cloud.supabase })
      .then((state) => {
        if (!cancelled) setLikeState(state);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [cloud.supabase, cloudSubmissionId, db, likeFallbackCount, likeTargetId, viewerId]);

  const saveSubmissionId = submission?.id ?? id;
  const refreshSaveState = useCallback(() => {
    if (!saveSubmissionId) {
      setSaveState(EMPTY_SAVE_STATE);
      return;
    }

    const activeState = getCommunityRecipeSaveState(db, saveSubmissionId);
    if (activeState.isSaved || !id || id === saveSubmissionId) {
      setSaveState(activeState);
      return;
    }

    setSaveState(getCommunityRecipeSaveState(db, id));
  }, [db, id, saveSubmissionId]);

  useFocusEffect(refreshSaveState);

  useEffect(() => {
    let cancelled = false;
    if (!cloud.supabase || !cloudSubmissionId) {
      setCookProofs([]);
      setCookProofTotal(0);
      setProofsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setProofsLoading(true);
    void getSubmissionCookProofGallery(cloud.supabase, cloudSubmissionId, {
      limit: 12,
      includeAll: showAllCookProofs,
      focusedProofId: proofId ?? null,
    })
      .then((result) => {
        if (!cancelled) {
          setCookProofs(result.proofs);
          setCookProofTotal(result.totalCount);
        }
      })
      .finally(() => {
        if (!cancelled) setProofsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cloud.supabase, cloudSubmissionId, proofId, showAllCookProofs]);

  const showDemoContent = shouldShowDemoContent();
  const visibleComments = showAllComments ? comments : comments.slice(0, 3);
  const providedIngredients = useMemo(() => {
    return submission ? [...submission.ingredients] : [];
  }, [submission]);
  const providedSteps = useMemo(() => {
    return submission?.steps ? [...submission.steps] : [];
  }, [submission]);
  const displayIngredients = useMemo(() => {
    return getRecipeIngredientsForDisplay(providedIngredients, showDemoContent);
  }, [providedIngredients, showDemoContent]);
  const displaySteps = useMemo(() => {
    return getRecipeStepsForDisplay(providedSteps, showDemoContent);
  }, [providedSteps, showDemoContent]);
  const demoVideo = useMemo<(RecipeVideoItem & { id: string }) | null>(() => {
    if (!submission || !showDemoContent) return null;
    const found = DEMO_VIDEOS.find((v) => v.submissionId === submission.id);
    if (!found) return null;
    return {
      id: found.id,
      videoUrl: found.videoUrl,
      duration: found.duration,
      dishName: found.dishName,
      cuisine: found.cuisine,
      photoUrl: submission.photoUrl ?? null,
    };
  }, [showDemoContent, submission]);

  const nutritionBundle = useMemo(() => {
    if (!submission || providedIngredients.length === 0) return null;
    return getSubmissionRecipeNutrition(db, {
      submissionId: submission.id,
      title: submission.title,
      ingredients: providedIngredients,
    });
  }, [db, providedIngredients, submission]);
  const availabilityBundle = useMemo(() => {
    if (!submission || providedIngredients.length === 0) return null;
    return getIngredientListAvailability(db, {
      submissionId: submission.id,
      title: submission.title,
      ingredients: providedIngredients,
    });
  }, [db, providedIngredients, submission]);
  const activeLists = bundle.lists.filter((list) => list.is_active === 1);
  const getAvailabilityBadgeColors = (status: IngredientAvailabilityRow['status']) => {
    switch (status) {
      case 'in-pantry':
        return { color: tc.accent, backgroundColor: `${tc.accent}1F`, borderColor: `${tc.accent}55` };
      case 'low':
        return { color: tc.primaryContainer, backgroundColor: `${tc.primaryContainer}24`, borderColor: `${tc.primaryContainer}55` };
      case 'expired':
        return { color: tc.danger, backgroundColor: `${tc.danger}1F`, borderColor: `${tc.danger}55` };
      case 'missing':
        return { color: tc.textTertiary, backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder };
    }
  };

  const handleAddMissingToList = (listId?: string) => {
    if (!availabilityBundle || availabilityBundle.shoppingNeededCount === 0) return;
    const list = listId ? bundle.lists.find((item) => item.id === listId) : ensureShoppingList(db);
    if (!list) return;
    const count = addIngredientAvailabilityRowsToGroceryList(db, list.id, availabilityBundle.rows);
    setShowMissingListPicker(false);
    setBundle(getGroceryListBundle(db, list.id));
    Alert.alert(t('Added to grocery list'), t('{count} missing ingredients were added to {listName}.', {
      count,
      listName: list.name,
    }));
  };

  const handleSaveToKitchen = () => {
    if (!submission) return;
    if (saveState.isSaved) {
      Alert.alert(
        t('Remove saved recipe?'),
        t('This removes the local Kitchen copy. The public submission stays unchanged.'),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Remove'),
            style: 'destructive',
            onPress: () => {
              removeCommunityRecipeFromKitchen(db, saveState.sourceSubmissionId ?? submission.id);
              refreshSaveState();
            },
          },
        ],
      );
      return;
    }

    const saved = saveCommunityRecipeToKitchen(db, {
      submissionId: submission.id,
      title: submission.title,
      description: submission.description,
      ingredients: providedIngredients,
      steps: providedSteps,
      photoUrl: submission.photoUrl ?? null,
      chefId: submission.chefId,
      chefName: submission.chefName,
      chefHandle: submission.chefHandle,
    });
    setSaveState(saved);
    Alert.alert(t('Saved to Kitchen'), t('{recipeTitle} is now in your saved recipes.', {
      recipeTitle: submission.title,
    }));
  };

  const openSavedRecipe = () => {
    if (!saveState.recipeId) return;
    router.push(`/saved-recipe/${saveState.recipeId}`);
  };

  const handleLikePress = () => {
    if (!likeTargetId) return;
    const nextLiked = !likeState.liked;
    const optimistic = buildOptimisticSubmissionLikeState(likeState, nextLiked, cloudSubmissionId);
    const requestId = likeRequestRef.current + 1;
    likeRequestRef.current = requestId;
    setLikeState(optimistic);

    void setSubmissionLikeDesired(db, {
      localTargetId: likeTargetId,
      viewerId,
      fallbackCount: likeFallbackCount,
      cloudSubmissionId,
    }, nextLiked, { supabase: cloud.supabase })
      .then((state) => {
        if (likeRequestRef.current === requestId) setLikeState(state);
      })
      .catch(() => {
        if (likeRequestRef.current === requestId) setLikeState(optimistic);
      });
  };

  const deleteCookProof = async (proof: CookProofViewModel) => {
    if (!cloud.supabase || deletingProofId) return;
    setDeletingProofId(proof.id);
    const result = await deleteVoteWithProof({
      submissionId: proof.submissionId,
      supabase: cloud.supabase,
    });
    setDeletingProofId(null);

    if (result.ok) {
      setCookProofs((current) => current.filter((item) => item.id !== proof.id));
      setCookProofTotal((current) => Math.max(0, current - 1));
      setSelectedVote(null);
      return;
    }

    Alert.alert(t('Delete failed'), t(result.message));
  };

  const confirmDeleteCookProof = (proof: CookProofViewModel) => {
    Alert.alert(
      t('Delete CookProof vote'),
      t('This removes your vote and proof photo from public BestChef surfaces.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () => void deleteCookProof(proof),
        },
      ],
    );
  };

  if (!submission) {
    return (
      <View style={[styles.screen, { backgroundColor: tc.background }]}>
        <RecipeFloatingBar
          onShare={() => {}}
          onSaveToggle={() => {}}
          isSaved={false}
        />
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: tc.text }]}>
            {submissionLoading ? t('Loading recipe...') : t('Recipe not found')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      {/* Floating bar absolutely positioned over the hero */}
      <RecipeFloatingBar
        onShare={() => {
          Share.share({
            message: buildShareMessage(
              submission.title,
              `https://bestchef.app/recipe/${submission.id}`,
            ),
          }).catch(() => {});
        }}
        onSaveToggle={handleSaveToKitchen}
        isSaved={saveState.isSaved}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Full-bleed hero */}
        <RecipeHero submission={submission} rank={submission.rank > 0 ? submission.rank : undefined} />

        <View style={styles.content}>
          {/* B-005: pending-sync pill */}
          {pendingSync ? (
            <Pressable
              onPress={() => { void handlePendingSyncRetry(); }}
              style={({ pressed }) => [
                styles.pendingPill,
                { backgroundColor: `${tc.primaryContainer}1F`, borderColor: tc.primaryContainer },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('submit_resync_recipe')}
            >
              <Text style={[styles.pendingPillLabel, { color: tc.primaryContainer }]}>
                {t('submit_pending_sync')}
              </Text>
              <Text style={[styles.pendingPillAction, { color: tc.accent }]}>
                {pendingSyncRetrying ? '…' : t('submit_retry_now')}
              </Text>
            </Pressable>
          ) : null}

          {/* Chef row */}
          <RecipeChefRow
            chefId={submission.chefId}
            displayName={submission.chefName}
            isRestaurant={false}
            region={submission.tags.find((t) => t.startsWith('cuisine:'))?.replace('cuisine:', '') ?? ''}
          />

          {/* Stats row */}
          <RecipeStatsRow />

          {/* Action pills */}
          <RecipeActionPills
            submissionId={submission.id}
            ingredients={providedIngredients}
          />

          {/* Open saved recipe shortcut (kept from original flow) */}
          {saveState.recipeId ? (
            <Pressable
              style={({ pressed }) => [
                styles.openSavedButton,
                { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
                pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
              ]}
              onPress={openSavedRecipe}
              accessibilityRole="button"
              accessibilityLabel={t('Open saved recipe')}
            >
              <BookOpen size={16} color={tc.accent} strokeWidth={2.2} />
              <Text style={[styles.openSavedText, { color: tc.accent }]}>{t('Open saved recipe')}</Text>
            </Pressable>
          ) : null}

          {/* P5-B: Story section */}
          <Card>
            <RecipeStorySection
              description={submission.description}
              dishName={submission.title}
              cuisine={submission.tags.find((tag) => tag.startsWith('cuisine:'))?.replace('cuisine:', '') ?? ''}
              region={submission.chefHandle}
              reviewedCount={submission.voteScore}
            />
          </Card>

        <CookProofGallery
          proofs={cookProofs}
          loading={proofsLoading}
          totalCount={cookProofTotal}
          expanded={showAllCookProofs}
          highlightProofId={proofId ?? null}
          canDeleteProof={(proof) => proof.profileId === cloud.profile?.id && deletingProofId !== proof.id}
          onPressProof={(proof) => {
            router.push({
              pathname: '/recipe/[id]',
              params: { id: submission.id, proofId: proof.id },
            });
          }}
          onDeleteProof={confirmDeleteCookProof}
          onViewAll={() => setShowAllCookProofs(true)}
        />

        {nutritionBundle ? (
          <HealthSummary
            detail={nutritionBundle.detail}
            onPressDetails={() => setShowNutrition((value) => !value)}
          />
        ) : null}

        {/* P5-B: Ingredients section */}
        <Card>
          {displayIngredients.length > 0 ? (
            <RecipeIngredientsSection ingredients={displayIngredients} />
          ) : (
            <View style={styles.missingRecipeContent}>
              <Text style={[styles.sectionTitle, { color: tc.text }]}>{t('Ingredients')}</Text>
              <Text style={[styles.missingRecipeContentText, { color: tc.textSecondary }]}>
                {t('The chef has not provided ingredients yet.')}
              </Text>
            </View>
          )}
        </Card>

        {nutritionBundle && showNutrition ? (
          <NutritionPanel detail={nutritionBundle.detail} />
        ) : null}

        {/* Pantry availability + per-ingredient nutrition (kept intact) */}
        {(availabilityBundle || nutritionBundle) ? (
          <View style={styles.section}>
            {availabilityBundle ? (
              <View style={styles.availabilityHeader}>
                <Text style={[styles.availabilitySummary, { color: tc.textSecondary }]}>
                  {t('You have {onHand} of {total} ingredients on hand.', {
                    onHand: availabilityBundle.onHandCount,
                    total: availabilityBundle.totalCount,
                  })}
                </Text>
                {availabilityBundle.shoppingNeededCount > 0 ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.missingButton,
                      { backgroundColor: `${tc.accent}1F`, borderColor: tc.accent },
                      pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => setShowMissingListPicker((value) => !value)}
                    accessibilityRole="button"
                    accessibilityLabel={t('Add missing to grocery list')}
                  >
                    <ShoppingBasket size={15} color={tc.accent} strokeWidth={2.2} />
                    <Text style={[styles.missingButtonText, { color: tc.accent }]}>{t('Add missing to grocery list')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {showMissingListPicker && availabilityBundle && availabilityBundle.shoppingNeededCount > 0 ? (
              <View style={styles.listActions}>
                <Text style={[styles.subhead, { color: tc.text }]}>{t('Choose a grocery list')}</Text>
                {activeLists.length > 0 ? activeLists.map((list) => (
                  <Pressable
                    key={list.id}
                    style={[styles.listButton, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
                    onPress={() => handleAddMissingToList(list.id)}
                  >
                    <Text style={[styles.listButtonText, { color: tc.text }]}>{list.name}</Text>
                    <ShoppingBasket size={15} color={tc.accent} strokeWidth={2} />
                  </Pressable>
                )) : (
                  <Pressable
                    style={[styles.listButton, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
                    onPress={() => handleAddMissingToList()}
                  >
                    <Text style={[styles.listButtonText, { color: tc.text }]}>{t('Create Grocery List')}</Text>
                    <ShoppingBasket size={15} color={tc.accent} strokeWidth={2} />
                  </Pressable>
                )}
              </View>
            ) : null}
            {nutritionBundle ? providedIngredients.map((ing, i) => {
              const ingredientDetail = nutritionBundle.ingredientDetails.find((detail) => detail.subjectId.endsWith(`:${i}`));
              const availabilityRow = availabilityBundle?.rows[i] ?? null;
              const badgeColors = availabilityRow ? getAvailabilityBadgeColors(availabilityRow.status) : null;
              const expanded = ingredientDetail ? openIngredientNutritionId === ingredientDetail.subjectId : false;
              return (
                <View key={i} style={styles.ingredientBlock}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.ingredientCollapsedRow,
                      { backgroundColor: theme.glass.cardFill, borderColor: expanded ? tc.accent : theme.glass.cardBorder },
                      pressed && { opacity: 0.86, transform: [{ scale: 0.99 }] },
                    ]}
                    onPress={() => {
                      if (!ingredientDetail) return;
                      setOpenIngredientNutritionId((current) => current === ingredientDetail.subjectId ? null : ingredientDetail.subjectId);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={ingredientDetail
                      ? t('Expand ingredient facts for {ingredient}', { ingredient: ing })
                      : ing}
                  >
                    <Text style={[styles.ingredientText, { color: tc.text }]}>{ing}</Text>
                    {ingredientDetail ? (
                      <View style={[styles.ingredientExpandButton, { backgroundColor: `${tc.accent}1F`, borderColor: `${tc.accent}55` }]}>
                        {expanded ? (
                          <Minus size={16} color={tc.accent} strokeWidth={2.4} />
                        ) : (
                          <Plus size={16} color={tc.accent} strokeWidth={2.4} />
                        )}
                      </View>
                    ) : null}
                  </Pressable>
                  {ingredientDetail && expanded ? (
                    <>
                      {availabilityRow && badgeColors ? (
                        <View style={[styles.availabilityBadge, { backgroundColor: badgeColors.backgroundColor, borderColor: badgeColors.borderColor }]}>
                          <Text style={[styles.availabilityBadgeText, { color: badgeColors.color }]}>
                            {t(availabilityStatusLabel(availabilityRow.status))}
                          </Text>
                        </View>
                      ) : null}
                      {availabilityRow?.note ? (
                        <Text style={[styles.availabilityNote, { color: tc.textTertiary }]}>{t(availabilityRow.note)}</Text>
                      ) : null}
                      <HealthSummary
                        detail={ingredientDetail}
                        compact
                      />
                      <NutritionPanel detail={ingredientDetail} compact />
                    </>
                  ) : null}
                </View>
              );
            }) : null}
          </View>
        ) : null}

        {/* P5-B: Steps section */}
        <Card>
          {displaySteps.length > 0 ? (
            <RecipeStepsSection steps={displaySteps} />
          ) : (
            <View style={styles.missingRecipeContent}>
              <Text style={[styles.sectionTitle, { color: tc.text }]}>{t('Steps')}</Text>
              <Text style={[styles.missingRecipeContentText, { color: tc.textSecondary }]}>
                {t('The chef has not provided steps yet.')}
              </Text>
            </View>
          )}
        </Card>

        {/* P5-B: Video section */}
        <RecipeVideoSection
          video={demoVideo}
          onPress={() => {
            if (!demoVideo) return;
            router.push({
              pathname: '/video/[id]',
              params: { id: demoVideo.id },
            });
          }}
        />

        {/* P5-C: Community Verdict */}
        <Card>
          <CommunityVerdictSection
            submissionId={cloudSubmissionId ?? submission.id}
            upvoteCount={submission.upvoteCount ?? 0}
            downvoteCount={submission.downvoteCount ?? 0}
            reviewedCount={submission.reviewedCount ?? 0}
            supabase={cloud.supabase}
          />
        </Card>

        <View style={styles.actionRow}>
          <Pressable style={[styles.actionButton, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]} onPress={() => router.push({ pathname: '/submit', params: { forkFrom: submission.id } })}>
            <GitFork size={16} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.actionLabel, { color: tc.accent }]}>{t('Remix')}</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
            accessibilityRole="button"
            accessibilityLabel={t('Share')}
            onPress={() => {
              Share.share({
                message: buildShareMessage(
                  submission.title,
                  `https://bestchef.app/recipe/${submission.id}`,
                ),
              }).catch(() => {});
            }}
          >
            <Share2 size={16} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.actionLabel, { color: tc.accent }]}>{t('Share')}</Text>
          </Pressable>
          <ReportMenu
            targetKind="submission"
            targetId={cloudSubmissionId ?? submission.id}
            cloudTargetId={cloudSubmissionId}
            accessibilityLabel={t('Report')}
            style={[styles.actionButton, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
          >
            <View style={styles.reportInner}>
              <Flag size={16} color={tc.danger} strokeWidth={2} />
              <Text style={[styles.actionLabel, { color: tc.danger }]}>{t('Report')}</Text>
            </View>
          </ReportMenu>
        </View>

        <View style={styles.section}>
          <View style={styles.commentHeader}>
            <Text style={[styles.sectionTitle, { color: tc.text }]}>
              {t('Comments')} ({formatNumber(comments.length)})
            </Text>
            {comments.length > 3 && (
              <Pressable onPress={() => router.push(`/comments/${submission.id}`)}>
                <Text style={[styles.viewAll, { color: tc.accent }]}>{t('View All')}</Text>
              </Pressable>
            )}
          </View>
          {visibleComments.map((comment) => (
            <View key={comment.id} style={[styles.commentCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
              <View style={styles.commentTop}>
                <Text style={[styles.commentAuthor, { color: tc.text }]}>{comment.authorName}</Text>
                {comment.type === 'chefs_tip' && (
                  <View style={[styles.tipBadge, { backgroundColor: `${tc.primaryContainer}33` }]}><Text style={[styles.tipBadgeText, { color: tc.primaryContainer }]}>{t("CHEF'S TIP")}</Text></View>
                )}
                {comment.type === 'tried_this' && (
                  <View style={[styles.triedBadge, { backgroundColor: `${tc.accent}1F` }]}><Text style={[styles.triedBadgeText, { color: tc.accent }]}>{t('TRIED THIS')}</Text></View>
                )}
              </View>
              <Text style={[styles.commentText, { color: tc.textSecondary }]}>{comment.text}</Text>
              <Text style={[styles.commentHelpful, { color: tc.textTertiary }]}>
                {t('{count} found helpful', { count: formatNumber(comment.helpfulCount) })}
              </Text>
            </View>
          ))}

          <View style={[styles.addCommentBox, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <TextInput
              style={[styles.commentInput, { color: tc.text }]}
              placeholder={t('Add a comment...')}
              placeholderTextColor={tc.textTertiary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <Pressable
              style={[styles.sendButton, { backgroundColor: tc.accent }, !commentText.trim() && { opacity: 0.4 }]}
              disabled={!commentText.trim()}
              onPress={() => {
                if (!commentText.trim() || !id) return;
                void (async () => {
                  if (cloud.isReady && cloud.profile) {
                    const cloudSubmissionId = await ensureCloudSubmissionForAppId(
                      db,
                      cloud.profile,
                      submission.id,
                    );
                    const result = await addCloudCommentViewModel(
                      cloudSubmissionId ?? '',
                      cloud.profile,
                      commentText,
                    );
                    if (result.comment) {
                      setComments((prev) => [result.comment!, ...prev]);
                      setCommentText('');
                      return;
                    }
                    // A cloud rejection must surface, not downgrade to a
                    // local-only comment. Only 'not_cloud' falls through.
                    if (result.error === 'rate_limited') {
                      Alert.alert(t('You are doing that too quickly. Try again later.'));
                      return;
                    }
                    if (result.error === 'submission_not_found') {
                      Alert.alert(t('This recipe submission is no longer available.'));
                      return;
                    }
                    if (result.error === 'unknown') {
                      Alert.alert(t('Comment not posted. Check your connection and try again.'));
                      return;
                    }
                  }

                  const newComment = addLocalComment(db, id, commentText);
                  setComments((prev) => [{
                    id: newComment.id,
                    submissionId: id,
                    authorName: t('You'),
                    authorHandle: 'me',
                    text: newComment.text,
                    type: 'comment',
                    helpfulCount: 0,
                    createdAt: newComment.createdAt.split('T')[0] ?? newComment.createdAt,
                  }, ...prev]);
                  setCommentText('');
                })();
              }}
            >
              <MessageCircle size={18} color={tc.background} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
        </View>
      </ScrollView>

      {/* P5-C: Sticky vote footer */}
      <RecipeVoteFooter
        submissionId={cloudSubmissionId ?? submission.id}
        currentUserId={cloud.profile?.id ?? null}
        chefId={submission.chefId}
        initialVoteDirection={null}
        supabase={cloud.supabase}
        voterProfileId={cloud.profile?.id ?? null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 24, paddingTop: 18 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  missingRecipeContent: { gap: 8, paddingVertical: 4 },
  missingRecipeContentText: { fontFamily: JAKARTA_FONTS.regular, fontSize: 14, lineHeight: 20 },

  heroCard: {
    borderRadius: 24, padding: 28, gap: 12,
    alignItems: 'center', borderWidth: 1,
  },
  heroIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 22, textAlign: 'center' },
  heroDish: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14 },
  heroDesc: { fontFamily: JAKARTA_FONTS.regular, fontSize: 13, lineHeight: 20, textAlign: 'center' },

  chefRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 14, borderWidth: 1,
  },
  chefIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  chefAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  chefInfo: { flex: 1, gap: 2 },
  chefName: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  chefHandle: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  engagementCluster: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scoreText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  saveActions: { gap: 10 },
  saveButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
  openSavedButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  openSavedText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },

  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  pendingPillLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11, letterSpacing: 0.5 },
  pendingPillAction: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11 },

  section: { gap: 12 },
  sectionTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 18 },
  availabilityHeader: { gap: 10 },
  availabilitySummary: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, lineHeight: 19 },
  missingButton: { minHeight: 44, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  missingButtonText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 12 },
  listActions: { gap: 10 },
  subhead: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  listButton: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },

  listCard: {
    borderRadius: 20, padding: 20, gap: 14, borderWidth: 1,
  },
  ingredientBlock: { gap: 8 },
  ingredientCollapsedRow: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ingredientText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 15, lineHeight: 22, flex: 1 },
  ingredientExpandButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  availabilityBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  availabilityBadgeText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10 },
  availabilityNote: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 16 },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumberText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  stepText: { fontFamily: JAKARTA_FONTS.regular, fontSize: 14, lineHeight: 21, flex: 1 },

  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 14, borderWidth: 1,
  },
  actionLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },
  reportInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewAll: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  commentCard: {
    borderRadius: 16, padding: 14, gap: 8, borderWidth: 1,
  },
  commentTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentAuthor: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  tipBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  tipBadgeText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 8, letterSpacing: 0.5 },
  triedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  triedBadgeText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 8, letterSpacing: 0.5 },
  commentText: { fontFamily: JAKARTA_FONTS.regular, fontSize: 13, lineHeight: 19 },
  commentHelpful: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11 },

  addCommentBox: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    borderRadius: 16, padding: 12, borderWidth: 1,
  },
  commentInput: {
    flex: 1, fontFamily: JAKARTA_FONTS.regular, fontSize: 14,
    maxHeight: 80, padding: 0,
  },
  sendButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
});
