import { useCallback, useEffect, useReducer } from 'react';
import type { SubmitStep } from '../components/submit/types';
import { useDatabase } from '../providers/DatabaseProvider';

// ---------------------------------------------------------------------------
// Draft shape — mirrors are-blaze SubmitDraft
// ---------------------------------------------------------------------------

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface DraftIngredient {
  id: string;
  name: string;
  quantity: string;
}

export interface DraftPhoto {
  id: string;
  uri: string;
}

export interface DraftVideoClip {
  id: string;
  uri: string;
  type: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
}

export interface SelectedDishDraft {
  id: string;
  name: string;
  isProposed?: boolean;
  cuisine?: string;
  category?: string;
}

export interface SubmitDraftState {
  selectedDish: SelectedDishDraft | null;

  // Step 1 - finalPhotos
  finalPhotos: DraftPhoto[];

  // Step 2 - ingredients
  ingredientPhoto: DraftPhoto | null;
  ingredients: DraftIngredient[];

  // Step 3 - video
  videoClip: DraftVideoClip | null;

  // Step 4 - details
  title: string;
  description: string;
  cookMinutes: number;
  difficulty: Difficulty;
  region: string;
  isRestaurant: boolean;
  enterCompetition: boolean;
}

export const initialDraftState: SubmitDraftState = {
  selectedDish: null,
  finalPhotos: [],
  ingredientPhoto: null,
  ingredients: [],
  videoClip: null,
  title: '',
  description: '',
  cookMinutes: 30,
  difficulty: 'Medium',
  region: '',
  isRestaurant: false,
  enterCompetition: true,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'SET_DISH'; dish: SelectedDishDraft | null }
  | { type: 'ADD_FINAL_PHOTO'; photo: DraftPhoto }
  | { type: 'REMOVE_FINAL_PHOTO'; id: string }
  | { type: 'SET_INGREDIENT_PHOTO'; photo: DraftPhoto | null }
  | { type: 'ADD_INGREDIENT'; ingredient: DraftIngredient }
  | { type: 'REMOVE_INGREDIENT'; id: string }
  | { type: 'UPDATE_INGREDIENT'; ingredient: DraftIngredient }
  | { type: 'SET_VIDEO_CLIP'; clip: DraftVideoClip | null }
  | { type: 'SET_TITLE'; value: string }
  | { type: 'SET_DESCRIPTION'; value: string }
  | { type: 'SET_COOK_MINUTES'; value: number }
  | { type: 'SET_DIFFICULTY'; value: Difficulty }
  | { type: 'SET_REGION'; value: string }
  | { type: 'SET_IS_RESTAURANT'; value: boolean }
  | { type: 'SET_ENTER_COMPETITION'; value: boolean }
  | { type: 'HYDRATE'; state: SubmitDraftState }
  | { type: 'RESET' };

function reducer(state: SubmitDraftState, action: Action): SubmitDraftState {
  switch (action.type) {
    case 'SET_DISH': return { ...state, selectedDish: action.dish };
    case 'ADD_FINAL_PHOTO': return { ...state, finalPhotos: [...state.finalPhotos, action.photo] };
    case 'REMOVE_FINAL_PHOTO': return { ...state, finalPhotos: state.finalPhotos.filter((p) => p.id !== action.id) };
    case 'SET_INGREDIENT_PHOTO': return { ...state, ingredientPhoto: action.photo };
    case 'ADD_INGREDIENT': return { ...state, ingredients: [...state.ingredients, action.ingredient] };
    case 'REMOVE_INGREDIENT': return { ...state, ingredients: state.ingredients.filter((i) => i.id !== action.id) };
    case 'UPDATE_INGREDIENT': return { ...state, ingredients: state.ingredients.map((i) => i.id === action.ingredient.id ? action.ingredient : i) };
    case 'SET_VIDEO_CLIP': return { ...state, videoClip: action.clip };
    case 'SET_TITLE': return { ...state, title: action.value };
    case 'SET_DESCRIPTION': return { ...state, description: action.value };
    case 'SET_COOK_MINUTES': return { ...state, cookMinutes: action.value };
    case 'SET_DIFFICULTY': return { ...state, difficulty: action.value };
    case 'SET_REGION': return { ...state, region: action.value };
    case 'SET_IS_RESTAURANT': return { ...state, isRestaurant: action.value };
    case 'SET_ENTER_COMPETITION': return { ...state, enterCompetition: action.value };
    case 'HYDRATE': return action.state;
    case 'RESET': return initialDraftState;
    default: return state;
  }
}

