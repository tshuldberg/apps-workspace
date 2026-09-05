# Meerkat Verification Account + Blind Credential Architecture (Plan 51 P0)

Status: implemented by Plan 51 (`docs/plans/queue/51-meerkat-verification-account.md`).
Legal grounding: `docs/reports/REPORT-meerkat-legal-readiness-2026-07-18.md` Sections 3, 8, 10.

## 1. The two layers and the one-way wall

- **Verification account (outer).** Sign in with Apple / Google creates a minimal account
  holding ONLY: provider subject, optional relay email, human-verification status,
  age-verification status (store signal where lawful, else a pointer to the in-app neutral
  gate outcome), parental-consent state, entitlement state, and credential-issuance
  bookkeeping (epoch + flag). Nothing else, ever.
- **Meerkat identity (inner).** Unchanged: device-held keypair, E2EE, zero-knowledge relays.
  Created after verification, never registered with the account layer.
- **The wall.** The inner layer proves "some verified account backs me" with an anonymous
  epoch-scoped credential, blind-signed by the account service (RSA blind signatures,
  RFC 9474 RSABSSA, the Privacy Pass publicly verifiable token shape; rationale in the plan
  file). Issuance is blind: the account service never sees the token or its serial.
  Presentation verifies against the epoch public key only.

## 2. Deployables

- `bin/meerkat-account-service.mjs` is a NEW separate deployable in the persona-service
  lineage. It is never merged into the slim ws+zod relay image. It owns SSO token
  verification, account CRUD, entitlement webhooks, blind issuance, renewal, and deletion.
- Verifier surfaces (community node publish, archive intake, persona registration) verify
  presentations locally with the epoch public key plus a serial revocation check. No
  account-layer secret and no account-service call sits on the presentation path.

## 3. Data model

Two new PostgreSQL schemas in the meerkat-relay substrate (migration 0018):

- `account.` — `accounts`, `entitlements`, `credential_issuance`, `epoch_signing_keys`.
  Contains account identifiers. MUST NEVER contain a credential serial, persona key,
  or device identifier. `credential_issuance` records only (account_id, epoch, issued_day):
  the quota fact, not the token.
- `credential.` — `epoch_keys` (public), `revocations` (serial-keyed). MUST NEVER contain
  an account identifier, persona key, or device identifier. This is the only bridge
  surface, and it is anonymous on both sides.

Column-level invariant (enforced by the schema guard test and the log-hygiene canary):

> A credential serial may co-locate with persona identifiers at the moderation layer.
> A credential serial must never be stored or logged with an account identifier anywhere.
> No table, log line, or metric may contain both an account identifier and a
> persona/device-key identifier.

Roles: new `meerkat_account` role (verb-exact over `account.*` plus credential issuance
tables). Verifier roles (`meerkat_community`, `meerkat_persona`, `meerkat_archive_intake`)
gain SELECT on `credential.epoch_keys` and `credential.revocations` only.

## 4. Credential lifecycle

- **Epochs.** `epoch = floor((now - GENESIS) / 30 days)`, `GENESIS = 2026-08-01T00:00:00Z`.
  One RSA-2048 keypair per epoch. A key is accepted for verification from epoch start
  through 24h after epoch end (clock-skew grace). Renewal window: final 7 days of an epoch,
  when the next epoch key is already published.
- **Issuance (blind).** Client generates a 32-byte random nonce, builds the token message
  `"meerkat-credential-v1" || epoch || nonce`, PSS-encodes and blinds it, and submits the
  blinded message over an account-authenticated session. The service enforces the
  one-per-epoch quota by inserting (account_id, epoch) into `credential_issuance` FIRST
  (primary-key refusal = quota refusal), then signs the blinded message. It never sees
  nonce, serial, or the finished token.
- **Serial.** `serial = SHA-256(token message)`, computable by anyone holding the token,
  by nobody else. The issuer cannot compute it (blindness).
- **Presentation.** Client sends `{ message, signature }`. Verifier checks epoch validity,
  RSA-PSS signature under the epoch public key, and serial absence from `revocations`.
  Presentations ride alongside the surface's existing proof (persona session bearer,
  owner-signed request), so a stolen presentation cannot be replayed without that
  surface's own auth.
- **Renewal.** During the renewal window the client submits the EXPIRING credential plus a
  new blinded message for the next epoch, over an account-authenticated session. The
  service verifies the old credential, checks its serial against `revocations`:
  - revoked → set `renewal_flagged_at` on the account, refuse renewal, refuse future
    renewals. The serial is NOT stored on the account row or anywhere in `account.`.
  - clean → blind-issue the next epoch; the presented serial is discarded, never persisted
    or logged.
