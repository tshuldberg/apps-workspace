import { useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, X } from 'lucide-react-native';
import {
  enqueueFailedSubmission,
  JAKARTA_FONTS,
  proposeDishCloud,
  slugify,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors } from './providers/AppThemeProvider';
import { useDatabase } from './providers/DatabaseProvider';
import { addLocalSubmission } from './data/local-submissions';
import { ensureCloudSubmissionForLocalSubmission } from './data/cloud-submissions';
import { enqueueSubmissionMedia, resolveSubmissionPhotoViaQueue } from './data/media-upload-worker';
import { cancelMediaJob, describeMediaUploadError, normalizeMediaUploadErrorCode } from '@mylife/bestchef';
import { useI18n } from './i18n/I18nProvider';
import { sanitizeFreeText, INPUT_CAPS, SubmitParams } from './utils/validation';
import { useBestChefCloud } from './providers/BestChefCloudProvider';
import { SubmitProgressBar } from './components/submit/SubmitProgressBar';
import { SubmitFooterBar } from './components/submit/SubmitFooterBar';
import { type SubmitStep, WIZARD_STEPS, wizardStepIndex } from './components/submit/types';
import {
  useSubmitDraft,
  canAdvance,
  formatDraftIngredientLine,
} from './state/useSubmitDraft';
import { DishSelectionStep } from './components/submit/steps/DishSelectionStep';
import { FinalPhotosStep } from './components/submit/steps/FinalPhotosStep';
import { IngredientsStep } from './components/submit/steps/IngredientsStep';
import { VideoStep } from './components/submit/steps/VideoStep';
import { DetailsStep } from './components/submit/steps/DetailsStep';
import { ReviewStep } from './components/submit/steps/ReviewStep';
import { SubmitSuccessView } from './components/submit/SubmitSuccessView';

// ---------------------------------------------------------------------------
// Photo upload helper
// ---------------------------------------------------------------------------

/**
 * If the local submission has a file:// or content:// photo, upload it to
 * Supabase Storage and return the public https URL. Returns null if there
 * is no photo, if no Supabase client is available, or if the upload fails
 * (the caller can still write the submission with a null photo, or surface
 * the error to retry later).
 */

// ---------------------------------------------------------------------------
// Step navigation helpers
// ---------------------------------------------------------------------------

function nextStep(current: SubmitStep): SubmitStep {
  if (current === 'dishSelection') return 'finalPhotos';
  const idx = wizardStepIndex(current);
  return WIZARD_STEPS[idx + 1] ?? current;
}

