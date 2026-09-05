// Communities LIST (Plan 31 Phase 2). A scannable list of community cards, each
// opening to its channel list (community/[communityId]); ALL administration lives
// behind the gear on that screen. Create + Join live behind the header "+". Join
// goes through the ONE InvitePreviewSheet (preview before any join), shared with
// the deep-link and QR doors.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, Folder, Pin, Plus, X } from 'lucide-react-native';
import { listCommunities, type StoredCommunity } from '@mylife/sync';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { isChannelMuted, isCommunityMuted } from '../data/community-safety';
import { getCommunityIdentity, listCommunityChannelUnreadCounts } from '../data/community-core';
import { listCommunityPrefs, setCommunityPrefs } from '../data/db';
import { buildCommunitySections, type CommunitySection } from '../data/community-org-core';
import {
  COMMUNITY_TEMPLATES,
  TEMPLATE_PICKER_HEADING,
  findCommunityTemplate,
} from '../data/community-templates';
import { createCommunityFromTemplate } from '../data/community-template-commit';
import { Avatar } from '../components/Avatar';
import { totalUnreadCount } from '../data/community-list-core';
import { InvitePreviewSheet } from '../components/InvitePreviewSheet';
import { QrScanner, isQrScannerAvailable } from '../components/QrScanner';
import { Button, SectionHeader } from '../components/kit';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles, useThemeLibrary } from '../providers/AppThemeProvider';
import { useSync } from '../providers/SyncProvider';

