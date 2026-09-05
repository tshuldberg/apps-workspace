// Global Downloads browser (Plan 40 D.7). Cross-community, but still built from
// the per-community Files aggregation so resolved signed messages remain the
// only source of truth.

import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Search,
  X,
} from 'lucide-react-native';
import { getPublicKeyFingerprint, listCommunities } from '@mylife/sync';
import { FileIndexRequestButton } from '../components/FileIndexRequestButton';
import { HonestNotice } from '../components/kit';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { useNode } from '../providers/NodeProvider';
import { ExpoBlobStore } from '../data/expo-blob-store';
import { buildCommunityPeerNameMap } from '../data/community-core';
import {
  EMPTY_FILE_SELECTION,
  aggregateGlobalDownloadFiles,
  bulkSaveHeadline,
  buildPresenceMap,
  fileSelectionReducer,
  filterGlobalDownloadFiles,
  perFileOutcomeLabel,
  resolveFilesToSave,
  saveFilesBulk,
  summarizeGlobalDownloads,
  summarizeSelection,
  type BulkSaveResult,
  type DownloadStatusFilter,
  type GlobalDownloadFile,
} from '../data/community-files';
import {
  communityFileReportTarget,
  isChannelMuted,
  isCommunityContentReportHidden,
  isCommunityMuted,
  isCommunityPersonBlocked,
  reportCommunityContent,
} from '../data/community-safety';
import { type MkColors, MK_RADIUS, formatBytes, shortHex } from '../theme/tokens';

const FILTERS: { id: DownloadStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'on-device', label: 'On device' },
  { id: 'removed', label: 'Removed' },
];

function FileIcon({ mimeType, color, size }: { mimeType: string; color: string; size: number }) {
  if (mimeType.startsWith('image/')) return <ImageIcon size={size} color={color} strokeWidth={2} />;
  if (mimeType.startsWith('video/')) return <Film size={size} color={color} strokeWidth={2} />;
  return <FileText size={size} color={color} strokeWidth={2} />;
}

