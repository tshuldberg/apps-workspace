# BestChef Account Lifecycle Runbook

Date: 2026-04-26

Status: P0 foundation implemented, native auth callback handling added, and local service-role deletion worker scaffolded. Public launch still requires production auth provider configuration, device QA, worker deployment/secrets, and a staging deletion drill.

## Scope

This runbook covers BestChef account linking, recovery, deletion requests, and anonymous beta identity merge checks.

## Identity Model

- Internal beta can create anonymous Supabase sessions.
- Public launch must offer durable sign-in before broad release. Current app foundation supports email link requests from Settings and keeps the existing anonymous user id when Supabase can confirm the email update.
- If Apple Sign-In or Google Sign-In is enabled, iOS launch must include Sign in with Apple and the provider configuration must be verified in Supabase and Apple Developer.

## User Account Linking

1. User opens BestChef Settings, Account.
2. User enters an email address and taps Link Email.
3. The app calls Supabase `updateUser({ email })` for anonymous beta users, or sends an email sign-in link for already durable sessions.
4. User confirms the email from the same device or supported deep link. The app handles `bestchef://auth-callback`, `bestchef:///auth-callback`, PKCE `code`, implicit `access_token` and `refresh_token`, and `token_hash` callback shapes.
5. Support verifies `bc_current_identity_status()` returns `is_anonymous = false` and the same `profile_id`.

## Recovery

1. User opens BestChef Settings, Account.
2. User enters the account email and taps Recovery Email.
3. The app sends Supabase recovery instructions.
4. The native callback handler establishes the recovered session and marks the Settings account state as recovery-confirmed.
5. If the user lost the device and has no durable provider, support cannot recover the anonymous beta account. Treat this as unrecoverable unless a future signed merge token exists.

## Delete Account

1. User opens BestChef Settings and taps Delete Account.
2. The app calls `bc_request_account_deletion()`.
3. The app deletes the current `social_profiles` row, which cascades owned public BestChef social data where the schema allows hard deletion.
4. The app wipes local recipes, pantry, receipt imports, submissions, comments, votes, reports, blocks, media cache files, settings, and known sync secrets.
5. The app signs out of Supabase.
6. The server-only deletion worker finishes service-role work:
   - Invoke `bestchef-delete-account` with `BESTCHEF_ACCOUNT_DELETION_WORKER_SECRET` from server/ops tooling only.
   - Delete storage objects and thumbnails owned by the profile before Auth deletion, including vote-proof media assets.
   - Mark owned `bc_media_assets` rows `deleted`, `rejected`, and `private`.
   - Auth/profile deletion cascades `bc_votes` and `bc_vote_proofs` through their profile foreign keys; local pgTAP coverage verifies linked vote/proof removal and pre-delete proof-media Storage inventory.
   - Delete the Supabase Auth user. `bc_account_deletion_requests.user_id` is nullable and uses `on delete set null`, so the request row survives for audit.
   - Mark `bc_account_deletion_requests.status` as `completed` or `failed` with diagnostic metadata.
   - Preserve only approved legal, abuse, payment, or moderation retention records.

## Anonymous Merge Checks

Before manually merging a beta anonymous profile into a durable profile:

1. Confirm both profile ids and the target durable auth user.
2. Run `select bc_profile_owned_row_counts('<source-profile-id>');`.
3. As admin, run `select bc_profile_merge_conflicts('<source-profile-id>', '<target-profile-id>');`.
4. If any conflict count is non-zero, do not bulk transfer rows. Resolve votes, helpful ratings, note ratings, and badges manually.
5. Record the final support action in the release evidence packet.

## Open Launch Items

- Configure production Supabase email, Apple, and optional Google providers.
- Run native deep-link callback verification for email link and recovery flows on iOS device, iOS simulator, and Android emulator if Android public beta is in scope.
- Deploy `bestchef-delete-account` to staging and production with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `BESTCHEF_ACCOUNT_DELETION_WORKER_SECRET` configured only server-side.
- Apply `20260426000008_bestchef_account_deletion_worker.sql` to staging and production.
- Run a seeded deletion drill verifying storage deletion, media row state, profile/Auth removal, request survival, and failed-state retry.
- Add device reinstall restore smoke tests.
- Add RLS integration tests against Supabase for anonymous, linked user, authenticated user, moderator, and admin roles.
