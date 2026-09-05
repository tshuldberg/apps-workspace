// ── Cross-Module Integration Types ──────────────────────────────────
// Standard interface for linking MyFriends as the "who" layer across
// other MyLife modules. All integrations are graceful stubs until
// partner modules implement companion tracking.

/** Activity from a partner module linked to a person. */
export interface IntegrationActivity {
  id: string;
  type: string;
  title: string;
  date: string;
  deepLinkPath: string;
}

/** Suggestion to hang out based on partner module data. */
export interface HangoutSuggestion {
  peopleNames: string[];
  activityTag: string;
  date: string;
  /** Source module that generated the suggestion (e.g. "dining", "workouts"). */
  source: string;
}

/** Standard interface every module integration exports. */
export interface ModuleIntegration {
  moduleId: string;
  /** Check if the partner module is registered and available. */
  isAvailable: () => boolean;
  /** Get activities from the partner module involving a person. */
  getActivitiesForPerson: (personId: string) => IntegrationActivity[];
  /** Suggest a hangout based on partner module data. */
  suggestHangout: (activityData: unknown) => HangoutSuggestion | null;
}