// ---------------------------------------------------------------------------
// canAdvance — pure, per-step validation
// ---------------------------------------------------------------------------

export function draftIngredientHasName(ingredient: DraftIngredient): boolean {
  return ingredient.name.trim().length > 0;
}

export function hasUsableDraftIngredient(draft: SubmitDraftState): boolean {
  return draft.ingredients.some(draftIngredientHasName);
}

export function formatDraftIngredientLine(ingredient: DraftIngredient): string | null {
  if (!draftIngredientHasName(ingredient)) return null;
  const quantity = ingredient.quantity.trim();
  const name = ingredient.name.trim();
  return quantity ? `${quantity} ${name}` : name;
}

export function canAdvance(step: SubmitStep, draft: SubmitDraftState): boolean {
  switch (step) {
    case 'dishSelection':
      return draft.selectedDish !== null;
    case 'finalPhotos':
      return draft.finalPhotos.length > 0;
    case 'ingredients':
      return draft.ingredientPhoto !== null && hasUsableDraftIngredient(draft);
    case 'video':
      // Optional unless entering competition (require >= 300s)
      if (draft.enterCompetition) {
        const totalSeconds = draft.videoClip?.durationSeconds ?? 0;
        return totalSeconds >= 300;
      }
      return true;
    case 'details':
      return draft.title.trim().length > 0;
    case 'review':
      return true;
  }
}

// ---------------------------------------------------------------------------
// Persistence key (Option A: rc_settings JSON field)
// ---------------------------------------------------------------------------

const DRAFT_SETTINGS_KEY = 'submit_draft';

function parseDraftFromJson(raw: string): SubmitDraftState | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Basic shape guard
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      selectedDish: (parsed.selectedDish as SubmitDraftState['selectedDish']) ?? null,
      finalPhotos: Array.isArray(parsed.finalPhotos) ? (parsed.finalPhotos as DraftPhoto[]) : [],
      ingredientPhoto: (parsed.ingredientPhoto as DraftPhoto | null) ?? null,
      ingredients: Array.isArray(parsed.ingredients) ? (parsed.ingredients as DraftIngredient[]) : [],
      videoClip: (parsed.videoClip as DraftVideoClip | null) ?? null,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      cookMinutes: typeof parsed.cookMinutes === 'number' ? parsed.cookMinutes : 30,
      difficulty: (['Easy', 'Medium', 'Hard'] as Difficulty[]).includes(parsed.difficulty as Difficulty)
        ? (parsed.difficulty as Difficulty)
        : 'Medium',
      region: typeof parsed.region === 'string' ? parsed.region : '',
      isRestaurant: typeof parsed.isRestaurant === 'boolean' ? parsed.isRestaurant : false,
      enterCompetition: typeof parsed.enterCompetition === 'boolean' ? parsed.enterCompetition : true,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSubmitDraft() {
  const db = useDatabase();
  const [draft, dispatch] = useReducer(reducer, initialDraftState);

  // Hydrate from rc_settings on mount
  useEffect(() => {
    try {
      const rows = db.query<{ value: string }>(
        `SELECT value FROM rc_settings WHERE key = ?`,
        [DRAFT_SETTINGS_KEY],
      );
      if (rows[0]) {
        const parsed = parseDraftFromJson(rows[0].value);
        if (parsed) {
          dispatch({ type: 'HYDRATE', state: parsed });
        }
      }
    } catch {
      // rc_settings may not exist yet; safe to ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to rc_settings whenever draft changes
  const persistDraft = useCallback((state: SubmitDraftState) => {
    try {
      db.execute(
        `INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`,
        [DRAFT_SETTINGS_KEY, JSON.stringify(state)],
      );
    } catch {
      // Non-fatal: draft persistence is best-effort
    }
  }, [db]);

  // Wrap dispatch to persist after every mutation
  const dispatchAndPersist = useCallback((action: Action) => {
    dispatch(action);
  }, []);

  // Persist on every draft change (after state settles)
  useEffect(() => {
    persistDraft(draft);
  }, [draft, persistDraft]);

  return { draft, dispatch: dispatchAndPersist };
}
