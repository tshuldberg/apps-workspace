import { describe, expect, it } from 'vitest';
import {
  buildYearnProfileUpsertInput,
  calculateYearnOnboardingCompleteness,
  createDefaultYearnOnboardingDraft,
  validateYearnOnboardingDraft,
  validateYearnOnboardingStep,
} from '../onboarding';

const now = new Date('2026-05-31T12:00:00.000Z');

function completeDraft() {
  return {
    ...createDefaultYearnOnboardingDraft({ birthdate: '1994-06-15' }),
    displayName: '  June   Carter  ',
    pronouns: 'custom',
    customPronouns: 'she/they',
    genderIdentities: ['Woman', 'Gender nonconforming'],
    orientationIdentities: ['Queer'],
    orientationConsentGranted: true,
    intention: 'Long-term relationship',
    relationshipStructure: 'Monogamous',
    prompts: [
      {
        id: 'prompt-1',
        question: 'A small ritual I love',
        answer: 'Morning coffee on the balcony.',
        showOnProfile: true,
      },
    ],
    interests: ['Cooking', 'Poetry', 'Museums'],
    verificationAcknowledged: true,
  };
}

describe('onboarding', () => {
  it('scores an incomplete draft without treating it as saveable', () => {
    const draft = createDefaultYearnOnboardingDraft();

    expect(calculateYearnOnboardingCompleteness(draft, now)).toBeLessThan(50);
    expect(validateYearnOnboardingDraft(draft, now).isValid).toBe(false);
  });

  it('validates the age and pronouns step with the adult gate', () => {
    const draft = {
      ...completeDraft(),
      birthdate: '2008-06-01',
    };

    const result = validateYearnOnboardingStep(draft, 'age_pronouns', now);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Yearn is only available to adults 18 and older.');
  });

  it('builds a profile upsert payload from a complete draft', () => {
    const payload = buildYearnProfileUpsertInput(completeDraft(), now);

    expect(payload).toEqual({
      displayName: 'June Carter',
      birthday: '1994-06-15',
      pronouns: 'she/they',
      customPronouns: 'she/they',
      genderIdentities: ['Woman', 'Gender nonconforming'],
      orientationIdentities: ['Queer'],
      identityVisibility: {
        pronouns: true,
        identity: true,
        genderIdentities: true,
        orientation: true,
        photos: true,
        prompts: true,
        interests: true,
      },
      orientationConsentGrantedAt: '2026-05-31T12:00:00.000Z',
      orientationConsentWithdrawnAt: null,
      intention: 'Long-term relationship',
      relationshipStructure: 'Monogamous',
      photos: [
        {
          symbol: 'sparkles',
          tint_hex: '#E8856B',
          path: null,
          show_on_profile: true,
        },
      ],
      prompts: [
        {
          question: 'A small ritual I love',
          answer: 'Morning coffee on the balcony.',
          show_on_profile: true,
        },
      ],
      interests: ['Cooking', 'Poetry', 'Museums'],
      isPaused: false,
    });
  });

  it('persists identity selections while carrying profile visibility toggles', () => {
    const payload = buildYearnProfileUpsertInput({
      ...completeDraft(),
      visibility: {
        pronouns: false,
        identity: false,
        genderIdentities: false,
        orientation: false,
        photos: false,
        prompts: false,
        interests: false,
      },
    }, now);

    expect(payload.pronouns).toBe('she/they');
    expect(payload.customPronouns).toBe('she/they');
    expect(payload.genderIdentities).toEqual(['Woman', 'Gender nonconforming']);
    expect(payload.orientationIdentities).toEqual(['Queer']);
    expect(payload.identityVisibility).toMatchObject({
      pronouns: false,
      identity: false,
      genderIdentities: false,
      orientation: false,
      photos: false,
      prompts: false,
      interests: false,
    });
    expect(payload.orientationConsentGrantedAt).toBe('2026-05-31T12:00:00.000Z');
    expect(payload.intention).toBe('Long-term relationship');
    expect(payload.relationshipStructure).toBe('Monogamous');
    expect(payload.photos[0]?.show_on_profile).toBe(false);
    expect(payload.prompts[0]?.show_on_profile).toBe(false);
    expect(payload.interests).toEqual(['Cooking', 'Poetry', 'Museums']);
  });

  it('requires explicit consent before saving orientation data', () => {
    const draft = {
      ...completeDraft(),
      orientationConsentGranted: false,
    };

    expect(validateYearnOnboardingDraft(draft, now)).toMatchObject({
      isValid: false,
      errors: expect.arrayContaining([
        'Consent is required before saving orientation data.',
      ]),
    });
  });
});
