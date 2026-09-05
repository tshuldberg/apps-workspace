# 2026-07-14 - Meerkat Plan 41 WP-41E

## Outcome

WP-41E is implemented in the current worktree. Dropbox, OneDrive, and Box now
have production storage adapters over the existing injected HTTP transport and
access-token seams. The relay OAuth registry recognizes all three providers,
and mobile and web each have provider-specific token sources. All 100 new
packet tests pass: 67 sync tests, 9 relay tests, 12 mobile tests, and 12 web
tests.

The implementation preserves the Plan 41 security boundary. Provider tokens
are never stored by storage adapters, automatic redirects are restricted to the
original origin, refresh is attempted once after a 401, and provider revision
tokens are never treated as ciphertext verification evidence. Provider-issued
OneDrive and Box download capabilities are separately host-allowlisted and
requested without an Authorization header.

## Relay OAuth registry

- Added `dropbox`, `onedrive`, and `box` to
  `loadOAuthProviderRegistryFromEnv`.
- Added `MEERKAT_OAUTH_DROPBOX_*`, `MEERKAT_OAUTH_ONEDRIVE_*`, and
  `MEERKAT_OAUTH_BOX_*` configuration with file-based client secrets and exact
  redirect allowlists.
- Partial provider configuration fails closed during registry loading.
- An absent provider remains an honest `provider_not_configured` response.
- Dropbox defaults to `files.content.read`, `files.content.write`,
  `files.metadata.read`, and `account_info.read`. App-folder access must also be
  selected in the Dropbox app console because it is an application setting,
  not an OAuth scope.
- OneDrive defaults to `Files.ReadWrite.AppFolder offline_access`.
- Box has no app-folder OAuth scope. Its minimum usable content scope is
  `root_readwrite`, so the adapter enforces a narrower application boundary by
  creating and using one dedicated folder under root. This limitation is
  documented in the relay configuration guide.

## Storage adapters

### Dropbox

- Uses Dropbox RPC and content endpoints under `/2`.
- Implements upload-session start, append, and finish with session-id and
  offset resume tokens. The finish commit uses `mute: true`, disables
  autorename, and requires a strict conflict.
- Implements the Dropbox 4 MiB block `content_hash` algorithm locally. Each
  upload call carries a hash of the bytes in that call. A completed write earns
  `provider_checksum` evidence only when returned whole-file metadata matches
  the locally computed ciphertext hash.
- Implements list-folder cursor continuation, idempotent `delete_v2`, and
  account space usage.
- Path conflicts compare provider bytes and fail closed on any mismatch.

### OneDrive

- Uses Microsoft Graph `special/approot` addressing.
- Implements `createUploadSession`, ranged fragment PUTs, and resume through
  `nextExpectedRanges`. Preauthenticated upload URLs are origin-allowlisted and
  receive no bearer token.
- Selects the short-lived `@microsoft.graph.downloadUrl` required by Graph and
  requests it directly without a bearer token. Unknown hosts and any redirect
  away from the selected capability fail as `unsafe_redirect`.
- Implements QuickXorHash from the published rotation and folding algorithm.
  QuickXorHash, SHA-1, or SHA-256 provider hashes are accepted as checksum
  evidence only after comparison with the ciphertext. ETags and CTags remain
  revision tokens only.
- Implements children paging through `@odata.nextLink`, drive quota, and
  conflict handling for 409 and 412 responses.

### Box

- Resolves an application-created folder below root and caches its folder id
  only through an injected state store. There is no module-global cache.
- Implements chunked upload sessions, per-part SHA-1 digest headers, resume by
  uploaded part offsets, and whole-file SHA-1 commit digests.
- Uses Box's hexadecimal SHA-1 value in the misleadingly named `Content-MD5`
  header for direct uploads, then requires read-back verification.
- Handles Box's documented content 302 only by validating the location against
  Box's download host boundary and making a new unauthenticated request. It
  never forwards the provider bearer to Box's content host.
- A successful commit earns SHA-1 provider-checksum evidence only when Box
  accepts and returns the same whole-file digest. This is valid evidence because
  Box validates the digest server-side during commit.
- Implements marker paging, idempotent delete, and `users/me` space quota.
- Name conflicts resolve only through same-id byte comparison and otherwise
  fail closed.

All three adapters map quota and permission 403 responses separately, preserve
`Retry-After` on typed 429 errors, mark 5xx provider errors retryable, and keep
`StorageObjectMetadata.ciphertextHash` null because none of these providers
proves SHA-512 metadata.

The upload-session race paths also re-read and byte-verify any object that
appears after the initial lookup. Box commit retries recover when the provider
accepted a commit but its response was lost.

## Token sources

- Mobile adds lazy Expo AuthSession PKCE sources for Dropbox, OneDrive, and Box
  with provider-documented authorization and token endpoints, SecureStore
  custody, and honest-null availability.
- Web adds one broker-session source per provider. Each operation requests a
  fresh broker session, persists no browser token, and uses the existing trust
  disclosure pattern.
