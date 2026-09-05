import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useNode } from '../providers/NodeProvider';
import { Button, HonestNotice, Mono, ScopeBadge } from '../components/kit';
import { type MkColors, MK_RADIUS, formatBytes, scopeLabel, shortHex } from '../theme/tokens';
import { useMkStyles } from '../providers/AppThemeProvider';

type OpenState =
  | { kind: 'idle' }
  | { kind: 'ok'; text: string }
  | { kind: 'error'; reason: string };

export default function PinnedDetailScreen() {
  const styles = useMkStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const contentId = Array.isArray(id) ? id[0] : id;
  const { pinned, getSessionLink, openFromStore } = useNode();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openState, setOpenState] = useState<OpenState>({ kind: 'idle' });
  const [opening, setOpening] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);

  const manifest = useMemo(
    () => pinned.find((m) => m.contentId === contentId),
    [pinned, contentId],
  );
  const sessionLink = contentId ? getSessionLink(contentId) : null;

  // This screen can be the stack's only route (a relaunch restore); back needs
  // a fallback or Close silently does nothing.
  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(root)/(tabs)');
  }, [router]);

  const copyLink = useCallback(async () => {
    if (!sessionLink) return;
    // "Copied" is claimed only after the clipboard write really succeeded; a
    // failed write says so instead of a dead tap.
    try {
      await Clipboard.setStringAsync(sessionLink.link);
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
    setTimeout(() => setCopied(null), 1500);
  }, [sessionLink]);

  const reopen = useCallback(async () => {
    if (!contentId || !sessionLink || opening) return;
    setOpening(true);
    try {
      const result = await openFromStore(contentId, sessionLink.linkKey);
      if (result.ok) {
        const text = new TextDecoder().decode(result.content);
        setOpenState({ kind: 'ok', text });
      } else {
        setOpenState({ kind: 'error', reason: result.reason });
      }
    } catch (err) {
      // A thrown store read (missing block file) must render, not die silently.
      setOpenState({
        kind: 'error',
        reason: err instanceof Error ? err.message : 'Could not open this content.',
      });
    } finally {
      setOpening(false);
    }
  }, [contentId, sessionLink, opening, openFromStore]);

  if (!manifest) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.missing}>This item is no longer pinned.</Text>
        <Button title="Close" onPress={close} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={2}>{manifest.name}</Text>
        <ScopeBadge scope={manifest.scope} />
      </View>

      <View style={styles.panel}>
        <Row label="Size" value={formatBytes(manifest.size)} />
        <Row label="Scope" value={scopeLabel(manifest.scope)} />
        <Row label="Blocks" value={String(manifest.sealedChunkIds.length)} />
        <Row label="Pinned" value={new Date(manifest.pinnedAt).toLocaleString()} />
      </View>

      <Text style={styles.fieldLabel}>Content ID</Text>
      <View style={styles.monoBox}>
        <Mono>{manifest.contentId}</Mono>
      </View>

      <Text style={styles.fieldLabel}>Author public key</Text>
      <View style={styles.monoBox}>
        <Mono>{shortHex(manifest.authorPublicKey, 16, 12)}</Mono>
      </View>

      <Text style={styles.fieldLabel}>Share link</Text>
      {sessionLink ? (
        <>
          <View style={styles.monoBox}>
            <Mono>{sessionLink.link}</Mono>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy share link"
            onPress={() => { void copyLink(); }}
            style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
          >
            <Text style={styles.copyBtnText}>
              {copied ? (copied === 'ok' ? 'Copied' : 'Could not copy') : 'Copy link'}
            </Text>
          </Pressable>
        </>
      ) : (
        <HonestNotice text="The full share link (with its decrypt key) was shown when you sealed this, in this session only. Keys are never stored on disk, so it cannot be rebuilt here after a relaunch." />
      )}

      <Text style={styles.fieldLabel}>Verify round trip</Text>
      <Text style={styles.helpText}>
        Decrypt this content from the local store to prove the seal and open path
        end to end on this device.
      </Text>
      <Button
        title={opening ? 'Decrypting...' : 'Open and decrypt'}
        onPress={() => { void reopen(); }}
        disabled={!sessionLink || opening}
      />
      {openState.kind === 'ok' ? (
        <View style={[styles.resultBox, styles.resultOk]}>
          <Text style={styles.resultLabel}>Decrypted ✓</Text>
          <Text style={styles.resultText}>{openState.text}</Text>
        </View>
      ) : null}
      {openState.kind === 'error' ? (
        <View style={[styles.resultBox, styles.resultErr]}>
          <Text style={styles.resultLabel}>Failed: {openState.reason}</Text>
        </View>
      ) : null}

      <View style={{ height: 12 }} />
      <Button title="Close" variant="ghost" onPress={close} />
      <View style={{ height: insets.bottom + 24 }} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 10 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 16 },
  missing: { color: c.textSecondary, fontSize: 15 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, color: c.text, fontSize: 22, fontWeight: '800' },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 14,
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: c.textSecondary, fontSize: 13 },
  rowValue: { color: c.text, fontSize: 13, fontWeight: '600' },
  fieldLabel: {
    color: c.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  monoBox: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    padding: 12,
  },
  helpText: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  copyBtn: {
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  copyBtnText: { color: c.accent, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  resultBox: { borderRadius: MK_RADIUS.md, padding: 12, gap: 6 },
  resultOk: { backgroundColor: c.successSoft, borderColor: c.accent, borderWidth: StyleSheet.hairlineWidth },
  resultErr: { backgroundColor: c.dangerSoft, borderColor: c.danger, borderWidth: StyleSheet.hairlineWidth },
  resultLabel: { color: c.text, fontSize: 13, fontWeight: '700' },
  resultText: { color: c.textSecondary, fontSize: 14, lineHeight: 20 },
});