function prevStep(current: SubmitStep): SubmitStep {
  if (current === 'finalPhotos') return 'dishSelection';
  const idx = wizardStepIndex(current);
  return WIZARD_STEPS[idx - 1] ?? current;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SubmitScreen() {
  const router = useRouter();
  const tc = useThemeColors();
  const cloud = useBestChefCloud();
  const { t } = useI18n();
  const db = useDatabase();

  const rawParams = useLocalSearchParams<{ dishId?: string; dishName?: string; forkFrom?: string }>();
  const parsedParams = SubmitParams.safeParse(rawParams);
  if (!parsedParams.ok) {
    console.warn('[submit] Invalid deep-link params; falling back to dish-selection flow', rawParams);
  }
  const params = parsedParams.ok ? parsedParams.value : {};

  const [step, setStep] = useState<SubmitStep>(
    params.dishId ? 'finalPhotos' : 'dishSelection',
  );
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const activeMediaJobRef = useRef<string | null>(null);

  function handleCancelUpload() {
    if (activeMediaJobRef.current) {
      cancelMediaJob(db, activeMediaJobRef.current);
    }
  }
  const [successId, setSuccessId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingLocalSubmissionId, setPendingLocalSubmissionId] = useState<string | null>(null);
  const [proposedDishPending, setProposedDishPending] = useState(false);

  const { draft, dispatch } = useSubmitDraft();

  // Initialize dish from deep-link params
  const [didInitDish, setDidInitDish] = useState(false);
  if (!didInitDish && params.dishId && params.dishName) {
    dispatch({ type: 'SET_DISH', dish: { id: params.dishId, name: params.dishName } });
    setDidInitDish(true);
  }

  // Step opacity transition
  const opacityAnim = useRef(new Animated.Value(1)).current;

  function animateStep(toStep: SubmitStep) {
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setStep(toStep);
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  }

  function goNext() {
    if (step === 'review') {
      void handlePublish();
      return;
    }
    animateStep(nextStep(step));
  }

  function goBack() {
    if (step === 'dishSelection') {
      router.back();
      return;
    }
    if (step === 'finalPhotos') {
      animateStep('dishSelection');
      return;
    }
    animateStep(prevStep(step));
  }

  function handleSelectDish(dish: { id: string; name: string }) {
    dispatch({ type: 'SET_DISH', dish });
    animateStep('finalPhotos');
  }

  async function queueSubmissionForRetry(localId: string, errorMessage: string) {
    if (!cloud.profile || !draft.selectedDish) return;

    const cleanTitle = sanitizeFreeText(draft.title || draft.selectedDish.name, INPUT_CAPS.dishTitle);
    const cleanDescription = sanitizeFreeText(draft.description, INPUT_CAPS.recipeDescription);
    const ingredientLines = draft.ingredients
      .map(formatDraftIngredientLine)
      .filter((line): line is string => line !== null);

    await enqueueFailedSubmission(db, cloud.supabase ?? null, {
      localId,
      payload: {
        alias: `local:${localId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80)}`,
        profileId: cloud.profile.id,
        dishSlug: slugify(draft.selectedDish.name),
        title: cleanTitle,
        description: cleanDescription,
        ingredients: ingredientLines,
        steps: [],
        // Local file:// URIs are useless cloud-side (normalized to null by
        // the alias bridge); the sweep hook patches in the queue-uploaded
        // https URL before replaying.
        photoUrl: null,
      },
      error: errorMessage,
    });
  }

  async function handlePublish() {
    if (!draft.selectedDish || publishing) return;
    setPublishing(true);
    setSubmitError(null);
    setPendingLocalSubmissionId(null);
    setProposedDishPending(false);

    const cleanTitle = sanitizeFreeText(draft.title || draft.selectedDish.name, INPUT_CAPS.dishTitle);
    const cleanDescription = sanitizeFreeText(draft.description, INPUT_CAPS.recipeDescription);
    const ingredientLines = draft.ingredients
      .map(formatDraftIngredientLine)
      .filter((line): line is string => line !== null);
    const photoUri = draft.finalPhotos[0]?.uri ?? null;
    const videos = draft.videoClip
      ? [{ uri: draft.videoClip.uri, type: draft.videoClip.type }]
      : [];

    if (ingredientLines.length === 0) {
      setSubmitError(t('Add at least one ingredient name.'));
      setPublishing(false);
      return;
    }

    // F-024: persist proposed dishes to the public catalog before submission.
    let dishIdForSubmission = draft.selectedDish.id;
    let proposedPending = false;
    if (
      draft.selectedDish.isProposed
      && cloud.isReady
      && cloud.supabase
      && draft.selectedDish.cuisine
      && draft.selectedDish.category
    ) {
      const proposed = await proposeDishCloud(cloud.supabase as never, {
        name: draft.selectedDish.name,
        cuisine: draft.selectedDish.cuisine,
        category: draft.selectedDish.category as never,
      });
      if (proposed.ok) {
        dishIdForSubmission = proposed.data.dishId;
        proposedPending = proposed.data.status === 'pending';
        setProposedDishPending(proposedPending);
      }
      // If proposeDishCloud failed, we still continue with the local marker id.
      // The submission will be enqueued for retry below if cloud submission also fails.
    }

    let localSubmission;
    try {
      localSubmission = addLocalSubmission(db, {
        dishId: dishIdForSubmission,
        dishName: draft.selectedDish.name,
        title: cleanTitle,
        description: cleanDescription,
        ingredients: ingredientLines,
        instructions: [],
        photoUri,
        videos,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('Please try again.');
      setSubmitError(msg);
      setPublishing(false);
      return;
    }

    if (!cloud.isReady || !cloud.profile) {
      // No cloud session: the local submission stands. The photo job is
      // enqueued now so the durable queue uploads it after sign-in and the
      // retry path can consume the settled URL (plan 33 Phase 4.4).
      if (localSubmission.photoUri) {
        enqueueSubmissionMedia(db, {
          ownerId: localSubmission.id,
          mediaKind: 'image',
          localUri: localSubmission.photoUri,
        });
      }
      setSuccessId(localSubmission.id);
      setPublishing(false);
      return;
    }

    try {
      // Upload the local photo through the durable media queue (plan 33
      // Phase 4.4): compression, byte-level progress, cancel, and offline
      // persistence. The cloud row needs an https URL (the
      // bc_submissions_photo_url_https constraint rejects file:// URIs).
      let resolvedPhotoUrl: string | null = null;
      if (localSubmission.photoUri && cloud.supabase) {
        setUploadProgress(0);
        const resolution = await resolveSubmissionPhotoViaQueue(
          db,
          cloud.supabase,
          { ownerId: localSubmission.id, localUri: localSubmission.photoUri },
          {
            onJobStart: (jobId) => { activeMediaJobRef.current = jobId; },
            onProgress: setUploadProgress,
          },
        );
        activeMediaJobRef.current = null;
        setUploadProgress(null);
        if (resolution.status === 'cancelled') {
          setSubmitError(t('Upload cancelled.'));
          setPublishing(false);
          return;
        }
        if (resolution.status === 'failed') {
          const details = describeMediaUploadError(
            normalizeMediaUploadErrorCode(resolution.code),
          );
          setSubmitError(t(details.message, { maxMb: '12' }));
          if (details.retryable && !resolution.permanent) {
            // Transient: the job stays queued for the foreground sweep AND
            // the submission enters the existing retry queue.
            setPendingLocalSubmissionId(localSubmission.id);
            await queueSubmissionForRetry(localSubmission.id, t(details.message, { maxMb: '12' }));
          }
          setPublishing(false);
          return;
        }
        resolvedPhotoUrl = resolution.publicUrl;
      }

      const cloudSubmissionId = await ensureCloudSubmissionForLocalSubmission(
        cloud.profile,
        localSubmission,
        { resolvedPhotoUrl },
      );

      if (cloudSubmissionId) {
        // Cook-along video rides the queue in the background, keyed by the
        // CLOUD submission so it lands in bc_media_assets. The foreground
        // sweep uploads it; publish never blocks on a 150MB file. HONEST
        // LIMIT: the asset waits private/pending until the server-side
        // moderation+promotion step (Phase 4.1, founder F4) flips it
        // public with a playable remote_url - it does NOT appear in the
        // video feed yet.
        if (draft.videoClip) {
          enqueueSubmissionMedia(db, {
            ownerId: cloudSubmissionId,
            mediaKind: 'video',
            localUri: draft.videoClip.uri,
            mimeType: draft.videoClip.type || 'video/mp4',
            // Carry the clip's duration/dimensions so finalize persists them
            // and feed cards can show the length (audit M2).
            durationMs:
              draft.videoClip.durationSeconds !== undefined
                ? Math.round(draft.videoClip.durationSeconds * 1000)
                : null,
            width: draft.videoClip.width ?? null,
            height: draft.videoClip.height ?? null,
          });
        }
        setSuccessId(cloudSubmissionId);
        setPublishing(false);
        return;
      }

      // Cloud write returned null (alias bridge declined). Treat as failure.
      throw new Error('Cloud submission was not accepted.');
    } catch (err) {
      activeMediaJobRef.current = null;
      setUploadProgress(null);
      const msg = err instanceof Error ? err.message : t('Please try again.');
      setSubmitError(msg);
      setPendingLocalSubmissionId(localSubmission.id);
      await queueSubmissionForRetry(localSubmission.id, msg);
      setPublishing(false);
    }
  }

  async function handleRetryNow() {
    if (publishing) return;
    setPublishing(true);
    setSubmitError(null);
    if (!cloud.isReady || !cloud.profile || !pendingLocalSubmissionId) {
      setSubmitError(t('submit_submission_failed'));
      setPublishing(false);
      return;
    }
    try {
      const localSub = pendingLocalSubmissionId;
      // Re-read the local submission from the DB so we always pass fresh ingredients/photo.
      const found = (await import('./data/local-submissions')).getLocalSubmission(db, localSub);
      if (!found) {
        setSubmitError(t('submit_submission_failed'));
        setPublishing(false);
        return;
      }
      let retryPhotoUrl: string | null = null;
      if (found.photoUri && cloud.supabase) {
        setUploadProgress(0);
        const resolution = await resolveSubmissionPhotoViaQueue(
          db,
          cloud.supabase,
          { ownerId: found.id, localUri: found.photoUri },
          {
            onJobStart: (jobId) => { activeMediaJobRef.current = jobId; },
            onProgress: setUploadProgress,
          },
        );
        activeMediaJobRef.current = null;
        setUploadProgress(null);
        if (resolution.status !== 'done') {
          const details = resolution.status === 'cancelled'
            ? { message: 'Upload cancelled.' }
            : describeMediaUploadError(normalizeMediaUploadErrorCode(resolution.code));
          setSubmitError(t(details.message, { maxMb: '12' }));
          setPublishing(false);
          return;
        }
        retryPhotoUrl = resolution.publicUrl;
      }
      const cloudId = await ensureCloudSubmissionForLocalSubmission(
        cloud.profile,
        found,
        { resolvedPhotoUrl: retryPhotoUrl },
      );
      if (cloudId) {
        setPendingLocalSubmissionId(null);
        setSuccessId(cloudId);
      } else {
        setSubmitError(t('submit_submission_failed'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('Please try again.');
      setSubmitError(msg);
    } finally {
      setPublishing(false);
    }
  }

  async function handleSaveDraftForLater() {
    if (!pendingLocalSubmissionId || !draft.selectedDish) return;
    await queueSubmissionForRetry(pendingLocalSubmissionId, submitError ?? 'Cloud write failed');
    setSuccessId(pendingLocalSubmissionId);
    setPendingLocalSubmissionId(null);
  }

  function handleSubmitAnother() {
    dispatch({ type: 'RESET' });
    setSuccessId(null);
    setStep('dishSelection');
  }

  function stepSubtitleText(s: SubmitStep): string {
    switch (s) {
      case 'dishSelection': return t('Select Dish');
      case 'finalPhotos': return t('Photos of the plated dish');
      case 'ingredients': return t('Mise en place ingredients');
      case 'video': return t('Optional 5-min cook-along');
      case 'details': return t('Recipe details');
      case 'review': return t('Final review');
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: tc.border ?? 'rgba(255,255,255,0.06)' }]}>
        <View style={styles.headerTitles}>
          <Text style={[styles.headerTitle, { color: tc.text }]}>{t('Submit Recipe')}</Text>
          <Text style={[styles.headerSubtitle, { color: tc.textSecondary }]}>
            {stepSubtitleText(step)}
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.closeButton, { backgroundColor: tc.surface }]}
        >
          <X size={14} color={tc.text} strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* Progress bar */}
      <SubmitProgressBar step={step} />

      {/* Step content */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={{ flex: 1, opacity: opacityAnim }}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 'dishSelection' && (
              <DishSelectionStep onSelectDish={handleSelectDish} />
            )}
            {step === 'finalPhotos' && (
              <FinalPhotosStep draft={draft} dispatch={dispatch} />
            )}
            {step === 'ingredients' && (
              <IngredientsStep draft={draft} dispatch={dispatch} />
            )}
            {step === 'video' && (
              <VideoStep draft={draft} dispatch={dispatch} />
            )}
            {step === 'details' && (
              <DetailsStep draft={draft} dispatch={dispatch} />
            )}
            {step === 'review' && (
              <ReviewStep draft={draft} setStep={animateStep} />
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* B-005: inline retry banner when cloud submit fails */}
      {submitError && pendingLocalSubmissionId ? (
        <View style={[styles.errorBanner, { backgroundColor: `${tc.danger ?? '#FFB4AB'}1A`, borderColor: tc.danger ?? '#FFB4AB' }]}>
          <View style={styles.errorBannerHeader}>
            <AlertCircle size={16} color={tc.danger ?? '#FFB4AB'} strokeWidth={2.2} />
            <Text style={[styles.errorBannerTitle, { color: tc.danger ?? '#FFB4AB' }]}>
              {t('submit_submission_failed')}
            </Text>
          </View>
          <Text style={[styles.errorBannerMessage, { color: tc.text }]} numberOfLines={3}>
            {submitError}
          </Text>
          <View style={styles.errorBannerActions}>
            <Pressable
              style={[styles.errorBannerPrimary, { backgroundColor: tc.accent }]}
              onPress={() => { void handleRetryNow(); }}
              disabled={publishing}
              accessibilityRole="button"
              accessibilityLabel={t('submit_retry_now')}
            >
              <Text style={[styles.errorBannerPrimaryText, { color: tc.background }]}>
                {t('submit_retry_now')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.errorBannerSecondary, { borderColor: tc.accent }]}
              onPress={() => { void handleSaveDraftForLater(); }}
              accessibilityRole="button"
              accessibilityLabel={t('submit_save_draft_for_later')}
            >
              <Text style={[styles.errorBannerSecondaryText, { color: tc.accent }]}>
                {t('submit_save_draft_for_later')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* F-024: confirmation when proposed dish is pending moderation */}
      {proposedDishPending && successId ? (
        <View style={[styles.proposedBanner, { backgroundColor: `${tc.accent}1A`, borderColor: tc.accent }]}>
          <Text style={[styles.proposedBannerText, { color: tc.accent }]}>
            {t('submit_submitted_for_moderation')}
          </Text>
        </View>
      ) : null}

      {/* Footer */}
      <SubmitFooterBar
        step={step}
        canAdvance={canAdvance(step, draft)}
        publishing={publishing}
        uploadProgress={uploadProgress}
        onCancelUpload={handleCancelUpload}
        onBack={goBack}
        onNext={goNext}
      />

      {/* Success modal */}
      <Modal
        visible={successId !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleSubmitAnother}
      >
        {successId !== null && (
          <SubmitSuccessView
            draft={draft}
            submissionId={successId}
            onSubmitAnother={handleSubmitAnother}
          />
        )}
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitles: { flex: 1 },
  headerTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 17 },
  headerSubtitle: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12, marginTop: 2 },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },

  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  errorBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorBannerTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  errorBannerMessage: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12, lineHeight: 18 },
  errorBannerActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  errorBannerPrimary: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  errorBannerPrimaryText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  errorBannerSecondary: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  errorBannerSecondaryText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },

  proposedBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  proposedBannerText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12, textAlign: 'center' },
});
