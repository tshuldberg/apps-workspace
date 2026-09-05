import { evaluateYearnAgeGate } from './ageGate';

export type YearnOnboardingStepId =
  | 'welcome'
  | 'name'
  | 'age_pronouns'
  | 'identity'
  | 'photos'
  | 'prompts'
  | 'interests'
  | 'verify'
  | 'review'
  | 'done';

export interface YearnOnboardingStep {
  id: YearnOnboardingStepId;
  label: string;
}

export interface YearnOnboardingPhotoDraft {
  id: string;
  symbol: string;
  tintHex: string;
  caption: string;
  path: string | null;
  localUri: string | null;
  isUploading: boolean;
  showOnProfile: boolean;
}

export interface YearnOnboardingPromptDraft {
  id: string;
  question: string;
  answer: string;
  showOnProfile: boolean;
}

export interface YearnOnboardingVisibility {
  pronouns: boolean;
  identity: boolean;
  genderIdentities: boolean;
  orientation: boolean;
  photos: boolean;
  prompts: boolean;
  interests: boolean;
}

export interface YearnOnboardingDraft {
  displayName: string;
  birthdate: string;
  pronouns: string;
  customPronouns: string;
  genderIdentities: string[];
  orientationIdentities: string[];
  orientationConsentGranted: boolean;
  intention: string;
  relationshipStructure: string;
  photos: YearnOnboardingPhotoDraft[];
  prompts: YearnOnboardingPromptDraft[];
  interests: string[];
  verificationAcknowledged: boolean;
  visibility: YearnOnboardingVisibility;
}

export interface YearnProfilePhotoPayload {
  symbol: string;
  tint_hex: string;
  caption?: string;
  path: string | null;
  show_on_profile: boolean;
}

export interface YearnProfilePromptPayload {
  question: string;
  answer: string;
  show_on_profile: boolean;
}

export interface YearnProfileUpsertInput {
  displayName: string;
  birthday: string;
  pronouns: string;
  customPronouns: string;
  genderIdentities: string[];
  orientationIdentities: string[];
  identityVisibility: YearnOnboardingVisibility;
  orientationConsentGrantedAt: string | null;
  orientationConsentWithdrawnAt: string | null;
  intention: string;
  relationshipStructure: string;
  photos: YearnProfilePhotoPayload[];
  prompts: YearnProfilePromptPayload[];
  interests: string[];
  isPaused: boolean;
}

export interface YearnOnboardingValidationResult {
  isValid: boolean;
  errors: string[];
}