export default function DownloadsScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { saveContent, saveContentToDocuments, getSaveDestination, chooseSaveDestination } = useNode();
  const blobStore = useMemo(() => new ExpoBlobStore(db), [db]);

  const communities = useMemo(() => listCommunities(db), [db]);
  const [safetyRevision, setSafetyRevision] = useState(0);
  const aggregated = useMemo(() => {
    void safetyRevision;
    return aggregateGlobalDownloadFiles(db, communities).filter((file) => (
      !isCommunityMuted(db, file.communityId)
      && !isChannelMuted(db, file.communityId, file.channelId)
      && !isCommunityPersonBlocked(db, file.communityId, file.authorDeviceId)
      && !isCommunityContentReportHidden(db, file.communityId, 'file', communityFileReportTarget({ channelId: file.channelId, attachmentId: file.attachmentId }))
      && !isCommunityContentReportHidden(db, file.communityId, 'message', file.messageId)
    ));
  }, [db, communities, safetyRevision]);

  const peerNamesByCommunity = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const community of communities) {
      map.set(community.communityId, buildCommunityPeerNameMap(db, community.communityId));
    }
    return map;
  }, [db, communities]);

  const [files, setFiles] = useState<GlobalDownloadFile[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<DownloadStatusFilter>('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selection, dispatchSelection] = useReducer(fileSelectionReducer, EMPTY_FILE_SELECTION);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<BulkSaveResult | null>(null);

  const refreshPresence = useCallback(async () => {
    setLoadError(null);
    const presence = await buildPresenceMap(aggregated, (hash) => blobStore.has(hash));
    setFiles(aggregated.map((file) => ({ ...file, present: presence.get(file.blobHash) ?? false })));
  }, [aggregated, blobStore]);

  useEffect(() => {
    let cancelled = false;
    setFiles(null);
    setLoadError(null);
    void (async () => {
      try {
        const presence = await buildPresenceMap(aggregated, (hash) => blobStore.has(hash));
        if (!cancelled) {
          setFiles(aggregated.map((file) => ({ ...file, present: presence.get(file.blobHash) ?? false })));
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
          setFiles([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aggregated, blobStore]);

  useFocusEffect(useCallback(() => { void refreshPresence().catch((err) => {
    setLoadError(err instanceof Error ? err.message : String(err));
  }); }, [refreshPresence]));

  const liveFiles = useMemo(() => files ?? [], [files]);
  const filteredFiles = useMemo(
    () => filterGlobalDownloadFiles(liveFiles, { query, status }),
    [liveFiles, query, status],
  );
  const downloadSummary = summarizeGlobalDownloads(liveFiles);
  const selectionSummary = summarizeSelection(filteredFiles, selection.selectedIds);
  const selectableCount = filteredFiles.filter((file) => file.present).length;
  const allVisibleOnDeviceSelected = selectableCount > 0 && selectionSummary.count === selectableCount;
  const checking = files === null && !loadError;

  const clearSelection = useCallback(() => {
    setSelectMode(false);
    dispatchSelection({ type: 'clear' });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allVisibleOnDeviceSelected) dispatchSelection({ type: 'clear' });
    else dispatchSelection({ type: 'select-all', files: filteredFiles });
  }, [allVisibleOnDeviceSelected, filteredFiles]);

  const authorName = useCallback(
    (file: GlobalDownloadFile): string => {
      if (file.authorDeviceId === identity.publicKey) {
        const communityName = peerNamesByCommunity.get(file.communityId)?.get(file.authorDeviceId);
        return communityName ? `You as ${communityName}` : 'You';
      }
      return peerNamesByCommunity.get(file.communityId)?.get(file.authorDeviceId)
        ?? shortHex(getPublicKeyFingerprint(file.authorDeviceId));
    },
    [identity.publicKey, peerNamesByCommunity],
  );

  const openFile = useCallback((file: GlobalDownloadFile) => {
    void (async () => {
      // exportToCache and the share sheet are filesystem/native seams; a throw
      // must render honestly instead of vanishing as an unhandled rejection.
      try {
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          Alert.alert('Open unavailable', 'This platform cannot open exported files from the app sandbox.');
          return;
        }
        const exported = await blobStore.exportToCache(file.blobHash, file.name);
        if (!exported) {
          Alert.alert('File not stored', 'This device has the verified file record, but not the file bytes yet.');
          await refreshPresence();
          return;
        }
        await Sharing.shareAsync(exported, { mimeType: file.mimeType, dialogTitle: file.name });
      } catch {
        Alert.alert('Could not open', 'The file could not be exported for opening. Nothing was changed; try again.');
      }
    })();
  }, [blobStore, refreshPresence]);

  const saveRows = useCallback(
    async (toSave: GlobalDownloadFile[]): Promise<void> => {
      if (toSave.length === 0) return;
      setSaving(true);
      setResult(null);
      try {
        if (Platform.OS === 'android' && !getSaveDestination()) {
          const chosen = await chooseSaveDestination();
          if (!chosen) {
            setResult({
              total: toSave.length,
              savedCount: 0,
              failedCount: 0,
              skippedCount: toSave.length,
              perFile: toSave.map((file) => ({
                id: file.id,
                name: file.name,
                status: 'skipped' as const,
                reason: 'Save cancelled. Nothing was written.',
              })),
            });
            return;
          }
        }
        const bulk = await saveFilesBulk({
          files: toSave,
          loadBytes: (hash) => blobStore.get(hash),
          saveOne: ({ bytes, name, mimeType }) =>
            Platform.OS === 'ios'
              ? saveContentToDocuments({ bytes, name, subfolder: 'Downloads' })
              : saveContent({ bytes, name, mimeType }),
        });
        setResult(bulk);
        await refreshPresence();
      } catch {
        // The folder picker / bulk pipeline are native seams; a throw before the
        // per-file fold must still render an honest outcome, never a dead tap.
        setResult({
          total: toSave.length,
          savedCount: 0,
          failedCount: toSave.length,
          skippedCount: 0,
          perFile: toSave.map((file) => ({
            id: file.id,
            name: file.name,
            status: 'failed' as const,
            reason: 'The save could not start. Nothing was written; try again.',
          })),
        });
      } finally {
        setSaving(false);
      }
    },
    [blobStore, chooseSaveDestination, getSaveDestination, refreshPresence, saveContent, saveContentToDocuments],
  );

  const reportFile = useCallback((file: GlobalDownloadFile) => {
    Alert.alert(
      'Report and hide file?',
      'This hides the file on this device and adds it to local owner review. It does not remove the file for other members.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            reportCommunityContent(db, {
              communityId: file.communityId,
              channelId: file.channelId,
              targetKind: 'file',
              targetId: communityFileReportTarget({ channelId: file.channelId, attachmentId: file.attachmentId }),
              targetAuthorDeviceId: file.authorDeviceId,
              targetLabel: file.name,
              reason: 'Reported from global Downloads',
            });
            setSafetyRevision((value) => value + 1);
          },
        },
      ],
    );
  }, [db]);

  const resultById = useMemo(() => {
    const map = new Map<string, string>();
    if (!result) return map;
    for (const outcome of result.perFile) map.set(outcome.id, perFileOutcomeLabel(outcome));
    return map;
  }, [result]);

  const resultStatusById = useMemo(() => {
    const map = new Map<string, 'saved' | 'failed' | 'skipped'>();
    if (!result) return map;
    for (const outcome of result.perFile) map.set(outcome.id, outcome.status);
    return map;
  }, [result]);

  const runBulkSave = useCallback(() => {
    void saveRows(resolveFilesToSave(filteredFiles, selection.selectedIds) as GlobalDownloadFile[]);
  }, [filteredFiles, saveRows, selection.selectedIds]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selectMode ? 'Cancel selection' : 'Back'}
          onPress={selectMode ? clearSelection : () => {
            // Deep-linkable screen: back must not dead-end.
            if (router.canGoBack()) router.back();
            else router.replace('/settings');
          }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          {selectMode
            ? <X size={20} color={c.text} strokeWidth={1.9} />
            : <ArrowLeft size={20} color={c.text} strokeWidth={1.9} />}
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.titleText} numberOfLines={1}>
            {selectMode ? `${selectionSummary.count} selected` : 'Downloads'}
          </Text>
          <Text style={styles.subtitleText} numberOfLines={1}>
            {downloadSummary.total} files · {downloadSummary.onDevice} on device · {formatBytes(downloadSummary.onDeviceBytes)}
          </Text>
        </View>
        {!selectMode && downloadSummary.onDevice > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select downloads"
            onPress={() => {
              setSelectMode(true);
              setResult(null);
            }}
            style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
          >
            <Text style={styles.headerActionText}>Select</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <View style={styles.searchRow}>
          <Search size={16} color={c.textTertiary} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search files, channels, communities"
            placeholderTextColor={c.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
            accessibilityLabel="Search downloads"
          />
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((filter) => {
            const active = status === filter.id;
            return (
              <Pressable
                key={filter.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setStatus(filter.id)}
                style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {checking ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>Checking this device</Text>
            <Text style={styles.stateText}>Reading which verified files are stored locally across communities.</Text>
          </View>
        ) : null}

        {loadError ? (
          <View style={[styles.statePanel, styles.errorPanel]}>
            <Text style={[styles.stateTitle, { color: c.danger }]}>Could not check downloads</Text>
            <Text style={styles.stateText}>{loadError}</Text>
          </View>
        ) : null}

        {!checking && !loadError && liveFiles.length === 0 ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>No downloads yet</Text>
            <Text style={styles.stateText}>Files shared in communities will appear here after their signed messages exist on this device.</Text>
          </View>
        ) : null}

        {!checking && !loadError && liveFiles.length > 0 && filteredFiles.length === 0 ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>No matches</Text>
            <Text style={styles.stateText}>Change the search or status filter.</Text>
          </View>
        ) : null}

        {!checking && !loadError && downloadSummary.onDevice > 0 && downloadSummary.removed > 0 ? (
          <View style={styles.partialPanel}>
            <Download size={16} color={c.warning} strokeWidth={2} />
            <Text style={styles.partialText}>
              Partial availability: {downloadSummary.onDevice} on this device, {downloadSummary.removed} removed.
            </Text>
          </View>
        ) : null}

        {selectMode && filteredFiles.length > 0 ? (
          <View style={styles.selBar}>
            <Text style={styles.selBarText}>Select on-device files to export</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={allVisibleOnDeviceSelected ? 'Clear selection' : 'Select all visible on-device files'}
              onPress={toggleSelectAll}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={styles.selBarAction}>{allVisibleOnDeviceSelected ? 'Clear' : 'Select visible'}</Text>
            </Pressable>
          </View>
        ) : null}

        {filteredFiles.map((file) => {
          const selected = selection.selectedIds.has(file.id);
          const outcomeLabel = resultById.get(file.id) ?? null;
          const outcomeStatus = resultStatusById.get(file.id) ?? null;
          return (
            <Pressable
              key={file.id}
              accessibilityRole={selectMode ? 'checkbox' : 'button'}
              accessibilityState={selectMode ? { checked: selected, disabled: !file.present } : undefined}
              accessibilityLabel={
                selectMode
                  ? `${file.name}${file.present ? '' : ', removed, not selectable'}`
                  : `${file.name} in ${file.communityName}, ${file.channelName}`
              }
              disabled={selectMode && !file.present}
              onPress={selectMode && file.present ? () => dispatchSelection({ type: 'toggle', id: file.id }) : undefined}
              style={({ pressed }) => [styles.fileRow, pressed && selectMode && file.present && styles.pressed]}
            >
              {selectMode ? (
                <View style={[styles.checkbox, selected && styles.checkboxOn, !file.present && styles.checkboxDisabled]}>
                  {selected ? <Check size={14} color={c.onAccent} strokeWidth={3} /> : null}
                </View>
              ) : null}
              <View style={[styles.fileIconBox, !file.present && styles.fileIconBoxRemoved]}>
                <FileIcon mimeType={file.mimeType} color={file.present ? c.textSecondary : c.warning} size={17} />
              </View>
              <View style={styles.fileText}>
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                <Text
                  style={[
                    styles.fileMeta,
                    outcomeStatus === 'saved' && { color: c.success },
                    outcomeStatus === 'failed' && { color: c.danger },
                  ]}
                  numberOfLines={2}
                >
                  {outcomeLabel
                    ? outcomeLabel
                    : `${file.communityName} · #${file.channelName} · by ${authorName(file)} · ${formatBytes(file.size)} · ${file.present ? 'on device' : 'removed'}`}
                </Text>
              </View>
              {!selectMode ? (
                <View style={styles.fileActions}>
                  {file.present ? (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${file.name}`}
                        accessibilityState={{ disabled: saving }}
                        disabled={saving}
                        onPress={() => openFile(file)}
                        style={({ pressed }) => [styles.rowBtn, pressed && styles.pressed, saving && styles.disabled]}
                      >
                        <Text style={styles.rowBtnText}>Open</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Save ${file.name}`}
                        accessibilityState={{ disabled: saving }}
                        disabled={saving}
                        onPress={() => { void saveRows([file]); }}
                        style={({ pressed }) => [styles.rowBtn, pressed && styles.pressed, saving && styles.disabled]}
                      >
                        <Text style={styles.rowBtnText}>Save</Text>
                      </Pressable>
                    </>
                  ) : (
                    <FileIndexRequestButton
                      target={{
                        communityId: file.communityId,
                        channelId: file.channelId,
                        messageId: file.messageId,
                        attachmentId: file.attachmentId,
                        blobHash: file.blobHash,
                        authorDeviceId: file.authorDeviceId,
                        name: file.name,
                      }}
                      onRestored={refreshPresence}
                    />
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Report ${file.name}`}
                    onPress={() => reportFile(file)}
                    style={({ pressed }) => [styles.reportBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.reportBtnText}>Report</Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          );
        })}

        {result ? (
          <View style={[
            styles.resultBanner,
            result.failedCount === 0 && result.savedCount > 0 && { borderColor: c.success, backgroundColor: c.successSoft },
            result.failedCount > 0 && { borderColor: c.warning, backgroundColor: c.warningSoft },
          ]}>
            <CheckCircle2 size={16} color={result.failedCount > 0 ? c.warning : c.success} strokeWidth={2} />
            <Text style={[styles.resultBannerText, { color: result.failedCount > 0 ? c.warning : c.success }]}>
              {bulkSaveHeadline(result)}
              {result.skippedCount > 0 ? ` · ${result.skippedCount} skipped` : ''}
            </Text>
          </View>
        ) : null}

        <HonestNotice text="Downloads is one browser for files already represented by verified community messages saved on this device. On-device versus removed is checked live against local storage; removed files are never saveable." />
        <HonestNotice text="Open uses the OS share sheet for verified local bytes. Save writes already-decrypted bytes to the OS destination you choose. Nothing is fetched from a fallback server." />

        <View style={{ height: insets.bottom + (selectMode ? 96 : 24) }} />
      </ScrollView>

      {selectMode ? (
        <View style={[styles.bulkBar, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.bulkBarMeta}>{selectionSummary.label}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Save ${selectionSummary.count} selected downloads`}
            accessibilityState={{ disabled: selectionSummary.count === 0 || saving }}
            disabled={selectionSummary.count === 0 || saving}
            onPress={runBulkSave}
            style={({ pressed }) => [
              styles.bulkBarButton,
              pressed && styles.pressed,
              (selectionSummary.count === 0 || saving) && styles.disabled,
            ]}
          >
            <Text style={styles.bulkBarButtonText}>{saving ? 'Saving...' : 'Save to...'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: c.surface,
    borderBottomColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, minWidth: 0 },
  titleText: { color: c.text, fontSize: 18, fontWeight: '800' },
  subtitleText: { color: c.textSecondary, fontSize: 12, marginTop: 1 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: MK_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  headerAction: {
    minHeight: 36,
    borderRadius: MK_RADIUS.md,
    backgroundColor: c.surfaceHigh,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: { color: c.accent, fontSize: 13, fontWeight: '800' },
  scroll: { flex: 1 },
  body: { padding: 14, gap: 8 },
  searchRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: MK_RADIUS.md,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, color: c.text, fontSize: 14, paddingVertical: 10 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    borderRadius: MK_RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: { backgroundColor: c.accent, borderColor: c.accent },
  filterChipText: { color: c.textSecondary, fontSize: 12, fontWeight: '800' },
  filterChipTextActive: { color: c.onAccent },
  statePanel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 14,
    gap: 4,
  },
  errorPanel: { borderColor: c.danger, backgroundColor: c.dangerSoft },
  stateTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  stateText: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  partialPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: MK_RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.warning,
    backgroundColor: c.warningSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  partialText: { flex: 1, color: c.warning, fontSize: 12.5, fontWeight: '700' },
  selBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  selBarText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  selBarAction: { color: c.accent, fontSize: 13, fontWeight: '800' },
  fileRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: MK_RADIUS.sm,
    borderWidth: 1.5,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkboxDisabled: { opacity: 0.4 },
  fileIconBox: {
    width: 34,
    height: 34,
    borderRadius: MK_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  fileIconBoxRemoved: {
    backgroundColor: c.warningSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.warning,
    borderStyle: 'dashed',
  },
  fileText: { flex: 1, minWidth: 0, gap: 2 },
  fileName: { color: c.text, fontSize: 13, fontWeight: '700' },
  fileMeta: { color: c.textTertiary, fontSize: 11, lineHeight: 15 },
  fileActions: { alignItems: 'flex-end', gap: 6 },
  rowBtn: {
    borderRadius: MK_RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rowBtnText: { color: c.accentDim, fontSize: 11.5, fontWeight: '700' },
  reportBtn: {
    borderRadius: MK_RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.danger,
    backgroundColor: c.dangerSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  reportBtnText: { color: c.danger, fontSize: 11, fontWeight: '800' },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  resultBannerText: { flex: 1, fontSize: 13, fontWeight: '800' },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: c.surface,
    borderTopColor: c.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bulkBarMeta: { color: c.text, fontSize: 14, fontWeight: '700' },
  bulkBarButton: {
    backgroundColor: c.accent,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  bulkBarButtonText: { color: c.onAccent, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
