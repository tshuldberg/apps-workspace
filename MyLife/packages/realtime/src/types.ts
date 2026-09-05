export interface ChannelConfig {
  channelName: string;
  onMessage?: (payload: unknown) => void;
  onPresenceSync?: (state: PresenceState) => void;
  onError?: (error: Error) => void;
}

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  cursorX?: number;
  cursorY?: number;
  lastSeen: number;
}

export type PresenceState = Record<string, PresenceUser[]>;

export interface BroadcastMessage {
  type: string;
  payload: Record<string, unknown>;
  senderId: string;
  timestamp: number;
}

export interface CdcEvent {
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
  timestamp: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface RealtimeChannel {
  subscribe(): void;
  unsubscribe(): void;
  broadcast(event: string, payload: Record<string, unknown>): void;
  track(state: Record<string, unknown>): void;
  status: ConnectionStatus;
}
