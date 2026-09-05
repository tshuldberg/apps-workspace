// Per-community Files index + bulk multi-select export (Phase 2 of Files & Sharing).
//
// A hidden stack route (href:null) reached from the channel header (primary) and
// each community panel (secondary). NOT a global Downloads tab. Community-scoped.
//
// Honesty boundary (Critical), all enforced by the pure core in
// data/community-files.ts; this screen is a thin renderer:
//   - The file list is AGGREGATED from listChannelMessages (resolved events), so
//     attachments from deleted/superseded messages never appear. It never reads
//     cm_message_attachments rows.
//   - on-device vs removed comes ONLY from a real ExpoBlobStore.has() pass.
//   - Bulk save returns honest per-file results from the verified-write core; the
//     header reads "{saved} of {total} saved" from real counts, never "all done".
//   - Removed files are not selectable; their Request affordance (D.1) drives the
//     LIVE sealed FILE_REQUEST flow via FileIndexRequestButton. The button is only
//     interactive when a real request is possible (paired author + relay set); when
//     it never can be, it is absent, never a fake-disabled stub.

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  FileText,
  Film,
  Image as ImageIcon,
  X,
} from 'lucide-react-native';
import { getPublicKeyFingerprint, listCommunities } from '@mylife/sync';
import { HonestNotice } from '../../components/kit';
import { formatBytes, type MkColors, MK_RADIUS, shortHex } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import { useIdentity } from '../../providers/IdentityProvider';
import { useNode } from '../../providers/NodeProvider';
import { useSync } from '../../providers/SyncProvider';
import { ExpoBlobStore } from '../../data/expo-blob-store';
import { buildCommunityPeerNameMap } from '../../data/community-core';
import { listLibraries, promoteChannelFile } from '../../data/library-store-core';
import { canCurateLibrary, libraryDisplayName } from '../../data/library-hub-core';
import { LIBRARY_STRINGS } from '../../data/library-view-core';
import {
  EMPTY_FILE_SELECTION,
  aggregateCommunityFiles,
  applyPresence,
  bulkSaveHeadline,
  buildPresenceMap,
  fileSelectionReducer,
  perFileOutcomeLabel,
  resolveFilesToSave,
  saveFilesBulk,
  summarizeSelection,
  type BulkSaveResult,
  type PresentFile,
} from '../../data/community-files';
import {
  communityFileReportTarget,
  isChannelMuted,
  isCommunityContentReportHidden,
  isCommunityPersonBlocked,
  reportCommunityContent,
} from '../../data/community-safety';
import { FileIndexRequestButton } from '../../components/FileIndexRequestButton';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function FileIcon({ mimeType, color, size }: { mimeType: string; color: string; size: number }) {
  if (mimeType.startsWith('image/')) return <ImageIcon size={size} color={color} strokeWidth={2} />;
  if (mimeType.startsWith('video/')) return <Film size={size} color={color} strokeWidth={2} />;
  return <FileText size={size} color={color} strokeWidth={2} />;
}