- Only new provider-named files were added under the mobile
  `storage-destinations` directory. No shared or local-device packet file was
  changed.

## Files

### Sync

- `packages/sync/src/storage/adapters/provider-crypto.ts`
- `packages/sync/src/storage/adapters/provider-common.ts`
- `packages/sync/src/storage/adapters/dropbox.ts`
- `packages/sync/src/storage/adapters/onedrive.ts`
- `packages/sync/src/storage/adapters/box.ts`
- `packages/sync/src/storage/__tests__/adapters/provider-test-support.ts`
- `packages/sync/src/storage/__tests__/adapters/dropbox-conformance.test.ts`
- `packages/sync/src/storage/__tests__/adapters/onedrive-conformance.test.ts`
- `packages/sync/src/storage/__tests__/adapters/box-conformance.test.ts`
- `packages/sync/src/index.ts`
- `packages/sync/src/index.native.ts`

### Relay

- `packages/meerkat-relay/src/oauth-broker.ts`
- `packages/meerkat-relay/src/__tests__/oauth-broker.test.ts`
- `packages/meerkat-relay/README.md`

### Mobile

- `apps/meerkat/app/(root)/data/storage-destinations/dropbox-source.ts`
- `apps/meerkat/app/(root)/data/storage-destinations/onedrive-source.ts`
- `apps/meerkat/app/(root)/data/storage-destinations/box-source.ts`
- Three matching provider-named test files under
  `apps/meerkat/app/(root)/data/storage-destinations/__tests__/`.

### Web

- `apps/meerkat-web/src/lib/storage/dropbox-session.ts`
- `apps/meerkat-web/src/lib/storage/onedrive-session.ts`
- `apps/meerkat-web/src/lib/storage/box-session.ts`
- Three matching provider-named test files under
  `apps/meerkat-web/src/lib/storage/__tests__/`.

## Verification

| Surface | Result | Count and delta |
|---------|--------|-----------------|
| Sync focused function gate | Pass, including lint and typecheck | 67 of 67 WP-41E tests |
| Sync full suite | 2,086 pass, 3 sandbox-blocked localhost tests | 2,089 collected, baseline 2,022 + 67 WP-41E |
| Sync typecheck | Pass | Run separately after the full test command short-circuited |
| Relay OAuth suite | Pass, including lint and typecheck | 32 of 32; 9 WP-41E registry tests |
| Relay full suite | 917 pass, 326 sandbox-blocked, 172 skipped | 1,415 collected, baseline 1,406 + 9 WP-41E |
| Mobile focused function gate | Pass, including lint and typecheck | 12 of 12 WP-41E tests |
| Mobile full suite | Pass | 1,240 of 1,240; workspace baseline +48, of which WP-41E is +12 |
| Web focused function gate | Pass, including lint and typecheck | 12 of 12 WP-41E tests |
| Web full suite | 800 pass, 14 sandbox-blocked localhost tests | 814 collected; workspace baseline +49, of which WP-41E is +12 |
| Meerkat parity | Pass | `All Meerkat parity checks passed.` |

The full sync, relay, and web failures are listener-permission failures in this
managed sandbox: `listen EPERM: operation not permitted 127.0.0.1`, followed by
timeouts or process-boundary cascades. The new adapter, registry, and token
source suites all pass, and every requested package typecheck passes.

Another packet was active in the app and web directories during verification.
The full mobile and web workspace deltas therefore include its tests. The
WP-41E contribution is measured directly by the provider-focused suites.

`pnpm gate:function:changed` and `pnpm check:generated-artifacts` were not run
because both inspect Git state and the task explicitly prohibited every Git
command. Targeted function gates were used for every changed function surface.
No Git command was run.

## Judgment calls

1. Dropbox app-folder isolation is both configuration and code. The adapter
   roots every path, while the operator must select App folder access in the
   Dropbox app console.
2. Box cannot provide app-folder isolation through OAuth scope. The dedicated
   folder and injected folder-id state are the narrowest enforceable boundary
   without claiming a provider capability that does not exist.
3. Box commit acceptance counts as checksum evidence only when the returned
   digest matches the client digest. A successful status alone is insufficient.
4. OneDrive preauthenticated upload URLs are treated as narrowly scoped
   capabilities. Upload and download URLs are host-checked and never receive
   the Graph access token.
5. Box's provider-documented download location is not treated as a general
   redirect. The adapter validates the Box-controlled host and performs a new
   request without Authorization. Every unknown or subsequent cross-origin
   redirect remains an `unsafe_redirect` failure.
6. The localhost failures were not modified or hidden. Focused suites and
   typechecks provide packet evidence while the full-suite sandbox limitation
   remains explicit.

The required HTML open was attempted immediately after creation. This managed
environment has no compatible desktop opener, does not expose in-app browser
control, and blocks Quick Look rendering, so visual opening could not be
completed here. The self-contained HTML structure and absence of external
assets were validated directly.
