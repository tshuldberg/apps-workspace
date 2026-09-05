// Hands-free voice coach hook. Owns on-device speech recognition and the
// AppState / permission / capability lifecycle; delegates every accept/swallow
// decision to the pure voice-coach-core controller.
//
// Honesty rules (founder mandate): the mic pill only shows a listening state
// once the native recognizer has actually started; if the device cannot record
// or has no on-device recognizer, status is 'unavailable' with a real reason
// and audio is never sent off-device. Privacy: recognition is forced on-device
// on both platforms, so a device without on-device support reports unavailable
// rather than silently streaming audio to a cloud recognizer.
//
// Real-device QA (Plan 36 Phase 7) tunes the iOS audio session so recognition
// mixes with video playback instead of ducking it to silence.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionOptions,
} from 'expo-speech-recognition';
import {
  getSupportedPlayerCommands,
  parsePlayerCommand,
  type PlayerVoiceAction,
  type PlayerVoiceMatch,
} from '@mylife/workouts';
import {
  createVoiceCoachState,
  describeCommand,
  processTranscriptWith,
  type CommandGrammar,
  type VoiceCoachState,
} from './voice-coach-core';
import { createRestartPolicy } from './restart-policy';

// 'interrupted' is the honest give-up state: continuous recognition kept cutting
// out on this device so we stopped re-arming it, but push-to-talk still works.
export type VoiceCoachStatus =
  | 'off'
  | 'denied'
  | 'listening'
  | 'paused'
  | 'unavailable'
  | 'interrupted';

// Shown when the restart policy gives up. It has to keep working with the mic
// button, so this is a distinct state from runtimeError (which blocks everything).
const HANDS_FREE_INTERRUPTED_MESSAGE =
  'Voice control keeps cutting out on this device. Use the mic button to talk.';

type Permission = 'undetermined' | 'granted' | 'denied';

// A grammar the coach can drive. The player grammar is the default; the session
// screen injects its own so the same recognition + lifecycle machinery serves
// both surfaces. `describe` supplies the honest fallback toast when onCommand
// returns nothing.
export interface VoiceCoachGrammar<M> extends CommandGrammar<M> {
  describe: (match: M) => string;
  contextualStrings: string[];
}

export interface UseVoiceCoachOptions<M = PlayerVoiceMatch> {
  enabled: boolean;
  playing: boolean;
  // Executes the accepted command against the target surface and optionally
  // returns the toast label to show. Falling back to the grammar's describe
  // keeps the toast honest even if the caller returns nothing.
  onCommand: (match: M) => string | void;
  // Omit to drive the player grammar (default), or inject a different grammar
  // (e.g. the live-session matcher).
  grammar?: VoiceCoachGrammar<M>;
}

const PLAYER_GRAMMAR: VoiceCoachGrammar<PlayerVoiceMatch> = {
  parse: parsePlayerCommand,
  keyOf: (match) => playerActionKey(match.action),
  describe: (match) => describeCommand(match.action),
  contextualStrings: getSupportedPlayerCommands(),
};

// Debounce key for the player grammar. Distinct commands differ by key so a new
// action fires immediately while a repeat is swallowed inside the window.
function playerActionKey(action: PlayerVoiceAction): string {
  switch (action.kind) {
    case 'seek':
      return `seek:${action.deltaSeconds}`;
    case 'rate_step':
      return `rate_step:${action.direction}`;
    case 'rate_set':
      return `rate_set:${action.rate}`;
    case 'info':
      return `info:${action.query}`;
    default:
      return action.kind;
  }
}

export interface VoiceCoachHandle {
  status: VoiceCoachStatus;
  lastCommandLabel: string | null;
  // Bumps on every accepted command so the UI can re-trigger the toast even
  // when two identical commands fire back to back.
  lastCommandSeq: number;
  unavailableReason: string | null;
  requestPermission: () => Promise<boolean>;
  pushToTalk: () => Promise<void>;
}

function buildStartOptions(
  continuous: boolean,
  contextualStrings: string[],
): ExpoSpeechRecognitionOptions {
  return {
    lang: 'en-US',
    interimResults: true,
    continuous,
    // Forced on-device: keeps the "audio never leaves your device" promise.
    requiresOnDeviceRecognition: true,
    addsPunctuation: false,
    // Bias the recognizer toward the active grammar's command vocabulary.
    contextualStrings,
    iosCategory: {
      category: 'playAndRecord',
      // mixWithOthers so the workout video keeps playing while we listen.
      categoryOptions: ['mixWithOthers', 'defaultToSpeaker', 'allowBluetooth'],
      mode: 'measurement',
    },
    androidIntentOptions: {
      EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
    },
    volumeChangeEventOptions: { enabled: false },
  };
}