- **Revocation.** Enforcement actions insert the actioned credential's serial into
  `credential.revocations` (serial, epoch, reason). The moderation case keeps
  persona + serial evidence on its side of the wall; the operator console lane shows
  credential-serial evidence only, never an account.
- **Enforcement chain (AC-3).** Actioned persona → its presented credential serial revoked
  → that account's renewal presents a revoked serial → account flagged, renewal refused.
  No persona-to-account row exists at any point; the linkage dies with the credential.

## 5. Threat model

| Threat | Mitigation |
|---|---|
| Issuance↔presentation content linkage | Blind issuance (RFC 9474): the issuance transcript contains only the blinded message and blind signature; neither the token message, nonce, serial, nor final signature ever appears in it. AC-1 test asserts transcript disjointness. |
| Issuance↔presentation timing correlation | Credentials are valid for the whole epoch from the epoch boundary, not from mint time; nothing in the token or the verifier path carries mint time. Issuance bookkeeping stores day-granularity (`issued_day`), never a timestamp. Sparse-population correlation (few mints in a window) is documented residual risk that shrinks with adoption; clients SHOULD mint at first entitlement, not first public action. |
| Quota side channel (issuance probing) | One-per-epoch refusal is uniform: same status, body shape, and no timing-distinguishable path (quota insert happens before any signing work in both outcomes). |
| Renewal serial sighting | The expiring serial transits the renewal request. It is checked against the revocation list and then discarded; it is never written to `account.` tables, logs, or metrics (canary-enforced). Residual: a maliciously modified service binary could observe it in memory. The shipped claim is therefore "nothing the service stores or can be compelled to produce can link an account to a persona" — Grade 2 for stored data, stated honestly in all copy. |
| DB compromise | `account.` + `credential.` contain no persona/device data, so full DB disclosure cannot deanonymize personas. Epoch private keys are stored AES-256-GCM-encrypted under an env secret; their compromise enables credential FORGERY (an integrity failure, rotated away at next epoch) but never deanonymization. |
| Forgery / tamper | RSA-PSS verification under the epoch public key; NC-1 tests mutate message and signature. |
| Replay of a revoked credential | Serial revocation list checked on every presentation and at renewal. |
| Credential theft in transit/at rest | Presentations are bound to the surface's own auth (persona session / owner signature); the credential alone grants nothing. Client stores the token in the OS secret store (`com.mylife.meerkat.account` keychain service on mobile). |
| Cross-layer join via logs/metrics | Log-hygiene canary boots the real account-service bin and asserts provider subjects, SSO tokens, serials, and account ids never co-appear or leak; `redactForLog` denylist extended. |
| IP-based identity | Rejected entirely (plan guardrail). The account service keeps edge rate-limiting ephemeral and never persists addresses. |

## 6. Deletion (independent flows)

- **Account deletion** (account service, SSO re-auth): deletes the account row,
  entitlements, and issuance bookkeeping; refuses all future issuance/renewal. If the
  client submits its own credential during deletion (in-app flow), that serial is revoked
  immediately. Without it (e.g. provider-side deletion), the outstanding anonymous
  credential CANNOT be found or revoked — by design — and expires at epoch end (≤30 days).
  Copy states this honestly. Account deletion does not and cannot touch inner-layer data.
- **Inner-data deletion** ("Delete my data", existing flow): unchanged, touches no account
  state. The two flows never reference each other's identifiers.

## 7. Fail-closed configuration

Following the persona-service pattern: unconfigured Apple/Google SSO → sign-in endpoints
answer `not_configured` (503) and clients render honest "not configured" UI; unconfigured
entitlement rails (App Store Server API / Play / Stripe webhook secrets) → webhook and
entitlement endpoints refuse; missing session/key secrets → the bin refuses to boot.
Nothing ever fabricates a verified, entitled, or signed state (AC-6).

## 8. What the account layer never does

No personas, no device keys, no content, no IP identity, no analytics, no metadata
capture beyond the fields in Section 3. Private mesh use (communities, DMs, sync) never
touches this service (AC-4). The in-app neutral age gate remains the universal floor;
a store age signal only skips or pre-fills it.


## September 5 issuance continuity remediation

Direct issuance is now first-issuance-only. The atomic store mutation requires the expected prior epoch: absent for initial mint, the last issued epoch for renewal. `latest_issued_epoch` contains only a period number, survives deletion in the protected subject marker and is backfilled from active quota rows. The privacy wall guard now also inspects columns added with `ALTER TABLE`.

