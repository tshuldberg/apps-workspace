// Plan 25 WP-25I: the community voice/video room screen.
//
// UNVERIFIED - pending dev build + live LiveKit. The honesty logic lives in tested pure
// cores (room-view-core, room-token-client, room-entry); this screen is their presentation.
// It never shows "In room" until reduceRoomView reaches phase 'joined' from a real backend
// Connected event, and the security banner reads exactly what roomSecurityCopy returns for
// the room-wide E2EE state. Off a dev build the LiveKit SDK is absent and the screen says so.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic, MicOff, Video, MonitorUp, Hand, PhoneOff, ArrowLeft } from 'lucide-react-native';
import { CommunityThemeProvider } from '../../../providers/CommunityThemeProvider';
import { useAppThemeColors, useMkStyles } from '../../../providers/AppThemeProvider';
import { useIdentity } from '../../../providers/IdentityProvider';
import { useMeerkatDatabase } from '../../../providers/DatabaseProvider';
import { channelArchived, getCommunity, getCurrentEpochKey } from '@mylife/sync';
import type { MkColors } from '../../../theme/tokens';
import {
  canUseControl,
  initialRoomViewState,
  reduceRoomView,
  roomSecurityCopy,
  type RoomEvent,
} from '../../../data/room-view-core';
import { requestRoomToken } from '../../../data/room-token-client';
import { connectLiveKitRoom, type RoomLiveKitSession } from '../../../data/room-livekit-adapter';
import { resolveRoomLaunch, roomUnavailableCopy, type RoomLaunchPlan } from '../../../data/room-entry';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function firstHttpsHost(hosts: readonly string[]): string | null {
  const host = hosts.find((h) => /^https?:\/\//i.test(h));
  return host ? host.replace(/\/+$/, '') : null;
}

export default function RoomRoute() {
  const params = useLocalSearchParams<{ communityId: string; channelId: string }>();
  return (
    <CommunityThemeProvider communityId={param(params.communityId)}>
      <RoomScreen />
    </CommunityThemeProvider>
  );
}

function RoomScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const params = useLocalSearchParams<{ communityId: string; channelId: string }>();
  const communityId = param(params.communityId);
  const channelId = param(params.channelId);

  const [state, dispatch] = useReducer(reduceRoomView, undefined, initialRoomViewState);
  const [needsDevBuild, setNeedsDevBuild] = useState(false);
  const sessionRef = useRef<RoomLiveKitSession | null>(null);

  const launch = useMemo(() => {
    const community = getCommunity(db, communityId);
    const epochKey = identity ? getCurrentEpochKey(db, communityId, identity) : null;
    const livekitUrl = String((Constants.expoConfig?.extra as { livekitUrl?: unknown } | undefined)?.livekitUrl ?? '');
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
    // reach the honest 'failed' phase, never strand the screen on
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
        // SDK absent (Expo Go / not a dev build): the connect never claimed to join.
        setNeedsDevBuild(true);
        return;
      }
      sessionRef.current = session;
    } catch {
      dispatch({ type: 'failed', reason: 'connect_failed' });
    }
  }, []);

  useEffect(() => {
    if (launch.ok) void join(launch.plan);
    return () => { void sessionRef.current?.disconnect().catch(() => undefined); sessionRef.current = null; };
  }, [launch, join]);

  const leave = useCallback(() => {
    void sessionRef.current?.disconnect().catch(() => undefined);
    sessionRef.current = null;
    dispatch({ type: 'left', reason: 'left' });
    // A deep link / relaunch restore can make the room the only route.
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/channel/[communityId]/[channelId]', params: { communityId, channelId } });
  }, [router, communityId, channelId]);

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
      setControlError('Could not change that. Check the app permission in system settings.');
    });
  }, [state.participants]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <Pressable accessibilityRole="button" hitSlop={10} onPress={leave} style={styles.iconBtn}>
        <ArrowLeft size={20} color={c.text} strokeWidth={1.9} />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.title} numberOfLines={1}>Room</Text>
        <Text style={styles.security} numberOfLines={1}>{roomSecurityCopy(state.securityMode)}</Text>
      </View>
    </View>
  );

  if (!launch.ok) {
    return (
      <View style={styles.fill}>
        {header}
        <View style={styles.center}><Text style={styles.notice}>{roomUnavailableCopy(launch.reason)}</Text></View>
      </View>
    );
  }

  if (needsDevBuild) {
    return (
      <View style={styles.fill}>
        {header}
        <View style={styles.center}>
          <Text style={styles.notice}>Voice and video rooms need the full app build. They are not available in Expo Go.</Text>
        </View>
      </View>
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
  const connectingUi = state.phase === 'authorizing' || state.phase === 'connecting' || state.phase === 'idle';

  return (
    <View style={styles.fill}>
      {header}
      <View style={styles.phaseRow}>
        {(connectingUi || state.phase === 'reconnecting') && <ActivityIndicator size="small" color={c.accent} />}
        <Text style={styles.phase}>{phaseLabel[state.phase] ?? state.phase}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {state.participants.map((p) => (
          <View key={p.id} style={[styles.tile, p.speaking && styles.tileSpeaking]}>
            <Text style={styles.tileId} numberOfLines={1}>{p.isLocal ? 'You' : `${p.id.slice(0, 6)}`}</Text>
            <View style={styles.tileIcons}>
              {p.micOn ? <Mic size={14} color={c.text} /> : <MicOff size={14} color={c.textSecondary} />}
              {p.camOn ? <Video size={14} color={c.text} /> : null}
              {p.screenOn ? <MonitorUp size={14} color={c.text} /> : null}
              {p.handRaised ? <Hand size={14} color={c.warning} /> : null}
            </View>
          </View>
        ))}
        {state.participants.length === 0 && state.phase === 'joined' && (
          <Text style={styles.notice}>You are the only one here.</Text>
        )}
      </ScrollView>

      {controlError ? (
        <Text style={styles.controlError}>{controlError}</Text>
      ) : null}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
        {canUseControl(state.localPermissions, 'mic') && (
          <ControlButton
            onPress={() => toggleControl('mic')}
            label={local?.micOn ? 'Mute' : 'Mic'}
            icon={local?.micOn ? <Mic size={20} color={c.text} /> : <MicOff size={20} color={c.text} />}
            styles={styles}
          />
        )}
        {canUseControl(state.localPermissions, 'camera') && (
          <ControlButton
            onPress={() => toggleControl('camera')}
            label={local?.camOn ? 'Camera off' : 'Camera'}
            icon={<Video size={20} color={c.text} />}
            styles={styles}
          />
        )}
        {canUseControl(state.localPermissions, 'screen') && (
          <ControlButton
            onPress={() => toggleControl('screen')}
            label={local?.screenOn ? 'Stop share' : 'Share'}
            icon={<MonitorUp size={20} color={c.text} />}
            styles={styles}
          />
        )}
        <ControlButton onPress={leave} label="Leave" icon={<PhoneOff size={20} color={c.danger} />} styles={styles} danger />
      </View>
    </View>
  );
}

function ControlButton(props: { onPress: () => void; label: string; icon: React.ReactNode; styles: ReturnType<typeof makeStyles>; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} style={[props.styles.control, props.danger && props.styles.controlDanger]}>
      {props.icon}
      <Text style={[props.styles.controlLabel, props.danger && props.styles.controlLabelDanger]}>{props.label}</Text>
    </Pressable>
  );
}

function makeStyles(c: MkColors) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.surfaceHigh },
    iconBtn: { padding: 6 },
    headerText: { flex: 1 },
    title: { color: c.text, fontSize: 17, fontWeight: '600' },
    security: { color: c.textSecondary, fontSize: 12, marginTop: 1 },
    phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
    phase: { color: c.textSecondary, fontSize: 14 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
    tile: { width: '47%', aspectRatio: 1, borderRadius: 14, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.surfaceHigh, padding: 12, justifyContent: 'space-between' },
    tileSpeaking: { borderColor: c.accent, borderWidth: 2 },
    tileId: { color: c.text, fontSize: 14, fontWeight: '500' },
    tileIcons: { flexDirection: 'row', gap: 8 },
    notice: { color: c.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 21 },
    controlError: { color: c.danger, fontSize: 12, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 4 },
    controls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 12, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.surfaceHigh },
    control: { alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12 },
    controlDanger: {},
    controlLabel: { color: c.textSecondary, fontSize: 12 },
    controlLabelDanger: { color: c.danger },
  });
}
