// Public persona creation (Plan 39 P3, screen S3). Verify -> alias picker -> account. A fresh
// Ed25519 persona key is generated locally and its alias is registered against the REAL
// registry under a humanity token; the device key is never sent (NC-P2). Honest states only:
// with no persona service configured, this says so and creates nothing.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { Button, HonestNotice, SectionHeader } from '../components/kit';
import { VerifySheet } from '../components/VerifySheet';
import {
  hasValidStoredToken,
  humanityServiceConfig,
  getStoredHumanityToken,
  clearStoredHumanityToken,
} from '../data/humanity-core';
import {
  checkAliasAvailability,
  createAndRegisterPersona,
  isPersonaServiceConfigured,
  personaServiceConfig,
  validateAlias,
  type AliasAvailability,
} from '../data/persona-core';
import { liveAccountDeps, presentCredentialHeader } from '../data/account-core';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

function availabilityLine(state: AliasAvailability | 'checking' | null): { text: string; tone: 'ok' | 'bad' | 'muted' } | null {
  switch (state) {
    case 'available': return { text: 'Available', tone: 'ok' };
    case 'taken': return { text: 'That name is taken', tone: 'bad' };
    case 'invalid': return { text: 'Use 3-20 letters, numbers, or underscores', tone: 'muted' };
    case 'unreachable': return { text: 'Could not check right now', tone: 'muted' };
    case 'not_configured': return { text: 'Needs a connection server', tone: 'muted' };
    case 'checking': return { text: 'Checking...', tone: 'muted' };
    default: return null;
  }
}

