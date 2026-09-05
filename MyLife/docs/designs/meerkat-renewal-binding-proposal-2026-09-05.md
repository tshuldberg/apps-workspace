# Meerkat renewal binding: review proposal

Date: 2026-09-05. Status: unreviewed proposal, not implemented or approved for production. This is a concrete candidate for resolving audit S2, not evidence that S2 is closed.

## Required behavior

Renewal must prove that the old pass is the pass originally issued to this verification account, while stored issuer data cannot identify that pass among public presentations. A pass copied from a public request must not suffice. Private mesh identities and device keys must never enter the account service. The existing limitation remains explicit: the service sees the old pass with the account during renewal, but must discard that association rather than retain it.

The current blinded-request digest proves exact issuance replay, not pass ownership. A bare blinding-factor opening is insufficient: for one's own blind response `w` and any borrowed valid signature `s`, one can construct `r = w / s mod n`. Storing an unsalted hash of `r` would create a different problem: an issuer can compute that candidate `r` for each public signature and match the hash. Neither shortcut is acceptable.

## Candidate: a hiding commitment made before issuance

Retain the existing RSA blind-signature protocol. Add a separately reviewed commitment to the client blinding factor before the issuer signs. One candidate is a domain-separated hash commitment with an independent 256-bit secret salt, under explicit collision-resistance and hiding assumptions. This composition is not specified or endorsed by RFC 9474 and needs cryptographic review.

Proposed fields:

| Location | Fields |
|---|---|
| Account issuance record | Existing epoch and SHA-256 blinded-request digest, plus commitment and protocol version |
| Client isolated account vault | Existing credential and an opening receipt containing the original blinding factor, independent secret salt, epoch and service/account scope |
| Public presentation | Existing credential only; no commitment, opening receipt, account identifier or new stable client identifier |

A fixed-length commitment input could encode a unique protocol domain, a big-endian epoch, 32 secret salt bytes and the canonical 256-byte RSA blinding factor. The precise encoding, hash choice, security argument and migration format must be frozen by review. The salt is a secret opening value, not the public RSA-PSS encoding salt. It must be independently random for each request and never appear in issuance or public presentation requests.

## Issuance and renewal rules

1. The client prepares the normal blinded request and an independent secret opening salt, then durably stores the entire pending request before submission.
2. The issuer atomically records the blinded-request digest and commitment with the quota. Exact replay must match both. Neither value may be changed after issuance.
3. The client finalizes and verifies the credential, then saves the private receipt with that credential before deleting pending scratch. Presentation serialization must explicitly strip the receipt.
4. Renewal verifies the old credential and its revocation state as today. It also verifies the receipt commitment against the authenticated account's original issuance record.
5. The issuer checks the canonical factor is nonzero, below the RSA modulus and invertible. It reconstructs the original blinded request from the verified signature and factor, then matches its stored digest. A matching factor commitment without a matching request digest is insufficient.
6. The same transaction advances continuity and stores the next request's independent commitment. Receipt, factor, salt, old pass and serial must not be written to account tables, logs, traces, error payloads or metrics.
7. Response recovery must return only an already recorded request with the same commitment. It must never allocate a replacement or change an existing commitment.

The binding argument to review is that, for a fixed recorded request and a factor fixed by the commitment, the unblinded signature is fixed. Adapting the factor to a borrowed signature would require another valid opening of that commitment. The hiding argument must cover an issuer that knows its private RSA key and can compute a candidate factor for every public signature; secrecy of the independent salt is therefore essential. These are proposed arguments, not a proof or independent review.

## Recovery, deletion and legacy decisions

- Recoverable lost responses remain supported using the existing pending request. The new commitment must join its exact-replay checks.
- Device loss needs an encrypted backup containing the private receipt as well as the credential. The existing encrypted secret-backup path should be extended; no plaintext backup or server-held opening secret is acceptable.
- If every copy of the opening receipt is lost, secure replacement is not established. Do not reset issuance history or silently accept any clean bearer. Define an explicit fail-closed recovery policy before release.
- Existing issued passes lack a prior commitment. A commitment created at renewal cannot retroactively prove original ownership. A reviewed legacy transition must explicitly handle these accounts; new issuance cannot reset their history.
- Previously deleted issuance history cannot be reconstructed. Do not fabricate it or claim a migration closes that gap.
- Account deletion may burn only a pass whose ownership is established. Review the current optional submitted-pass revocation path under the same ownership threat model. Do not add an account-to-serial map as a shortcut.

## Required adversarial acceptance

- Same-epoch borrowed public pass, adapted blinding factor, substituted salt, changed commitment, zero/noninvertible factor, malformed encoding and cross-epoch reuse all fail.
- Concurrent issuance, quota replay, renewal, account restriction and deletion cannot replace the stored commitment or allocate another pass.
- A revoked original pass cannot renew through issue, renew, recover, recreation or legacy migration.
- Two clean accounts can independently issue and renew; lost responses and encrypted backup restoration preserve their original receipts.
- Public serialization, database/schema inspection, logging canaries and backup inspection show no opening secret or account/persona join. An issuer with the stored transcript and public passes must not gain a new matching oracle.
- The review must address malicious signers, malicious clients, commitment-salt reuse, corrupt persistence, sparse-population timing and compatibility with the exact RSA-PSS variant implemented in `packages/sync`.

Use the shared sync package for any approved protocol work and preserve identical mobile/web semantics. The production implementation must not be enabled on the strength of happy-path tests alone. [Audit](../reports/REPORT-meerkat-security-audit-2026-09-04.md) and [RSA blind-signature specification](https://www.rfc-editor.org/rfc/rfc9474.html).
