'use server';

import {
  getPublicProfileByHandle,
  type PublicProfileSummary,
} from '@mylife/bestchef';

interface ActionResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

function success<T>(data: T): ActionResult<T> {
  return { ok: true, data, error: null };
}

function failure<T>(error: string): ActionResult<T> {
  return { ok: false, data: null, error };
}

export async function getPublicProfileAction(
  handle: string,
): Promise<ActionResult<PublicProfileSummary | null>> {
  try {
    const result = await getPublicProfileByHandle({ handle });
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[c/handle] getPublicProfileAction failed:', e);
    return failure('Failed to load public profile');
  }
}
