// Just-in-time consent before a user photo is sent to a third-party AI provider
// for recognition (App Store Guideline 5.1.2: data sharing requires consent).
//
// The pure get/set helpers are unit-tested; ensureAiPhotoConsent wraps them in a
// one-time Alert. The image upload must NOT proceed when this resolves false.

import type { DatabaseAdapter } from '@mylife/db';

// Version-pinned so a future change to what we send AI providers can re-prompt.
export const AI_PHOTO_CONSENT_KEY = 'ai_photo_consent_version';
export const AI_PHOTO_CONSENT_VERSION = '2026-05-29';

export function getAiPhotoConsent(db: DatabaseAdapter): boolean {
  try {
    const rows = db.query<{ value: string }>(`SELECT value FROM rc_settings WHERE key = ?`, [
      AI_PHOTO_CONSENT_KEY,
    ]);
    return rows[0]?.value === AI_PHOTO_CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function setAiPhotoConsent(db: DatabaseAdapter): void {
  try {
    db.execute(`INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`, [
      AI_PHOTO_CONSENT_KEY,
      AI_PHOTO_CONSENT_VERSION,
    ]);
  } catch {
    // Best-effort: a failed write simply re-prompts next time.
  }
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Resolves true if the user has already consented or allows now; false if they
 * decline (or dismiss). Callers MUST abort the photo upload on a false result.
 */
export function ensureAiPhotoConsent(db: DatabaseAdapter, t: Translate): Promise<boolean> {
  if (getAiPhotoConsent(db)) return Promise.resolve(true);
  // Lazy require keeps the pure helpers above importable in non-RN (test) envs.
  const { Alert } = require('react-native') as typeof import('react-native');
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      t('Use AI to read this photo?'),
      t(
        'To identify items, your photo is sent securely to a third-party AI provider. It is not used to train AI models. You can enter items manually instead.',
      ),
      [
        { text: t('Not now'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: t('Allow'),
          onPress: () => {
            setAiPhotoConsent(db);
            resolve(true);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
