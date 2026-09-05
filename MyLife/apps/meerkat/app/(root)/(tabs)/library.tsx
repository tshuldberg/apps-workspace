// Plan 38 Phase 5 + amendment B.5/F (MOBILE): the personal "My Library" hub. This
// is the FIRST shippable library milestone: a solo user with ZERO communities can
// create libraries and browse them here. Everything is REAL local rows -- per
// library counts, On Deck from cm_library_progress, Recently added from item
// HLCs. No transport dependency; the personal workspace is the boundary.

import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Library as LibraryIcon, Plus } from 'lucide-react-native';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { useSync } from '../providers/SyncProvider';
import { Button, HonestNotice } from '../components/kit';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { createLibrary } from '../data/library-store-core';
import {
  getPersonalWorkspaceId,
  listAllWorkspaceItems,
  listLibrarySummaries,
  progressByItem,
  setPersonalLibraryName,
  type LibrarySummary,
} from '../data/library-hub-core';
import { LIBRARY_MEDIA_TYPES } from '../data/library-data-core';
import type { KnownMediaType } from '../data/library-metadata-core';
import {
  buildOnDeck,
  buildRecentlyAdded,
  LIBRARY_STRINGS,
  type OnDeckEntry,
} from '../data/library-view-core';
import type { ResolvedLibraryItem } from '../data/library-data-core';

const MEDIA_LABEL: Record<KnownMediaType, string> = {
  movie: 'Movies',
  show: 'Shows',
  music: 'Music',
  photo: 'Photos',
  book: 'Books',
  document: 'Documents',
  custom: 'Custom',
};

