import { getInvitationIntent } from './data/invitation-intent-core';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { ChevronLeft } from 'lucide-react-native';
import { createHostedAuthBearer } from '@mylife/sync';
import { Button, HonestNotice } from './components/kit';
import { AccountSection } from './components/AccountSection';
import { type MkColors, MK_RADIUS } from './theme/tokens';
import { useAppThemeColors, useMkStyles } from './providers/AppThemeProvider';
import { useMeerkatDatabase } from './providers/DatabaseProvider';
import { useIdentity } from './providers/IdentityProvider';
import { deleteSetting, getSetting, setSetting } from './data/db';
import {
  APP_UNLOCK_PURCHASED_AT_KEY,
  APP_UNLOCK_RECEIPT_KEY,
  APP_UNLOCK_GRANT_KEY,
  FALLBACK_UNLOCK_PRICE_LABEL,
  ensurePurchasesConfigured,
  getUnavailableReason,
  getUnlockPriceLabel,
  isPurchasesConfigured,
  mintMobileAppUnlockLink,
  purchaseAppUnlock,
  refreshAppUnlock,
  restoreAppUnlock,
} from './data/app-unlock';
import { notifyMobileAppUnlockChanged } from './data/app-unlock-runtime';
import {
  isStoreActionBusy,
  phaseAfterStoreFailure,
  showsRestoreAction,
  type UnlockPhase,
} from './data/unlock-view-core';

/** Screen phase drives the 5 honest states (loading / empty / error / success / partial). */
type Phase = UnlockPhase;

function hostedApiBase(): string {
  const value = (Constants.expoConfig?.extra as { hostedApiUrl?: unknown } | undefined)?.hostedApiUrl;
  return typeof value === 'string' ? value.trim().replace(/\/+$/u, '') : '';
}

