import { WebSocket } from 'ws';

type RelayTestWebSocket = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'open', handler: () => void): void;
  addEventListener(type: 'close', handler: () => void): void;
  addEventListener(type: 'error', handler: (ev: unknown) => void): void;
  addEventListener(type: 'message', handler: (ev: { data: unknown }) => void): void;
};

type RelayTestWebSocketCtor = new (url: string) => RelayTestWebSocket;

(globalThis as unknown as { WebSocket: RelayTestWebSocketCtor }).WebSocket =
  WebSocket as unknown as RelayTestWebSocketCtor;
