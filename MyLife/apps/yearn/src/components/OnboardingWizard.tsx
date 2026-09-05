import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ImagePlus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import {
  calculateYearnOnboardingCompleteness,
  createDefaultYearnOnboardingDraft,
  normalizeYearnDisplayName,
  validateYearnOnboardingDraft,
  validateYearnOnboardingStep,
  YEARN_GENDER_IDENTITY_OPTIONS,
  YEARN_INTENTION_OPTIONS,
  YEARN_INTEREST_OPTIONS,
  YEARN_ONBOARDING_STEPS,
  YEARN_ORIENTATION_OPTIONS,
  YEARN_PHOTO_SYMBOLS,
  YEARN_PROMPT_OPTIONS,
  YEARN_PRONOUN_OPTIONS,
  YEARN_RELATIONSHIP_STRUCTURES,
  type YearnOnboardingDraft,
  type YearnOnboardingPhotoDraft,
  type YearnOnboardingPromptDraft,
  type YearnOnboardingStepId,
  type YearnOnboardingVisibility,
} from '../lib/onboarding';
import {
  clearYearnOnboardingDraft,
  loadYearnOnboardingDraft,
  persistYearnOnboardingDraft,
} from '../lib/onboardingDraftStore';
import {
  yearnColors,
  yearnRadius,
  yearnSpacing,
  yearnTypography,
} from '../theme/yearnTheme';

interface OnboardingWizardProps {
  initialBirthdate?: string;
  isSaving?: boolean;
  saveError?: string | null;
  onComplete: (draft: YearnOnboardingDraft) => Promise<void>;
  onUploadPhoto?: (photoId: string) => Promise<Partial<YearnOnboardingPhotoDraft>>;
}

type DraftPatch = Partial<YearnOnboardingDraft>;

const pronounOptions = [...YEARN_PRONOUN_OPTIONS];
const relationshipOptions = [...YEARN_RELATIONSHIP_STRUCTURES];
const genderIdentityOptions = [...YEARN_GENDER_IDENTITY_OPTIONS];
const orientationOptions = [...YEARN_ORIENTATION_OPTIONS];
const intentionOptions = [...YEARN_INTENTION_OPTIONS];
const interestOptions = [...YEARN_INTEREST_OPTIONS];
const promptOptions = [...YEARN_PROMPT_OPTIONS];
const photoSymbols = [...YEARN_PHOTO_SYMBOLS];

