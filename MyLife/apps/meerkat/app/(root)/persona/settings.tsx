// Public persona settings (Plan 39 P3, screen S13). Display-name edit + GDPR export + GDPR
// delete, all against the REAL persona service. Accounts exist now, so account rights exist
// now: export (data portability) and true deletion (alias release + session revoke + server
// purge). The private mesh tier is untouched.

import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { router, Stack } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { Button, HonestNotice, SectionHeader } from '../components/kit';
import {
  APP_UNLOCK_RECEIPT_KEY,
  FALLBACK_UNLOCK_PRICE_LABEL,
} from '../data/app-unlock';
import { getSetting } from '../data/db';
import { clearNativeIdentitySecret } from '../data/meerkat-db';
import { hasValidStoredToken, humanityServiceConfig } from '../data/humanity-core';
import {
  deletePersona,
  exportPersona,
  getStoredPersona,
  isPersonaServiceConfigured,
  personaServiceConfig,
  setStoredDisplayName,
} from '../data/persona-core';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export default function PersonaSettingsScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const personaConfig = useMemo(() => personaServiceConfig(), []);
  const humanityConfig = useMemo(() => humanityServiceConfig(), []);
  const configured = isPersonaServiceConfigured(personaConfig);

  const persona = getStoredPersona(db);
  const [draftName, setDraftName] = useState(persona?.displayName ?? '');
  const [savedName, setSavedName] = useState(persona?.displayName ?? '');
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const unlocked = Boolean(getSetting(db, APP_UNLOCK_RECEIPT_KEY));
  const verified = hasValidStoredToken(db, humanityConfig);

  // Reached via replace() from persona creation and by deep link, so the stack can
  // be empty: back must not dead-end. Identity is the persona home surface.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/identity');
  }, []);

  const saveName = useCallback(() => {
    setStoredDisplayName(db, draftName);
    setSavedName(draftName.trim().slice(0, 48));
  }, [db, draftName]);

  const onExport = useCallback(() => {
    setBusy('export');
    setNotice(null);
    void (async () => {
      try {
        const result = await exportPersona(db, personaConfig);
        if (result.ok) {
          // Surface the real data: copy the JSON to the clipboard so it can be
          // saved/pasted. The clipboard write can reject; the copied claim is made
          // only after it resolves.
          await Clipboard.setStringAsync(JSON.stringify(result.data, null, 2));
          setNotice('Your public data was copied to the clipboard as JSON. It includes every post and reply the server holds.');
        } else {
          setNotice(result.reason === 'key_unavailable'
            ? 'The local persona key is unavailable on this device, so the export could not be signed.'
            : 'Export could not be completed right now. Nothing was changed; try again when you are online.');
        }
      } catch {
        setNotice('The export could not be copied to the clipboard. Nothing was changed; try again.');
      } finally {
        setBusy(null);
      }
    })();
  }, [db, personaConfig]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      'Delete public persona?',
      persona
        ? `Releases @${persona.alias} after 30 days, signs out all sessions, removes your posts from the feed, and erases the server record. Your private Meerkat is untouched.`
        : '',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setBusy('delete');
            void (async () => {
              const result = await deletePersona(db, personaConfig, fetch, clearNativeIdentitySecret);
              if (result.ok) {
                router.replace('/(tabs)/identity');
              } else {
                setNotice(result.reason === 'key_unavailable'
                  ? 'The local persona key is unavailable on this device, so the delete request could not be signed.'
                  : 'Deletion could not be completed right now. Your persona is unchanged; try again when you are online.');
                setBusy(null);
              }
            })();
          },
        },
      ],
    );
  }, [db, personaConfig, persona]);

  if (!persona) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <ChevronLeft size={24} color={c.text} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Public persona</Text>
        </View>
        <View style={styles.panel}>
          <HonestNotice text="No public persona exists on this device yet." />
          <Button title="Go back" variant="secondary" onPress={goBack} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <ChevronLeft size={24} color={c.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>@{persona.alias} settings</Text>
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Display name" hint={`Shown next to @${persona.alias}. The alias itself can't change.`} />
        <TextInput
          style={styles.nameInput}
          value={draftName}
          onChangeText={setDraftName}
          placeholder="A friendly name"
          placeholderTextColor={c.textTertiary}
          accessibilityLabel="Display name"
        />
        <Button title="Save display name" variant="secondary" onPress={saveName} disabled={draftName.trim() === savedName} />
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Account" hint="" />
        <View style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>Posting unlock</Text>
            <Text style={styles.rowSub}>{unlocked ? `Purchased · ${FALLBACK_UNLOCK_PRICE_LABEL} one time` : `Not yet · ${FALLBACK_UNLOCK_PRICE_LABEL} one time to post`}</Text>
          </View>
          <Text style={[styles.pill, unlocked ? styles.pillOk : styles.pillMuted]}>{unlocked ? 'active' : 'off'}</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>Verification</Text>
            <Text style={styles.rowSub}>{verified ? 'Verified on this device · refills when you verify' : 'Verify to reach other people'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Your data" hint="" />
        <Button
          title={busy === 'export' ? 'Exporting...' : 'Export my public data'}
          variant="secondary"
          onPress={onExport}
          disabled={busy !== null || !configured}
        />
        <Text style={styles.rowSub}>Every post and reply, as JSON</Text>
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Danger zone" hint="" />
        <Button
          title={busy === 'delete' ? 'Deleting...' : 'Delete public persona'}
          variant="danger"
          onPress={confirmDelete}
          disabled={busy !== null || !configured}
        />
        <Text style={styles.dangerNote}>Releases @{persona.alias} after 30 days, signs out all sessions, removes your posts from the feed, and erases the server record. Your private Meerkat is untouched.</Text>
      </View>

      {notice ? <HonestNotice text={notice} /> : null}
      {!configured ? <HonestNotice text="Export and delete need a connection to the account server, and this build has none configured." /> : null}

      <View style={{ height: insets.bottom + 48 }} />
    </ScrollView>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14 },
  title: { flex: 1, color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: -8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 10,
  },
  nameInput: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowMain: { flex: 1 },
  rowTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  pill: { fontSize: 11, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 3, borderRadius: MK_RADIUS.pill, overflow: 'hidden' },
  pillOk: { color: '#0A3F31', backgroundColor: c.success },
  pillMuted: { color: c.textSecondary, backgroundColor: c.surfaceHigh },
  dangerNote: { color: c.textSecondary, fontSize: 12, lineHeight: 18 },
});
