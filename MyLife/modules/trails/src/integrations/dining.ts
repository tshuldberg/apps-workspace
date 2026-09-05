export interface TrailsDiningPrompt {
  tripName: string;
  tripDates: { start: string; end: string };
  locationName?: string;
}

export function buildDiningPromptForTrip(context: TrailsDiningPrompt): {
  promptText: string;
  deepLink: string;
  sourceModule: 'dining';
} {
  const location = context.locationName ? ` in ${context.locationName}` : '';
  return {
    promptText: `Did you eat anywhere worth remembering${location} during "${context.tripName}"?`,
    deepLink: '/(dining)/restaurant/add',
    sourceModule: 'dining',
  };
}
