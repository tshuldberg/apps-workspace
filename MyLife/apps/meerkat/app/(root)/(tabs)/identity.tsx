import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Info } from 'lucide-react-native';
import { useIdentity, VANITY_MIN_LENGTH } from '../providers/IdentityProvider';
import { Button, HonestNotice, Mono, SectionHeader } from '../components/kit';
import { IdentityInfoModal } from '../components/IdentityInfoModal';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { getStoredPersona } from '../data/persona-core';
import { type MkColors, MK_MONO, MK_RADIUS, shortHex } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export default function IdentityScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const {
    identity,
    fingerprint,
    displayName,
    friendCode,
    isCustomFriendCode,
    setDisplayName,
    regenerateFriendCode,
    setCustomFriendCode,
  } = useIdentity();
  const insets = useSafeAreaInsets();

  const db = useMeerkatDatabase();
  const persona = getStoredPersona(db);
  const [draftName, setDraftName] = useState(displayName);
  const [vanity, setVanity] = useState('');
  const [vanityError, setVanityError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'key' | 'code' | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  const copy = useCallback(async (which: 'key' | 'code', value: string) => {
    // Clipboard is a throwing seam; "Copied" is claimed only after the await
    // resolves and a rejection renders instead of vanishing.
    try {
      await Clipboard.setStringAsync(value);
      setCopyError(null);
      setCopied(which);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
      setCopyError('Copy failed. Nothing was copied to the clipboard; try again.');
    }
  }, []);

  const saveName = useCallback(() => {
    setDisplayName(draftName);
  }, [draftName, setDisplayName]);

  const makeOwnCode = useCallback(() => {
    const result = setCustomFriendCode(vanity);
    if (result.ok) {
      setVanity('');
      setVanityError(null);
      return;
    }
    setVanityError(
      result.reason === 'invalid_chars'
        ? 'Use letters and numbers only (no spaces or symbols).'
        : `Use at least ${VANITY_MIN_LENGTH} letters or numbers.`,
    );
  }, [setCustomFriendCode, vanity]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Identity</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="How identity works"
          onPress={() => setInfoOpen(true)}
          style={({ pressed }) => [styles.infoBtn, pressed && styles.pressed]}
        >
          <Info size={20} color={c.accent} strokeWidth={2} />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>This device's keys live in the secure keychain</Text>

      <View style={styles.panel}>
        <SectionHeader title="Your name" hint="The name friends see. Just a label, so pick anything." />
        <TextInput
          style={styles.nameInput}
          value={draftName}
          onChangeText={setDraftName}
          placeholder="My Meerkat"
          placeholderTextColor={c.textTertiary}
          accessibilityLabel="Your name"
        />
        <Button
          title="Save name"
          variant="secondary"
          onPress={saveName}
          disabled={!draftName.trim() || draftName.trim() === displayName}
        />
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Your friend code" hint="Share this so a friend can connect with you." />
        <Text style={styles.friendCode} selectable>{friendCode}</Text>
        {isCustomFriendCode ? (
          <Text style={styles.codeTag}>You made this one</Text>
        ) : null}
        <View style={styles.btnRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy friend code"
            onPress={() => { void copy('code', friendCode); }}
            style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
          >
            <Text style={styles.copyBtnText}>{copied === 'code' ? 'Copied' : 'Copy code'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Regenerate a random friend code"
            onPress={regenerateFriendCode}
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
          >
            <Text style={styles.ghostBtnText}>New random code</Text>
          </Pressable>
        </View>
        {copyError ? <Text style={styles.errorText}>{copyError}</Text> : null}

        <Text style={styles.fieldLabel}>Make your own</Text>
        <View style={styles.vanityRow}>
          <TextInput
            style={styles.vanityInput}
            value={vanity}
            onChangeText={(text) => { setVanity(text); setVanityError(null); }}
            placeholder="a word, e.g. otter"
            placeholderTextColor={c.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Your word for a custom friend code"
          />
          <Button
            title="Make"
            onPress={makeOwnCode}
            disabled={vanity.trim().length === 0}
            style={styles.makeBtn}
          />
        </View>
        {vanityError ? <Text style={styles.errorText}>{vanityError}</Text> : null}
        <HonestNotice text="Meerkat adds random characters after your word so the code stays hard to guess. A short, common word is easier for someone to stumble onto, so pick something a bit unusual if you want it more private." />
      </View>

      <View style={styles.panel}>
        <SectionHeader
          title="Safety code"
          hint="Friends can compare this to be 100% sure it is really you."
        />
        <Text style={styles.safetyCode}>{fingerprint}</Text>

        <Text style={styles.fieldLabel}>Public key</Text>
        <View style={styles.monoBox}>
          <Mono>{shortHex(identity.publicKey, 20, 16)}</Mono>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy public key"
          onPress={() => { void copy('key', identity.publicKey); }}
          style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
        >
          <Text style={styles.copyBtnText}>{copied === 'key' ? 'Copied' : 'Copy public key'}</Text>
        </Pressable>
        {copyError ? <Text style={styles.errorText}>{copyError}</Text> : null}
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Public persona" hint="A separate identity for the public feed." />
        <Text style={styles.personaUsedFor}>Used for: your devices, friends, private communities, DMs. No account, no server, no verification needed. Unchanged.</Text>
        {persona ? (
          <>
            <View style={styles.personaRow}>
              <Text style={styles.personaAlias}>@{persona.alias}</Text>
              <Text style={styles.personaBadge}>verified</Text>
            </View>
            <Text style={styles.personaKey}>persona key {shortHex(persona.personaPubkey, 6, 4)} · separate key, separate life</Text>
            <Text style={styles.personaUsedFor}>Used for: the public feed, topics, public communities. What you post here is public and signed by this name only.</Text>
            <View style={styles.btnRow}>
              <Button title="Manage" variant="secondary" onPress={() => router.push('/persona/settings')} style={styles.personaBtn} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.personaUsedFor}>Used to browse and post on the public feed. It is a separate identity from this device, with its own key.</Text>
            <Button title="Create a public name" variant="secondary" onPress={() => router.push('/persona/create')} />
          </>
        )}
        <HonestNotice text={`These two identities are cryptographically unrelated. Meerkat's servers see the persona and never the device key. Nothing you do privately can be tied to ${persona ? `@${persona.alias}` : 'your public name'}, and we prove this with tests, not promises.`} />
      </View>

      <View style={{ height: insets.bottom + 96 }} />

      <IdentityInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </ScrollView>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  infoBtn: {
    padding: 8,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.surfaceHigh,
  },
  subtitle: { color: c.textSecondary, fontSize: 14, marginTop: -6 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  nameInput: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: c.text,
    fontSize: 22,
    fontWeight: '700',
  },
  fieldLabel: {
    color: c.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  monoBox: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    padding: 12,
  },
  safetyCode: {
    color: c.textSecondary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: MK_MONO,
    letterSpacing: 1.5,
  },
  friendCode: {
    color: c.text,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: MK_MONO,
    letterSpacing: 1,
  },
  codeTag: {
    color: c.accent,
    fontSize: 12,
    fontWeight: '700',
    marginTop: -6,
  },
  btnRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  vanityRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  vanityInput: {
    flex: 1,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: c.text,
    fontSize: 15,
    fontFamily: MK_MONO,
    letterSpacing: 1,
  },
  makeBtn: { paddingHorizontal: 20 },
  copyBtn: {
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  copyBtnText: { color: c.accent, fontSize: 13, fontWeight: '700' },
  ghostBtn: {
    borderColor: c.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  ghostBtnText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  errorText: { color: c.danger, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  personaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personaAlias: { color: c.text, fontSize: 18, fontWeight: '800' },
  personaBadge: {
    color: '#0A3F31',
    backgroundColor: c.success,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: MK_RADIUS.pill,
    overflow: 'hidden',
  },
  personaKey: { color: c.textSecondary, fontSize: 12, fontFamily: MK_MONO, marginTop: -4 },
  personaUsedFor: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  personaBtn: { paddingHorizontal: 20 },
});
