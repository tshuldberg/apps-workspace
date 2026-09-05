-- Enable BestChef beta app flows to resolve visible app submissions to hosted rows.

insert into bc_dishes (name, slug, category, cuisine, status)
values
  ('Pad Thai', 'pad-thai', 'main', 'Thai', 'active'),
  ('Carbonara', 'carbonara', 'main', 'Italian', 'active'),
  ('Tacos al Pastor', 'tacos-al-pastor', 'main', 'Mexican', 'active'),
  ('Ramen', 'ramen', 'soup', 'Japanese', 'active'),
  ('Butter Chicken', 'butter-chicken', 'main', 'Indian', 'active'),
  ('Pho', 'pho', 'soup', 'Vietnamese', 'active'),
  ('Ceviche', 'ceviche', 'appetizer', 'Peruvian', 'active'),
  ('Bibimbap', 'bibimbap', 'main', 'Korean', 'active'),
  ('Shakshuka', 'shakshuka', 'breakfast', 'Middle Eastern', 'active'),
  ('Tiramisu', 'tiramisu', 'dessert', 'Italian', 'active'),
  ('Jollof Rice', 'jollof-rice', 'main', 'West African', 'active'),
  ('Tom Yum', 'tom-yum', 'soup', 'Thai', 'active'),
  ('Empanadas', 'empanadas', 'appetizer', 'Argentine', 'active'),
  ('Croissant', 'croissant', 'bread', 'French', 'active'),
  ('Dumplings', 'dumplings', 'appetizer', 'Chinese', 'active'),
  ('Fish Tacos', 'fish-tacos', 'main', 'Mexican', 'active'),
  ('Risotto', 'risotto', 'main', 'Italian', 'active'),
  ('Banh Mi', 'banh-mi', 'main', 'Vietnamese', 'active'),
  ('Churros', 'churros', 'dessert', 'Spanish', 'active'),
  ('Falafel', 'falafel', 'appetizer', 'Middle Eastern', 'active')
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  cuisine = excluded.cuisine,
  status = 'active',
  updated_at = now();

create table if not exists bc_submission_aliases (
  alias text primary key,
  submission_id uuid not null references bc_submissions(id) on delete cascade,
  created_by_profile_id uuid not null references social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint bc_submission_aliases_alias_format check (alias ~ '^(demo|local):[A-Za-z0-9_-]{1,80}$')
);

create index if not exists bc_submission_aliases_submission_idx on bc_submission_aliases (submission_id);
create index if not exists bc_submission_aliases_profile_idx on bc_submission_aliases (created_by_profile_id, created_at desc);

alter table bc_submission_aliases enable row level security;

drop policy if exists "bc_submission_aliases_read" on bc_submission_aliases;
create policy "bc_submission_aliases_read" on bc_submission_aliases for select using (true);

drop policy if exists "bc_submission_aliases_insert" on bc_submission_aliases;
create policy "bc_submission_aliases_insert" on bc_submission_aliases for insert with check (
  bc_profile_owned(created_by_profile_id)
  and exists (
    select 1
    from bc_submissions s
    where s.id = submission_id
      and s.profile_id = created_by_profile_id
  )
);

drop policy if exists "bc_submission_aliases_admin_delete" on bc_submission_aliases;
create policy "bc_submission_aliases_admin_delete" on bc_submission_aliases for delete using (bc_is_admin());
