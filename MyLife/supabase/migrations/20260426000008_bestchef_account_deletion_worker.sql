-- BestChef account deletion worker hardening.
-- Deletion requests must survive auth.users deletion so the service-role
-- worker can mark completion and support can audit the outcome.

alter table bc_account_deletion_requests
  alter column user_id drop not null;

do $$
declare
  constraint_name text;
begin
  select c.conname
  into constraint_name
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid
   and a.attnum = any(c.conkey)
  where c.conrelid = 'bc_account_deletion_requests'::regclass
    and c.confrelid = 'auth.users'::regclass
    and c.contype = 'f'
    and a.attname = 'user_id'
  limit 1;

  if constraint_name is not null then
    execute format('alter table bc_account_deletion_requests drop constraint %I', constraint_name);
  end if;
end $$;

alter table bc_account_deletion_requests
  add constraint bc_account_deletion_requests_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete set null;

comment on column bc_account_deletion_requests.user_id is
  'Nullable after account deletion so the request row survives auth.users deletion for audit and support verification.';
