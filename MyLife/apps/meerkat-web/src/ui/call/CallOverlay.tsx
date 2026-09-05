// Plan 25 WP-25H: the in-call overlay (web twin of the mobile call.tsx screen).
//
// UNVERIFIED - pending live browser QA. Presentation only: every phase label reads
// the CallSession state owned by CallProvider (NC-25.1: 'Connected' appears only
// when the session reached phase 'connected' from a real RTCPeerConnection event;
// there is no timer here). The security line distinguishes the true transport:
// direct end-to-end vs relayed through a TURN server, from real ICE candidate-pair
// stats. Video renders only the real MediaStreams the peer connection delivered.
// Web has no OS call surface: this overlay IS the in-app ring for an incoming call.
// The phaseLabel and securityLabel strings are BYTE-IDENTICAL with mobile call.tsx.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CallState } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useCall } from '../../lib/CallProvider';

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

export function CallOverlay(): React.ReactElement | null {
  const m = useMeerkat();
  const {
    activeCall,
    acceptCall,
    declineCall,
    hangupCall,
    cancelCall,
    toggleMic,
    toggleCamera,
    getStreams,
    reportCallPeer,
    historyRevision,
  } = useCall();

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  // Web has no navigator to route away from a terminal call; dismissing a
  // finished call is local overlay state, reset whenever a new callId appears.
  const [dismissedCallId, setDismissedCallId] = useState<string | null>(null);
  // Which call was reported, so the button gives real feedback and cannot be
  // hammered into duplicate rows.
  const [reportedCallId, setReportedCallId] = useState<string | null>(null);

  const peerName = useMemo(() => {
    if (!activeCall) return '';
    const device = m.pairedDevices().find((d) => d.deviceId === activeCall.remoteDeviceId);
    return device?.displayName || `${activeCall.remoteDeviceId.slice(0, 6)}…${activeCall.remoteDeviceId.slice(-4)}`;
  }, [activeCall, m]);

  // Attach the REAL MediaStreams to the <video> elements. historyRevision bumps on
  // every state change, so a late-arriving remote track re-binds. NC-25.1: a stream
  // exists only when the peer connection delivered it.
  useEffect(() => {
    const streams = getStreams();
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = streams.remote;
    if (localVideoRef.current) localVideoRef.current.srcObject = streams.local;
  }, [getStreams, activeCall?.phase, historyRevision]);

  if (!activeCall) return null;
  if (activeCall.callId === dismissedCallId) return null;

  const state = activeCall;
  const ringingIncoming = state.direction === 'incoming' && state.phase === 'ringing';
  const live = LIVE_PHASES.has(state.phase);
  const terminal = TERMINAL_PHASES.has(state.phase);
  const showVideo = state.media === 'video' && live;

  return (
    <div className="mk-call-overlay" role="dialog" aria-modal aria-label={`Call with ${peerName}`}>
      <div className="mk-call-stage">
        {showVideo ? (
          <video ref={remoteVideoRef} className="mk-call-remote-video" autoPlay playsInline />
        ) : null}
        {showVideo && state.localCamOn ? (
          <video ref={localVideoRef} className="mk-call-local-video" autoPlay playsInline muted />
        ) : null}

        <div className="mk-call-info">
          <div className="mk-call-peer">{peerName}</div>
          <div className="mk-call-phase">{phaseLabel(state)}</div>
          <div className="mk-call-security">{securityLabel(state)}</div>
        </div>

        <div className="mk-call-controls">
          {ringingIncoming ? (
            <>
              <button type="button" className="mk-call-round is-danger" onClick={() => { void declineCall(); }}>
                Decline
              </button>
              <button type="button" className="mk-call-round is-accent" onClick={() => { void acceptCall(); }}>
                Accept
              </button>
            </>
          ) : terminal ? (
            <>
              <button
                type="button"
                className="mk-call-btn is-danger-outline"
                disabled={reportedCallId === state.callId}
                onClick={() => {
                  if (reportedCallId === state.callId) return;
                  if (!window.confirm('Report this call? This records a local report for your own review. Nothing is sent to the other person.')) return;
                  reportCallPeer('Reported from call screen');
                  setReportedCallId(state.callId);
                }}
              >
                {reportedCallId === state.callId ? 'Reported on this device' : 'Report'}
              </button>
              <button type="button" className="mk-call-btn" onClick={() => setDismissedCallId(state.callId)}>
                Done
              </button>
            </>
          ) : (
            <>
              <button type="button" className="mk-call-btn" onClick={() => { void toggleMic(); }}>
                {state.localMicOn ? 'Mute' : 'Unmute'}
              </button>
              {state.media === 'video' ? (
                <button type="button" className="mk-call-btn" onClick={() => { void toggleCamera(); }}>
                  {state.localCamOn ? 'Camera off' : 'Camera on'}
                </button>
              ) : null}
              <button
                type="button"
                className="mk-call-btn is-danger"
                onClick={() => { void (live ? hangupCall() : cancelCall()); }}
              >
                {live ? 'Hang up' : 'Cancel'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
