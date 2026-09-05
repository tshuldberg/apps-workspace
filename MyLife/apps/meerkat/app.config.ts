import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config (Plan 20, Phase 0 + Phase 9 + Phase 11).
 *
 * app.json stays the STATIC base (every field there is unchanged and is still
 * the source of truth the app-config test reads). This dynamic layer only does
 * what a static JSON cannot: interpolate build-time env, and append the native
 * config plugins whose options are typed here rather than hand-maintained JSON.
 *
 * Phase 0 env: bakes the free default connection-server URL into
 * `extra.defaultRelayUrl` from `process.env.MEERKAT_DEFAULT_RELAY_URL` so a
 * deployed build can ship a default relay WITHOUT hardcoding a wss:// that may be
 * down. Unset env yields '', preserving today's honest behaviour.
 *
 * Phase 9 plugins (OS share intake):
 *   - `expo-share-intent`: the iOS Share Extension + App Group inbox
 *     ('group.com.mylife.meerkat') and the Android ACTION_SEND / ACTION_SEND_MULTIPLE
 *     intent filters (text/url/image/audio/video/pdf/file). This is real native
 *     config; the Share Extension + App Group are NOT Expo-Go testable, so device
 *     QA is founder-ops (see share-intake-native.ts).
 *   - `./plugins/withSecurityHardening` + `./plugins/withDataProtection`: ported
 *     from Manhattan. Encrypt-at-rest + no-backup so a staged share payload never
 *     leaks off-device. withDataProtection deliberately does NOT touch the
 *     Files-app keys (Meerkat keeps its documents folder browsable for honest
 *     bulk save; app.json owns those).
 *
 * Phase 11 native transports (THIS plan owns the shared native transport layer;
 * Plan 25 consumes it, never re-adds it):
 *   - `@config-plugins/react-native-webrtc` + `@livekit/react-native-expo-plugin`:
 *     config plugins for the real WebRTC runtime consumed by
 *     data/webrtc-backend.ts. Plan 25 Phase 0 migrated the runtime to the
 *     `@livekit/react-native-webrtc` fork so direct data, direct call media, and
 *     LiveKit rooms share ONE native WebRTC runtime. Camera and microphone
 *     permission descriptions cover the current call, room and QR scan flows.
 *   - `extra.iceServers`: the STUN/TURN config the WebRTC backend reads. STUN
 *     defaults to Google; an optional TURN relay is env-injected so a deployed
 *     build can add TURN creds WITHOUT hardcoding secrets.
 *   - iOS `NSBluetoothAlwaysUsageDescription` + Android BLUETOOTH_* /
 *     NEARBY_WIFI_DEVICES: the permission layer for the Nearby + BLE-wake
 *     backends. Bluetooth is a wake-up signal ONLY and never carries file data.
 *     The @livekit/react-native-webrtc dep is in package.json; the Nearby + BLE
 *     native bridges are founder-ops (dev/EAS build), lazy-required + null in
 *     Expo Go.
 *
 * The plugin entries are plain strings / [name, options] tuples so evaluating
 * this config (the app-config test does exactly that) never requires the native
 * plugin modules; Expo resolves them at prebuild time.
 */

/** STUN + optional env-injected TURN. Read by data/webrtc-backend.ts. */
function buildIceServers(): Array<{ urls: string | string[]; username?: string; credential?: string }> {
  const stunEnv = process.env.MEERKAT_STUN_URLS?.trim();
  const stunUrls = stunEnv
    ? stunEnv.split(',').map((u) => u.trim()).filter(Boolean)
    : ['stun:stun.l.google.com:19302'];
  const servers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    { urls: stunUrls },
  ];
  const turnUrl = process.env.MEERKAT_TURN_URL?.trim();
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.MEERKAT_TURN_USERNAME ?? '',
      credential: process.env.MEERKAT_TURN_CREDENTIAL ?? '',
    });
  }
  return servers;
}

