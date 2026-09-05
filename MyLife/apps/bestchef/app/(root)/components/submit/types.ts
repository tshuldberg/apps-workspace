export type SubmitStep =
  | 'dishSelection'
  | 'finalPhotos'
  | 'ingredients'
  | 'video'
  | 'details'
  | 'review';

export const WIZARD_STEPS: Exclude<SubmitStep, 'dishSelection'>[] = [
  'finalPhotos',
  'ingredients',
  'video',
  'details',
  'review',
];

export function wizardStepIndex(step: SubmitStep): number {
  return WIZARD_STEPS.indexOf(step as Exclude<SubmitStep, 'dishSelection'>);
}

export function stepSubtitle(step: SubmitStep): string {
  switch (step) {
    case 'dishSelection': return '';
    case 'finalPhotos': return 'Photos of the plated dish';
    case 'ingredients': return 'Mise en place ingredients';
    case 'video': return 'Optional 5-min cook-along';
    case 'details': return 'Recipe details';
    case 'review': return 'Final review';
  }
}
