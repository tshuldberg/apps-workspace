import type { SupabaseClient, RealtimeChannel as SupabaseChannel } from '@supabase/supabase-js';
import type { ChannelConfig, ConnectionStatus } from './types';

export interface ManagedChannel {
  subscribe(): void;
  unsubscribe(): void;
  getStatus(): ConnectionStatus;
}

export function createChannel(
  supabase: SupabaseClient,
  config: ChannelConfig,
): ManagedChannel {
  let channel: SupabaseChannel | null = null;
  let status: ConnectionStatus = 'disconnected';
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const BASE_RECONNECT_DELAY = 1000;

  function subscribe() {
    if (channel) unsubscribe();

    status = 'connecting';
    channel = supabase.channel(config.channelName);

    channel
      .on('broadcast', { event: '*' }, (payload) => {
        config.onMessage?.(payload);
      })
      .subscribe((channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') {
          status = 'connected';
          reconnectAttempts = 0;
        } else if (channelStatus === 'CLOSED' || channelStatus === 'CHANNEL_ERROR') {
          status = 'disconnected';
          attemptReconnect();
        }
      });
  }

  function unsubscribe() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
    status = 'disconnected';
    reconnectAttempts = 0;
  }

  function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      config.onError?.(new Error('Max reconnect attempts reached'));
      return;
    }

    status = 'reconnecting';
    reconnectAttempts++;
    reconnectTimer = setTimeout(() => {
      subscribe();
    }, getReconnectDelay(reconnectAttempts, BASE_RECONNECT_DELAY));
  }

  function getStatus(): ConnectionStatus {
    return status;
  }

  return { subscribe, unsubscribe, getStatus };
}

export function getReconnectDelay(attempts: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempts), 30000);
}
