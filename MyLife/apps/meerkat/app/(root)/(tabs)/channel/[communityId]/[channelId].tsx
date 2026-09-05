import { fetch as previewFetch } from 'expo/fetch';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { decodeBase64 } from 'tweetnacl-util';
import {
  ArrowLeft,
  FolderOpen,
  Info,
  MessageSquareText,
  MoreVertical,
  Phone,
  SmilePlus,
  X,
} from 'lucide-react-native';
import {
  communityRole,
  bytesToHex,
  channelArchived,
  communityLayout,
  ensureBlobPolicy,
  generateSyncRandomBytes,
  createCommunityAudienceRule,
  listCommunities,
  type ChannelMessageAttachment,
  type ChannelMessageEvent,
} from '@mylife/sync';
import { resolveActiveLayout, channelBlockStack } from '../../../data/community-layout-core';
import { buildBlockQueries } from '../../../data/block-queries';
import { BlockStack } from '../../../components/blocks/BlockStack';
import type { BlockHostContext } from '../../../components/blocks/registry';
import { CanvasHost } from '../../../components/canvas/CanvasHost';
import { channelThemeExtras,
  ensureCanvas,
  canvasPostBody,
  createCanvasPostCanvas,
  parseCanvasPostBody,
  addThreadSticker,
  listThreadStickers,
  removeThreadSticker, getCanvasById, getCanvasForSubject ,
  type ThreadSticker
} from '../../../data/canvas-core';
import { HonestNotice } from '../../../components/kit';
import { AudienceBadge } from '../../../components/AudienceRule';
import { PublishSheet } from '../../../components/PublishSheet';
import { AttachmentCard } from '../../../components/AttachmentCard';
import { LinkPreviewCard, isLinkPreviewAttachment } from '../../../components/LinkPreviewCard';
import { avatarImageUri } from '../../../components/Avatar';
import {
  ChannelSegmentedTabs,
  ChatComposer,
  MessageActionsSheet,
  MessageList,
  formatClockTime,
  resolveReactionTap,
  type ChannelSegment,
  type ChatKitMessage,
  type KitSticker,
  type MentionCandidate,
} from '../../../components/chat';
import { formatBytes, type MkColors, MK_RADIUS, shortHex } from '../../../theme/tokens';
import { useAppThemeColors, useCommunityStyleExtras, useMkStyles } from '../../../providers/AppThemeProvider';
import { CommunityThemeProvider } from '../../../providers/CommunityThemeProvider';
import { useMeerkatDatabase } from '../../../providers/DatabaseProvider';
import { useChannel, type ChannelChatItem } from '../../../providers/ChatProvider';
import { useIdentity } from '../../../providers/IdentityProvider';
import { useNode } from '../../../providers/NodeProvider';
import { isSamePerson } from '../../../data/person-view-core';
import { useSync } from '../../../providers/SyncProvider';
import {
  COMMUNITY_MODULE_ID,
  buildCommunityPeerNameMap,
  resolveCommunityAvatarImage,
  resolveCommunityPersona,
  getChannelReadState,
  isChannelPostEvent,
  listChannelPostCards,
  listChannelReactions,
  listCommunityLayoutEvents,
  listMessageAttachmentRows,
  readBoundaryFromReadState,
  maybeRefreshCommunityFeedFromHost,
  syncAutomaticCommunityHistory,
  type ChannelPostCard,
  type MessageReactionGroup,
  type ReadBoundary,
} from '../../../data/community-core';
import { listReactionPackItems, listStickerPackItems, resolvePackReactionDisplay, type PackReactionDisplay } from '../../../data/asset-packs-core';
import { resolveSealedAssetUri } from '../../../data/canvas-assets';
import { LibraryView } from '../../../components/library/LibraryView';
import { getLibrary } from '../../../data/library-store-core';
import { canCurateLibrary, libraryDisplayName } from '../../../data/library-hub-core';
import {
  firstUnreadEventId,
  mapChatItemToKit,
  mentionDisplayNames,
  newestVisibleEventId,
  replySnippet,
} from '../../../data/channel-view-core';
import { type SendMessageOpts } from '../../../data/chat-compose';
import { useChannelLiveLoop } from '../../../data/use-channel-live-loop';
import {
  isCommunityContentReportHidden,
  isCommunityPersonBlocked,
  reportCommunityContent,
} from '../../../data/community-safety';
import { ExpoBlobStore } from '../../../data/expo-blob-store';
import {
  listIncomingPendingRequests,
  type FileRequestRow,
} from '../../../data/file-request-core';
import { isLinkPreviewsEnabled } from '../../../data/db';
import {
  LINK_PREVIEW_MIME_TYPE,
  LINK_PREVIEW_NAME,
  buildLinkPreview,
  encodeLinkPreviewAttachment,
  extractFirstUrl,
} from '../../../data/link-preview';
import { downscaleLinkPreviewImage } from '../../../data/link-preview-image';
import { ensureEffectiveRelayUrl } from '../../../data/effective-relay';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function makeAttachmentId(hash: string): string {
  return `att_${hash.slice(0, 16)}_${Date.now().toString(36)}_${bytesToHex(generateSyncRandomBytes(4))}`;
}

function chatItemKey(item: ChannelChatItem): string {
  return item.kind === 'event' ? item.event.id : item.message.clientId;
}

// Build a sender-generated link-preview attachment for the first URL in `body`,
// or null when the toggle is off, the body has no URL, the fetch/parse fails, or
// the blob write fails. This is the ONLY place a URL is fetched, and it happens
// on the SENDER's device; the encoded preview rides the existing attachment/blob
// pipeline so receivers render from verified local bytes and never fetch. Never
// throws: any failure returns null and the message sends as plain text.
async function buildLinkPreviewAttachment(
  body: string,
  blobStore: ExpoBlobStore,
): Promise<ChannelMessageAttachment | null> {
  const url = extractFirstUrl(body);
  if (!url) return null;
  try {
    const preview = await buildLinkPreview(url, {
      downscaleImage: downscaleLinkPreviewImage,
      fetchImpl: previewFetch as typeof fetch,
    });
    if (!preview) return null;
    const bytes = encodeLinkPreviewAttachment(preview);
    if (!bytes) return null;
    const stored = await blobStore.putLocal(bytes, {
      moduleId: COMMUNITY_MODULE_ID,
      mimeType: LINK_PREVIEW_MIME_TYPE,
    });
    return {
      id: makeAttachmentId(stored.hash),
      blobHash: stored.hash,
      name: LINK_PREVIEW_NAME,
      mimeType: LINK_PREVIEW_MIME_TYPE,
      size: stored.size,
    };
  } catch {
    return null;
  }
}

// The post id of a just-sent root (send results carry the signed event).
function canvasPostIdFromSend(result: { ok: boolean; event?: { postId?: string } }): string | null {
  return result.ok ? result.event?.postId ?? null : null;
}

const EMPTY_REACTIONS: readonly MessageReactionGroup[] = Object.freeze([]);
const EMPTY_STICKERS: readonly KitSticker[] = Object.freeze([]);
const EMPTY_NAMES: readonly string[] = Object.freeze([]);

// The route wraps the channel in the per-community theme boundary so the channel
// screen themes to its community; the tab bar and other tabs stay on the base theme.
export default function ChannelChatRoute() {
  const params = useLocalSearchParams<{ communityId: string; channelId: string }>();
  const db = useMeerkatDatabase();
  // Feature 3: the channel's owner-signed topper policy may carry closed
  // style-axis overrides; they merge over the community theme for THIS
  // channel's subtree only.
  const channelExtras = useMemo(
    () => channelThemeExtras(db, param(params.communityId), param(params.channelId)),
    [db, params.communityId, params.channelId],
  );
  return (
    <CommunityThemeProvider communityId={param(params.communityId)} channelExtras={channelExtras}>
      <ChannelChatScreen />
    </CommunityThemeProvider>
  );
}

function ChannelChatScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const node = useNode();
  const params = useLocalSearchParams<{ communityId: string; channelId: string }>();
  const communityId = param(params.communityId);
  const channelId = param(params.channelId);
  const channel = useChannel(communityId, channelId);
  const { queueFileGrant, recordLocalChange, personLinks } = useSync();
  const [historyNotice, setHistoryNotice] = useState('Looking for verified community history…');
  const partialHistory = channel.partialHistory;
  const refreshChannel = channel.refresh;
  const blobStore = useMemo(() => new ExpoBlobStore(db), [db]);
  const channelAudienceRule = useMemo(() => createCommunityAudienceRule(communityId), [communityId]);

  const [segment, setSegment] = useState<ChannelSegment>('chat');
  // Plan 38 B.1: a kind:'library' channel is a Library | Chat surface (library
  // default), NOT Chat | Posts. libSegment drives that toggle; the library view
  // reuses the same LibraryView the personal hub renders.
  const [libSegment, setLibSegment] = useState<'library' | 'chat'>('library');
  // Incoming file requests this device must approve/decline (owner side). Driven
  // by REAL cm_file_requests rows written by a verified incoming request; never
  // fabricated. Reloaded after every drain and after each approve/decline.
  const [incomingRequests, setIncomingRequests] = useState<FileRequestRow[]>([]);
  // Per-action busy: {id, decision} so an in-flight Decline never makes the
  // Approve button read "Sending…" (and vice versa). Both buttons of the row
  // stay disabled while either action is in flight.
  const [grantBusy, setGrantBusy] = useState<{ id: string; decision: 'approve' | 'decline' } | null>(null);
  const [postDraft, setPostDraft] = useState('');
  const [draft, setDraft] = useState('');
  const [draftAttachments, setDraftAttachments] = useState<ChannelMessageAttachment[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ChannelMessageEvent | null>(null);
  // The unsent compose (body + staged attachments) stashed when entering edit
  // mode, restored on cancel or after the edit lands, so opening an edit never
  // discards a half-written message or a picked attachment.
  const [stashedCompose, setStashedCompose] = useState<{ body: string; attachments: ChannelMessageAttachment[] } | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChannelMessageEvent | null>(null);
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [revisionTick, setRevisionTick] = useState(0);
  const bumpRevisionTick = useCallback(() => setRevisionTick((v) => v + 1), []);
  const [postReactTarget, setPostReactTarget] = useState<ChannelPostCard | null>(null);
  // The read boundary captured on focus (BEFORE the cursor advances) anchors the
  // "New messages" divider; atBottom gates the cursor advance so messages arriving
  // while scrolled up stay unread (Plan 30 read-cursor policy).
  const [readSnapshot, setReadSnapshot] = useState<ReadBoundary | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [safetyRevision, setSafetyRevision] = useState(0);
  const [publishPost, setPublishPost] = useState<ChannelPostCard | null>(null);

  const community = useMemo(
    () => listCommunities(db).find((item) => item.communityId === communityId) ?? null,
    [db, communityId],
  );
  const canPublishPublic = community?.myRole === 'owner' || community?.myRole === 'admin';
  const descriptorChannel = community?.descriptor.channels.find((item) => item.id === channelId) ?? null;
  const title = descriptorChannel?.name ?? channelId;
  const channelIsArchived = descriptorChannel ? channelArchived(descriptorChannel) : false;
  const isLibraryChannel = descriptorChannel?.kind === 'library';
  // Composition Phase 1: a channel whose kind maps to a block stack renders it
  // as its primary surface (Blocks | Chat, mirroring the library pattern). The
  // layout document can override the stack per channel; chat/library kinds
  // return null here and keep their dedicated surfaces.
  const channelKindValue = descriptorChannel?.kind ?? 'chat';
  const composedDocument = useMemo(() => {
    if (!community) return null;
    const active = resolveActiveLayout({
      events: listCommunityLayoutEvents(db, communityId),
      ownerDeviceId: community.descriptor.ownerDeviceId,
      legacyLayout: communityLayout(community.descriptor),
    });
    return active.source === 'layout_document' ? active.document : null;
  }, [db, community, communityId]);
  const channelBlocks = useMemo(
    () => (isLibraryChannel ? null : channelBlockStack(composedDocument, channelId, channelKindValue)),
    [composedDocument, channelId, channelKindValue, isLibraryChannel],
  );
  // Plan 56 C1: a 'canvas' channel is the Commons (4.1); a 'page' channel is a
  // promoted member page bound by the channel id (4.4). Both render the real
  // CanvasHost as the primary surface with chat one tap away. The Commons
  // canvas is owner-created lazily on the owner's own device; members see the
  // honest not-set-up state until it syncs.
  const isCanvasChannel = channelKindValue === 'canvas';
  const isPageChannel = channelKindValue === 'page';
  const [canvasRevision, setCanvasRevision] = useState(0);
  const channelCanvas = useMemo(() => {
    void canvasRevision;
    if (!community) return null;
    if (isCanvasChannel) {
      const existing = getCanvasForSubject(db, communityId, 'commons', channelId);
      if (existing) return existing;
      if (community.descriptor.ownerDeviceId === identity.publicKey) {
        try {
          const created = ensureCanvas(db, identity, { communityId, kind: 'commons', subjectId: channelId }, recordLocalChange);
          return created;
        } catch {
          return null;
        }
      }
      return null;
    }
    if (isPageChannel) return getCanvasById(db, channelId);
    return null;
  }, [db, community, communityId, channelId, isCanvasChannel, isPageChannel, identity, recordLocalChange, canvasRevision]);
  // The channel topper (4.2): a decoratable header canvas above the message
  // list on ANY channel, bounded height. Renders only when one exists.
  const topperCanvas = useMemo(() => {
    void canvasRevision;
    if (!community || isCanvasChannel || isPageChannel) return null;
    return getCanvasForSubject(db, communityId, 'channel_topper', channelId);
  }, [db, community, communityId, channelId, isCanvasChannel, isPageChannel, canvasRevision]);
  const [blockSegment, setBlockSegment] = useState<'blocks' | 'chat'>('blocks');
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
      queries: buildBlockQueries(db, community.descriptor),
      onOpenChannel: (target: string) => {
        router.push({ pathname: '/channel/[communityId]/[channelId]', params: { communityId, channelId: target } });
      },
      onOpenFiles: () => {
        router.push({ pathname: '/files/[communityId]', params: { communityId } });
      },
      surfaceChannelId: channelId,
      revision: channel.messages.length,
    };
  }, [db, community, communityId, channelId, router, channel.messages.length]);
  const libraryConfig = useMemo(
    () => (isLibraryChannel ? getLibrary(db, channelId) : null),
    [isLibraryChannel, db, channelId],
  );
  const libraryName = useMemo(
    () => (libraryConfig ? libraryDisplayName(db, libraryConfig) : title),
    [libraryConfig, db, title],
  );
  const libraryCanCurate = useMemo(
    () => (libraryConfig ? canCurateLibrary(db, identity.publicKey, communityId, channelId) : false),
    [libraryConfig, db, identity.publicKey, communityId, channelId],
  );
  // Which panes render: a library channel is Library | Chat (no Posts); a chat
  // channel keeps the existing Chat | Posts.
  const canvasSurfaceActive = isCanvasChannel || isPageChannel;
  const chatHidden = canvasSurfaceActive
    ? true
    : isLibraryChannel
      ? libSegment !== 'chat'
      : channelBlocks
        ? blockSegment !== 'chat'
        : segment !== 'chat';
  const postsHidden = canvasSurfaceActive || isLibraryChannel || channelBlocks !== null || segment !== 'posts';

  const isEventHiddenBySafety = useCallback(
    (event: ChannelMessageEvent): boolean => {
      if (isCommunityPersonBlocked(db, communityId, event.authorDeviceId)) return true;
      if (isCommunityContentReportHidden(db, communityId, 'message', event.id)) return true;
      if (event.postId && isCommunityContentReportHidden(db, communityId, 'post', event.postId)) return true;
      return false;
    },
    [db, communityId],
  );

  const postCards = useMemo(
    () => {
      void channel.messages;
      void safetyRevision;
      return listChannelPostCards(db, communityId, channelId).filter((post) => !isEventHiddenBySafety(post.root));
    },
    [db, communityId, channelId, channel.messages, isEventHiddenBySafety, safetyRevision],
  );
  const chatMessages = useMemo(
    () => {
      void safetyRevision;
      return channel.messages.filter((item) => (
        item.kind === 'local' || (!isChannelPostEvent(item.event) && !isEventHiddenBySafety(item.event))
      ));
    },
    [channel.messages, isEventHiddenBySafety, safetyRevision],
  );

  // Friendly community name for a device id, built ONCE per render from trusted
  // local sources only: descriptor members, paired devices, and verified
  // member-signed community profile rows. A name is never proof of identity.
  const peerNames = useMemo(() => {
    return community ? buildCommunityPeerNameMap(db, community.communityId) : new Map<string, string>();
  }, [community, db]);

  // The raw community display name (no "You" substitution): used both as the
  // mention-autocomplete label and the highlight needle, so a signed mention and
  // its render-pass highlight stay consistent.
  const rawPeerName = useCallback(
    (deviceId: string): string => peerNames.get(deviceId) ?? shortHex(deviceId),
    [peerNames],
  );

  // Plan 52 P4: verified person links, so a message authored on one of YOUR
  // OWN linked devices reads as you here rather than as a separate member.
  const personLinkMap = useMemo(
    () => (community ? personLinks(community.communityId) : new Map<string, string>()),
    [community, personLinks],
  );
  const resolvePeerName = useCallback(
    (deviceId: string): string => {
      if (isSamePerson(personLinkMap, deviceId, identity.publicKey)) {
        const communityName = peerNames.get(deviceId);
        return communityName ? `You as ${communityName}` : 'You';
      }
      return peerNames.get(deviceId) ?? shortHex(deviceId);
    },
    [identity.publicKey, peerNames, personLinkMap],
  );

  // AC-6: a member's signed community avatar as a data URI, image -> initial -> ?
  // precedence lives in the chat kit. Only a signature-verified v2 profile yields
  // an image (resolveCommunityAvatarImage filters through verify); db is read live
  // so a drained profile update re-resolves on the next channel refresh.
  const resolveAvatarUri = useCallback(
    (deviceId: string): string | null =>
      avatarImageUri(resolveCommunityAvatarImage(db, communityId, deviceId)),
    [db, communityId],
  );

  const mentionCandidates = useMemo<MentionCandidate[]>(() => {
    const out: MentionCandidate[] = [];
    for (const [deviceId, name] of peerNames) {
      if (deviceId === identity.publicKey) continue;
      out.push({ deviceId, name });
    }
    return out;
  }, [peerNames, identity.publicKey]);

  // Verified, safety-filtered reaction groups keyed by the reacted-to event id.
  // Recomputed whenever the channel refreshes (channel.messages changes ref) so a
  // local echo and a drained remote reaction both surface with no fake chip.
  const reactionsByParent = useMemo(
    () => {
      void channel.messages;
      void safetyRevision;
      return listChannelReactions(db, communityId, channelId, identity.publicKey);
    },
    [db, communityId, channelId, channel.messages, identity.publicKey, safetyRevision],
  );

  // Plan 56 feature 5: pack-token reactions render as a verified glyph, a
  // decrypted image, or the honest :slug: fallback (never the raw token, never
  // a fabricated image). Image URIs decrypt asynchronously into a local cache.
  const [packImageUris, setPackImageUris] = useState<ReadonlyMap<string, string>>(new Map());
  const packDisplays = useMemo(() => {
    void channel.messages;
    const map = new Map<string, PackReactionDisplay>();
    for (const groups of reactionsByParent.values()) {
      for (const group of groups) {
        if (!group.emoji.startsWith('mkpack:') || map.has(group.emoji)) continue;
        const display = resolvePackReactionDisplay(db, communityId, group.emoji);
        if (display) map.set(group.emoji, display);
      }
    }
    return map;
  }, [db, communityId, reactionsByParent, channel.messages]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const [token, display] of packDisplays) {
        if (display.kind !== 'asset' || packImageUris.has(token)) continue;
        const uri = await resolveSealedAssetUri({
          db, store: node.store, identity, communityId,
          asset: display.asset, authorDevice: display.uploadedBy,
        });
        if (cancelled) return;
        if (uri) setPackImageUris((prev) => new Map(prev).set(token, uri));
      }
    })();
    return () => { cancelled = true; };
  }, [packDisplays, packImageUris, db, node.store, identity, communityId]);

  // Custom-emoji picker items (verified pack items; sealed images resolve into
  // the same uri cache; unresolved ones show their :slug: label).
  const packPickerItems = useMemo(() => {
    void channel.messages;
    return listReactionPackItems(db, communityId).map(({ token, item }) => ({
      token,
      label: `:${item.slug}:`,
      glyph: item.glyph,
      imageUri: packImageUris.get(token) ?? null,
    }));
  }, [db, communityId, channel.messages, packImageUris]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const entry of listReactionPackItems(db, communityId)) {
        if (!entry.item.asset || packImageUris.has(entry.token)) continue;
        const uri = await resolveSealedAssetUri({
          db, store: node.store, identity, communityId,
          asset: entry.item.asset, authorDevice: entry.item.uploadedBy,
        });
        if (cancelled) return;
        if (uri) setPackImageUris((prev) => new Map(prev).set(entry.token, uri));
      }
    })();
    return () => { cancelled = true; };
  }, [db, node.store, identity, communityId, packPickerItems.length, packImageUris]);

  const decorateReactions = useCallback(
    (groups: readonly MessageReactionGroup[]): readonly MessageReactionGroup[] => groups.map((group) => {
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

  // Feature 12: the sticker layer. Verified, receiver-dialed stickers per
  // message; sealed pack-image stickers decrypt into the shared uri cache.
  const QUICK_STICKERS: readonly string[] = ['⭐', '🔥', '🌸', '🦫', '💯', '🎉'];
  const stickersByMessage = useMemo(() => {
    void channel.messages;
    void revisionTick;
    if (!community) return new Map<string, ThreadSticker[]>();
    return listThreadStickers(db, communityId, channelId, community.descriptor);
  }, [db, communityId, channelId, community, channel.messages, revisionTick]);

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
      for (const entry of listStickerPackItems(db, communityId)) {
        const key = `pack:${entry.packId}:${entry.item.slug}`;
        if (entry.item.asset && !stickerUris.has(key)) {
          wanted.push({ key, asset: entry.item.asset, author: entry.item.uploadedBy });
        }
      }
      for (const entry of wanted) {
        const uri = await resolveSealedAssetUri({
          db, store: node.store, identity, communityId,
          asset: entry.asset, authorDevice: entry.author,
        });
        if (cancelled) return;
        if (uri) setStickerUris((prev) => new Map(prev).set(entry.key, uri));
      }
    })();
    return () => { cancelled = true; };
  }, [db, node.store, identity, communityId, stickersByMessage, stickerUris]);

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
      mine: sticker.authorDevice === identity.publicKey,
      removable: sticker.authorDevice === identity.publicKey || isCuratorRole,
    }));
  }, [stickersByMessage, stickerUris, identity.publicKey, isCuratorRole]);

  const stickerChoices = useMemo(() => {
    void channel.messages;
    const choices: Array<{ key: string; label: string; glyph?: string | null; imageUri?: string | null }> = [];
    for (const glyph of QUICK_STICKERS) choices.push({ key: `glyph:${glyph}`, label: glyph, glyph });
    for (const entry of listStickerPackItems(db, communityId)) {
      const key = `pack:${entry.packId}:${entry.item.slug}`;
      choices.push({
        key,
        label: `:${entry.item.slug}:`,
        glyph: entry.item.glyph,
        imageUri: stickerUris.get(key) ?? null,
      });
    }
    return choices;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, communityId, channel.messages, stickerUris]);

  const stickMessage = useCallback((messageId: string, choiceKey: string) => {
    try {
      const count = stickersByMessage.get(messageId)?.length ?? 0;
      // Deterministic scatter within the row; the signed node stores real x/y.
      const x = 12 + (count * 42) % 220;
      const y = -6 + (count % 3) * 14;
      const rotation = ((count * 17) % 31) - 15;
      if (choiceKey.startsWith('glyph:')) {
        addThreadSticker(db, identity, {
          communityId, channelId, messageId, emoji: choiceKey.slice(6), x, y, rotation,
        }, recordLocalChange);
      } else {
        const [, packId, slug] = choiceKey.split(':');
        const entry = listStickerPackItems(db, communityId)
          .find((candidate) => candidate.packId === packId && candidate.item.slug === slug);
        if (!entry) return;
        if (entry.item.glyph) {
          addThreadSticker(db, identity, {
            communityId, channelId, messageId, emoji: entry.item.glyph, x, y, rotation,
          }, recordLocalChange);
        } else if (entry.item.asset) {
          addThreadSticker(db, identity, {
            communityId, channelId, messageId, asset: entry.item.asset, x, y, rotation,
          }, recordLocalChange);
        }
      }
      bumpRevisionTick();
    } catch (error) {
      Alert.alert('Sticker', error instanceof Error ? error.message : 'Could not stick that here.');
    }
  }, [db, identity, communityId, channelId, stickersByMessage, recordLocalChange, bumpRevisionTick]);

  const onPressSticker = useCallback((nodeId: string) => {
    Alert.alert('Remove sticker?', 'This removes the sticker for everyone once a sync connects.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          try {
            removeThreadSticker(db, identity, communityId, channelId, nodeId, recordLocalChange);
            bumpRevisionTick();
          } catch (error) {
            Alert.alert('Sticker', error instanceof Error ? error.message : 'Could not remove that sticker.');
          }
        },
      },
    ]);
  }, [db, identity, communityId, channelId, recordLocalChange, bumpRevisionTick]);

  const eventsById = useMemo(() => {
    const map = new Map<string, ChannelMessageEvent>();
    for (const item of chatMessages) {
      if (item.kind === 'event') map.set(item.event.id, item.event);
    }
    return map;
  }, [chatMessages]);

  // The sorted signed CHAT events (drops local pending/failed sends + posts) drive
  // the "New messages" divider anchor, which lives in the chat view.
  const chatEventList = useMemo(
    () => chatMessages.flatMap((item) => (item.kind === 'event' ? [item.event] : [])),
    [chatMessages],
  );
  const firstUnreadId = useMemo(
    () => firstUnreadEventId(chatEventList, readSnapshot, identity.publicKey),
    [chatEventList, readSnapshot, identity.publicKey],
  );
  // The read CURSOR advance gates on the newest visible event across chat AND
  // posts, so a posts-only channel still clears its unread cursor (M1). Reactions
  // are already excluded from channel.messages; safety-hidden events are filtered.
  const newestVisibleId = useMemo(
    () => {
      void safetyRevision;
      return newestVisibleEventId(channel.messages, isEventHiddenBySafety);
    },
    [channel.messages, isEventHiddenBySafety, safetyRevision],
  );

  const itemsById = useMemo(() => {
    const map = new Map<string, ChannelChatItem>();
    for (const item of chatMessages) map.set(chatItemKey(item), item);
    return map;
  }, [chatMessages]);

  const mentionNamesById = useMemo(() => {
    const map = new Map<string, readonly string[]>();
    for (const item of chatMessages) {
      if (item.kind !== 'event') continue;
      const names = mentionDisplayNames(item.event, rawPeerName);
      if (names.length > 0) map.set(item.event.id, names);
    }
    return map;
  }, [chatMessages, rawPeerName]);

  const resolveNameColor = useCallback(
    (deviceId: string) => resolveCommunityPersona(db, communityId, deviceId).nameColor,
    [db, communityId],
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
    () => chatMessages.map((item) => mapChatItemToKit(item, {
      selfDeviceId: identity.publicKey,
      eventsById,
      resolveReplyName: resolvePeerName,
      resolveNameColor,
      resolveBubbleShape,
    })),
    [chatMessages, eventsById, identity.publicKey, resolvePeerName, resolveNameColor, resolveBubbleShape],
  );

  const reloadIncoming = useCallback(() => {
    setIncomingRequests(listIncomingPendingRequests(db, communityId));
  }, [db, communityId]);

  // On focus: reload incoming requests AND snapshot the read boundary BEFORE the
  // cursor advances, so the "New messages" divider anchors at the last visit.
  useFocusEffect(useCallback(() => {
    reloadIncoming();
    setReadSnapshot(readBoundaryFromReadState(getChannelReadState(db, communityId, channelId)));
  }, [reloadIncoming, db, communityId, channelId]));

  // Advance the read cursor only while the newest message is on screen: on focus
  // (atBottom starts true), when a live-loop arrival lands while at the bottom, and
  // when the reader scrolls back down. Arrivals while scrolled up stay unread.
  useEffect(() => {
    if (atBottom && newestVisibleId) channel.markReadLatest();
    // markReadLatest reads the provider's latest events; advancing only on
    // atBottom/newestVisibleId change (not every render) is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atBottom, newestVisibleId]);

  // Plan 30 Phase 3: the focused-screen live loop. It polls the SAME honest
  // runForegroundDrain the removed manual Refresh button used to, on an adaptive
  // cadence, and only a real applied>0 tick refreshes the channel + reactions +
  // incoming requests. It is dormant (zero network) with no relay and NEVER shows
  // a connected/live status. `noteSend` re-enters the hot window after a send.
  const { noteSend } = useChannelLiveLoop({
    communityId,
    channelId,
    onApplied: () => {
      channel.refresh();
      reloadIncoming();
    },
  });

  const runAutomaticHistory = useCallback(async (force = false): Promise<void> => {
    if (!partialHistory) return;
    setHistoryNotice('Looking for verified community history…');
    let result;
    try {
      result = await syncAutomaticCommunityHistory(db, identity, communityId, {
        relayUrl: await ensureEffectiveRelayUrl(db),
        force,
        recordLocalChange: (table, operation, rowId, data) => recordLocalChange(table, operation, rowId, data),
      });
    } catch {
      // A thrown lookup (not a typed fallback) must not strand the notice on
      // "Looking for…" forever or die as an unhandled rejection.
      setHistoryNotice('History lookup failed on this device. Use Community details, Import history for the manual fallback.');
      return;
    }
    if (result.outcome === 'imported') {
      setHistoryNotice(result.applied > 0
        ? `Verified and imported ${result.applied} older history event${result.applied === 1 ? '' : 's'}.`
        : 'Automatic history host verified. This device is caught up.');
      refreshChannel();
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
    setHistoryNotice(`${reason} Use Community details, Import history for the manual fallback.`);
  }, [communityId, db, identity, partialHistory, recordLocalChange, refreshChannel]);

  useEffect(() => {
    if (!partialHistory) return undefined;
    void runAutomaticHistory();
    const timer = setInterval(() => { void runAutomaticHistory(); }, 5 * 60 * 1_000);
    return () => clearInterval(timer);
  }, [partialHistory, runAutomaticHistory]);

  // Plan 57 W3: when this community carries an attached server in its signed
  // descriptor, run one throttled pull from it on open. Applied counts are the
  // real engine values; a no-host community and a throttled attempt are cheap
  // no-ops, and nothing here claims a pull that did not happen.
  useEffect(() => {
    let cancelled = false;
    void maybeRefreshCommunityFeedFromHost(db, identity, communityId)
      .then((outcome) => {
        if (!cancelled && outcome.ran && outcome.result.applied > 0) refreshChannel();
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [communityId, db, identity, refreshChannel]);

  const handleGrant = useCallback((requestId: string, decision: 'approve' | 'decline') => {
    void (async () => {
      setGrantBusy({ id: requestId, decision });
      try {
        const result = await queueFileGrant(requestId, decision);
        if (!result.ok) {
          const reasonText = result.reason === 'owner_no_longer_has_file'
            ? 'You no longer have this file on this device.'
            : result.reason === 'no_relay'
              ? 'Open Me > Advanced connection before sending files.'
              : result.reason === 'not_paired'
                ? 'You can only send to a trusted member.'
                : result.reason === 'park_failed'
                  ? 'Could not reach the connection server. Try again when online.'
                  : 'Could not complete that request.';
          Alert.alert(decision === 'approve' ? 'Could not send' : 'Could not decline', reasonText);
        }
      } catch (error) {
        // queueFileGrant can throw (blob reads inside buildFileGrant); without
        // this catch the rejection vanished and the tap looked like a no-op.
        Alert.alert(
          decision === 'approve' ? 'Could not send' : 'Could not decline',
          error instanceof Error ? error.message : 'Could not complete that request.',
        );
      } finally {
        setGrantBusy(null);
        reloadIncoming();
      }
    })();
  }, [queueFileGrant, reloadIncoming]);

  const pickAttachment = useCallback(() => {
    if (editingEvent) return;
    void (async () => {
      setAttachmentBusy(true);
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
          multiple: true,
        });
        if (result.canceled) return;

        const policy = ensureBlobPolicy(db, COMMUNITY_MODULE_ID);
        const attachments: ChannelMessageAttachment[] = [];
        for (const asset of result.assets) {
          const info = await FileSystem.getInfoAsync(asset.uri);
          if (!info.exists || info.isDirectory) continue;

          const estimatedSize = asset.size ?? info.size;
          if (estimatedSize > policy.maxBlobSizeBytes) {
            Alert.alert(
              'Attachment too large',
              `${asset.name} is ${formatBytes(estimatedSize)}. This channel is capped at ${formatBytes(policy.maxBlobSizeBytes)} per blob.`,
            );
            continue;
          }

          const base64 = asset.base64 ?? await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const bytes = decodeBase64(base64);
          if (bytes.length > policy.maxBlobSizeBytes) {
            Alert.alert(
              'Attachment too large',
              `${asset.name} is ${formatBytes(bytes.length)}. This channel is capped at ${formatBytes(policy.maxBlobSizeBytes)} per blob.`,
            );
            continue;
          }

          const stored = await blobStore.putLocal(bytes, {
            moduleId: COMMUNITY_MODULE_ID,
            mimeType: asset.mimeType ?? 'application/octet-stream',
          });
          attachments.push({
            id: makeAttachmentId(stored.hash),
            blobHash: stored.hash,
            name: asset.name,
            mimeType: stored.mimeType,
            size: stored.size,
          });
        }

        if (attachments.length > 0) {
          setDraftAttachments((current) => [...current, ...attachments]);
        }
      } catch (error) {
        Alert.alert('Attachment failed', error instanceof Error ? error.message : String(error));
      } finally {
        setAttachmentBusy(false);
      }
    })();
  }, [blobStore, db, editingEvent]);

  const removeDraftAttachment = useCallback((id: string) => {
    setDraftAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }, []);

  // Leaving edit mode restores the compose (body + attachments) stashed on entry.
  const restoreStashedCompose = useCallback(() => {
    setDraft(stashedCompose?.body ?? '');
    setDraftAttachments(stashedCompose?.attachments ?? []);
    setStashedCompose(null);
    setEditingEvent(null);
  }, [stashedCompose]);

  // Async so the composer's send latch releases when this settles, letting a
  // failed edit (which leaves the field unchanged) be retried.
  const submitMessage = useCallback(async (body: string, mentions: string[]): Promise<void> => {
    if (editingEvent) {
      const result = channel.edit(editingEvent, body);
      if (result.ok) restoreStashedCompose();
      return;
    }
    const hasReply = replyTarget !== null;
    const opts: SendMessageOpts | undefined = hasReply || mentions.length > 0
      ? {
        mentions: mentions.length > 0 ? mentions : undefined,
        parentId: replyTarget?.id,
        // Inherit the post thread context when replying inside a post (a plain
        // chat reply leaves both undefined and stays a top-level chat message).
        postId: replyTarget?.postId,
        branchId: replyTarget?.branchId,
      }
      : undefined;
    // Sender-generated link preview (Plan 32 T3.2): when the toggle is on and the
    // body has a URL, THIS device fetches the page and appends a preview
    // attachment riding the existing blob pipeline. Off / no-URL / failure returns
    // null instantly (no fetch, no retry) and the message sends as plain text.
    const previewAttachment = isLinkPreviewsEnabled(db)
      ? await buildLinkPreviewAttachment(body, blobStore)
      : null;
    const attachments = previewAttachment
      ? [...draftAttachments, previewAttachment]
      : draftAttachments;
    channel.send(body, attachments, opts);
    // Re-enter the 5s hot window so the loop polls fast for the peer's reply.
    noteSend();
    // A send is ALWAYS captured as a local (pending or failed) bubble, so clear
    // the composer either way; the empty transition also releases the composer's
    // single-send latch for the next message. A failed send stays visible as its
    // own failed bubble, never a fabricated delivery.
    setDraft('');
    setDraftAttachments([]);
    setReplyTarget(null);
  }, [channel, db, blobStore, draftAttachments, editingEvent, replyTarget, restoreStashedCompose, noteSend]);

  const submitPost = useCallback(() => {
    const body = postDraft.trim();
    if (!body) return;
    const result = channel.post(body);
    if (result.ok) {
      setPostDraft('');
    }
  }, [channel, postDraft]);

  // 4.5: a canvas post. The canvas exists FIRST (author-signed, kind 'post');
  // the post root carries only the deterministic token, and the thread renders
  // the canvas through CanvasHost. Opens the thread so the author decorates
  // immediately.
  const submitCanvasPost = useCallback(() => {
    try {
      const canvas = createCanvasPostCanvas(db, identity, communityId, recordLocalChange);
      const result = channel.post(canvasPostBody(canvas.id));
      if (result.ok) {
        router.push({
          pathname: '/post/[communityId]/[channelId]/[postId]',
          params: { communityId, channelId, postId: canvasPostIdFromSend(result) ?? '' },
        });
      }
    } catch (error) {
      Alert.alert('Canvas post', error instanceof Error ? error.message : 'Could not create a canvas post.');
    }
  }, [db, identity, communityId, channelId, channel, recordLocalChange, router]);

  const startEdit = useCallback((event: ChannelMessageEvent) => {
    // Stash the in-progress compose ONCE (don't clobber it when hopping edits).
    setStashedCompose((prev) => prev ?? { body: draft, attachments: draftAttachments });
    setReplyTarget(null);
    setEditingEvent(event);
    setDraft(event.body);
    setDraftAttachments([]);
    setSegment('chat');
  }, [draft, draftAttachments]);

  const cancelEdit = useCallback(() => {
    restoreStashedCompose();
  }, [restoreStashedCompose]);

  const beginReply = useCallback((event: ChannelMessageEvent) => {
    // Leaving edit mode via Reply restores the stashed compose first, so the
    // reply builds on the user's real draft, not the edit text; a reply started
    // while NOT editing keeps whatever is already typed.
    if (editingEvent) restoreStashedCompose();
    setReplyTarget(event);
    setSegment('chat');
  }, [editingEvent, restoreStashedCompose]);

  const confirmDelete = useCallback((event: ChannelMessageEvent) => {
    Alert.alert(
      'Delete message?',
      'This records a deletion for members who receive the update and removes the local message key on this device. Older community history may update after a later history refresh.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const result = channel.delete(event);
            if (result.ok && editingEvent?.id === event.id) {
              setEditingEvent(null);
              setDraft('');
            }
          },
        },
      ],
    );
  }, [channel, editingEvent]);

  const reportMessage = useCallback((event: ChannelMessageEvent) => {
    const author = resolvePeerName(event.authorDeviceId);
    Alert.alert(
      'Report and hide?',
      'This hides the message on this device and adds it to local owner review. It does not remove it for other members.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            reportCommunityContent(db, {
              communityId,
              channelId,
              targetKind: 'message',
              targetId: event.id,
              targetAuthorDeviceId: event.authorDeviceId,
              targetLabel: `Message from ${author}`,
              reason: 'Reported from channel',
            });
            setSafetyRevision((value) => value + 1);
          },
        },
      ],
    );
  }, [db, communityId, channelId, resolvePeerName]);

  const reportPost = useCallback((post: ChannelPostCard) => {
    const author = resolvePeerName(post.root.authorDeviceId);
    Alert.alert(
      'Report and hide post?',
      'This hides the post on this device and adds it to local owner review. Replies stay hidden with the post.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            reportCommunityContent(db, {
              communityId,
              channelId,
              targetKind: 'post',
              targetId: post.postId,
              targetAuthorDeviceId: post.root.authorDeviceId,
              targetLabel: `Post from ${author}`,
              reason: 'Reported from channel',
            });
            setSafetyRevision((value) => value + 1);
          },
        },
      ],
    );
  }, [db, communityId, channelId, resolvePeerName]);

  const openPost = useCallback((postId: string) => {
    router.push({
      pathname: '/post/[communityId]/[channelId]/[postId]',
      params: { communityId, channelId, postId },
    });
  }, [router, communityId, channelId]);

  const toggleReaction = useCallback((eventId: string, emoji: string, postId?: string) => {
    // Archived channels are read-only: existing reaction chips stay visible as
    // preserved content, but no tap may write a new react/remove event.
    if (channelIsArchived) return;
    const groups = reactionsByParent.get(eventId) ?? EMPTY_REACTIONS;
    const action = resolveReactionTap(groups, emoji);
    if (action.action === 'remove') channel.removeReaction(action.myEventId);
    else channel.react({ eventId, postId }, action.emoji);
  }, [reactionsByParent, channel, channelIsArchived]);

  const onPressReaction = useCallback(
    (id: string, emoji: string) => toggleReaction(id, emoji),
    [toggleReaction],
  );

  const onLongPressMessage = useCallback((id: string) => {
    const item = itemsById.get(id);
    if (!item) return;
    // A local send with no body has no available action; skip the empty sheet.
    if (item.kind === 'local' && item.message.body.trim().length === 0) return;
    setActionTargetId(id);
  }, [itemsById]);

  const getReactions = useCallback(
    (id: string): readonly MessageReactionGroup[] => decorateReactions(reactionsByParent.get(id) ?? EMPTY_REACTIONS),
    [reactionsByParent, decorateReactions],
  );

  const getMentionNames = useCallback(
    (id: string): readonly string[] => mentionNamesById.get(id) ?? EMPTY_NAMES,
    [mentionNamesById],
  );

  const renderAttachments = useCallback((kit: ChatKitMessage) => {
    const item = itemsById.get(kit.id);
    if (!item) return null;
    if (item.kind === 'event') {
      const attachments = item.event.attachments;
      if (!attachments || attachments.length === 0) return null;
      const messageEvent = item.event;
      return (
        <View style={styles.attachmentsList}>
          {attachments.map((attachment) => (
            isLinkPreviewAttachment(attachment) ? (
              <LinkPreviewCard
                key={attachment.id}
                blobHash={attachment.blobHash}
                fallback={<AttachmentCard attachment={attachment} event={messageEvent} />}
              />
            ) : (
              <AttachmentCard key={attachment.id} attachment={attachment} event={messageEvent} />
            )
          ))}
        </View>
      );
    }
    const attachments = item.message.attachments;
    if (!attachments || attachments.length === 0) return null;
    // A pending own message's link-preview attachment is hidden here: it is a
    // decoration that appears on the reconciled signed event a beat later, so we
    // never synthesize a fake event just to render it while sending.
    const visibleLocal = attachments.filter((attachment) => !isLinkPreviewAttachment(attachment));
    if (visibleLocal.length === 0) return null;
    return (
      <View style={styles.attachmentsList}>
        {visibleLocal.map((attachment) => (
          <View key={attachment.id} style={styles.localAttachmentRow}>
            <Text style={styles.localAttachmentName} numberOfLines={1}>{attachment.name}</Text>
            <Text style={styles.localAttachmentMeta}>{formatBytes(attachment.size)}</Text>
          </View>
        ))}
      </View>
    );
  }, [itemsById, styles]);

  // Navigation from the overflow menu is QUEUED and flushed only after the menu
  // Modal has fully dismissed (onDismiss on iOS, the visibility effect on
  // Android): pushing a route while an RN Modal is mid-dismissal is the freeze
  // class the earlier sweeps hardened everywhere else.
  const overflowPendingRef = useRef<(() => void) | null>(null);
  const flushOverflowAction = useCallback(() => {
    const fn = overflowPendingRef.current;
    overflowPendingRef.current = null;
    fn?.();
  }, []);
  useEffect(() => {
    if (!overflowOpen && Platform.OS !== 'ios') flushOverflowAction();
  }, [overflowOpen, flushOverflowAction]);

  const openFiles = useCallback(() => {
    overflowPendingRef.current = () => {
      router.push({ pathname: '/files/[communityId]', params: { communityId } });
    };
    setOverflowOpen(false);
  }, [router, communityId]);

  const openCommunityDetails = useCallback(() => {
    overflowPendingRef.current = () => {
      router.push({ pathname: '/community/[communityId]', params: { communityId } });
    };
    setOverflowOpen(false);
  }, [router, communityId]);

  // Deep links, relaunch restores, and entitlement-gate replaces can make this
  // the only route on the stack; back then needs a real destination.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else if (community) router.replace({ pathname: '/community/[communityId]', params: { communityId } });
    else router.replace('/communities');
  }, [router, community, communityId]);

  // Copy is invoked from the actions sheet AFTER its dismissal; a rejected
  // clipboard write renders an honest alert instead of vanishing.
  const copyBody = useCallback((body: string) => {
    Clipboard.setStringAsync(body).catch(() => {
      Alert.alert('Copy', 'Could not copy the text.');
    });
  }, []);

  if (!community || !descriptorChannel) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.missingTitle}>Channel unavailable</Text>
        <HonestNotice text="This device does not have the community details needed to open that channel. Nothing is loaded from a fallback server." />
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

  const actionItem = actionTargetId ? itemsById.get(actionTargetId) : undefined;
  const actionEvent = actionItem?.kind === 'event' ? actionItem.event : null;
  const actionBody = actionEvent?.body ?? (actionItem?.kind === 'local' ? actionItem.message.body : '');
  const actionIsMine = actionEvent ? actionEvent.authorDeviceId === identity.publicKey : false;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to communities"
          onPress={goBack}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <ArrowLeft size={20} color={c.text} strokeWidth={1.9} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.channelName} numberOfLines={1}>#{title}</Text>
          <Text style={styles.communityName} numberOfLines={1}>{community.descriptor.name}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Join voice room"
          onPress={() => router.push({
            pathname: '/room/[communityId]/[channelId]',
            params: { communityId, channelId },
          })}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Phone size={18} color={c.textSecondary} strokeWidth={1.9} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Channel options"
          accessibilityState={{ expanded: overflowOpen }}
          onPress={() => setOverflowOpen(true)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <MoreVertical size={18} color={c.textSecondary} strokeWidth={1.9} />
        </Pressable>
      </View>

      {/* AC-6 / NC-4: exactly ONE audience label on the channel surface, always
          visible (it replaces the per-message badges and the composer summary). */}
      <View style={styles.audienceLine}>
        <AudienceBadge rule={channelAudienceRule} />
        <Text style={styles.audienceText} numberOfLines={1}>{channelAudienceRule.explanation}</Text>
      </View>

      {channelIsArchived ? (
        // Plan 38 Phase 2: an archived channel keeps its content but takes no
        // new messages or posts here (composers hidden below). Parity-locked copy.
        <HonestNotice text="Archived channel. Content is preserved and read-only here." />
      ) : null}

      {topperCanvas && community ? (
        // Plan 56 C1 (4.2): the channel topper, a decoratable header canvas
        // above the message list. Bounded height; structure layer by default.
        <CanvasHost community={community} canvas={topperCanvas} maxHeight={180} />
      ) : null}

      {(isCanvasChannel || isPageChannel) && community ? (
        channelCanvas ? (
          <ScrollView style={styles.chatArea}>
            <CanvasHost community={community} canvas={channelCanvas} />
          </ScrollView>
        ) : (
          <View style={styles.chatArea}>
            <HonestNotice
              text={isCanvasChannel
                ? 'The owner has not set up this canvas on your device yet. It arrives when a sync connects.'
                : 'This page is not on this device yet. It arrives when a sync connects with a member who has it.'}
            />
          </View>
        )
      ) : null}

      {isLibraryChannel ? (
        <ChannelSegmentedTabs
          value={libSegment === 'library' ? 'chat' : 'posts'}
          onChange={(v) => setLibSegment(v === 'chat' ? 'library' : 'chat')}
          chatLabel="Library"
          postsLabel="Chat"
        />
      ) : (isCanvasChannel || isPageChannel) ? null : channelBlocks ? (
        // Composition Phase 1: a block-backed kind renders its stack as the
        // primary surface, with chat one tap away (library-channel pattern).
        <ChannelSegmentedTabs
          value={blockSegment === 'blocks' ? 'chat' : 'posts'}
          onChange={(v) => setBlockSegment(v === 'chat' ? 'blocks' : 'chat')}
          chatLabel={title}
          postsLabel="Chat"
        />
      ) : (
        <ChannelSegmentedTabs value={segment} onChange={setSegment} />
      )}

      {channelBlocks && blockCtx && !isLibraryChannel && blockSegment === 'blocks' ? (
        <ScrollView style={styles.chatArea}>
          <BlockStack
            nodes={channelBlocks}
            declaredCapabilities={composedDocument?.capabilities ?? []}
            ctx={blockCtx}
          />
        </ScrollView>
      ) : null}

      {isLibraryChannel && libSegment === 'library' ? (
        libraryConfig ? (
          <LibraryView
            channelId={channelId}
            workspaceId={communityId}
            config={libraryConfig}
            name={libraryName}
            canCurate={libraryCanCurate}
          />
        ) : (
          <View style={styles.chatArea}>
            <HonestNotice text="This library has not finished setting up on this device yet. Sync with the owner to load it." />
          </View>
        )
      ) : null}

      {/* Both segment views stay mounted (visibility toggled) so switching to
          Posts and back keeps the composer's in-progress draft + accrued mentions
          and the chat scroll position. */}
      <View style={[styles.chatArea, chatHidden && styles.hidden]}>
          {channel.error ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear channel error"
              onPress={channel.clearError}
              style={styles.errorPanel}
            >
              <Text style={styles.errorTitle}>Send failed</Text>
              <Text style={styles.errorText}>{channel.error}</Text>
            </Pressable>
          ) : null}

          {incomingRequests.length > 0 ? (
            <View style={styles.requestPanel}>
              <Text style={styles.requestPanelTitle}>
                {incomingRequests.length === 1 ? 'A member requested a file' : `${incomingRequests.length} file requests`}
              </Text>
              {incomingRequests.map((request) => {
                const attName = listFileRequestName(db, request);
                const busy = grantBusy?.id === request.id;
                const approving = busy && grantBusy?.decision === 'approve';
                const declining = busy && grantBusy?.decision === 'decline';
                return (
                  <View key={request.id} style={styles.requestRow}>
                    <View style={styles.requestText}>
                      <Text style={styles.requestName} numberOfLines={1}>{attName}</Text>
                      <Text style={styles.requestSub} numberOfLines={1}>
                        from {resolvePeerName(request.counterparty_device_id)} · #{channelDisplayName(community, request.channel_id)}
                      </Text>
                    </View>
                    <View style={styles.requestActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Approve and re-send ${attName}`}
                        accessibilityState={{ disabled: busy }}
                        disabled={busy}
                        onPress={() => handleGrant(request.id, 'approve')}
                        style={({ pressed }) => [styles.requestApprove, pressed && styles.pressed, busy && styles.disabled]}
                      >
                        <Text style={styles.requestApproveText}>{approving ? 'Sending…' : 'Approve'}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Decline request for ${attName}`}
                        accessibilityState={{ disabled: busy }}
                        disabled={busy}
                        onPress={() => handleGrant(request.id, 'decline')}
                        style={({ pressed }) => [styles.requestDecline, pressed && styles.pressed, busy && styles.disabled]}
                      >
                        <Text style={styles.requestDeclineText}>{declining ? 'Declining…' : 'Decline'}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              <HonestNotice text="Approving re-sends only your local copy of this file to the requester through the configured connection path. The bytes are verified against the original before they are written on either side." />
            </View>
          ) : null}

          {channel.loading ? (
            <View style={styles.statePanel}>
              <Text style={styles.stateTitle}>Loading channel</Text>
              <Text style={styles.stateText}>Reading messages saved on this device.</Text>
            </View>
          ) : (
            <MessageList
              items={kitMessages}
              firstUnreadId={firstUnreadId}
              getAuthorName={resolvePeerName}
              getAvatarImageUri={resolveAvatarUri}
              getReactions={getReactions}
              getStickers={getStickers}
              onPressSticker={onPressSticker}
              getMentionNames={getMentionNames}
              renderAttachments={renderAttachments}
              onLongPressMessage={onLongPressMessage}
              onPressReaction={onPressReaction}
              onAtBottomChange={setAtBottom}
              empty={(
                <View style={styles.statePanel}>
                  <Text style={styles.stateTitle}>No messages yet</Text>
                  <Text style={styles.stateText}>Send the first message, or start a post from the Posts tab.</Text>
                </View>
              )}
              header={channel.partialHistory ? (
                <HonestNotice text={`Partial history: this screen shows messages saved on this device. ${historyNotice}`} />
              ) : null}
            />
          )}

          {channelIsArchived ? null : (
          <View style={[styles.composerWrap, { paddingBottom: insets.bottom + 10 }]}>
            <ChatComposer
              value={draft}
              onChangeText={setDraft}
              onSend={submitMessage}
              mentionCandidates={mentionCandidates}
              sendDisabled={channel.busy || attachmentBusy}
              allowAttachments
              onPickAttachment={pickAttachment}
              attachmentBusy={attachmentBusy}
              attachmentsPresent={draftAttachments.length > 0}
              attachmentSlot={draftAttachments.length > 0 ? (
                <View style={styles.draftAttachments}>
                  {draftAttachments.map((attachment) => (
                    <View key={attachment.id} style={styles.draftAttachmentChip}>
                      <Text style={styles.draftAttachmentName} numberOfLines={1}>{attachment.name}</Text>
                      <Text style={styles.draftAttachmentMeta}>{formatBytes(attachment.size)}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${attachment.name}`}
                        onPress={() => removeDraftAttachment(attachment.id)}
                        style={({ pressed }) => [styles.removeAttachmentButton, pressed && styles.pressed]}
                      >
                        <X size={13} color={c.textSecondary} strokeWidth={2.2} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              reply={replyTarget ? {
                authorName: resolvePeerName(replyTarget.authorDeviceId),
                snippet: replySnippet(replyTarget),
              } : null}
              onCancelReply={() => setReplyTarget(null)}
              editing={editingEvent !== null}
              onCancelEdit={cancelEdit}
            />
          </View>
          )}
      </View>

      <View style={[styles.postsArea, postsHidden && styles.hidden]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.postsContent}
            keyboardShouldPersistTaps="handled"
          >
            {channel.error ? (
              // Same honest failure surface as the chat pane: without this, a
              // failed post set channel.error inside the HIDDEN chat area and
              // the Posts tab showed nothing.
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear post error"
                onPress={channel.clearError}
                style={styles.errorPanel}
              >
                <Text style={styles.errorTitle}>Couldn't post</Text>
                <Text style={styles.errorText}>{channel.error}</Text>
              </Pressable>
            ) : null}
            {channelIsArchived ? null : (
            <View style={styles.postComposer}>
              <TextInput
                style={styles.postInput}
                value={postDraft}
                onChangeText={setPostDraft}
                placeholder="Start a post"
                placeholderTextColor={c.textTertiary}
                multiline
                accessibilityLabel="Post body"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create post"
                accessibilityState={{ disabled: postDraft.trim().length === 0 || channel.busy }}
                onPress={submitPost}
                disabled={postDraft.trim().length === 0 || channel.busy}
                style={({ pressed }) => [
                  styles.primaryTextButton,
                  pressed && styles.pressed,
                  (postDraft.trim().length === 0 || channel.busy) && styles.disabled,
                ]}
              >
                <MessageSquareText size={15} color={c.onAccent} strokeWidth={2} />
                <Text style={styles.primaryTextButtonText}>Post</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create canvas post"
                accessibilityState={{ disabled: channel.busy }}
                onPress={submitCanvasPost}
                disabled={channel.busy}
                style={({ pressed }) => [styles.primaryTextButton, pressed && styles.pressed, channel.busy && styles.disabled]}
              >
                <Text style={styles.primaryTextButtonText}>Canvas</Text>
              </Pressable>
            </View>
            )}

            {postCards.length === 0 ? (
              <Text style={styles.emptyPostText}>No posts in this channel yet.</Text>
            ) : (
              postCards.map((post) => (
                <PostCard
                  key={post.postId}
                  post={post}
                  authorName={resolvePeerName(post.root.authorDeviceId)}
                  reactions={getReactions(post.root.id)}
                  onToggleReaction={(emoji) => toggleReaction(post.root.id, emoji, post.postId)}
                  onQuickReact={channelIsArchived ? undefined : () => setPostReactTarget(post)}
                  onOpen={openPost}
                  onReport={post.root.authorDeviceId === identity.publicKey ? undefined : reportPost}
                  onPublishPublic={canPublishPublic ? setPublishPost : undefined}
                />
              ))
            )}
          </ScrollView>
      </View>

      <MessageActionsSheet
        visible={actionTargetId !== null && actionItem !== undefined}
        onClose={() => setActionTargetId(null)}
        canReact={actionEvent !== null && !channelIsArchived}
        canReply={actionEvent !== null && !channelIsArchived}
        canCopy={actionBody.length > 0}
        canEdit={actionEvent !== null && actionIsMine && !channelIsArchived}
        canDelete={actionEvent !== null && actionIsMine && !channelIsArchived}
        canReport={actionEvent !== null && !actionIsMine}
        packReactions={packPickerItems}
        stickerChoices={stickerChoices}
        onStick={(key) => { if (actionEvent) stickMessage(actionEvent.id, key); }}
        onReact={(emoji) => { if (actionEvent) toggleReaction(actionEvent.id, emoji, actionEvent.postId); }}
        onReply={() => { if (actionEvent) beginReply(actionEvent); }}
        onCopy={() => { if (actionBody.length > 0) copyBody(actionBody); }}
        onEdit={() => { if (actionEvent) startEdit(actionEvent); }}
        onDelete={() => { if (actionEvent) confirmDelete(actionEvent); }}
        onReport={() => { if (actionEvent) reportMessage(actionEvent); }}
      />

      {/* Quick-react (and report) for a post card: reuses the same 6-quick +
          full-picker sheet as chat messages, so posts get real reactions too. */}
      <MessageActionsSheet
        visible={postReactTarget !== null}
        onClose={() => setPostReactTarget(null)}
        canReact={!channelIsArchived}
        canReply={false}
        canCopy={false}
        canEdit={false}
        canDelete={false}
        canReport={postReactTarget !== null && postReactTarget.root.authorDeviceId !== identity.publicKey}
        onReact={(emoji) => { if (postReactTarget) toggleReaction(postReactTarget.root.id, emoji, postReactTarget.postId); }}
        onReport={() => { if (postReactTarget) reportPost(postReactTarget); }}
      />

      <Modal
        visible={overflowOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setOverflowOpen(false)}
        onDismiss={flushOverflowAction}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close channel options"
          style={styles.overflowBackdrop}
          onPress={() => setOverflowOpen(false)}
        >
          <Pressable style={[styles.overflowMenu, { top: insets.top + 52 }]} onPress={(event) => event.stopPropagation()}>
            <OverflowRow
              icon={<FolderOpen size={17} color={c.text} strokeWidth={2} />}
              label="Files"
              onPress={openFiles}
            />
            <OverflowRow
              icon={<Info size={17} color={c.text} strokeWidth={2} />}
              label="Community details"
              onPress={openCommunityDetails}
            />
            {community?.descriptor.ownerDeviceId === identity.publicKey
              && !isLibraryChannel && !isCanvasChannel && !isPageChannel && !topperCanvas ? (
              <OverflowRow
                icon={<MessageSquareText size={17} color={c.text} strokeWidth={2} />}
                label="Add a topper canvas"
                onPress={() => {
                  setOverflowOpen(false);
                  try {
                    ensureCanvas(db, identity, { communityId, kind: 'channel_topper', subjectId: channelId }, recordLocalChange);
                    setCanvasRevision((v) => v + 1);
                  } catch {
                    // The data layer refused (not the owner / no community);
                    // the row simply does not appear.
                  }
                }}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {publishPost ? (
        <PublishSheet
          visible
          onClose={() => setPublishPost(null)}
          communityId={communityId}
          channels={[{ id: channelId, name: title }]}
          initialChannelId={channelId}
          lockChannel
          postId={publishPost.postId}
          kind="post"
          initialTitle={publishPost.root.body.slice(0, 80)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

type DbAdapter = ReturnType<typeof useMeerkatDatabase>;
type CommunityLike = ReturnType<typeof listCommunities>[number];

// The attachment's real name, from this device's own verified message attachment
// row. Falls back to a short blob hint if the row is gone (never a fabricated name).
function listFileRequestName(db: DbAdapter, request: FileRequestRow): string {
  const rows = listMessageAttachmentRows(db, request.message_id);
  const match = rows.find((row) => row.attachment_id === request.attachment_id);
  return match?.name ?? `file ${request.blob_hash.slice(0, 8)}`;
}

function channelDisplayName(community: CommunityLike | null, channelId: string): string {
  return community?.descriptor.channels.find((channel) => channel.id === channelId)?.name ?? channelId;
}

function OverflowRow({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  const styles = useMkStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.overflowRow, pressed && styles.overflowRowPressed]}
    >
      <View style={styles.overflowIcon}>{icon}</View>
      <Text style={styles.overflowLabel}>{label}</Text>
    </Pressable>
  );
}

function PostCard({
  post,
  authorName,
  reactions,
  onToggleReaction,
  onQuickReact,
  onOpen,
  onReport,
  onPublishPublic,
}: {
  post: ChannelPostCard;
  authorName: string;
  reactions: readonly MessageReactionGroup[];
  onToggleReaction: (emoji: string) => void;
  /** Absent for an archived (read-only) channel: no add-reaction affordance renders. */
  onQuickReact?: () => void;
  onOpen: (postId: string) => void;
  onReport?: (post: ChannelPostCard) => void;
  onPublishPublic?: (post: ChannelPostCard) => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open post by ${authorName}`}
      onPress={() => onOpen(post.postId)}
      style={({ pressed }) => [styles.postCard, pressed && styles.pressed]}
    >
      <Text style={styles.postAuthor} numberOfLines={1}>{authorName}</Text>
      <Text style={styles.postBody} numberOfLines={4}>
        {parseCanvasPostBody(post.root.body) ? 'A freeform canvas post. Open it to see the canvas.' : post.root.body}
      </Text>
      <View style={styles.postReactions}>
        {reactions.map((group) => (
          <Pressable
            key={group.emoji}
            accessibilityRole="button"
            accessibilityLabel={`${group.emoji} ${group.count}${group.mine ? ', including you. Tap to remove.' : '. Tap to add.'}`}
            accessibilityState={{ selected: group.mine }}
            onPress={() => onToggleReaction(group.emoji)}
            style={[styles.reactionChip, group.mine && styles.reactionChipMine]}
          >
            <Text style={styles.reactionEmoji}>{group.emoji}</Text>
            <Text style={[styles.reactionCount, group.mine && styles.reactionCountMine]}>{group.count}</Text>
          </Pressable>
        ))}
        {onQuickReact ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a reaction"
            onPress={onQuickReact}
            style={({ pressed }) => [styles.reactionAddChip, pressed && styles.pressed]}
          >
            <SmilePlus size={14} color={c.textSecondary} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.postFooter}>
        <Text style={styles.postMeta}>
          {post.replyCount === 0
            ? 'No replies yet'
            : `${post.replyCount} repl${post.replyCount === 1 ? 'y' : 'ies'}`}
        </Text>
        <Text style={styles.postMeta}>
          Last activity {formatClockTime(post.lastActivity.wall)}
        </Text>
        {onPublishPublic ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Publish post publicly"
            onPress={() => onPublishPublic(post)}
            style={({ pressed }) => [styles.publishChip, pressed && styles.pressed]}
          >
            <Text style={styles.publishChipText}>Publish publicly</Text>
          </Pressable>
        ) : null}
        {onReport ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report post"
            onPress={() => onReport(post)}
            style={({ pressed }) => [styles.reportChip, pressed && styles.pressed]}
          >
            <Text style={styles.reportChipText}>Report</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
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
  },
  headerText: { flex: 1, minWidth: 0 },
  channelName: { color: c.text, fontSize: 18, fontWeight: '800' },
  communityName: { color: c.textSecondary, fontSize: 12, marginTop: 1 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: MK_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  audienceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 8,
    backgroundColor: c.surface,
  },
  audienceText: { flex: 1, minWidth: 0, color: c.textSecondary, fontSize: 12, lineHeight: 16 },
  chatArea: { flex: 1 },
  postsArea: { flex: 1 },
  hidden: { display: 'none' },
  scroll: { flex: 1 },
  postsContent: { padding: 14, gap: 10 },
  statePanel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 14,
    margin: 14,
    gap: 4,
  },
  stateTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  stateText: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  errorPanel: {
    backgroundColor: c.dangerSoft,
    borderColor: c.danger,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 12,
    marginHorizontal: 14,
    marginTop: 12,
    gap: 3,
  },
  errorTitle: { color: c.danger, fontSize: 13, fontWeight: '800' },
  errorText: { color: c.danger, fontSize: 12, lineHeight: 17 },
  requestPanel: {
    backgroundColor: c.infoSoft,
    borderColor: c.info,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 12,
    marginHorizontal: 14,
    marginTop: 12,
    gap: 10,
  },
  requestPanelTitle: { color: c.info, fontSize: 14, fontWeight: '800' },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  requestText: { flex: 1, minWidth: 120, gap: 2 },
  requestName: { color: c.text, fontSize: 13, fontWeight: '700' },
  requestSub: { color: c.textSecondary, fontSize: 11 },
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestApprove: {
    backgroundColor: c.accent,
    borderRadius: MK_RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  requestApproveText: { color: c.onAccent, fontSize: 12.5, fontWeight: '800' },
  requestDecline: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  requestDeclineText: { color: c.textSecondary, fontSize: 12.5, fontWeight: '800' },
  postComposer: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 10,
    gap: 9,
  },
  postInput: {
    minHeight: 86,
    maxHeight: 180,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 11,
    paddingVertical: 9,
    color: c.text,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  emptyPostText: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  postCard: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 12,
    gap: 9,
  },
  postAuthor: { color: c.text, fontSize: 13, fontWeight: '800' },
  postBody: { color: c.text, fontSize: 15, lineHeight: 21 },
  postReactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  postFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  postMeta: { color: c.textTertiary, fontSize: 11, fontWeight: '700' },
  primaryTextButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: c.accent,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryTextButtonText: { color: c.onAccent, fontSize: 13, fontWeight: '800' },
  attachmentsList: { gap: 7, marginTop: 2 },
  localAttachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  localAttachmentName: { flex: 1, minWidth: 0, color: c.onAccent, fontSize: 12, fontWeight: '700' },
  localAttachmentMeta: { color: c.onAccent, fontSize: 11, opacity: 0.8 },
  composerWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: c.surface,
    borderTopColor: c.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  draftAttachments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  draftAttachmentChip: {
    maxWidth: '100%',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surfaceHigh,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 5,
  },
  draftAttachmentName: {
    maxWidth: 180,
    color: c.text,
    fontSize: 12,
    fontWeight: '700',
  },
  draftAttachmentMeta: { color: c.textTertiary, fontSize: 11 },
  removeAttachmentButton: {
    width: 24,
    height: 24,
    borderRadius: MK_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  reactionChipMine: { borderColor: c.accent, backgroundColor: c.glass },
  reactionAddChip: {
    minHeight: 26,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  reactionCountMine: { color: c.accentDim },
  reportChip: {
    minHeight: 28,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.danger,
    borderRadius: MK_RADIUS.sm,
    paddingHorizontal: 9,
    backgroundColor: c.dangerSoft,
  },
  reportChipText: { color: c.danger, fontSize: 11, fontWeight: '800' },
  publishChip: {
    minHeight: 28,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.accent,
    borderRadius: MK_RADIUS.sm,
    paddingHorizontal: 9,
    backgroundColor: c.glass,
  },
  publishChipText: { color: c.accent, fontSize: 11, fontWeight: '800' },
  overflowBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)' },
  overflowMenu: {
    position: 'absolute',
    right: 12,
    minWidth: 200,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  overflowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  overflowRowPressed: { backgroundColor: c.surfaceHigh },
  overflowIcon: { width: 20, alignItems: 'center' },
  overflowLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
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
