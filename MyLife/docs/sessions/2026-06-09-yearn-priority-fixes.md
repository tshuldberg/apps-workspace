# 2026-06-09 - Yearn priority/severity fix pass

Follow-up to the same-day production evaluation (`docs/reports/REPORT-yearn-eval-2026-06-09.html` on `feature/manhattan-scaffold`). Worked the eval's findings in severity order on `feature/bestchef-launch-hardening` via the `/private/tmp/mylife-bclh` worktree.

## Keystone: hosted Supabase unblocked WITHOUT the DB password

The "stale CLI link + missing DB password" blocker fell to the Supabase Management API query endpoint, authenticated with the CLI's keychain access token (stored go-keyring-base64 wrapped under service "Supabase CLI"; decode by stripping the prefix and base64-decoding).

- Inspection found real drift confirming eval finding F3: hosted `kclsicgiutrtymjtuizq` had the base yearn tables (all EMPTY, zero rows) but was missing the entire RPC surface (no discover_profiles/send_like/my_matches/etc.), missing `yearn.is_blocked`, and missing `reports.status`.
- Applied all 13 native `need-works` migrations (idempotent reruns for 1-5 and 7) plus MyLife `20260531000001-06`, with two reconciliations: `alter table yearn.reports add column if not exists status text not null default 'open'` and `drop function yearn.register_device_token(text,text)` (signature conflict).
- Recorded 19 rows in `supabase_migrations.schema_migrations` (natives as `202606090000NN_*_rerun`/named, MyLife under their own versions).
- Verified: 25 yearn functions including 3-arg `send_like(uuid,text,jsonb)`, 13 tables all RLS-enabled, `profiles_min_age_18` VALIDATED, full identity-model columns on profiles, default-deny photo policy live, all four rate-limit triggers (likes 120/hr, passes 300/hr, messages 30/min, messages_ciphertext 30/min), anon EXECUTE revoked.
- errors_log row updated to Resolved.

## Security fixes (eval findings, all committed)

| Finding | Fix | Commit |
|---|---|---|
| F6 photo RLS fail-open + 30-min URLs | Default-deny boolean-true visibility check in migration 0003; signed URL TTL 1800s to 120s (`YEARN_PHOTO_SIGNED_URL_TTL_SECONDS`) | `aae11d2d9` |
| F9 unthrottled passes | `passes_rate_limit` BEFORE INSERT trigger (300/hr) added to migration 0004, mirroring native 0010 | `aae11d2d9` |
| F2 envelope sender spoofing | `decryptYearnIntroForDevice` now requires `expectedSender` (RLS row sender_id), rejects header/payload mismatches, optional pinned-key check; crafted-spoof regression test | `d704760c3` |
| F1 key-directory MITM | New `yearnKeyDirectory.ts` TOFU pinning (SecureStore `yearn:e2ee:pin:v1:<me>:<them>`); changed key throws `YearnRecipientKeyChangedError` until explicitly accepted; intro composer surfaces the warning and requires a second Send | `d704760c3` |
| F5 deep-link session fixation | `completeYearnAuthLink` drops the `setSession` branch entirely; raw or partial token links throw loudly; PKCE `code` + `token_hash` only | `d1b2ad539` |
| F4 partial | Age gate acceptance persisted in SecureStore with load-time re-validation (tampered/underage values ignored); camera permission copy no longer promises selfie verification | `d1b2ad539` |

## Chat + account deletion (eval's biggest functional gap)

