// Plan 25 WP-25I: the community voice/video room screen (web twin of the mobile
// room/[communityId]/[channelId].tsx screen).
//
// UNVERIFIED - pending live LiveKit QA. The honesty logic lives in tested pure cores
// (room-view-core, room-token-client, room-entry); this screen is their presentation.
// It never shows "In room" until reduceRoomView reaches phase 'joined' from a real
// backend Connected event, and the security banner reads exactly what roomSecurityCopy
// returns for the room-wide E2EE state. The LiveKit URL comes from a web config seam
// (VITE_MEERKAT_LIVEKIT_URL; empty string = rooms honestly off). When the SDK is absent
// or unconfigured the screen says so; it never fabricates a joined state.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { channelArchived, getCommunity, getCurrentEpochKey } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  canUseControl,
  initialRoomViewState,
  reduceRoomView,
  roomSecurityCopy,
  type RoomEvent,
} from '../../lib/room-view-core';
import { requestRoomToken } from '../../lib/room-token-client';
import { connectLiveKitRoom, type RoomLiveKitSession } from '../../lib/room-livekit-adapter';
import { resolveRoomLaunch, roomUnavailableCopy, type RoomLaunchPlan } from '../../lib/room-entry';

function firstHttpsHost(hosts: readonly string[]): string | null {
  const host = hosts.find((h) => /^https?:\/\//i.test(h));
  return host ? host.replace(/\/+$/, '') : null;
}

export function RoomView({
  communityId,
  channelId,
  onLeave,
}: {
  communityId: string;
  channelId: string;
  onLeave: () => void;
}): React.ReactElement {
  const m = useMeerkat();
  const { db, identity } = m;

  const [state, dispatch] = useReducer(reduceRoomView, undefined, initialRoomViewState);
  const [needsSdk, setNeedsSdk] = useState(false);
  const sessionRef = useRef<RoomLiveKitSession | null>(null);

  const launch = useMemo(() => {
    const community = getCommunity(db, communityId);
    const epochKey = identity ? getCurrentEpochKey(db, communityId, identity) : null;
    const livekitUrl = String(
      (import.meta as unknown as { env?: Record<string, string | undefined> }).env
        ?.VITE_MEERKAT_LIVEKIT_URL ?? '',
    );
    const descriptorChannel = community?.descriptor.channels.find((item) => item.id === channelId) ?? null;
    return resolveRoomLaunch({
      identity,
      communityId,
      roomId: channelId,
      descriptorRevision: community?.descriptor.revision ?? null,
      epoch: epochKey?.epoch ?? null,
      communityNodeBaseUrl: community ? firstHttpsHost(community.descriptor.hosts) : null,
      livekitUrl,
      archived: descriptorChannel ? channelArchived(descriptorChannel) : false,
    });
  }, [db, identity, communityId, channelId]);

  const join = useCallback(async (plan: RoomLaunchPlan) => {
    // The whole join path is caught: a thrown token request or SDK connect must
    // reach the honest 'failed' phase, never strand the view on
    // "Checking membership..." with the rejection swallowed.
    try {
      dispatch({ type: 'authorizing' });
      const tokenResult = await requestRoomToken({
        member: plan.member,
        communityId: plan.communityId,
        roomId: plan.roomId,
        descriptorRevision: plan.descriptorRevision,
        epoch: plan.epoch,
        requestedPermissions: plan.requestedPermissions,
        baseUrl: plan.communityNodeBaseUrl,
        fetchImpl: fetch,
      });
      if (!tokenResult.ok) {
        dispatch({ type: 'failed', reason: tokenResult.error });
        return;
      }
      dispatch({ type: 'connecting', localParticipantId: tokenResult.grant.ephemeralParticipantId, localPermissions: tokenResult.grant.permissions });
      const onEvent = (event: RoomEvent) => dispatch(event);
      const session = await connectLiveKitRoom({ livekitWsUrl: plan.livekitWsUrl, token: tokenResult.grant.token, onEvent });
      if (!session) {
        // SDK absent / connect failed: the connect never claimed to join.
        setNeedsSdk(true);
        return;
      }
      sessionRef.current = session;
    } catch {
      dispatch({ type: 'failed', reason: 'connect_failed' });
    }
  }, []);

  useEffect(() => {
    if (launch.ok) void join(launch.plan);
    return () => { void sessionRef.current?.disconnect(); sessionRef.current = null; };
  }, [launch, join]);

  const leave = useCallback(() => {
    void sessionRef.current?.disconnect();
    sessionRef.current = null;
    dispatch({ type: 'left', reason: 'left' });
    onLeave();
  }, [onLeave]);

  // Real local mic/cam/screen state from the reduced participant snapshots; the
  // controls TOGGLE off that truth (the prior hardcoded `true` could never mute).
  const local = state.participants.find((p) => p.isLocal) ?? null;
  const [controlError, setControlError] = useState<string | null>(null);
  const toggleControl = useCallback((kind: 'mic' | 'camera' | 'screen') => {
    const session = sessionRef.current;
    const current = state.participants.find((p) => p.isLocal) ?? null;
    if (!session || !current) return;
    setControlError(null);
    const next = kind === 'mic' ? !current.micOn : kind === 'camera' ? !current.camOn : !current.screenOn;
    const run = kind === 'mic'
      ? session.setMic(next)
      : kind === 'camera'
        ? session.setCamera(next)
        : session.setScreenShare(next);
    run.catch(() => {
      setControlError('Could not change that. Check the browser permission for this site.');
    });
  }, [state.participants]);

  const header = (
    <header className="mk-room-head mk-dm-thread-head">
      <button type="button" className="mk-icon-btn" aria-label="Leave room" onClick={leave}>←</button>
      <div className="mk-room-titles">
        <div className="mk-room-title">Room</div>
        <div className="mk-room-security">{roomSecurityCopy(state.securityMode)}</div>
      </div>
    </header>
  );

  if (!launch.ok) {
    return (
      <div className="mk-main-scroll mk-room">
        {header}
        <div className="mk-box is-info" role="status">{roomUnavailableCopy(launch.reason)}</div>
      </div>
    );
  }

  if (needsSdk) {
    return (
      <div className="mk-main-scroll mk-room">
        {header}
        <div className="mk-box is-info" role="status">
          Voice and video rooms are not available here. This build has no LiveKit connection configured, or the room could not connect.
        </div>
      </div>
    );
  }

  const phaseLabel: Record<string, string> = {
    idle: 'Starting...',
    authorizing: 'Checking membership...',
    connecting: 'Connecting...',
    joined: 'In room',
    reconnecting: 'Reconnecting...',
    left: 'Call ended',
    failed: `Could not join${state.endReason ? `: ${state.endReason}` : ''}`,
  };

  return (
    <div className="mk-main-scroll mk-room">
      {header}
      <div className="mk-room-phase">{phaseLabel[state.phase] ?? state.phase}</div>

      <div className="mk-room-grid">
        {state.participants.map((p) => (
          <div key={p.id} className={`mk-room-tile ${p.speaking ? 'is-speaking' : ''}`}>
            <div className="mk-room-tile-id">{p.isLocal ? 'You' : p.id.slice(0, 6)}</div>
            <div className="mk-room-tile-icons">
              <span aria-label={p.micOn ? 'Microphone on' : 'Microphone off'}>{p.micOn ? '🎙' : '🔇'}</span>
              {p.camOn ? <span aria-label="Camera on">🎥</span> : null}
              {p.screenOn ? <span aria-label="Sharing screen">🖥</span> : null}
              {p.handRaised ? <span aria-label="Hand raised">✋</span> : null}
            </div>
          </div>
        ))}
        {state.participants.length === 0 && state.phase === 'joined' ? (
          <p className="mk-muted">You are the only one here.</p>
        ) : null}
      </div>

      {controlError ? (
        <div className="mk-file-card-status is-error" role="alert">{controlError}</div>
      ) : null}
      <div className="mk-room-controls">
        {canUseControl(state.localPermissions, 'mic') ? (
          <button type="button" className="mk-call-btn" onClick={() => toggleControl('mic')}>{local?.micOn ? 'Mute' : 'Mic'}</button>
        ) : null}
        {canUseControl(state.localPermissions, 'camera') ? (
          <button type="button" className="mk-call-btn" onClick={() => toggleControl('camera')}>{local?.camOn ? 'Camera off' : 'Camera'}</button>
        ) : null}
        {canUseControl(state.localPermissions, 'screen') ? (
          <button type="button" className="mk-call-btn" onClick={() => toggleControl('screen')}>{local?.screenOn ? 'Stop share' : 'Share'}</button>
        ) : null}
        <button type="button" className="mk-call-btn is-danger" onClick={leave}>Leave</button>
      </div>
    </div>
  );
}
