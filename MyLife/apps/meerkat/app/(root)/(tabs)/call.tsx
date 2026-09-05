// Plan 25 WP-25G: the direct 1:1 voice/video call screen.
//
// UNVERIFIED - pending dev build + two-device live QA. Presentation only: every
// phase label reads the CallSession state owned by CallProvider (NC-25.1:
// 'Connected' appears only when the session reached phase 'connected' from a
// real RTCPeerConnection event; there is no timer here). The security line
// distinguishes the true transport: direct end-to-end vs relayed through a
// TURN server, from real ICE candidate-pair stats. Video renders only streams
// the peer connection actually delivered. The audible ring for background/
// terminated states is the OS surface via WP-25F (CallKit/Telecom); this
// screen is the in-app ring while the app is foregrounded.

import { useCallback, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RefreshCcw,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react-native';
import type { CallState } from '@mylife/sync';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { useCall } from '../providers/CallProvider';
import { useSync } from '../providers/SyncProvider';
import { shortHex, type MkColors } from '../theme/tokens';

interface RtcViewProps {
  streamURL: string;
  style?: unknown;
  objectFit?: 'contain' | 'cover';
  mirror?: boolean;
  zOrder?: number;
}

/** Lazy RTCView; null off a dev build (video then states itself unavailable). */
function loadRtcView(): ComponentType<RtcViewProps> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@livekit/react-native-webrtc') as { RTCView?: ComponentType<RtcViewProps> };
    return mod?.RTCView ?? null;
  } catch {
    return null;
  }
}

function phaseLabel(state: CallState): string {
  switch (state.phase) {
    case 'idle':
      return 'Starting…';
    case 'inviting':
    case 'ringing':
      return state.direction === 'outgoing'
        ? 'Calling…'
        : `Incoming ${state.media} call`;
    case 'accepted':
    case 'negotiating':
      return 'Connecting…';
    case 'connected':
      return 'Connected';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'ended':
      return 'Call ended';
    case 'failed':
      return 'Could not connect';
    case 'missed':
      return state.direction === 'outgoing' ? 'No answer' : 'Missed call';
    case 'declined':
      return state.direction === 'outgoing' ? 'Call declined' : 'Declined';
    case 'busy':
      return 'Busy';
    case 'cancelled':
      return 'Call cancelled';
    default:
      return state.phase;
  }
}

/** Honest transport copy from the real negotiated path only. */
function securityLabel(state: CallState): string {
  if (state.phase !== 'connected' && state.phase !== 'reconnecting') {
    return 'Encrypted call';
  }
  if (!state.transport) return 'End-to-end encrypted. Connection route not yet confirmed.';
  return state.transport === 'turn'
    ? 'End-to-end encrypted, relayed through a TURN server'
    : 'End-to-end encrypted, device to device';
}

const LIVE_PHASES = new Set(['accepted', 'negotiating', 'connected', 'reconnecting']);
const TERMINAL_PHASES = new Set(['ended', 'failed', 'missed', 'declined', 'busy', 'cancelled']);

