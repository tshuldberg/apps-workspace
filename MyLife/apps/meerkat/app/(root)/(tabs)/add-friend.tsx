import { friendPublicationStatus } from '../data/friend-publication-core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ChevronLeft } from 'lucide-react-native';
import { buildContactEnvelope } from '../data/invite-envelope-core';
import { INSTALL_URL } from '../data/install-url';
import { useIdentity } from '../providers/IdentityProvider';
import { useSync } from '../providers/SyncProvider';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { loadNativeNearbyModule } from '@mylife/meerkat-native-transport';
import {
  ADD_FRIEND_NEEDS_SERVER_LINE,
  ensureAddFriendRelay,
  isPlausibleFriendCode,
  resolveAddFriendRelay,
} from '../data/add-friend-core';
import {
  IN_PERSON_ENTRY_HINT,
  IN_PERSON_ENTRY_TITLE,
  IN_PERSON_NEEDS_DEV_BUILD_LINE,
} from '../data/proximity-ceremony-view-core';
import { Button, SectionHeader } from '../components/kit';
import { ConnectionStatusCard } from '../components/ConnectionStatusCard';
import { QrCode } from '../components/QrCode';
import { QrScanner, isQrScannerAvailable } from '../components/QrScanner';
import { type MkColors, MK_MONO, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export default function AddFriendScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity, friendCode } = useIdentity();
  const { ready, publishFriendCode, pairWithFriendCode } = useSync();

  const [copied, setCopied] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState<'publish' | 'add' | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [publishedCode, setPublishedCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!publishedCode || expiresAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [publishedCode, expiresAt]);
  const publication = friendPublicationStatus(expiresAt, now);

  const [scanning, setScanning] = useState(false);
  const [, setPollTick] = useState(0);

  // Resolve a dialable relay ONLY through the health-gated choke point (TC-2);
  // never read the relay setting directly. Re-evaluated on every render (a cheap
  // synchronous db read) plus a light poll while unresolved, so the screen flips
  // from the ConnectionStatusCard fallback to the add form once the card's real
  // /healthz probe caches a reachable server.
  const { canResolve } = resolveAddFriendRelay(db);

  // Plan 53: whether the native Nearby module exists on this build. Null in
  // Expo Go; the in-person entry then shows honest copy, never a dead control.
  const nearbyAvailable = useMemo(() => loadNativeNearbyModule() !== null, []);

  // This fallback screen cannot change the relay inputs itself, so the poll's
  // only job is to catch ConnectionStatusCard's one-shot async probe completing.
  // Bound it (~60s) and key the effect on canResolve alone so the interval is
  // stable, not torn down every tick.
  useEffect(() => {
    if (canResolve) return;
    let elapsed = 0;
    const id = setInterval(() => {
      elapsed += 1;
      setPollTick((t) => t + 1);
      if (elapsed >= 30) clearInterval(id);
    }, 2000);
    return () => clearInterval(id);
  }, [canResolve]);

  const copyCode = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(publishedCode ?? friendCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setNote({ kind: 'error', text: 'Could not copy the code.' });
    }
  }, [friendCode, publishedCode]);

  // The relay re-probe runs INSIDE the busy window with an honest failure note:
  // a silent return on !ok (or a thrown probe) would be an idle-looking dead tap.
  const publish = useCallback(async () => {
    setBusy('publish');
    setNote(null);
    try {
      const { relayUrl: url, canResolve: ok } = await ensureAddFriendRelay(db);
      if (!ok) {
        setNote({ kind: 'error', text: 'No connection server answered just now. Check the connection status below and try again.' });
        return;
      }
      const code = await publishFriendCode(url, (receipt) => { setExpiresAt(receipt.expiresAt); setNow(Date.now()); });
      setPublishedCode(code);
      setNote({ kind: 'ok', text: 'Friend code published for a short time on this connection server.' });
    } catch (error: unknown) {
      setNote({ kind: 'error', text: error instanceof Error ? error.message : 'Could not publish your friend code.' });
    } finally {
      setBusy(null);
    }
  }, [db, publishFriendCode]);

  const addFriend = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (code.length === 0) return;
      setBusy('add');
      setNote(null);
      try {
        const { relayUrl: url, canResolve: ok } = await ensureAddFriendRelay(db);
        if (!ok) {
          setNote({ kind: 'error', text: 'No connection server answered just now. Check the connection status below and try again.' });
          return;
        }
        const error = await pairWithFriendCode(url, code);
        if (error) {
          setNote({ kind: 'error', text: error });
          return;
        }
        setCodeInput('');
        setNote({ kind: 'ok', text: 'Friend added. Compare the safety code before sharing sensitive spaces.' });
      } catch (error: unknown) {
        setNote({ kind: 'error', text: error instanceof Error ? error.message : 'Could not resolve that friend code.' });
      } finally {
        setBusy(null);
      }
    },
    [db, pairWithFriendCode],
  );

  if (scanning) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <QrScanner
          permissionRationale="Meerkat needs the camera only to scan a friend code. Nothing is photographed or stored."
          scanHint="Point the camera at a friend's code."
          onScan={(value) => {
            setScanning(false);
            const code = value.trim();
            setCodeInput(code);
            if (!isPlausibleFriendCode(code)) {
              setNote({ kind: 'error', text: 'That is not a valid friend code. Check for typos or scan again.' });
              return;
            }
            void addFriend(code);
          }}
          onCancel={() => setScanning(false)}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/messages'); }}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <ChevronLeft size={24} color={c.text} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Add friend</Text>
        </View>

        <View style={styles.panel}>
          <SectionHeader title="Your friend code" hint="Publish before sharing. Each publication can be used once; the connection server controls its expiry." />
          {publishedCode && !publication.expired ? <>
          <Text style={styles.code} selectable>{publishedCode ?? friendCode}</Text>
          <View style={styles.qrWrap}>
            <QrCode value={publishedCode ?? friendCode} size={180} accessibilityLabel="Friend code QR" />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy friend code"
            onPress={() => { void copyCode(); }}
            style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
          >
            <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy code'}</Text>
          </Pressable>
          {/* Ready-to-text contact card: install + add-friend steps wrapped
              around the code so it works for someone new to Meerkat. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share my contact"
            onPress={() => {
              Share.share({
                message: buildContactEnvelope({
                  displayName: identity.displayName,
                  friendCode: publishedCode ?? friendCode,
                  installUrl: INSTALL_URL,
                }),
              }).catch(() => {
                setNote({ kind: 'error', text: 'Could not open the share sheet.' });
              });
            }}
            style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
          >
            <Text style={styles.copyBtnText}>Share my contact</Text>
          </Pressable>
          <Text style={{ color: c.text }}>{publication.text}</Text>
          </> : <Text style={{ color: c.text }}>{publishedCode ? publication.text : 'Not published in this session. Publish my code below to create a shareable QR.'}</Text>}
        </View>

        {/* Plan 53: the in-person ceremony deliberately renders OUTSIDE the
            canResolve gate. The QR/friend-code flow needs a connection server;
            the whole point of adding in person is that it works with none. */}
        <View style={styles.panel}>
          <SectionHeader title={IN_PERSON_ENTRY_TITLE} hint={IN_PERSON_ENTRY_HINT} />
          {nearbyAvailable ? (
            <Button
              title={IN_PERSON_ENTRY_TITLE}
              variant="secondary"
              onPress={() => router.push('/add-in-person?mode=friend')}
            />
          ) : (
            <Text style={styles.noServerLine}>{IN_PERSON_NEEDS_DEV_BUILD_LINE}</Text>
          )}
        </View>

        {canResolve ? (
          <>
            <View style={styles.panel}>
              <SectionHeader title="Let friends find you" hint="Publishing puts an encrypted record on the connection server for a short time so a friend can resolve it. The server cannot read the record; the secret half that decrypts it travels only inside the code you share." />
              <Button
                title={busy === 'publish' ? 'Publishing...' : 'Publish my code'}
                variant="secondary"
                onPress={() => { void publish(); }}
                disabled={!ready || busy !== null}
              />
            </View>

            <View style={styles.panel}>
              <SectionHeader title="Add a friend" hint="Enter or scan their friend code." />
              <TextInput
                style={styles.input}
                value={codeInput}
                onChangeText={setCodeInput}
                placeholder="MEER-XXXX-XXXX-XXXX"
                placeholderTextColor={c.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel="Friend code"
              />
              {isQrScannerAvailable() ? (
                <Button
                  title="Scan their code"
                  variant="secondary"
                  onPress={() => { setNote(null); setScanning(true); }}
                  disabled={busy !== null}
                />
              ) : null}
              <Button
                title={busy === 'add' ? 'Resolving...' : 'Add friend'}
                onPress={() => { void addFriend(codeInput); }}
                disabled={!ready || busy !== null || codeInput.trim().length === 0}
              />
            </View>
          </>
        ) : (
          <View style={styles.noServerBlock}>
            <Text style={styles.noServerLine}>{ADD_FRIEND_NEEDS_SERVER_LINE}</Text>
            <ConnectionStatusCard />
          </View>
        )}

        {note ? (
          <Text style={note.kind === 'ok' ? styles.okText : styles.errorText}>{note.text}</Text>
        ) : null}

        <View style={{ height: insets.bottom + 96 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  code: {
    color: c.text,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: MK_MONO,
    textAlign: 'center',
  },
  qrWrap: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: MK_RADIUS.md,
  },
  copyBtn: {
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignSelf: 'center',
  },
  copyBtnText: { color: c.accent, fontSize: 13, fontWeight: '800' },
  input: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  noServerBlock: { gap: 10 },
  noServerLine: { color: c.textSecondary, fontSize: 13.5, fontWeight: '700', lineHeight: 20 },
  okText: { color: c.success, fontSize: 13, fontWeight: '700' },
  errorText: { color: c.danger, fontSize: 13 },
  pressed: { opacity: 0.7 },
});
