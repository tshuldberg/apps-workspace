-- 001__dish_visuals.sql
--
-- Per-cuisine fallback visuals for bc_dishes. Adds three optional columns
-- so every dish has a brand-strong fallback (rotated emoji over a per-cuisine
-- gradient) even when photo_url is null.
--
-- Mirror of the additive DDL embedded in schema.sql immediately above the
-- beta dish seed insert; both must stay in sync if these columns change.

alter table public.bc_dishes
  add column if not exists gradient_from text,
  add column if not exists gradient_to text,
  add column if not exists emoji text;

-- Backfill per-cuisine gradients for any existing rows. The mapping is the
-- canonical 14-cuisine palette ported from are-blaze
-- (Backend/RecipeRepository.swift `gradient(for:)`). Unknown cuisines fall
-- back to the same default the TypeScript helper uses (#D9742F to #8C401E).
update public.bc_dishes
set
  gradient_from = case cuisine
    when 'Italian' then '#F27333'
    when 'Japanese' then '#EBC766'
    when 'Mexican' then '#F2662E'
    when 'Thai' then '#F28C33'
    when 'French' then '#F5C773'
    when 'Korean' then '#F25940'
    when 'Indian' then '#EB7326'
    when 'Chinese' then '#CC4059'
    when 'Vietnamese' then '#B37340'
    when 'Spanish' then '#F28C33'
    when 'Peruvian' then '#D9664D'
    when 'Argentine' then '#8CA6D9'
    when 'Middle Eastern' then '#D98C4D'
    when 'West African' then '#F28033'
    else '#D9742F'
  end,
  gradient_to = case cuisine
    when 'Italian' then '#A63326'
    when 'Japanese' then '#B37333'
    when 'Mexican' then '#A6401F'
    when 'Thai' then '#E64D26'
    when 'French' then '#C7803F'
    when 'Korean' then '#B32E26'
    when 'Indian' then '#B8401A'
    when 'Chinese' then '#801F38'
    when 'Vietnamese' then '#7A471F'
    when 'Spanish' then '#BF4D26'
    when 'Peruvian' then '#8C332E'
    when 'Argentine' then '#4D66A6'
    when 'Middle Eastern' then '#8C4D26'
    when 'West African' then '#B3401F'
    else '#8C401E'
  end
where gradient_from is null
   or gradient_to is null;

-- Emoji backfill matches the TypeScript getDishEmoji() keyword map. Anything
-- that does not match a keyword keeps the generic fallback plate emoji so
-- gradient_from / gradient_to / emoji are all non-null after the migration.
update public.bc_dishes
set emoji = case
  when lower(name) like '%ramen%' then '🍜'
  when lower(name) like '%pho%' then '🍜'
  when lower(name) like '%noodle%' then '🍜'
  when lower(name) like '%pad thai%' then '🍜'
  when lower(name) like '%taco%' then '🌮'
  when lower(name) like '%dumpling%' then '🥟'
  when lower(name) like '%bao%' then '🥟'
  when lower(name) like '%empanada%' then '🥟'
  when lower(name) like '%rice%' then '🍚'
  when lower(name) like '%risotto%' then '🍚'
  when lower(name) like '%bibimbap%' then '🍚'
  when lower(name) like '%croissant%' then '🥐'
  when lower(name) like '%churro%' then '🥐'
  when lower(name) like '%curry%' then '🍛'
  when lower(name) like '%butter chicken%' then '🍛'
  when lower(name) like '%falafel%' then '🧆'
  when lower(name) like '%ceviche%' then '🐟'
  when lower(name) like '%fish%' then '🐟'
  when lower(name) like '%shakshuka%' then '🍳'
  when lower(name) like '%tiramisu%' then '🍰'
  when lower(name) like '%banh%' then '🥖'
  when lower(name) like '%tom yum%' then '🍲'
  when lower(name) like '%soup%' then '🍲'
  else '🍽️'
end
where emoji is null;
