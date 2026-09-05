// Plan 38 Phase 5 (MOBILE): the library item detail screen. Metadata per type, a
// real "Held on this device" badge (store query), and honest open actions:
//   - images open FULL-SCREEN in-app from the verified decrypted bytes,
//   - documents open through the OS with a plaintext-export warning,
//   - audio/video show a visibly-honest disabled stub (the player build owns real
//     playback; this build does not fake it).
// Curator/author affordances (edit metadata, add to collection, tag, remove) are
// hidden when this device may not curate; the data layer still enforces on write.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image as RNImage,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { encodeBase64 } from 'tweetnacl-util';
import { ArrowLeft, Check, Tag, Trash2, FolderPlus, Pencil, X } from 'lucide-react-native';
import { useMeerkatDatabase } from '../../../providers/DatabaseProvider';
import { useNode } from '../../../providers/NodeProvider';
import { useIdentity } from '../../../providers/IdentityProvider';
import { useSync } from '../../../providers/SyncProvider';
import { Button, HonestNotice } from '../../../components/kit';
import { formatBytes, MK_RADIUS, type MkColors } from '../../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../../providers/AppThemeProvider';
import {
  addItemToCollection,
  addLibraryItemTag,
  createLibraryCollection,
  getLibrary,
  getLibraryItem,
  getLibraryItemPinInfo,
  getLibraryProgress,
  keepLibraryItemOnDevice,
  listLibraryCollections,
  listLibraryItemTags,
  openLibraryItemContent,
  releaseLibraryItemFromDevice,
  tombstoneLibraryItem,
  touchLibraryItemUse,
  type LibraryItemPinInfo,
} from '../../../data/library-store-core';
import { KEEP_ON_DEVICE_LABEL, LAST_COPY_DELETE_CONFIRM } from '../../../data/library-storage-core';
import { canCurateLibrary, editLibraryItemMetadata, libraryDisplayName } from '../../../data/library-hub-core';
import { readerKindFor } from '../../../data/library-reader-core';
import type { LibraryItemEvent } from '../../../data/library-data-core';

/** Canonical honest wording for the plaintext-export path (shared with the player). */
const EXPORT_WARNING = 'This exports a decrypted copy outside Meerkat.';

type OpenKind = 'image' | 'document' | 'av' | 'unknown';

function classifyMime(mime: string | null): OpenKind {
  if (!mime) return 'unknown';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'av';
  return 'document';
}

const KNOWN_META_LABELS: Record<string, string> = {
  artist: 'Artist',
  album: 'Album',
  trackNumber: 'Track',
  series: 'Series',
  season: 'Season',
  episode: 'Episode',
  isbn: 'ISBN',
  pages: 'Pages',
  plot: 'Overview',
  capturedAt: 'Date taken',
};

