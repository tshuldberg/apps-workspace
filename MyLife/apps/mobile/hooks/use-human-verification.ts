import { useCallback, useMemo } from 'react';
import { uuid } from '../lib/uuid';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  isHumanVerified,
  getHumanVerification,
  recordHumanVerification,
  type HumanVerification,
  type VerificationMethod,
} from '@mylife/db';
import { useDatabase } from '../components/DatabaseProvider';

/** Default user ID for local-only mode (no auth). */
const LOCAL_USER_ID = 'local';

export interface VerificationResult {
  success: boolean;
  error?: string;
}

/**
 * Hook for biometric human verification.
 *
 * The app receives ONLY a boolean from the OS Secure Enclave.
 * Biometric data never leaves the device and never reaches our code.
 */
export function useHumanVerification(userId: string = LOCAL_USER_ID) {
  const db = useDatabase();

  const verified = useMemo(
    () => isHumanVerified(db, userId),
    [db, userId],
  );

  const verification = useMemo(
    () => getHumanVerification(db, userId),
    [db, userId],
  );

  const requestVerification = useCallback(async (): Promise<VerificationResult> => {
    // Already verified? Skip the prompt.
    if (isHumanVerified(db, userId)) {
      return { success: true };
    }

    // Check hardware support
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      return { success: false, error: 'This device does not support biometric authentication.' };
    }

    // Check if biometrics are enrolled
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      return { success: false, error: 'No biometrics enrolled. Set up Face ID or Touch ID in Settings.' };
    }

    // Determine available method for the record
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    let method: VerificationMethod = 'biometric';
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      method = 'faceid';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      method = 'touchid';
    }

    // Prompt the user. We receive ONLY a boolean -- never biometric data.
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify you are human to post and trade',
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false,
    });

    if (!result.success) {
      const errorMsg = 'error' in result && result.error === 'user_cancel'
        ? 'Verification cancelled.'
        : 'Verification failed. Try again or use passcode.';
      return { success: false, error: errorMsg };
    }

    // Record the successful verification
    recordHumanVerification(db, {
      id: uuid(),
      userId,
      method,
    });

    return { success: true };
  }, [db, userId]);

  return {
    /** Whether the user has an active (non-revoked) verification. */
    verified,
    /** The current verification record, if any. */
    verification: verification as HumanVerification | undefined,
    /** Trigger the biometric prompt and record the result. */
    requestVerification,
  };
}
