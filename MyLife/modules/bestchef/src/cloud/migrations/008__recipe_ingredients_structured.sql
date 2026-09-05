-- P11-B (F-034): Structured ingredient storage for cloud-replicated recipes.
--
-- Adds structured columns to bc_recipe_ingredients so downstream features
-- (F-001 grocery from recipe, F-002 pantry decrement, F-003 pantry availability)
-- can reason about quantities without re-parsing strings at every use-site.
--
-- The table is created if missing so this migration is idempotent in fresh
-- environments and additive in existing ones.

create table if not exists public.bc_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.bc_recipe_ingredients
  add column if not exists qty_value numeric,
  add column if not exists unit text,
  add column if not exists item text,
  add column if not exists prep_note text,
  add column if not exists raw_line text;

create index if not exists bc_recipe_ingredients_item_idx
  on public.bc_recipe_ingredients (lower(item));

create index if not exists bc_recipe_ingredients_recipe_idx
  on public.bc_recipe_ingredients (recipe_id);

alter table public.bc_recipe_ingredients enable row level security;

drop policy if exists "owner all" on public.bc_recipe_ingredients;
create policy "owner all" on public.bc_recipe_ingredients for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
