'use server';

import { revalidatePath } from 'next/cache';
import {
  ClassesSettingsSchema,
  saveClassesSettings,
  type ClassesSettings,
} from '@mylife/classes';
import { getClassesDb } from '../data';

export type SaveSettingsResult =
  | { ok: true; settings: ClassesSettings }
  | { ok: false; error: string };

export async function saveClassesSettingsTyped(
  input: ClassesSettings,
): Promise<SaveSettingsResult> {
  try {
    const parsed = ClassesSettingsSchema.parse(input);
    const next = saveClassesSettings(getClassesDb(), parsed);
    revalidatePath('/classes');
    revalidatePath('/classes/assignments');
    revalidatePath('/classes/grades');
    revalidatePath('/classes/study');
    revalidatePath('/classes/settings');
    return { ok: true, settings: next };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save settings.',
    };
  }
}
