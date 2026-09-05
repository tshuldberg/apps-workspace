// ChannelView (Plan 30 Phase 4 rebuild): the web twin of the rebuilt mobile
// channel screen. A segmented Chat | Posts surface under the header, with exactly
// ONE always-visible audience line (the per-message badges + composer summary are
// gone). Chat = the grouped message list (own-messages right-aligned, reactions,
// reply, @mentions, a "New messages" divider) + composer; Posts = the existing
// PostsPanel (now with reaction chips). A focused-view live loop polls the honest
// runForegroundDrain and retires the manual pull; it adds ZERO status claims.

import { channelArchived, communityRole,
  createCommunityAudienceRule, getPublicKeyFingerprint, type ChannelMessageEvent } from '@mylife/sync';
import { useCommunityStyleExtras } from '../community/CommunityThemeBoundary';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  isCommunityContentReportHidden,
  isCommunityPersonBlocked,
} from '../../lib/community-safety';
import {
  firstUnreadEventId,
  mapEventToKit,
  mentionDisplayNames,
  newestVisibleEventId,
  replySnippet,
} from '../../lib/channel-view-core';
import { syncAutomaticCommunityHistory,
  maybeRefreshCommunityFeedFromHost,
  resolveCommunityPersona, type ReadBoundary } from '../../lib/meerkat-data';
import type { ChatKitMessage, KitReactionGroup, KitSticker, MentionCandidate } from '../../lib/chat-kit-core';
import type { SendMessageOpts } from '../../lib/chat-compose';
import { isSamePerson } from '../../lib/person-view-core';
import { shortHex } from '../format';
import { AudienceBadge } from '../audience/AudienceRule';
import { ChannelHeader } from './ChannelHeader';
import { ChannelSegmentedTabs, type ChannelSegment } from './ChannelSegmentedTabs';
import { ChatMessageList } from './ChatMessageList';
import { ChatComposer } from './ChatComposer';
import { InChannelFileCard } from './InChannelFileCard';
import { LinkPreviewCard, isLinkPreviewAttachment } from './LinkPreviewCard';
import { IncomingRequestsPanel } from './IncomingRequestsPanel';
import { PostsPanel } from './PostsPanel';
import { PostThreadView } from './PostThreadView';
import { RoomView } from '../call/RoomView';
import { HonestNotice } from '../shell/HonestNotice';
import { useChannelLiveLoop } from './useChannelLiveLoop';
import { importChannelHistoryManifest } from '../../lib/channel-history-import';
import { communityLayout } from '@mylife/sync';
import { channelBlockStack, resolveActiveLayout } from '../../lib/community-layout-core';
import { listCommunityLayoutEvents } from '../../lib/meerkat-data';
import { listReactionPackItems, listStickerPackItems, resolvePackReactionDisplay, type PackReactionDisplay } from '../../lib/asset-packs-core';
import { resolveSealedAssetUri } from '../../lib/canvas-assets';
import { buildBlockQueries } from '../../lib/block-queries';
import { BlockStack } from '../blocks/BlockStack';
import type { BlockHostContext } from '../blocks/registry';
import { useView } from '../navigation/useView';
import { CanvasHost } from '../canvas/CanvasHost';
import {
  addThreadSticker,
  ensureCanvas,
  getCanvasById,
  getCanvasForSubject,
  listThreadStickers,
  removeThreadSticker,
  type ThreadSticker,
} from '../../lib/canvas-core';

const EMPTY_REACTIONS: readonly KitReactionGroup[] = Object.freeze([]);
const EMPTY_STICKERS: readonly KitSticker[] = Object.freeze([]);
const EMPTY_NAMES: readonly string[] = Object.freeze([]);

