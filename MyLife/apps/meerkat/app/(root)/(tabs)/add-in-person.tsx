// Add / pair in person (Plan 53 P2): the proximity ceremony screen. Hidden
// route, reached from Add friend (mode=friend) and Sync's Pairing section
// (mode=device); both run the IDENTICAL ceremony and differ only in copy.
//
// Honesty boundaries on this screen:
//  - Without the native Nearby module (Expo Go / web build) the screen states
//    plainly that the feature needs the full app; nothing pretends to search.
//  - The five-emoji comparison is the security control against an in-room
//    relay attacker. Confirm exists in exactly one phase and there is no path
//    that auto-confirms.
//  - The committed bundle is written through the provider's ONE pairing path
//    (pairWithVerifiedBundle -> applyTrustedBundle), so an in-person add is
//    byte-equivalent to the pasted MKPAIR1 flow (AC-5).
//  - Backgrounding or leaving mid-ceremony cancels it; nothing persists unless
//    both sides confirmed (AC-2).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { createSignedIdentityBundle, type CeremonyState, type SignedIdentityBundle } from '@mylife/sync';
import { loadNativeNearbyModule } from '@mylife/meerkat-native-transport';
import { useIdentity } from '../providers/IdentityProvider';
import { useSync } from '../providers/SyncProvider';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { startProximityCeremony, type CeremonyRunner } from '../data/proximity-ceremony-adapter';
import { readPresentationProfile } from '../data/person-identity-core';
import { ensureDirectConversation } from '../data/dm-view-core';
import {
  ceremonyModeFromParam,
  ceremonyScreenModel,
  inPersonWindowLine,
  ALREADY_PAIRED_LINE,
  IN_PERSON_ENTRY_TITLE,
  IN_PERSON_NEARBY_PAUSE_LINE,
  IN_PERSON_NEEDS_DEV_BUILD_LINE,
  IN_PERSON_NO_SERVER_LINE,
  IN_PERSON_PAIR_ENTRY_TITLE,
} from '../data/proximity-ceremony-view-core';
import { Button, HonestNotice } from '../components/kit';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export default function AddInPersonScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = ceremonyModeFromParam(params.mode);
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { pairWithVerifiedBundle, announcePersonToFriend, confirmPeerSas } = useSync();

  // One bridge over the shared native module for this screen's lifetime. Null
  // in Expo Go and any build without the native side: the honest-copy branch.
  const mod = useMemo(() => loadNativeNearbyModule(), []);

  const [ceremonyState, setCeremonyState] = useState<CeremonyState | null>(null);
  // undefined = commit write not recorded yet; null = written; string = refused.
  const [commitError, setCommitError] = useState<string | null | undefined>(undefined);
  const [runKey, setRunKey] = useState(0);
  const runnerRef = useRef<CeremonyRunner | null>(null);
  /** The peer bundle a committed ceremony delivered; drives the DM action (P3). */
  const peerRef = useRef<SignedIdentityBundle | null>(null);
  // Latest-refs so a provider re-render never restarts a live ceremony.
  const pairRef = useRef(pairWithVerifiedBundle);
  pairRef.current = pairWithVerifiedBundle;
  const announceRef = useRef(announcePersonToFriend);
  announceRef.current = announcePersonToFriend;
  const confirmSasRef = useRef(confirmPeerSas);
  confirmSasRef.current = confirmPeerSas;

  useEffect(() => {
    if (!mod) return undefined;
    setCommitError(undefined);
    peerRef.current = null;
    // P3 (plan 52 integration): the bundle sent in the ceremony carries this
    // person's presentation-profile name when one exists, so the peer's
    // "Confirm Adding [name]" popup shows the name this person chose to
    // present, not a stale device label. Signed with the same device keys.
    const presentationName = readPresentationProfile(db)?.displayName.trim();
    const ceremonyIdentity = presentationName && presentationName !== identity.displayName
      ? { ...identity, displayName: presentationName }
      : identity;
    const runner = startProximityCeremony({
      mod,
      identity,
      selfBundle: createSignedIdentityBundle(ceremonyIdentity),
      onState: setCeremonyState,
      onCommitted: (peer: SignedIdentityBundle) => {
        peerRef.current = peer;
        const written = pairRef.current(peer);
        setCommitError(written);
        const paired = written === null || written === ALREADY_PAIRED_LINE;
        // MK-017: the ceremony IS an out-of-band SAS comparison (both users
        // confirmed the same five emoji), so record the pairwise SAS verification
        // now. Without this, the community SAS gate would force a redundant emoji
        // step on the Sync screen before this in-person friend could sync a
        // shared community. Best-effort; never blocks the pairing result.
        if (paired) confirmSasRef.current(peer.bundle.deviceId);
        // P3: a written FRIEND pairing (or the benign already-paired re-run)
        // queues + best-effort parks this person's DM-scoped announce, so the
        // new friend renders the person, not a bare device. Never blocks the
        // pairing result the user is reading.
        if (mode === 'friend' && paired) {
          // Best-effort by design: a failed announce leaves it queued for the
          // next drain and must never reject unhandled or block the pairing
          // result the user is reading.
          announceRef.current(peer.bundle.deviceId).catch(() => undefined);
        }
      },
    });
    runnerRef.current = runner;
    setCeremonyState(runner.state());
    // AC-2: backgrounding mid-ceremony cancels it. A terminal runner's cancel
    // is a no-op, so this can never clobber a committed result.
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') runner.cancel();
    });
    return () => {
      sub.remove();
      runner.cancel();
    };
  }, [mod, db, identity, mode, runKey]);

  const title = mode === 'device' ? IN_PERSON_PAIR_ENTRY_TITLE : IN_PERSON_ENTRY_TITLE;
  const model = ceremonyState ? ceremonyScreenModel(ceremonyState, mode, commitError) : null;

  // Hidden deep-linkable route: back falls through to this mode's entry screen
  // when the ceremony is the stack's only route.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(mode === 'device' ? '/sync' : '/add-friend');
  }, [router, mode]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={goBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <ChevronLeft size={24} color={c.text} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
        </View>

        {!mod ? (
          <View style={styles.panel}>
            <HonestNotice text={IN_PERSON_NEEDS_DEV_BUILD_LINE} />
            <Button title="Back" variant="secondary" onPress={goBack} />
          </View>
        ) : model ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.headline}>{model.headline}</Text>
              {model.busy ? <ActivityIndicator color={c.accent} style={styles.spinner} /> : null}
              {model.sasEmoji ? (
                <Text style={styles.sasEmoji} accessibilityLabel="Safety emoji to compare">
                  {model.sasEmoji.join('  ')}
                </Text>
              ) : null}
              <Text style={model.tone === 'error' ? styles.errorText : styles.detail}>
                {model.detail}
              </Text>
              {model.confirmEnabled ? (
                <Button
                  title={`Confirm Adding ${model.peerName ?? 'this person'}`}
                  onPress={() => runnerRef.current?.confirm()}
                />
              ) : null}
              {model.cancelEnabled ? (
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => runnerRef.current?.cancel()}
                />
              ) : null}
              {model.retryEnabled ? (
                <Button title="Try again" onPress={() => setRunKey((k) => k + 1)} />
              ) : null}
              {model.showMessageButton && peerRef.current ? (
                <Button
                  title={`Message ${model.peerName ?? 'them'}`}
                  onPress={() => {
                    const peer = peerRef.current;
                    if (!peer) return;
                    const conversationId = ensureDirectConversation(db, identity, {
                      deviceId: peer.bundle.deviceId,
                      dhPublicKey: peer.bundle.dhPublicKey,
                    });
                    router.replace({ pathname: '/dm/[conversationId]', params: { conversationId } });
                  }}
                />
              ) : null}
              {model.tone === 'success' ? (
                <Button title="Done" variant="secondary" onPress={goBack} />
              ) : null}
            </View>
            {model.showContextLines ? (
              <View style={styles.contextBlock}>
                <HonestNotice text={IN_PERSON_NO_SERVER_LINE} />
                <Text style={styles.contextLine}>{IN_PERSON_NEARBY_PAUSE_LINE}</Text>
                <Text style={styles.contextLine}>{inPersonWindowLine()}</Text>
              </View>
            ) : null}
          </>
        ) : null}

        <View style={{ height: insets.bottom + 96 }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -8 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: c.text, fontSize: 26, fontWeight: '800' },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  headline: { color: c.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  spinner: { alignSelf: 'center' },
  sasEmoji: { fontSize: 34, textAlign: 'center', letterSpacing: 2 },
  detail: { color: c.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  errorText: { color: c.danger, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  contextBlock: { gap: 8 },
  contextLine: { color: c.textTertiary, fontSize: 12.5, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