export default function PersonaCreateScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const personaConfig = useMemo(() => personaServiceConfig(), []);
  const humanityConfig = useMemo(() => humanityServiceConfig(), []);
  const configured = isPersonaServiceConfigured(personaConfig);

  const [verified, setVerified] = useState(() => hasValidStoredToken(db, humanityConfig));
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [alias, setAlias] = useState('');
  const [availability, setAvailability] = useState<AliasAvailability | 'checking' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkSeq = useRef(0);
  // Two fast taps must not register two personas; taken synchronously before the
  // first await (the busy state alone re-renders too late to be the guard).
  const createInFlightRef = useRef(false);

  // Deep-linkable screen: back must not dead-end when this is the first route.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/public');
  }, []);

  const validity = validateAlias(alias);
  const canCheck = configured && alias.trim().length > 0 && validity === 'ok';

  // Debounced live availability check against the real registry.
  useEffect(() => {
    if (!canCheck) {
      setAvailability(alias.trim().length === 0 ? null : (validity === 'ok' ? null : 'invalid'));
      return;
    }
    const seq = ++checkSeq.current;
    setAvailability('checking');
    const timer = setTimeout(() => {
      void checkAliasAvailability(personaConfig, alias).then((result) => {
        if (checkSeq.current === seq) setAvailability(result);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [alias, canCheck, validity, personaConfig]);

  const onCreate = useCallback(() => {
    if (createInFlightRef.current) return;
    const token = getStoredHumanityToken(db);
    if (!token) { setVerified(false); return; }
    createInFlightRef.current = true;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        // Plan 51 P3: attach the anonymous verification-account credential when one
        // exists (carries NO account identifier, AC-2). Absent leaves the register
        // byte-identical. presentCredentialHeader returns null when unconfigured or no
        // credential is stored, so this never blocks registration.
        const credentialHeaders = (await presentCredentialHeader(liveAccountDeps())) ?? undefined;
        // createAndRegisterPersona mints + stores the persona key in the device
        // secret store, which can throw; the catch keeps Create honest and retryable.
        const result = await createAndRegisterPersona(db, personaConfig, token, alias, '', fetch, credentialHeaders ?? {});
        if (result.ok) {
          // The humanity token was spent server-side on registration; drop the local copy.
          clearStoredHumanityToken(db);
          router.replace('/persona/settings');
        } else {
          setError(reasonToMessage(result.reason));
          if (result.reason === 'needs_verification') setVerified(false);
        }
      } catch {
        setError('That did not go through on this device. Try again.');
      } finally {
        createInFlightRef.current = false;
        setBusy(false);
      }
    })();
  }, [db, personaConfig, alias]);

  const availLine = availabilityLine(availability);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.title}>Choose your public name</Text>

      {!configured ? (
        <View style={styles.panel}>
          <SectionHeader title="Needs a connection server" hint="Public accounts are off in this build." />
          <HonestNotice text="Creating a public name needs a connection to a Meerkat account server, and this build has none configured. Your private Meerkat works fully without it." />
          <Button title="Go back" variant="secondary" onPress={goBack} />
        </View>
      ) : !verified ? (
        <View style={styles.panel}>
          <SectionHeader title="Verify you're human first" hint="One quick, anonymous check." />
          <Text style={styles.body}>Every public account belongs to a verified human. Verify once on this device to continue. It is anonymous: the check proves you are a person, never who you are.</Text>
          <Button title="Verify I'm human" onPress={() => setVerifyOpen(true)} />
          <Button title="Not now" variant="secondary" onPress={goBack} />
        </View>
      ) : (
        <>
          <HonestNotice text="This is a brand-new identity. It is not linked to your device name, your friends, or your private communities, and we can't link it either." />

          <View style={styles.panel}>
            <SectionHeader title="Public alias" hint="3-20 letters, numbers, or underscores." />
            <View style={styles.aliasRow}>
              <Text style={styles.at}>@</Text>
              <TextInput
                style={styles.aliasInput}
                value={alias}
                onChangeText={(t) => { setAlias(t); setError(null); }}
                placeholder="duskrunner"
                placeholderTextColor={c.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Your public alias"
              />
            </View>
            {availLine ? (
              <Text style={[styles.availLine, availLine.tone === 'ok' ? styles.availOk : availLine.tone === 'bad' ? styles.availBad : styles.availMuted]}>
                {availLine.tone === 'ok' ? '✓ ' : ''}{availLine.text}
              </Text>
            ) : null}
          </View>

          <View style={styles.panel}>
            <SectionHeader title="What this creates" hint="" />
            <Text style={styles.bullet}>{'🔑'} A new public signing key, made on this device</Text>
            <Text style={styles.bullet}>{'🌐'} Your alias, reserved for you everywhere on Meerkat</Text>
            <Text style={styles.bullet}>{'🚫'} Zero connection to your private identity, by design</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={busy ? 'Creating...' : (validity === 'ok' ? `Create @${alias.trim().toLowerCase()}` : 'Create public name')}
            onPress={onCreate}
            disabled={busy || availability !== 'available'}
          />
          <Text style={styles.footer}>You can change how your name displays later. The @alias itself is permanent while the account exists.</Text>
        </>
      )}

      <View style={{ height: insets.bottom + 48 }} />

      <VerifySheet
        visible={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        onVerified={() => { setVerified(true); setVerifyOpen(false); }}
        purpose="create your public name"
      />
    </ScrollView>
  );
}

function reasonToMessage(reason: string): string {
  switch (reason) {
    case 'not_configured': return 'This build has no account server connected, so nothing was created.';
    case 'needs_verification': return 'Human verification is needed again. Verify and try once more.';
    case 'alias_taken': return 'That name was just taken. Pick another.';
    case 'alias_reserved': return 'That name is reserved. Pick another.';
    case 'alias_cooldown': return 'That name was recently released and is on a 30-day hold. Pick another.';
    case 'persona_exists': return 'This device already has a public name.';
    case 'unreachable': return 'The account server could not be reached. Try again when you are online.';
    default: return 'That did not go through. Nothing was created; try again.';
  }
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14 },
  title: { color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 10,
  },
  body: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
  aliasRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surfaceElevated, borderRadius: MK_RADIUS.md, paddingHorizontal: 12 },
  at: { color: c.textSecondary, fontSize: 20, fontWeight: '800' },
  aliasInput: { flex: 1, color: c.text, fontSize: 20, fontWeight: '700', paddingVertical: 14 },
  availLine: { fontSize: 13, fontWeight: '700' },
  availOk: { color: c.success },
  availBad: { color: c.danger },
  availMuted: { color: c.textSecondary },
  bullet: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
  error: { color: c.danger, fontSize: 13, lineHeight: 19 },
  footer: { color: c.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
