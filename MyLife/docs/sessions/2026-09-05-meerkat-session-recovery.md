# Meerkat security remediation: recover interrupted pass requests

Date: 2026-09-05. Scope: continue audit S2 with mobile/web parity. Local implementation, no deployment, commit or push in this session. The wider working tree includes concurrent work.

## Result

A lost issuance response can now be recovered after signing in again to the original account and server. A lost next-period renewal can also be recovered once that period begins, without resubmitting the old pass. Recovery returns only a previously authorized signature and cannot allocate another pass. S2 remains release blocking for borrowed-pass renewal binding, complete credential loss, missed windows and previously deleted history.

## Changes

- Relay `src/account-service.ts` and `src/account-service-http.ts`: authenticated `POST /account/credential/recover` accepts strictly `{epoch, blindedMessage}`. Current epoch or the next epoch during its renewal window only. The atomic store receives identical target and predecessor epochs, making its strict advance branch impossible; only the existing same-account, same-epoch, same-request-digest replay branch can succeed. Eligibility and account flags still apply. Logs contain outcome/reason or epoch only.
- Mobile `app/(root)/data/account-core.ts` and web `src/lib/account.ts`: version 3 pending requests pin service and account hashes inside the isolated secret store. Status is fetched with the captured session, and a changed account cannot transmit the original blinded request. A changed service is rejected before sending the account bearer. New session or issue/renew route changes use recovery only, never fresh issuance as fallback. Version 2 requests retain same-session replay but cannot cross sessions because their original account/server cannot be independently established.
- Blinding state, finished message and account hash never enter the recovery body. The browser still flushes its encrypted vault before submission. Finished credentials become durable before pending state is deleted. Completed scratch cleanup also checks account and service.
- Service, HTTP, file-store, real PostgreSQL and both client tests cover the boundaries. Shared sync adds a cryptographic counterexample test, with no runtime cryptographic changes.

## Why binding is still open

A proof of a blinding factor does not establish ownership of the original issuance. Under the current RSA construction, let `w` be one's own blind signature response and `s` any valid borrowed signature under the same epoch key. The holder can compute `r = w * inverse(s) mod n`. Unblinding `w` with `r` returns `s`; the associated blinded-message relation holds as well. The new real-key test reconstructs and verifies the borrowed credential this way.

This is an inference demonstrated against the implementation, using the blind/unblind equations in [RFC 9474 section 4](https://www.rfc-editor.org/rfc/rfc9474.html#section-4). It does not break blindness or forge a signature. It rules out treating a supplied blinding factor, its knowledge proof, or a replay receipt alone as issuance ownership. The earlier private-storage session's tentative receipt direction is not an accepted protocol. A binding construction needs independent cryptographic review and adversarial acceptance before implementation.

## Verification

All runners use one worker and execute sequentially to respect the local memory limit.

| Check | Result |
|---|---|
| Mobile account client | 42 passed |
| Web account client | 50 passed |
| Relay service, HTTP, file store and account privacy wall | 57 passed |
| Shared blind credential protocol | 19 passed |
| Real PostgreSQL 16 account-store integration | 9 passed |
| Required changed-function gate | Passed: mobile 131, web 72, relay 50, sync 19 selected tests; 9 PostgreSQL tests skipped here and run separately above; all package/consumer typechecks pass |
| Mobile private-mesh account isolation | 3 passed |
| Full parity and generated-artifact checks | Passed |

The PostgreSQL run used an owned temporary cluster on loopback and a random port, not a configured or production database. Its fixture database and cluster were stopped and removed after the run. A first function gate found a possibly-undefined test pool access; the fixture already guarantees pool setup, and the test now follows the existing explicit assertion pattern. A subsequent gate caught missing configuration narrowing in the extracted status helper; both clients now check configuration there as well. Focused runtime tests had passed. The full gate also encountered a concurrent call-media teardown test invoking optional callbacks without narrowing; this session added only explicit required-callback assertions in that mobile/web test pair, preserving its behavior. Evidence logs are retained under ignored `.gstack/security-reports/2026-09-05-meerkat-session-recovery/`.

## Remaining acceptance

- Deploy the recovery endpoint before relying on it in released clients. An older server's 404 preserves pending state and reports recovery required.
- Recovery needs the original pending blinding state, account, server, retained issuance digest/key and an accepted period. It cannot replace a fully lost pass, recover expired prior periods, or repair previously deleted issuance history. Legacy version 2 scratch cannot rotate sessions safely.
- Independent issuance-binding protocol review and adversarial borrowed-bearer tests remain required for S2. No new account/persona or serial/account mapping was introduced.
- Signed physical-device/provider acceptance from S4 and the original audit remains outstanding. Local tests are not production security certification.