export function useVoiceCoach<M = PlayerVoiceMatch>({
  enabled,
  playing,
  onCommand,
  grammar,
}: UseVoiceCoachOptions<M>): VoiceCoachHandle {
  // Default to the player grammar. The cast is safe: when grammar is omitted the
  // caller left M at its PlayerVoiceMatch default, so onCommand accepts it.
  const activeGrammar = (grammar ?? (PLAYER_GRAMMAR as unknown)) as VoiceCoachGrammar<M>;
  const grammarRef = useRef(activeGrammar);
  useEffect(() => {
    grammarRef.current = activeGrammar;
  }, [activeGrammar]);
  const [capability, setCapability] = useState<{ ok: boolean; reason: string | null }>({
    ok: false,
    reason: null,
  });
  const [permission, setPermission] = useState<Permission>('undetermined');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [recognizing, setRecognizing] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  // Give-up state for continuous mode. Distinct from runtimeError so it stops
  // the auto-restart loop without disabling push-to-talk.
  const [handsFreeInterrupted, setHandsFreeInterrupted] = useState<string | null>(null);
  // Bumped to re-run the start effect when the OS ends a session mid-listen.
  const [restartNonce, setRestartNonce] = useState(0);
  const [lastCommandLabel, setLastCommandLabel] = useState<string | null>(null);
  const [lastCommandSeq, setLastCommandSeq] = useState(0);

  const coachStateRef = useRef<VoiceCoachState>(createVoiceCoachState());
  const onCommandRef = useRef(onCommand);
  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  const restartPolicyRef = useRef(createRestartPolicy());
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldListenRef = useRef(false);

  // Capability probe: can this device record, and does it have an on-device
  // recognizer. Both are required before we ever show a listening state.
  useEffect(() => {
    try {
      if (!ExpoSpeechRecognitionModule.supportsRecording()) {
        setCapability({ ok: false, reason: 'This device cannot record audio for voice control.' });
        return;
      }
      if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
        setCapability({
          ok: false,
          reason:
            'On-device speech recognition is not available on this device, so hands-free control stays off to keep your audio private.',
        });
        return;
      }
      setCapability({ ok: true, reason: null });
    } catch {
      setCapability({ ok: false, reason: 'Voice control is not available in this build.' });
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const res = await ExpoSpeechRecognitionModule.getPermissionsAsync();
        if (!mounted) return;
        setPermission(res.granted ? 'granted' : res.canAskAgain ? 'undetermined' : 'denied');
      } catch {
        // Leave as undetermined; the pill offers to request access.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      setAppActive(state === 'active');
      // Transient audio contention (e.g. another app briefly held the mic)
      // typically clears by the time the user foregrounds this screen again.
      // Re-attempt rather than leaving the pill pinned to 'unavailable' forever.
      if (state === 'active') setRuntimeError(null);
    });
    return () => sub.remove();
  }, []);

  const handleTranscript = useCallback((transcript: string) => {
    if (!transcript) return;
    const activeGrammar = grammarRef.current;
    const { state, command } = processTranscriptWith(
      activeGrammar,
      coachStateRef.current,
      transcript,
      Date.now(),
    );
    coachStateRef.current = state;
    if (!command) return;
    const returned = onCommandRef.current(command);
    const label =
      typeof returned === 'string' && returned.length > 0 ? returned : activeGrammar.describe(command);
    setLastCommandLabel(label);
    setLastCommandSeq((seq) => seq + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  // Ask the restart policy whether to re-arm recognition after an OS-driven
  // 'end'. The policy throttles rapid restarts and, if the device keeps cutting
  // out, tells us to give up so we never spin a battery-burning loop. The ref
  // lets the 'wait' timer and the once-registered 'end' listener call the latest
  // closure without re-subscribing.
  const attemptRestartRef = useRef<() => void>(() => {});
  const attemptRestart = useCallback(() => {
    if (!shouldListenRef.current) return;
    const verdict = restartPolicyRef.current.shouldRestart(Date.now());
    if (verdict.kind === 'restart') {
      setRestartNonce((nonce) => nonce + 1);
    } else if (verdict.kind === 'wait') {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        attemptRestartRef.current();
      }, verdict.delayMs);
    } else {
      setHandsFreeInterrupted(HANDS_FREE_INTERRUPTED_MESSAGE);
    }
  }, []);
  attemptRestartRef.current = attemptRestart;

  useSpeechRecognitionEvent('start', () => {
    setRecognizing(true);
    // A successful start proves the mic contention that set runtimeError has
    // cleared; unpin the pill so it can go back to reporting real state.
    setRuntimeError(null);
  });
  // A routine silence timeout ends the session even in continuous mode (common
  // on Android, also iOS). If we still want to listen, re-arm through the restart
  // policy; without this the pill silently freezes on "Voice ready".
  useSpeechRecognitionEvent('end', () => {
    setRecognizing(false);
    if (shouldListenRef.current) attemptRestartRef.current();
  });
  useSpeechRecognitionEvent('result', (event) => {
    handleTranscript(event.results?.[0]?.transcript ?? '');
  });
  useSpeechRecognitionEvent('error', (event) => {
    const code = event.error;
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      setPermission('denied');
    } else if (code === 'audio-capture') {
      setRuntimeError('The microphone is unavailable while a video plays on this device.');
    }
    // no-speech / network / aborted are transient. Per the recognizer contract an
    // 'end' event always follows, and its handler re-arms via the restart policy.
    setRecognizing(false);
  });

  const shouldListen =
    capability.ok &&
    permission === 'granted' &&
    enabled &&
    playing &&
    appActive &&
    !runtimeError &&
    !handsFreeInterrupted;

  useEffect(() => {
    shouldListenRef.current = shouldListen;
  }, [shouldListen]);

  // Turning hands-free off resets the restart budget so a later re-enable starts
  // clean instead of inheriting a give-up. (shouldListen is already false here,
  // so this cannot re-trigger a loop.)
  useEffect(() => {
    if (!enabled) {
      restartPolicyRef.current = createRestartPolicy();
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      setHandsFreeInterrupted(null);
    }
  }, [enabled]);

  // Never leave a pending restart timer running after unmount.
  useEffect(() => {
    return () => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
    };
  }, []);

  // restartNonce is a trigger, not read here: bumping it re-runs the effect so
  // recognition is re-armed (stop from cleanup, then start) after an OS 'end'.
  useEffect(() => {
    if (!shouldListen) {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // best-effort stop
      }
      return;
    }
    try {
      ExpoSpeechRecognitionModule.start(buildStartOptions(true, grammarRef.current.contextualStrings));
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'Voice control could not start.');
    }
    return () => {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // best-effort stop
      }
    };
  }, [shouldListen, restartNonce]);

  const requestPermission = useCallback(async () => {
    try {
      const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setPermission(res.granted ? 'granted' : res.canAskAgain ? 'undetermined' : 'denied');
      return res.granted;
    } catch {
      return false;
    }
  }, []);

  // One-shot capture for loud gyms when continuous listening is toggled off, and
  // the fallback after continuous mode gives up. handsFreeInterrupted deliberately
  // does not gate this: the give-up copy tells the user to use the mic button.
  const pushToTalk = useCallback(async () => {
    if (!capability.ok || runtimeError) return;
    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return;
    }
    try {
      ExpoSpeechRecognitionModule.start(buildStartOptions(false, grammarRef.current.contextualStrings));
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'Voice control could not start.');
    }
  }, [capability.ok, runtimeError, permission, requestPermission]);

  const status = useMemo<VoiceCoachStatus>(() => {
    if (!capability.ok || runtimeError) return 'unavailable';
    if (permission === 'denied') return 'denied';
    if (handsFreeInterrupted) return 'interrupted';
    if (!enabled || permission !== 'granted') return 'off';
    if (!playing || !appActive) return 'paused';
    return recognizing ? 'listening' : 'paused';
  }, [
    capability.ok,
    runtimeError,
    permission,
    handsFreeInterrupted,
    enabled,
    playing,
    appActive,
    recognizing,
  ]);

  return {
    status,
    lastCommandLabel,
    lastCommandSeq,
    unavailableReason: capability.reason ?? runtimeError ?? handsFreeInterrupted,
    requestPermission,
    pushToTalk,
  };
}
