// Auto-connect triggers (Plan 29 Phase 3, item 12). Fires ONE composed round on
// app foreground and when a new paired peer appears on the local network. The
// engine's per-peer backoff + min-interval make repeated triggers safe (an
// over-eager trigger just skips), so this never double-dials or fabricates
// activity. A disabled toggle fires nothing.

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { AutoConnectTrigger } from './auto-connect-core';

export interface AutoConnectTriggersInput {
  /** Whether the user opted into automatic dialing. */
  enabled: boolean;
  /** Current count of peers discovered on the local network (mDNS). */
  discoveredPeerCount: number;
  /** Run one composed round. Must be stable (useCallback) to avoid re-subscribing. */
  run: (trigger: AutoConnectTrigger) => Promise<unknown>;
}

export function useAutoConnectTriggers(input: AutoConnectTriggersInput): void {
  const { enabled, discoveredPeerCount, run } = input;
  const runRef = useRef(run);
  runRef.current = run;

  // App foreground: catch up on anything parked while backgrounded, then dial.
  useEffect(() => {
    if (!enabled) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runRef.current('foreground').catch(() => undefined);
    });
    return () => sub.remove();
  }, [enabled]);

  // A new peer appeared on the local network: dial it (LAN-first when reachable).
  const prevCount = useRef(discoveredPeerCount);
  useEffect(() => {
    if (!enabled) {
      prevCount.current = discoveredPeerCount;
      return;
    }
    if (discoveredPeerCount > prevCount.current) void runRef.current('lan_peer').catch(() => undefined);
    prevCount.current = discoveredPeerCount;
  }, [enabled, discoveredPeerCount]);
}
