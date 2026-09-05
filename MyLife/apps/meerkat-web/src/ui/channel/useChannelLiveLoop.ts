// Plan 30 Phase 4 (web twin of the mobile useChannelLiveLoop): the focused-view
// live loop. It polls the SAME honest runForegroundDrain the removed manual button
// ran, on the SHARED cadence engine (live-loop-core), and only a real applied>0
// tick refreshes the channel. It is dormant (zero network) with no relay, stops on
// tab hide / view blur, and NEVER renders a connected/live status (NC-1). The
// cadence math is the byte-shared pure module; this hook only wires the web seams:
// document visibility + the effective-relay gate + the drain call.

import { useEffect, useMemo, useRef } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { createLiveLoopEngine, type LiveLoopEngine } from '../../lib/live-loop-core';

export interface UseChannelLiveLoopResult {
  /** Re-enter the 5s hot window after a local send, so a peer's reply lands fast. */
  noteSend: () => void;
}

/**
 * The honesty gate (TC-3), extracted pure so it is Node-testable without a DOM:
 * the loop runs ONLY when the chat view is active AND a relay resolves AND the tab
 * is visible. Any one being false means dormant -- zero drain, zero network. A
 * relay-empty gate is the load-bearing honesty guarantee (no relay = no polling).
 */
export function shouldRunLiveLoop(input: {
  active: boolean;
  relayLive: boolean;
  documentVisible: boolean;
}): boolean {
  return input.active && input.relayLive && input.documentVisible;
}

export function useChannelLiveLoop({
  communityId,
  channelId,
  active,
  onApplied,
}: {
  communityId: string;
  channelId: string;
  /** The channel view is on screen (chat segment focused). */
  active: boolean;
  /** Runs after a tick that applied new messages/grants (refresh the open view). */
  onApplied: () => void;
}): UseChannelLiveLoopResult {
  const m = useMeerkat();
  const runDrain = m.runForegroundDrain;
  const relayLive = m.relayUrl.trim().startsWith('ws');

  // Stable refs so the engine (built once) always calls the latest callbacks
  // without being torn down and rebuilt every render.
  const onAppliedRef = useRef(onApplied);
  onAppliedRef.current = onApplied;
  const runDrainRef = useRef(runDrain);
  runDrainRef.current = runDrain;

  const engine: LiveLoopEngine = useMemo(
    () => createLiveLoopEngine({
      tick: async () => {
        const result = await runDrainRef.current();
        return { applied: result.applied > 0 || result.fileGrants > 0 || result.fileRequests > 0 };
      },
      onApplied: () => onAppliedRef.current(),
    }),
    [],
  );

  // Start when the view is active AND a relay resolves AND the tab is visible;
  // stop otherwise. The engine self-schedules; blur/hide/no-relay = fully dormant.
  useEffect(() => {
    const sync = (): void => {
      const run = shouldRunLiveLoop({ active, relayLive, documentVisible: document.visibilityState === 'visible' });
      if (run) engine.start();
      else engine.stop();
    };

    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      engine.stop();
    };
  }, [engine, active, relayLive, communityId, channelId]);

  const noteSend = useMemo(() => () => engine.noteHot(), [engine]);
  return { noteSend };
}
