// Plan 30 Phase 1: the shared chat kit barrel.
//
// Provider-agnostic building blocks the channel screen (Plan 30 Phase 2), the
// post thread screen, and Plan 21's DM threads all consume. Everything here is
// props-only: no ChatProvider / SyncProvider / NodeProvider import (TC-4). Wire
// data + callbacks from the screen; the kit renders and reports intent up.

export { MessageBubble, type MessageBubbleProps } from './MessageBubble';
export { MessageList, type MessageListProps } from './MessageList';
export {
  MessageActionsSheet,
  type MessageActionsSheetProps,
} from './MessageActionsSheet';
export {
  EmojiPickerSheet,
  type EmojiPickerSheetProps,
  EmojiPickerPanel,
  type EmojiPickerPanelProps,
} from './EmojiPickerSheet';
export { ChatComposer, type ChatComposerProps } from './ChatComposer';
export {
  ChannelSegmentedTabs,
  type ChannelSegment,
  type ChannelSegmentedTabsProps,
} from './ChannelSegmentedTabs';

export {
  QUICK_REACTIONS,
  EMOJI_CATALOG,
  searchEmojiCatalog,
  type EmojiEntry,
  type EmojiCategory,
} from './emoji-data';

export {
  buildMessageRows,
  groupMessages,
  dayDividerLabel,
  formatClockTime,
  detectMentionQuery,
  filterMentionCandidates,
  applyMentionSelection,
  resolveSignedMentions,
  resolveReactionTap,
  createSendLatch,
  segmentBodyMentions,
  type GroupableChatMessage,
  type ChatKitMessage,
  type ChatKitReplyContext,
  type KitReactionGroup,
  type KitSticker,
  type ChatListRow,
  type BuildRowsOptions,
  type MentionCandidate,
  type MentionQuery,
  type ReactionTapAction,
  type SendLatch,
  type BodySegment,
} from './chat-kit-core';
