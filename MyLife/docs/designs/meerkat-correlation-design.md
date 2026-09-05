# Meerkat correlation design (Plan 44 Phase 4 WP-4C)

Status: design. This document defines how request correlation works in the Meerkat services
WITHOUT breaking the zero-knowledge and metadata-privacy guarantees. It specifies a later
implementation package; it does not itself ship code.

## The problem

An operator debugging a service needs to tie together the log lines of a single request:
the parse, the store call, the outcome. Standard practice is a distributed trace with a
propagated trace id (W3C `traceparent`) flowing across every hop. For Meerkat that standard
practice is a privacy violation, so we deliberately reject it and use a narrower mechanism.

## Hard constraints (from the codebase and CLAUDE.md)

- The slim relay pairs clients by OPAQUE ephemeral tokens and forwards ciphertext VERBATIM.
  It never parses envelopes, never logs them, never sees device ids or plaintext. Its only
  public surface is `GET /healthz -> {ok, connections}`.
- A correlation identifier must be OPAQUE to the relay and MUST NEVER be propagated through
  envelopes or peer protocols. A trace id that crossed the relay would let the relay (or a
  relay-adjacent observer) link two peers' activity: exactly the metadata linkage the
  transport design exists to prevent.
- Service logs already deep-redact: every service's `out()` runs `redactForLog(obj)` before
  stdout (e.g. `bin/meerkat-persona-service.mjs`), and the log-hygiene canary E2E asserts no
  secret escapes. Correlation must not reintroduce a leak.
- Metric label sets are static and non-identifying. A correlation id is high-cardinality by
  nature and therefore MUST NOT become a metric label.

## Design: per-service request ids, generated at the HTTP edge

1. **Generation.** Each stateful service (community, directory, humanity, persona, hosted)
   generates a fresh random request id (e.g. a 128-bit value, hex or base32url) at its own
   HTTP edge when a request arrives, for requests it terminates. The id is created locally;
   it is never read from an inbound header on the public edge (an attacker-supplied id could
   poison correlation or smuggle content).

2. **Scope.** The request id lives ONLY inside that one service's process, threaded through
   its own NDJSON log events for that request (parse -> store call -> outcome). It is a
   join key for one service's own logs during one request. It is emitted through the
   existing redacting `out()`/`log()` path, so it inherits redaction. The request id itself
   carries no identity: it is random and meaningless outside the log stream.

3. **Non-propagation (the core rule).** The request id is NEVER:
   - written into a Meerkat envelope or any relayed frame,
   - forwarded to a peer over any transport (LAN, nearby, BLE, WebRTC, relay),
   - sent as an outbound header the relay could see,
   - used as a metric label.
   It does not cross the relay. It does not cross a service boundary. Two services handling
   two hops of the same user action get DIFFERENT, unrelated request ids by design; there is
   intentionally no end-to-end trace that would let an observer stitch a user's path.

4. **Service-to-service calls.** Some services call each other over the internal network
   (persona -> humanity verify, community -> persona session verify). These are first-party,
   internal, and do NOT go through the relay. A caller MAY include its own request id as an
   internal correlation header ONLY on the internal network AND only for first-party service
   hops, and the callee logs it as `caller_request_id` alongside its own fresh id. This is
   optional and stays behind the private network; it is never used on the public edge and
   never touches the relay or a peer protocol. If in doubt, omit it: independent per-service
   ids are the safe default.

5. **W3C traceparent is explicitly rejected across the relay and peer protocols.** We do not
   implement distributed tracing spans that propagate a shared trace id through envelopes or
   over transports. The reason is metadata privacy: a propagated span id is precisely the
   cross-hop linkage the zero-knowledge transport forbids. `traceparent` MAY exist, if ever,
   only on internal first-party service-to-service HTTP (same scope as rule 4), never on the
   public relay surface and never in a relayed payload.

## What this buys and what it costs

- Buys: an operator can reconstruct a single request within one service from its logs,
  which is the common debugging need, without adding any cross-service or cross-relay
  linkage.
- Costs: there is no automatic end-to-end trace across services. That cost is intentional. A
  cross-service investigation correlates by TIME and by the bounded, non-identifying fields
  already logged (route template, outcome class, digest), not by a shared id. This matches
  the existing design where the relay knows nothing and services minimize what they log.

## Implementation plan (later package)

A small, dependency-free helper, mirroring `service-health.ts` and `log-redaction.ts`:

1. `request-correlation.ts` exporting:
   - `newRequestId()` -> a random opaque id (crypto.randomBytes, hex/base32url).
   - `withRequestContext(handler)` -> wraps a `node:http` request handler so a per-request
     id is available to that request's log calls (via an explicit argument or an
     AsyncLocalStorage-backed context; explicit argument is preferred for auditability).
   - No propagation helpers. There is deliberately no `injectTraceparent` / `extractTrace`.
2. Wire each service's edge to generate an id per terminated request and pass it into its
   existing redacting `log()` so events gain a `requestId` field. No change to the relay.
3. Tests:
   - a request id is present and STABLE across the log lines of one request,
   - two concurrent requests get DIFFERENT ids and never cross-contaminate,
   - the id never appears in any envelope, relayed frame, outbound peer message, or metric
     label (assert against the relay + peer paths, extending the zero-knowledge wire-byte
     assertions the multi-node harness already makes),
   - the canary-secret log test still passes (redaction unaffected).
4. CI: extend the log-hygiene canary suite to also assert no correlation id leaks onto the
   relay `/healthz` or into a relayed payload.

## Non-goals

- No distributed tracing backend, span export, or OTLP pipeline. Hosting any such collector
  is founder-ops and out of scope; more importantly, cross-relay span propagation is
  forbidden here on privacy grounds, not merely deferred.
- No correlation id on the relay. The relay's zero-knowledge surface does not change.
