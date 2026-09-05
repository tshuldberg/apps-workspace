# Meerkat services

- The slim relay stays stateless and separate from account/seeder/community deployables. It pairs opaque ephemeral tokens and forwards ciphertext verbatim; no parsing/logging envelopes, device identities, or plaintext. Keep its health response limited to `{ ok, connections }`.
- Rendezvous records remain bounded, rate-limited, TTL-limited, and consume-on-resolve. Hosted stores are tenant-isolated; operators do not hold decryption keys.
- Preserve the one-way wall between verification accounts and private personas/devices. Do not log joinable identifiers or blind credentials.
- Trust forwarded client identity only behind a configured trusted edge. Keep host control local-only and validate public reachability using actual off-host evidence.
- Preserve authorization, durable/idempotent quotas and leases, sealed-piece verification, and fail-closed moderation before public serving. Keep service-specific contracts in `docs/service-contracts.md`.
- Run the affected service tests. Verify the checkout's process watchdog/cleanup support before running suites that spawn real services; never clean up unrelated processes.
