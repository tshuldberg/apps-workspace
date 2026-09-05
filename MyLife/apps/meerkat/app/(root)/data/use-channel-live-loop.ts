// Plan 30 Phase 3 (T3.2/T3.3): the focused-screen live loop hook.
//
// Composes useFocusEffect + AppState + the effectiveRelayUrl gate around the pure
// LiveLoopEngine. While the channel screen is focused AND the app is active, it
// polls `runForegroundDrain` on the adaptive cadence and, only on a real applied>0
// tick, refreshes the open channel. It writes NO status row and renders NO
// "connected"/"live" copy: only applied events move the UI (NC-1 / TC-3). With no
// dialable relay it makes ZERO network calls (a dormant, no-op tick).
//
// T3.3 seam: Plan 29's autoConnectRound() replaces the tick body 1:1 (both wrap
// runForegroundDrain) via the `tickImpl` prop, so the two cannot drift.

import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useSync } from '../providers/SyncProvider';
import { ensureEffectiveRelayUrl, relayDialCandidateConfigured } from './effective-relay';
import {
  createLiveLoopEngine,
  type LiveLoopEngine,
  type LiveLoopTickResult,
} from './live-loop-core';

export interface UseChannelLiveLoopParams {
  communityId: string;
  channelId: string;
  /** Runs after a drain applies new messages/grants: the exact refresh set the old
   *  manual Refresh button covered (channel + reactions + incoming requests). */
  onApplied: () => void;
  /** Plan 29 seam: inject autoConnectRound to replace the drain tick 1:1. */
  tickImpl?: () => Promise<LiveLoopTickResult>;
}

export interface ChannelLiveLoop {
  /** A local send re-enters the 5s hot window (poll fast for the peer's reply). */
  noteSend: () => void;
}

export function useChannelLiveLoop({
  communityId,
  channelId,
  onApplied,
  tickImpl,
}: UseChannelLiveLoopParams): ChannelLiveLoop {
  const db = useMeerkatDatabase();
  const { runForegroundDrain } = useSync();

  const defaultTick = useCallback(async (): Promise<LiveLoopTickResult> => {
    // Relay gate: with no dialable relay this is a genuine dormant tick. The
    // ensured choke point re-probes a STALE free-default probe on demand (rc13
    // defect 2) instead of quiescing off a cache only mount effects ever wrote;
    // with nothing configured (or a fresh failed probe) it stays a zero-dial tick.
    if (!(await ensureEffectiveRelayUrl(db)).startsWith('ws')) return { applied: false };
    const result = await runForegroundDrain();
    // A member removal arriving while focused must also refresh roster-driven UI.
    return {
      applied: result.appliedMessages > 0 || result.fileGrants > 0 || result.memberRemovalsApplied > 0,
    };
  }, [db, runForegroundDrain]);

  // Latest closures live in refs so the long-lived engine calls current versions
  // without being torn down and rebuilt on every render.
  const tickRef = useRef(tickImpl ?? defaultTick);
  tickRef.current = tickImpl ?? defaultTick;
  const onAppliedRef = useRef(onApplied);
  onAppliedRef.current = onApplied;
  // Whether a custom tick was injected (Plan 29). A custom tick owns its own
  // gating, so scheduling is not relay-gated for it.
  const hasCustomTickRef = useRef(tickImpl != null);
  hasCustomTickRef.current = tickImpl != null;

  const engineRef = useRef<LiveLoopEngine | null>(null);

  // Battery gate (m5): with the default drain tick and NO relay CANDIDATE (no
  // user URL, and the free default unconfigured or opted out), do not even
  // schedule the timer -- the loop quiesces entirely (no 10s wakeups). This gate
  // is deliberately candidate-based, not probe-based (rc13 defect 2): a stale
  // cached probe must not silence the loop, because the tick itself re-probes
  // through ensureEffectiveRelayUrl and stays a zero-dial no-op when the server
  // is genuinely down (fresh failed probe within the TTL).
  const shouldSchedule = useCallback(
    () => hasCustomTickRef.current || relayDialCandidateConfigured(db),
    [db],
  );

  useFocusEffect(
    useCallback(() => {
      void communityId;
      void channelId;
      const engine = createLiveLoopEngine({
        tick: () => tickRef.current(),
        onApplied: () => onAppliedRef.current(),
      });
      engineRef.current = engine;

      const startIfReady = () => {
        if (shouldSchedule()) engine.start();
      };

      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') startIfReady();
        else engine.stop();
      });
      if (AppState.currentState === 'active') startIfReady();

      return () => {
        subscription.remove();
        engine.stop();
        engineRef.current = null;
      };
      // Rebuild the loop when the target channel changes while focused.
    }, [communityId, channelId, shouldSchedule]),
  );

  const noteSend = useCallback(() => {
    engineRef.current?.noteHot();
  }, []);

  return { noteSend };
}
