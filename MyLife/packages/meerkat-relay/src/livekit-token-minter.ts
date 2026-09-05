/** Node-only LiveKit AccessToken adapter. The room-token core depends only on its interface. */

import type {
  LiveKitPublishSource,
  LiveKitTokenMintInput,
  LiveKitTokenMinter,
} from './room-token-service';

// livekit-server-sdk's VideoGrant uses @livekit/protocol TrackSource numeric values.
const LIVEKIT_TRACK_SOURCE: Readonly<Record<LiveKitPublishSource, number>> = {
  camera: 1,
  microphone: 2,
  screen_share: 3,
  screen_share_audio: 4,
};

interface AccessTokenLike {
  addGrant(grant: {
    roomJoin: true;
    room: string;
    canSubscribe: boolean;
    canPublish: boolean;
    canPublishData: boolean;
    canPublishSources: number[];
    canUpdateOwnMetadata: false;
  }): void;
  toJwt(): Promise<string>;
}

interface LiveKitServerSdkModule {
  AccessToken: new (
    apiKey: string,
    apiSecret: string,
    options: { identity: string; ttl: number },
  ) => AccessTokenLike;
}

const LIVEKIT_SERVER_SDK_MODULE = 'livekit-server-sdk';

async function loadLiveKitServerSdk(): Promise<LiveKitServerSdkModule> {
  // A variable specifier keeps the SDK out of the slim relay server's static import graph.
  const loaded: unknown = await import(LIVEKIT_SERVER_SDK_MODULE);
  if (
    typeof loaded !== 'object'
    || loaded === null
    || typeof (loaded as { AccessToken?: unknown }).AccessToken !== 'function'
  ) {
    throw new Error('livekit-server-sdk AccessToken export is unavailable');
  }
  return loaded as LiveKitServerSdkModule;
}

export class LiveKitAccessTokenMinter implements LiveKitTokenMinter {
  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {
    if (!apiKey.trim() || !apiSecret.trim()) {
      throw new TypeError('LiveKit API key and secret are required');
    }
  }

  async mint(input: LiveKitTokenMintInput): Promise<string> {
    if (
      !input.identity
      || !input.room
      || !Number.isSafeInteger(input.ttlSeconds)
      || input.ttlSeconds < 1
      || input.ttlSeconds > 60
    ) {
      throw new TypeError('LiveKit room-token mint input is invalid');
    }
    const { AccessToken } = await loadLiveKitServerSdk();
    const accessToken = new AccessToken(this.apiKey, this.apiSecret, {
      identity: input.identity,
      ttl: input.ttlSeconds,
    });
    accessToken.addGrant({
      roomJoin: true,
      room: input.room,
      canSubscribe: input.grants.canSubscribe,
      canPublish: input.grants.canPublish,
      canPublishData: input.grants.canPublishData,
      canPublishSources: input.grants.canPublishSources.map(
        (source) => LIVEKIT_TRACK_SOURCE[source],
      ),
      canUpdateOwnMetadata: false,
    });
    return accessToken.toJwt();
  }
}
