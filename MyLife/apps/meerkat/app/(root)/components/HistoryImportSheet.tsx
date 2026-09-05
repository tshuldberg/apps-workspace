// HistoryImportSheet (Plan 31 Phase 2, T2.3): the channel history-import panel
// re-homed into community settings. Behavior mirrors the channel-overflow import
// (ChatProvider.importHistory): fetch + verify + merge a host snapshot for a
// chosen channel, then replicate the newly-imported signed events to paired
// members via recordLocalChange. It calls the STABLE data layer + SyncProvider
// directly (no channel/ or ChatProvider dependency, since those are being
// rebuilt). Honest: it reports the tone-coded result and imports nothing that
// fails signature / catalog / key verification.

import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { X } from 'lucide-react-native';
import type { StoredCommunity } from '@mylife/sync';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { useSync } from '../providers/SyncProvider';
import {
  fetchAndImportChannelHistory,
  replicateImportedHistoryEvents,
  type ChannelHistoryImportTone,
} from '../data/channel-history-import';
import { Button, SectionHeader } from './kit';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export function HistoryImportSheet({
  community,
  visible,
  onClose,
}: {
  community: StoredCommunity;
  visible: boolean;
  onClose: () => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { recordLocalChange } = useSync();

  const channels = community.descriptor.channels;
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  const [manifestText, setManifestText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: ChannelHistoryImportTone; message: string } | null>(null);

  const toneColor = useMemo(() => ({
    success: c.success,
    info: c.info,
    warning: c.warning,
    error: c.danger,
  }), [c]);

  const pasteManifest = useCallback(() => {
    void (async () => {
      const text = await Clipboard.getStringAsync();
      setManifestText(text);
      setNotice(null);
    })();
  }, []);

  const runImport = useCallback(() => {
    if (!channelId) return;
    void (async () => {
      setBusy(true);
      setNotice(null);
      try {
        const result = await fetchAndImportChannelHistory({
          db,
          identity,
          communityId: community.communityId,
          channelId,
          manifestJson: manifestText,
          hosts: community.descriptor.hosts,
          expectedCatalogCid: community.descriptor.catalogCid,
        });
        if (result.ok) {
          // Replicate ONLY the merge-inserted events (importedEvents already
          // excludes dropped-removed events, Plan 28 membership cut).
          replicateImportedHistoryEvents(recordLocalChange, result.importedEvents);
        }
        setNotice({ tone: result.tone, message: result.message });
      } catch (error) {
        setNotice({ tone: 'error', message: error instanceof Error ? error.message : String(error) });
      } finally {
        setBusy(false);
      }
    })();
  }, [db, identity, community, channelId, manifestText, recordLocalChange]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Import history</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <X size={20} color={c.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>

        <SectionHeader title="Channel" hint="Choose which channel to backfill from a host snapshot." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {channels.map((channel) => {
            const active = channel.id === channelId;
            return (
              <Pressable
                key={channel.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Select #${channel.name}`}
                onPress={() => setChannelId(channel.id)}
                style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>#{channel.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <TextInput
          style={styles.manifestInput}
          value={manifestText}
          onChangeText={setManifestText}
          placeholder="Paste a history manifest (JSON)"
          placeholderTextColor={c.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          accessibilityLabel="History manifest JSON"
        />
        <Button title="Paste from clipboard" variant="secondary" onPress={pasteManifest} />
        <Button
          title={busy ? 'Importing...' : 'Fetch and import'}
          onPress={runImport}
          disabled={busy || !channelId || manifestText.trim().length === 0}
        />
        {notice ? <Text style={[styles.notice, { color: toneColor[notice.tone] }]}>{notice.message}</Text> : null}
        <Text style={styles.footnote}>
          History is fetched from the community hosts, verified against the catalog and your group key, and merged locally. Nothing that fails verification is imported.
        </Text>
      </View>
    </Modal>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: c.text, fontSize: 18, fontWeight: '800' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceHigh },
  chipsRow: { gap: 8, paddingVertical: 2 },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 12,
    backgroundColor: c.surfaceElevated,
  },
  chipActive: { borderColor: c.accent, backgroundColor: c.surfaceHigh },
  chipText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: c.accent },
  manifestInput: {
    minHeight: 90,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    padding: 12,
    fontSize: 12,
    textAlignVertical: 'top',
  },
  notice: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  footnote: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.7 },
});
