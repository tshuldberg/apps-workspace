-- DoWork push tokens: scope deregistration to a single device (RT-7 fix).
--
-- dw_push_tokens had no device identity distinct from the Expo token itself,
-- so removePushTokens (sign-out, notifications-off) deleted every row for the
-- user, deregistering push on every device the user was signed into. Adding a
-- stable per-install device_id lets the client scope deletes and reads to the
-- device performing the action, leaving every other device's registration
-- untouched.
--
-- device_id is nullable for backward compatibility with rows written before
-- this migration; those rows are cleaned up naturally as dowork-notify prunes
-- DeviceNotRegistered tokens or the user re-registers post-upgrade.
--
-- All statements idempotent.

alter table public.dw_push_tokens
  add column if not exists device_id text;

create index if not exists dw_push_tokens_device_idx
  on public.dw_push_tokens (user_id, device_id);
