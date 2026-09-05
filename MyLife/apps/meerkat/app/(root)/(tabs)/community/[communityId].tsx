import { HonestNotice } from '../../components/kit';
import { useSyncExternalStore } from 'react';
import { deviceHomeLayout, subscribeDeviceLayout, deviceLayoutRevision } from '../../data/device-layout-core';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image as RNImage, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, FolderOpen, Library as LibraryIcon, Settings, Users } from 'lucide-react-native';
import { communityLayout, getCommunity, type StoredCommunity } from '@mylife/sync';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import {
  isChannelMuted,
  isCommunityMuted,
  setChannelMuted,
} from '../../data/community-safety';
import { getCommunityIdentity, listCommunityChannelUnreadCounts, listCommunityLayoutEvents } from '../../data/community-core';
import { resolveActiveLayout } from '../../data/community-layout-core';
import { buildBlockQueries } from '../../data/block-queries';
import { BlockStack } from '../../components/blocks/BlockStack';
import type { BlockHostContext } from '../../components/blocks/registry';
import { groupChannelsForDisplay, groupUnreadCount } from '../../data/community-org-core';
import { isReservedCommunityId } from '../../data/join-flow';
import {
  listAllWorkspaceItems,
  listLibrarySummaries,
  progressByItem,
  type LibrarySummary,
} from '../../data/library-hub-core';
import { buildOnDeck, buildRecentlyAdded, LIBRARY_STRINGS, type OnDeckEntry } from '../../data/library-view-core';
import type { KnownMediaType } from '../../data/library-metadata-core';
import type { ResolvedLibraryItem } from '../../data/library-data-core';
import { ChannelSegmentedTabs } from '../../components/chat/ChannelSegmentedTabs';
import { Avatar } from '../../components/Avatar';
import { type MkColors, MK_RADIUS } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles, useThemeLibrary } from '../../providers/AppThemeProvider';
import { CommunityThemeProvider, useCommunityTheme } from '../../providers/CommunityThemeProvider';
import { useNode } from '../../providers/NodeProvider';
import { type ActiveThemeSource } from '../../data/community-theme-core';

const MEDIA_LABEL: Record<KnownMediaType, string> = {
  movie: 'Movies',
  show: 'Shows',
  music: 'Music',
  photo: 'Photos',
  book: 'Books',
  document: 'Documents',
  custom: 'Custom',
};

/**
 * The honest source label the community screen shows (from resolveActiveTheme's
 * tag). Only the three canonical values render, parity-locked across surfaces: a
 * community-supplied look (full theme OR accent-only) reads 'Community theme'.
 */
function themeSourceLabel(source: ActiveThemeSource): string {
  switch (source) {
    case 'high_contrast':
      return 'High contrast';
    case 'community_theme':
    case 'community_accent':
      return 'Community theme';
    case 'mine':
    case 'base':
      return 'Your theme';
  }
}

// The route wraps the screen in the per-community theme boundary, so every screen
// under it themes to the community while the tab bar and other tabs stay base.
export default function CommunityRoute() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const id = typeof communityId === 'string' ? communityId : '';
  return (
    <CommunityThemeProvider communityId={id}>
      <CommunityScreen communityId={id} />
    </CommunityThemeProvider>
  );
}