export function OnboardingWizard({
  initialBirthdate,
  isSaving = false,
  saveError,
  onComplete,
  onUploadPhoto,
}: OnboardingWizardProps) {
  const [stepIndex, setStepIndex] = React.useState(0);
  const [draft, setDraft] = React.useState<YearnOnboardingDraft>(() => (
    createDefaultYearnOnboardingDraft({ birthdate: initialBirthdate })
  ));
  const [errors, setErrors] = React.useState<string[]>([]);
  // Restore a persisted draft on mount so onboarding survives an app kill
  // (audit U2). We only persist after hydration to avoid clobbering a saved
  // draft with the empty default on first render.
  const [isHydrated, setIsHydrated] = React.useState(false);
  const step = YEARN_ONBOARDING_STEPS[stepIndex];
  const completeness = calculateYearnOnboardingCompleteness(draft);

  React.useEffect(() => {
    let cancelled = false;
    void loadYearnOnboardingDraft()
      .then((saved) => {
        if (cancelled) return;
        if (saved) setDraft(saved);
      })
      .finally(() => {
        if (!cancelled) setIsHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!isHydrated) return;
    void persistYearnOnboardingDraft(draft);
  }, [draft, isHydrated]);

  React.useEffect(() => {
    if (!initialBirthdate) return;
    setDraft((current) => (
      current.birthdate ? current : { ...current, birthdate: initialBirthdate }
    ));
  }, [initialBirthdate]);

  const updateDraft = React.useCallback((patch: DraftPatch) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors([]);
  }, []);

  const updateVisibility = React.useCallback((
    key: keyof YearnOnboardingVisibility,
    value: boolean,
  ) => {
    setDraft((current) => ({
      ...current,
      visibility: {
        ...current.visibility,
        [key]: value,
      },
    }));
    setErrors([]);
  }, []);

  const updatePhoto = React.useCallback((
    photoId: string,
    patch: Partial<YearnOnboardingPhotoDraft>,
  ) => {
    setDraft((current) => ({
      ...current,
      photos: current.photos.map((photo) => (
        photo.id === photoId ? { ...photo, ...patch } : photo
      )),
    }));
    setErrors([]);
  }, []);

  const updatePrompt = React.useCallback((
    promptId: string,
    patch: Partial<YearnOnboardingPromptDraft>,
  ) => {
    setDraft((current) => ({
      ...current,
      prompts: current.prompts.map((prompt) => (
        prompt.id === promptId ? { ...prompt, ...patch } : prompt
      )),
    }));
    setErrors([]);
  }, []);

  const addPhoto = React.useCallback(() => {
    setDraft((current) => {
      if (current.photos.length >= 3) return current;
      const nextSymbol = photoSymbols[current.photos.length % photoSymbols.length];
      return {
        ...current,
        photos: [
          ...current.photos,
          {
            id: `photo-${current.photos.length + 1}`,
            symbol: nextSymbol.symbol,
            tintHex: nextSymbol.tintHex,
            caption: '',
            path: null,
            localUri: null,
            isUploading: false,
            showOnProfile: true,
          },
        ],
      };
    });
    setErrors([]);
  }, []);

  const addPrompt = React.useCallback(() => {
    setDraft((current) => {
      if (current.prompts.length >= 3) return current;
      return {
        ...current,
        prompts: [
          ...current.prompts,
          {
            id: `prompt-${current.prompts.length + 1}`,
            question: promptOptions[current.prompts.length % promptOptions.length],
            answer: '',
            showOnProfile: true,
          },
        ],
      };
    });
    setErrors([]);
  }, []);

  const toggleInterest = React.useCallback((interest: string) => {
    setDraft((current) => {
      const isSelected = current.interests.includes(interest);
      return {
        ...current,
        interests: isSelected
          ? current.interests.filter((item) => item !== interest)
          : [...current.interests, interest],
      };
    });
    setErrors([]);
  }, []);

  const toggleGenderIdentity = React.useCallback((genderIdentity: string) => {
    setDraft((current) => {
      const isSelected = current.genderIdentities.includes(genderIdentity);
      return {
        ...current,
        genderIdentities: isSelected
          ? current.genderIdentities.filter((item) => item !== genderIdentity)
          : [...current.genderIdentities, genderIdentity],
      };
    });
    setErrors([]);
  }, []);

  const toggleOrientationIdentity = React.useCallback((orientation: string) => {
    setDraft((current) => {
      const isSelected = current.orientationIdentities.includes(orientation);
      return {
        ...current,
        orientationIdentities: isSelected
          ? current.orientationIdentities.filter((item) => item !== orientation)
          : [...current.orientationIdentities, orientation],
      };
    });
    setErrors([]);
  }, []);

  const handleUploadPhoto = React.useCallback(async (photoId: string) => {
    if (!onUploadPhoto) return;

    updatePhoto(photoId, { isUploading: true });
    try {
      const patch = await onUploadPhoto(photoId);
      updatePhoto(photoId, { ...patch, isUploading: false });
    } catch (err) {
      updatePhoto(photoId, { isUploading: false });
      setErrors([err instanceof Error ? err.message : String(err)]);
    }
  }, [onUploadPhoto, updatePhoto]);

  const handleBack = React.useCallback(() => {
    setErrors([]);
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const validateCurrentStep = React.useCallback(() => {
    if (step.id === 'welcome') return true;
    const result = step.id === 'review' || step.id === 'done'
      ? validateYearnOnboardingDraft(draft)
      : validateYearnOnboardingStep(draft, step.id);
    setErrors(result.errors);
    return result.isValid;
  }, [draft, step.id]);

  const handlePrimary = React.useCallback(async () => {
    if (!validateCurrentStep()) return;
    if (step.id === 'done') {
      await onComplete(draft);
      // Profile published: the saved draft is no longer needed.
      void clearYearnOnboardingDraft();
      return;
    }
    setStepIndex((current) => Math.min(YEARN_ONBOARDING_STEPS.length - 1, current + 1));
  }, [draft, onComplete, step.id, validateCurrentStep]);

  const primaryLabel = step.id === 'done'
    ? 'Publish profile'
    : step.id === 'review'
      ? 'Confirm'
      : 'Continue';

  return (
    <View style={styles.panel}>
      <View style={styles.progressHeader}>
        <View style={styles.stepBadge}>
          <Sparkles size={16} color={yearnColors.inkwine} strokeWidth={2.4} />
          <Text style={styles.stepBadgeText}>
            {stepIndex + 1}/{YEARN_ONBOARDING_STEPS.length}
          </Text>
        </View>
        <Text style={styles.progressText}>{completeness}% complete</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${completeness}%` }]} />
      </View>

      <View style={styles.stepTabs}>
        {YEARN_ONBOARDING_STEPS.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.stepDot,
              index <= stepIndex && styles.stepDotActive,
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.stepBody}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>{step.label}</Text>
        {renderStep({
          draft,
          stepId: step.id,
          updateDraft,
          updateVisibility,
          updatePhoto,
          updatePrompt,
          addPhoto,
          addPrompt,
          toggleInterest,
          toggleGenderIdentity,
          toggleOrientationIdentity,
          uploadPhoto: onUploadPhoto ? handleUploadPhoto : undefined,
        })}

        {errors.length > 0 ? (
          <View style={styles.errorBox}>
            {errors.map((error) => (
              <Text key={error} style={styles.errorText}>{error}</Text>
            ))}
          </View>
        ) : null}

        {saveError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          disabled={stepIndex === 0 || isSaving}
          onPress={handleBack}
          style={[
            styles.backButton,
            (stepIndex === 0 || isSaving) && styles.disabledButton,
          ]}
        >
          <ChevronLeft size={18} color={yearnColors.vellum} strokeWidth={2.4} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          disabled={isSaving}
          onPress={handlePrimary}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            isSaving && styles.disabledButton,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color={yearnColors.inkwine} size="small" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
              {step.id === 'done' ? (
                <Check size={18} color={yearnColors.inkwine} strokeWidth={2.6} />
              ) : (
                <ChevronRight size={18} color={yearnColors.inkwine} strokeWidth={2.6} />
              )}
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function renderStep({
  draft,
  stepId,
  updateDraft,
  updateVisibility,
  updatePhoto,
  updatePrompt,
  addPhoto,
  addPrompt,
  toggleInterest,
  toggleGenderIdentity,
  toggleOrientationIdentity,
  uploadPhoto,
}: {
  draft: YearnOnboardingDraft;
  stepId: YearnOnboardingStepId;
  updateDraft: (patch: DraftPatch) => void;
  updateVisibility: (key: keyof YearnOnboardingVisibility, value: boolean) => void;
  updatePhoto: (photoId: string, patch: Partial<YearnOnboardingPhotoDraft>) => void;
  updatePrompt: (promptId: string, patch: Partial<YearnOnboardingPromptDraft>) => void;
  addPhoto: () => void;
  addPrompt: () => void;
  toggleInterest: (interest: string) => void;
  toggleGenderIdentity: (genderIdentity: string) => void;
  toggleOrientationIdentity: (orientation: string) => void;
  uploadPhoto?: (photoId: string) => Promise<void>;
}) {
  switch (stepId) {
    case 'welcome':
      return <WelcomeStep />;
    case 'name':
      return (
        <NameStep
          displayName={draft.displayName}
          onChange={(displayName) => updateDraft({ displayName })}
        />
      );
    case 'age_pronouns':
      return (
        <AgePronounsStep
          draft={draft}
          onBirthdateChange={(birthdate) => updateDraft({ birthdate })}
          onPronounsChange={(pronouns) => updateDraft({ pronouns })}
          onCustomPronounsChange={(customPronouns) => updateDraft({ customPronouns })}
          onVisibilityChange={(value) => updateVisibility('pronouns', value)}
        />
      );
    case 'identity':
      return (
        <IdentityStep
          draft={draft}
          onIntentionChange={(intention) => updateDraft({ intention })}
          onOrientationConsentChange={(orientationConsentGranted) => (
            updateDraft({ orientationConsentGranted })
          )}
          onRelationshipChange={(relationshipStructure) => updateDraft({ relationshipStructure })}
          onToggleGender={toggleGenderIdentity}
          onToggleOrientation={toggleOrientationIdentity}
          onVisibilityChange={updateVisibility}
        />
      );
    case 'photos':
      return (
        <PhotosStep
          draft={draft}
          onVisibilityChange={(value) => updateVisibility('photos', value)}
          onPhotoChange={updatePhoto}
          onAddPhoto={addPhoto}
          onUploadPhoto={uploadPhoto}
        />
      );
    case 'prompts':
      return (
        <PromptsStep
          draft={draft}
          onVisibilityChange={(value) => updateVisibility('prompts', value)}
          onPromptChange={updatePrompt}
          onAddPrompt={addPrompt}
        />
      );
    case 'interests':
      return (
        <InterestsStep
          draft={draft}
          onVisibilityChange={(value) => updateVisibility('interests', value)}
          onToggleInterest={toggleInterest}
        />
      );
    case 'verify':
      return (
        <VerifyStep
          acknowledged={draft.verificationAcknowledged}
          onChange={(verificationAcknowledged) => updateDraft({ verificationAcknowledged })}
        />
      );
    case 'review':
      return <ReviewStep draft={draft} />;
    case 'done':
      return <DoneStep draft={draft} />;
    default:
      return null;
  }
}

function WelcomeStep() {
  return (
    <View style={styles.copyBlock}>
      <Text style={styles.title}>Build your Yearn profile</Text>
      <Text style={styles.body}>
        Your profile starts private, then publishes only the fields you choose.
      </Text>
    </View>
  );
}

function NameStep({
  displayName,
  onChange,
}: {
  displayName: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.copyBlock}>
      <Text style={styles.title}>Your display name</Text>
      <TextInput
        accessibilityLabel="Display name"
        autoCapitalize="words"
        onChangeText={onChange}
        placeholder="June"
        placeholderTextColor={yearnColors.textTertiary}
        style={styles.input}
        value={displayName}
      />
    </View>
  );
}

function AgePronounsStep({
  draft,
  onBirthdateChange,
  onPronounsChange,
  onCustomPronounsChange,
  onVisibilityChange,
}: {
  draft: YearnOnboardingDraft;
  onBirthdateChange: (value: string) => void;
  onPronounsChange: (value: string) => void;
  onCustomPronounsChange: (value: string) => void;
  onVisibilityChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.copyBlock}>
      <Text style={styles.title}>Age and pronouns</Text>
      <TextInput
        accessibilityLabel="Birthdate"
        autoCapitalize="none"
        inputMode="numeric"
        onChangeText={onBirthdateChange}
        placeholder="1994-06-15"
        placeholderTextColor={yearnColors.textTertiary}
        style={styles.input}
        value={draft.birthdate}
      />
      <VisibilityRow
        label="Show pronouns"
        value={draft.visibility.pronouns}
        onValueChange={onVisibilityChange}
      />
      <ChoiceGrid
        choices={pronounOptions}
        selected={draft.pronouns}
        onSelect={onPronounsChange}
      />
      {draft.pronouns === 'custom' ? (
        <TextInput
          accessibilityLabel="Custom pronouns"
          autoCapitalize="none"
          onChangeText={onCustomPronounsChange}
          placeholder="ze/zir"
          placeholderTextColor={yearnColors.textTertiary}
          style={styles.input}
          value={draft.customPronouns}
        />
      ) : null}
    </View>
  );
}

function IdentityStep({
  draft,
  onIntentionChange,
  onOrientationConsentChange,
  onRelationshipChange,
  onToggleGender,
  onToggleOrientation,
  onVisibilityChange,
}: {
  draft: YearnOnboardingDraft;
  onIntentionChange: (value: string) => void;
  onOrientationConsentChange: (value: boolean) => void;
  onRelationshipChange: (value: string) => void;
  onToggleGender: (value: string) => void;
  onToggleOrientation: (value: string) => void;
  onVisibilityChange: (key: keyof YearnOnboardingVisibility, value: boolean) => void;
}) {
  return (
    <View style={styles.copyBlock}>
      <Text style={styles.title}>Dating intent</Text>
      <VisibilityRow
        label="Show identity fields"
        value={draft.visibility.identity}
        onValueChange={(value) => onVisibilityChange('identity', value)}
      />
      <VisibilityRow
        label="Show gender identities"
        value={draft.visibility.genderIdentities}
        onValueChange={(value) => onVisibilityChange('genderIdentities', value)}
      />
      <Text style={styles.sectionLabel}>Gender identities</Text>
      <ChoiceGrid
        choices={genderIdentityOptions}
        selected={draft.genderIdentities}
        onSelect={onToggleGender}
        multiSelect
      />
      <VisibilityRow
        label="Show orientation"
        value={draft.visibility.orientation}
        onValueChange={(value) => onVisibilityChange('orientation', value)}
      />
      <Text style={styles.sectionLabel}>Orientation</Text>
      <ChoiceGrid
        choices={orientationOptions}
        selected={draft.orientationIdentities}
        onSelect={onToggleOrientation}
        multiSelect
      />
      <VisibilityRow
        label="Consent to save orientation"
        value={draft.orientationConsentGranted}
        onValueChange={onOrientationConsentChange}
      />
      <Text style={styles.sectionLabel}>Relationship structure</Text>
      <ChoiceGrid
        choices={relationshipOptions}
        selected={draft.relationshipStructure}
        onSelect={onRelationshipChange}
      />
      <Text style={styles.sectionLabel}>Looking for</Text>
      <ChoiceGrid
        choices={intentionOptions}
        selected={draft.intention}
        onSelect={onIntentionChange}
      />
    </View>
  );
}

function PhotosStep({
  draft,
  onVisibilityChange,
  onPhotoChange,
  onAddPhoto,
  onUploadPhoto,
}: {
  draft: YearnOnboardingDraft;
  onVisibilityChange: (value: boolean) => void;
  onPhotoChange: (photoId: string, patch: Partial<YearnOnboardingPhotoDraft>) => void;
  onAddPhoto: () => void;
  onUploadPhoto?: (photoId: string) => Promise<void>;
}) {
  return (
    <View style={styles.copyBlock}>
      <Text style={styles.title}>Profile photos</Text>
      <VisibilityRow
        label="Show photos"
        value={draft.visibility.photos}
        onValueChange={onVisibilityChange}
      />
      {draft.photos.map((photo, index) => (
        <View key={photo.id} style={styles.photoEditor}>
          <View style={[styles.photoPreview, { backgroundColor: photo.tintHex }]}>
            {photo.localUri ? (
              <Image
                accessibilityLabel={`Photo ${index + 1} preview`}
                contentFit="cover"
                source={{ uri: photo.localUri }}
                style={styles.photoImage}
              />
            ) : (
              <Text style={styles.photoPreviewText}>{index + 1}</Text>
            )}
          </View>
          <View style={styles.editorBody}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Choose photo ${index + 1}`}
              disabled={!onUploadPhoto || photo.isUploading}
              onPress={() => {
                void onUploadPhoto?.(photo.id);
              }}
              style={[
                styles.secondaryButton,
                (!onUploadPhoto || photo.isUploading) && styles.disabledButton,
              ]}
            >
              {photo.isUploading ? (
                <ActivityIndicator color={yearnColors.vellum} size="small" />
              ) : (
                <ImagePlus size={17} color={yearnColors.vellum} strokeWidth={2.4} />
              )}
              <Text style={styles.secondaryButtonText}>
                {photo.path ? 'Replace photo' : 'Choose photo'}
              </Text>
            </Pressable>
            <Text style={styles.sectionLabel}>Visual placeholder</Text>
            <View style={styles.swatchRow}>
              {photoSymbols.map((option) => (
                <Pressable
                  key={option.symbol}
                  accessibilityRole="button"
                  accessibilityLabel={option.symbol}
                  onPress={() => onPhotoChange(photo.id, {
                    symbol: option.symbol,
                    tintHex: option.tintHex,
                  })}
                  style={[
                    styles.swatch,
                    { backgroundColor: option.tintHex },
                    photo.symbol === option.symbol && styles.swatchActive,
                  ]}
                />
              ))}
            </View>
            <TextInput
              accessibilityLabel={`Photo ${index + 1} caption`}
              onChangeText={(caption) => onPhotoChange(photo.id, { caption })}
              placeholder="Caption"
              placeholderTextColor={yearnColors.textTertiary}
              style={styles.input}
              value={photo.caption}
            />
            <VisibilityRow
              label="Show this photo"
              value={photo.showOnProfile}
              onValueChange={(showOnProfile) => (
                onPhotoChange(photo.id, { showOnProfile })
              )}
            />
          </View>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add photo placeholder"
        disabled={draft.photos.length >= 3}
        onPress={onAddPhoto}
        style={[
          styles.secondaryButton,
          draft.photos.length >= 3 && styles.disabledButton,
        ]}
      >
        <ImagePlus size={17} color={yearnColors.vellum} strokeWidth={2.4} />
        <Text style={styles.secondaryButtonText}>Add placeholder</Text>
      </Pressable>
    </View>
  );
}

function PromptsStep({
  draft,
  onVisibilityChange,
  onPromptChange,
  onAddPrompt,
}: {
  draft: YearnOnboardingDraft;
  onVisibilityChange: (value: boolean) => void;
  onPromptChange: (promptId: string, patch: Partial<YearnOnboardingPromptDraft>) => void;
  onAddPrompt: () => void;
}) {
  return (
    <View style={styles.copyBlock}>
      <Text style={styles.title}>Profile prompts</Text>
      <VisibilityRow
        label="Show prompts"
        value={draft.visibility.prompts}
        onValueChange={onVisibilityChange}
      />
      {draft.prompts.map((prompt, index) => (
        <View key={prompt.id} style={styles.promptEditor}>
          <ChoiceGrid
            choices={promptOptions}
            selected={prompt.question}
            onSelect={(question) => onPromptChange(prompt.id, { question })}
          />
          <TextInput
            accessibilityLabel={`Prompt ${index + 1} answer`}
            multiline
            onChangeText={(answer) => onPromptChange(prompt.id, { answer })}
            placeholder="Write a real answer."
            placeholderTextColor={yearnColors.textTertiary}
            style={[styles.input, styles.multilineInput]}
            value={prompt.answer}
          />
          <VisibilityRow
            label="Show this prompt"
            value={prompt.showOnProfile}
            onValueChange={(showOnProfile) => (
              onPromptChange(prompt.id, { showOnProfile })
            )}
          />
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add prompt"
        disabled={draft.prompts.length >= 3}
        onPress={onAddPrompt}
        style={[
          styles.secondaryButton,
          draft.prompts.length >= 3 && styles.disabledButton,
        ]}
      >
        <Sparkles size={17} color={yearnColors.vellum} strokeWidth={2.4} />
        <Text style={styles.secondaryButtonText}>Add prompt</Text>
      </Pressable>
    </View>
  );
}

function InterestsStep({
  draft,
  onVisibilityChange,
  onToggleInterest,
}: {
  draft: YearnOnboardingDraft;
  onVisibilityChange: (value: boolean) => void;
  onToggleInterest: (interest: string) => void;
}) {
  return (
    <View style={styles.copyBlock}>
      <Text style={styles.title}>Interests</Text>
      <VisibilityRow
        label="Show interests"
        value={draft.visibility.interests}
        onValueChange={onVisibilityChange}
      />
      <ChoiceGrid
        choices={interestOptions}
        selected={draft.interests}
        onSelect={onToggleInterest}
        multiSelect
      />
    </View>
  );
}

function VerifyStep({
  acknowledged,
  onChange,
}: {
  acknowledged: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.copyBlock}>
      <View style={styles.verifyIcon}>
        <ShieldCheck size={28} color={yearnColors.sage} strokeWidth={2.4} />
      </View>
      <Text style={styles.title}>Verification</Text>
      <Text style={styles.body}>
        Photo verification is coming soon. For now your profile joins as unverified,
        and you can verify later once the review flow is available.
      </Text>
      <VisibilityRow
        label="I understand my profile will start unverified"
        value={acknowledged}
        onValueChange={onChange}
      />
    </View>
  );
}

function ReviewStep({ draft }: { draft: YearnOnboardingDraft }) {
  return (
    <View style={styles.copyBlock}>
      <Text style={styles.title}>Review profile</Text>
      <SummaryRow label="Name" value={normalizeYearnDisplayName(draft.displayName)} />
      <SummaryRow label="Birthdate" value={draft.birthdate} />
      <SummaryRow
        label="Pronouns"
        value={draft.visibility.pronouns
          ? draft.pronouns === 'custom' ? draft.customPronouns : draft.pronouns
          : 'Hidden'}
      />
      <SummaryRow
        label="Gender"
        value={draft.visibility.genderIdentities
          ? draft.genderIdentities.join(', ') || 'None'
          : 'Hidden'}
      />
      <SummaryRow
        label="Orientation"
        value={draft.visibility.orientation
          ? draft.orientationIdentities.join(', ') || 'None'
          : 'Hidden'}
      />
      <SummaryRow
        label="Orientation consent"
        value={draft.orientationConsentGranted ? 'Granted' : 'Not granted'}
      />
      <SummaryRow
        label="Intent"
        value={draft.visibility.identity ? draft.intention : 'Hidden'}
      />
      <SummaryRow
        label="Photos"
        value={`${draft.photos.filter((photo) => photo.showOnProfile).length} visible`}
      />
      <SummaryRow
        label="Prompts"
        value={`${draft.prompts.filter((prompt) => prompt.showOnProfile).length} visible`}
      />
      <SummaryRow label="Interests" value={draft.interests.join(', ') || 'None'} />
    </View>
  );
}

function DoneStep({ draft }: { draft: YearnOnboardingDraft }) {
  return (
    <View style={styles.copyBlock}>
      <View style={styles.verifyIcon}>
        <Check size={28} color={yearnColors.sage} strokeWidth={2.4} />
      </View>
      <Text style={styles.title}>Ready to publish</Text>
      <Text style={styles.body}>
        {normalizeYearnDisplayName(draft.displayName)} will be written to your Yearn profile row.
      </Text>
    </View>
  );
}

function ChoiceGrid({
  choices,
  selected,
  onSelect,
  multiSelect = false,
}: {
  choices: readonly string[];
  selected: string | string[];
  onSelect: (value: string) => void;
  multiSelect?: boolean;
}) {
  return (
    <View style={styles.choiceGrid}>
      {choices.map((choice) => {
        const isActive = Array.isArray(selected)
          ? selected.includes(choice)
          : selected === choice;
        return (
          <Pressable
            key={choice}
            accessibilityRole="button"
            accessibilityLabel={choice}
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(choice)}
            style={({ pressed }) => [
              styles.choiceButton,
              isActive && styles.choiceButtonActive,
              pressed && styles.choiceButtonPressed,
            ]}
          >
            <Text style={[
              styles.choiceText,
              isActive && styles.choiceTextActive,
            ]}>
              {choice}
            </Text>
            {multiSelect && isActive ? (
              <Check size={14} color={yearnColors.inkwine} strokeWidth={2.6} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function VisibilityRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const Icon = value ? Eye : EyeOff;
  return (
    <View style={styles.visibilityRow}>
      <View style={styles.visibilityLabel}>
        <Icon
          size={16}
          color={value ? yearnColors.sage : yearnColors.textTertiary}
          strokeWidth={2.2}
        />
        <Text style={styles.visibilityText}>{label}</Text>
      </View>
      <Switch
        ios_backgroundColor="rgba(245, 230, 216, 0.18)"
        onValueChange={onValueChange}
        thumbColor={value ? yearnColors.vellum : yearnColors.dusk}
        trackColor={{
          false: 'rgba(245, 230, 216, 0.18)',
          true: 'rgba(168, 184, 155, 0.46)',
        }}
        value={value}
      />
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: yearnColors.surface,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    gap: yearnSpacing.lg,
    minHeight: 640,
    overflow: 'hidden',
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: yearnSpacing.lg,
    paddingTop: yearnSpacing.lg,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: yearnColors.coral,
    borderRadius: yearnRadius.pill,
    flexDirection: 'row',
    gap: 6,
    minHeight: 30,
    paddingHorizontal: 10,
  },
  stepBadgeText: {
    color: yearnColors.inkwine,
    fontSize: 12,
    fontWeight: '800',
  },
  progressText: {
    color: yearnColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    backgroundColor: 'rgba(245, 230, 216, 0.10)',
    height: 5,
    marginHorizontal: yearnSpacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: yearnColors.sage,
    height: 5,
  },
  stepTabs: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: yearnSpacing.lg,
  },
  stepDot: {
    backgroundColor: 'rgba(245, 230, 216, 0.14)',
    flex: 1,
    height: 4,
  },
  stepDotActive: {
    backgroundColor: yearnColors.coral,
  },
  stepBody: {
    gap: yearnSpacing.lg,
    paddingHorizontal: yearnSpacing.lg,
    paddingBottom: yearnSpacing.xl,
  },
  kicker: {
    color: yearnColors.gold,
    ...yearnTypography.label,
    textTransform: 'uppercase',
  },
  copyBlock: {
    gap: yearnSpacing.md,
  },
  title: {
    color: yearnColors.vellum,
    ...yearnTypography.title,
  },
  body: {
    color: yearnColors.textSecondary,
    ...yearnTypography.body,
  },
  input: {
    backgroundColor: 'rgba(245, 230, 216, 0.08)',
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    color: yearnColors.vellum,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  multilineInput: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  visibilityRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 230, 216, 0.06)',
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  visibilityLabel: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: yearnSpacing.sm,
    paddingRight: yearnSpacing.sm,
  },
  visibilityText: {
    color: yearnColors.vellum,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionLabel: {
    color: yearnColors.gold,
    ...yearnTypography.label,
    textTransform: 'uppercase',
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: yearnSpacing.sm,
  },
  choiceButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 230, 216, 0.08)',
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  choiceButtonActive: {
    backgroundColor: yearnColors.coral,
    borderColor: yearnColors.coral,
  },
  choiceButtonPressed: {
    backgroundColor: 'rgba(232, 133, 107, 0.22)',
  },
  choiceText: {
    color: yearnColors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  choiceTextActive: {
    color: yearnColors.inkwine,
  },
  photoEditor: {
    backgroundColor: yearnColors.surfaceSoft,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: yearnSpacing.md,
    padding: yearnSpacing.md,
  },
  photoPreview: {
    alignItems: 'center',
    borderRadius: yearnRadius.sm,
    height: 112,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 84,
  },
  photoPreviewText: {
    color: yearnColors.inkwine,
    fontSize: 28,
    fontWeight: '800',
  },
  photoImage: {
    borderRadius: yearnRadius.sm,
    height: '100%',
    width: '100%',
  },
  editorBody: {
    flex: 1,
    gap: yearnSpacing.sm,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: yearnSpacing.sm,
  },
  swatch: {
    borderColor: 'rgba(245, 230, 216, 0.25)',
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    width: 32,
  },
  swatchActive: {
    borderColor: yearnColors.vellum,
    borderWidth: 2,
  },
  promptEditor: {
    backgroundColor: yearnColors.surfaceSoft,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    gap: yearnSpacing.md,
    padding: yearnSpacing.md,
  },
  verifyIcon: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168, 184, 155, 0.12)',
    borderColor: 'rgba(168, 184, 155, 0.28)',
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  summaryRow: {
    borderBottomColor: yearnColors.line,
    borderBottomWidth: 1,
    gap: 4,
    paddingVertical: yearnSpacing.sm,
  },
  summaryLabel: {
    color: yearnColors.gold,
    ...yearnTypography.label,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: yearnColors.vellum,
    fontSize: 15,
    lineHeight: 21,
  },
  errorBox: {
    backgroundColor: 'rgba(232, 90, 107, 0.12)',
    borderColor: 'rgba(232, 90, 107, 0.28)',
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    gap: 4,
    padding: yearnSpacing.md,
  },
  errorText: {
    color: yearnColors.alarm,
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    borderColor: yearnColors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: yearnSpacing.md,
    padding: yearnSpacing.lg,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 230, 216, 0.08)',
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 52,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: yearnColors.coral,
    borderRadius: yearnRadius.sm,
    flex: 1,
    flexDirection: 'row',
    gap: yearnSpacing.sm,
    height: 48,
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    backgroundColor: yearnColors.coralPressed,
  },
  primaryButtonText: {
    color: yearnColors.inkwine,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 230, 216, 0.08)',
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: yearnSpacing.sm,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: yearnColors.vellum,
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
});
