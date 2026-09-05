import { describe, expect, it } from 'vitest';
import type { DeviceIdentity } from '../../types';
import {
  extractSigningPrivateKeyHex,
  generateDeviceIdentity,
  signMessage,
} from '../../identity/device-identity';
import { bytesToHex, hexToBytes } from '../../encryption/keys';
import { sha512Hex } from '../../node/hkdf';
import {
  CALL_SIGNAL_DOMAIN,
  createCallSignal,
  decryptCallPayload,
  deriveCallSignalToken,
  encryptCallPayload,
  resolveCallGlare,
  type CallSignal,
  type CallSignalKind,
} from '../call-signal';
import {
  CallSession,
  type CallIceCandidate,
  type CallIceState,
  type CallMediaBackend,
  type CallMediaConnectionEvent,
  type CallMediaConnectionState,
  type CallMediaPeerSession,
  type CallSessionDescription,
  type CallSessionLimits,
  type CallState,
  type OutboundCallSignal,
  type StartCallPeerConnectionInput,
} from '../call-session';

const NOW_MS = Date.parse('2026-07-12T12:00:00.000Z');
const PAIR_SECRET_HEX = '11'.repeat(32);
const PAIR_SECRET = hexToBytes(PAIR_SECRET_HEX);
const SHORT_LIMITS: Partial<CallSessionLimits> = {
  inviteTimeoutMs: 1_000,
  negotiationTimeoutMs: 1_000,
  reconnectTimeoutMs: 1_000,
  maxCallDurationMs: 10_000,
  maxPendingOutboundIce: 4,
  maxBufferedInboundIce: 4,
};
const SIGNAL_KINDS: CallSignalKind[] = [
  'invite',
  'accept',
  'decline',
  'busy',
  'cancel',
  'end',
  'offer',
  'answer',
  'ice',
  'restart',
];

class FakeClock {
  value = NOW_MS;

  now = (): number => this.value;

  advance(ms: number): void {
    this.value += ms;
  }
}

class FakePeer implements CallMediaPeerSession {
  readonly offers: Array<{ iceRestart?: boolean } | undefined> = [];
  readonly appliedDescriptions: CallSessionDescription[] = [];
  readonly addedCandidates: CallIceCandidate[] = [];
  readonly microphoneChanges: boolean[] = [];
  readonly cameraChanges: boolean[] = [];
  closed = false;
  invalidOffer = false;
  failApplyRemoteSdp = false;
  private readonly iceListeners = new Set<(candidate: CallIceCandidate | null) => void>();
  private readonly connectionListeners = new Set<
    (event: CallMediaConnectionEvent) => void
  >();

  async createOffer(options?: { iceRestart?: boolean }): Promise<CallSessionDescription> {
    this.offers.push(options);
    return this.invalidOffer
      ? { type: 'answer', sdp: 'invalid-local-offer' }
      : { type: 'offer', sdp: `v=0\r\no=fake-offer-${this.offers.length}` };
  }

  async createAnswer(): Promise<CallSessionDescription> {
    return { type: 'answer', sdp: 'v=0\r\no=fake-answer' };
  }

  async applyRemoteSdp(description: CallSessionDescription): Promise<void> {
    if (this.failApplyRemoteSdp) throw new Error('remote SDP rejected');
    this.appliedDescriptions.push(description);
  }

  async addIceCandidate(candidate: CallIceCandidate): Promise<void> {
    this.addedCandidates.push(candidate);
  }

  onIceCandidate(listener: (candidate: CallIceCandidate | null) => void): () => void {
    this.iceListeners.add(listener);
    return () => this.iceListeners.delete(listener);
  }

  onConnectionStateChange(
    listener: (event: CallMediaConnectionEvent) => void,
  ): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    this.microphoneChanges.push(enabled);
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    this.cameraChanges.push(enabled);
  }

  close(): void {
    this.closed = true;
  }

  emitIce(candidate: CallIceCandidate | null): void {
    for (const listener of [...this.iceListeners]) listener(candidate);
  }

  emitConnection(
    connectionState: CallMediaConnectionState,
    iceState: CallIceState = connectionState === 'connected'
      ? 'connected'
      : connectionState === 'disconnected'
        ? 'disconnected'
        : connectionState === 'failed'
          ? 'failed'
          : 'checking',
    transport?: 'direct' | 'turn',
  ): void {
    const event: CallMediaConnectionEvent = {
      connectionState,
      iceState,
      ...(transport ? { transport } : {}),
    };
    for (const listener of [...this.connectionListeners]) listener(event);
  }
}

