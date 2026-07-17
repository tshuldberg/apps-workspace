# Documentation Research: Signal-Style E2EE for MyLife Market

Date: 2026-03-10
Scope: Verify Signal's current official protocol requirements and translate them into an actionable MyLife Market messaging plan.

## Sources (Official)
- https://signal.org/docs/specifications/pqxdh/
- https://signal.org/docs/specifications/doubleratchet/
- https://signal.org/docs/specifications/sesame/
- https://signal.org/blog/phone-number-privacy-usernames/
- https://support.signal.org/hc/en-us/articles/360007060632-What-is-a-safety-number-and-why-do-I-see-that-it-changed
- https://support.signal.org/hc/en-us/articles/10223569377562-Key-Transparency-Auto-verify-encryption
- https://github.com/signalapp/libsignal

## Findings (Documented Facts)
1. Signal documents PQXDH as its asynchronous session bootstrap protocol. The spec combines classical and post-quantum components for new session establishment.
2. Signal documents Double Ratchet as the per-message ratcheting layer after session bootstrap. The current public spec revision is newer than the original and covers forward secrecy and post-compromise recovery.
3. Signal documents Sesame as the multi-device session management layer. Device fanout is part of the protocol design, not an optional implementation detail.
4. Signal's support docs say users verify identity changes with safety numbers, and Signal now also supports auto-verification through Key Transparency.
5. Signal's phone-number-privacy launch states usernames, QR codes, and share links can be used without exposing a phone number to another user. The post also states usernames are not directory-searchable.
6. Signal's public `libsignal` repository states it powers Signal's clients and servers, but also says use outside Signal is unsupported. The repo also exposes TypeScript bindings via a native Node module, which is not a direct fit for browser or Expo runtime code.

## Recommendations
1. Treat "Signal-like" in MyLife as a protocol requirement, not a marketing adjective. The minimum credible target is: device identity keys, signed prekeys, one-time prekeys, PQ bootstrap, per-message ratcheting, and identity verification UX.
2. Use MyLife usernames, friend-link codes, and QR/share links as the contact layer so Market buyers and sellers can connect without phone-number disclosure.
3. Keep server storage limited to public key bundles, ciphertext envelopes, delivery metadata, and abuse-control metadata. Do not store plaintext messages if the product claim is Signal-like E2EE.
4. Do not claim compatibility with Signal or claim production-grade Signal-equivalent security until MyLife has: client-side ratchet implementation, device session fanout, safety-code verification, attachment encryption, multi-device key sync, and recovery rules.
5. Do not rely on official `libsignal` as an immediate drop-in for MyLife web and Expo clients without a separate licensing and runtime feasibility decision.

## Proposed Instruction Updates
- `/Users/trey/Desktop/Apps/MyLife/docs/specs/SPEC-mymarket.md`: update MK-006 from generic private messaging to Signal-style E2EE message requests and device-bound ciphertext delivery.
- `/Users/trey/Desktop/Apps/MyLife/docs/designs/DESIGN-market-signal-style-messaging.md`: add the implementation boundary, runtime constraints, and rollout plan.
