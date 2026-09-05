// Supabase deep-link callback. Email magic links and password-recovery
// links open dowork://auth-callback; this screen exchanges the carried
// code/tokens into a real Supabase session (the client runs with
// detectSessionInUrl: false), then routes home or into password reset.

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { completeAuthCallback, parseAuthCallbackUrl, type ParsedAuthCallback } from './data/account';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import { DW_ACCENT, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from './theme/tokens';
import { WK_FONTS } from '@mylife/workouts';

function firstString(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const url = ExpoLinking.useLinkingURL();
  const cloud = useDoWorkCloud();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (!cloud.isReady) return;

    if (!cloud.supabase) {
      startedRef.current = true;
      setError('Cloud is not configured on this build, so email sign-in links cannot complete.');
      return;
    }
    const supabase = cloud.supabase;

    // Fragment tokens (#access_token=...) never reach router params, so
    // prefer the raw deep-link URL; fall back to parsed query params.
    let parsed: ParsedAuthCallback;
    if (url && url.includes('auth-callback')) {
      parsed = parseAuthCallbackUrl(url);
    } else {
      parsed = {
        code: firstString(params.code as string | string[] | undefined),
        accessToken: firstString(params.access_token as string | string[] | undefined),
        refreshToken: firstString(params.refresh_token as string | string[] | undefined),
        type: firstString(params.type as string | string[] | undefined),
        errorDescription:
          firstString(params.error_description as string | string[] | undefined) ??
          firstString(params.error as string | string[] | undefined),
      };
    }

    // Nothing usable yet: params can hydrate a frame after mount. Wait for
    // either a URL or params rather than bailing to a false error.
    if (!parsed.code && !parsed.accessToken && !parsed.errorDescription && !url) return;

    startedRef.current = true;
    void (async () => {
      const result = await completeAuthCallback(supabase, parsed);
      if (!result.ok) {
        setError(
          result.error ??
            'This sign-in link could not be completed. Request a new link and try again.',
        );
        return;
      }
      await cloud.refreshIdentity();
      if (result.type === 'recovery') {
        router.replace('/(root)/reset-password');
      } else {
        router.replace('/(root)/(tabs)');
      }
    })();
  }, [cloud, params, url]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Sign-in link problem</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.86 }]}
          onPress={() => router.replace('/(root)/account')}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
        >
          <Text style={styles.buttonLabel}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={DW_ACCENT} />
      <Text style={styles.workingText}>Finishing sign-in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DW_SURFACES.base,
    paddingHorizontal: 32,
    gap: 12,
  },
  workingText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    color: DW_TEXT.secondary,
  },
  errorTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 20,
    color: DW_TEXT.primary,
    textAlign: 'center',
  },
  errorBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  button: {
    marginTop: 12,
    backgroundColor: DW_ACCENT,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  buttonLabel: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_ON_ACCENT,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