class FakeMediaBackend implements CallMediaBackend {
  readonly starts: StartCallPeerConnectionInput[] = [];
  readonly peers: FakePeer[] = [];
  failStart = false;

  async startPeerConnection(input: StartCallPeerConnectionInput): Promise<FakePeer> {
    this.starts.push(input);
    if (this.failStart) throw new Error('backend unavailable');
    const peer = new FakePeer();
    this.peers.push(peer);
    return peer;
  }

  get latest(): FakePeer {
    const peer = this.peers.at(-1);
    if (!peer) throw new Error('No fake peer session was started');
    return peer;
  }
}

interface SessionHarness {
  identity: DeviceIdentity;
  remoteIdentity: DeviceIdentity;
  clock: FakeClock;
  backend: FakeMediaBackend;
  sent: OutboundCallSignal[];
  seen: Set<string>;
  recordedNonces: string[];
  session: CallSession;
  nextRemoteNonce(): string;
}

interface PairHarness {
  caller: CallSession;
  callee: CallSession;
  callerIdentity: DeviceIdentity;
  calleeIdentity: DeviceIdentity;
  callerBackend: FakeMediaBackend;
  calleeBackend: FakeMediaBackend;
  callerSent: OutboundCallSignal[];
  calleeSent: OutboundCallSignal[];
  clock: FakeClock;
}

type PairSendHook = (
  outbound: OutboundCallSignal,
  deliver: () => Promise<void>,
) => Promise<void>;

let nonceCounter = 0;

function nextNonce(prefix = 'aa'): string {
  nonceCounter += 1;
  return `${prefix}${nonceCounter.toString(16).padStart(46, '0')}`;
}

function makeNonceFactory(prefix: string): () => string {
  return () => nextNonce(prefix);
}

function createHarness(options: {
  role?: 'caller' | 'callee';
  callId?: string;
  media?: 'voice' | 'video';
  limits?: Partial<CallSessionLimits>;
  sendSignal?: (outbound: OutboundCallSignal) => Promise<void>;
  identity?: DeviceIdentity;
  remoteIdentity?: DeviceIdentity;
  clock?: FakeClock;
  backend?: FakeMediaBackend;
} = {}): SessionHarness {
  const identity = options.identity ?? generateDeviceIdentity('Local');
  const remoteIdentity = options.remoteIdentity ?? generateDeviceIdentity('Remote');
  const clock = options.clock ?? new FakeClock();
  const backend = options.backend ?? new FakeMediaBackend();
  const sent: OutboundCallSignal[] = [];
  const seen = new Set<string>();
  const recordedNonces: string[] = [];
  const session = new CallSession({
    identity,
    localDeviceId: identity.publicKey,
    remoteDeviceId: remoteIdentity.publicKey,
    media: options.media ?? 'video',
    callId: options.callId ?? 'call-001',
    role: options.role ?? 'callee',
    pairSecretHex: PAIR_SECRET_HEX,
    mediaBackend: backend,
    sendSignal: options.sendSignal ?? (async (outbound) => {
      sent.push(outbound);
    }),
    now: clock.now,
    createNonce: makeNonceFactory('ab'),
    hasSeenNonce: (nonce) => seen.has(nonce),
    recordNonce: (nonce) => {
      seen.add(nonce);
      recordedNonces.push(nonce);
    },
    limits: { ...SHORT_LIMITS, ...options.limits },
  });
  return {
    identity,
    remoteIdentity,
    clock,
    backend,
    sent,
    seen,
    recordedNonces,
    session,
    nextRemoteNonce: makeNonceFactory('cd'),
  };
}

