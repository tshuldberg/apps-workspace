import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { parseShareLink, type NodeShareScope } from '@mylife/sync';
import { runOpenLinkFlow } from '../data/remote-share';
import { useNode, type CreateAndPinResult } from '../providers/NodeProvider';
import { Button, HonestNotice, Mono, SectionHeader } from '../components/kit';
import { type MkColors, MK_RADIUS, scopeLabel } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

const SCOPES: NodeShareScope[] = ['personal_replica', 'shared_workspace', 'published_blob'];

const SCOPE_HELP: Record<NodeShareScope, string> = {
  personal_replica: 'Best for your own devices. This does not create a hosted backup.',
  shared_workspace: 'Best for a community or group that already has the file pieces.',
  published_blob: 'A public link can be opened by anyone who has the link and can reach verified file pieces. This is not public feed inclusion.',
};

type OpenResultState =
  | { kind: 'idle' }
  | { kind: 'not-pinned' }
  | { kind: 'bad-link' }
  | {
    kind: 'ok';
    text: string;
    /** The raw decrypted bytes, kept so the user can save the file (not just read it). */
    bytes: Uint8Array;
    source: 'local' | 'remote';
    pinned: boolean;
    name?: string;
    pinError?: string;
    /** How many hosts the relay actually returned for this content, if discovery ran. */
    discovered?: number;
  }
  | { kind: 'error'; reason: string; discovered?: number };

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'saved'; location: 'files-app' | 'saf-folder' }
  | { kind: 'cancelled' }
  | { kind: 'no-destination' }
  | { kind: 'failed'; reason: string };