export default function MyLibraryScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { recordLocalChange } = useSync();

  const [summaries, setSummaries] = useState<LibrarySummary[]>([]);
  const [onDeck, setOnDeck] = useState<OnDeckEntry[]>([]);
  const [recent, setRecent] = useState<ResolvedLibraryItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const workspaceId = useMemo(() => getPersonalWorkspaceId(db, identity.publicKey), [db, identity.publicKey]);

  const reload = useCallback(() => {
    if (!workspaceId) return;
    setSummaries(listLibrarySummaries(db, workspaceId));
    const items = listAllWorkspaceItems(db, workspaceId);
    const progress = progressByItem(db);
    setOnDeck(buildOnDeck(items, progress));
    setRecent(buildRecentlyAdded(items));
  }, [db, workspaceId]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const create = useCallback((name: string, mediaType: KnownMediaType) => {
    if (!workspaceId) return;
    try {
      const config = createLibrary(db, identity, { workspaceId, name, mediaType }, { recordChange: recordLocalChange });
      // Personal libraries carry no name in the signed config; keep the device-local label.
      setPersonalLibraryName(db, config.channelId, name);
      setCreateOpen(false);
      reload();
      router.push(`/library/${config.channelId}`);
    } catch (err) {
      Alert.alert('Could not create library', err instanceof Error ? err.message : String(err));
    }
  }, [db, identity, workspaceId, recordLocalChange, reload, router]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/me'); }}
            hitSlop={10}
            accessibilityLabel="Back"
          >
            <ArrowLeft size={24} color={c.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{LIBRARY_STRINGS.myLibrary}</Text>
          <Pressable onPress={() => setCreateOpen(true)} hitSlop={10} accessibilityLabel={LIBRARY_STRINGS.newLibrary}>
            <Plus size={24} color={c.accent} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Your own media, sealed on this device.</Text>

        {summaries.length === 0 ? (
          <View style={styles.emptyCard}>
            <LibraryIcon size={30} color={c.accent} strokeWidth={1.6} />
            <Text style={styles.emptyTitle}>No libraries yet</Text>
            <Text style={styles.emptyBody}>
              Create a library for your movies, music, books, or photos. Add files from this
              device and browse them here. Nothing leaves your device until you choose to sync.
            </Text>
            <Button title={LIBRARY_STRINGS.newLibrary} onPress={() => setCreateOpen(true)} />
          </View>
        ) : (
          <>
            {onDeck.length > 0 ? (
              <Section title={LIBRARY_STRINGS.onDeck}>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={onDeck}
                  keyExtractor={(e) => e.item.event.id}
                  contentContainerStyle={styles.rowScroll}
                  renderItem={({ item: entry }) => (
                    <Pressable style={styles.deckCard} onPress={() => router.push(`/library/item/${entry.item.event.id}`)}>
                      <Text style={styles.deckTitle} numberOfLines={2}>{entry.item.event.title}</Text>
                      {entry.durationMs ? (
                        <Text style={styles.deckSub}>
                          {Math.round(entry.positionMs / 60000)} / {Math.round(entry.durationMs / 60000)} min
                        </Text>
                      ) : (
                        <Text style={styles.deckSub}>Resume</Text>
                      )}
                    </Pressable>
                  )}
                />
              </Section>
            ) : null}

            {recent.length > 0 ? (
              <Section title={LIBRARY_STRINGS.recentlyAdded}>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={recent}
                  keyExtractor={(i) => i.event.id}
                  contentContainerStyle={styles.rowScroll}
                  renderItem={({ item }) => (
                    <Pressable style={styles.recentCard} onPress={() => router.push(`/library/item/${item.event.id}`)}>
                      <Text style={styles.recentTitle} numberOfLines={2}>{item.event.title}</Text>
                    </Pressable>
                  )}
                />
              </Section>
            ) : null}

            <Section title="Libraries">
              <View style={styles.libCard}>
                {summaries.map((summary, i) => (
                  <Pressable
                    key={summary.config.id}
                    style={[styles.libRow, i < summaries.length - 1 && styles.libRowDivider]}
                    onPress={() => router.push(`/library/${summary.config.channelId}`)}
                  >
                    <View style={styles.libIcon}><LibraryIcon size={18} color={c.accent} strokeWidth={1.9} /></View>
                    <View style={styles.libText}>
                      <Text style={styles.libName} numberOfLines={1}>{summary.name}</Text>
                      <Text style={styles.libMeta}>
                        {MEDIA_LABEL[summary.config.mediaType as KnownMediaType] ?? summary.config.mediaType}
                        {' · '}{summary.itemCount} {summary.itemCount === 1 ? 'item' : 'items'}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={c.textTertiary} />
                  </Pressable>
                ))}
              </View>
            </Section>
          </>
        )}

        <HonestNotice text="On Deck and Recently added are built only from items and resume positions this device has actually recorded. Nothing here implies a file is available anywhere else." />
        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>

      <CreateLibrarySheet visible={createOpen} onClose={() => setCreateOpen(false)} onCreate={create} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function CreateLibrarySheet({ visible, onClose, onCreate }: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, mediaType: KnownMediaType) => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const [name, setName] = useState('');
  const [mediaType, setMediaType] = useState<KnownMediaType>('movie');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>{LIBRARY_STRINGS.newLibrary}</Text>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Movies"
            placeholderTextColor={c.textTertiary}
            autoFocus
          />
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeWrap}>
            {LIBRARY_MEDIA_TYPES.map((type) => (
              <Pressable
                key={type}
                onPress={() => setMediaType(type)}
                style={[styles.typeChip, mediaType === type && styles.typeChipOn]}
              >
                <Text style={[styles.typeChipText, mediaType === type && styles.typeChipTextOn]}>
                  {MEDIA_LABEL[type]}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="secondary" onPress={onClose} />
            <Button title="Create" onPress={() => onCreate(name.trim() || MEDIA_LABEL[mediaType], mediaType)} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { color: c.text, fontSize: 26, fontWeight: '800', flex: 1 },
  subtitle: { color: c.textSecondary, fontSize: 14, marginBottom: 6 },
  emptyCard: {
    backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg, padding: 24, alignItems: 'center', gap: 12, marginTop: 8,
  },
  emptyTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  emptyBody: { color: c.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  section: { gap: 10, marginTop: 14 },
  sectionTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
  rowScroll: { gap: 10, paddingRight: 8 },
  deckCard: {
    width: 150, backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md, padding: 12, gap: 6, justifyContent: 'space-between', minHeight: 84,
  },
  deckTitle: { color: c.text, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  deckSub: { color: c.accent, fontSize: 12, fontWeight: '700' },
  recentCard: {
    width: 120, height: 84, backgroundColor: c.surfaceHigh, borderRadius: MK_RADIUS.md,
    padding: 12, justifyContent: 'flex-end',
  },
  recentTitle: { color: c.text, fontSize: 13, fontWeight: '700', lineHeight: 17 },
  libCard: { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: MK_RADIUS.md, overflow: 'hidden' },
  libRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  libRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  libIcon: { width: 38, height: 38, borderRadius: MK_RADIUS.sm, backgroundColor: c.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  libText: { flex: 1, minWidth: 0, gap: 2 },
  libName: { color: c.text, fontSize: 15, fontWeight: '700' },
  libMeta: { color: c.textSecondary, fontSize: 12.5 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: MK_RADIUS.lg, borderTopRightRadius: MK_RADIUS.lg, padding: 20, gap: 10 },
  sheetTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  fieldLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 6 },
  input: { backgroundColor: c.surfaceHigh, borderRadius: MK_RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, color: c.text, fontSize: 15 },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { backgroundColor: c.surfaceHigh, borderRadius: MK_RADIUS.pill, paddingHorizontal: 14, paddingVertical: 7 },
  typeChipOn: { backgroundColor: c.accent },
  typeChipText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  typeChipTextOn: { color: c.onAccent },
  sheetActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 12 },
});
