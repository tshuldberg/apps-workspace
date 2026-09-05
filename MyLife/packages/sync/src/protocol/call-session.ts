import type { DeviceIdentity } from '../types';
import { hexToBytes } from '../encryption/keys';
import {
  createCallSignal,
  decryptCallPayload,
  deriveCallSignalToken,
  encryptCallPayload,
  resolveCallGlare,
  verifyCallSignal,
  type CallSignal,
  type CallSignalKind,
} from './call-signal';

export type CallPhase =
  | 'idle'
  | 'inviting'
  | 'ringing'
  | 'accepted'
  | 'negotiating'
  | 'connected'
  | 'reconnecting'
  | 'ended'
  | 'failed'
  | 'missed'
  | 'declined'
  | 'busy'
  | 'cancelled';

export type CallIceState =
  | 'new'
  | 'checking'
  | 'connected'
  | 'completed'
  | 'disconnected'
  | 'failed'
  | 'closed';

export type CallEndReason =
  | 'local_declined'
  | 'remote_declined'
  | 'local_busy'
  | 'remote_busy'
  | 'local_cancelled'
  | 'remote_cancelled'
  | 'superseded'
  | 'local_hangup'
  | 'remote_hangup'
  | 'no_answer'
  | 'negotiation_timeout'
  | 'negotiation_failed'
  | 'signal_send_failed'
  | 'ice_failed'
  | 'ice_candidate_failed'
  | 'ice_candidate_overflow'
  | 'reconnect_timeout'
  | 'restart_failed'
  | 'unexpected_close'
  | 'duration_limit';

export interface CallState {
  phase: CallPhase;
  media: 'voice' | 'video';
  direction: 'incoming' | 'outgoing';
  callId: string;
  remoteDeviceId: string;
  securityMode: 'direct_e2e' | 'direct_turn_relayed';
  /** Current route evidence; absent while diagnostics are unavailable or reconnecting. */
  transport?: 'direct' | 'turn';
  iceState: CallIceState;
  localMicOn: boolean;
  localCamOn: boolean;
  startedAt?: number;
  endedAt?: number;
  endReason?: CallEndReason;
}