export default function ShareScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const {
    createAndPin,
    openFromStore,
    openFromRemoteHosts,
    discoverHosts,
    relayUrl,
    saveContent,
    chooseSaveDestination,
  } = useNode();
  const insets = useSafeAreaInsets();

  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<NodeShareScope>('published_blob');
  const [result, setResult] = useState<CreateAndPinResult | null>(null);
  const [copied, setCopied] = useState<{ which: 'link' | 'magnet'; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);

  const [pasteLink, setPasteLink] = useState('');
  const [remoteHosts, setRemoteHosts] = useState('');
  const [openBusy, setOpenBusy] = useState(false);
  const [openResult, setOpenResult] = useState<OpenResultState>({ kind: 'idle' });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });

  const seal = useCallback(async () => {
    if (!body.trim()) return;
    setBusy(true);
    setSealError(null);
    try {
      const r = await createAndPin(body, name, scope);
      setResult(r);
    } catch (err) {
      // A failed block write (full disk, permissions) must be shown, never
      // recorded as pinned: the store now fails loud instead of writing a
      // manifest whose blocks never landed.
      setSealError(err instanceof Error ? err.message : 'Sealing failed: content was not stored');
    } finally {
      setBusy(false);
    }
  }, [body, name, scope, createAndPin]);

  const copy = useCallback(async (which: 'link' | 'magnet') => {
    if (!result) return;
    // "Copied" is claimed only after the clipboard write really succeeded; a
    // failed write says so instead of a dead tap.
    try {
      await Clipboard.setStringAsync(which === 'link' ? result.link : result.magnet);
      setCopied({ which, ok: true });
    } catch {
      setCopied({ which, ok: false });
    }
    setTimeout(() => setCopied(null), 1500);
  }, [result]);

  const openLink = useCallback(async () => {
    if (openBusy) return;
    const parts = parseShareLink(pasteLink.trim());
    if (!parts) {
      setOpenResult({ kind: 'bad-link' });
      return;
    }
    setOpenBusy(true);
    setSaveStatus({ kind: 'idle' });
    try {
      // Local store first, then ONE relay discovery lookup (candidate count,
      // never a seeder claim), then the verify-then-pin remote open. The flow
      // catches thrown steps and returns an honest error result, so a failed
      // open always renders something instead of dying as a rejected promise.
      const flow = await runOpenLinkFlow({
        parts,
        pastedHostText: remoteHosts,
        relayConfigured: !!relayUrl,
        openLocal: openFromStore,
        discover: discoverHosts,
        openRemote: openFromRemoteHosts,
      });
      if (flow.kind === 'ok') {
        setOpenResult({
          kind: 'ok',
          text: new TextDecoder().decode(flow.content),
          bytes: flow.content,
          source: flow.source,
          pinned: flow.pinned,
          name: flow.name,
          pinError: flow.pinError,
          discovered: flow.discovered,
        });
      } else if (flow.kind === 'not-pinned') {
        setOpenResult({ kind: 'not-pinned' });
      } else {
        setOpenResult({ kind: 'error', reason: flow.reason, discovered: flow.discovered });
      }
    } finally {
      setOpenBusy(false);
    }
  }, [openBusy, pasteLink, remoteHosts, relayUrl, openFromStore, openFromRemoteHosts, discoverHosts]);

  const saveOpenedFile = useCallback(async () => {
    if (openResult.kind !== 'ok') return;
    setSaveStatus({ kind: 'busy' });
    try {
      let result = await saveContent({
        bytes: openResult.bytes,
        name: openResult.name ?? 'meerkat-content.txt',
        mimeType: 'application/octet-stream',
      });
      // Android with no folder yet: prompt the picker once, then retry. A
      // cancelled picker leaves the original 'no-destination' result.
      if (result.kind === 'no-destination') {
        const chosen = await chooseSaveDestination();
        if (!chosen) {
          setSaveStatus({ kind: 'no-destination' });
          return;
        }
        result = await saveContent({
          bytes: openResult.bytes,
          name: openResult.name ?? 'meerkat-content.txt',
          mimeType: 'application/octet-stream',
        });
      }
      if (result.kind === 'saved') {
        setSaveStatus({ kind: 'saved', location: result.location });
      } else if (result.kind === 'cancelled') {
        setSaveStatus({ kind: 'cancelled' });
      } else if (result.kind === 'no-destination') {
        setSaveStatus({ kind: 'no-destination' });
      } else {
        setSaveStatus({ kind: 'failed', reason: result.reason });
      }
    } catch (err) {
      setSaveStatus({ kind: 'failed', reason: err instanceof Error ? err.message : String(err) });
    }
  }, [openResult, saveContent, chooseSaveDestination]);

  const reset = useCallback(() => {
    setResult(null);
    setBody('');
    setName('');
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Advanced sharing</Text>
        <Text style={styles.subtitle}>Create or open protected share links</Text>

        {!result ? (
          <View style={styles.panel}>
            <SectionHeader title="Write" hint="This text is protected before it is stored." />
            <TextInput
              style={styles.bodyInput}
              placeholder="Write something to save and share"
              placeholderTextColor={c.textTertiary}
              multiline
              value={body}
              onChangeText={setBody}
              textAlignVertical="top"
            />
            <TextInput
              style={styles.nameInput}
              placeholder="Name (optional)"
              placeholderTextColor={c.textTertiary}
              value={name}
              onChangeText={setName}
            />
            <SectionHeader title="Scope" />
            <View style={styles.scopeRow}>
              {SCOPES.map((s) => {
                const active = s === scope;
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Scope ${scopeLabel(s)}`}
                    onPress={() => setScope(s)}
                    style={[styles.scopeChip, active && styles.scopeChipActive]}
                  >
                    <Text style={[styles.scopeChipText, active && styles.scopeChipTextActive]}>
                      {scopeLabel(s)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.scopeHelp}>{SCOPE_HELP[scope]}</Text>
            <Button
              title={busy ? 'Saving...' : 'Save and create link'}
              onPress={() => { void seal(); }}
              disabled={busy || !body.trim()}
            />
            <HonestNotice text="This saves protected bytes on this device. Hosted file storage is a paid service and is not connected here; recipients need this device, a pasted host URL, or a verified host announcement." />
            {sealError ? (
              <View style={[styles.resultBox, styles.resultErr]}>
                <Text style={styles.resultLabel}>Could not store this content</Text>
                <Text style={styles.resultText}>
                  {sealError} Nothing was saved. Free up space and try again.
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.panel}>
            <SectionHeader title="Saved and ready to share" hint={result.name} />
            <Text style={styles.fieldLabel}>Share link</Text>
            <View style={styles.monoBox}><Mono>{result.link}</Mono></View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy meerkat link"
              onPress={() => { void copy('link'); }}
              style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
            >
              <Text style={styles.copyBtnText}>
                {copied?.which === 'link' ? (copied.ok ? 'Copied' : 'Could not copy') : 'Copy link'}
              </Text>
            </Pressable>

            <Text style={styles.fieldLabel}>Magnet link</Text>
            <View style={styles.monoBox}><Mono>{result.magnet}</Mono></View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy magnet link"
              onPress={() => { void copy('magnet'); }}
              style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
            >
              <Text style={styles.copyBtnText}>
                {copied?.which === 'magnet' ? (copied.ok ? 'Copied' : 'Could not copy') : 'Copy magnet'}
              </Text>
            </Pressable>

            <HonestNotice text="Anyone you give this link to can open the content if they can reach a place that has the protected file pieces. A public link is not a public post, public feed inclusion, or cloud backup." />
            <Button title="Create another link" variant="secondary" onPress={reset} />
          </View>
        )}

        <View style={styles.panel}>
          <SectionHeader
            title="Open a link"
            hint={relayUrl
              ? 'Opens content on this device first, then looks for candidate hosts and tries any you paste.'
              : 'Opens content on this device first, then tries pasted host URLs.'}
          />
          <TextInput
            style={styles.nameInput}
            placeholder="Paste a meerkat:// or magnet link"
            placeholderTextColor={c.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            value={pasteLink}
            onChangeText={setPasteLink}
          />
          <TextInput
            style={styles.nameInput}
            placeholder="Remote host URL(s), optional"
            placeholderTextColor={c.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            value={remoteHosts}
            onChangeText={setRemoteHosts}
          />
          <Button
            title={openBusy ? 'Opening...' : 'Open link'}
            variant="secondary"
            onPress={() => { void openLink(); }}
            disabled={!pasteLink.trim() || openBusy}
          />
          {openResult.kind === 'ok' ? (
            <View style={[styles.resultBox, styles.resultOk]}>
              <Text style={styles.resultLabel}>
                {openResult.source === 'remote'
                  ? openResult.pinned ? 'Fetched, verified, and saved'
                    : 'Fetched and verified'
                  : 'Decrypted locally'}
              </Text>
              {openResult.name ? <Text style={styles.resultMeta}>{openResult.name}</Text> : null}
              {openResult.source === 'remote' && openResult.discovered ? (
                <Text style={styles.resultMeta}>
                  {openResult.discovered === 1
                    ? 'Found 1 candidate host; the content was verified before it was opened.'
                    : `Found ${openResult.discovered} candidate hosts; the content was verified before it was opened.`}
                </Text>
              ) : null}
              <Text style={styles.resultText}>{openResult.text}</Text>
              {openResult.pinError ? (
                <Text style={styles.resultMeta}>
                  Local save failed: {openResult.pinError}
                </Text>
              ) : null}
              <Button
                title={saveStatus.kind === 'busy' ? 'Saving...' : 'Save file'}
                variant="secondary"
                onPress={() => { void saveOpenedFile(); }}
                disabled={saveStatus.kind === 'busy'}
              />
              {saveStatus.kind === 'saved' ? (
                <Text style={styles.resultMeta}>
                  {saveStatus.location === 'saf-folder'
                    ? 'Saved to your chosen folder and verified on disk.'
                    : 'Opened the iOS save sheet. Choose Files (or another app) to finish saving.'}
                </Text>
              ) : null}
              {saveStatus.kind === 'no-destination' ? (
                <Text style={styles.resultMeta}>
                  No save folder chosen. Pick one when prompted, then tap Save file again.
                </Text>
              ) : null}
              {saveStatus.kind === 'cancelled' ? (
                <Text style={styles.resultMeta}>Save cancelled. Nothing was written.</Text>
              ) : null}
              {saveStatus.kind === 'failed' ? (
                <Text style={styles.resultMeta}>Could not save: {saveStatus.reason}</Text>
              ) : null}
            </View>
          ) : null}
          {openResult.kind === 'not-pinned' ? (
            <View style={[styles.resultBox, styles.resultWarn]}>
              <Text style={styles.resultLabel}>Not on this device yet</Text>
              <Text style={styles.resultText}>
                {relayUrl
                  ? 'The link is valid, but no candidate host was found and you have not pasted a host URL. Add a host URL for the protected file pieces, then open it again.'
                  : 'The link is valid, but this content is not stored here. Add a host URL for the protected file pieces, then open it again.'}
              </Text>
            </View>
          ) : null}
          {openResult.kind === 'bad-link' ? (
            <View style={[styles.resultBox, styles.resultErr]}>
              <Text style={styles.resultLabel}>That link could not be parsed.</Text>
            </View>
          ) : null}
          {openResult.kind === 'error' ? (
            <View style={[styles.resultBox, styles.resultErr]}>
              <Text style={styles.resultLabel}>Failed: {openResult.reason}</Text>
              {openResult.discovered ? (
                <Text style={styles.resultMeta}>
                  {openResult.discovered === 1
                    ? 'Found 1 candidate host, but it could not serve verified content for this link.'
                    : `Found ${openResult.discovered} candidate hosts, but none could serve verified content for this link.`}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={{ height: insets.bottom + 96 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14 },
  title: { color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: c.textSecondary, fontSize: 14, marginTop: -6 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  bodyInput: {
    minHeight: 120,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    padding: 12,
    color: c.text,
    fontSize: 15,
    lineHeight: 21,
  },
  nameInput: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: c.text,
    fontSize: 15,
  },
  scopeRow: { flexDirection: 'row', gap: 8 },
  scopeChip: {
    flex: 1,
    borderColor: c.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.pill,
    paddingVertical: 9,
    alignItems: 'center',
  },
  scopeChipActive: {
    backgroundColor: `${c.accent}1F`,
    borderColor: c.accent,
  },
  scopeChipText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  scopeChipTextActive: { color: c.accent },
  scopeHelp: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
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
  copyBtn: {
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  copyBtnText: { color: c.accent, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  resultBox: { borderRadius: MK_RADIUS.md, padding: 12, gap: 6, borderWidth: StyleSheet.hairlineWidth },
  resultOk: { backgroundColor: c.successSoft, borderColor: c.accent },
  resultWarn: { backgroundColor: c.warningSoft, borderColor: c.warning },
  resultErr: { backgroundColor: c.dangerSoft, borderColor: c.danger },
  resultLabel: { color: c.text, fontSize: 13, fontWeight: '700' },
  resultMeta: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
  resultText: { color: c.textSecondary, fontSize: 14, lineHeight: 20 },
});