export const YEARN_ONBOARDING_STEPS: YearnOnboardingStep[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'name', label: 'Name' },
  { id: 'age_pronouns', label: 'Age' },
  { id: 'identity', label: 'Identity' },
  { id: 'photos', label: 'Photos' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'interests', label: 'Interests' },
  { id: 'verify', label: 'Verify' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

export const YEARN_PRONOUN_OPTIONS = [
  'she/her',
  'he/him',
  'they/them',
  'she/they',
  'he/they',
  'custom',
] as const;

export const YEARN_RELATIONSHIP_STRUCTURES = [
  'Monogamous',
  'Ethical non-monogamy',
  'Polyamorous',
  'Open to exploring',
] as const;

export const YEARN_GENDER_IDENTITY_OPTIONS = [
  'Woman',
  'Man',
  'Non-binary',
  'Agender',
  'Androgyne',
  'Aporagender',
  'Bigender',
  'Butch',
  'Demiboy',
  'Demigirl',
  'Demigender',
  'Enby',
  'Femme',
  'Gender expansive',
  'Gender fluid',
  'Gender nonconforming',
  'Gender questioning',
  'Genderqueer',
  'Intersex',
  'Maverique',
  'Neutrois',
  'Pangender',
  'Polygender',
  'Trans feminine',
  'Trans masculine',
  'Trans man',
  'Trans woman',
  'Transgender',
  'Two-spirit',
  'Xenogender',
  'Hijra',
  'Kathoey',
  'Muxe',
  'Travesti',
  'Faafafine',
  'Faafatama',
  'Mahu',
  'Waria',
  'Bakla',
  'Takatapui',
  'Brotherboy',
  'Sistergirl',
  'Boi',
  'Stud',
  'Tomboy',
  'Soft butch',
  'Hard femme',
  'Masc of center',
  'Femme of center',
  'Androgynous',
  'Queer',
  'Questioning',
  'Cis woman',
  'Cis man',
  'Cisgender',
  'Transneutral',
  'Graygender',
  'Autigender',
  'Novigender',
  'Omnigender',
  'Multigender',
  'Genderflux',
  'Librafeminine',
  'Libramasculine',
  'Prefer to self-describe',
] as const;

export const YEARN_ORIENTATION_OPTIONS = [
  'Straight',
  'Gay',
  'Lesbian',
  'Bisexual',
  'Pansexual',
  'Queer',
  'Asexual',
  'Demisexual',
  'Graysexual',
  'Heteroflexible',
  'Homoflexible',
  'Omnisexual',
  'Polysexual',
  'Skoliosexual',
  'Androsexual',
  'Gynesexual',
  'Biromantic',
  'Panromantic',
  'Aromantic',
  'Demiromantic',
  'Grayromantic',
  'Questioning',
  'Fluid',
  'Prefer to self-describe',
] as const;

export const YEARN_INTENTION_OPTIONS = [
  'Long-term relationship',
  'Life partner',
  'Intentional dating',
  'Open to long-term',
  'Slow burn',
] as const;

export const YEARN_PHOTO_SYMBOLS = [
  { symbol: 'sparkles', tintHex: '#E8856B' },
  { symbol: 'book', tintHex: '#D4A574' },
  { symbol: 'leaf', tintHex: '#A8B89B' },
  { symbol: 'moon', tintHex: '#C9A89B' },
] as const;

export const YEARN_PROMPT_OPTIONS = [
  'A small ritual I love',
  'The best kind of Sunday',
  'Something I am learning',
  'Green flags I notice',
  'A place that changed me',
] as const;

export const YEARN_INTEREST_OPTIONS = [
  'Cooking',
  'Poetry',
  'Hiking',
  'Live music',
  'Museums',
  'Cycling',
  'Coffee',
  'Film',
  'Gardening',
  'Travel',
  'Volunteering',
  'Dancing',
] as const;

const defaultVisibility: YearnOnboardingVisibility = {
  pronouns: true,
  identity: true,
  genderIdentities: true,
  orientation: true,
  photos: true,
  prompts: true,
  interests: true,
};

export function createDefaultYearnOnboardingDraft(
  initial?: Partial<Pick<YearnOnboardingDraft, 'birthdate' | 'displayName'>>,
): YearnOnboardingDraft {
  return {
    displayName: initial?.displayName ?? '',
    birthdate: initial?.birthdate ?? '',
    pronouns: '',
    customPronouns: '',
    genderIdentities: [],
    orientationIdentities: [],
    orientationConsentGranted: false,
    intention: '',
    relationshipStructure: '',
    photos: [
      {
        id: 'photo-1',
        symbol: YEARN_PHOTO_SYMBOLS[0].symbol,
        tintHex: YEARN_PHOTO_SYMBOLS[0].tintHex,
        caption: '',
        path: null,
        localUri: null,
        isUploading: false,
        showOnProfile: true,
      },
    ],
    prompts: [
      {
        id: 'prompt-1',
        question: YEARN_PROMPT_OPTIONS[0],
        answer: '',
        showOnProfile: true,
      },
    ],
    interests: [],
    verificationAcknowledged: false,
    visibility: { ...defaultVisibility },
  };
}

export function normalizeYearnDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, ' ');
}

export function normalizeYearnPromptAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, ' ');
}

function selectedPronouns(draft: YearnOnboardingDraft): string {
  if (draft.pronouns === 'custom') return draft.customPronouns.trim();
  return draft.pronouns.trim();
}

function consentedOrientationIdentities(draft: YearnOnboardingDraft): string[] {
  if (!draft.orientationConsentGranted) return [];
  return [...draft.orientationIdentities];
}

function validPromptCount(draft: YearnOnboardingDraft): number {
  return draft.prompts.filter(
    (prompt) => normalizeYearnPromptAnswer(prompt.answer).length >= 10,
  ).length;
}

function profilePhotoCount(draft: YearnOnboardingDraft): number {
  return draft.photos.filter((photo) => photo.symbol).length;
}

export function calculateYearnOnboardingCompleteness(
  draft: YearnOnboardingDraft,
  referenceDate: Date = new Date(),
): number {
  const checks = [
    normalizeYearnDisplayName(draft.displayName).length > 0,
    evaluateYearnAgeGate(draft.birthdate, referenceDate).status === 'accepted',
    selectedPronouns(draft).length > 0,
    draft.genderIdentities.length > 0,
    draft.orientationIdentities.length === 0 || draft.orientationConsentGranted,
    draft.relationshipStructure.trim().length > 0,
    draft.intention.trim().length > 0,
    profilePhotoCount(draft) > 0,
    validPromptCount(draft) > 0,
    draft.interests.length >= 3,
    draft.verificationAcknowledged,
  ];

  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}