export function ChannelView({
  communityId,
  channelId,
  postId,
  onPostBack,
}: {
  communityId: string;
  channelId: string;
  postId?: string | null;
  onPostBack?: () => void;
}): React.ReactElement | null {
  const m = useMeerkat();
  const { dispatch } = useView();
  const [localPostId, setLocalPostId] = useState<string | null>(null);
  const openPostId = postId ?? localPostId;
  // Plan 25 WP-25I: the community voice/video room is a local ChannelView pane
  // (route-vs-pane parity with mobile's room/[communityId]/[channelId] route).
  const [roomOpen, setRoomOpen] = useState(false);
  const revision = m.revision;
  const ownDeviceId = m.identity.publicKey;
  const community = m.listCommunities().find((c) => c.communityId === communityId) ?? null;
  const channel = community?.descriptor.channels.find((c) => c.id === channelId) ?? null;
  // Plan 38 Phase 2: an archived channel is read-only here too. Mobile enforced
  // this from the start; the web view rendered live composers into archived
  // channels opened from the sidebar's Archived group.
  const channelIsArchived = channel ? channelArchived(channel) : false;
  const audienceRule = useMemo(() => createCommunityAudienceRule(communityId), [communityId]);

  const [segment, setSegment] = useState<ChannelSegment>('chat');
  // Composition Phase 1: a channel whose kind maps to a block stack renders it
  // as its primary surface (Blocks | Chat, mirroring mobile). The layout
  // document can override the stack per channel.
  const [blockSegment, setBlockSegment] = useState<'blocks' | 'chat'>('blocks');
  const composedDocument = useMemo(() => {
    if (!community) return null;
    const active = resolveActiveLayout({
      events: listCommunityLayoutEvents(m.db, communityId),
      ownerDeviceId: community.descriptor.ownerDeviceId,
      legacyLayout: communityLayout(community.descriptor),
    });
    return active.source === 'layout_document' ? active.document : null;
  }, [m.db, community, communityId]);
  const channelBlocks = useMemo(() => {
    const kind = channel?.kind ?? 'chat';
    if (kind === 'library' || kind === 'canvas' || kind === 'page') return null;
    return channelBlockStack(composedDocument, channelId, kind);
  }, [composedDocument, channelId, channel?.kind]);
  // Plan 56 C1: a 'canvas' channel is the Commons (4.1); a 'page' channel is a
  // promoted member page bound by the channel id (4.4). The topper (4.2)
  // renders above the message list on any other channel when one exists.
  const isCanvasChannel = channel?.kind === 'canvas';
  const isPageChannel = channel?.kind === 'page';
  const [canvasRevision, setCanvasRevision] = useState(0);
  const channelCanvas = useMemo(() => {
    void canvasRevision;
    if (!community) return null;
    if (isCanvasChannel) {
      const existing = getCanvasForSubject(m.db, communityId, 'commons', channelId);
      if (existing) return existing;
      if (community.descriptor.ownerDeviceId === m.identity.publicKey) {
        try {
          const created = ensureCanvas(m.db, m.identity, { communityId, kind: 'commons', subjectId: channelId }, m.recordLocalChange);
          void m.db.flush().catch(() => undefined);
          return created;
        } catch {
          return null;
        }
      }
      return null;
    }
    if (isPageChannel) return getCanvasById(m.db, channelId);
    return null;
  }, [m, community, communityId, channelId, isCanvasChannel, isPageChannel, canvasRevision]);
  const topperCanvas = useMemo(() => {
    void canvasRevision;
    if (!community || isCanvasChannel || isPageChannel) return null;
    return getCanvasForSubject(m.db, communityId, 'channel_topper', channelId);
  }, [m.db, community, communityId, channelId, isCanvasChannel, isPageChannel, canvasRevision]);
  const blockCtx = useMemo<BlockHostContext | null>(() => {
    if (!community) return null;
    return {
      communityId,
      communityName: community.descriptor.name,
      channels: community.descriptor.channels.map((item) => ({
        id: item.id,
        name: item.name,
        kind: item.kind ?? 'chat',
      })),
      queries: buildBlockQueries(m.db, community.descriptor),
      onOpenChannel: (target: string) => dispatch({ type: 'OPEN_CHANNEL', communityId, channelId: target }),
      onOpenFiles: () => dispatch({ type: 'OPEN_FILES', communityId }),
      surfaceChannelId: channelId,
      revision,
    };
  }, [m.db, community, communityId, channelId, revision, dispatch]);
  const [draft, setDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<ChannelMessageEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<ChannelMessageEvent | null>(null);
  const [stashedDraft, setStashedDraft] = useState<string | null>(null);
  // The read boundary captured on focus (BEFORE the cursor advances) anchors the
  // "New messages" divider; atBottom gates the advance so scrolled-up arrivals
  // stay unread (Plan 30 read-cursor policy).
  const [readSnapshot, setReadSnapshot] = useState<ReadBoundary | null>(null);
  const atBottomRef = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState('Looking for verified community history…');
  const [historyNeedsManual, setHistoryNeedsManual] = useState(false);
  const [manualHistoryOpen, setManualHistoryOpen] = useState(false);
  const [manualManifest, setManualManifest] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  const isEventHiddenBySafety = useMemo(() => {
    return (event: { communityId: string; id: string; authorDeviceId: string; postId?: string }): boolean => {
      if (isCommunityPersonBlocked(m.db, communityId, event.authorDeviceId)) return true;
      if (isCommunityContentReportHidden(m.db, communityId, 'message', event.id)) return true;
      if (event.postId && isCommunityContentReportHidden(m.db, communityId, 'post', event.postId)) return true;
      return false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.db, communityId, revision]);

  const names = useMemo(
    () => m.communityPeerNames(communityId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, communityId, revision],
  );
  // Raw name (no "You" substitution): the mention label + highlight needle, kept
  // consistent so a signed mention and its render-pass highlight match.
  const rawName = useCallback(
    (deviceId: string): string => names.get(deviceId) ?? shortHex(getPublicKeyFingerprint(deviceId)),
    [names],
  );
  // Plan 52 P4: verified person links, so a message authored on one of YOUR
  // OWN linked devices reads as you here rather than as a separate member.
  const links = useMemo(
    () => m.personLinks(communityId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, communityId, revision],
  );
  const resolveName = useCallback((deviceId: string): string => {
    if (isSamePerson(links, deviceId, ownDeviceId)) {
      const communityName = names.get(deviceId);
      return communityName ? `You as ${communityName}` : 'You';
    }
    return names.get(deviceId) ?? shortHex(getPublicKeyFingerprint(deviceId));
  }, [names, links, ownDeviceId]);
  const avatarInitial = useCallback(
    (deviceId: string): string => {
      const resolved = m.communityAvatarInitial(communityId, deviceId, rawName(deviceId));
      return resolved ?? (rawName(deviceId).trim().charAt(0).toUpperCase() || '?');
    },
    [m, communityId, rawName],
  );

  const mentionCandidates = useMemo<MentionCandidate[]>(() => {
    const out: MentionCandidate[] = [];
    for (const [deviceId, name] of names) {
      if (deviceId === ownDeviceId) continue;
      out.push({ deviceId, name });
    }
    return out;
  }, [names, ownDeviceId]);

  // The visible CHAT events (posts + safety-hidden excluded); reactions are already
  // out of the stream via the read model.
  const chatEvents = useMemo(
    () => m.listChannelMessages(communityId, channelId).filter((e) => !e.postId && !isEventHiddenBySafety(e)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, communityId, channelId, revision, isEventHiddenBySafety],
  );
  const posts = useMemo(
    () => m.listChannelPostCards(communityId, channelId).filter((post) => !isEventHiddenBySafety(post.root)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, communityId, channelId, revision, isEventHiddenBySafety],
  );
  const reactionsByParent = useMemo(
    () => m.channelReactions(communityId, channelId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, communityId, channelId, revision],
  );

  const eventsById = useMemo(() => {
    const map = new Map<string, ChannelMessageEvent>();
    for (const e of chatEvents) map.set(e.id, e);
    return map;
  }, [chatEvents]);

  const resolveNameColor = useCallback(
    (deviceId: string) => resolveCommunityPersona(m.db, communityId, deviceId).nameColor,
    [m.db, communityId],
  );

  // Feature 4: role bubble shapes from the merged community+channel extras.
  const styleExtras = useCommunityStyleExtras();
  const resolveBubbleShape = useCallback(
    (deviceId: string) => {
      const byRole = styleExtras?.bubbleShapesByRole;
      if (!byRole || !community) return null;
      const role = communityRole(community.descriptor, deviceId);
      if (role === 'owner') return byRole.owner ?? null;
      if (role === 'admin') return byRole.admin ?? null;
      if (role === 'member') return byRole.member ?? null;
      return null;
    },
    [styleExtras, community],
  );

  const kitMessages = useMemo<ChatKitMessage[]>(
    () => chatEvents.map((event) => mapEventToKit(event, {
      selfDeviceId: ownDeviceId,
      eventsById,
      resolveReplyName: resolveName,
      resolveNameColor,
      resolveBubbleShape,
    })),
    [chatEvents, eventsById, ownDeviceId, resolveName, resolveNameColor, resolveBubbleShape],
  );

  const mentionNamesById = useMemo(() => {
    const map = new Map<string, readonly string[]>();
    for (const event of chatEvents) {
      const namesForEvent = mentionDisplayNames(event, rawName);
      if (namesForEvent.length > 0) map.set(event.id, namesForEvent);
    }
    return map;
  }, [chatEvents, rawName]);

  const firstUnreadId = useMemo(
    () => firstUnreadEventId(chatEvents, readSnapshot, ownDeviceId),
    [chatEvents, readSnapshot, ownDeviceId],
  );
  const newestVisibleId = useMemo(
    () => newestVisibleEventId(chatEvents, isEventHiddenBySafety),
    [chatEvents, isEventHiddenBySafety],
  );

  // On focus (a channel change), snapshot the read boundary BEFORE the cursor
  // advances, so the "New messages" divider anchors at the last visit.
  useEffect(() => {
    setReadSnapshot(m.channelReadBoundary(communityId, channelId));
    setSegment('chat');
    setReplyTarget(null);
    setEditingEvent(null);
    setDraft('');
    atBottomRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, channelId]);

  // Advance the read cursor only while the newest message is on screen: on the
  // (channel, newest) change while at the bottom. Arrivals while scrolled up stay
  // unread. markChannelReadLatest passes the newest visible author (m3 tiebreak).
  useEffect(() => {
    if (atBottomRef.current && newestVisibleId) m.markChannelReadLatest(communityId, channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, channelId, newestVisibleId]);

  const onAtBottomChange = useCallback((atBottom: boolean) => {
    atBottomRef.current = atBottom;
    if (atBottom && newestVisibleId) m.markChannelReadLatest(communityId, channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, communityId, channelId, newestVisibleId]);

  const runManualHistoryImport = useCallback(async (): Promise<void> => {
    if (!community || manualBusy) return;
    setManualBusy(true);
    try {
      const result = await importChannelHistoryManifest({
        db: m.db,
        identity: m.identity,
        communityId,
        channelId,
        manifestJson: manualManifest,
        hosts: community.descriptor.hosts,
        expectedCatalogCid: community.descriptor.catalogCid,
      });
      setHistoryNotice(result.message);
      if (result.ok) {
        setManualHistoryOpen(false);
        setHistoryNeedsManual(false);
        m.refresh();
      }
    } catch (err) {
      // Without this catch a thrown import stranded the button on "Verifying…"
      // forever with the rejection swallowed.
      setHistoryNotice(err instanceof Error ? err.message : 'Could not verify that manifest.');
    } finally {
      setManualBusy(false);
    }
  }, [channelId, community, communityId, m, manualBusy, manualManifest]);

  // Plan 30 Phase 4: the focused-view live loop. It polls the SAME honest
  // runForegroundDrain the manual button ran, only on applied>0 refreshes, is
  // dormant with no relay, and NEVER shows a connected/live status.
  const { noteSend } = useChannelLiveLoop({
    communityId,
    channelId,
    active: segment === 'chat' && !openPostId,
    onApplied: () => m.refresh(),
  });

  const runAutomaticHistory = useCallback(async (force = false): Promise<void> => {
    setHistoryNotice('Looking for verified community history…');
    setHistoryNeedsManual(false);
    let result;
    try {
      result = await syncAutomaticCommunityHistory(m.db, m.identity, communityId, {
        relayUrl: m.relayUrl,
        entitlementToken: m.hostedAccess.entitlementToken ?? undefined,
        force,
      });
    } catch {
      // A thrown lookup (not a typed fallback) must not strand the notice on
      // "Looking for…" forever or die as an unhandled rejection.
      setHistoryNotice('History lookup failed in this browser. Use manual history import when you have a host manifest.');
      setHistoryNeedsManual(true);
      return;
    }
    if (result.outcome === 'imported') {
      setHistoryNotice(result.applied > 0
        ? `Verified and imported ${result.applied} older history event${result.applied === 1 ? '' : 's'}.`
        : 'Automatic history host verified. This browser is caught up.');
      m.refresh();
      return;
    }
    if (result.outcome === 'throttled') return;
    const reason = result.reason === 'no_host_announced'
      ? 'No automatic history host is announced.'
      : result.reason === 'no_valid_host'
        ? 'Announced history hosts were expired or did not match this community.'
        : result.reason === 'all_hosts_failed'
          ? 'History hosts did not pass full snapshot verification.'
          : 'The history registry could not be reached.';
    setHistoryNotice(`${reason} Use manual history import when you have a host manifest.`);
    setHistoryNeedsManual(true);
  }, [communityId, m]);

  useEffect(() => {
    void runAutomaticHistory();
    const timer = window.setInterval(() => { void runAutomaticHistory(); }, 5 * 60 * 1_000);
    return () => window.clearInterval(timer);
  }, [runAutomaticHistory]);

  // Plan 57 W3: when this community carries an attached server in its signed
  // descriptor, run one throttled pull from it on open. Applied counts are the
  // real engine values; a no-host community and a throttled attempt are cheap
  // no-ops, and nothing here claims a pull that did not happen.
  useEffect(() => {
    let cancelled = false;
    void maybeRefreshCommunityFeedFromHost(m.db, m.identity, communityId, {
      entitlementToken: m.hostedAccess.entitlementToken ?? undefined,
    })
      .then((outcome) => {
        if (!cancelled && outcome.ran && outcome.result.applied > 0) m.refresh();
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, m.db, m.identity]);

  // Plan 56 feature 5: pack-token reactions render as a verified glyph, a
  // decrypted image, or the honest :slug: fallback (never the raw token, never
  // a fabricated image). Image URIs decrypt asynchronously into a local cache.
  const [packImageUris, setPackImageUris] = useState<ReadonlyMap<string, string>>(new Map());
  const packDisplays = useMemo(() => {
    const map = new Map<string, PackReactionDisplay>();
    for (const groups of reactionsByParent.values()) {
      for (const group of groups) {
        if (!group.emoji.startsWith('mkpack:') || map.has(group.emoji)) continue;
        const display = resolvePackReactionDisplay(m.db, communityId, group.emoji);
        if (display) map.set(group.emoji, display);
      }
    }
    return map;
  }, [m.db, communityId, reactionsByParent]);

  const packPickerItems = useMemo(() => {
    void revision;
    return listReactionPackItems(m.db, communityId).map(({ token, item }) => ({
      token,
      label: `:${item.slug}:`,
      glyph: item.glyph,
      imageUri: packImageUris.get(token) ?? null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.db, communityId, revision, packImageUris]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const wanted: Array<{ token: string; asset: NonNullable<PackReactionDisplay & { kind: 'asset' }>['asset']; author: string }> = [];
      for (const entry of listReactionPackItems(m.db, communityId)) {
        if (entry.item.asset && !packImageUris.has(entry.token)) {
          wanted.push({ token: entry.token, asset: entry.item.asset, author: entry.item.uploadedBy });
        }
      }
      for (const [token, display] of packDisplays) {
        if (display.kind === 'asset' && !packImageUris.has(token)) {
          wanted.push({ token, asset: display.asset, author: display.uploadedBy });
        }
      }
      for (const entry of wanted) {
        const uri = await resolveSealedAssetUri({
          db: m.db, store: m.nodeStore, identity: m.identity, communityId,
          asset: entry.asset, authorDevice: entry.author,
        });
        if (cancelled) return;
        if (uri) setPackImageUris((prev) => new Map(prev).set(entry.token, uri));
      }
    })();
    return () => { cancelled = true; };
  }, [m, communityId, packDisplays, packImageUris]);

  // Feature 12: the sticker layer. Verified, receiver-dialed stickers per
  // message; sealed pack-image stickers decrypt into their own uri cache.
  const stickersByMessage = useMemo(() => {
    void revision;
    if (!community) return new Map<string, ThreadSticker[]>();
    return listThreadStickers(m.db, communityId, channelId, community.descriptor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.db, communityId, channelId, community, revision]);

  const [stickerUris, setStickerUris] = useState<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const wanted: Array<{ key: string; asset: NonNullable<ThreadSticker['asset']>; author: string }> = [];
      for (const stickers of stickersByMessage.values()) {
        for (const sticker of stickers) {
          if (sticker.asset && !stickerUris.has(sticker.nodeId)) {
            wanted.push({ key: sticker.nodeId, asset: sticker.asset, author: sticker.authorDevice });
          }
        }
      }
      for (const entry of listStickerPackItems(m.db, communityId)) {
        const key = `pack:${entry.packId}:${entry.item.slug}`;
        if (entry.item.asset && !stickerUris.has(key)) {
          wanted.push({ key, asset: entry.item.asset, author: entry.item.uploadedBy });
        }
      }
      for (const entry of wanted) {
        const uri = await resolveSealedAssetUri({
          db: m.db, store: m.nodeStore, identity: m.identity, communityId,
          asset: entry.asset, authorDevice: entry.author,
        });
        if (cancelled) return;
        if (uri) setStickerUris((prev) => new Map(prev).set(entry.key, uri));
      }
    })();
    return () => { cancelled = true; };
  }, [m, communityId, stickersByMessage, stickerUris]);

  const isCuratorRole = community?.myRole === 'owner' || community?.myRole === 'admin';
  const getStickers = useCallback((messageId: string): readonly KitSticker[] => {
    const stickers = stickersByMessage.get(messageId);
    if (!stickers || stickers.length === 0) return EMPTY_STICKERS;
    return stickers.map((sticker) => ({
      nodeId: sticker.nodeId,
      emoji: sticker.emoji,
      imageUri: sticker.asset ? stickerUris.get(sticker.nodeId) ?? null : null,
      x: sticker.x,
      y: sticker.y,
      rotation: sticker.rotation,
      mine: sticker.authorDevice === m.identity.publicKey,
      removable: sticker.authorDevice === m.identity.publicKey || isCuratorRole,
    }));
  }, [stickersByMessage, stickerUris, m.identity.publicKey, isCuratorRole]);

  const QUICK_STICKERS: readonly string[] = ['⭐', '🔥', '🌸', '🦫', '💯', '🎉'];
  const stickerChoices = useMemo(() => {
    void revision;
    const choices: Array<{ key: string; label: string; glyph?: string | null; imageUri?: string | null }> = [];
    for (const glyph of QUICK_STICKERS) choices.push({ key: `glyph:${glyph}`, label: glyph, glyph });
    for (const entry of listStickerPackItems(m.db, communityId)) {
      const key = `pack:${entry.packId}:${entry.item.slug}`;
      choices.push({ key, label: `:${entry.item.slug}:`, glyph: entry.item.glyph, imageUri: stickerUris.get(key) ?? null });
    }
    return choices;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.db, communityId, revision, stickerUris]);

  const stickMessage = useCallback((messageId: string, choiceKey: string) => {
    try {
      const count = stickersByMessage.get(messageId)?.length ?? 0;
      const x = 12 + (count * 42) % 220;
      const y = -6 + (count % 3) * 14;
      const rotation = ((count * 17) % 31) - 15;
      if (choiceKey.startsWith('glyph:')) {
        addThreadSticker(m.db, m.identity, {
          communityId, channelId, messageId, emoji: choiceKey.slice(6), x, y, rotation,
        }, m.recordLocalChange);
      } else {
        const [, packId, slug] = choiceKey.split(':');
        const entry = listStickerPackItems(m.db, communityId)
          .find((candidate) => candidate.packId === packId && candidate.item.slug === slug);
        if (!entry) return;
        if (entry.item.glyph) {
          addThreadSticker(m.db, m.identity, {
            communityId, channelId, messageId, emoji: entry.item.glyph, x, y, rotation,
          }, m.recordLocalChange);
        } else if (entry.item.asset) {
          addThreadSticker(m.db, m.identity, {
            communityId, channelId, messageId, asset: entry.item.asset, x, y, rotation,
          }, m.recordLocalChange);
        }
      }
      void m.db.flush().catch(() => undefined);
      m.refresh();
    } catch {
      // The core throws honest copy; chat has no blocking modal, so a failed
      // stick simply leaves no node (nothing fake to clean up).
    }
  }, [m, communityId, channelId, stickersByMessage]);

  const onPressSticker = useCallback((nodeId: string) => {
    if (!window.confirm('Remove this sticker? It disappears for everyone once a sync connects.')) return;
    try {
      removeThreadSticker(m.db, m.identity, communityId, channelId, nodeId, m.recordLocalChange);
      void m.db.flush().catch(() => undefined);
      m.refresh();
    } catch {
      // Nothing to roll back: a failed tombstone leaves the sticker in place.
    }
  }, [m, communityId, channelId]);

  const decorateReactions = useCallback(
    (groups: readonly KitReactionGroup[]): readonly KitReactionGroup[] => groups.map((group) => {
      const display = packDisplays.get(group.emoji);
      if (!display) return group;
      if (display.kind === 'glyph') return { ...group, displayGlyph: display.glyph };
      if (display.kind === 'asset') {
        return { ...group, displayImageUri: packImageUris.get(group.emoji) ?? null, displayLabel: `:${display.slug}:` };
      }
      return { ...group, displayLabel: `:${display.slug}:` };
    }),
    [packDisplays, packImageUris],
  );

  const getReactions = useCallback(
    (id: string): readonly KitReactionGroup[] => decorateReactions(reactionsByParent.get(id) ?? EMPTY_REACTIONS),
    [reactionsByParent, decorateReactions],
  );
  const getMentionNames = useCallback(
    (id: string): readonly string[] => mentionNamesById.get(id) ?? EMPTY_NAMES,
    [mentionNamesById],
  );

  const toggleReaction = useCallback((eventId: string, emoji: string, targetPostId?: string) => {
    // Archived channels are read-only: existing reaction chips stay visible as
    // preserved content, but no click may write a new react/remove event.
    if (channelIsArchived) return;
    const groups = reactionsByParent.get(eventId) ?? EMPTY_REACTIONS;
    const existing = groups.find((g) => g.emoji === emoji);
    if (existing && existing.mine && existing.myEventId) {
      m.removeReaction(communityId, channelId, existing.myEventId);
    } else {
      m.sendReaction(communityId, channelId, { eventId, postId: targetPostId }, emoji);
    }
  }, [reactionsByParent, m, communityId, channelId, channelIsArchived]);

  const onReact = useCallback((eventId: string, emoji: string) => {
    if (channelIsArchived) return;
    m.sendReaction(communityId, channelId, { eventId }, emoji);
  }, [m, communityId, channelId, channelIsArchived]);

  const beginReply = useCallback((eventId: string) => {
    const target = eventsById.get(eventId);
    if (!target) return;
    if (editingEvent) {
      setDraft(stashedDraft ?? '');
      setStashedDraft(null);
      setEditingEvent(null);
    }
    setReplyTarget(target);
    setSegment('chat');
  }, [eventsById, editingEvent, stashedDraft]);

  const startEdit = useCallback((eventId: string) => {
    const target = eventsById.get(eventId);
    if (!target) return;
    setStashedDraft((prev) => prev ?? draft);
    setReplyTarget(null);
    setEditingEvent(target);
    setDraft(target.body);
  }, [eventsById, draft]);

  const cancelEdit = useCallback(() => {
    setDraft(stashedDraft ?? '');
    setStashedDraft(null);
    setEditingEvent(null);
  }, [stashedDraft]);

  const onCopy = useCallback((eventId: string) => {
    const target = eventsById.get(eventId);
    if (target?.body) void navigator.clipboard?.writeText(target.body).catch(() => undefined);
  }, [eventsById]);

  const onDelete = useCallback((eventId: string) => {
    const target = eventsById.get(eventId);
    if (!target) return;
    const ok = window.confirm('Delete this message? This records a deletion here and hides the message from this view.');
    if (!ok) return;
    const result = m.deleteMessage(target);
    if (!result.ok) setError(result.error);
    else if (editingEvent?.id === eventId) cancelEdit();
  }, [eventsById, m, editingEvent, cancelEdit]);

  const onReport = useCallback((eventId: string) => {
    const target = eventsById.get(eventId);
    if (!target) return;
    const ok = window.confirm('Report and hide this message? This hides it on this device and adds it to local owner review.');
    if (!ok) return;
    m.reportCommunityContent({
      communityId,
      channelId,
      targetKind: 'message',
      targetId: target.id,
      targetAuthorDeviceId: target.authorDeviceId,
      targetLabel: `Message from ${resolveName(target.authorDeviceId)}`,
      reason: 'Reported from channel',
    });
  }, [eventsById, m, communityId, channelId, resolveName]);

  const submitMessage = useCallback((body: string, mentions: string[]): void => {
    if (editingEvent) {
      const result = m.editMessage(editingEvent, body);
      if (result.ok) {
        setStashedDraft(null);
        setEditingEvent(null);
        setDraft('');
      } else {
        setError(result.error);
      }
      return;
    }
    const hasReply = replyTarget !== null;
    const opts: SendMessageOpts | undefined = hasReply || mentions.length > 0
      ? {
        mentions: mentions.length > 0 ? mentions : undefined,
        parentId: replyTarget?.id,
        postId: replyTarget?.postId,
        branchId: replyTarget?.branchId,
      }
      : undefined;
    const result = m.sendChannelMessage(communityId, channelId, body, opts);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setDraft('');
    setReplyTarget(null);
    // Re-enter the 5s hot window so the loop polls fast for the peer's reply.
    noteSend();
  }, [editingEvent, replyTarget, m, communityId, channelId, noteSend]);

  const renderAttachments = useCallback((item: ChatKitMessage) => {
    const event = eventsById.get(item.id);
    if (!event?.attachments || event.attachments.length === 0) return null;
    return (
      <div className="mk-message-attachments">
        {event.attachments.map((attachment) => (
          isLinkPreviewAttachment(attachment)
            ? (
                <LinkPreviewCard
                  key={attachment.id}
                  blobHash={attachment.blobHash}
                  fallback={<InChannelFileCard attachment={attachment} event={event} />}
                />
              )
            : <InChannelFileCard key={attachment.id} attachment={attachment} event={event} />
        ))}
      </div>
    );
  }, [eventsById]);

  if (!community || !channel) return null;

  if (roomOpen) {
    return <RoomView communityId={communityId} channelId={channelId} onLeave={() => setRoomOpen(false)} />;
  }

  if (openPostId) {
    return (
      <PostThreadView
        communityId={communityId}
        channelId={channelId}
        postId={openPostId}
        resolveName={resolveName}
        onBack={() => {
          if (postId) {
            onPostBack?.();
            return;
          }
          setLocalPostId(null);
        }}
      />
    );
  }

  return (
    <div className="mk-channel-view">
      <ChannelHeader channelName={channel.name} communityName={community.descriptor.name} onOpenRoom={() => setRoomOpen(true)} />

      {/* AC-6 / NC-4: exactly ONE audience label on the channel surface, always
          visible (it replaces the per-message badges and the composer summary). */}
      <div className="mk-channel-audience-line">
        <AudienceBadge rule={audienceRule} />
        <span className="mk-channel-audience-text">{audienceRule.explanation}</span>
      </div>

      {channelIsArchived ? (
        // Parity-locked copy with the mobile channel screen.
        <HonestNotice>Archived channel. Content is preserved and read-only here.</HonestNotice>
      ) : null}

      {topperCanvas && community ? (
        // Plan 56 C1 (4.2): the channel topper above the message list.
        <CanvasHost community={community} canvas={topperCanvas} maxHeight={180} />
      ) : null}
      {!topperCanvas && community && !isCanvasChannel && !isPageChannel && channel.kind !== 'library'
        && community.descriptor.ownerDeviceId === m.identity.publicKey ? (
        <button
          type="button"
          className="mk-canvas-add-topper"
          onClick={() => {
            try {
              ensureCanvas(m.db, m.identity, { communityId, kind: 'channel_topper', subjectId: channelId }, m.recordLocalChange);
              void m.db.flush().catch(() => undefined);
              setCanvasRevision((v) => v + 1);
            } catch {
              // The data layer refused; nothing appears.
            }
          }}
        >
          Add a topper canvas
        </button>
      ) : null}

      {(isCanvasChannel || isPageChannel) && community ? (
        channelCanvas ? (
          <div className="mk-home-scroll">
            <CanvasHost community={community} canvas={channelCanvas} />
          </div>
        ) : (
          <div className="mk-home-scroll">
            <HonestNotice>
              {isCanvasChannel
                ? 'The owner has not set up this canvas on your device yet. It arrives when a sync connects.'
                : 'This page is not on this device yet. It arrives when a sync connects with a member who has it.'}
            </HonestNotice>
          </div>
        )
      ) : null}

      {(isCanvasChannel || isPageChannel) ? null : channelBlocks ? (
        // Composition Phase 1: a block-backed kind renders its stack as the
        // primary surface, with chat one tap away (library-channel pattern).
        <ChannelSegmentedTabs
          value={blockSegment === 'blocks' ? 'chat' : 'posts'}
          onChange={(v) => setBlockSegment(v === 'chat' ? 'blocks' : 'chat')}
          chatLabel={channel.name}
          postsLabel="Chat"
        />
      ) : (
        <ChannelSegmentedTabs value={segment} onChange={setSegment} />
      )}

      {channelBlocks && blockCtx && blockSegment === 'blocks' ? (
        <div className="mk-home-scroll">
          <BlockStack
            nodes={channelBlocks}
            declaredCapabilities={composedDocument?.capabilities ?? []}
            ctx={blockCtx}
          />
        </div>
      ) : null}

      {(isCanvasChannel || isPageChannel) ? null : (channelBlocks ? blockSegment === 'chat' : segment === 'chat') ? (
        <div className="mk-channel-chat">
          <IncomingRequestsPanel communityId={communityId} channelId={channelId} />
          {error ? (
            <button type="button" className="mk-box is-error mk-chat-error" onClick={() => setError(null)}>
              {error}
            </button>
          ) : null}
          <ChatMessageList
            items={kitMessages}
            firstUnreadId={firstUnreadId}
            readOnly={channelIsArchived}
            selfDeviceId={ownDeviceId}
            getAuthorName={resolveName}
            getAvatarInitial={avatarInitial}
            getReactions={getReactions}
            getMentionNames={getMentionNames}
            renderAttachments={renderAttachments}
            onReact={onReact}
            packReactions={packPickerItems}
            getStickers={getStickers}
            onPressSticker={onPressSticker}
            stickerChoices={stickerChoices}
            onStick={(id, key) => stickMessage(id, key)}
            onToggleReaction={(id, emoji) => toggleReaction(id, emoji)}
            onReply={beginReply}
            onCopy={onCopy}
            onEdit={startEdit}
            onDelete={onDelete}
            onReport={onReport}
            onScrollToTarget={() => undefined}
            onAtBottomChange={onAtBottomChange}
            header={(
              <HonestNotice>
                Partial history: this view shows messages saved in this browser. {historyNotice}{' '}
                {historyNeedsManual ? (
                  <>
                    <button type="button" className="mk-link-button" onClick={() => void runAutomaticHistory(true)}>Retry automatic discovery</button>
                    {' or '}
                    <button type="button" className="mk-link-button" onClick={() => setManualHistoryOpen((open) => !open)}>import a manifest</button>
                  </>
                ) : null}
              </HonestNotice>
            )}
          />
          {manualHistoryOpen ? (
            <div className="mk-box is-info">
              <p className="mk-publish-heading">Manual history import</p>
              <p className="mk-muted">Paste the JSON manifest supplied by a community history host. Every piece and signature is verified before anything is saved.</p>
              <textarea
                className="mk-input"
                rows={8}
                value={manualManifest}
                onChange={(event) => setManualManifest(event.currentTarget.value)}
                aria-label="History manifest JSON"
              />
              <div className="mk-publish-actions">
                <button type="button" className="mk-button" disabled={manualBusy || !manualManifest.trim()} onClick={() => void runManualHistoryImport()}>
                  {manualBusy ? 'Verifying…' : 'Verify and import'}
                </button>
                <button type="button" className="mk-button is-ghost" disabled={manualBusy} onClick={() => setManualHistoryOpen(false)}>Cancel</button>
              </div>
            </div>
          ) : null}
          {channelIsArchived ? null : (
            <ChatComposer
              value={draft}
              onChangeText={setDraft}
              onSend={submitMessage}
              mentionCandidates={mentionCandidates}
              reply={replyTarget ? {
                authorName: resolveName(replyTarget.authorDeviceId),
                snippet: replySnippet(replyTarget),
              } : null}
              onCancelReply={() => setReplyTarget(null)}
              editing={editingEvent !== null}
              onCancelEdit={cancelEdit}
            />
          )}
        </div>
      ) : (
        <PostsPanel
          communityId={communityId}
          channelId={channelId}
          posts={posts}
          resolveName={resolveName}
          onOpenPost={setLocalPostId}
          getReactions={getReactions}
          onToggleReaction={toggleReaction}
          composerHidden={channelIsArchived}
        />
      )}
    </div>
  );
}