export default function CommunityFilesScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { saveContent, saveContentToDocuments, getSaveDestination, chooseSaveDestination, store } = useNode();
  const { recordLocalChange } = useSync();
  const blobStore = useMemo(() => new ExpoBlobStore(db), [db]);

  const params = useLocalSearchParams<{ communityId: string; mode?: string }>();
  const communityId = param(params.communityId);
  const startInSelectMode = param(params.mode) === 'select';

  // Plan 38: libraries in THIS community the current device may curate. A file
  // card gains an "Add to library" action ONLY when at least one exists (the
  // data layer still enforces curation on write).
  const [libTarget, setLibTarget] = useState<PresentFile | null>(null);
  const curatableLibraries = useMemo(
    () => listLibraries(db, communityId)
      .filter((cfg) => canCurateLibrary(db, identity.publicKey, communityId, cfg.channelId))
      .map((cfg) => ({ config: cfg, name: libraryDisplayName(db, cfg) })),
    [db, communityId, identity.publicKey],
  );

  const addFileToLibrary = useCallback(
    (file: PresentFile, channelId: string) => {
      void (async () => {
        try {
          await promoteChannelFile(
            db,
            store,
            identity,
            { blobHash: file.blobHash, channelId, workspaceId: communityId, title: file.name, mimeType: file.mimeType },
            (hash) => blobStore.get(hash),
            { recordChange: recordLocalChange },
          );
          Alert.alert('Added to library', `"${file.name}" is now in this community's library.`);
        } catch (err) {
          Alert.alert('Could not add to library', err instanceof Error ? err.message : String(err));
        }
      })();
    },
    [db, store, identity, communityId, blobStore, recordLocalChange],
  );

  // A pick from the library sheet is QUEUED and runs only after the Modal has
  // fully dismissed (onDismiss on iOS, the visibility effect on Android): the
  // promote path ends in an Alert, and presenting one while the Modal is
  // mid-dismissal is the freeze class.
  const libPendingRef = useRef<{ file: PresentFile; channelId: string } | null>(null);
  const flushLibPending = useCallback(() => {
    const pending = libPendingRef.current;
    libPendingRef.current = null;
    if (pending) addFileToLibrary(pending.file, pending.channelId);
  }, [addFileToLibrary]);
  useEffect(() => {
    if (libTarget === null && Platform.OS !== 'ios') flushLibPending();
  }, [libTarget, flushLibPending]);

  const community = useMemo(
    () => listCommunities(db).find((item) => item.communityId === communityId) ?? null,
    [db, communityId],
  );
  const peerNames = useMemo(
    () => (community ? buildCommunityPeerNameMap(db, communityId) : new Map<string, string>()),
    [db, community, communityId],
  );
  const [safetyRevision, setSafetyRevision] = useState(0);

  const aggregated = useMemo(() => {
    void safetyRevision;
    if (!community) return [];
    return aggregateCommunityFiles(db, communityId, community.descriptor.channels).filter((file) => (
      !isChannelMuted(db, communityId, file.channelId)
      && !isCommunityPersonBlocked(db, communityId, file.authorDeviceId)
      && !isCommunityContentReportHidden(db, communityId, 'file', communityFileReportTarget({ channelId: file.channelId, attachmentId: file.attachmentId }))
      && !isCommunityContentReportHidden(db, communityId, 'message', file.messageId)
    ));
  }, [db, communityId, community, safetyRevision]);

  // present === null => the live has() pass has not resolved yet (checking state).
  const [files, setFiles] = useState<PresentFile[] | null>(null);
  const [selectMode, setSelectMode] = useState(startInSelectMode);
  const [selection, dispatch] = useReducer(fileSelectionReducer, EMPTY_FILE_SELECTION);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<BulkSaveResult | null>(null);

  // Live presence pass over the synchronous aggregation. Re-runs on focus so a
  // remove done in the channel screen is reflected here.
  const refreshPresence = useCallback(async () => {
    const presence = await buildPresenceMap(aggregated, (hash) => blobStore.has(hash));
    setFiles(applyPresence(aggregated, presence));
  }, [aggregated, blobStore]);

  useEffect(() => {
    let cancelled = false;
    setFiles(null);
    void (async () => {
      const presence = await buildPresenceMap(aggregated, (hash) => blobStore.has(hash));
      if (!cancelled) setFiles(applyPresence(aggregated, presence));
    })();
    return () => {
      cancelled = true;
    };
  }, [aggregated, blobStore]);

  useFocusEffect(useCallback(() => { void refreshPresence(); }, [refreshPresence]));

  // When opened in Select mode (whole-community), pre-select every on-device file
  // once presence resolves so the user sees exactly what will be saved.
  const [preselected, setPreselected] = useState(false);
  useEffect(() => {
    if (startInSelectMode && !preselected && files) {
      dispatch({ type: 'select-all', files });
      setPreselected(true);
    }
  }, [startInSelectMode, preselected, files]);

  const liveFiles = useMemo(() => files ?? [], [files]);
  const onDeviceCount = liveFiles.filter((file) => file.present).length;
  const summary = summarizeSelection(liveFiles, selection.selectedIds);
  const allOnDeviceSelected = onDeviceCount > 0 && summary.count === onDeviceCount;

  const enterSelect = useCallback(() => {
    setSelectMode(true);
    setResult(null);
  }, []);

  const exitSelect = useCallback(() => {
    setSelectMode(false);
    setPreselected(false);
    dispatch({ type: 'clear' });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allOnDeviceSelected) dispatch({ type: 'clear' });
    else dispatch({ type: 'select-all', files: liveFiles });
  }, [allOnDeviceSelected, liveFiles]);

  // Save one selected+present row from the index (View-less quick save, reuses the
  // exact per-item verified-write path with the Android destination prompt).
  const saveSingle = useCallback(
    (file: PresentFile) => {
      void (async () => {
        setSaving(true);
        setResult(null);
        try {
          if (Platform.OS === 'android' && !getSaveDestination()) {
            const chosen = await chooseSaveDestination();
            if (!chosen) {
              setResult({
                total: 1,
                savedCount: 0,
                failedCount: 0,
                skippedCount: 1,
                perFile: [{ id: file.id, name: file.name, status: 'skipped', reason: 'Save cancelled. Nothing was written.' }],
              });
              return;
            }
          }
          const bulk = await saveFilesBulk({
            files: [file],
            loadBytes: (hash) => blobStore.get(hash),
            saveOne: ({ bytes, name, mimeType }) =>
              Platform.OS === 'ios'
                ? saveContentToDocuments({ bytes, name, subfolder: community?.descriptor.name })
                : saveContent({ bytes, name, mimeType }),
          });
          setResult(bulk);
          await refreshPresence().catch(() => undefined);
        } catch (error) {
          // Without this catch a thrown destination prompt or bulk-save died
          // silently while `finally` reset saving = an idle-looking dead tap.
          Alert.alert('Could not save', error instanceof Error ? error.message : 'Could not save that file.');
        } finally {
          setSaving(false);
        }
      })();
    },
    [blobStore, saveContent, saveContentToDocuments, getSaveDestination, chooseSaveDestination, community, refreshPresence],
  );

  const reportFile = useCallback((file: PresentFile) => {
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
              communityId,
              channelId: file.channelId,
              targetKind: 'file',
              targetId: communityFileReportTarget({ channelId: file.channelId, attachmentId: file.attachmentId }),
              targetAuthorDeviceId: file.authorDeviceId,
              targetLabel: file.name,
              reason: 'Reported from Files',
            });
            setSafetyRevision((value) => value + 1);
          },
        },
      ],
    );
  }, [db, communityId]);

  // Bulk save the selected + present rows. Android prompts once for a folder if
  // none is set (cancel = nothing written); iOS writes verified copies into the
  // Files-visible documents folder in one pass (no per-file share sheet).
  const runBulkSave = useCallback(() => {
    const toSave = resolveFilesToSave(liveFiles, selection.selectedIds);
    if (toSave.length === 0) return;
    void (async () => {
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
              ? saveContentToDocuments({ bytes, name, subfolder: community?.descriptor.name })
              : saveContent({ bytes, name, mimeType }),
        });
        setResult(bulk);
        await refreshPresence().catch(() => undefined);
      } catch (error) {
        // Without this catch a thrown destination prompt or bulk-save died
        // silently while `finally` reset saving = an idle-looking dead tap.
        Alert.alert('Could not save', error instanceof Error ? error.message : 'Could not save those files.');
      } finally {
        setSaving(false);
      }
    })();
  }, [liveFiles, selection.selectedIds, blobStore, saveContent, saveContentToDocuments, getSaveDestination, chooseSaveDestination, community, refreshPresence]);

  // Deep links and relaunch restores can make this the only route; back then
  // needs a real destination (community home, or the list when details are gone).
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else if (community) router.replace({ pathname: '/community/[communityId]', params: { communityId } });
    else router.replace('/communities');
  }, [router, community, communityId]);

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
  const fileAuthorName = useCallback(
    (file: PresentFile): string => {
      if (file.authorDeviceId === identity.publicKey) {
        const communityName = peerNames.get(file.authorDeviceId);
        return communityName ? `You as ${communityName}` : 'You';
      }
      return peerNames.get(file.authorDeviceId) ?? shortHex(getPublicKeyFingerprint(file.authorDeviceId));
    },
    [identity.publicKey, peerNames],
  );

  if (!community) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.missingTitle}>Files unavailable</Text>
        <HonestNotice text="This device does not have the community details needed to open these files. Nothing is loaded from a fallback server." />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const checking = files === null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selectMode ? 'Cancel selection' : 'Back'}
          onPress={selectMode ? exitSelect : goBack}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          {selectMode
            ? <X size={20} color={c.text} strokeWidth={1.9} />
            : <ArrowLeft size={20} color={c.text} strokeWidth={1.9} />}
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.titleText} numberOfLines={1}>
            {selectMode ? `${summary.count} selected` : 'Files'}
          </Text>
          <Text style={styles.subtitleText} numberOfLines={1}>
            {community.descriptor.name} · all channels
          </Text>
        </View>
        {!selectMode ? (
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open global Downloads"
              onPress={() => router.push('/downloads')}
              style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
            >
              <Text style={styles.headerActionText}>All</Text>
            </Pressable>
            {onDeviceCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Select files"
                onPress={enterSelect}
                style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
              >
                <Text style={styles.headerActionText}>Select</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        {checking ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>Checking this device</Text>
            <Text style={styles.stateText}>Reading which files are stored locally.</Text>
          </View>
        ) : null}

        {!checking && liveFiles.length === 0 ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>No files yet</Text>
            <Text style={styles.stateText}>
              Files shared in this community's channels will appear here, with their channel and whether this device has the bytes.
            </Text>
          </View>
        ) : null}

        {selectMode && liveFiles.length > 0 ? (
          <View style={styles.selBar}>
            <Text style={styles.selBarText}>Select files to export</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={allOnDeviceSelected ? 'Clear selection' : 'Select all on-device files'}
              onPress={toggleSelectAll}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={styles.selBarAction}>{allOnDeviceSelected ? 'Clear' : 'Select all'}</Text>
            </Pressable>
          </View>
        ) : null}

        {liveFiles.map((file) => {
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
                  : `${file.name} in ${file.channelName}`
              }
              disabled={selectMode && !file.present}
              onPress={selectMode
                ? (file.present ? () => dispatch({ type: 'toggle', id: file.id }) : undefined)
                : undefined}
              style={({ pressed }) => [styles.fileRow, pressed && selectMode && file.present && styles.pressed]}
            >
              {selectMode ? (
                <View style={[
                  styles.checkbox,
                  selected && styles.checkboxOn,
                  !file.present && styles.checkboxDisabled,
                ]}>
                  {selected ? <Check size={14} color={c.onAccent} strokeWidth={3} /> : null}
                </View>
              ) : null}
              <View style={[styles.fileIconBox, !file.present && styles.fileIconBoxRemoved]}>
                <FileIcon mimeType={file.mimeType} color={file.present ? c.textSecondary : c.warning} size={17} />
              </View>
              <View style={styles.fileText}>
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                <Text style={[
                  styles.fileMeta,
                  outcomeStatus === 'saved' && { color: c.success },
                  outcomeStatus === 'failed' && { color: c.danger },
                ]} numberOfLines={2}>
                  {outcomeLabel
                    ? outcomeLabel
                    : `#${file.channelName} · by ${fileAuthorName(file)} · ${formatBytes(file.size)} · ${file.present ? 'on device' : 'removed'}`}
                </Text>
              </View>
              {!selectMode ? (
                <View style={styles.fileActions}>
                  {file.present ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Save ${file.name}`}
                      accessibilityState={{ disabled: saving }}
                      disabled={saving}
                      onPress={() => saveSingle(file)}
                      style={({ pressed }) => [styles.rowBtn, pressed && styles.pressed, saving && styles.disabled]}
                    >
                      <Text style={styles.rowBtnText}>Save</Text>
                    </Pressable>
                  ) : (
                    <FileIndexRequestButton
                      target={{
                        communityId,
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
                  {file.present && curatableLibraries.length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${LIBRARY_STRINGS.addToLibrary}: ${file.name}`}
                      onPress={() => {
                        if (curatableLibraries.length === 1) {
                          addFileToLibrary(file, curatableLibraries[0]!.config.channelId);
                        } else {
                          setLibTarget(file);
                        }
                      }}
                      style={({ pressed }) => [styles.rowBtn, pressed && styles.pressed]}
                    >
                      <Text style={styles.rowBtnText}>{LIBRARY_STRINGS.addToLibrary}</Text>
                    </Pressable>
                  ) : null}
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
            <CheckCircle2
              size={16}
              color={result.failedCount > 0 ? c.warning : c.success}
              strokeWidth={2}
            />
            <Text style={[
              styles.resultBannerText,
              { color: result.failedCount > 0 ? c.warning : c.success },
            ]}>
              {bulkSaveHeadline(result)}
              {result.skippedCount > 0 ? ` · ${result.skippedCount} skipped` : ''}
            </Text>
          </View>
        ) : null}

        {!selectMode && liveFiles.some((file) => !file.present) ? (
          <HonestNotice text="Removed files were freed from this device. Use Request on a removed file to ask the member who shared it to re-send; the request is sealed and sent only when a connection server is set and that member is a paired peer." />
        ) : null}

        <HonestNotice text="This list is built from messages saved on this device. Available versus removed is checked live against local storage; nothing is fetched from a fallback server. Paid hosted file storage is not connected in this build." />

        <View style={{ height: insets.bottom + (selectMode ? 96 : 24) }} />
      </ScrollView>

      {selectMode ? (
        <View style={[styles.bulkBar, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.bulkBarMeta}>{summary.label}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Save ${summary.count} selected files`}
            accessibilityState={{ disabled: summary.count === 0 || saving }}
            disabled={summary.count === 0 || saving}
            onPress={runBulkSave}
            style={({ pressed }) => [
              styles.bulkBarButton,
              pressed && styles.pressed,
              (summary.count === 0 || saving) && styles.disabled,
            ]}
          >
            <Text style={styles.bulkBarButtonText}>{saving ? 'Saving…' : 'Save to…'}</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={libTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setLibTarget(null)}
        onDismiss={flushLibPending}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close library picker"
          style={styles.libPickerBackdrop}
          onPress={() => setLibTarget(null)}
        >
          <Pressable style={styles.libPickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.libPickerTitle}>{LIBRARY_STRINGS.addToLibrary}</Text>
            {curatableLibraries.map((lib) => (
              <Pressable
                key={lib.config.id}
                accessibilityRole="button"
                accessibilityLabel={`${LIBRARY_STRINGS.addToLibrary}: ${lib.name}`}
                style={styles.libPickerRow}
                onPress={() => {
                  if (!libTarget) return;
                  libPendingRef.current = { file: libTarget, channelId: lib.config.channelId };
                  setLibTarget(null);
                }}
              >
                <Text style={styles.libPickerRowText}>{lib.name}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  libPickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  libPickerSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    padding: 20,
    gap: 4,
  },
  libPickerTitle: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  libPickerRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  libPickerRowText: { color: c.text, fontSize: 15, fontWeight: '600' },
  container: { flex: 1, backgroundColor: c.background },
  center: { padding: 16, justifyContent: 'center', gap: 14 },
  missingTitle: { color: c.text, fontSize: 22, fontWeight: '800' },
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  statePanel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 14,
    gap: 4,
  },
  stateTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  stateText: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
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
  rowBtnDisabled: { opacity: 0.45, borderColor: c.border },
  rowBtnDisabledText: { color: c.textTertiary, fontSize: 11.5, fontWeight: '700' },
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
  secondaryButton: {
    backgroundColor: c.surfaceHigh,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignSelf: 'flex-start',
  },
  secondaryButtonText: { color: c.text, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.42 },
});