export function validateYearnOnboardingStep(
  draft: YearnOnboardingDraft,
  stepId: YearnOnboardingStepId,
  referenceDate: Date = new Date(),
): YearnOnboardingValidationResult {
  const errors: string[] = [];
  const displayName = normalizeYearnDisplayName(draft.displayName);
  const ageGate = evaluateYearnAgeGate(draft.birthdate, referenceDate);
  const pronouns = selectedPronouns(draft);

  if (stepId === 'name' || stepId === 'review' || stepId === 'done') {
    if (displayName.length < 1 || displayName.length > 60) {
      errors.push('Enter a display name between 1 and 60 characters.');
    }
  }

  if (stepId === 'age_pronouns' || stepId === 'review' || stepId === 'done') {
    if (ageGate.status !== 'accepted') {
      errors.push(ageGate.message ?? 'Enter a valid adult birthdate.');
    }
    if (pronouns.length < 2) {
      errors.push('Choose pronouns or enter custom pronouns.');
    }
  }

  if (stepId === 'identity' || stepId === 'review' || stepId === 'done') {
    if (draft.genderIdentities.length === 0) {
      errors.push('Choose at least one gender identity.');
    }
    if (draft.orientationIdentities.length > 0 && !draft.orientationConsentGranted) {
      errors.push('Consent is required before saving orientation data.');
    }
    if (draft.relationshipStructure.trim().length === 0) {
      errors.push('Choose a relationship structure.');
    }
    if (draft.intention.trim().length === 0) {
      errors.push('Choose what you are looking for.');
    }
  }

  if (stepId === 'photos' || stepId === 'review' || stepId === 'done') {
    if (profilePhotoCount(draft) === 0) {
      errors.push('Add at least one profile photo placeholder.');
    }
  }

  if (stepId === 'prompts' || stepId === 'review' || stepId === 'done') {
    if (validPromptCount(draft) === 0) {
      errors.push('Answer at least one prompt with 10 or more characters.');
    }
  }

  if (stepId === 'interests' || stepId === 'review' || stepId === 'done') {
    if (draft.interests.length < 3) {
      errors.push('Choose at least three interests.');
    }
  }

  if (stepId === 'verify' || stepId === 'review' || stepId === 'done') {
    if (!draft.verificationAcknowledged) {
      errors.push('Acknowledge the verification status.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateYearnOnboardingDraft(
  draft: YearnOnboardingDraft,
  referenceDate: Date = new Date(),
): YearnOnboardingValidationResult {
  const errors = YEARN_ONBOARDING_STEPS.flatMap((step) => (
    step.id === 'welcome' ? [] : validateYearnOnboardingStep(draft, step.id, referenceDate).errors
  ));

  return {
    isValid: errors.length === 0,
    errors: [...new Set(errors)],
  };
}

export function buildYearnProfileUpsertInput(
  draft: YearnOnboardingDraft,
  referenceDate: Date = new Date(),
): YearnProfileUpsertInput {
  const validation = validateYearnOnboardingDraft(draft, referenceDate);
  if (!validation.isValid) {
    throw new Error(validation.errors[0] ?? 'Complete onboarding before saving.');
  }

  const displayName = normalizeYearnDisplayName(draft.displayName);
  const birthdate = evaluateYearnAgeGate(draft.birthdate, referenceDate).birthdate;
  if (!birthdate) {
    throw new Error('Enter a valid adult birthdate.');
  }

  return {
    displayName,
    birthday: birthdate,
    pronouns: selectedPronouns(draft),
    customPronouns: draft.pronouns === 'custom'
      ? draft.customPronouns.trim()
      : '',
    genderIdentities: [...draft.genderIdentities],
    orientationIdentities: consentedOrientationIdentities(draft),
    identityVisibility: { ...draft.visibility },
    orientationConsentGrantedAt: draft.orientationConsentGranted
      && draft.orientationIdentities.length > 0
      ? referenceDate.toISOString()
      : null,
    orientationConsentWithdrawnAt: null,
    intention: draft.intention.trim(),
    relationshipStructure: draft.relationshipStructure.trim(),
    photos: draft.photos
      .filter((photo) => photo.symbol)
      .map((photo) => ({
        symbol: photo.symbol,
        tint_hex: photo.tintHex,
        caption: photo.caption.trim() || undefined,
        path: photo.path,
        show_on_profile: draft.visibility.photos && photo.showOnProfile,
      })),
    prompts: draft.prompts
      .filter((prompt) => normalizeYearnPromptAnswer(prompt.answer).length >= 10)
      .map((prompt) => ({
        question: prompt.question,
        answer: normalizeYearnPromptAnswer(prompt.answer),
        show_on_profile: draft.visibility.prompts && prompt.showOnProfile,
      })),
    interests: [...draft.interests],
    isPaused: false,
  };
}
