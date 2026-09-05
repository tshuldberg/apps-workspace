import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { AppThemeProvider, useAppThemeColors } from './providers/AppThemeProvider';
import { DatabaseProvider } from './providers/DatabaseProvider';
import { IdentityProvider } from './providers/IdentityProvider';
import { NodeProvider } from './providers/NodeProvider';
import { SyncProvider } from './providers/SyncProvider';
import { ChatProvider } from './providers/ChatProvider';
import { StorageProvider } from './providers/StorageProvider';
import { CallProvider } from './providers/CallProvider';
import { ShareIntakeWatcher } from './providers/ShareIntakeWatcher';
import { OnboardingGate } from './components/OnboardingGate';
import { AgeGate } from './components/AgeGate';
import { isAgeGatePassed, subscribeAgeGateChanged } from './data/age-gate';
import { applyStoreAgeSignal, isSignedIn, liveAccountDeps, refreshStatus } from './data/account-core';
import { ThemeLinkListener } from './theme/ThemeLinkListener';
import { CommunityInviteLinkListener } from './components/CommunityInviteLinkListener';
import { useMeerkatDatabase } from './providers/DatabaseProvider';
import { mobilePathRequiresAppUnlock } from './data/app-access-policy';
import { isMobileAppUnlocked, subscribeMobileAppUnlockChanged } from './data/app-unlock-runtime';
import { isOnboardingComplete, subscribeOnboardingComplete } from './data/onboarding-core';
import { useIdentity } from './providers/IdentityProvider';
import {
  refreshAppUnlock,
  validateLinkedAppUnlock,
  APP_UNLOCK_GRANT_KEY,
  APP_UNLOCK_PURCHASED_AT_KEY,
  APP_UNLOCK_RECEIPT_KEY,
} from './data/app-unlock';
import { deleteSetting, getSetting, setSetting } from './data/db';
import { bootPushWake } from './data/push-wake-boot';

function AppStack({ unlocked }: { unlocked: boolean }) {
  const c = useAppThemeColors();
  const pathname = usePathname();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const [onboardingComplete, setOnboardingComplete] = useState(() => isOnboardingComplete(db));

  useEffect(
    () => subscribeOnboardingComplete(() => setOnboardingComplete(isOnboardingComplete(db))),
    [db],
  );

  // Entitlement gate. This must be an effect-driven replace, NEVER a <Redirect>
  // returned in place of the <Stack>: swapping the navigator out unmounts every
  // mounted screen in the same commit that other actors (the OnboardingGate
  // modal dismissing, its own imperative navigation) are touching the native
  // view hierarchy, which wedged iOS with a stuck modal presentation window
  // that swallowed all touches (founder freeze, 2026-08-30). Keeping the Stack
  // mounted makes the gate an ordinary route replace.
  const shouldGate = onboardingComplete && !unlocked && mobilePathRequiresAppUnlock(pathname);
  useEffect(() => {
    if (shouldGate) router.replace('/upgrade');
  }, [router, shouldGate]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="pinned/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="sync" />
      <Stack.Screen name="share-inbox/index" />
      <Stack.Screen name="persona/create" />
      <Stack.Screen name="persona/settings" />
      <Stack.Screen name="public/compose" />
      <Stack.Screen name="public/post/[postId]" />
      <Stack.Screen name="public/persona/[persona]" />
      <Stack.Screen name="public/topic/[channel]" />
      <Stack.Screen name="public/explore" />
    </Stack>
  );
}

function EntitledAppRuntime() {
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const [unlocked, setUnlocked] = useState(false);
  const [agePassed, setAgePassed] = useState(() => isAgeGatePassed(db));

  useEffect(
    () => subscribeAgeGateChanged(() => setAgePassed(isAgeGatePassed(db))),
    [db],
  );

  useEffect(() => {
    let cancelled = false;
    const validate = async (): Promise<void> => {
      if (!isMobileAppUnlocked(db)) {
        if (!cancelled) setUnlocked(false);
        return;
      }
      const grant = getSetting(db, APP_UNLOCK_GRANT_KEY);
      const hostedApiUrl = (Constants.expoConfig?.extra as { hostedApiUrl?: unknown } | undefined)?.hostedApiUrl;
      const result = grant
        ? await validateLinkedAppUnlock(
          identity,
          typeof hostedApiUrl === 'string' ? hostedApiUrl : '',
          grant,
        )
        : await refreshAppUnlock(identity);
      const active = result.ok && result.unlock.unlocked;
      if (active) {
        setSetting(db, APP_UNLOCK_RECEIPT_KEY, 'unlocked');
        if (result.unlock.purchaseDate) {
          setSetting(db, APP_UNLOCK_PURCHASED_AT_KEY, result.unlock.purchaseDate);
        }
      } else {
        deleteSetting(db, APP_UNLOCK_RECEIPT_KEY);
        deleteSetting(db, APP_UNLOCK_PURCHASED_AT_KEY);
        deleteSetting(db, APP_UNLOCK_GRANT_KEY);
      }
      if (!cancelled) setUnlocked(active);
    };
    void validate();
    return subscribeMobileAppUnlockChanged(() => { void validate(); });
  }, [db, identity]);

  // Plan 51 P3: when the verification account is configured AND a session exists,
  // refresh account status at boot and consume a store adult age signal into the
  // neutral age gate (never overwrites a locked/passed record; a minor/unknown
  // signal changes nothing). Unconfigured or signed-out => this is a no-op, and the
  // AgeGate below runs exactly as today (AC-4: private use never needs an account).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const deps = liveAccountDeps();
      if (!deps.config.configured) return;
      if (!(await isSignedIn(deps))) return;
      const status = await refreshStatus(deps);
      if (!cancelled && status.ok) applyStoreAgeSignal(db, status.account);
    })();
    return () => { cancelled = true; };
  }, [db]);

  // Plan 42 P5: register push wake once the app is unlocked (crypto + identity
  // are ready by this point: DatabaseProvider configured the MK-001 boot order
  // and IdentityProvider reconstructed the key before this runtime mounts). The
  // result is honest: on Expo Go / no dev build / no configured gateway it
  // reports unavailable and holds no registration; nothing is faked here.
  useEffect(() => {
    if (!unlocked) return;
    void bootPushWake(db);
  }, [db, unlocked]);

  return (
    <NodeProvider>
      <SyncProvider enabled={unlocked}>
        <ChatProvider>
          <StorageProvider>
            <CallProvider>
              <AppStack unlocked={unlocked} />
              {unlocked ? <ShareIntakeWatcher /> : null}
              <ThemeLinkListener />
              <CommunityInviteLinkListener unlocked={unlocked} agePassed={agePassed} />
              {/* The neutral age gate mounts first; onboarding mounts only after it
                  passes so the two modals never co-present (M1). */}
              <AgeGate />
              {agePassed ? <OnboardingGate unlocked={unlocked} /> : null}
            </CallProvider>
          </StorageProvider>
        </ChatProvider>
      </SyncProvider>
    </NodeProvider>
  );
}

export default function AppLayout() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <DatabaseProvider>
          <IdentityProvider>
            <EntitledAppRuntime />
          </IdentityProvider>
        </DatabaseProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