/** Founder-ops tile-pack registry from MEERKAT_TILE_PACKS (JSON). Empty on any error. */
function buildTilePacks(): unknown[] {
  const raw = process.env.MEERKAT_TILE_PACKS?.trim();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Parse a JSON-array env var (e.g. MEERKAT_COMMONS_TOPICS); empty/invalid => []. */
function parseJsonArrayEnv(raw: string | undefined): unknown[] {
  const trimmed = raw?.trim();
  if (!trimmed) return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const cfg = config as ExpoConfig;
  const iosConfig = (cfg.ios ?? {}) as NonNullable<ExpoConfig['ios']>;
  const iosInfoPlist = (iosConfig.infoPlist ?? {}) as Record<string, unknown>;
  const androidConfig = (cfg.android ?? {}) as NonNullable<ExpoConfig['android']>;
  const androidPermissions = androidConfig.permissions ?? [];

  return {
    ...cfg,
    plugins: [
      ...((config.plugins ?? []) as NonNullable<ExpoConfig['plugins']>),
      './plugins/withSecurityHardening',
      './plugins/withDataProtection',
      [
        'expo-share-intent',
        {
          iosActivationRules: {
            NSExtensionActivationSupportsText: true,
            NSExtensionActivationSupportsWebURLWithMaxCount: 1,
            NSExtensionActivationSupportsWebPageWithMaxCount: 1,
            NSExtensionActivationSupportsImageWithMaxCount: 10,
            NSExtensionActivationSupportsMovieWithMaxCount: 10,
            NSExtensionActivationSupportsFileWithMaxCount: 10,
          },
          iosShareExtensionName: 'Save to Meerkat',
          iosAppGroupIdentifier: 'group.com.mylife.meerkat',
          // expo-share-intent generates both ACTION_SEND and ACTION_SEND_MULTIPLE
          // intent filters from this MIME list.
          androidIntentFilters: [
            'text/*',
            'image/*',
            'audio/*',
            'video/*',
            'application/pdf',
            'application/*',
          ],
        },
      ],
      [
        '@config-plugins/react-native-webrtc',
        {
          cameraPermission:
            'Meerkat uses your camera for video calls and to scan QR codes.',
          microphonePermission:
            'Meerkat uses your microphone for voice and video calls and audio rooms.',
        },
      ],
      // Plan 25 Phase 0: LiveKit Expo plugin for the @livekit/react-native
      // runtime (audio session + WebRTC module wiring). Additive to the
      // permission strings above; calls and rooms require a native build.
      '@livekit/react-native-expo-plugin',
      // Offline photo map (PhotoMapSegment / tile packs). The config plugin
      // wires the native MapLibre SDK via the Podfile pre/post-install hooks;
      // without it the pod target fails with "Module 'MapLibre' not found".
      '@maplibre/maplibre-react-native',
      // Plan 25: the OWNED CallKit/Telecom module. Its config plugin adds the
      // voip background mode (iOS) and MANAGE_OWN_CALLS (Android) that the
      // runtime import in CallProvider needs for background call delivery.
      // Foreground 1:1 calls work without it; background/PushKit paths stay
      // honestly unavailable until push founder-ops land.
      '@mylife/meerkat-call-native',
      // Plan 42 WP-42B: the OWNED native transport module (Nearby data +
      // BLE wake). Its config plugin adds the local-network usage description,
      // Bonjour service types, and Android nearby/foreground-service permissions
      // its native modules need. Idempotent + additive: it never overwrites the
      // Bluetooth string or the four Bluetooth/nearby-Wi-Fi permissions declared
      // below. The native Swift/Kotlin bodies are UNVERIFIED scaffolding until a
      // dev build compiles them; the JS bridge nulls out in Expo Go so the rungs
      // stay honestly unavailable.
      '@mylife/meerkat-native-transport',
      // WP-41C: owned iCloud Documents and iOS Files bookmark module. The real
      // iCloud container and signing profile are founder operations. Empty env
      // leaves the entitlement absent, and the lazy bridge reports unavailable.
      [
        '@mylife/meerkat-icloud-storage',
        {
          containerIdentifier: process.env.MEERKAT_ICLOUD_CONTAINER_ID ?? '',
          displayName: 'Meerkat',
        },
      ],
      // Plan 29 P4 graduation: the OS-scheduled background mailbox drain (best-
      // effort, opt-in, default off) + data-only push wake. expo-task-manager and
      // expo-notifications ship config plugins; expo-background-task and
      // expo-battery register at runtime (no config plugin) via the declared
      // package + the UIBackgroundModes / BGTaskSchedulerPermittedIdentifiers
      // already set below. Native scheduling is bundle-verified only until a real
      // dev build exercises it on hardware.
      'expo-task-manager',
      [
        'expo-notifications',
        {
          // No custom icon/sound assets bundled here; a "message received"
          // notification only ever fires after a real applied>0 drain.
        },
      ],
    ],
    ios: {
      ...iosConfig,
      infoPlist: {
        ...iosInfoPlist,
        // Bluetooth is a wake-up signal only; it never carries file data.
        NSBluetoothAlwaysUsageDescription:
          'Meerkat uses Bluetooth only to wake a nearby paired device so it can sync over Wi-Fi. No file data is sent over Bluetooth.',
      },
    },
    android: {
      ...androidConfig,
      permissions: Array.from(
        new Set([
          ...androidPermissions,
          // Nearby + BLE-wake transport layer (native bridges are founder-ops).
          'android.permission.BLUETOOTH_ADVERTISE',
          'android.permission.BLUETOOTH_SCAN',
          'android.permission.BLUETOOTH_CONNECT',
          'android.permission.NEARBY_WIFI_DEVICES',
        ]),
      ),
    },
    extra: {
      ...config.extra,
      defaultRelayUrl: process.env.MEERKAT_DEFAULT_RELAY_URL ?? '',
      // Install/download URL (TestFlight public link or store URL) embedded in
      // share envelopes (invite-envelope-core.ts). Unset => '' and envelopes
      // omit the install step entirely; never a placeholder link.
      installUrl: process.env.MEERKAT_INSTALL_URL ?? '',
      // Plan 22 Part 1. The one-time app unlock ($4.99) is sold through the mobile
      // IAP rail (RevenueCat), keyed by EXPO_PUBLIC_MEERKAT_RC_KEY_IOS /
      // EXPO_PUBLIC_MEERKAT_RC_KEY_ANDROID (EXPO_PUBLIC_ vars are inlined at build).
      // Without a key the Unlock screen states purchase is unavailable and the gate
      // stays LOCKED (fail closed); public browsing still works. hostedApiUrl is the
      // hosted billing/usage API base for the SEPARATE hosted subscription + web
      // account restore; unset => '' (no hosted API configured), never faked.
      hostedApiUrl: process.env.MEERKAT_HOSTED_API_URL ?? '',
      hostedRelayUrl: process.env.MEERKAT_HOSTED_RELAY_URL ?? '',
      hostedCommunityNodeUrl: process.env.MEERKAT_HOSTED_COMMUNITY_NODE_URL ?? '',
      storageOperatorPublicKey: process.env.MEERKAT_STORAGE_OPERATOR_PUBLIC_KEY ?? '',
      storageOAuth: {
        googleClientId: process.env.MEERKAT_GOOGLE_DRIVE_CLIENT_ID ?? '',
        dropboxClientId: process.env.MEERKAT_DROPBOX_CLIENT_ID ?? '',
        oneDriveClientId: process.env.MEERKAT_ONEDRIVE_CLIENT_ID ?? '',
        boxClientId: process.env.MEERKAT_BOX_CLIENT_ID ?? '',
        redirectBase: process.env.MEERKAT_STORAGE_OAUTH_REDIRECT_BASE ?? 'meerkat://oauth',
      },
      // Plan 42 P5: the push-wake gateway base URL (the /v1/push/* service in
      // meerkat-relay). Defaults to '' so a build with no configured gateway has
      // push wake OFF, and registerPushWake reports 'not_configured' honestly
      // rather than faking a registration. The gateway never receives a Meerkat
      // identity; a registration is addressed by a random capability handle.
      pushGatewayUrl: process.env.MEERKAT_PUSH_GATEWAY_URL ?? '',
      // Plan 24 P3 humanity (anti-sybil) verification service. Founder-ops injects
      // the deployed service base URL + its pinned Ed25519 public key (hex, the
      // service ready-line `publicKey`) via MEERKAT_HUMANITY_SERVICE_URL /
      // MEERKAT_HUMANITY_SERVICE_PUBLIC_KEY. BOTH unset => no service configured, so
      // the VerifySheet says so plainly and every gated shared-network action
      // (public join, publish) stays BLOCKED, fail-closed.
      humanityServiceUrl: process.env.MEERKAT_HUMANITY_SERVICE_URL ?? '',
      humanityServicePublicKey: process.env.MEERKAT_HUMANITY_SERVICE_PUBLIC_KEY ?? '',
      // Plan 39 P2/P3: the public-tier persona registry + accounts service. Defaults to '' so
      // a build with no configured account server has the public-account flow OFF, and the UI
      // says so honestly (never a fabricated registered/available state).
      personaServiceUrl: process.env.MEERKAT_PERSONA_SERVICE_URL ?? '',
      // Plan 51 P3: the verification-account service (Sign in with Apple/Google +
      // blind-credential issuance). The three keys default to '' so a build with no
      // configured account server has the whole account layer OFF: sign-in, mint,
      // renew, and delete all answer 'not_configured' honestly and nothing fabricates
      // a signed-in or verified state (AC-6). The account layer is SEPARATE from the
      // private mesh, which never touches it (AC-4). No account identifier ever rides
      // on a credential presentation (AC-2).
      accountServiceUrl: process.env.MEERKAT_ACCOUNT_SERVICE_URL ?? '',
      appleServiceId: process.env.MEERKAT_APPLE_SERVICE_ID ?? '',
      googleClientId: process.env.MEERKAT_ACCOUNT_GOOGLE_CLIENT_ID ?? '',
      // Plan 39 P10: the first-party community node serving The Commons base feed + the per-topic
      // publication sources (founder-ops export of the provisioned Commons: a JSON array of
      // {channelId, publicationId, nodeKeyHex}). Empty => the Public tab honestly shows the feed
      // is not connected in this build.
      commonsNodeUrl: process.env.MEERKAT_COMMONS_NODE_URL ?? '',
      commonsTopics: parseJsonArrayEnv(process.env.MEERKAT_COMMONS_TOPICS),
      privacyPolicyUrl: process.env.MEERKAT_PRIVACY_POLICY_URL ?? '',
      termsUrl: process.env.MEERKAT_TERMS_URL ?? '',
      communityStandardsUrl: process.env.MEERKAT_COMMUNITY_STANDARDS_URL ?? '',
      supportUrl: process.env.MEERKAT_SUPPORT_URL ?? '',
      // Legal readiness 2026-07-18: counsel-configurable minimum age for the
      // neutral first-launch age gate. Clamped in code to [13, 21]; default 13
      // (COPPA floor) until counsel rules otherwise. See data/age-gate.ts.
      minimumAge: process.env.MEERKAT_MINIMUM_AGE ?? '13',
      iceServers: buildIceServers(),
      // Plan 25 WP-25I: the self-hosted LiveKit signaling URL (wss://livekit.domain) for
      // community voice/video rooms. Defaults to '' so a build with no configured SFU has
      // rooms OFF, and the room screen says so honestly rather than faking a join. The room
      // token itself is minted by the community node's /api/rooms/token mount; this is only
      // the media-signaling endpoint the granted token connects to.
      livekitUrl: process.env.MEERKAT_LIVEKIT_URL ?? '',
      // Plan 38 C.6 offline-map tile packs. Founder-ops injects a JSON array of
      // pack descriptors ({id,name,region,url,sha512,sizeBytes,minZoom,maxZoom})
      // via MEERKAT_TILE_PACKS; each entry is re-validated at runtime by
      // data/tile-packs.ts (https-only URL, pinned sha512, <=150 MB). Unset =>
      // an empty registry, the honest "No map packs are configured" default.
      tilePacks: buildTilePacks(),
    },
  };
};
