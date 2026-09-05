/**
 * Meerkat direct client (MK-008): encrypted "AirDrop-style" direct send.
 *
 * Composes the two real pieces already proven in the codebase -- the node
 * sealed-share crypto and a RelayBackend transport -- into one object a desktop
 * (Node on macOS/Windows), browser, or phone can use to send an end-to-end
 * encrypted item to a peer over a relay. The relay only ever forwards opaque
 * ciphertext addressed by an ephemeral token; the link key that decrypts it
 * travels out of band in the share link, never through the relay.
 *
 * This is the non-torrent path the product calls "send directly to another
 * device": one sealed envelope, relayed, opened by a recipient who has the
 * out-of-band link. The same backend works over LAN/Wi-Fi or a remote relay.
 *
 * RN-safe: no Node-only imports. The transport is injected (WebSocketRelayBackend
 * on desktop/browser/phone, SimulatedRelayBackend in tests).
 */

import type { DeviceIdentity } from '../types';
import type { RelayBackend, RelayConnectOptions, RelaySession } from '../transport/relay-transport';
import {
  createSealedShare,
  openSealedShare,
  type SealedShare,
  type NodeShareScope,
  type OpenResult,
} from './sealed-share';
import { buildShareLink, parseShareLink } from './share-link';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface MeerkatDirectClientOptions {
  identity: DeviceIdentity;
  backend: RelayBackend;
}

export interface SentShare {
  contentId: string;
  /** Out-of-band invitation carrying the link key; the relay never sees it. */
  link: string;
  /** Raw link key (same material the link encodes), for trusted callers/tests. */
  linkKey: Uint8Array;
}

export interface ReceivedShare {
  name: string;
  /** Author key as self-claimed in the manifest (verify against the link's key). */
  authorPublicKey: string;
  share: SealedShare;
  /**
   * Decrypt + verify the share. Pass the out-of-band share link (preferred: its
   * embedded author is the trusted authorship check) or the raw link key.
   */
  open(linkKeyOrLink: Uint8Array | string, expectedAuthor?: string): OpenResult;
}

/**
 * A connected relay client that can send and receive sealed shares.
 *
 * Lifecycle: construct -> connect(url, token) -> sendText/sendBytes and/or
 * onReceive -> close. Two clients that connect with the same token are peered
 * by the relay.
 */
export class MeerkatDirectClient {
  private readonly identity: DeviceIdentity;
  private readonly backend: RelayBackend;
  private session: RelaySession | null = null;
  private readonly handlers = new Set<(share: ReceivedShare) => void>();
  // Shares that arrive before any onReceive handler is attached (e.g. a mailbox
  // drain on connect). Buffered and flushed to the first handler.
  private readonly pendingShares: ReceivedShare[] = [];

  constructor(options: MeerkatDirectClientOptions) {
    this.identity = options.identity;
    this.backend = options.backend;
  }

  get connected(): boolean {
    return this.session !== null;
  }

  /** Join the relay on a shared ephemeral token. */
  async connect(url: string, token: string, options: RelayConnectOptions = {}): Promise<void> {
    if (this.session) return;
    const session = await this.backend.connect(url, token, options);
    session.onMessage((bytes) => this.handleEnvelope(bytes));
    this.session = session;
  }

  /** Seal UTF-8 text and ship it over the relay. Returns the out-of-band link. */
  async sendText(
    text: string,
    name: string,
    scope: NodeShareScope = 'shared_workspace',
  ): Promise<SentShare> {
    return this.sendBytes(textEncoder.encode(text), name, scope);
  }

  /** Seal arbitrary bytes and ship them over the relay. */
  async sendBytes(
    content: Uint8Array,
    name: string,
    scope: NodeShareScope = 'shared_workspace',
  ): Promise<SentShare> {
    if (!this.session) {
      throw new Error('MeerkatDirectClient is not connected. Call connect() first.');
    }
    const { share, linkKey } = createSealedShare(content, {
      name,
      identity: this.identity,
      scope,
    });
    await this.session.send(textEncoder.encode(JSON.stringify(share)));
    const link = buildShareLink({
      contentId: share.manifest.contentId,
      linkKey,
      authorPublicKey: this.identity.publicKey,
      name,
    });
    return { contentId: share.manifest.contentId, link, linkKey };
  }

  /** Register a handler for incoming sealed shares. Returns an unsubscribe fn. */
  onReceive(handler: (share: ReceivedShare) => void): () => void {
    this.handlers.add(handler);
    if (this.pendingShares.length > 0) {
      const queued = this.pendingShares.splice(0, this.pendingShares.length);
      for (const share of queued) handler(share);
    }
    return () => {
      this.handlers.delete(handler);
    };
  }

  async close(): Promise<void> {
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
    this.handlers.clear();
  }

  private handleEnvelope(bytes: Uint8Array): void {
    let share: SealedShare;
    try {
      share = JSON.parse(textDecoder.decode(bytes)) as SealedShare;
    } catch {
      return; // Not JSON; ignore.
    }
    if (!share || !share.manifest || typeof share.manifest.contentId !== 'string') {
      return; // Not a sealed-share envelope.
    }

    const received: ReceivedShare = {
      name: share.manifest.name,
      authorPublicKey: share.manifest.authorPublicKey,
      share,
      open: (linkKeyOrLink, expectedAuthor) => {
        let linkKey: Uint8Array | undefined;
        let author = expectedAuthor;
        if (typeof linkKeyOrLink === 'string') {
          const parsed = parseShareLink(linkKeyOrLink);
          if (!parsed) return { ok: false, reason: 'invalid_share_link' };
          linkKey = parsed.linkKey;
          // The link's author is the out-of-band truth unless the caller overrides.
          author = expectedAuthor ?? parsed.authorPublicKey;
        } else {
          linkKey = linkKeyOrLink;
          author = expectedAuthor ?? share.manifest.authorPublicKey;
        }
        return openSealedShare(share, linkKey, { expectedAuthor: author });
      },
    };

    if (this.handlers.size === 0) {
      this.pendingShares.push(received);
      return;
    }
    for (const handler of this.handlers) handler(received);
  }
}
