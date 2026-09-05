import type { ChannelMessageAttachment } from '@mylife/sync';

export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface PendingChatMessage {
  clientId: string;
  communityId: string;
  channelId: string;
  body: string;
  attachments?: ChannelMessageAttachment[];
  createdAt: string;
  error?: string;
}

export interface ChatState {
  pending: PendingChatMessage[];
  failed: PendingChatMessage[];
  revision: number;
  lastError: string | null;
}

export type ChatAction =
  | { type: 'compose'; message: PendingChatMessage }
  | { type: 'reconcile'; clientId: string }
  | { type: 'fail'; clientId: string; error: string }
  | { type: 'setError'; error: string }
  | { type: 'refresh' }
  | { type: 'clearError' };

export const INITIAL_CHAT_STATE: ChatState = {
  pending: [],
  failed: [],
  revision: 0,
  lastError: null,
};

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'compose':
      return {
        ...state,
        pending: [...state.pending, action.message],
        revision: state.revision + 1,
        lastError: null,
      };
    case 'reconcile':
      return {
        ...state,
        pending: state.pending.filter((message) => message.clientId !== action.clientId),
        revision: state.revision + 1,
      };
    case 'fail': {
      const pending = state.pending.find((message) => message.clientId === action.clientId);
      return {
        ...state,
        pending: state.pending.filter((message) => message.clientId !== action.clientId),
        failed: pending
          ? [...state.failed, { ...pending, error: action.error }]
          : state.failed,
        revision: state.revision + 1,
        lastError: action.error,
      };
    }
    case 'setError':
      return { ...state, revision: state.revision + 1, lastError: action.error };
    case 'refresh':
      return { ...state, revision: state.revision + 1 };
    case 'clearError':
      return { ...state, lastError: null };
    default:
      return state;
  }
}

export function selectPendingMessages(
  state: ChatState,
  communityId: string,
  channelId: string,
): PendingChatMessage[] {
  return state.pending.filter((message) => (
    message.communityId === communityId && message.channelId === channelId
  ));
}

export function selectFailedMessages(
  state: ChatState,
  communityId: string,
  channelId: string,
): PendingChatMessage[] {
  return state.failed.filter((message) => (
    message.communityId === communityId && message.channelId === channelId
  ));
}