export default function LibraryItemDetailScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { store } = useNode();
  const { identity } = useIdentity();
  const { recordLocalChange } = useSync();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();

  const [item, setItem] = useState<LibraryItemEvent | null>(null);
  const [held, setHeld] = useState(false);
  const [pinInfo, setPinInfo] = useState<LibraryItemPinInfo | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);

  const load = useCallback(() => {
    if (!itemId) return;
    const next = getLibraryItem(db, itemId);
    setItem(next);
    if (next) {
      setTags(listLibraryItemTags(db, next.channelId, next.id));
      void store.getManifest(next.contentCid, next.communityId).then((m) => setHeld(!!m));
      void getLibraryItemPinInfo(db, store, next).then(setPinInfo);
    }
  }, [db, itemId, store]);

  // "Keep on this device" toggle: ON pins explicit (protected from eviction); OFF
  // deletes THIS device's copy after the honest last-copy confirm. Authored copies
  // are always kept and are removed only via "Remove item" (tombstone).
  const onToggleKeep = useCallback(() => {
    if (!item || !pinInfo) return;
    if (!pinInfo.kept) {
      void (async () => {
        try {
          await keepLibraryItemOnDevice(db, store, item);
          setPinInfo(await getLibraryItemPinInfo(db, store, item));
        } catch (err) {
          Alert.alert('Could not keep this item', err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }
    Alert.alert('Remove this copy?', LAST_COPY_DELETE_CONFIRM, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove copy',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await releaseLibraryItemFromDevice(db, store, item);
              const next = await getLibraryItemPinInfo(db, store, item);
              setPinInfo(next);
              setHeld(next.held);
            } catch (err) {
              Alert.alert('Could not remove this copy', err instanceof Error ? err.message : String(err));
            }
          })();
        },
      },
    ]);
  }, [db, store, item, pinInfo]);

  useEffect(() => { load(); }, [load]);

  const config = useMemo(() => (item ? getLibrary(db, item.channelId) : null), [db, item]);
  const libraryName = useMemo(() => (config ? libraryDisplayName(db, config) : 'Library'), [db, config]);
  const canCurate = useMemo(
    () => (item ? canCurateLibrary(db, identity.publicKey, item.communityId, item.channelId) : false),
    [db, item, identity.publicKey],
  );
  const isAuthor = item?.authorDeviceId === identity.publicKey;
  const canEdit = canCurate || isAuthor;
  const progress = useMemo(() => (item ? getLibraryProgress(db, item.id) : null), [db, item]);

  const metadata = useMemo(() => {
    if (!item) return {} as Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(item.metadataJson);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }, [item]);

  const openKind = classifyMime(item?.mimeType ?? null);
  const readerKind = item ? readerKindFor(item.mimeType, item.title) : null;

  const openContent = useCallback(() => {
    if (!item) return;
    void (async () => {
      setBusy(true);
      try {
        const bytes = await openLibraryItemContent(db, store, identity, item);
        if (!bytes) {
          Alert.alert('Not on this device', 'This item is not stored on this device yet. Sync with a device that holds it to bring it here.');
          return;
        }
        // Opening counts as a use: refresh LRU recency so an opened cached item
        // is the last to be evicted under budget pressure.
        void touchLibraryItemUse(store, item);
        if (openKind === 'image') {
          const uri = `data:${item.mimeType ?? 'image/jpeg'};base64,${encodeBase64(bytes)}`;
          setImageUri(uri);
          setViewerOpen(true);
          return;
        }
        // Documents: temp decrypt + OS open-in with an explicit plaintext warning.
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          Alert.alert('Open unavailable', 'This platform cannot open exported files from the app sandbox.');
          return;
        }
        Alert.alert(
          'Open outside Meerkat?',
          EXPORT_WARNING + ' Delete it from the other app when you are done.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open',
              onPress: () => {
                void (async () => {
                  const safeName = (item.title || 'file').replace(/[^\w.-]+/g, '_');
                  const path = `${FileSystem.cacheDirectory}${safeName}`;
                  await FileSystem.writeAsStringAsync(path, encodeBase64(bytes), {
                    encoding: FileSystem.EncodingType.Base64,
                  });
                  await Sharing.shareAsync(path, {
                    mimeType: item.mimeType ?? 'application/octet-stream',
                    dialogTitle: item.title,
                  });
                  await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
                })().catch((err) => {
                  Alert.alert('Could not open the file', err instanceof Error ? err.message : String(err));
                });
              },
            },
          ],
        );
      } catch (err) {
        Alert.alert('Could not open this item', err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  }, [db, store, identity, item, openKind]);

  const confirmRemove = useCallback(() => {
    if (!item) return;
    Alert.alert(
      'Remove this item?',
      'This signs a removal that hides the item everywhere it syncs, and frees its space on this device when no other item still points at the same file.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await tombstoneLibraryItem(db, store, identity, item.id, { recordChange: recordLocalChange });
              } catch (err) {
                Alert.alert('Could not remove this item', err instanceof Error ? err.message : String(err));
                return;
              }
              if (router.canGoBack()) router.back();
              else router.replace(`/library/${item.channelId}`);
            })();
          },
        },
      ],
    );
  }, [db, store, identity, item, recordLocalChange, router]);

  if (!item) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Header onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/library'); }} title="Item" />
        <View style={styles.missing}>
          <Text style={styles.missingText}>This item is no longer available on this device.</Text>
        </View>
      </View>
    );
  }

  const metaRows = Object.entries(metadata).filter(
    ([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0) && typeof v !== 'object',
  );
  const arrayRows = Object.entries(metadata).filter(([, v]) => Array.isArray(v) && v.length > 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <Header onBack={() => { if (router.canGoBack()) router.back(); else router.replace(`/library/${item.channelId}`); }} title={libraryName} />

        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.badgeRow}>
          {item.year ? <MetaPill text={String(item.year)} /> : null}
          {item.durationMs ? <MetaPill text={`${Math.round(item.durationMs / 60000)} min`} /> : null}
          {item.sizeBytes ? <MetaPill text={formatBytes(item.sizeBytes)} /> : null}
          <View style={[styles.heldPill, held ? styles.heldOn : styles.heldOff]}>
            <Text style={[styles.heldPillText, held ? styles.heldOnText : styles.heldOffText]}>
              {held ? 'Held on this device' : 'Not on this device'}
            </Text>
          </View>
        </View>

        {readerKind ? (
          <Button title="Read" onPress={() => router.push(`/library/reader/${item.id}`)} />
        ) : openKind === 'av' ? (
          <Button title="Play" onPress={() => router.push(`/library/play/${item.id}`)} />
        ) : (
          <Button
            title={openKind === 'image' ? 'View full screen' : busy ? 'Opening...' : 'Open'}
            onPress={openContent}
            disabled={busy}
          />
        )}

        {pinInfo?.held ? (
          pinInfo.pinClass === 'authored' ? (
            <Text style={styles.keepNote}>{KEEP_ON_DEVICE_LABEL}: this is your own copy and always stays.</Text>
          ) : (
            <Pressable style={styles.keepRow} onPress={onToggleKeep} accessibilityLabel={KEEP_ON_DEVICE_LABEL}>
              <View style={[styles.keepBox, pinInfo.kept && styles.keepBoxOn]}>
                {pinInfo.kept ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
              </View>
              <Text style={styles.keepLabel}>{KEEP_ON_DEVICE_LABEL}</Text>
            </Pressable>
          )
        ) : null}

        {progress && !progress.completed && progress.positionMs > 0 ? (
          <Text style={styles.resumeText}>
            Resume from {Math.round(progress.positionMs / 1000)}s (saved on your devices only).
          </Text>
        ) : null}

        {metaRows.length > 0 || arrayRows.length > 0 ? (
          <View style={styles.metaCard}>
            {metaRows.map(([key, value]) => (
              <View key={key} style={styles.metaRow}>
                <Text style={styles.metaKey}>{KNOWN_META_LABELS[key] ?? key}</Text>
                <Text style={styles.metaVal}>{String(value)}</Text>
              </View>
            ))}
            {arrayRows.map(([key, value]) => (
              <View key={key} style={styles.metaRow}>
                <Text style={styles.metaKey}>{KNOWN_META_LABELS[key] ?? key}</Text>
                <Text style={styles.metaVal}>{(value as unknown[]).join(', ')}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.tagsCard}>
          <View style={styles.tagsHead}>
            <Text style={styles.sectionLabel}>Tags</Text>
            {canEdit ? (
              <Pressable onPress={() => setTagOpen(true)} hitSlop={8} accessibilityLabel="Add tag">
                <Tag size={16} color={c.accent} />
              </Pressable>
            ) : null}
          </View>
          {tags.length > 0 ? (
            <View style={styles.tagWrap}>
              {tags.map((t) => <View key={t} style={styles.tagChip}><Text style={styles.tagChipText}>{t}</Text></View>)}
            </View>
          ) : (
            <Text style={styles.emptyLine}>No tags yet.</Text>
          )}
        </View>

        {canEdit ? (
          <View style={styles.actionsCard}>
            <ActionButton Icon={Pencil} label="Edit details" onPress={() => setEditOpen(true)} />
            <ActionButton Icon={FolderPlus} label="Add to collection" onPress={() => setCollectionOpen(true)} />
            <ActionButton Icon={Trash2} label="Remove item" danger onPress={confirmRemove} />
          </View>
        ) : null}

        <HonestNotice text="Details, tags, and collections here are signed and sync with the item. Resume position stays on your own devices and is never shared." />
        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>

      <Modal visible={viewerOpen} transparent onRequestClose={() => setViewerOpen(false)}>
        <View style={styles.viewer}>
          <Pressable style={[styles.viewerClose, { top: insets.top + 12 }]} onPress={() => setViewerOpen(false)} hitSlop={12}>
            <X size={26} color="#fff" />
          </Pressable>
          {imageUri ? <RNImage source={{ uri: imageUri }} style={styles.viewerImage} resizeMode="contain" /> : null}
        </View>
      </Modal>

      <EditSheet
        visible={editOpen}
        item={item}
        onClose={() => setEditOpen(false)}
        onSave={(patch) => {
          // Close only on success: an Alert fired while the sheet dismisses is torn
          // down with it on iOS, so a failure keeps the sheet (and the input) up.
          try {
            editLibraryItemMetadata(db, identity, item.id, patch, recordLocalChange);
          } catch (err) {
            Alert.alert('Could not save details', err instanceof Error ? err.message : String(err));
            return;
          }
          setEditOpen(false);
          load();
        }}
      />
      <TagSheet
        visible={tagOpen}
        onClose={() => setTagOpen(false)}
        onAdd={(tag) => {
          try {
            addLibraryItemTag(db, identity, { channelId: item.channelId, workspaceId: item.communityId, itemId: item.id, tag }, { recordChange: recordLocalChange });
          } catch (err) {
            Alert.alert('Could not add tag', err instanceof Error ? err.message : String(err));
            return;
          }
          setTagOpen(false);
          load();
        }}
      />
      <CollectionSheet
        visible={collectionOpen}
        channelId={item.channelId}
        workspaceId={item.communityId}
        onClose={() => setCollectionOpen(false)}
        onPick={(collectionId) => {
          try {
            addItemToCollection(db, identity, { channelId: item.channelId, workspaceId: item.communityId, collectionId, itemId: item.id }, { recordChange: recordLocalChange });
          } catch (err) {
            Alert.alert('Could not add to collection', err instanceof Error ? err.message : String(err));
            return;
          }
          setCollectionOpen(false);
        }}
        onCreate={(name) => {
          try {
            const col = createLibraryCollection(db, identity, { channelId: item.channelId, workspaceId: item.communityId, name }, { recordChange: recordLocalChange });
            addItemToCollection(db, identity, { channelId: item.channelId, workspaceId: item.communityId, collectionId: col.id, itemId: item.id }, { recordChange: recordLocalChange });
          } catch (err) {
            Alert.alert('Could not create collection', err instanceof Error ? err.message : String(err));
            return;
          }
          setCollectionOpen(false);
        }}
      />
    </View>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back">
        <ArrowLeft size={24} color={c.text} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
    </View>
  );
}

function MetaPill({ text }: { text: string }) {
  const styles = useMkStyles(makeStyles);
  return <View style={styles.metaPill}><Text style={styles.metaPillText}>{text}</Text></View>;
}

function ActionButton({ Icon, label, danger, onPress }: { Icon: typeof Pencil; label: string; danger?: boolean; onPress: () => void }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}>
      <Icon size={18} color={danger ? c.danger : c.accent} strokeWidth={1.9} />
      <Text style={[styles.actionLabel, danger && { color: c.danger }]}>{label}</Text>
    </Pressable>
  );
}

function EditSheet({ visible, item, onClose, onSave }: {
  visible: boolean;
  item: LibraryItemEvent;
  onClose: () => void;
  onSave: (patch: { title?: string; year?: number | null }) => void;
}) {
  const styles = useMkStyles(makeStyles);
  const c = useAppThemeColors();
  const [title, setTitle] = useState(item.title);
  const [year, setYear] = useState(item.year ? String(item.year) : '');
  useEffect(() => { if (visible) { setTitle(item.title); setYear(item.year ? String(item.year) : ''); } }, [visible, item]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Edit details</Text>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={c.textTertiary} />
          <Text style={styles.fieldLabel}>Year</Text>
          <TextInput style={styles.input} value={year} onChangeText={setYear} keyboardType="number-pad" placeholderTextColor={c.textTertiary} />
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="secondary" onPress={onClose} />
            <Button
              title="Save"
              onPress={() => {
                const y = year.trim() ? Number.parseInt(year.trim(), 10) : null;
                onSave({ title: title.trim() || item.title, year: Number.isFinite(y as number) ? y : null });
              }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TagSheet({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (tag: string) => void }) {
  const styles = useMkStyles(makeStyles);
  const c = useAppThemeColors();
  const [tag, setTag] = useState('');
  useEffect(() => { if (visible) setTag(''); }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Add tag</Text>
          <TextInput style={styles.input} value={tag} onChangeText={setTag} placeholder="e.g. favorites" placeholderTextColor={c.textTertiary} autoFocus />
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="secondary" onPress={onClose} />
            <Button title="Add" onPress={() => tag.trim() && onAdd(tag.trim())} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CollectionSheet({ visible, channelId, workspaceId: _workspaceId, onClose, onPick, onCreate }: {
  visible: boolean;
  channelId: string;
  workspaceId: string;
  onClose: () => void;
  onPick: (collectionId: string) => void;
  onCreate: (name: string) => void;
}) {
  const db = useMeerkatDatabase();
  const styles = useMkStyles(makeStyles);
  const c = useAppThemeColors();
  const [name, setName] = useState('');
  const collections = useMemo(() => (visible ? listLibraryCollections(db, channelId) : []), [visible, db, channelId]);
  useEffect(() => { if (visible) setName(''); }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Add to collection</Text>
          {collections.map((col) => (
            <Pressable key={col.id} style={styles.collectionRow} onPress={() => onPick(col.id)}>
              <Text style={styles.collectionRowText}>{col.name}</Text>
            </Pressable>
          ))}
          <Text style={styles.fieldLabel}>New collection</Text>
          <View style={styles.newCollectionRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={c.textTertiary} />
            <Button title="Create" onPress={() => name.trim() && onCreate(name.trim())} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  headerTitle: { color: c.textSecondary, fontSize: 15, fontWeight: '700', flex: 1 },
  title: { color: c.text, fontSize: 26, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  metaPill: { backgroundColor: c.surfaceHigh, borderRadius: MK_RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  metaPillText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  heldPill: { borderRadius: MK_RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth },
  heldOn: { backgroundColor: c.successSoft, borderColor: c.success },
  heldOff: { backgroundColor: c.surfaceHigh, borderColor: c.border },
  heldPillText: { fontSize: 12, fontWeight: '800' },
  heldOnText: { color: c.success },
  heldOffText: { color: c.textSecondary },
  resumeText: { color: c.textSecondary, fontSize: 12.5 },
  keepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  keepBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  keepBoxOn: { backgroundColor: c.accent, borderColor: c.accent },
  keepLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
  keepNote: { color: c.textSecondary, fontSize: 12.5, lineHeight: 18 },
  metaCard: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.md, padding: 14, gap: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  metaKey: { color: c.textTertiary, fontSize: 13, fontWeight: '700' },
  metaVal: { color: c.text, fontSize: 13.5, flex: 1, textAlign: 'right' },
  tagsCard: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.md, padding: 14, gap: 10 },
  tagsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '800' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { backgroundColor: c.surfaceHigh, borderRadius: MK_RADIUS.pill, paddingHorizontal: 12, paddingVertical: 5 },
  tagChipText: { color: c.textSecondary, fontSize: 12.5, fontWeight: '700' },
  emptyLine: { color: c.textTertiary, fontSize: 13 },
  actionsCard: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.md, overflow: 'hidden' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  actionLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  missingText: { color: c.textSecondary, fontSize: 15, textAlign: 'center' },
  viewer: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  viewerClose: { position: 'absolute', right: 16, zIndex: 2, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: MK_RADIUS.lg, borderTopRightRadius: MK_RADIUS.lg, padding: 20, gap: 10, maxHeight: '80%' },
  sheetTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  fieldLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 6 },
  input: { backgroundColor: c.surfaceHigh, borderRadius: MK_RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, color: c.text, fontSize: 15 },
  sheetActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 12 },
  collectionRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  collectionRowText: { color: c.text, fontSize: 15 },
  newCollectionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
