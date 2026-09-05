/**
 * WebRTC connection management for P2P sync.
 *
 * Manages the lifecycle of a single WebRTC data channel connection
 * between two devices. The actual RTCPeerConnection API is injected
 * so this module works in both browser and React Native environments.
 */

/**
 * Minimal SDP description type, compatible with the browser's
 * SDPDescription without depending on DOM lib types.
 */
export interface SDPDescription {
  type: string;
  sdp?: string;
}

/**
 * Minimal ICE candidate type, compatible with the browser's
 * ICECandidate without depending on DOM lib types.
 */
export interface ICECandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  [key: string]: unknown;
}

/**
 * Minimal interface for an RTCPeerConnection.
 * Allows injection of the platform-specific implementation.
 */
export interface RTCPeerConnectionLike {
  createOffer(): Promise<SDPDescription>;
  createAnswer(): Promise<SDPDescription>;
  setLocalDescription(desc: SDPDescription): Promise<void>;
  setRemoteDescription(desc: SDPDescription): Promise<void>;
  addIceCandidate(candidate: ICECandidate): Promise<void>;
  createDataChannel(label: string): RTCDataChannelLike;
  close(): void;
  readonly localDescription: SDPDescription | null;
  readonly connectionState: string;
  ondatachannel: ((event: { channel: RTCDataChannelLike }) => void) | null;
  onicecandidate: ((event: { candidate: ICECandidate | null }) => void) | null;
  onconnectionstatechange: (() => void) | null;
}

/** Minimal interface for an RTCDataChannel. */
export interface RTCDataChannelLike {
  send(data: string): void;
  close(): void;
  readonly readyState: string;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: { error: Error }) => void) | null;
}

export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

export interface WebRTCManagerOptions {
  /** Factory to create a platform-specific RTCPeerConnection. */
  createPeerConnection: () => RTCPeerConnectionLike;
  /** Called when an ICE candidate needs to be sent to the remote peer. */
  onIceCandidate: (candidate: ICECandidate) => void;
  /** Called when the data channel opens and is ready for messages. */
  onConnected: () => void;
  /** Called when the connection is lost. */
  onDisconnected: () => void;
  /** Called when a message is received on the data channel. */
  onMessage: (data: string) => void;
}

const DATA_CHANNEL_LABEL = 'mylife-sync';

/**
 * Manages a single WebRTC peer connection and data channel.
 */
export class WebRTCManager {
  private _pc: RTCPeerConnectionLike | null = null;
  private _channel: RTCDataChannelLike | null = null;
  private _state: ConnectionState = 'new';
  private readonly _options: WebRTCManagerOptions;

  constructor(options: WebRTCManagerOptions) {
    this._options = options;
  }

  get state(): ConnectionState {
    return this._state;
  }

  /**
   * Create an offer as the initiating peer.
   * Returns the SDP offer to send to the remote peer via signaling.
   */
  async createOffer(): Promise<SDPDescription> {
    this._pc = this._options.createPeerConnection();
    this._setupPeerConnectionHandlers();

    this._channel = this._pc.createDataChannel(DATA_CHANNEL_LABEL);
    this._setupDataChannelHandlers(this._channel);

    this._state = 'connecting';

    const offer = await this._pc.createOffer();
    await this._pc.setLocalDescription(offer);
    return offer;
  }

  /**
   * Accept an offer from a remote peer and create an answer.
   * Returns the SDP answer to send back via signaling.
   */
  async acceptOffer(offer: SDPDescription): Promise<SDPDescription> {
    this._pc = this._options.createPeerConnection();
    this._setupPeerConnectionHandlers();

    // Listen for the data channel created by the offerer
    this._pc.ondatachannel = (event) => {
      this._channel = event.channel;
      this._setupDataChannelHandlers(this._channel);
    };

    this._state = 'connecting';

    await this._pc.setRemoteDescription(offer);
    const answer = await this._pc.createAnswer();
    await this._pc.setLocalDescription(answer);
    return answer;
  }

  /**
   * Accept an answer from the remote peer (called by the offerer).
   */
  async acceptAnswer(answer: SDPDescription): Promise<void> {
    if (!this._pc) throw new Error('No peer connection created. Call createOffer() first.');
    await this._pc.setRemoteDescription(answer);
  }

  /**
   * Add a received ICE candidate from the remote peer.
   */
  async addIceCandidate(candidate: ICECandidate): Promise<void> {
    if (!this._pc) throw new Error('No peer connection created.');
    await this._pc.addIceCandidate(candidate);
  }

  /**
   * Send a string message over the data channel.
   */
  send(data: string): void {
    if (!this._channel || this._channel.readyState !== 'open') {
      throw new Error('Data channel is not open.');
    }
    this._channel.send(data);
  }

  /**
   * Close the connection and release resources.
   */
  close(): void {
    this._channel?.close();
    this._pc?.close();
    this._channel = null;
    this._pc = null;
    this._state = 'closed';
  }

  private _setupPeerConnectionHandlers(): void {
    if (!this._pc) return;

    this._pc.onicecandidate = (event) => {
      if (event.candidate) {
        this._options.onIceCandidate(event.candidate);
      }
    };

    this._pc.onconnectionstatechange = () => {
      if (!this._pc) return;
      const pcState = this._pc.connectionState;
      if (pcState === 'connected') {
        this._state = 'connected';
      } else if (pcState === 'disconnected' || pcState === 'failed') {
        this._state = pcState as ConnectionState;
        this._options.onDisconnected();
      } else if (pcState === 'closed') {
        this._state = 'closed';
      }
    };
  }

  private _setupDataChannelHandlers(channel: RTCDataChannelLike): void {
    channel.onopen = () => {
      this._state = 'connected';
      this._options.onConnected();
    };

    channel.onclose = () => {
      if (this._state !== 'closed') {
        this._state = 'disconnected';
        this._options.onDisconnected();
      }
    };

    channel.onmessage = (event) => {
      this._options.onMessage(event.data);
    };

    channel.onerror = () => {
      this._state = 'failed';
      this._options.onDisconnected();
    };
  }
}