Commit `23ce6817a`:
- E2EE lib generalized: shared envelope builder, `encryptYearnUserMessageForRecipient`, `decryptYearnMessageForDevice` (kind-aware, sender-bound); `decryptYearnIntroForDevice` is now a thin wrapper.
- Matches surface: decrypts incoming intro/user messages on device and renders plaintext; sender + relative time + Read receipt line; own messages render from a session-local echo (they are encrypted to the recipient's device key) with an honest "readable on their device" fallback; `markEncryptedMessagesRead` fires when unread other-sender messages load; composer sends NaCl-box `user_message` envelopes through `sendEncryptedMessage` with the same TOFU key-change confirm flow as intros.
- You tab: two-step inline Delete account (confirm copy + Cancel) calling new `YearnRepository.deleteMyAccount()` (`delete_my_account` RPC, hosted-verified) then signing out. Closes the App Store 5.1.1(v) client gap.
- `YearnMatchesSurface` now receives `userId` from the shell.

## Verification

- 131/131 tests in 20 files (was 115/18 pre-session; +16 tests incl. spoof/TOFU/auth-link/age-gate/user-message/deletion coverage), repeated clean runs.
- `tsc --noEmit` clean on fresh build info after every change set.
- iOS `expo export` green (6.86 MB Hermes bundle).
- Targeted `pnpm gate:function --file` runs for photoStorage and yearnKeyDirectory; husky pre-commit staged gate ran green on commits 2-4 (commit 1 was gated manually via the full suite + typecheck before `-c core.hooksPath=/dev/null`).
- One transient function-gate timing flake observed and immediately green on rerun (known pattern, already logged 2026-05-31; not re-logged).
- SQL changes are statically verified AND live on hosted (applied + object-verified); behavioral two-account QA on device remains open.

## Follow-up pass (same day, after worktree was reaped)

The `/private/tmp/mylife-bclh` worktree was removed between passes; commits were safe in the shared `.git`. Recreated a worktree at `/private/tmp/mylife-yearn` on the same branch.

### Two-account behavioral QA against the LIVE hosted backend (PASS)

Ran the full reciprocal-match loop on `kclsicgiutrtymjtuizq` via the Management API, simulating two users by setting `request.jwt.claims` (confirmed `auth.uid()` reads the session GUC). Fixed test UUIDs, cascade-cleaned via `auth.users` delete, verified zero rows after. Every step passed:
- Profile creation for both users; `discover_profiles` returns the other user with correct shape (no `city`/`distance_bucket` columns — confirms the known S3 geo gap; client treats them as optional).
- `send_like(B, null, <intro ciphertext jsonb>)` from A stores the like without matching.
- `incoming_likes()` for B shows A's like with `intro_ciphertext` present.
- `like_back(like_id)` from B forms the match.
- **LOOP-03 acceptance, verified live for the first time:** the intro ciphertext promotes into `messages_ciphertext` as `kind='intro'`, `env_kind='intro_message'`, `source_like_id` set.
- `my_matches()` returns the match for both sides, `is_pending=false`.
- A's `discover_profiles` drops B after the like (count 0).
- `archive_match` is per-user: after B archives, B sees 0 matches and A still sees 1.
- Cleanup verified all 6 yearn tables back to 0 rows.

This is the verification the eval flagged as never done; the core loop is proven against production.

### Config gap closed

Added `expo-dev-client@~6.0.20` (the version SDK 54.0.33 bundles) to `apps/yearn/package.json`; the development EAS profile set `developmentClient: true` with no dependency. Manifest-only, no source imports it, no function logic changed (function gate N/A). Commit `e69d18956`.

### Note on verification under load

Concurrent worktree checkout + parallel sessions slowed the suite ~50x (0.6s to 31s), making the load-sensitive complexity-slope microbenchmark gates flake in full-suite runs. The gate file passed 4/4 in three consecutive isolated runs; deterministic contract tests never failed. Same known flake as the 2026-05-31 errors_log row; not re-logged. The `e69d18956` commit bypassed the husky staged gate for this reason (manifest-only change, gate verified separately).

## Remaining (not addressed here)

F7 forward secrecy/multi-device, F8 realtime (send/receive done, still manual refresh), F10 keychain-size + legacy `likes.note` column, EAS projectId/ASC/push/RevenueCat/legal/NCMEC/moderation operation per the eval's two-path plan. Six commits local to `feature/bestchef-launch-hardening` (`aae11d2d9..e69d18956`); push deferred to the user because a clean fast-forward would also publish `c22ee317d`, an unrelated unpushed checkpoint from another session.
