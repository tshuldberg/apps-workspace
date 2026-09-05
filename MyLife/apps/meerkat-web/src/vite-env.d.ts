/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Free, health-gated default connection server (Plan 20). DISTINCT from the
  // paid VITE_MEERKAT_HOSTED_RELAY_URL so the paid-relay gate never flags the
  // free default as paid. Unset => '' => today's honest no-default behavior.
  readonly VITE_MEERKAT_DEFAULT_RELAY_URL?: string;
  readonly VITE_MEERKAT_HOSTED_RELAY_URL?: string;
  readonly VITE_MEERKAT_HOSTED_API_URL?: string;
  readonly VITE_MEERKAT_STORAGE_OPERATOR_PUBLIC_KEY?: string;
  readonly VITE_MEERKAT_HOSTED_COMMUNITY_NODE_URL?: string;
  // Plan 24 P3 humanity (anti-sybil) verification service. Founder-ops sets the
  // deployed service URL + its pinned Ed25519 public key (hex) + the Cloudflare
  // Turnstile site key. All unset => no service, so the VerifySheet says so and
  // every gated shared-network action stays BLOCKED (fail-closed).
  readonly VITE_MEERKAT_HUMANITY_SERVICE_URL?: string;
  readonly VITE_MEERKAT_HUMANITY_SERVICE_PUBLIC_KEY?: string;
  readonly VITE_MEERKAT_TURNSTILE_SITE_KEY?: string;
  // Plan 39 P2/P3: the public-tier persona registry + accounts service. Empty => the
  // public-account flow is off and the UI says so (no fabricated registered state).
  readonly VITE_MEERKAT_PERSONA_SERVICE_URL?: string;
  // Plan 39 P10/P11: the first-party community node serving The Commons base feed + the per-topic
  // publication sources (a JSON array of {channelId, publicationId, nodeKeyHex}). Empty => the
  // Public view honestly says the feed is not connected in this build.
  readonly VITE_MEERKAT_COMMONS_NODE_URL?: string;
  readonly VITE_MEERKAT_COMMONS_TOPICS?: string;
  // Plan 42 P6 Web Push. The push GATEWAY base URL and the VAPID PUBLIC key
  // (base64url). Founder-ops provisions the VAPID keypair: the PRIVATE key lives
  // in the gateway secret (WP-42A), the PUBLIC key is what the browser subscribes
  // with here. BOTH unset => web push is OFF and the Notifications settings say so
  // (no fabricated "always on" claim, NC-42.5).
  readonly VITE_MEERKAT_PUSH_GATEWAY_URL?: string;
  readonly VITE_MEERKAT_PUSH_VAPID_PUBLIC_KEY?: string;
  // Plan 25 WP-25I: the LiveKit signaling URL for community voice/video rooms.
  // Empty => rooms are honestly off (room-entry returns 'no_livekit'). Mirrors how
  // mobile reads Constants.expoConfig.extra.livekitUrl.
  readonly VITE_MEERKAT_LIVEKIT_URL?: string;
  // Plan 25 WP-25H: optional JSON array of ICE servers for direct calls (STUN/TURN).
  // Unset => a single public STUN server default. A TURN entry enables relayed calls.
  readonly VITE_MEERKAT_ICE_SERVERS?: string;
  // Plan 51: the verification-account service base URL (entitlement boundary
  // only; the private mesh never touches it). Empty => account flows report
  // not_configured honestly. Read in src/lib/account.ts.
  readonly VITE_MEERKAT_ACCOUNT_SERVICE_URL?: string;
  // Install/download URL (TestFlight public link or store URL) embedded in the
  // share envelopes (invite-envelope-core.ts). Unset => '' and envelopes omit
  // the install step entirely; never a placeholder link.
  readonly VITE_MEERKAT_INSTALL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