function createPair(options: {
  callId?: string;
  callerCallId?: string;
  calleeCallId?: string;
  callerRole?: 'caller' | 'callee';
  calleeRole?: 'caller' | 'callee';
  media?: 'voice' | 'video';
  limitsA?: Partial<CallSessionLimits>;
  limitsB?: Partial<CallSessionLimits>;
  onCallerSend?: PairSendHook;
  onCalleeSend?: PairSendHook;
} = {}): PairHarness {
  const callerIdentity = generateDeviceIdentity('Caller');
  const calleeIdentity = generateDeviceIdentity('Callee');
  const clock = new FakeClock();
  const callerBackend = new FakeMediaBackend();
  const calleeBackend = new FakeMediaBackend();
  const callerSent: OutboundCallSignal[] = [];
  const calleeSent: OutboundCallSignal[] = [];
  const callerSeen = new Set<string>();
  const calleeSeen = new Set<string>();
  let caller!: CallSession;
  let callee!: CallSession;

  const shared = {
    media: options.media ?? 'video',
    pairSecretHex: PAIR_SECRET_HEX,
    now: clock.now,
  };
  caller = new CallSession({
    ...shared,
    identity: callerIdentity,
    localDeviceId: callerIdentity.publicKey,
    remoteDeviceId: calleeIdentity.publicKey,
    callId: options.callerCallId ?? options.callId ?? 'call-pair',
    role: options.callerRole ?? 'caller',
    mediaBackend: callerBackend,
    sendSignal: async (outbound) => {
      callerSent.push(outbound);
      const deliver = async () => callee.handleInboundSignal(outbound.signal);
      if (options.onCallerSend) await options.onCallerSend(outbound, deliver);
      else await deliver();
    },
    createNonce: makeNonceFactory('1a'),
    hasSeenNonce: (nonce) => callerSeen.has(nonce),
    recordNonce: (nonce) => callerSeen.add(nonce),
    limits: { ...SHORT_LIMITS, ...options.limitsA },
  });
  callee = new CallSession({
    ...shared,
    identity: calleeIdentity,
    localDeviceId: calleeIdentity.publicKey,
    remoteDeviceId: callerIdentity.publicKey,
    callId: options.calleeCallId ?? options.callId ?? 'call-pair',
    role: options.calleeRole ?? 'callee',
    mediaBackend: calleeBackend,
    sendSignal: async (outbound) => {
      calleeSent.push(outbound);
      const deliver = async () => caller.handleInboundSignal(outbound.signal);
      if (options.onCalleeSend) await options.onCalleeSend(outbound, deliver);
      else await deliver();
    },
    createNonce: makeNonceFactory('2b'),
    hasSeenNonce: (nonce) => calleeSeen.has(nonce),
    recordNonce: (nonce) => calleeSeen.add(nonce),
    limits: { ...SHORT_LIMITS, ...options.limitsB },
  });

  return {
    caller,
    callee,
    callerIdentity,
    calleeIdentity,
    callerBackend,
    calleeBackend,
    callerSent,
    calleeSent,
    clock,
  };
}

function createSignedSignal(input: {
  sender: DeviceIdentity;
  recipientDeviceId: string;
  callId: string;
  kind: CallSignalKind;
  media?: 'voice' | 'video';
  nowMs?: number;
  nonce?: string;
  payloadCiphertext?: string;
  issuedAt?: string;
  expiresAt?: string;
}): CallSignal {
  const result = createCallSignal({
    sender: input.sender,
    callId: input.callId,
    kind: input.kind,
    toDeviceId: input.recipientDeviceId,
    media: input.media ?? 'video',
    nowMs: input.nowMs ?? NOW_MS,
    nonce: input.nonce ?? nextNonce('ef'),
    ...(input.payloadCiphertext ? { payloadCiphertext: input.payloadCiphertext } : {}),
    ...(input.issuedAt ? { issuedAt: input.issuedAt } : {}),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  });
  if (!result.ok) throw new Error(`Signal creation failed: ${result.reason}`);
  return result.signal;
}

function createRemoteSignal(
  harness: SessionHarness,
  kind: CallSignalKind,
  options: {
    callId?: string;
    media?: 'voice' | 'video';
    payloadCiphertext?: string;
    nonce?: string;
    sender?: DeviceIdentity;
    recipientDeviceId?: string;
    issuedAt?: string;
    expiresAt?: string;
  } = {},
): CallSignal {
  return createSignedSignal({
    sender: options.sender ?? harness.remoteIdentity,
    recipientDeviceId: options.recipientDeviceId ?? harness.identity.publicKey,
    callId: options.callId ?? harness.session.getState().callId,
    kind,
    media: options.media ?? harness.session.getState().media,
    nowMs: harness.clock.value,
    nonce: options.nonce ?? harness.nextRemoteNonce(),
    ...(options.payloadCiphertext ? { payloadCiphertext: options.payloadCiphertext } : {}),
    ...(options.issuedAt ? { issuedAt: options.issuedAt } : {}),
    ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}),
  });
}

function canonicalForDomain(signal: CallSignal, domain: string): Uint8Array {
  const payloadHash = signal.payloadCiphertext === undefined
    ? ''
    : sha512Hex(new TextEncoder().encode(signal.payloadCiphertext));
  return new TextEncoder().encode(JSON.stringify([
    domain,
    signal.version,
    signal.callId,
    signal.kind,
    signal.fromDeviceId,
    signal.toDeviceId,
    signal.media,
    payloadHash,
    signal.issuedAt,
    signal.expiresAt,
    signal.nonce,
  ]));
}