export default function CommunitiesScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { recordLocalChange } = useSync();
  const { exportThemeBlob } = useThemeLibrary();

  const [communities, setCommunities] = useState<StoredCommunity[]>([]);
  const [revision, setRevision] = useState(0);
  const [sheet, setSheet] = useState<'closed' | 'menu' | 'create' | 'join'>('closed');
  const [scanning, setScanning] = useState(false);
  const [newName, setNewName] = useState('');
  const [templateId, setTemplateId] = useState('blank');
  const [useMyTheme, setUseMyTheme] = useState(false);
  // Create-failure copy rendered INSIDE the create sheet. The list-level
  // `notice` sits behind the open Modal's backdrop, so a failure routed there
  // is invisible while the user is still looking at the sheet.
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinLink, setJoinLink] = useState('');
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [folderEditor, setFolderEditor] = useState<{ communityId: string; name: string } | null>(null);
  // Cross-modal handoffs (sheet -> scanner, sheet -> invite preview, scanner ->
  // invite preview) are queued and flushed only after the dismissing Modal's
  // native teardown completes; presenting the next Modal in the same commit is
  // the iOS freeze class from PROMPT-002.
  const [pendingAction, setPendingAction] = useState<
    | { kind: 'scan' }
    | { kind: 'preview'; link: string }
    | null
  >(null);

  const flushPendingAction = useCallback(() => {
    if (!pendingAction) return;
    setPendingAction(null);
    if (pendingAction.kind === 'scan') setScanning(true);
    else setPendingInvite(pendingAction.link);
  }, [pendingAction]);
  // Modal onDismiss fires on iOS only; Android dismissal is synchronous enough
  // that flushing right after the hide commit is safe.
  useEffect(() => {
    if (Platform.OS === 'ios') return;
    if (sheet === 'closed' && !scanning) flushPendingAction();
  }, [sheet, scanning, flushPendingAction]);

  const refresh = useCallback(() => setCommunities(listCommunities(db)), [db]);
  useEffect(() => { refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { void revision; refresh(); }, [refresh, revision]));

  const unreadByCommunity = useMemo(() => {
    void revision;
    const counts: Record<string, number> = {};
    for (const community of communities) {
      const mutedChannelIds = new Set(
        community.descriptor.channels
          .filter((ch) => isChannelMuted(db, community.communityId, ch.id))
          .map((ch) => ch.id),
      );
      counts[community.communityId] = totalUnreadCount(
        listCommunityChannelUnreadCounts(db, community.communityId),
        mutedChannelIds,
      );
    }
    return counts;
  }, [db, communities, revision]);

  // Per-device organization (Plan 38 Phase 2, G4). mk_community_prefs never
  // replicates, so this arrangement is this device's private view of the list.
  const prefsById = useMemo(() => {
    void communities;
    void revision;
    return listCommunityPrefs(db);
  }, [db, communities, revision]);
  const sections = useMemo(
    () => buildCommunitySections(communities, prefsById),
    [communities, prefsById],
  );
  const knownFolders = useMemo(
    () => Array.from(new Set(Object.values(prefsById).map((p) => p.folder).filter((f): f is string => Boolean(f)))).sort((a, b) => a.localeCompare(b)),
    [prefsById],
  );

  const openCommunity = useCallback((communityId: string) => {
    router.push({ pathname: '/community/[communityId]', params: { communityId } });
  }, [router]);

  const togglePin = useCallback((communityId: string, pinned: boolean) => {
    setCommunityPrefs(db, communityId, { pinned: !pinned });
    setRevision((v) => v + 1);
  }, [db]);

  // Reorder within a section: swap with the neighbor, then renumber the section's
  // sort_index 0..n so the new order is durable (buildCommunitySections sorts on it).
  const reorder = useCallback((section: CommunitySection, communityId: string, dir: 'up' | 'down') => {
    const list = section.communities;
    const index = list.findIndex((c) => c.communityId === communityId);
    const target = dir === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    next.forEach((community, i) => setCommunityPrefs(db, community.communityId, { sortIndex: i }));
    setRevision((v) => v + 1);
  }, [db]);

  const saveFolder = useCallback(() => {
    if (!folderEditor) return;
    const folder = folderEditor.name.trim();
    setCommunityPrefs(db, folderEditor.communityId, { folder: folder || null });
    setFolderEditor(null);
    setRevision((v) => v + 1);
  }, [db, folderEditor]);

  const closeSheet = useCallback(() => {
    setSheet('closed');
    setNewName('');
    setTemplateId('blank');
    setUseMyTheme(false);
    setJoinLink('');
    setCreateError(null);
  }, []);

  const onCreate = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    const template = findCommunityTemplate(templateId);
    if (!template) return;
    try {
      createCommunityFromTemplate(
        db,
        identity,
        { name, template, adoptThemeBlob: useMyTheme ? exportThemeBlob() : null },
        recordLocalChange,
      );
      closeSheet();
      setNotice(`Created "${name}". You are the owner; open it and share an invite to add members.`);
      setRevision((v) => v + 1);
    } catch (err) {
      setCreateError(err instanceof Error && err.message ? err.message : 'Could not create that community.');
    }
  }, [db, identity, newName, templateId, useMyTheme, exportThemeBlob, recordLocalChange, closeSheet]);

  const onSubmitJoinLink = useCallback(() => {
    const link = joinLink.trim();
    if (!link) return;
    setSheet('closed');
    setJoinLink('');
    setPendingAction({ kind: 'preview', link });
  }, [joinLink]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Communities</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create or join a community"
          onPress={() => setSheet('menu')}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
        >
          <Plus size={22} color={c.onAccent} strokeWidth={2.2} />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>Private spaces for channels and files</Text>

      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

      {communities.length === 0 ? (
        <View style={styles.panel}>
          <Text style={styles.emptyTitle}>No communities yet</Text>
          <Text style={styles.emptyText}>Tap the plus to create one or join with an invite.</Text>
        </View>
      ) : (
        sections.map((section) => {
          const collapsed = section.kind === 'folder' && collapsedFolders[section.key];
          return (
            <View key={section.key} style={styles.section}>
              {section.kind === 'pinned' ? (
                <Text style={styles.sectionLabel}>Pinned</Text>
              ) : section.kind === 'folder' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={collapsed ? `Show folder ${section.folder}` : `Hide folder ${section.folder}`}
                  onPress={() => setCollapsedFolders((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                  style={({ pressed }) => [styles.folderHeader, pressed && styles.pressed]}
                >
                  <Folder size={14} color={c.textSecondary} strokeWidth={2} />
                  <Text style={styles.sectionLabel}>{section.folder}</Text>
                  {collapsed ? <ChevronDown size={16} color={c.textTertiary} strokeWidth={2} /> : <ChevronUp size={16} color={c.textTertiary} strokeWidth={2} />}
                </Pressable>
              ) : null}
              {collapsed ? null : section.communities.map((community, index) => (
                <CommunityCard
                  key={community.communityId}
                  community={community}
                  unread={unreadByCommunity[community.communityId] ?? 0}
                  muted={isCommunityMuted(db, community.communityId)}
                  ident={getCommunityIdentity(db, community.communityId)}
                  pinned={prefsById[community.communityId]?.pinned ?? false}
                  upDisabled={index === 0}
                  downDisabled={index === section.communities.length - 1}
                  onOpen={() => openCommunity(community.communityId)}
                  onTogglePin={() => togglePin(community.communityId, prefsById[community.communityId]?.pinned ?? false)}
                  onUp={() => reorder(section, community.communityId, 'up')}
                  onDown={() => reorder(section, community.communityId, 'down')}
                  onFolder={() => setFolderEditor({ communityId: community.communityId, name: prefsById[community.communityId]?.folder ?? '' })}
                  styles={styles}
                  colors={c}
                />
              ))}
            </View>
          );
        })
      )}
      {communities.length > 0 ? (
        <Text style={styles.perDeviceNote}>Only on this device</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="What works today"
        onPress={() => router.push('/about-status')}
        style={({ pressed }) => [styles.statusLink, pressed && styles.pressed]}
      >
        <Text style={styles.statusLinkText}>See what works today</Text>
      </Pressable>

      <View style={{ height: insets.bottom + 96 }} />

      {/* Create / Join menu */}
      <Modal visible={sheet !== 'closed'} transparent animationType="slide" onRequestClose={closeSheet} onDismiss={flushPendingAction}>
        <Pressable style={styles.backdrop} onPress={closeSheet} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {sheet === 'create' ? 'Create a community' : sheet === 'join' ? 'Join with an invite' : 'New community'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={closeSheet}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <X size={20} color={c.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>

          {sheet === 'menu' ? (
            <>
              <Button title="Create a community" onPress={() => setSheet('create')} />
              <Button title="Join with an invite" variant="secondary" onPress={() => setSheet('join')} />
            </>
          ) : null}

          {sheet === 'create' ? (
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.createScroll}>
              <SectionHeader title="Create a community" hint="You become the owner and can invite people." />
              <TextInput
                style={styles.fieldInput}
                value={newName}
                onChangeText={(v) => { setNewName(v); setCreateError(null); }}
                placeholder="Community name"
                placeholderTextColor={c.textTertiary}
                accessibilityLabel="New community name"
              />

              <Text style={styles.templateHeading}>{TEMPLATE_PICKER_HEADING}</Text>
              <View style={styles.templateGrid}>
                {COMMUNITY_TEMPLATES.map((template) => {
                  const active = template.id === templateId;
                  return (
                    <Pressable
                      key={template.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Template ${template.name}`}
                      onPress={() => setTemplateId(template.id)}
                      style={({ pressed }) => [styles.templateCard, active && styles.templateCardActive, pressed && styles.pressed]}
                    >
                      <Text style={[styles.templateName, active && styles.templateNameActive]}>{template.name}</Text>
                      <Text style={styles.templateBlurb} numberOfLines={2}>{template.blurb}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: useMyTheme }}
                accessibilityLabel="Use my current theme"
                onPress={() => setUseMyTheme((v) => !v)}
                style={({ pressed }) => [styles.adoptRow, pressed && styles.pressed]}
              >
                <View style={[styles.adoptCheck, useMyTheme && styles.adoptCheckOn]}>
                  {useMyTheme ? <Text style={styles.adoptCheckMark}>✓</Text> : null}
                </View>
                <Text style={styles.adoptLabel}>Use my current theme</Text>
              </Pressable>

              {createError ? <Text style={styles.createErrorText}>{createError}</Text> : null}
              <Button title="Create community" onPress={onCreate} disabled={newName.trim().length === 0} />
            </ScrollView>
          ) : null}

          {sheet === 'join' ? (
            <>
              <SectionHeader title="Join with an invite" hint="Scan a QR or paste an invite link. You preview before joining." />
              {isQrScannerAvailable() ? (
                <Button title="Scan an invite QR" variant="secondary" onPress={() => { setSheet('closed'); setPendingAction({ kind: 'scan' }); }} />
              ) : null}
              <TextInput
                style={styles.linkInput}
                multiline
                value={joinLink}
                onChangeText={setJoinLink}
                placeholder="meerkat://community/join#..."
                placeholderTextColor={c.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Community invite link"
              />
              <Button title="Preview invite" onPress={onSubmitJoinLink} disabled={joinLink.trim().length === 0} />
            </>
          ) : null}
        </View>
      </Modal>

      {/* Kept mounted (visible toggles) so onDismiss can flush the queued
          scan -> preview handoff; unmounting a visible Modal is the same
          freeze class as presenting during dismissal. */}
      <Modal visible={scanning} transparent={false} animationType="slide" onRequestClose={() => setScanning(false)} onDismiss={flushPendingAction}>
        <View style={styles.scannerFill}>
          {scanning ? (
            <QrScanner
              permissionRationale="Meerkat needs the camera only to scan a community invite. Nothing is photographed or stored."
              scanHint="Point the camera at a community invite QR."
              onScan={(value) => { setScanning(false); setPendingAction({ kind: 'preview', link: value.trim() }); }}
              onCancel={() => setScanning(false)}
            />
          ) : null}
        </View>
      </Modal>

      <InvitePreviewSheet
        link={pendingInvite}
        visible={pendingInvite !== null}
        onClose={() => setPendingInvite(null)}
        onJoined={(result) => { setNotice(result.notice); setRevision((v) => v + 1); }}
      />

      {/* Folder editor (per-device) */}
      <Modal visible={folderEditor !== null} transparent animationType="slide" onRequestClose={() => setFolderEditor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setFolderEditor(null)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Move to a folder</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => setFolderEditor(null)}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <X size={20} color={c.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
          <Text style={styles.perDeviceNote}>Only on this device</Text>
          {knownFolders.length > 0 ? (
            <View style={styles.folderChipRow}>
              {knownFolders.map((folder) => (
                <Pressable
                  key={folder}
                  accessibilityRole="button"
                  accessibilityLabel={`Use folder ${folder}`}
                  onPress={() => setFolderEditor((prev) => (prev ? { ...prev, name: folder } : prev))}
                  style={({ pressed }) => [styles.folderChip, folderEditor?.name === folder && styles.folderChipActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.folderChipText, folderEditor?.name === folder && styles.folderChipTextActive]}>{folder}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextInput
            style={styles.fieldInput}
            value={folderEditor?.name ?? ''}
            onChangeText={(v) => setFolderEditor((prev) => (prev ? { ...prev, name: v } : prev))}
            placeholder="Folder name"
            placeholderTextColor={c.textTertiary}
            accessibilityLabel="Folder name"
          />
          <Button title="Save folder" onPress={saveFolder} />
          {folderEditor?.name.trim() ? (
            <Button title="Remove from folder" variant="ghost" onPress={() => setFolderEditor((prev) => (prev ? { ...prev, name: '' } : prev))} />
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

function CommunityCard({
  community,
  unread,
  muted,
  ident,
  pinned,
  upDisabled,
  downDisabled,
  onOpen,
  onTogglePin,
  onUp,
  onDown,
  onFolder,
  styles,
  colors,
}: {
  community: StoredCommunity;
  unread: number;
  muted: boolean;
  ident: { iconImage?: string | null; description?: string | null; accentColor?: string | null } | null;
  pinned: boolean;
  upDisabled: boolean;
  downDisabled: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  onUp: () => void;
  onDown: () => void;
  onFolder: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: MkColors;
}) {
  const d = community.descriptor;
  const initial = Array.from(d.name.trim())[0]?.toUpperCase() ?? '?';
  const accent = ident?.accentColor ?? null;
  return (
    <View style={[styles.card, muted && styles.mutedCard]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${d.name}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
      >
        <Avatar imageBase64={ident?.iconImage} initial={initial} size={44} />
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>{d.name}</Text>
          {ident?.description ? (
            <Text style={styles.cardDescription} numberOfLines={1}>{ident.description}</Text>
          ) : null}
          <Text style={styles.cardMeta} numberOfLines={1}>
            {d.members.length} member{d.members.length === 1 ? '' : 's'} · {d.channels.length} channel{d.channels.length === 1 ? '' : 's'}
            {muted ? ' · muted' : ''}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.roleChip, accent ? { color: accent } : null]}>{community.myRole ?? 'pending'}</Text>
          {unread > 0 && !muted ? (
            <Text style={[styles.unreadBadge, accent ? { backgroundColor: accent } : null]}>{unread > 99 ? '99+' : unread}</Text>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.cardActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pinned ? `Unpin ${d.name}` : `Pin ${d.name}`}
          onPress={onTogglePin}
          style={({ pressed }) => [styles.cardActionBtn, pinned && styles.cardActionActive, pressed && styles.pressed]}
        >
          <Pin size={16} color={pinned ? colors.accent : colors.textSecondary} strokeWidth={2} fill={pinned ? colors.accent : 'none'} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Move ${d.name} up`}
          disabled={upDisabled}
          onPress={onUp}
          style={({ pressed }) => [styles.cardActionBtn, (upDisabled || pressed) && styles.pressed]}
        >
          <ChevronUp size={16} color={colors.textSecondary} strokeWidth={2} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Move ${d.name} down`}
          disabled={downDisabled}
          onPress={onDown}
          style={({ pressed }) => [styles.cardActionBtn, (downDisabled || pressed) && styles.pressed]}
        >
          <ChevronDown size={16} color={colors.textSecondary} strokeWidth={2} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Move ${d.name} to a folder`}
          onPress={onFolder}
          style={({ pressed }) => [styles.cardActionBtn, pressed && styles.pressed]}
        >
          <Folder size={16} color={colors.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent },
  subtitle: { color: c.textSecondary, fontSize: 14, marginTop: -6 },
  noticeText: { color: c.accent, fontSize: 13 },
  createErrorText: { color: c.danger, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.glassBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 8,
  },
  emptyTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
  emptyText: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  section: { gap: 10 },
  sectionLabel: { flex: 1, color: c.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  folderHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perDeviceNote: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
  card: {
    backgroundColor: c.surface,
    borderColor: c.glassBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 12,
    gap: 8,
  },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.glassBorder,
    paddingTop: 8,
  },
  cardActionBtn: {
    width: 34,
    height: 34,
    borderRadius: MK_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    backgroundColor: c.surfaceElevated,
  },
  cardActionActive: { borderColor: c.accent, backgroundColor: c.glass },
  folderChipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  folderChip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: MK_RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    backgroundColor: c.surfaceElevated,
  },
  folderChipActive: { borderColor: c.accent, backgroundColor: c.glass },
  folderChipText: { color: c.textSecondary, fontSize: 12, fontWeight: '800' },
  folderChipTextActive: { color: c.accent },
  mutedCard: { opacity: 0.62 },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardName: { color: c.text, fontSize: 16, fontWeight: '800' },
  cardDescription: { color: c.textSecondary, fontSize: 12.5 },
  cardMeta: { color: c.textTertiary, fontSize: 12 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  roleChip: { color: c.accent, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  unreadBadge: {
    minWidth: 24,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    overflow: 'hidden',
    backgroundColor: c.accent,
    color: c.onAccent,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  createScroll: { flexGrow: 0 },
  templateHeading: { color: c.text, fontSize: 13, fontWeight: '800', marginTop: 6 },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  templateCard: {
    width: '47%',
    flexGrow: 1,
    borderRadius: MK_RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    backgroundColor: c.surfaceElevated,
    padding: 10,
    gap: 4,
  },
  templateCardActive: { borderColor: c.accent, backgroundColor: c.glass },
  templateName: { color: c.text, fontSize: 13.5, fontWeight: '800' },
  templateNameActive: { color: c.accent },
  templateBlurb: { color: c.textTertiary, fontSize: 11.5, lineHeight: 16 },
  adoptRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 4 },
  adoptCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: c.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceElevated,
  },
  adoptCheckOn: { backgroundColor: c.accent, borderColor: c.accent },
  adoptCheckMark: { color: c.onAccent, fontSize: 13, fontWeight: '800' },
  adoptLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceHigh },
  fieldInput: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  linkInput: {
    minHeight: 64,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    padding: 12,
    fontSize: 12,
    textAlignVertical: 'top',
  },
  scannerFill: { flex: 1, backgroundColor: '#000000' },
  statusLink: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  statusLinkText: { color: c.accent, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