export interface CallSessionDescription {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface CallIceCandidate {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export type CallMediaConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface CallMediaConnectionEvent {
  connectionState: CallMediaConnectionState;
  iceState: CallIceState;
  transport?: 'direct' | 'turn';
}

export interface CallMediaPeerSession {
  createOffer(options?: { iceRestart?: boolean }): Promise<CallSessionDescription>;
  createAnswer(): Promise<CallSessionDescription>;
  applyRemoteSdp(description: CallSessionDescription): Promise<void>;
  addIceCandidate(candidate: CallIceCandidate): Promise<void>;
  onIceCandidate(listener: (candidate: CallIceCandidate | null) => void): (() => void) | void;
  onConnectionStateChange(
    listener: (event: CallMediaConnectionEvent) => void,
  ): (() => void) | void;
  setMicrophoneEnabled?(enabled: boolean): Promise<void> | void;
  setCameraEnabled?(enabled: boolean): Promise<void> | void;
  close(): Promise<void> | void;
}

export interface StartCallPeerConnectionInput {
  callId: string;
  media: CallState['media'];
  role: 'offerer' | 'answerer';
  localMicOn: boolean;
  localCamOn: boolean;
}

export interface CallMediaBackend {
  startPeerConnection(
    input: StartCallPeerConnectionInput,
  ): CallMediaPeerSession | Promise<CallMediaPeerSession>;
}

export interface OutboundCallSignal {
  token: string;
  signal: CallSignal;
}

export interface CallSessionLimits {
  inviteTimeoutMs: number;
  negotiationTimeoutMs: number;
  reconnectTimeoutMs: number;
  maxCallDurationMs: number;
  maxPendingOutboundIce: number;
  maxBufferedInboundIce: number;
}

export const DEFAULT_CALL_SESSION_LIMITS: Readonly<CallSessionLimits> = Object.freeze({
  inviteTimeoutMs: 45_000,
  negotiationTimeoutMs: 30_000,
  reconnectTimeoutMs: 15_000,
  maxCallDurationMs: 24 * 60 * 60 * 1_000,
  maxPendingOutboundIce: 64,
  maxBufferedInboundIce: 64,
});

export interface CallSessionDeps {
  identity: DeviceIdentity;
  localDeviceId: string;
  remoteDeviceId: string;
  media: 'voice' | 'video';
  callId: string;
  role: 'caller' | 'callee';
  pairSecretHex: string;
  mediaBackend: CallMediaBackend;
  sendSignal(outbound: OutboundCallSignal): Promise<void>;
  now(): number;
  createNonce(): string;
  hasSeenNonce(nonce: string): boolean;
  recordNonce(nonce: string): void;
  limits?: Partial<CallSessionLimits>;
}

type CallStateListener = (state: CallState) => void;
type TerminalCallPhase = Extract<
  CallPhase,
  'ended' | 'failed' | 'missed' | 'declined' | 'busy' | 'cancelled'
>;

const TERMINAL_PHASES = new Set<CallPhase>([
  'ended',
  'failed',
  'missed',
  'declined',
  'busy',
  'cancelled',
]);
const SDP_MAX_LENGTH = 30 * 1024;
const CANDIDATE_MAX_LENGTH = 4 * 1024;
const CANDIDATE_FIELD_MAX_LENGTH = 256;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTerminalPhase(phase: CallPhase): phase is TerminalCallPhase {
  return TERMINAL_PHASES.has(phase);
}

function positiveLimit(value: number | undefined, fallback: number, integer = false): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return fallback;
  return integer ? Math.floor(value as number) : value as number;
}

function buildLimits(input: Partial<CallSessionLimits> | undefined): CallSessionLimits {
  return {
    inviteTimeoutMs: positiveLimit(
      input?.inviteTimeoutMs,
      DEFAULT_CALL_SESSION_LIMITS.inviteTimeoutMs,
    ),
    negotiationTimeoutMs: positiveLimit(
      input?.negotiationTimeoutMs,
      DEFAULT_CALL_SESSION_LIMITS.negotiationTimeoutMs,
    ),
    reconnectTimeoutMs: positiveLimit(
      input?.reconnectTimeoutMs,
      DEFAULT_CALL_SESSION_LIMITS.reconnectTimeoutMs,
    ),
    maxCallDurationMs: positiveLimit(
      input?.maxCallDurationMs,
      DEFAULT_CALL_SESSION_LIMITS.maxCallDurationMs,
    ),
    maxPendingOutboundIce: positiveLimit(
      input?.maxPendingOutboundIce,
      DEFAULT_CALL_SESSION_LIMITS.maxPendingOutboundIce,
      true,
    ),
    maxBufferedInboundIce: positiveLimit(
      input?.maxBufferedInboundIce,
      DEFAULT_CALL_SESSION_LIMITS.maxBufferedInboundIce,
      true,
    ),
  };
}

function isSessionDescription(
  value: unknown,
  expectedType: CallSessionDescription['type'],
): value is CallSessionDescription {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 2
    && keys.includes('type')
    && keys.includes('sdp')
    && value.type === expectedType
    && typeof value.sdp === 'string'
    && value.sdp.length > 0
    && value.sdp.length <= SDP_MAX_LENGTH;
}

function isNullableBoundedString(value: unknown): value is string | null {
  return value === null
    || (typeof value === 'string' && value.length <= CANDIDATE_FIELD_MAX_LENGTH);
}

function isIceCandidate(value: unknown): value is CallIceCandidate {
  if (!isRecord(value)) return false;
  const allowed = new Set([
    'candidate',
    'sdpMid',
    'sdpMLineIndex',
    'usernameFragment',
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  if (
    typeof value.candidate !== 'string'
    || value.candidate.length > CANDIDATE_MAX_LENGTH
  ) {
    return false;
  }
  if (value.sdpMid !== undefined && !isNullableBoundedString(value.sdpMid)) return false;
  if (
    value.sdpMLineIndex !== undefined
    && value.sdpMLineIndex !== null
    && (!Number.isInteger(value.sdpMLineIndex)
      || (value.sdpMLineIndex as number) < 0
      || (value.sdpMLineIndex as number) > 65_535)
  ) {
    return false;
  }
  return value.usernameFragment === undefined
    || isNullableBoundedString(value.usernameFragment);
}

function isConnectionEvent(value: unknown): value is CallMediaConnectionEvent {
  if (!isRecord(value)) return false;
  const connectionStates = new Set([
    'new',
    'connecting',
    'connected',
    'disconnected',
    'failed',
    'closed',
  ]);
  const iceStates = new Set([
    'new',
    'checking',
    'connected',
    'completed',
    'disconnected',
    'failed',
    'closed',
  ]);
  return typeof value.connectionState === 'string'
    && connectionStates.has(value.connectionState)
    && typeof value.iceState === 'string'
    && iceStates.has(value.iceState)
    && (value.transport === undefined
      || value.transport === 'direct'
      || value.transport === 'turn');
}

function readSdpPayload(
  payload: unknown,
  expectedType: CallSessionDescription['type'],
): CallSessionDescription | null {
  if (!isRecord(payload) || Object.keys(payload).length !== 1) return null;
  return isSessionDescription(payload.sdp, expectedType) ? payload.sdp : null;
}

function readCandidatePayload(payload: unknown): CallIceCandidate | null {
  if (!isRecord(payload) || Object.keys(payload).length !== 1) return null;
  return isIceCandidate(payload.candidate) ? payload.candidate : null;
}

export class CallSession {
  private readonly deps: CallSessionDeps;
  private readonly pairSecretBytes: Uint8Array;
  private readonly limits: CallSessionLimits;
  private readonly listeners = new Set<CallStateListener>();
  private state: CallState;
  private role: CallSessionDeps['role'];
  private deadlineAt: number | undefined;
  private peer: CallMediaPeerSession | null = null;
  private peerStarting: Promise<CallMediaPeerSession | null> | null = null;
  private removeIceListener: (() => void) | null = null;
  private removeConnectionListener: (() => void) | null = null;
  private remoteDescriptionApplied = false;
  private pendingOutboundIce: CallIceCandidate[] = [];
  private bufferedInboundIce: CallIceCandidate[] = [];
  private drainingOutboundIce = false;
  private restartInFlight = false;

  constructor(deps: CallSessionDeps) {
    if (deps.identity.publicKey !== deps.localDeviceId) {
      throw new TypeError('Call signer identity must match localDeviceId');
    }
    if (!/^[0-9a-f]{64}$/u.test(deps.pairSecretHex)) {
      throw new TypeError('pairSecretHex must be 32-byte lowercase hex');
    }
    this.deps = deps;
    this.pairSecretBytes = hexToBytes(deps.pairSecretHex);
    this.limits = buildLimits(deps.limits);
    this.role = deps.role;
    this.state = {
      phase: 'idle',
      media: deps.media,
      direction: deps.role === 'caller' ? 'outgoing' : 'incoming',
      callId: deps.callId,
      remoteDeviceId: deps.remoteDeviceId,
      securityMode: 'direct_e2e',
      iceState: 'new',
      localMicOn: true,
      localCamOn: deps.media === 'video',
    };
  }

  getState(): CallState {
    return { ...this.state };
  }

  subscribe(listener: CallStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  async start(): Promise<void> {
    if (this.role !== 'caller' || this.state.phase !== 'idle') return;
    const now = this.safeNow();
    if (now === null) {
      this.finish('failed', 'negotiation_failed');
      return;
    }
    this.deadlineAt = now + this.limits.inviteTimeoutMs;
    this.patchState({ phase: 'inviting', startedAt: now });
    const sent = await this.sendBuiltSignal('invite');
    if (!sent) {
      this.finish('failed', 'signal_send_failed');
      return;
    }
    if (this.getState().phase === 'inviting') this.patchState({ phase: 'ringing' });
  }

  async acceptIncoming(): Promise<void> {
    if (this.role !== 'callee' || this.state.phase !== 'ringing') return;
    this.deadlineFromNow(this.limits.negotiationTimeoutMs);
    this.patchState({ phase: 'accepted' });
    if (!await this.sendBuiltSignal('accept')) {
      this.finish('failed', 'signal_send_failed');
    }
  }

  async decline(): Promise<void> {
    if (this.role !== 'callee' || this.state.phase !== 'ringing') return;
    const callId = this.state.callId;
    const media = this.state.media;
    this.finish('declined', 'local_declined');
    await this.sendBuiltSignal('decline', undefined, callId, media);
  }

  async busy(): Promise<void> {
    if (this.role !== 'callee' || this.state.phase !== 'ringing') return;
    const callId = this.state.callId;
    const media = this.state.media;
    this.finish('busy', 'local_busy');
    await this.sendBuiltSignal('busy', undefined, callId, media);
  }

  async cancel(): Promise<void> {
    if (
      this.state.phase !== 'inviting'
      && this.state.phase !== 'ringing'
      && this.state.phase !== 'accepted'
      && this.state.phase !== 'negotiating'
    ) {
      return;
    }
    const callId = this.state.callId;
    const media = this.state.media;
    this.finish('cancelled', 'local_cancelled');
    await this.sendBuiltSignal('cancel', undefined, callId, media);
  }

  async hangup(): Promise<void> {
    if (
      this.state.phase !== 'accepted'
      && this.state.phase !== 'negotiating'
      && this.state.phase !== 'connected'
      && this.state.phase !== 'reconnecting'
    ) {
      return;
    }
    const callId = this.state.callId;
    const media = this.state.media;
    this.finish('ended', 'local_hangup');
    await this.sendBuiltSignal('end', undefined, callId, media);
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<boolean> {
    if (isTerminalPhase(this.state.phase)) return false;
    if (this.peer?.setMicrophoneEnabled) {
      try {
        await this.peer.setMicrophoneEnabled(enabled);
      } catch {
        return false;
      }
    } else if (this.peer) {
      return false;
    }
    this.patchState({ localMicOn: enabled });
    return true;
  }

  async setCameraEnabled(enabled: boolean): Promise<boolean> {
    if (isTerminalPhase(this.state.phase) || (enabled && this.state.media === 'voice')) {
      return false;
    }
    if (this.peer?.setCameraEnabled) {
      try {
        await this.peer.setCameraEnabled(enabled);
      } catch {
        return false;
      }
    } else if (this.peer) {
      return false;
    }
    this.patchState({ localCamOn: enabled });
    return true;
  }

  async tick(): Promise<void> {
    const now = this.safeNow();
    if (now === null || isTerminalPhase(this.state.phase) || this.state.phase === 'idle') return;

    if (
      this.state.startedAt !== undefined
      && now - this.state.startedAt >= this.limits.maxCallDurationMs
    ) {
      const callId = this.state.callId;
      const media = this.state.media;
      this.finish('ended', 'duration_limit');
      await this.sendBuiltSignal('end', undefined, callId, media);
      return;
    }
    if (this.deadlineAt === undefined || now < this.deadlineAt) return;

    if (this.state.phase === 'inviting' || this.state.phase === 'ringing') {
      const callId = this.state.callId;
      const media = this.state.media;
      this.finish('missed', 'no_answer');
      if (this.role === 'caller') {
        await this.sendBuiltSignal('cancel', undefined, callId, media);
      }
      return;
    }
    if (this.state.phase === 'accepted' || this.state.phase === 'negotiating') {
      this.finish('failed', 'negotiation_timeout');
      return;
    }
    if (this.state.phase === 'reconnecting') {
      this.finish('ended', 'reconnect_timeout');
    }
  }

  async handleInboundSignal(rawSignal: unknown): Promise<void> {
    try {
      const verified = verifyCallSignal(rawSignal, {
        senderPublicKey: this.deps.remoteDeviceId,
        expectedRecipientDeviceId: this.deps.localDeviceId,
        nowMs: this.deps.now(),
        hasSeenNonce: this.deps.hasSeenNonce,
      });
      if (!verified.ok) return;
      try {
        this.deps.recordNonce(verified.signal.nonce);
      } catch {
        return;
      }
      await this.handleVerifiedSignal(verified.signal);
    } catch {
      // Raw relay input is always fail-closed.
    }
  }

  private async handleVerifiedSignal(signal: CallSignal): Promise<void> {
    if (
      signal.kind === 'invite'
      && signal.callId !== this.state.callId
      && this.role === 'caller'
      && (this.state.phase === 'inviting' || this.state.phase === 'ringing')
    ) {
      await this.handleGlareInvite(signal);
      return;
    }
    if (signal.callId !== this.state.callId || signal.media !== this.state.media) return;

    if (signal.kind === 'invite') {
      if (this.role === 'callee' && this.state.phase === 'idle') this.ringFromInvite();
      return;
    }
    if (isTerminalPhase(this.state.phase)) return;

    switch (signal.kind) {
      case 'accept':
        if (
          this.role === 'caller'
          && (this.state.phase === 'inviting' || this.state.phase === 'ringing')
        ) {
          this.deadlineFromNow(this.limits.negotiationTimeoutMs);
          this.patchState({ phase: 'accepted' });
          await this.beginCallerNegotiation();
        }
        return;
      case 'decline':
        if (
          this.role === 'caller'
          && (this.state.phase === 'inviting'
            || this.state.phase === 'ringing'
            || this.state.phase === 'accepted')
        ) {
          this.finish('declined', 'remote_declined');
        }
        return;
      case 'busy':
        if (
          this.role === 'caller'
          && (this.state.phase === 'inviting'
            || this.state.phase === 'ringing'
            || this.state.phase === 'accepted')
        ) {
          this.finish('busy', 'remote_busy');
        }
        return;
      case 'cancel':
        if (this.state.phase !== 'connected' && this.state.phase !== 'reconnecting') {
          this.finish('cancelled', 'remote_cancelled');
        }
        return;
      case 'end':
        if (this.state.phase !== 'idle') this.finish('ended', 'remote_hangup');
        return;
      case 'offer':
        if (this.role === 'callee') await this.handleRemoteOffer(signal, false);
        return;
      case 'answer':
        if (this.role === 'caller') await this.handleRemoteAnswer(signal);
        return;
      case 'ice':
        await this.handleRemoteIce(signal);
        return;
      case 'restart':
        if (this.role === 'callee') await this.handleRemoteOffer(signal, true);
        return;
    }
  }

  private ringFromInvite(): void {
    const now = this.safeNow();
    if (now === null) return;
    this.deadlineAt = now + this.limits.inviteTimeoutMs;
    this.patchState({ phase: 'ringing', startedAt: now });
  }

  private async handleGlareInvite(signal: CallSignal): Promise<void> {
    const local = {
      callId: this.state.callId,
      fromDeviceId: this.deps.localDeviceId,
    };
    const remote = {
      callId: signal.callId,
      fromDeviceId: signal.fromDeviceId,
    };
    const winner = resolveCallGlare(local, remote);
    if (winner.callId === local.callId && winner.fromDeviceId === local.fromDeviceId) return;

    const losingCallId = this.state.callId;
    const losingMedia = this.state.media;
    this.finish('cancelled', 'superseded');
    await this.sendBuiltSignal('cancel', undefined, losingCallId, losingMedia);
    this.adoptIncomingWinner(signal);
  }

  private adoptIncomingWinner(signal: CallSignal): void {
    this.closePeer();
    this.role = 'callee';
    this.remoteDescriptionApplied = false;
    this.pendingOutboundIce = [];
    this.bufferedInboundIce = [];
    const now = this.safeNow();
    this.state = {
      phase: 'ringing',
      media: signal.media,
      direction: 'incoming',
      callId: signal.callId,
      remoteDeviceId: this.deps.remoteDeviceId,
      securityMode: 'direct_e2e',
      iceState: 'new',
      localMicOn: true,
      localCamOn: signal.media === 'video',
      ...(now === null ? {} : { startedAt: now }),
    };
    this.deadlineAt = now === null ? undefined : now + this.limits.inviteTimeoutMs;
    this.emit();
  }

  private async beginCallerNegotiation(): Promise<void> {
    if (this.role !== 'caller' || this.state.phase !== 'accepted') return;
    const callId = this.state.callId;
    this.deadlineFromNow(this.limits.negotiationTimeoutMs);
    this.patchState({ phase: 'negotiating' });
    const peer = await this.ensurePeer('offerer', callId);
    if (!peer || this.state.callId !== callId || this.getState().phase !== 'negotiating') return;
    try {
      const offer = await peer.createOffer();
      if (!isSessionDescription(offer, 'offer')) throw new TypeError('Invalid local offer');
      if (!await this.sendBuiltSignal('offer', { sdp: offer }, callId)) {
        this.finish('failed', 'signal_send_failed');
      }
    } catch {
      this.finish('failed', 'negotiation_failed');
    }
  }

  private async handleRemoteOffer(signal: CallSignal, restart: boolean): Promise<void> {
    if (
      (!restart && this.state.phase !== 'accepted' && this.state.phase !== 'negotiating')
      || (restart
        && this.state.phase !== 'connected'
        && this.state.phase !== 'reconnecting'
        && this.state.phase !== 'negotiating')
    ) {
      return;
    }
    const description = this.decryptSdp(signal, 'offer');
    if (!description) return;
    const callId = this.state.callId;
    if (restart && this.state.phase === 'connected') {
      this.deadlineFromNow(this.limits.reconnectTimeoutMs);
      this.patchState({ phase: 'reconnecting' });
    } else if (!restart && this.state.phase === 'accepted') {
      this.deadlineFromNow(this.limits.negotiationTimeoutMs);
      this.patchState({ phase: 'negotiating' });
    }

    const peer = await this.ensurePeer('answerer', callId);
    if (!peer || this.state.callId !== callId || isTerminalPhase(this.state.phase)) return;
    try {
      await peer.applyRemoteSdp(description);
      this.remoteDescriptionApplied = true;
      await this.flushBufferedInboundIce();
      const answer = await peer.createAnswer();
      if (!isSessionDescription(answer, 'answer')) throw new TypeError('Invalid local answer');
      if (!await this.sendBuiltSignal('answer', { sdp: answer }, callId)) {
        this.finish('failed', 'signal_send_failed');
      }
    } catch {
      this.finish('failed', restart ? 'restart_failed' : 'negotiation_failed');
    }
  }

  private async handleRemoteAnswer(signal: CallSignal): Promise<void> {
    if (this.state.phase !== 'negotiating' && this.state.phase !== 'reconnecting') return;
    const description = this.decryptSdp(signal, 'answer');
    if (!description || !this.peer) return;
    try {
      await this.peer.applyRemoteSdp(description);
      this.remoteDescriptionApplied = true;
      await this.flushBufferedInboundIce();
    } catch {
      this.finish('failed', 'negotiation_failed');
    }
  }

  private async handleRemoteIce(signal: CallSignal): Promise<void> {
    if (
      this.state.phase !== 'accepted'
      && this.state.phase !== 'negotiating'
      && this.state.phase !== 'connected'
      && this.state.phase !== 'reconnecting'
    ) {
      return;
    }
    if (!signal.payloadCiphertext) return;
    const payload = decryptCallPayload<unknown>(
      this.pairSecretBytes,
      signal.callId,
      signal.payloadCiphertext,
    );
    const candidate = readCandidatePayload(payload);
    if (!candidate) return;
    if (!this.peer || !this.remoteDescriptionApplied) {
      if (this.bufferedInboundIce.length >= this.limits.maxBufferedInboundIce) {
        this.finish('failed', 'ice_candidate_overflow');
        return;
      }
      this.bufferedInboundIce.push(candidate);
      return;
    }
    try {
      await this.peer.addIceCandidate(candidate);
    } catch {
      this.finish('failed', 'ice_candidate_failed');
    }
  }

  private decryptSdp(
    signal: CallSignal,
    expectedType: CallSessionDescription['type'],
  ): CallSessionDescription | null {
    if (!signal.payloadCiphertext) return null;
    const payload = decryptCallPayload<unknown>(
      this.pairSecretBytes,
      signal.callId,
      signal.payloadCiphertext,
    );
    return readSdpPayload(payload, expectedType);
  }

  private async ensurePeer(
    role: StartCallPeerConnectionInput['role'],
    callId: string,
  ): Promise<CallMediaPeerSession | null> {
    if (this.peer) return this.peer;
    if (this.peerStarting) return this.peerStarting;

    const input: StartCallPeerConnectionInput = {
      callId,
      media: this.state.media,
      role,
      localMicOn: this.state.localMicOn,
      localCamOn: this.state.localCamOn,
    };
    this.peerStarting = this.startPeer(input);
    const peer = await this.peerStarting;
    this.peerStarting = null;
    return peer;
  }

  private async startPeer(
    input: StartCallPeerConnectionInput,
  ): Promise<CallMediaPeerSession | null> {
    try {
      const peer = await this.deps.mediaBackend.startPeerConnection(input);
      if (this.state.callId !== input.callId || isTerminalPhase(this.state.phase)) {
        await peer.close();
        return null;
      }
      this.peer = peer;
      const removeIce = peer.onIceCandidate((candidate) => {
        if (candidate) void this.handleLocalIceCandidate(candidate);
      });
      const removeConnection = peer.onConnectionStateChange((event) => {
        this.handleConnectionEvent(event);
      });
      this.removeIceListener = typeof removeIce === 'function' ? removeIce : null;
      this.removeConnectionListener = typeof removeConnection === 'function'
        ? removeConnection
        : null;
      return peer;
    } catch {
      this.finish('failed', 'negotiation_failed');
      return null;
    }
  }

  private async handleLocalIceCandidate(candidate: CallIceCandidate): Promise<void> {
    if (!isIceCandidate(candidate) || isTerminalPhase(this.state.phase)) return;
    if (this.pendingOutboundIce.length >= this.limits.maxPendingOutboundIce) {
      this.finish('failed', 'ice_candidate_overflow');
      return;
    }
    this.pendingOutboundIce.push(candidate);
    await this.drainOutboundIce();
  }

  private async drainOutboundIce(): Promise<void> {
    if (this.drainingOutboundIce) return;
    this.drainingOutboundIce = true;
    try {
      while (this.pendingOutboundIce.length > 0 && !isTerminalPhase(this.state.phase)) {
        const candidate = this.pendingOutboundIce.shift();
        if (!candidate) continue;
        if (!await this.sendBuiltSignal('ice', { candidate })) {
          if (this.state.phase === 'negotiating' || this.state.phase === 'reconnecting') {
            this.finish('failed', 'signal_send_failed');
          }
          return;
        }
      }
    } finally {
      this.drainingOutboundIce = false;
    }
  }

  private async flushBufferedInboundIce(): Promise<void> {
    if (!this.peer || !this.remoteDescriptionApplied) return;
    const buffered = this.bufferedInboundIce.splice(0, this.bufferedInboundIce.length);
    for (const candidate of buffered) {
      if (!this.peer || isTerminalPhase(this.state.phase)) return;
      try {
        await this.peer.addIceCandidate(candidate);
      } catch {
        this.finish('failed', 'ice_candidate_failed');
        return;
      }
    }
  }

  private handleConnectionEvent(rawEvent: unknown): void {
    if (!isConnectionEvent(rawEvent) || !this.peer || isTerminalPhase(this.state.phase)) return;
    const patch: Partial<CallState> = {
      iceState: rawEvent.iceState,
      transport: rawEvent.connectionState === 'connected' ? rawEvent.transport : undefined,
    };
    if (rawEvent.transport === 'turn') patch.securityMode = 'direct_turn_relayed';
    if (rawEvent.transport === 'direct') patch.securityMode = 'direct_e2e';
    this.patchState(patch);

    if (rawEvent.connectionState === 'connected') {
      if (this.state.phase === 'negotiating' || this.state.phase === 'reconnecting') {
        this.deadlineAt = undefined;
        this.patchState({ phase: 'connected' });
      }
      return;
    }
    if (rawEvent.connectionState === 'disconnected' && this.state.phase === 'connected') {
      this.deadlineFromNow(this.limits.reconnectTimeoutMs);
      this.patchState({ phase: 'reconnecting' });
      if (this.role === 'caller') void this.startIceRestart();
      return;
    }
    if (rawEvent.connectionState === 'failed') {
      this.finish('failed', 'ice_failed');
      return;
    }
    if (rawEvent.connectionState === 'closed') {
      if (this.state.phase === 'connected' || this.state.phase === 'reconnecting') {
        this.finish('ended', 'unexpected_close');
      } else if (this.state.phase !== 'idle' && this.state.phase !== 'ringing') {
        this.finish('failed', 'unexpected_close');
      }
    }
  }

  private async startIceRestart(): Promise<void> {
    if (this.restartInFlight || this.role !== 'caller' || !this.peer) return;
    this.restartInFlight = true;
    const callId = this.state.callId;
    try {
      const offer = await this.peer.createOffer({ iceRestart: true });
      if (!isSessionDescription(offer, 'offer')) throw new TypeError('Invalid restart offer');
      if (this.state.callId !== callId || this.state.phase !== 'reconnecting') return;
      if (!await this.sendBuiltSignal('restart', { sdp: offer }, callId)) {
        this.finish('failed', 'signal_send_failed');
      }
    } catch {
      this.finish('failed', 'restart_failed');
    } finally {
      this.restartInFlight = false;
    }
  }

  private async sendBuiltSignal(
    kind: CallSignalKind,
    payload?: unknown,
    callId = this.state.callId,
    media = this.state.media,
  ): Promise<boolean> {
    try {
      const payloadCiphertext = payload === undefined
        ? undefined
        : encryptCallPayload(this.pairSecretBytes, callId, payload);
      const result = createCallSignal({
        sender: this.deps.identity,
        callId,
        kind,
        toDeviceId: this.deps.remoteDeviceId,
        media,
        ...(payloadCiphertext === undefined ? {} : { payloadCiphertext }),
        nowMs: this.deps.now(),
        nonce: this.deps.createNonce(),
      });
      if (!result.ok) return false;
      await this.deps.sendSignal({
        token: deriveCallSignalToken(this.deps.pairSecretHex, callId),
        signal: result.signal,
      });
      return true;
    } catch {
      return false;
    }
  }

  private finish(phase: TerminalCallPhase, endReason: CallEndReason): void {
    if (isTerminalPhase(this.state.phase)) return;
    this.deadlineAt = undefined;
    this.pendingOutboundIce = [];
    this.bufferedInboundIce = [];
    this.patchState({
      phase,
      endedAt: this.safeNow() ?? this.state.startedAt ?? 0,
      endReason,
    });
    this.closePeer();
  }

  private closePeer(): void {
    try {
      this.removeIceListener?.();
    } catch {
      // A backend cleanup failure cannot reopen a terminal call.
    }
    try {
      this.removeConnectionListener?.();
    } catch {
      // A backend cleanup failure cannot reopen a terminal call.
    }
    this.removeIceListener = null;
    this.removeConnectionListener = null;
    const peer = this.peer;
    this.peer = null;
    this.remoteDescriptionApplied = false;
    if (peer) {
      try {
        void Promise.resolve(peer.close()).catch(() => undefined);
      } catch {
        // State teardown remains authoritative when the adapter fails to close.
      }
    }
  }

  private deadlineFromNow(durationMs: number): void {
    const now = this.safeNow();
    this.deadlineAt = now === null ? undefined : now + durationMs;
  }

  private safeNow(): number | null {
    try {
      const value = this.deps.now();
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  private patchState(patch: Partial<CallState>): void {
    const entries = Object.entries(patch) as Array<[keyof CallState, CallState[keyof CallState]]>;
    if (entries.every(([key, value]) => this.state[key] === value)) return;
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getState();
    for (const listener of [...this.listeners]) {
      try {
        listener({ ...snapshot });
      } catch {
        // UI observers cannot interrupt protocol transitions.
      }
    }
  }
}

export function createCallSession(deps: CallSessionDeps): CallSession {
  return new CallSession(deps);
}