function CommunityScreen({ communityId: id }: { communityId: string }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  useSyncExternalStore(subscribeDeviceLayout, deviceLayoutRevision, deviceLayoutRevision);
  const node = useNode();
  const communityTheme = useCommunityTheme();
  const { importThemeBlob } = useThemeLibrary();

  const [revision, setRevision] = useState(0);
  const [themeNotice, setThemeNotice] = useState<string | null>(null);
  const [community, setCommunity] = useState<StoredCommunity | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // Plan 38 Phase 7 (G10): a library_first community opens on its Libraries home.
  const [segment, setSegment] = useState<'library' | 'chat'>('library');

  const load = useCallback(() => {
    if (!id || isReservedCommunityId(id)) {
      setCommunity(null);
      return;
    }
    setCommunity(getCommunity(db, id));
  }, [db, id]);

  useFocusEffect(useCallback(() => { void revision; load(); }, [load, revision]));

  // Load the verified banner image on focus. Null (no verified banner, not a
  // member, or blocks not local yet) renders NOTHING extra: no spinner, no frame.
  useFocusEffect(useCallback(() => {
    void revision;
    let cancelled = false;
    if (!id || isReservedCommunityId(id)) { setBannerUri(null); return; }
    node.resolveCommunityBannerImage(id)
      .then((uri) => { if (!cancelled) setBannerUri(uri); })
      // A thrown store read fails safe to no banner (never an unhandled rejection).
      .catch(() => { if (!cancelled) setBannerUri(null); });
    return () => { cancelled = true; };
  }, [node, id, revision]));

  const identity = useMemo(
    () => {
      void revision;
      return id && !isReservedCommunityId(id) ? getCommunityIdentity(db, id) : null;
    },
    [db, id, revision],
  );

  const unread = useMemo(
    () => {
      void revision;
      return community ? listCommunityChannelUnreadCounts(db, community.communityId) : {};
    },
    [db, community, revision],
  );

  // Category groups + archived split from the SIGNED descriptor (Plan 38 Phase 2).
  // A legacy descriptor (no categories/order) collapses to one header-less group,
  // so it renders exactly as before.
  const display = useMemo(
    () => (community ? groupChannelsForDisplay(community.descriptor) : null),
    [community],
  );

  // Muted channels are excluded from the per-category rollup, matching the
  // per-channel view that hides its own badge when muted.
  const mutedChannelIds = useMemo(() => {
    void revision;
    const ids = new Set<string>();
    if (!community) return ids;
    for (const channel of community.descriptor.channels) {
      if (isChannelMuted(db, community.communityId, channel.id)) ids.add(channel.id);
    }
    return ids;
  }, [db, community, revision]);

  const openChannel = useCallback((channelId: string) => {
    if (!community) return;
    router.push({
      pathname: '/channel/[communityId]/[channelId]',
      params: { communityId: community.communityId, channelId },
    });
  }, [router, community]);

  const openFiles = useCallback(() => {
    if (!community) return;
    router.push({ pathname: '/files/[communityId]', params: { communityId: community.communityId } });
  }, [router, community]);

  const openSettings = useCallback(() => {
    if (!community) return;
    router.push({
      pathname: '/community/[communityId]/settings',
      params: { communityId: community.communityId },
    });
  }, [router, community]);

  // This screen is deep-linkable (invite joins, notifications), so it can be
  // the stack's only route; Back then falls back to the Communities list.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/communities');
  }, [router]);

  // Composition Phase 1: the owner-signed layout document, resolved fail-safe.
  // Legacy (no verified document) renders the surfaces exactly as before.
  const activeLayout = useMemo(() => {
    void revision;
    if (!community) return null;
    return resolveActiveLayout({
      events: listCommunityLayoutEvents(db, community.communityId),
      ownerDeviceId: community.descriptor.ownerDeviceId,
      legacyLayout: communityLayout(community.descriptor),
    });
  }, [db, community, revision]);

  const blockCtx = useMemo<BlockHostContext | null>(() => {
    if (!community) return null;
    return {
      communityId: community.communityId,
      communityName: community.descriptor.name,
      channels: community.descriptor.channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        kind: channel.kind ?? 'chat',
      })),
      queries: buildBlockQueries(db, community.descriptor),
      onOpenChannel: openChannel,
      onOpenFiles: openFiles,
      revision,
    };
  }, [db, community, openChannel, openFiles, revision]);

  const toggleChannelMute = useCallback((channelId: string, channelName: string, muted: boolean) => {
    if (!community) return;
    setChannelMuted(db, community.communityId, channelId, muted, `#${channelName}`);
    setRevision((v) => v + 1);
  }, [db, community]);

  // Plan 38 Phase 7 (C.4): a member adopts the community theme as their OWN
  // personal theme through the SAME Plan 18 codec path. Explicit, device-local.
  const adoptTheme = useCallback(() => {
    const blob = identity?.themeBlob;
    if (!blob) return;
    const result = importThemeBlob(blob);
    setThemeNotice(
      result.success
        ? 'Added to your themes. Choose it in Appearance to use it everywhere.'
        : result.error ?? 'Could not adopt this theme.',
    );
  }, [identity, importThemeBlob]);

  if (!community) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Header title="Community" onBack={goBack} onSettings={null} insetsTop={0} />
        <Text style={styles.emptyTitle}>Community not found</Text>
        <Text style={styles.emptyText}>This community is not on this device.</Text>
      </View>
    );
  }

  const d = community.descriptor;
  const muted = isCommunityMuted(db, community.communityId);
  const layout = communityLayout(d);
  // A verified layout document composes the home; the legacy segment surfaces
  // apply only in legacy mode. The channels panel + settings render in BOTH
  // modes (composition 2.4 non-removable floors).
  const localHome = deviceHomeLayout(db, 'mobile', d.name, d.channels.find((channel) => !channel.kind || channel.kind === 'chat')?.id, activeLayout?.source === 'layout_document' ? activeLayout.document.capabilities : []);
  const composedHome = localHome ?? (activeLayout?.source === 'layout_document' ? activeLayout.document : null);
  const librariesVisible = !composedHome && layout === 'library_first' && segment === 'library';
  const chatVisible = composedHome !== null || layout === 'chat_first' || segment === 'chat';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
    >
      {bannerUri ? (
        <RNImage source={{ uri: bannerUri }} style={styles.banner} accessibilityIgnoresInvertColors />
      ) : null}
      <Header title={d.name} onBack={goBack} onSettings={openSettings} insetsTop={0} />
      <View style={styles.identityRow}>
        <Avatar imageBase64={identity?.iconImage} initial={Array.from(d.name.trim())[0]?.toUpperCase() ?? '?'} size={36} />
        <View style={styles.identityCopy}>
          <Text style={styles.subtitle}>
            {d.members.length} member{d.members.length === 1 ? '' : 's'} · {d.channels.length} channel{d.channels.length === 1 ? '' : 's'}
            {muted ? ' · muted' : ''}
          </Text>
          {identity?.description ? (
            <Text style={styles.description} numberOfLines={3}>{identity.description}</Text>
          ) : null}
        </View>
      </View>

      {communityTheme ? (
        <View style={styles.themeRow}>
          <Text style={styles.themeSource}>Theme: {themeSourceLabel(communityTheme.source)}</Text>
          {communityTheme.hasCommunityTheme && !communityTheme.highContrast ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={communityTheme.memberMode === 'community' ? 'Use my theme' : 'Use community theme'}
              onPress={() => communityTheme.setMemberMode(communityTheme.memberMode === 'community' ? 'mine' : 'community')}
              style={({ pressed }) => [styles.themeToggle, pressed && styles.pressed]}
            >
              <Text style={styles.themeToggleText}>
                {communityTheme.memberMode === 'community' ? 'Use my theme' : 'Use community theme'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {identity?.themeBlob ? (
        <View style={styles.adoptRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Adopt this theme"
            onPress={adoptTheme}
            style={({ pressed }) => [styles.themeToggle, pressed && styles.pressed]}
          >
            <Text style={styles.themeToggleText}>Adopt this theme</Text>
          </Pressable>
          {themeNotice ? <Text style={styles.adoptNotice}>{themeNotice}</Text> : null}
        </View>
      ) : null}

      {localHome ? <HonestNotice text="Using your device default. Change it in Settings, or choose Use community layout to follow the owner." /> : null}
      {composedHome && blockCtx ? (
        <BlockStack
          nodes={composedHome.home}
          declaredCapabilities={composedHome.capabilities}
          ctx={blockCtx}
        />
      ) : null}

      {!composedHome && layout === 'library_first' ? (
        <ChannelSegmentedTabs
          value={segment === 'library' ? 'chat' : 'posts'}
          onChange={(v) => setSegment(v === 'chat' ? 'library' : 'chat')}
          chatLabel="Libraries"
          postsLabel="Chat"
        />
      ) : null}

      {librariesVisible ? (
        <CommunityLibrariesHome
          communityId={community.communityId}
          revision={revision}
          styles={styles}
          colors={c}
          onOpenLibrary={openChannel}
        />
      ) : null}

      {/* Plan 56 C1 (4.4): the Pages directory entry, a host surface every
          community always exposes (a layout document cannot hide it). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open community pages"
        onPress={() => router.push({ pathname: '/community/[communityId]/pages', params: { communityId: community.communityId } })}
        style={({ pressed }) => [styles.pagesRow, pressed && styles.pressed]}
      >
        <Text style={styles.pagesRowText}>Pages</Text>
        <ChevronRight size={16} color={c.textTertiary} />
      </Pressable>

      {chatVisible ? (
        <>
      <View style={styles.panel}>
        <Text style={styles.sectionLabel}>Channels</Text>
        {display?.groups.map((group) => {
          const rollup = group.category
            ? groupUnreadCount(group.channels, unread, mutedChannelIds)
            : 0;
          return (
            <View key={group.category?.id ?? 'uncategorized'} style={styles.group}>
              {display.hasCategories ? (
                <View style={styles.groupHeader}>
                  <Text style={styles.groupHeaderText} numberOfLines={1}>
                    {group.category ? group.category.name.toUpperCase() : 'OTHER'}
                  </Text>
                  {rollup > 0 ? <Text style={styles.groupRollup}>{rollup > 99 ? '99+' : rollup}</Text> : null}
                </View>
              ) : null}
              {group.channels.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  name={channel.name}
                  topic={channel.topic ?? null}
                  unread={unread[channel.id] ?? 0}
                  muted={mutedChannelIds.has(channel.id)}
                  onOpen={() => openChannel(channel.id)}
                  onToggleMute={(muted) => toggleChannelMute(channel.id, channel.name, muted)}
                  styles={styles}
                />
              ))}
            </View>
          );
        })}
        {display && display.archived.length === 0 && display.groups.every((g) => g.channels.length === 0) ? (
          <Text style={styles.emptyText}>No channels yet.</Text>
        ) : null}
      </View>

      {display && display.archived.length > 0 ? (
        <View style={styles.panel}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showArchived ? 'Hide archived channels' : `Show ${display.archived.length} archived channels`}
            onPress={() => setShowArchived((v) => !v)}
            style={({ pressed }) => [styles.archivedToggle, pressed && styles.pressed]}
          >
            <Text style={[styles.sectionLabel, styles.flex1]}>Archived</Text>
            <Text style={styles.archivedCount}>{display.archived.length}</Text>
            <Text style={styles.archivedChevron}>{showArchived ? '▲' : '▼'}</Text>
          </Pressable>
          {showArchived ? (
            <>
              <Text style={styles.archivedBanner}>Archived channel. Content is preserved and read-only here.</Text>
              {display.archived.map((channel) => (
                <View key={channel.id} style={[styles.row, styles.mutedRow]}>
                  <View style={styles.rowOpen}>
                    <Text style={styles.rowMain} numberOfLines={1}>#{channel.name}</Text>
                    {channel.topic ? <Text style={styles.rowTopic} numberOfLines={1}>{channel.topic}</Text> : null}
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open files for ${d.name}`}
        onPress={openFiles}
        style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
      >
        <View style={styles.linkRowLeft}>
          <FolderOpen size={18} color={c.accent} strokeWidth={2} />
          <Text style={styles.linkRowText}>Files</Text>
        </View>
        <Text style={styles.linkRowHint}>All channels, saved on this device</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Members and settings for ${d.name}`}
        onPress={openSettings}
        style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
      >
        <View style={styles.linkRowLeft}>
          <Users size={18} color={c.accent} strokeWidth={2} />
          <Text style={styles.linkRowText}>
            {d.members.length} member{d.members.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Text style={styles.linkRowHint}>Manage in settings</Text>
      </Pressable>
        </>
      ) : null}

      <View style={{ height: insets.bottom + 96 }} />
    </ScrollView>
  );
}

function ChannelRow({
  name,
  topic,
  unread,
  muted,
  onOpen,
  onToggleMute,
  styles,
}: {
  name: string;
  topic: string | null;
  unread: number;
  muted: boolean;
  onOpen: () => void;
  onToggleMute: (muted: boolean) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={[styles.row, muted && styles.mutedRow]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `Open ${name}, ${unread} unread` : `Open ${name}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.rowOpen, pressed && styles.pressed]}
      >
        <Text style={styles.rowMain} numberOfLines={1}>#{name}</Text>
        {topic ? <Text style={styles.rowTopic} numberOfLines={1}>{topic}</Text> : null}
      </Pressable>
      <View style={styles.rowActions}>
        {unread > 0 && !muted ? <Text style={styles.unreadBadge}>{unread > 99 ? '99+' : unread}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={muted ? `Unmute ${name}` : `Mute ${name}`}
          onPress={() => onToggleMute(!muted)}
          style={({ pressed }) => [styles.tinyAction, muted && styles.tinyActionActive, pressed && styles.pressed]}
        >
          <Text style={[styles.tinyActionText, muted && styles.tinyActionTextActive]}>
            {muted ? 'Muted' : 'Mute'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Header({
  title,
  onBack,
  onSettings,
  insetsTop,
}: {
  title: string;
  onBack: () => void;
  onSettings: (() => void) | null;
  insetsTop: number;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <View style={[styles.header, { marginTop: insetsTop }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
      >
        <ChevronLeft size={24} color={c.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      {onSettings ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Community settings"
          onPress={onSettings}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Settings size={22} color={c.text} strokeWidth={2} />
        </Pressable>
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );
}

// Plan 38 Phase 7 (G10): the Libraries home for a library_first community. Per
// library rows (listLibrarySummaries) + On Deck (resume) + Recently added, all
// from REAL local rows scoped to this community. Opening a library row routes to
// the channel screen's Library segment (openChannel). Honest: nothing here implies
// a file is available anywhere the device has not actually recorded.
function CommunityLibrariesHome({
  communityId,
  revision,
  styles,
  colors,
  onOpenLibrary,
}: {
  communityId: string;
  revision: number;
  styles: ReturnType<typeof makeStyles>;
  colors: MkColors;
  onOpenLibrary: (channelId: string) => void;
}) {
  const db = useMeerkatDatabase();
  useSyncExternalStore(subscribeDeviceLayout, deviceLayoutRevision, deviceLayoutRevision);
  const [summaries, setSummaries] = useState<LibrarySummary[]>([]);
  const [onDeck, setOnDeck] = useState<OnDeckEntry[]>([]);
  const [recent, setRecent] = useState<ResolvedLibraryItem[]>([]);

  useFocusEffect(useCallback(() => {
    void revision;
    setSummaries(listLibrarySummaries(db, communityId));
    const items = listAllWorkspaceItems(db, communityId);
    const progress = progressByItem(db);
    setOnDeck(buildOnDeck(items, progress));
    setRecent(buildRecentlyAdded(items));
  }, [db, communityId, revision]));

  if (summaries.length === 0) {
    return (
      <View style={styles.panel}>
        <Text style={styles.sectionLabel}>Libraries</Text>
        <Text style={styles.emptyText}>
          No libraries yet. The owner can add one in community settings.
        </Text>
      </View>
    );
  }

  return (
    <>
      {onDeck.length > 0 ? (
        <View style={styles.libSection}>
          <Text style={styles.sectionLabel}>{LIBRARY_STRINGS.onDeck}</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={onDeck}
            keyExtractor={(e) => e.item.event.id}
            contentContainerStyle={styles.libRowScroll}
            renderItem={({ item: entry }) => (
              <Pressable style={styles.deckCard} onPress={() => onOpenLibrary(entry.item.event.channelId)}>
                <Text style={styles.deckTitle} numberOfLines={2}>{entry.item.event.title}</Text>
                <Text style={styles.deckSub}>Resume</Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      {recent.length > 0 ? (
        <View style={styles.libSection}>
          <Text style={styles.sectionLabel}>{LIBRARY_STRINGS.recentlyAdded}</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={recent}
            keyExtractor={(i) => i.event.id}
            contentContainerStyle={styles.libRowScroll}
            renderItem={({ item }) => (
              <Pressable style={styles.recentCard} onPress={() => onOpenLibrary(item.event.channelId)}>
                <Text style={styles.recentTitle} numberOfLines={2}>{item.event.title}</Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.sectionLabel}>Libraries</Text>
        {summaries.map((summary) => (
          <Pressable
            key={summary.config.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${summary.name}`}
            onPress={() => onOpenLibrary(summary.config.channelId)}
            style={({ pressed }) => [styles.libRow, pressed && styles.pressed]}
          >
            <View style={styles.libIcon}><LibraryIcon size={18} color={colors.accent} strokeWidth={1.9} /></View>
            <View style={styles.libText}>
              <Text style={styles.libName} numberOfLines={1}>{summary.name}</Text>
              <Text style={styles.libMeta}>
                {MEDIA_LABEL[summary.config.mediaType as KnownMediaType] ?? summary.config.mediaType}
                {' · '}{summary.itemCount} {summary.itemCount === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    </>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12 },
  centered: { alignItems: 'center', gap: 8, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: -8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: c.text, fontSize: 22, fontWeight: '800' },
  banner: { width: '100%', height: 120, borderRadius: MK_RADIUS.lg, backgroundColor: c.surfaceHigh, marginBottom: 4 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  identityCopy: { flex: 1, minWidth: 0, gap: 3 },
  subtitle: { color: c.textSecondary, fontSize: 13 },
  description: { color: c.text, fontSize: 13.5, lineHeight: 19 },
  themeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  themeSource: { color: c.textTertiary, fontSize: 12, fontWeight: '700' },
  themeToggle: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: MK_RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    backgroundColor: c.surfaceElevated,
  },
  themeToggleText: { color: c.accent, fontSize: 12, fontWeight: '800' },
  adoptRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  adoptNotice: { flex: 1, minWidth: 0, color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 14,
    gap: 8,
  },
  sectionLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  group: { gap: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  groupHeaderText: { flex: 1, color: c.textTertiary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  groupRollup: {
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    overflow: 'hidden',
    backgroundColor: c.accent,
    color: c.onAccent,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
  archivedToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex1: { flex: 1 },
  archivedCount: { color: c.textTertiary, fontSize: 12, fontWeight: '800' },
  archivedChevron: { color: c.textTertiary, fontSize: 11 },
  archivedBanner: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  rowTopic: { color: c.textTertiary, fontSize: 12, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
  },
  mutedRow: { opacity: 0.62, borderWidth: StyleSheet.hairlineWidth, borderColor: c.warning },
  rowOpen: { flex: 1, minWidth: 0 },
  rowMain: { color: c.text, fontSize: 15, fontWeight: '700' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tinyAction: {
    minHeight: 30,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: MK_RADIUS.sm,
    paddingHorizontal: 9,
    backgroundColor: c.surface,
  },
  tinyActionActive: { borderColor: c.warning, backgroundColor: c.warningSoft },
  tinyActionText: { color: c.textSecondary, fontSize: 11, fontWeight: '800' },
  tinyActionTextActive: { color: c.warning },
  unreadBadge: {
    minWidth: 26,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    overflow: 'hidden',
    backgroundColor: c.accent,
    color: c.onAccent,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  linkRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkRowText: { color: c.text, fontSize: 15, fontWeight: '700' },
  linkRowHint: { flexShrink: 1, color: c.textTertiary, fontSize: 11, textAlign: 'right' },
  emptyTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  emptyText: { color: c.textSecondary, fontSize: 13.5, textAlign: 'center' },
  libSection: { gap: 8 },
  libRowScroll: { gap: 10, paddingRight: 8 },
  deckCard: {
    width: 150,
    minHeight: 84,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 12,
    gap: 6,
    justifyContent: 'space-between',
  },
  deckTitle: { color: c.text, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  deckSub: { color: c.accent, fontSize: 12, fontWeight: '700' },
  recentCard: {
    width: 120,
    height: 84,
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.md,
    padding: 12,
    justifyContent: 'flex-end',
  },
  recentTitle: { color: c.text, fontSize: 13, fontWeight: '700', lineHeight: 17 },
  libRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingVertical: 4 },
  libIcon: { width: 38, height: 38, borderRadius: MK_RADIUS.sm, backgroundColor: c.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  libText: { flex: 1, minWidth: 0, gap: 2 },
  libName: { color: c.text, fontSize: 15, fontWeight: '700' },
  libMeta: { color: c.textSecondary, fontSize: 12.5 },
  pressed: { opacity: 0.72 },
  pagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderColor: c.glassBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pagesRowText: { color: c.text, fontSize: 15, fontWeight: '600' },
});
