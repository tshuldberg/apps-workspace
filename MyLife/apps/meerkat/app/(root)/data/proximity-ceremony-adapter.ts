/**
 * Plan 53 P1: drive the pure ceremony reducer over the real Nearby substrate.
 *
 * The protocol in `@mylife/sync` decides everything; this file only moves bytes
 * and timers. The native module is INJECTED rather than loaded here, for two
 * reasons: the whole adapter is testable against a fake, and, more importantly,
 * the ceremony must share the ONE module instance the sync rung uses.
 *
 * TWO RULES ABOUT THE SHARED NATIVE MODULE, both learned from reading it:
 *
 *  1. NEVER call destroy(). The native transport keeps a single session, a
 *     single advertiser, and a single browser at module scope, and destroy()
 *     tears down that shared state. A ceremony that destroyed its bridge would
 *     kill the sync rung's live sessions. Teardown here stops advertising and
 *     browsing and closes only the session this ceremony opened.
 *
 *  2. Advertising a fresh ephemeral handle REBUILDS the native session, so it
 *     is only safe with no sessions open. The native side refuses with
 *     ERR_IDENTITY_BUSY rather than tearing down live sessions, and that
 *     refusal surfaces here as an honest failure instead of a silent
 *     downgrade to a stale advertised id, which would break AC-3 quietly.
 */

import {
  ceremonyPairingResult,
  ceremonyReducer,
  helloFrameFor,
  newCeremonyEphemeral,
  sealBundleFrame,
  signCeremonyAccept,
  startCeremony,
  CEREMONY_SERVICE_TYPE,
  CEREMONY_WINDOW_MS,
  type CeremonyState,
  type DeviceIdentity,
  type SignedIdentityBundle,
} from '@mylife/sync';
import type { NativeNearbyModule, NativeNearbySession } from '@mylife/meerkat-native-transport';

export interface CeremonyRunner {
  /** Confirm the peer shown on screen. Signs and sends this device's accept. */
  confirm(): void;
  /** Abort. Persists nothing and tears the transport down. */
  cancel(): void;
  state(): CeremonyState;
}

export interface CeremonyRunnerOptions {
  mod: NativeNearbyModule;
  identity: DeviceIdentity;
  selfBundle: SignedIdentityBundle;
  onState: (state: CeremonyState) => void;
  /** Called once with the peer bundle when, and only when, both sides agreed. */
  onCommitted: (peer: SignedIdentityBundle) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Frames are newline-free JSON; the substrate already preserves boundaries. */
function encodeFrame(frame: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(frame));
}

