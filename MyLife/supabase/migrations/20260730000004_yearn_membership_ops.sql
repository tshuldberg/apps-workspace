-- Yearn membership operations support (plan 47 Phase 5).
-- Service-role lookup used by the yearn-appstore-notifications webhook to
-- resolve the entitlement owner when a notification's transaction carries no
-- appAccountToken (e.g. some lifecycle events after the original purchase).
-- Idempotent and re-runnable after 20260730000003.

create or replace function yearn.entitlement_user_for_transaction(
  p_original_transaction_id text
)
returns uuid
language sql
stable
security definer
set search_path = yearn, public
as $$
  select e.user_id
  from yearn.entitlements e
  where e.original_transaction_id = p_original_transaction_id
  limit 1;
$$;

revoke all on function yearn.entitlement_user_for_transaction(text)
  from public, anon, authenticated;
grant execute on function yearn.entitlement_user_for_transaction(text)
  to service_role;
