-- Typed (kind + params) notifications, no stored English (plan 33 Phase 2.1, N1).

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select has_column('public', 'bc_notifications', 'params', 'bc_notifications has params');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000401', 'authenticated', 'authenticated', 'nt-chef@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000402', 'authenticated', 'authenticated', 'nt-fan@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into social_profiles (id, user_id, handle, display_name) values
  ('10000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000401', 'ntchef401', 'Chef Nakamura'),
  ('10000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000402', 'ntfan402', 'Fan Garcia')
on conflict (id) do nothing;

-- Follow fanout: typed, empty title, actor in params.
select bc_notify_follow(
  '10000000-0000-0000-0000-000000000402',
  '10000000-0000-0000-0000-000000000401'
);

select is(
  (select title from bc_notifications
    where user_id = '00000000-0000-0000-0000-000000000401' and kind = 'follow'
    order by created_at desc limit 1),
  ''::text,
  'follow notification stores no English title'
);

select is(
  (select params ->> 'actor_name' from bc_notifications
    where user_id = '00000000-0000-0000-0000-000000000401' and kind = 'follow'
    order by created_at desc limit 1),
  'Fan Garcia'::text,
  'follow notification carries the actor name in params'
);

select is(
  (select actor_name from bc_notifications
    where user_id = '00000000-0000-0000-0000-000000000401' and kind = 'follow'
    order by created_at desc limit 1),
  'Fan Garcia'::text,
  'follow notification populates the actor_name column (avatar path)'
);

-- Rank fanout: numbers only.
select bc_notify_rank_change('10000000-0000-0000-0000-000000000401', 12, 3);

select is(
  (select kind from bc_notifications
    where user_id = '00000000-0000-0000-0000-000000000401' and category = 'ranks'
    order by created_at desc limit 1),
  'rank_milestone'::text,
  'crossing a milestone is typed rank_milestone'
);

select is(
  (select params from bc_notifications
    where user_id = '00000000-0000-0000-0000-000000000401' and kind = 'rank_milestone'
    order by created_at desc limit 1),
  '{"delta": 9, "new_rank": 3, "old_rank": 12}'::jsonb,
  'rank params carry the numbers, not prose'
);

select is(
  (select body from bc_notifications
    where user_id = '00000000-0000-0000-0000-000000000401' and kind = 'rank_milestone'
    order by created_at desc limit 1),
  ''::text,
  'rank notification stores no English body'
);

-- Legacy backfill: English rows gain params without losing their fallback copy.
insert into bc_notifications (user_id, kind, category, title, body, actor_user_id)
values ('00000000-0000-0000-0000-000000000401', 'comment', 'social',
        'Fan Garcia commented on your recipe', 'Nice crust!',
        '00000000-0000-0000-0000-000000000402');

update public.bc_notifications n
set params = n.params
  || coalesce(
       (select jsonb_build_object('actor_name', coalesce(p.display_name, p.handle))
          from public.social_profiles p
         where p.user_id = n.actor_user_id
         limit 1),
       '{}'::jsonb
     )
  || case
       when n.kind in ('comment', 'mention') and n.body <> ''
         then jsonb_build_object('snippet', left(n.body, 120))
       else '{}'::jsonb
     end
where n.params = '{}'::jsonb;

select is(
  (select params ->> 'snippet' from bc_notifications
    where user_id = '00000000-0000-0000-0000-000000000401' and kind = 'comment'
    order by created_at desc limit 1),
  'Nice crust!'::text,
  'backfill derives snippet params from legacy rows'
);

-- Activity view exposes typed params.
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bc_profile_activity_v'
      and column_name = 'params'
  ),
  'bc_profile_activity_v exposes params'
);

select * from finish();

rollback;