export default function CallScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    activeCall,
    acceptCall,
    declineCall,
    hangupCall,
    cancelCall,
    toggleMic,
    toggleCamera,
    switchCamera,
    setAudioRoute,
    getStreamUrls,
    reportCallPeer,
  } = useCall();
  const { pairedDevices } = useSync();

  const RtcView = useMemo(loadRtcView, []);

  // Reported state so the Report button gives real feedback and cannot be
  // hammered into duplicate rows; reset implicitly when a new call replaces
  // this screen (the component remounts per navigation).
  const [reported, setReported] = useState(false);

  // The call screen is pushed by the provider (including for incoming calls),
  // so it can be the stack's only route: back needs a fallback.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/calls');
  }, [router]);

  const confirmReport = useCallback(() => {
    if (reported) return;
    Alert.alert(
      'Report this call?',
      'This records a local report for your own review. Nothing is sent to the other person.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            reportCallPeer('Reported from call screen');
            setReported(true);
          },
        },
      ],
    );
  }, [reported, reportCallPeer]);

  const peerName = useMemo(() => {
    if (!activeCall) return '';
    const device = pairedDevices.find((d) => d.deviceId === activeCall.remoteDeviceId);
    return device?.displayName || shortHex(activeCall.remoteDeviceId);
  }, [activeCall, pairedDevices]);

  if (!activeCall) {
    return (
      <View style={[styles.fill, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.notice}>No active call.</Text>
        <Pressable accessibilityRole="button" onPress={goBack} style={styles.doneBtn}>
          <Text style={styles.doneBtnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const state = activeCall;
  const ringingIncoming = state.direction === 'incoming' && state.phase === 'ringing';
  const outgoingPending = state.direction === 'outgoing'
    && (state.phase === 'inviting' || state.phase === 'ringing');
  const live = LIVE_PHASES.has(state.phase);
  const terminal = TERMINAL_PHASES.has(state.phase);
  const busyUi = state.phase === 'accepted' || state.phase === 'negotiating' || state.phase === 'reconnecting';

  const streams = getStreamUrls();
  const showVideo = state.media === 'video' && live && RtcView !== null;

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 10 }]}>
      {showVideo && streams.remote ? (
        <View style={styles.videoLayer}>
          <RtcView streamURL={streams.remote} style={styles.remoteVideo} objectFit="cover" />
        </View>
      ) : null}
      {showVideo && streams.local && state.localCamOn ? (
        <View style={styles.pip}>
          <RtcView streamURL={streams.local} style={styles.pipVideo} objectFit="cover" mirror zOrder={1} />
        </View>
      ) : null}

      <View style={styles.info}>
        <Text style={styles.peer} numberOfLines={1}>{peerName}</Text>
        <View style={styles.phaseRow}>
          {(outgoingPending || busyUi) && <ActivityIndicator size="small" color={c.accent} />}
          <Text style={styles.phase}>{phaseLabel(state)}</Text>
        </View>
        <Text style={styles.security}>{securityLabel(state)}</Text>
        {state.media === 'video' && live && RtcView === null ? (
          <Text style={styles.noticeSmall}>
            Video needs the full app build. Voice continues without it.
          </Text>
        ) : null}
      </View>

      <View style={{ flex: 1 }} />

      {ringingIncoming ? (
        <View style={[styles.answerRow, { paddingBottom: insets.bottom + 24 }]}>
          <RoundAction
            label="Decline"
            danger
            onPress={() => { void declineCall(); }}
            icon={<PhoneOff size={26} color="#FFFFFF" />}
            styles={styles}
          />
          <RoundAction
            label="Accept"
            accent
            onPress={() => { void acceptCall(); }}
            icon={<Phone size={26} color="#FFFFFF" />}
            styles={styles}
          />
        </View>
      ) : terminal ? (
        <View style={[styles.answerRow, { paddingBottom: insets.bottom + 24 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: reported }}
            disabled={reported}
            onPress={confirmReport}
            style={[styles.reportBtn, reported && styles.reportBtnDone]}
          >
            <Text style={styles.reportBtnText}>{reported ? 'Reported on this device' : 'Report'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={goBack} style={styles.doneBtn}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
          <ControlButton
            onPress={() => { void toggleMic(); }}
            label={state.localMicOn ? 'Mute' : 'Unmute'}
            icon={state.localMicOn
              ? <Mic size={20} color={c.text} />
              : <MicOff size={20} color={c.warning} />}
            styles={styles}
          />
          {state.media === 'video' ? (
            <>
              <ControlButton
                onPress={() => { void toggleCamera(); }}
                label={state.localCamOn ? 'Camera off' : 'Camera on'}
                icon={state.localCamOn
                  ? <Video size={20} color={c.text} />
                  : <VideoOff size={20} color={c.warning} />}
                styles={styles}
              />
              <ControlButton
                onPress={() => { void switchCamera(); }}
                label="Flip"
                icon={<Camera size={20} color={c.text} />}
                styles={styles}
              />
            </>
          ) : null}
          <ControlButton
            onPress={() => { void setAudioRoute('speaker'); }}
            label="Speaker"
            icon={<Volume2 size={20} color={c.text} />}
            styles={styles}
          />
          {state.phase === 'reconnecting' ? (
            <ControlButton
              onPress={() => undefined}
              label="Reconnecting"
              icon={<RefreshCcw size={20} color={c.warning} />}
              styles={styles}
            />
          ) : null}
          <ControlButton
            onPress={() => { void (live ? hangupCall() : cancelCall()); }}
            label={live ? 'Hang up' : 'Cancel'}
            icon={<PhoneOff size={20} color={c.danger} />}
            styles={styles}
            danger
          />
        </View>
      )}
    </View>
  );
}

function RoundAction(props: {
  onPress: () => void;
  label: string;
  icon: ReactNode;
  styles: ReturnType<typeof makeStyles>;
  danger?: boolean;
  accent?: boolean;
}) {
  return (
    <View style={props.styles.roundWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.label}
        onPress={props.onPress}
        style={[
          props.styles.roundBtn,
          props.danger && props.styles.roundBtnDanger,
          props.accent && props.styles.roundBtnAccent,
        ]}
      >
        {props.icon}
      </Pressable>
      <Text style={props.styles.roundLabel}>{props.label}</Text>
    </View>
  );
}

function ControlButton(props: {
  onPress: () => void;
  label: string;
  icon: ReactNode;
  styles: ReturnType<typeof makeStyles>;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      style={props.styles.control}
    >
      {props.icon}
      <Text style={[props.styles.controlLabel, props.danger && props.styles.controlLabelDanger]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function makeStyles(c: MkColors) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: c.background },
    center: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
    videoLayer: { ...StyleSheet.absoluteFillObject },
    remoteVideo: { flex: 1 },
    pip: {
      position: 'absolute',
      top: 90,
      right: 16,
      width: 104,
      height: 150,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.surfaceHigh,
      backgroundColor: c.surface,
    },
    pipVideo: { flex: 1 },
    info: { alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingTop: 40 },
    peer: { color: c.text, fontSize: 26, fontWeight: '700' },
    phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    phase: { color: c.textSecondary, fontSize: 16 },
    security: { color: c.textSecondary, fontSize: 12, marginTop: 4 },
    notice: { color: c.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 21 },
    noticeSmall: { color: c.warning, fontSize: 12, textAlign: 'center', marginTop: 8 },
    answerRow: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      paddingTop: 16,
    },
    roundWrap: { alignItems: 'center', gap: 8 },
    roundBtn: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceHigh,
    },
    roundBtnDanger: { backgroundColor: '#C63C36' },
    roundBtnAccent: { backgroundColor: '#19805F' },
    roundLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    controls: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      paddingTop: 12,
      paddingHorizontal: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.surfaceHigh,
    },
    control: { alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10 },
    controlLabel: { color: c.textSecondary, fontSize: 11.5 },
    controlLabelDanger: { color: c.danger },
    doneBtn: {
      backgroundColor: c.surfaceHigh,
      borderRadius: 12,
      paddingHorizontal: 22,
      paddingVertical: 12,
    },
    doneBtnText: { color: c.text, fontSize: 15, fontWeight: '700' },
    reportBtn: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.danger,
      paddingHorizontal: 22,
      paddingVertical: 12,
    },
    reportBtnDone: { opacity: 0.55 },
    reportBtnText: { color: c.danger, fontSize: 15, fontWeight: '700' },
  });
}