This is a partial mitigation of security finding S2. The narrative above that moderation necessarily causes the correct account to present its revoked pass is not established: another clean bearer from the same epoch can still be substituted. Binding renewal to its issuance, loss recovery and legacy-deletion transition remain open protocol work. No claim of complete account-backed revocation is justified until those acceptance tests pass. Blinding material remains client-only; no new cryptographic proof or serial/account mapping was introduced. [Evidence](../sessions/2026-09-05-meerkat-issuance-continuity.md).


Exact-request recovery stores a SHA-256 digest of the latest blinded request beside the epoch, not a digest of the public credential. Replaying that request under an eligible authenticated account returns the same deterministic blind signature and consumes no additional issuance slot. The client keeps its original body and blinding state in the isolated mobile keychain or browser secret vault until the finished credential is durable. This does not bind a clean renewal bearer to the account: the digest alone cannot prove that the presented bearer unblinds from that request. The stronger S2 proof remains unresolved.

The client retains current and pre-issued next-period passes in a single local secret-store record. Presentation selects only a valid-period pass and strips the private storage wrapper. The previous pass is replaced on the next successful epoch advance; at most two passes remain stored. Account deletion removes both locally but submits only the latest bearer to the existing server revocation route. It does not retroactively revoke unsubmitted anonymous passes.

Both clients serialize mint operations across session contexts sharing the account-secret namespace. A completed pending request can be cleaned only after matching a stored signature-verified pass; browser cleanup also waits for vault persistence. Public headers never contain the pending state or the storage wrapper. The web client exists at `apps/meerkat-web/src/lib/account.ts` and follows the same recovery/period contract.


## September 5 session recovery continuation

`POST /account/credential/recover` retrieves only the same authenticated account's latest exact blinded request. It cannot allocate a new issuance: target and expected predecessor are equal, so the atomic store's strict epoch-advance branch cannot succeed. The existing digest replay branch alone authorizes the response. Recovery accepts the current epoch and the next epoch during its renewal window, subject to current eligibility.

Version 3 client scratch pins service and account hashes in the isolated account keychain/vault, alongside the original session scope and blinding state. Clients verify status using the captured session before replay; changed accounts do not receive another account's blinded request. Changed services are rejected before a bearer request. The wire recovery body contains only epoch and blinded message, never those hashes, old credential or blinding factor. Version 2 scratch remains replayable only in its original context. No new server schema or account/persona mapping is required.

A supplied blinding factor or its knowledge proof cannot bind a finished bearer to its issuance: given one's own blind response `w` and a borrowed valid signature `s`, compute `r = w / s mod n`. The new shared-protocol real-key test successfully unblinds to the borrowed credential. This is a demonstrated consequence of the [RFC 9474 construction](https://www.rfc-editor.org/rfc/rfc9474.html#section-4), not a proposed cryptographic fix. Same-epoch borrowed-bearer renewal remains open. [Implementation, tests and limits](../sessions/2026-09-05-meerkat-session-recovery.md).


## September 5 issuer key integrity

All issuer instances must sign with the private key that won the persistent epoch insert. After an attempted insert, the service reads back that winner rather than trusting its local candidate. The public key is derived from the saved private key, published if missing, then read back and compared. An already conflicting bridge key is never replaced automatically; key discovery and issuance fail closed before quota consumption. This also recovers a crash between private-key persistence and public-key publication. No client protocol, account/persona mapping or schema changes are involved. [Tests and remaining limits](../sessions/2026-09-05-meerkat-epoch-key-integrity.md).


## September 5 eligibility and deletion hardening

The quota mutation now rechecks current account restrictions, minor policy and entitlement validity. An active row whose explicit expiry has passed, is empty or is malformed cannot authorize issuance or replay. Status and both clients reflect expiry. These checks add no identity linkage.

Account deletion no longer accepts a copied public bearer as authority to revoke it. The former optional burn path was reproduced against another account's pass. The legacy input is ignored, clients omit the credential, and `revokedSerial` is false. Deletion still clears account state and local account secrets; other credential copies expire under the existing validity rules. This supersedes the earlier deletion-burn narrative. Safe voluntary revocation requires an ownership-bound design. The [proposal](meerkat-renewal-binding-proposal-2026-09-05.md) is unreviewed and not implemented. [Final local pass](../sessions/2026-09-05-meerkat-security-final-local-pass.md).