function decodeFrame(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(decoder.decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

export function startProximityCeremony(options: CeremonyRunnerOptions): CeremonyRunner {
  const {
    mod, identity, selfBundle, onState, onCommitted,
    now = () => Date.now(),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  } = options;

  const ephemeral = newCeremonyEphemeral();
  let state = startCeremony(selfBundle, now(), ephemeral);
  let session: NativeNearbySession | null = null;
  let torn = false;
  let acceptSent = false;
  let timer: unknown = null;
  /**
   * An accept that arrived before this user confirmed. Held at ceremony scope
   * (not session scope) because `confirm()` replays it, and confirm lives here.
   */
  const earlyAcceptRef: { value: unknown } = { value: null };

  const teardown = (): void => {
    if (torn) return;
    torn = true;
    if (timer !== null) clearTimer(timer);
    try { mod.stopAdvertising(); } catch { /* best effort */ }
    try { mod.stopBrowsing(); } catch { /* best effort */ }
    // Close only OUR session. Never destroy() the shared module.
    if (session) void session.close().catch(() => undefined);
    session = null;
  };

  const apply = (next: CeremonyState): void => {
    if (next === state) return;
    const previous = state;
    state = next;
    onState(state);

    // Send our accept exactly once, on the transition into awaiting_peer.
    if (
      state.phase === 'awaiting_peer'
      && previous.phase !== 'awaiting_peer'
      && !acceptSent
      && state.transcriptHash
      && session
    ) {
      acceptSent = true;
      void session.send(encodeFrame(signCeremonyAccept(identity, state.transcriptHash)))
        .catch(() => dispatch({ type: 'transport_lost' }));
    }

    if (state.phase === 'committed') {
      const peer = ceremonyPairingResult(state);
      teardown();
      // Only after teardown, so the caller writing the pairing cannot race the
      // transport, and only from the one phase that earned it.
      if (peer) onCommitted(peer);
      return;
    }
    if (
      state.phase === 'cancelled' || state.phase === 'expired' || state.phase === 'failed'
    ) {
      teardown();
    }
  };

  const dispatch = (event: Parameters<typeof ceremonyReducer>[1]): void => {
    apply(ceremonyReducer(state, event, identity));
  };

  /**
   * Adopt an INCOMING session only once it proves it is a ceremony peer.
   *
   * The native module is shared and module-global: its `sessionOpened` event
   * fans out to every bridge over it, so the sync rung's sessions surface here
   * too. Claiming one and closing it at teardown would kill a live sync
   * session. So an incoming session is WATCHED, not adopted, until it delivers
   * a valid ceremony hello. Anything else is left completely alone: never
   * adopted, never closed.
   *
   * Frames seen while watching are buffered and replayed into the adopted
   * reader, so a bundle that overtakes its hello is not lost here either.
   */
  const watchIncoming = (opened: NativeNearbySession): void => {
    if (session || torn) return; // not ours to touch
    const seen: unknown[] = [];
    let adopted = false;
    opened.onData((bytes) => {
      if (adopted || session || torn) return;
      const frame = decodeFrame(bytes) as { kind?: string } | null;
      if (!frame || typeof frame.kind !== 'string') return;
      if (!frame.kind.startsWith('ceremony-')) return; // someone else's session
      seen.push(frame);
      if (frame.kind !== 'ceremony-hello') return; // still unproven, keep watching
      adopted = true;
      const replay = deliverTo(opened);
      for (const held of seen) replay(held);
    });
  };

  const attachSession = (opened: NativeNearbySession): void => {
    // FIRST peer wins. A second session arriving is closed rather than
    // replacing the one whose SAS the user may already be reading.
    if (session || torn) {
      void opened.close().catch(() => undefined);
      return;
    }
    session = opened;
    deliverTo(opened);
  };

  /**
   * Adopt `opened` as our session, send our hello, install the frame reader,
   * and return a function that feeds one already-decoded frame through the same
   * path (used to replay what was buffered while the session was unproven).
   */
  const deliverTo = (opened: NativeNearbySession): ((frame: unknown) => void) => {
    session = opened;
    // Send our hello BEFORE attaching the reader, so the peer has what it needs
    // to reach 'connected' as early as possible.
    void opened.send(encodeFrame(helloFrameFor(ephemeral)))
      .catch(() => dispatch({ type: 'transport_lost' }));

    // Both sides send independently, so a peer's BUNDLE can arrive before its
    // HELLO. The reducer correctly ignores a bundle before the channel key
    // exists, which would strand the ceremony at 'connected' forever, so an
    // early bundle is held and replayed once the hello lands. Exactly one is
    // held: a second before any hello is a protocol violation, not a race.
    let earlyBundle: unknown = null;

    // The ACCEPT gets the same treatment via earlyAcceptRef. The reducer
    // deliberately ignores an accept that arrives before this user confirmed,
    // so a local confirm never stops being a precondition for commit. But
    // whoever confirms SECOND would then hold an accept nobody replays, and
    // would sit at 'awaiting_peer' forever while the other side committed.
    // Holding it and replaying it after the local confirm preserves the
    // precondition exactly, without needing the peer to send twice.

    const handle = (raw: unknown): void => {
      const frame = raw as { kind?: string } | null;
      if (!frame || typeof frame.kind !== 'string') return;
      switch (frame.kind) {
        case 'ceremony-hello': {
          dispatch({ type: 'peer_hello', frame });
          // Our bundle can only be sealed once the hello gave us a channel key.
          if (state.channelKey && session) {
            void session.send(encodeFrame(sealBundleFrame(state.channelKey, selfBundle)))
              .catch(() => dispatch({ type: 'transport_lost' }));
          }
          if (earlyBundle) {
            const held = earlyBundle;
            earlyBundle = null;
            dispatch({ type: 'peer_bundle', frame: held as never });
          }
          break;
        }
        case 'ceremony-bundle':
          if (state.phase === 'discovering') earlyBundle = earlyBundle ?? frame;
          else dispatch({ type: 'peer_bundle', frame: frame as never });
          break;
        case 'ceremony-accept':
          if (state.phase === 'awaiting_peer') dispatch({ type: 'peer_accept', frame });
          else earlyAcceptRef.value = earlyAcceptRef.value ?? frame;
          break;
        default:
          break;
      }
    };

    opened.onData((bytes) => handle(decodeFrame(bytes)));
    return handle;
  };

  mod.onIncomingSession(watchIncoming);
  mod.onPeerFound((peer) => {
    if (session || torn) return;
    void mod.connect(peer.id).then(attachSession).catch(() => undefined);
  });

  // Advertise BEFORE browsing: advertising is what adopts the fresh ephemeral
  // identity natively, and browsing would otherwise build the shared session
  // under the previous handle.
  try {
    mod.advertise(CEREMONY_SERVICE_TYPE, ephemeral.ceremonyId);
  } catch {
    // ERR_IDENTITY_BUSY, or any other native refusal. Failing here is the
    // honest outcome: without a fresh advertised id the privacy guarantee does
    // not hold, so the ceremony must not quietly run anyway.
    apply({ ...state, phase: 'failed', failure: 'transport_lost' });
    return {
      confirm: () => undefined,
      cancel: () => undefined,
      state: () => state,
    };
  }
  mod.browse(CEREMONY_SERVICE_TYPE);

  timer = setTimer(() => dispatch({ type: 'tick', now: now() }), CEREMONY_WINDOW_MS);

  return {
    confirm: () => {
      dispatch({ type: 'local_confirm' });
      if (state.phase === 'awaiting_peer' && earlyAcceptRef.value) {
        const held = earlyAcceptRef.value;
        earlyAcceptRef.value = null;
        dispatch({ type: 'peer_accept', frame: held });
      }
    },
    cancel: () => dispatch({ type: 'cancel' }),
    state: () => state,
  };
}