export default function UpgradeScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();

  const [phase, setPhase] = useState<Phase>('loading');
  const [priceLabel, setPriceLabel] = useState<string>(FALLBACK_UNLOCK_PRICE_LABEL);
  const [message, setMessage] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [mintedLink, setMintedLink] = useState<{ code: string; expiresAt: string } | null>(null);

  const apiBase = hostedApiBase();

  // Reached via the entitlement gate's replace, this screen can be the ONLY
  // entry in the stack: back must then land somewhere real, not no-op. While
  // still locked the tabs root would bounce straight back here, so fall back
  // to the free Discover tab instead.
  const leaveScreen = useCallback(() => {
    if (router.canGoBack()) { router.back(); return; }
    router.replace(phase === 'unlocked' ? '/' : '/discover');
  }, [phase, router]);

  // Cache the unlock locally (device-local mk_settings; never synced). The cache
  // keeps offline launches working, but is re-validated by Restore on cold start;
  // it never grants unlock on a fresh install on its own.
  const persistUnlock = useCallback(
    (purchaseDate: string | null, grant?: string | null) => {
      setSetting(db, APP_UNLOCK_RECEIPT_KEY, 'unlocked');
      if (purchaseDate) setSetting(db, APP_UNLOCK_PURCHASED_AT_KEY, purchaseDate);
      if (grant) setSetting(db, APP_UNLOCK_GRANT_KEY, grant);
      else deleteSetting(db, APP_UNLOCK_GRANT_KEY);
      notifyMobileAppUnlockChanged();
    },
    [db],
  );

  const loadPrice = useCallback(async () => {
    setPhase('loading');
    const cfg = ensurePurchasesConfigured(undefined, undefined, identity);
    if (!cfg.configured) {
      setMessage(cfg.reason ?? getUnavailableReason());
      setPhase('unavailable');
      return;
    }
    const priced = await getUnlockPriceLabel(identity);
    if (priced.ok) {
      setPriceLabel(priced.priceLabel);
      setPhase('ready');
    } else {
      // The store quotes no price here (Expo Go / store unreachable): stay honest.
      setMessage(priced.error);
      setPhase('unavailable');
    }
  }, [identity]);

  useEffect(() => {
    // The local cache is only a hint. Never render or mount paid state until the
    // store has revalidated it on this launch.
    if (getSetting(db, APP_UNLOCK_RECEIPT_KEY) === 'unlocked') {
      void (async () => {
        const result = await refreshAppUnlock(identity);
        if (result.ok && result.unlock.unlocked) {
          persistUnlock(result.unlock.purchaseDate);
          setPhase('unlocked');
          return;
        }
        deleteSetting(db, APP_UNLOCK_RECEIPT_KEY);
        deleteSetting(db, APP_UNLOCK_PURCHASED_AT_KEY);
        notifyMobileAppUnlockChanged();
        setMessage(result.ok
          ? 'Your previous purchase is no longer active on this store account.'
          : 'Meerkat could not verify the previous purchase. Reconnect and use Restore purchase.');
        void loadPrice();
      })();
      return;
    }
    void loadPrice();
  }, [db, identity, loadPrice, persistUnlock]);

  // Both store actions guard re-entry (a double tap must never start two native
  // flows) and always leave the busy phase via try/catch, so a rejected native
  // promise can never strand the screen in a busy state with dead buttons.
  const onPurchase = useCallback(async () => {
    if (isStoreActionBusy(phase)) return;
    setMessage(null);
    setPhase('purchasing');
    try {
      const outcome = await purchaseAppUnlock(identity);
      if (outcome.ok) {
        if (outcome.unlock.unlocked) {
          persistUnlock(outcome.unlock.purchaseDate);
          setPhase('unlocked');
        } else {
          // The store reported no active unlock after the flow: do NOT fake it.
          setMessage('The purchase did not register an unlock. Try Restore, or contact support.');
          setPhase('error');
        }
        return;
      }
      if (outcome.cancelled) {
        setPhase('ready'); // soft dismissal
        return;
      }
      setMessage(outcome.error);
      setPhase(phaseAfterStoreFailure(isPurchasesConfigured()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The purchase could not start.');
      setPhase(phaseAfterStoreFailure(isPurchasesConfigured()));
    }
  }, [identity, persistUnlock, phase]);

  const onRestore = useCallback(async () => {
    if (isStoreActionBusy(phase)) return;
    setMessage(null);
    setPhase('restoring');
    try {
      const result = await restoreAppUnlock(identity);
      if (result.ok && result.unlock.unlocked) {
        persistUnlock(result.unlock.purchaseDate);
        setPhase('unlocked');
        return;
      }
      if (result.ok) {
        setMessage('No previous purchase found on this store account.');
        setPhase('ready');
        return;
      }
      setMessage(result.error);
      setPhase(phaseAfterStoreFailure(isPurchasesConfigured()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Restore could not start.');
      setPhase(phaseAfterStoreFailure(isPurchasesConfigured()));
    }
  }, [identity, persistUnlock, phase]);

  const onMintLink = useCallback(async () => {
    if (linkBusy) return;
    setLinkBusy(true);
    setLinkNote(null);
    const result = await mintMobileAppUnlockLink(identity, apiBase);
    if (result.ok) setMintedLink({ code: result.code, expiresAt: result.expiresAt });
    else setLinkNote(result.error);
    setLinkBusy(false);
  }, [apiBase, identity, linkBusy]);

  // Cross-rail: redeem a Link code minted on the OTHER rail (e.g. bought on web).
  // Needs the hosted connection server; the code is verified server-side and this
  // device only caches the resulting unlock. Disabled with honest copy otherwise.
  const onRedeemLink = useCallback(async () => {
    const code = linkCode.trim();
    if (!code || !apiBase) return;
    setLinkBusy(true);
    setLinkNote(null);
    try {
      const res = await fetch(`${apiBase}/api/entitlements/meerkat-app?link=${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${createHostedAuthBearer(identity)}` },
      });
      const body = (await res.json()) as { unlocked?: boolean; purchaseDate?: string | null; grant?: string };
      if (body.unlocked && typeof body.grant === 'string') {
        persistUnlock(body.purchaseDate ?? null, body.grant);
        setPhase('unlocked');
      } else {
        setLinkNote('That code is invalid, expired, or already used.');
      }
    } catch {
      setLinkNote('Could not reach the connection server to check that code.');
    } finally {
      setLinkBusy(false);
    }
  }, [apiBase, identity, linkCode, persistUnlock]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={leaveScreen}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <ChevronLeft size={24} color={c.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Unlock Meerkat</Text>
        {getInvitationIntent(db) ? <HonestNotice text="An invitation is waiting. After unlock, return to it to preview and confirm joining." /> : null}
      </View>

      {phase === 'unlocked' ? (
        <View style={styles.panel}>
          <Text style={styles.unlockedTitle}>Unlocked</Text>
          <Text style={styles.body}>Full private use is on, forever. No subscription.</Text>
          <Button title="Done" onPress={leaveScreen} />
        </View>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.body}>
            Meerkat is free to browse public channels, communities, and forums. A one-time{' '}
            <Text style={styles.bold}>{priceLabel}</Text> unlocks full private use forever: create and seal your own
            content, direct messages, your own communities, device-to-device sync over Wi-Fi or a connection server, and
            self-hosting. No subscription. No account required.
          </Text>

          {phase === 'loading' ? (
            <View style={styles.centerRow}>
              <ActivityIndicator color={c.accent} />
              <Text style={styles.muted}>Loading store…</Text>
            </View>
          ) : phase === 'restoring' ? (
            <View style={styles.centerRow}>
              <ActivityIndicator color={c.accent} />
              <Text style={styles.muted}>Checking your purchases…</Text>
            </View>
          ) : phase === 'purchasing' ? (
            <View style={styles.centerRow}>
              <ActivityIndicator color={c.accent} />
              <Text style={styles.muted}>Contacting the store…</Text>
            </View>
          ) : phase === 'unavailable' ? (
            <>
              <Text style={styles.body}>
                Store not available here. Meerkat needs the App Store or Google Play to sell the unlock. Public browsing
                still works.
              </Text>
              {message ? <HonestNotice tone="warning" text={message} /> : null}
              {showsRestoreAction('unavailable', isPurchasesConfigured()) ? (
                <Button title="Restore purchase" variant="secondary" onPress={onRestore} />
              ) : (
                <Text style={styles.footnote}>
                  Buying and restoring are turned off because this build has no store connection. They work in a build
                  that includes it; nothing you do here can be charged.
                </Text>
              )}
            </>
          ) : (
            <>
              {message ? <HonestNotice tone={phase === 'error' ? 'danger' : 'warning'} text={message} /> : null}
              <Button title={`Unlock for ${priceLabel}`} onPress={onPurchase} />
              <Button title="Restore purchase" variant="secondary" onPress={onRestore} />
            </>
          )}

          <View style={styles.footnoteList}>
            <Text style={styles.footnote}>
              {'•'} One-time purchase. It never expires and is not a subscription.
            </Text>
            <Text style={styles.footnote}>
              {'•'} It unlocks private and local features on this device. Use Restore on other devices signed into
              the same store account.
            </Text>
            <Text style={styles.footnote}>
              {'•'} Buying on the web does not automatically unlock iOS or Android (and vice-versa), because
              Meerkat needs no account. To use one purchase on both, enter a link code below (needs a connection
              server).
            </Text>
            <Text style={styles.footnote}>
              {'•'} Hosted server space is a separate, optional service, billed only past the free tier.
            </Text>
          </View>
        </View>
      )}

      {phase !== 'unlocked' ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Bought on another device?</Text>
          {apiBase ? (
            <>
              <Text style={styles.body}>
                If you unlocked on the web, tap Link this purchase there for a one-time code, then enter it here.
              </Text>
              <TextInput
                style={styles.input}
                value={linkCode}
                onChangeText={setLinkCode}
                placeholder="Enter link code"
                placeholderTextColor={c.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!linkBusy}
              />
              {linkNote ? <HonestNotice tone="danger" text={linkNote} /> : null}
              <Button
                title={linkBusy ? 'Checking…' : 'Redeem code'}
                variant="secondary"
                disabled={linkBusy || linkCode.trim().length === 0}
                onPress={onRedeemLink}
              />
            </>
          ) : (
            <HonestNotice
              tone="warning"
              text="Linking a purchase across web and mobile needs Meerkat's hosted service, and this build has none configured. Link codes cannot be created or redeemed here."
            />
          )}
        </View>
      ) : null}

      {phase === 'unlocked' && apiBase ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Use this purchase elsewhere</Text>
          <Text style={styles.body}>Create a single-use code for the web or another store rail.</Text>
          <Button
            title={linkBusy ? 'Creating…' : 'Link this purchase'}
            variant="secondary"
            disabled={linkBusy}
            onPress={onMintLink}
          />
          {mintedLink ? (
            <>
              <Text style={styles.linkCode}>{mintedLink.code}</Text>
              <Text style={styles.footnote}>Expires {new Date(mintedLink.expiresAt).toLocaleString()}.</Text>
            </>
          ) : null}
          {linkNote ? <HonestNotice tone="danger" text={linkNote} /> : null}
        </View>
      ) : null}

      {/* Plan 51 P3: the verification-account section lives at the entitlement
          boundary (this unlock screen), never at first launch. Private mesh use
          stays account-free (AC-4). */}
      <AccountSection mode="unlock" />

      <View style={{ height: insets.bottom + 96 }} />
    </ScrollView>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: -8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  title: { flex: 1, color: c.text, fontSize: 24, fontWeight: '800' },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 14,
  },
  body: { color: c.text, fontSize: 15, lineHeight: 22 },
  bold: { fontWeight: '800', color: c.text },
  muted: { color: c.textSecondary, fontSize: 14 },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  footnote: { color: c.textSecondary, fontSize: 12.5, lineHeight: 19 },
  footnoteList: { gap: 6 },
  unlockedTitle: { color: c.accent, fontSize: 20, fontWeight: '800' },
  sectionTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  input: {
    backgroundColor: c.surfaceHigh,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.text,
    fontSize: 15,
  },
  linkCode: { color: c.accent, fontSize: 18, fontWeight: '800', letterSpacing: 0.8 },
});
