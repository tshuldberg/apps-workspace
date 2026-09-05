import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import type { ShareSource } from '@mylife/sync';
import { useMeerkatDatabase } from './DatabaseProvider';
import {
  ingestNativeShareIntent,
  type IncomingShareIntent,
} from '../data/share-intake-native';

// Lazy, Expo-Go-safe binding to expo-share-intent. The library uses
// requireOptionalNativeModule internally, so it never throws when the native
// module is absent; we still lazy-require the JS package (exactly like
// data/lan-backend.ts) so a build/test env WITHOUT the package installed
// degrades to a no-op instead of failing to resolve the import. `lib` is a
// module-level constant: it is either always present or always null for the app
// lifetime, so the conditional early-returns below never break the rules of
// hooks.
interface ShareIntentContextState {
  hasShareIntent: boolean;
  shareIntent: IncomingShareIntent;
  resetShareIntent: (clearNativeModule?: boolean) => void;
}
interface ShareIntentLib {
  ShareIntentProvider: React.ComponentType<{ children: React.ReactNode }>;
  useShareIntentContext: () => ShareIntentContextState;
}

let lib: ShareIntentLib | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  lib = require('expo-share-intent') as ShareIntentLib;
} catch {
  lib = null;
}

/**
 * Mounts the expo-share-intent provider ONLY when the package is present (a
 * dev/EAS build). In Expo Go it renders children directly and OS shares simply
 * never arrive -- the app still boots.
 */
export function ShareIntakeProvider({ children }: { children: React.ReactNode }) {
  if (!lib) return <>{children}</>;
  const Provider = lib.ShareIntentProvider;
  return <Provider>{children}</Provider>;
}

function shareSource(): ShareSource {
  return Platform.OS === 'ios' ? 'ios_share_extension' : 'android_share_intent';
}

function ActiveShareWatcher({ lib: activeLib }: { lib: ShareIntentLib }) {
  const db = useMeerkatDatabase();
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = activeLib.useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) return;
    // Copy bytes + re-sniff + stage device-locally, then open the inbox. The
    // native intent is cleared immediately so a warm relaunch does not re-stage.
    void ingestNativeShareIntent(db, shareIntent, shareSource())
      .then((result) => {
        if (result.staged > 0) router.push('/(root)/share-inbox');
      })
      .catch(() => undefined);
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent, db, router]);

  return null;
}

/**
 * Foreground watcher for incoming OS shares. Renders nothing; on a delivered
 * share it stages the item device-locally and routes the user to the Share
 * Inbox. A no-op when expo-share-intent is absent (Expo Go).
 */
export function ShareIntakeWatcher() {
  if (!lib) return null;
  return <ActiveShareWatcher lib={lib} />;
}