function resignForDomain(signal: CallSignal, sender: DeviceIdentity, domain: string): CallSignal {
  return {
    ...signal,
    signature: bytesToHex(signMessage(
      extractSigningPrivateKeyHex(sender.privateKeyRef),
      canonicalForDomain(signal, domain),
    )),
  };
}

function payloadForKind(kind: CallSignalKind, callId: string): string | undefined {
  if (kind === 'offer' || kind === 'restart') {
    return encryptCallPayload(PAIR_SECRET, callId, {
      sdp: { type: 'offer', sdp: 'v=0\r\no=invariant-offer' },
    });
  }
  if (kind === 'answer') {
    return encryptCallPayload(PAIR_SECRET, callId, {
      sdp: { type: 'answer', sdp: 'v=0\r\no=invariant-answer' },
    });
  }
  if (kind === 'ice') {
    return encryptCallPayload(PAIR_SECRET, callId, {
      candidate: { candidate: 'candidate:invariant', sdpMid: '0', sdpMLineIndex: 0 },
    });
  }
  return undefined;
}

async function negotiatePair(pair: PairHarness): Promise<void> {
  await pair.caller.start();
  await pair.callee.acceptIncoming();
}

async function connectPair(pair: PairHarness, transport: 'direct' | 'turn' = 'direct'):
Promise<void> {
  await negotiatePair(pair);
  pair.callerBackend.latest.emitConnection('connected', 'connected', transport);
  pair.calleeBackend.latest.emitConnection('connected', 'connected', transport);
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe('CallSession state and happy path', () => {
  it('sends an addressed invite and rings the verified callee', async () => {
    // Arrange
    const pair = createPair();

    // Act
    await pair.caller.start();

    // Assert
    expect(pair.caller.getState().phase).toBe('ringing');
    expect(pair.callee.getState().phase).toBe('ringing');
    expect(pair.callerSent[0]).toMatchObject({
      token: deriveCallSignalToken(PAIR_SECRET_HEX, 'call-pair'),
      signal: { kind: 'invite', callId: 'call-pair' },
    });
  });

  it('negotiates offer and answer without optimistically connecting either peer', async () => {
    // Arrange
    const pair = createPair();

    // Act
    await negotiatePair(pair);

    // Assert
    expect(pair.caller.getState().phase).toBe('negotiating');
    expect(pair.callee.getState().phase).toBe('negotiating');
    expect(pair.callerBackend.latest.appliedDescriptions[0]?.type).toBe('answer');
    expect(pair.calleeBackend.latest.appliedDescriptions[0]?.type).toBe('offer');
  });

  it('connects both peers only after each fake backend fires a real connected event', async () => {
    // Arrange
    const pair = createPair();
    await negotiatePair(pair);

    // Act
    pair.callerBackend.latest.emitConnection('connected', 'connected', 'direct');

    // Assert
    expect(pair.caller.getState().phase).toBe('connected');
    expect(pair.callee.getState().phase).toBe('negotiating');

    // Act
    pair.calleeBackend.latest.emitConnection('connected', 'connected', 'direct');

    // Assert
    expect(pair.callee.getState().phase).toBe('connected');
  });

  it('keeps the route unknown until evidence arrives and clears it during recovery', async () => {
    const pair = createPair();
    await negotiatePair(pair);
    pair.callerBackend.latest.emitConnection('connected', 'connected');
    expect(pair.caller.getState().phase).toBe('connected');
    expect(pair.caller.getState().transport).toBeUndefined();
    pair.callerBackend.latest.emitConnection('connected', 'connected', 'turn');
    expect(pair.caller.getState().transport).toBe('turn');
    pair.callerBackend.latest.emitConnection('disconnected', 'disconnected');
    expect(pair.caller.getState().transport).toBeUndefined();
  });

  it('reports TURN relay mode only from backend transport evidence', async () => {
    // Arrange
    const pair = createPair();
    await negotiatePair(pair);
    expect(pair.caller.getState().securityMode).toBe('direct_e2e');

    // Act
    pair.callerBackend.latest.emitConnection('connected', 'completed', 'turn');

    // Assert
    expect(pair.caller.getState()).toMatchObject({
      phase: 'connected',
      securityMode: 'direct_turn_relayed',
      iceState: 'completed',
    });
  });

  it('subscribes immediately, emits transitions, and stops after unsubscribe', async () => {
    // Arrange
    const harness = createHarness({ role: 'caller' });
    const phases: string[] = [];
    const unsubscribe = harness.session.subscribe((state) => phases.push(state.phase));

    // Act
    await harness.session.start();
    unsubscribe();
    await harness.session.cancel();

    // Assert
    expect(phases).toEqual(['idle', 'inviting', 'ringing']);
  });

  it('updates microphone state only after the media seam accepts the change', async () => {
    // Arrange
    const pair = createPair();
    await negotiatePair(pair);

    // Act
    const changed = await pair.caller.setMicrophoneEnabled(false);

    // Assert
    expect(changed).toBe(true);
    expect(pair.callerBackend.latest.microphoneChanges).toEqual([false]);
    expect(pair.caller.getState().localMicOn).toBe(false);
  });

  it('rejects enabling a camera on a voice-only call', async () => {
    // Arrange
    const harness = createHarness({ role: 'caller', media: 'voice' });

    // Act
    const changed = await harness.session.setCameraEnabled(true);

    // Assert
    expect(changed).toBe(false);
    expect(harness.session.getState().localCamOn).toBe(false);
    expect(harness.backend.starts).toHaveLength(0);
  });
});

describe('CallSession terminal and reconnect paths', () => {
  it('propagates a callee decline to the caller', async () => {
    // Arrange
    const pair = createPair();
    await pair.caller.start();

    // Act
    await pair.callee.decline();

    // Assert
    expect(pair.callee.getState()).toMatchObject({ phase: 'declined', endReason: 'local_declined' });
    expect(pair.caller.getState()).toMatchObject({ phase: 'declined', endReason: 'remote_declined' });
  });

  it('propagates a callee busy result to the caller', async () => {
    // Arrange
    const pair = createPair();
    await pair.caller.start();

    // Act
    await pair.callee.busy();

    // Assert
    expect(pair.callee.getState()).toMatchObject({ phase: 'busy', endReason: 'local_busy' });
    expect(pair.caller.getState()).toMatchObject({ phase: 'busy', endReason: 'remote_busy' });
  });

  it('cancels both sides before the callee answers', async () => {
    // Arrange
    const pair = createPair();
    await pair.caller.start();

    // Act
    await pair.caller.cancel();

    // Assert
    expect(pair.caller.getState()).toMatchObject({
      phase: 'cancelled',
      endReason: 'local_cancelled',
    });
    expect(pair.callee.getState()).toMatchObject({
      phase: 'cancelled',
      endReason: 'remote_cancelled',
    });
  });

  it('marks an unanswered outgoing call missed after an app-pumped tick', async () => {
    // Arrange
    const harness = createHarness({ role: 'caller' });
    await harness.session.start();
    harness.clock.advance(1_001);

    // Act
    await harness.session.tick();

    // Assert
    expect(harness.session.getState()).toMatchObject({ phase: 'missed', endReason: 'no_answer' });
  });

  it('marks an unanswered incoming ring missed after an app-pumped tick', async () => {
    // Arrange
    const harness = createHarness({ role: 'callee' });
    await harness.session.handleInboundSignal(createRemoteSignal(harness, 'invite'));
    harness.clock.advance(1_001);

    // Act
    await harness.session.tick();

    // Assert
    expect(harness.session.getState()).toMatchObject({ phase: 'missed', endReason: 'no_answer' });
  });

  it('fails an accepted call when negotiation exceeds its bound', async () => {
    // Arrange
    const harness = createHarness({ role: 'callee' });
    await harness.session.handleInboundSignal(createRemoteSignal(harness, 'invite'));
    await harness.session.acceptIncoming();
    harness.clock.advance(1_001);

    // Act
    await harness.session.tick();

    // Assert
    expect(harness.session.getState()).toMatchObject({
      phase: 'failed',
      endReason: 'negotiation_timeout',
    });
  });

  it('fails honestly when the backend reports ICE failure', async () => {
    // Arrange
    const pair = createPair();
    await negotiatePair(pair);

    // Act
    pair.callerBackend.latest.emitConnection('failed', 'failed');

    // Assert
    expect(pair.caller.getState()).toMatchObject({ phase: 'failed', endReason: 'ice_failed' });
    expect(pair.callerBackend.latest.closed).toBe(true);
  });

  it('enters reconnecting and sends an encrypted ICE restart offer on disconnect', async () => {
    // Arrange
    const pair = createPair();
    await connectPair(pair);
    pair.callerSent.splice(0, pair.callerSent.length);

    // Act
    pair.callerBackend.latest.emitConnection('disconnected', 'disconnected');
    await flushMicrotasks();

    // Assert
    expect(pair.caller.getState().phase).toBe('reconnecting');
    expect(pair.callerBackend.latest.offers.at(-1)).toEqual({ iceRestart: true });
    const restart = pair.callerSent.find(({ signal }) => signal.kind === 'restart');
    expect(restart?.signal.payloadCiphertext).toBeDefined();
    expect(JSON.stringify(restart)).not.toContain('fake-offer-2');
  });

  it('returns from reconnecting only after another backend connected event', async () => {
    // Arrange
    const pair = createPair();
    await connectPair(pair);
    pair.callerBackend.latest.emitConnection('disconnected', 'disconnected');
    await flushMicrotasks();
    expect(pair.caller.getState().phase).toBe('reconnecting');

    // Act
    pair.callerBackend.latest.emitConnection('connected', 'connected', 'direct');

    // Assert
    expect(pair.caller.getState().phase).toBe('connected');
  });

  it('ends a reconnecting call when recovery exceeds its bound', async () => {
    // Arrange
    const pair = createPair();
    await connectPair(pair);
    pair.callerBackend.latest.emitConnection('disconnected', 'disconnected');
    await flushMicrotasks();
    pair.clock.advance(1_001);

    // Act
    await pair.caller.tick();

    // Assert
    expect(pair.caller.getState()).toMatchObject({
      phase: 'ended',
      endReason: 'reconnect_timeout',
    });
  });

  it('hangs up both connected peers and closes their media sessions', async () => {
    // Arrange
    const pair = createPair();
    await connectPair(pair);

    // Act
    await pair.caller.hangup();

    // Assert
    expect(pair.caller.getState()).toMatchObject({ phase: 'ended', endReason: 'local_hangup' });
    expect(pair.callee.getState()).toMatchObject({ phase: 'ended', endReason: 'remote_hangup' });
    expect(pair.callerBackend.latest.closed).toBe(true);
    expect(pair.calleeBackend.latest.closed).toBe(true);
  });

  it('fails the caller when invite transport rejects', async () => {
    // Arrange
    const harness = createHarness({
      role: 'caller',
      sendSignal: async () => { throw new Error('relay unavailable'); },
    });

    // Act
    await harness.session.start();

    // Assert
    expect(harness.session.getState()).toMatchObject({
      phase: 'failed',
      endReason: 'signal_send_failed',
    });
  });

  it('fails negotiation when the injected media backend cannot start', async () => {
    // Arrange
    const pair = createPair();
    pair.callerBackend.failStart = true;
    await pair.caller.start();

    // Act
    await pair.callee.acceptIncoming();

    // Assert
    expect(pair.caller.getState()).toMatchObject({
      phase: 'failed',
      endReason: 'negotiation_failed',
    });
  });

  it('ends an active call at the injected maximum duration bound', async () => {
    // Arrange
    const pair = createPair({ limitsA: { maxCallDurationMs: 2_000 } });
    await connectPair(pair);
    pair.clock.advance(2_001);

    // Act
    await pair.caller.tick();

    // Assert
    expect(pair.caller.getState()).toMatchObject({
      phase: 'ended',
      endReason: 'duration_limit',
    });
  });
});

describe('CallSession glare handling', () => {
  it('converges simultaneous outgoing calls on the deterministic winner', async () => {
    // Arrange
    const pair = createPair({
      callerCallId: 'z-call',
      calleeCallId: 'a-call',
      callerRole: 'caller',
      calleeRole: 'caller',
    });
    const callerStates: CallState[] = [];
    pair.caller.subscribe((state) => callerStates.push(state));

    // Act
    await pair.caller.start();
    await pair.callee.start();

    // Assert
    const expected = resolveCallGlare(
      { callId: 'z-call', fromDeviceId: pair.callerIdentity.publicKey },
      { callId: 'a-call', fromDeviceId: pair.calleeIdentity.publicKey },
    );
    expect(expected.callId).toBe('a-call');
    expect(pair.caller.getState()).toMatchObject({
      callId: expected.callId,
      phase: 'ringing',
      direction: 'incoming',
    });
    expect(pair.callee.getState()).toMatchObject({
      callId: expected.callId,
      phase: 'ringing',
      direction: 'outgoing',
    });
    expect(callerStates).toContainEqual(expect.objectContaining({
      callId: 'z-call',
      phase: 'cancelled',
      endReason: 'superseded',
    }));
  });
});

describe('CallSession encrypted SDP and ICE', () => {
  it('keeps raw SDP out of the outbound offer signal and envelope', async () => {
    // Arrange
    const pair = createPair();

    // Act
    await negotiatePair(pair);

    // Assert
    const offer = pair.callerSent.find(({ signal }) => signal.kind === 'offer');
    expect(offer?.signal.payloadCiphertext).toBeDefined();
    expect(JSON.stringify(offer)).not.toContain('fake-offer');
    expect(Object.keys(offer?.signal ?? {})).not.toContain('sdp');
  });

  it('keeps raw ICE out of the outbound signal while preserving the relay token', async () => {
    // Arrange
    const pair = createPair();
    await negotiatePair(pair);
    const candidate: CallIceCandidate = {
      candidate: 'candidate:7 1 UDP 2122252543 192.0.2.7 54400 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    };

    // Act
    pair.callerBackend.latest.emitIce(candidate);
    await flushMicrotasks();

    // Assert
    const ice = pair.callerSent.find(({ signal }) => signal.kind === 'ice');
    expect(ice?.token).toBe(deriveCallSignalToken(PAIR_SECRET_HEX, 'call-pair'));
    expect(JSON.stringify(ice)).not.toContain(candidate.candidate);
    expect(decryptCallPayload(PAIR_SECRET, 'call-pair', ice!.signal.payloadCiphertext!)).toEqual({
      candidate,
    });
  });

  it('buffers reordered inbound ICE until remote SDP has been applied', async () => {
    // Arrange
    const harness = createHarness({ role: 'callee' });
    await harness.session.handleInboundSignal(createRemoteSignal(harness, 'invite'));
    await harness.session.acceptIncoming();
    const candidate = { candidate: 'candidate:buffered', sdpMid: '0', sdpMLineIndex: 0 };
    const iceCiphertext = encryptCallPayload(PAIR_SECRET, 'call-001', { candidate });
    const offerCiphertext = encryptCallPayload(PAIR_SECRET, 'call-001', {
      sdp: { type: 'offer', sdp: 'v=0\r\no=ordered-after-ice' },
    });

    // Act
    await harness.session.handleInboundSignal(createRemoteSignal(harness, 'ice', {
      payloadCiphertext: iceCiphertext,
    }));
    await harness.session.handleInboundSignal(createRemoteSignal(harness, 'offer', {
      payloadCiphertext: offerCiphertext,
    }));

    // Assert
    expect(harness.backend.latest.appliedDescriptions[0]?.type).toBe('offer');
    expect(harness.backend.latest.addedCandidates).toEqual([candidate]);
  });

  it('fails closed when buffered inbound ICE exceeds its configured cap', async () => {
    // Arrange
    const harness = createHarness({
      role: 'callee',
      limits: { maxBufferedInboundIce: 2 },
    });
    await harness.session.handleInboundSignal(createRemoteSignal(harness, 'invite'));
    await harness.session.acceptIncoming();

    // Act
    for (let index = 0; index < 3; index += 1) {
      const payloadCiphertext = encryptCallPayload(PAIR_SECRET, 'call-001', {
        candidate: { candidate: `candidate:${index}` },
      });
      await harness.session.handleInboundSignal(createRemoteSignal(harness, 'ice', {
        payloadCiphertext,
      }));
    }

    // Assert
    expect(harness.session.getState()).toMatchObject({
      phase: 'failed',
      endReason: 'ice_candidate_overflow',
    });
  });

  it('fails closed when pending outbound ICE exceeds its configured cap', async () => {
    // Arrange
    let releaseIce!: () => void;
    const blockedIce = new Promise<void>((resolve) => { releaseIce = resolve; });
    const pair = createPair({
      limitsA: { maxPendingOutboundIce: 2 },
      onCallerSend: async (outbound, deliver) => {
        if (outbound.signal.kind === 'ice') await blockedIce;
        else await deliver();
      },
    });
    await negotiatePair(pair);

    // Act
    for (let index = 0; index < 4; index += 1) {
      pair.callerBackend.latest.emitIce({ candidate: `candidate:queued-${index}` });
    }
    await flushMicrotasks();

    // Assert
    expect(pair.caller.getState()).toMatchObject({
      phase: 'failed',
      endReason: 'ice_candidate_overflow',
    });
    releaseIce();
    await flushMicrotasks();
  });

  it('drops a signed but tampered encrypted SDP without advancing negotiation', async () => {
    // Arrange
    const harness = createHarness({ role: 'callee' });
    await harness.session.handleInboundSignal(createRemoteSignal(harness, 'invite'));
    await harness.session.acceptIncoming();
    const ciphertext = encryptCallPayload(PAIR_SECRET, 'call-001', {
      sdp: { type: 'offer', sdp: 'v=0\r\no=secret-sdp' },
    });
    const [nonce, body] = ciphertext.split('.') as [string, string];
    const last = body.endsWith('0') ? '1' : '0';
    const tampered = `${nonce}.${body.slice(0, -1)}${last}`;

    // Act
    await harness.session.handleInboundSignal(createRemoteSignal(harness, 'offer', {
      payloadCiphertext: tampered,
    }));

    // Assert
    expect(harness.session.getState().phase).toBe('accepted');
    expect(harness.backend.starts).toHaveLength(0);
  });
});

describe('CallSession inbound verification gate', () => {
  it('drops a bad signature before ringing or recording the nonce', async () => {
    // Arrange
    const harness = createHarness({ role: 'callee' });
    const signal = createRemoteSignal(harness, 'invite');
    const replacement = signal.signature.endsWith('0') ? '1' : '0';
    const bad = { ...signal, signature: `${signal.signature.slice(0, -1)}${replacement}` };

    // Act
    await harness.session.handleInboundSignal(bad);

    // Assert
    expect(harness.session.getState().phase).toBe('idle');
    expect(harness.recordedNonces).toHaveLength(0);
  });

  it('drops a signal from the wrong signer', async () => {
    // Arrange
    const harness = createHarness({ role: 'callee' });
    const stranger = generateDeviceIdentity('Stranger');
    const signal = createRemoteSignal(harness, 'invite', { sender: stranger });

    // Act
    await harness.session.handleInboundSignal(signal);

    // Assert
    expect(harness.session.getState().phase).toBe('idle');
  });

  it('drops a valid signal addressed to another recipient', async () => {
    // Arrange
    const harness = createHarness({ role: 'callee' });
    const otherRecipient = generateDeviceIdentity('Other recipient');
    const signal = createRemoteSignal(harness, 'invite', {
      recipientDeviceId: otherRecipient.publicKey,
    });

    // Act
    await harness.session.handleInboundSignal(signal);

    // Assert
    expect(harness.session.getState().phase).toBe('idle');
  });

  it('drops an expired signal at the verification gate', async () => {
    // Arrange
    const harness = createHarness({ role: 'callee' });
    const issuedAt = new Date(harness.clock.value - 60_000).toISOString();
    const expiresAt = new Date(harness.clock.value).toISOString();
    const signal = createRemoteSignal(harness, 'invite', { issuedAt, expiresAt });

    // Act
    await harness.session.handleInboundSignal(signal);

    // Assert
    expect(harness.session.getState().phase).toBe('idle');
  });

  it('records a verified nonce once and drops its replay', async () => {
    // Arrange
    const harness = createHarness({ role: 'callee' });
    const signal = createRemoteSignal(harness, 'invite');

    // Act
    await harness.session.handleInboundSignal(signal);
    await harness.session.handleInboundSignal(signal);

    // Assert
    expect(harness.session.getState().phase).toBe('ringing');
    expect(harness.recordedNonces).toEqual([signal.nonce]);
  });

  it('drops a valid signature made over the wrong signing domain', async () => {
    // Arrange
    const harness = createHarness({ role: 'callee' });
    const signal = createRemoteSignal(harness, 'invite');
    const wrongDomain = resignForDomain(
      signal,
      harness.remoteIdentity,
      `${CALL_SIGNAL_DOMAIN}-wrong`,
    );

    // Act
    await harness.session.handleInboundSignal(wrongDomain);

    // Assert
    expect(harness.session.getState().phase).toBe('idle');
  });

  it('never throws or rings for 40 junk relay values', async () => {
    // Arrange
    const harness = createHarness({ role: 'callee' });
    const junk = Array.from({ length: 40 }, (_, index): unknown => {
      switch (index % 5) {
        case 0: return null;
        case 1: return index;
        case 2: return [`junk-${index}`];
        case 3: return { [`junk-${index}`]: true };
        default: return `junk-${index}`;
      }
    });

    // Act
    for (const value of junk) {
      await expect(harness.session.handleInboundSignal(value)).resolves.toBeUndefined();
    }

    // Assert
    expect(harness.session.getState().phase).toBe('idle');
    expect(harness.recordedNonces).toHaveLength(0);
  });
});

describe('NC-25.1 backend connected-event invariant', () => {
  it.each(SIGNAL_KINDS)(
    'never reaches connected from a verified %s signal without a backend event',
    async (kind) => {
      // Arrange
      const harness = createHarness({ role: 'callee' });
      const callId = harness.session.getState().callId;
      const payloadCiphertext = payloadForKind(kind, callId);
      const signal = createRemoteSignal(harness, kind, {
        ...(payloadCiphertext ? { payloadCiphertext } : {}),
      });

      // Act
      await harness.session.handleInboundSignal(signal);

      // Assert
      expect(harness.session.getState().phase).not.toBe('connected');
    },
  );
});
