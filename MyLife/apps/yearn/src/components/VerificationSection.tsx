import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AnySupabaseClient } from '../lib/supabase';
import { YearnRepository, type YearnVerificationState } from '../lib/yearnRepository';
import {
  captureVerificationSelfie,
  uploadVerificationSelfie,
} from '../lib/verification';
import {
  yearnColors,
  yearnRadius,
  yearnSpacing,
  yearnTypography,
} from '../theme/yearnTheme';

interface VerificationSectionProps {
  supabase: AnySupabaseClient | null;
  userId: string | null;
  isVerified: boolean;
}

function statusCopy(state: YearnVerificationState | null, isVerified: boolean): string {
  if (isVerified) return 'Your profile is verified.';
  if (!state) {
    return 'Verify your profile with a live selfie. A human reviewer compares it to your photos.';
  }
  switch (state.status) {
    case 'pending_review':
      return 'Your selfie is in review. The badge appears once a reviewer approves it.';
    case 'rejected':
      return state.reviewReason
        ? `Your last submission was not approved: ${state.reviewReason}`
        : 'Your last submission was not approved. You can try again.';
    case 'revoked':
      return 'Your verification was removed. You can submit a new selfie.';
    default:
      return 'Verify your profile with a live selfie.';
  }
}

/**
 * Selfie verification: capture (camera only) -> private upload ->
 * submit_verification. Approval is human review through the moderation
 * surface; the DB guard makes an unearned badge impossible, so this
 * section never claims verified state on its own.
 */
export function VerificationSection({ supabase, userId, isVerified }: VerificationSectionProps) {
  const [state, setState] = React.useState<YearnVerificationState | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    if (!supabase || !userId) return () => { cancelled = true; };
    void new YearnRepository(supabase).fetchMyVerification()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [supabase, userId, reloadToken]);

  const handleSubmit = React.useCallback(async () => {
    if (!supabase || !userId || isBusy) return;
    setIsBusy(true);
    setErrorText(null);
    try {
      const capture = await captureVerificationSelfie();
      if (!capture.ok) {
        if (capture.reason !== 'cancelled') setErrorText(capture.error);
        return;
      }
      const path = await uploadVerificationSelfie(supabase, {
        userId,
        localUri: capture.localUri,
        mimeType: capture.mimeType,
      });
      await new YearnRepository(supabase).submitVerification(path);
      setReloadToken((token) => token + 1);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, supabase, userId]);

  if (!supabase || !userId) return null;

  const canSubmit = !isVerified && state?.status !== 'pending_review';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Verification</Text>
      <Text style={styles.body}>{statusCopy(state, isVerified)}</Text>
      {canSubmit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submit a verification selfie"
          disabled={isBusy}
          onPress={() => { void handleSubmit(); }}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
            isBusy && styles.disabled,
          ]}
        >
          {isBusy ? (
            <ActivityIndicator color={yearnColors.inkwine} size="small" />
          ) : (
            <Text style={styles.buttonText}>Take verification selfie</Text>
          )}
        </Pressable>
      ) : null}
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopColor: yearnColors.line,
    borderTopWidth: 1,
    gap: yearnSpacing.sm,
    paddingTop: yearnSpacing.md,
  },
  sectionLabel: {
    color: yearnColors.textSecondary,
    ...yearnTypography.label,
  },
  body: {
    color: yearnColors.textSecondary,
    ...yearnTypography.body,
  },
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: yearnColors.coral,
    borderRadius: yearnRadius.pill,
    paddingHorizontal: yearnSpacing.lg,
    paddingVertical: 8,
  },
  buttonText: {
    color: yearnColors.inkwine,
    ...yearnTypography.body,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    color: yearnColors.alarm,
    ...yearnTypography.body,
  },
});
