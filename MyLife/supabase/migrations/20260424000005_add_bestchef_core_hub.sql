-- BestChef authoritative server schema.
-- Keep this file aligned with supabase/migrations/20260424000005_add_bestchef_core_hub.sql.

create or replace function bc_is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role') in ('admin', 'moderator', 'service_role'), false)
    or coalesce((auth.jwt()->'app_metadata'->'roles') ?| array['admin', 'moderator', 'service_role'], false);
$$;

create or replace function bc_profile_owned(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select bc_is_admin() or social_profile_owned(profile_id);
$$;

create or replace function bc_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists bc_dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  native_name text,
  category text not null check (category in ('appetizer', 'soup', 'salad', 'main', 'side', 'dessert', 'bread', 'beverage', 'condiment', 'snack', 'breakfast')),
  cuisine text not null,
  region text,
  description text,
  photo_url text,
  alias_count integer not null default 0,
  submission_count integer not null default 0,
  status text not null default 'active' check (status in ('active', 'pending', 'merged', 'rejected')),
  proposed_by uuid references social_profiles(id) on delete set null,
  merged_into_dish_id uuid references bc_dishes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_dishes_slug_unique unique (slug)
);

create index if not exists bc_dishes_status_idx on bc_dishes (status, submission_count desc);
create index if not exists bc_dishes_category_idx on bc_dishes (category, status);
create index if not exists bc_dishes_cuisine_idx on bc_dishes (cuisine, status);

create table if not exists bc_dish_aliases (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references bc_dishes(id) on delete cascade,
  alias text not null,
  locale text,
  created_at timestamptz not null default now(),
  constraint bc_dish_aliases_unique unique (dish_id, alias, locale)
);

create index if not exists bc_dish_aliases_dish_idx on bc_dish_aliases (dish_id);
create index if not exists bc_dish_aliases_alias_idx on bc_dish_aliases (lower(alias));

create table if not exists bc_recipe_snapshots (
  id uuid primary key default gen_random_uuid(),
  original_local_recipe_id text,
  profile_id uuid not null references social_profiles(id) on delete cascade,
  title text not null,
  description text,
  servings integer check (servings is null or servings > 0),
  prep_time_mins integer check (prep_time_mins is null or prep_time_mins >= 0),
  cook_time_mins integer check (cook_time_mins is null or cook_time_mins >= 0),
  total_time_mins integer check (total_time_mins is null or total_time_mins >= 0),
  difficulty text,
  ingredients_json jsonb not null default '[]'::jsonb,
  steps_json jsonb not null default '[]'::jsonb,
  tags text[],
  nutrition_json jsonb,
  source_url text,
  source_attribution text,
  created_at timestamptz not null default now()
);

create index if not exists bc_recipe_snapshots_profile_idx on bc_recipe_snapshots (profile_id, created_at desc);
create index if not exists bc_recipe_snapshots_tags_idx on bc_recipe_snapshots using gin (tags);

create table if not exists bc_media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references social_profiles(id) on delete set null,
  owner_kind text not null check (owner_kind in ('dish', 'submission', 'recipe_snapshot', 'comment', 'post', 'product_record', 'product_contribution', 'product_evidence')),
  owner_id text not null,
  media_kind text not null check (media_kind in ('image', 'video', 'recipe_bundle')),
  storage_bucket text,
  storage_key text,
  remote_url text,
  content_hash text,
  byte_size bigint,
  width integer,
  height integer,
  duration_ms integer,
  upload_status text not null default 'pending' check (upload_status in ('pending', 'uploaded', 'processing', 'ready', 'failed', 'deleted')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'quarantined', 'rejected')),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_media_assets_storage_unique unique (storage_bucket, storage_key),
  constraint bc_media_assets_remote_url_https check (remote_url is null or remote_url ~ '^https://')
);

create index if not exists bc_media_assets_owner_idx on bc_media_assets (owner_kind, owner_id, created_at desc);
create index if not exists bc_media_assets_profile_idx on bc_media_assets (owner_profile_id, created_at desc);
create index if not exists bc_media_assets_status_idx on bc_media_assets (upload_status, moderation_status);
create index if not exists bc_media_assets_hash_idx on bc_media_assets (content_hash) where content_hash is not null;

create table if not exists bc_media_variants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references bc_media_assets(id) on delete cascade,
  variant text not null,
  storage_bucket text,
  storage_key text,
  remote_url text not null,
  content_hash text,
  byte_size bigint,
  width integer,
  height integer,
  duration_ms integer,
  created_at timestamptz not null default now(),
  constraint bc_media_variants_unique unique (asset_id, variant),
  constraint bc_media_variants_remote_url_https check (remote_url ~ '^https://')
);

create index if not exists bc_media_variants_asset_idx on bc_media_variants (asset_id);

create table if not exists bc_product_records (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  brand text,
  manufacturer text,
  product_type text not null default 'generic' check (product_type in ('generic', 'branded', 'raw_ingredient', 'prepared_food')),
  barcode text,
  gtin text,
  category text,
  grocery_section text,
  default_storage_location text,
  nutrition_json jsonb not null default '{}'::jsonb,
  source text not null check (source in ('manual', 'unknown', 'open_food_facts', 'usda_fdc', 'gs1', 'bestchef_cache', 'local_cache', 'receipt_ocr', 'food_recognition', 'user_contribution')),
  source_id text,
  source_url text,
  confidence double precision check (confidence is null or (confidence >= 0 and confidence <= 1)),
  license text not null,
  license_url text,
  attribution text,
  fetched_at timestamptz not null default now(),
  confirmed_at timestamptz,
  created_by_profile_id uuid references social_profiles(id) on delete set null,
  verified_by_profile_id uuid references social_profiles(id) on delete set null,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'quarantined', 'rejected')),
  publication_status text not null default 'private' check (publication_status in ('private', 'published', 'superseded', 'rejected')),
  superseded_by_product_id uuid references bc_product_records(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_product_records_source_url_https check (source_url is null or source_url ~ '^https://'),
  constraint bc_product_records_license_url_https check (license_url is null or license_url ~ '^https://'),
  constraint bc_product_records_publish_requires_approval check (
    publication_status <> 'published'
    or (moderation_status = 'approved' and confirmed_at is not null)
  )
);

create index if not exists bc_product_records_name_idx on bc_product_records (lower(canonical_name));
create index if not exists bc_product_records_barcode_idx on bc_product_records (barcode) where barcode is not null;
create index if not exists bc_product_records_source_idx on bc_product_records (source, source_id) where source_id is not null;
create index if not exists bc_product_records_public_idx on bc_product_records (publication_status, moderation_status, updated_at desc);
create unique index if not exists bc_product_records_source_unique on bc_product_records (source, source_id) where source_id is not null;

create table if not exists bc_product_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references bc_product_records(id) on delete cascade,
  alias_type text not null check (alias_type in ('barcode', 'name', 'receipt_line', 'ocr_label', 'source_id')),
  alias_value text not null,
  normalized_value text not null,
  source text not null check (source in ('manual', 'unknown', 'open_food_facts', 'usda_fdc', 'gs1', 'bestchef_cache', 'local_cache', 'receipt_ocr', 'food_recognition', 'user_contribution')),
  source_id text,
  confidence double precision check (confidence is null or (confidence >= 0 and confidence <= 1)),
  license text not null,
  attribution text,
  fetched_at timestamptz not null default now(),
  confirmed_at timestamptz,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'quarantined', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_product_aliases_unique unique (product_id, alias_type, normalized_value)
);

create index if not exists bc_product_aliases_product_idx on bc_product_aliases (product_id);
create index if not exists bc_product_aliases_lookup_idx on bc_product_aliases (alias_type, normalized_value);
create index if not exists bc_product_aliases_status_idx on bc_product_aliases (moderation_status, updated_at desc);

create table if not exists bc_product_nutrition (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references bc_product_records(id) on delete cascade,
  serving_basis text not null default 'per_serving' check (serving_basis in ('per_serving', 'per_100g', 'per_100ml', 'per_package', 'per_item')),
  serving_size_text text,
  serving_quantity double precision,
  serving_unit text,
  nutrition_json jsonb not null default '{}'::jsonb,
  source text not null check (source in ('manual', 'unknown', 'open_food_facts', 'usda_fdc', 'gs1', 'bestchef_cache', 'local_cache', 'receipt_ocr', 'food_recognition', 'user_contribution')),
  source_id text,
  source_url text,
  confidence double precision check (confidence is null or (confidence >= 0 and confidence <= 1)),
  license text not null,
  attribution text,
  fetched_at timestamptz not null default now(),
  confirmed_at timestamptz,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'quarantined', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_product_nutrition_source_url_https check (source_url is null or source_url ~ '^https://')
);

create index if not exists bc_product_nutrition_product_idx on bc_product_nutrition (product_id);
create index if not exists bc_product_nutrition_source_idx on bc_product_nutrition (source, source_id) where source_id is not null;
create index if not exists bc_product_nutrition_status_idx on bc_product_nutrition (moderation_status, updated_at desc);

create or replace function bc_jsonb_contains_private_product_payload_key(p_value jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  entry record;
  private_keys text[] := array[
    'pantry_quantity',
    'pantry_item_id',
    'pantry_batch_id',
    'receipt_import_id',
    'receipt_line_id',
    'receipt_attachment_id',
    'receipt_image_uri',
    'receipt_photo_uri',
    'source_image_uri',
    'source_photo_uri',
    'local_image_uri',
    'photo_uri',
    'image_base64',
    'crop_uri',
    'bounding_box',
    'raw_description',
    'candidate_json',
    'parsed_json',
    'redactions_json',
    'redacted_ocr_text',
    'raw_receipt_ocr_text',
    'raw_ocr_text'
  ];
begin
  if p_value is null then
    return false;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    if p_value ?| private_keys then
      return true;
    end if;

    for entry in select value from jsonb_each(p_value) loop
      if bc_jsonb_contains_private_product_payload_key(entry.value) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for entry in select value from jsonb_array_elements(p_value) loop
      if bc_jsonb_contains_private_product_payload_key(entry.value) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$$;

create table if not exists bc_product_contributions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references social_profiles(id) on delete cascade,
  product_id uuid references bc_product_records(id) on delete set null,
  local_product_id text,
  contribution_type text not null check (contribution_type in ('product_record', 'alias', 'nutrition', 'evidence', 'correction')),
  proposed_product_json jsonb not null default '{}'::jsonb,
  proposed_alias_json jsonb not null default '{}'::jsonb,
  proposed_nutrition_json jsonb not null default '{}'::jsonb,
  status text not null default 'private_draft' check (status in ('private_draft', 'submitted', 'verified', 'rejected', 'superseded')),
  share_opt_in boolean not null default false,
  evidence_opt_in boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'unknown', 'open_food_facts', 'usda_fdc', 'gs1', 'bestchef_cache', 'local_cache', 'receipt_ocr', 'food_recognition', 'user_contribution')),
  source_id text,
  source_url text,
  license text not null,
  attribution text,
  open_food_facts_export_status text not null default 'not_applicable' check (open_food_facts_export_status in ('not_applicable', 'eligible', 'pending', 'sent', 'rejected')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'quarantined', 'rejected')),
  moderation_notes text,
  reviewed_by_profile_id uuid references social_profiles(id) on delete set null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  verified_at timestamptz,
  rejected_at timestamptz,
  superseded_by_contribution_id uuid references bc_product_contributions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_product_contributions_source_url_https check (source_url is null or source_url ~ '^https://'),
  constraint bc_product_contributions_submit_requires_opt_in check (status = 'private_draft' or share_opt_in),
  constraint bc_product_contributions_no_private_payload check (
    not bc_jsonb_contains_private_product_payload_key(proposed_product_json)
    and not bc_jsonb_contains_private_product_payload_key(proposed_alias_json)
    and not bc_jsonb_contains_private_product_payload_key(proposed_nutrition_json)
  )
);

create index if not exists bc_product_contributions_profile_idx on bc_product_contributions (profile_id, created_at desc);
create index if not exists bc_product_contributions_status_idx on bc_product_contributions (status, moderation_status, updated_at desc);
create index if not exists bc_product_contributions_product_idx on bc_product_contributions (product_id, created_at desc);

create table if not exists bc_product_evidence (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references bc_product_records(id) on delete cascade,
  contribution_id uuid references bc_product_contributions(id) on delete cascade,
  media_asset_id uuid references bc_media_assets(id) on delete set null,
  owner_profile_id uuid not null references social_profiles(id) on delete cascade,
  evidence_kind text not null check (evidence_kind in ('package_front', 'nutrition_label', 'barcode', 'source_page', 'receipt_crop', 'other')),
  source_url text,
  image_license text not null,
  image_consent_status text not null default 'not_granted' check (image_consent_status in ('not_granted', 'owned_by_user', 'permission_granted', 'public_domain', 'not_required')),
  share_opt_in boolean not null default false,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'quarantined', 'rejected')),
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  attribution text,
  captured_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_product_evidence_source_url_https check (source_url is null or source_url ~ '^https://'),
  constraint bc_product_evidence_publish_requires_consent check (
    visibility = 'private'
    or (
      share_opt_in
      and moderation_status = 'approved'
      and image_consent_status in ('owned_by_user', 'permission_granted', 'public_domain', 'not_required')
    )
  ),
  constraint bc_product_evidence_receipt_crop_private_by_default check (
    evidence_kind <> 'receipt_crop'
    or visibility = 'private'
    or (share_opt_in and image_consent_status <> 'not_granted')
  )
);

create index if not exists bc_product_evidence_product_idx on bc_product_evidence (product_id, created_at desc);
create index if not exists bc_product_evidence_contribution_idx on bc_product_evidence (contribution_id, created_at desc);
create index if not exists bc_product_evidence_media_idx on bc_product_evidence (media_asset_id);
create index if not exists bc_product_evidence_public_idx on bc_product_evidence (visibility, moderation_status, updated_at desc);

create table if not exists bc_submissions (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references bc_dishes(id) on delete cascade,
  recipe_snapshot_id uuid not null references bc_recipe_snapshots(id) on delete cascade,
  profile_id uuid not null references social_profiles(id) on delete cascade,
  photo_url text,
  primary_media_asset_id uuid references bc_media_assets(id) on delete set null,
  photo_verified boolean not null default false,
  photo_verified_at timestamptz,
  verification_method text check (verification_method is null or verification_method in ('exif', 'ai_detection', 'community', 'manual')),
  chef_location text,
  chef_location_lat double precision,
  chef_location_lng double precision,
  chef_origin text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  vote_score double precision not null default 0,
  rank integer,
  moderation_status text not null default 'approved' check (moderation_status in ('approved', 'pending', 'hidden', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bc_submissions_dish_score_idx on bc_submissions (dish_id, vote_score desc, created_at desc);
create index if not exists bc_submissions_profile_idx on bc_submissions (profile_id, created_at desc);
create index if not exists bc_submissions_snapshot_idx on bc_submissions (recipe_snapshot_id);

create table if not exists bc_votes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references bc_submissions(id) on delete cascade,
  voter_profile_id uuid not null references social_profiles(id) on delete cascade,
  tier integer not null check (tier between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_votes_unique unique (submission_id, voter_profile_id)
);

create index if not exists bc_votes_submission_idx on bc_votes (submission_id, created_at desc);
create index if not exists bc_votes_voter_idx on bc_votes (voter_profile_id, updated_at desc);

create table if not exists bc_rankings (
  dish_id uuid not null references bc_dishes(id) on delete cascade,
  submission_id uuid not null references bc_submissions(id) on delete cascade,
  score double precision not null default 0,
  rank integer not null,
  region text,
  country_code text,
  updated_at timestamptz not null default now(),
  constraint bc_rankings_unique unique nulls not distinct (dish_id, submission_id, region)
);

create index if not exists bc_rankings_dish_rank_idx on bc_rankings (dish_id, region, rank);
create index if not exists bc_rankings_submission_idx on bc_rankings (submission_id);

create table if not exists bc_comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references bc_submissions(id) on delete cascade,
  profile_id uuid not null references social_profiles(id) on delete cascade,
  social_activity_id uuid references social_activities(id) on delete set null,
  body text not null,
  comment_type text not null default 'comment' check (comment_type in ('comment', 'tried_this', 'chefs_tip')),
  photo_url text,
  is_pinned boolean not null default false,
  helpful_count integer not null default 0,
  moderation_status text not null default 'approved' check (moderation_status in ('approved', 'pending', 'hidden', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_comments_body_length check (char_length(body) between 1 and 2000)
);

create index if not exists bc_comments_submission_idx on bc_comments (submission_id, created_at desc);
create index if not exists bc_comments_profile_idx on bc_comments (profile_id, created_at desc);

create table if not exists bc_comment_helpful (
  comment_id uuid not null references bc_comments(id) on delete cascade,
  voter_profile_id uuid not null references social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, voter_profile_id)
);

create index if not exists bc_comment_helpful_voter_idx on bc_comment_helpful (voter_profile_id, created_at desc);

create table if not exists bc_photo_reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references bc_submissions(id) on delete cascade,
  reporter_id uuid not null references social_profiles(id) on delete cascade,
  reason text not null check (reason in ('ai_generated', 'stolen', 'inappropriate', 'wrong_dish', 'other')),
  status text not null default 'open' check (status in ('open', 'noted', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint bc_photo_reports_unique unique (submission_id, reporter_id, reason)
);

create index if not exists bc_photo_reports_submission_idx on bc_photo_reports (submission_id, created_at desc);
create index if not exists bc_photo_reports_status_idx on bc_photo_reports (status, created_at desc);

create table if not exists bc_flags (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('submission', 'comment', 'dish_proposal', 'photo')),
  target_id uuid not null,
  flagger_id uuid not null references social_profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'noted', 'actioned', 'dismissed')),
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bc_flags_target_idx on bc_flags (target_type, target_id, created_at desc);
create index if not exists bc_flags_status_idx on bc_flags (status, created_at desc);
create index if not exists bc_flags_flagger_idx on bc_flags (flagger_id, created_at desc);

create table if not exists bc_notes (
  id uuid primary key default gen_random_uuid(),
  flag_id uuid not null references bc_flags(id) on delete cascade,
  author_id uuid not null references social_profiles(id) on delete cascade,
  body text not null,
  helpful_count integer not null default 0,
  unhelpful_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'shown', 'hidden')),
  created_at timestamptz not null default now(),
  constraint bc_notes_body_length check (char_length(body) between 1 and 1000)
);

create index if not exists bc_notes_flag_idx on bc_notes (flag_id, created_at);
create index if not exists bc_notes_author_idx on bc_notes (author_id, created_at desc);
create index if not exists bc_notes_status_idx on bc_notes (status, created_at desc);

create table if not exists bc_note_ratings (
  note_id uuid not null references bc_notes(id) on delete cascade,
  rater_id uuid not null references social_profiles(id) on delete cascade,
  rating text not null check (rating in ('helpful', 'unhelpful')),
  created_at timestamptz not null default now(),
  primary key (note_id, rater_id)
);

create index if not exists bc_note_ratings_rater_idx on bc_note_ratings (rater_id, created_at desc);

create table if not exists bc_badge_definitions (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null,
  criteria_json jsonb not null default '{}'::jsonb,
  tier text not null check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  created_at timestamptz not null default now()
);

create table if not exists bc_chef_badges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references social_profiles(id) on delete cascade,
  badge_id text not null references bc_badge_definitions(id) on delete cascade,
  earned_at timestamptz not null default now(),
  constraint bc_chef_badges_unique unique (profile_id, badge_id)
);

create index if not exists bc_chef_badges_profile_idx on bc_chef_badges (profile_id, earned_at desc);

create table if not exists bc_creator_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references social_profiles(id) on delete cascade,
  platform_links jsonb not null default '{}'::jsonb,
  bio text not null,
  specialties text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz not null default now()
);

create index if not exists bc_creator_applications_profile_idx on bc_creator_applications (profile_id, created_at desc);
create index if not exists bc_creator_applications_status_idx on bc_creator_applications (status, created_at desc);

create table if not exists bc_tips (
  id uuid primary key default gen_random_uuid(),
  tipper_id uuid not null references social_profiles(id) on delete cascade,
  chef_id uuid not null references social_profiles(id) on delete cascade,
  submission_id uuid references bc_submissions(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  payment_intent_id text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  created_at timestamptz not null default now()
);

create index if not exists bc_tips_chef_idx on bc_tips (chef_id, created_at desc);
create index if not exists bc_tips_tipper_idx on bc_tips (tipper_id, created_at desc);
create unique index if not exists bc_tips_payment_intent_unique on bc_tips (payment_intent_id);

create table if not exists bc_subscription_tiers (
  id uuid primary key default gen_random_uuid(),
  chef_id uuid not null references social_profiles(id) on delete cascade,
  name text not null,
  description text not null,
  price_cents integer not null check (price_cents >= 0),
  benefits jsonb not null default '[]'::jsonb,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists bc_subscription_tiers_chef_idx on bc_subscription_tiers (chef_id, sort_order);

create table if not exists bc_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references social_profiles(id) on delete cascade,
  chef_id uuid not null references social_profiles(id) on delete cascade,
  tier_id uuid references bc_subscription_tiers(id) on delete set null,
  tier_name text not null,
  price_cents integer not null check (price_cents >= 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  status text not null default 'active' check (status in ('active', 'cancelled', 'past_due', 'expired')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  stripe_subscription_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_subscriptions_period_check check (current_period_end > current_period_start)
);

create index if not exists bc_subscriptions_subscriber_idx on bc_subscriptions (subscriber_id, status, created_at desc);
create index if not exists bc_subscriptions_chef_idx on bc_subscriptions (chef_id, status, created_at desc);
create index if not exists bc_subscriptions_tier_idx on bc_subscriptions (tier_id, status);
create unique index if not exists bc_subscriptions_stripe_unique on bc_subscriptions (stripe_subscription_id);

create table if not exists bc_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references social_profiles(id) on delete cascade,
  title text not null,
  body text not null,
  post_type text not null check (post_type in ('blog', 'exclusive_recipe', 'announcement')),
  visibility text not null default 'public' check (visibility in ('public', 'subscribers', 'tier_specific')),
  required_tier_id uuid references bc_subscription_tiers(id) on delete set null,
  cover_image_url text,
  linked_submission_id uuid references bc_submissions(id) on delete set null,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bc_posts_author_idx on bc_posts (author_id, created_at desc);
create index if not exists bc_posts_visibility_idx on bc_posts (visibility, created_at desc);

create table if not exists bc_recipe_forks (
  id uuid primary key default gen_random_uuid(),
  source_snapshot_id uuid not null references bc_recipe_snapshots(id) on delete cascade,
  forked_by_profile_id uuid not null references social_profiles(id) on delete cascade,
  forked_snapshot_id uuid not null references bc_recipe_snapshots(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint bc_recipe_forks_unique unique (source_snapshot_id, forked_snapshot_id)
);

create index if not exists bc_recipe_forks_source_idx on bc_recipe_forks (source_snapshot_id, created_at desc);
create index if not exists bc_recipe_forks_profile_idx on bc_recipe_forks (forked_by_profile_id, created_at desc);

create table if not exists bc_affiliate_orders (
  order_id text primary key,
  provider text not null check (provider in ('instacart', 'amazon_fresh', 'walmart')),
  chef_id uuid references social_profiles(id) on delete set null,
  recipe_id text,
  tracking_id text not null,
  estimated_revenue_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists bc_affiliate_orders_chef_idx on bc_affiliate_orders (chef_id, created_at desc);
create unique index if not exists bc_affiliate_orders_tracking_unique on bc_affiliate_orders (tracking_id);

create table if not exists bc_brand_mappings (
  id uuid primary key default gen_random_uuid(),
  barcode text,
  brand_name text not null,
  generic_name text,
  category text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists bc_brand_mappings_brand_idx on bc_brand_mappings (lower(brand_name));
create index if not exists bc_brand_mappings_barcode_idx on bc_brand_mappings (barcode) where barcode is not null;

create table if not exists bc_hubs (
  id uuid primary key default gen_random_uuid(),
  hub_slug text not null,
  display_name text not null,
  owner_profile_id uuid references social_profiles(id) on delete set null,
  public_signing_key text,
  schema_version integer not null default 1,
  media_base_url text,
  moderation_policy_url text,
  last_official_content_version bigint not null default 0,
  feature_flags jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'paused', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_hubs_slug_unique unique (hub_slug),
  constraint bc_hubs_slug_format check (hub_slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  constraint bc_hubs_display_name_length check (char_length(display_name) between 1 and 80),
  constraint bc_hubs_media_base_url_https check (media_base_url is null or media_base_url ~ '^https://'),
  constraint bc_hubs_moderation_policy_url_https check (moderation_policy_url is null or moderation_policy_url ~ '^https://')
);

create table if not exists bc_content_events (
  version bigserial primary key,
  table_name text not null,
  record_id text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bc_content_events_table_idx on bc_content_events (table_name, version);

create table if not exists bc_leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid references bc_dishes(id) on delete cascade,
  scope text not null default 'global',
  scope_id text,
  ranking_json jsonb not null,
  content_version bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists bc_leaderboard_snapshots_scope_idx on bc_leaderboard_snapshots (dish_id, scope, created_at desc);

alter table bc_dishes enable row level security;
alter table bc_dish_aliases enable row level security;
alter table bc_recipe_snapshots enable row level security;
alter table bc_media_assets enable row level security;
alter table bc_media_variants enable row level security;
alter table bc_product_records enable row level security;
alter table bc_product_aliases enable row level security;
alter table bc_product_nutrition enable row level security;
alter table bc_product_contributions enable row level security;
alter table bc_product_evidence enable row level security;
alter table bc_submissions enable row level security;
alter table bc_votes enable row level security;
alter table bc_rankings enable row level security;
alter table bc_comments enable row level security;
alter table bc_comment_helpful enable row level security;
alter table bc_photo_reports enable row level security;
alter table bc_flags enable row level security;
alter table bc_notes enable row level security;
alter table bc_note_ratings enable row level security;
alter table bc_badge_definitions enable row level security;
alter table bc_chef_badges enable row level security;
alter table bc_creator_applications enable row level security;
alter table bc_tips enable row level security;
alter table bc_subscription_tiers enable row level security;
alter table bc_subscriptions enable row level security;
alter table bc_posts enable row level security;
alter table bc_recipe_forks enable row level security;
alter table bc_affiliate_orders enable row level security;
alter table bc_brand_mappings enable row level security;
alter table bc_hubs enable row level security;
alter table bc_content_events enable row level security;
alter table bc_leaderboard_snapshots enable row level security;

create or replace function bc_submission_visible(submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from bc_submissions s
    where s.id = submission_id
      and (
        s.moderation_status = 'approved'
        or bc_profile_owned(s.profile_id)
      )
  );
$$;

create or replace function bc_post_visible(post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from bc_posts p
    where p.id = post_id
      and (
        p.visibility = 'public'
        or bc_profile_owned(p.author_id)
        or (
          p.visibility in ('subscribers', 'tier_specific')
          and exists (
            select 1
            from bc_subscriptions s
            where s.chef_id = p.author_id
              and s.status = 'active'
              and bc_profile_owned(s.subscriber_id)
              and (p.visibility = 'subscribers' or s.tier_id = p.required_tier_id)
          )
        )
      )
  );
$$;

create or replace function bc_product_record_visible(product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from bc_product_records p
    where p.id = product_id
      and (
        (p.publication_status = 'published' and p.moderation_status = 'approved')
        or bc_profile_owned(p.created_by_profile_id)
        or bc_is_admin()
      )
  );
$$;

create or replace function bc_product_evidence_visible(evidence_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from bc_product_evidence e
    where e.id = evidence_id
      and (
        (
          e.share_opt_in
          and e.moderation_status = 'approved'
          and e.visibility in ('public', 'unlisted')
          and e.image_consent_status in ('owned_by_user', 'permission_granted', 'public_domain', 'not_required')
          and (
            e.product_id is null
            or exists (
              select 1
              from bc_product_records p
              where p.id = e.product_id
                and p.publication_status = 'published'
                and p.moderation_status = 'approved'
            )
          )
          and (
            e.media_asset_id is null
            or exists (
              select 1
              from bc_media_assets a
              where a.id = e.media_asset_id
                and a.moderation_status = 'approved'
                and a.upload_status = 'ready'
                and a.visibility in ('public', 'unlisted')
            )
          )
        )
        or bc_profile_owned(e.owner_profile_id)
        or bc_is_admin()
      )
  );
$$;

drop policy if exists "bc_dishes_read" on bc_dishes;
create policy "bc_dishes_read" on bc_dishes for select using (status = 'active' or bc_is_admin() or bc_profile_owned(proposed_by));
drop policy if exists "bc_dishes_admin_write" on bc_dishes;
create policy "bc_dishes_admin_write" on bc_dishes for all using (bc_is_admin()) with check (bc_is_admin());
drop policy if exists "bc_dishes_propose" on bc_dishes;
create policy "bc_dishes_propose" on bc_dishes for insert with check (bc_profile_owned(proposed_by) and status = 'pending');

drop policy if exists "bc_dish_aliases_read" on bc_dish_aliases;
create policy "bc_dish_aliases_read" on bc_dish_aliases for select using (true);
drop policy if exists "bc_dish_aliases_admin_write" on bc_dish_aliases;
create policy "bc_dish_aliases_admin_write" on bc_dish_aliases for all using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_recipe_snapshots_read" on bc_recipe_snapshots;
create policy "bc_recipe_snapshots_read" on bc_recipe_snapshots for select using (
  bc_profile_owned(profile_id)
  or exists (select 1 from bc_submissions s where s.recipe_snapshot_id = id and s.moderation_status = 'approved')
);
drop policy if exists "bc_recipe_snapshots_insert" on bc_recipe_snapshots;
create policy "bc_recipe_snapshots_insert" on bc_recipe_snapshots for insert with check (bc_profile_owned(profile_id));
drop policy if exists "bc_recipe_snapshots_delete" on bc_recipe_snapshots;
create policy "bc_recipe_snapshots_delete" on bc_recipe_snapshots for delete using (bc_profile_owned(profile_id));

drop policy if exists "bc_media_assets_read" on bc_media_assets;
create policy "bc_media_assets_read" on bc_media_assets for select using (
  (
    moderation_status = 'approved'
    and visibility in ('public', 'unlisted')
    and upload_status = 'ready'
  )
  or bc_profile_owned(owner_profile_id)
);
drop policy if exists "bc_media_assets_insert" on bc_media_assets;
create policy "bc_media_assets_insert" on bc_media_assets for insert with check (bc_profile_owned(owner_profile_id));
drop policy if exists "bc_media_assets_update" on bc_media_assets;
create policy "bc_media_assets_update" on bc_media_assets for update using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_media_variants_read" on bc_media_variants;
create policy "bc_media_variants_read" on bc_media_variants for select using (
  exists (select 1 from bc_media_assets a where a.id = asset_id)
);
drop policy if exists "bc_media_variants_admin_write" on bc_media_variants;
create policy "bc_media_variants_admin_write" on bc_media_variants for all using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_product_records_read" on bc_product_records;
create policy "bc_product_records_read" on bc_product_records for select using (bc_product_record_visible(id));
drop policy if exists "bc_product_records_insert" on bc_product_records;
create policy "bc_product_records_insert" on bc_product_records for insert with check (bc_profile_owned(created_by_profile_id));
drop policy if exists "bc_product_records_update" on bc_product_records;
create policy "bc_product_records_update" on bc_product_records for update using (
  bc_is_admin() or (bc_profile_owned(created_by_profile_id) and publication_status = 'private')
) with check (
  bc_is_admin() or (bc_profile_owned(created_by_profile_id) and publication_status = 'private')
);
drop policy if exists "bc_product_records_delete" on bc_product_records;
create policy "bc_product_records_delete" on bc_product_records for delete using (bc_is_admin());

drop policy if exists "bc_product_aliases_read" on bc_product_aliases;
create policy "bc_product_aliases_read" on bc_product_aliases for select using (
  bc_is_admin()
  or (
    moderation_status = 'approved'
    and exists (
      select 1
      from bc_product_records p
      where p.id = product_id
        and p.publication_status = 'published'
        and p.moderation_status = 'approved'
    )
  )
  or exists (
    select 1
    from bc_product_records p
    where p.id = product_id and bc_profile_owned(p.created_by_profile_id)
  )
);
drop policy if exists "bc_product_aliases_admin_write" on bc_product_aliases;
create policy "bc_product_aliases_admin_write" on bc_product_aliases for all using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_product_nutrition_read" on bc_product_nutrition;
create policy "bc_product_nutrition_read" on bc_product_nutrition for select using (
  bc_is_admin()
  or (
    moderation_status = 'approved'
    and exists (
      select 1
      from bc_product_records p
      where p.id = product_id
        and p.publication_status = 'published'
        and p.moderation_status = 'approved'
    )
  )
  or exists (
    select 1
    from bc_product_records p
    where p.id = product_id and bc_profile_owned(p.created_by_profile_id)
  )
);
drop policy if exists "bc_product_nutrition_admin_write" on bc_product_nutrition;
create policy "bc_product_nutrition_admin_write" on bc_product_nutrition for all using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_product_contributions_read" on bc_product_contributions;
create policy "bc_product_contributions_read" on bc_product_contributions for select using (
  bc_profile_owned(profile_id) or bc_is_admin()
);
drop policy if exists "bc_product_contributions_insert" on bc_product_contributions;
create policy "bc_product_contributions_insert" on bc_product_contributions for insert with check (
  bc_profile_owned(profile_id)
  and status in ('private_draft', 'submitted')
  and (status = 'private_draft' or share_opt_in)
);
drop policy if exists "bc_product_contributions_update" on bc_product_contributions;
create policy "bc_product_contributions_update" on bc_product_contributions for update using (
  bc_is_admin()
  or (bc_profile_owned(profile_id) and status in ('private_draft', 'submitted'))
) with check (
  bc_is_admin()
  or (
    bc_profile_owned(profile_id)
    and status in ('private_draft', 'submitted')
    and (status = 'private_draft' or share_opt_in)
  )
);
drop policy if exists "bc_product_contributions_delete" on bc_product_contributions;
create policy "bc_product_contributions_delete" on bc_product_contributions for delete using (
  bc_is_admin() or (bc_profile_owned(profile_id) and status = 'private_draft')
);

drop policy if exists "bc_product_evidence_read" on bc_product_evidence;
create policy "bc_product_evidence_read" on bc_product_evidence for select using (bc_product_evidence_visible(id));
drop policy if exists "bc_product_evidence_insert" on bc_product_evidence;
create policy "bc_product_evidence_insert" on bc_product_evidence for insert with check (
  bc_profile_owned(owner_profile_id)
  and visibility = 'private'
);
drop policy if exists "bc_product_evidence_update" on bc_product_evidence;
create policy "bc_product_evidence_update" on bc_product_evidence for update using (
  bc_is_admin()
  or (bc_profile_owned(owner_profile_id) and visibility = 'private')
) with check (
  bc_is_admin()
  or (bc_profile_owned(owner_profile_id) and visibility = 'private')
);
drop policy if exists "bc_product_evidence_delete" on bc_product_evidence;
create policy "bc_product_evidence_delete" on bc_product_evidence for delete using (
  bc_is_admin() or (bc_profile_owned(owner_profile_id) and visibility = 'private')
);

drop policy if exists "bc_submissions_read" on bc_submissions;
create policy "bc_submissions_read" on bc_submissions for select using (moderation_status = 'approved' or bc_profile_owned(profile_id));
drop policy if exists "bc_submissions_insert" on bc_submissions;
create policy "bc_submissions_insert" on bc_submissions for insert with check (bc_profile_owned(profile_id));
drop policy if exists "bc_submissions_update" on bc_submissions;
create policy "bc_submissions_update" on bc_submissions for update using (bc_profile_owned(profile_id) or bc_is_admin()) with check (bc_profile_owned(profile_id) or bc_is_admin());
drop policy if exists "bc_submissions_delete" on bc_submissions;
create policy "bc_submissions_delete" on bc_submissions for delete using (bc_profile_owned(profile_id) or bc_is_admin());

drop policy if exists "bc_votes_read" on bc_votes;
create policy "bc_votes_read" on bc_votes for select using (bc_submission_visible(submission_id) or bc_profile_owned(voter_profile_id));
drop policy if exists "bc_votes_insert" on bc_votes;
create policy "bc_votes_insert" on bc_votes for insert with check (
  bc_profile_owned(voter_profile_id)
  and bc_submission_visible(submission_id)
  and not exists (
    select 1 from bc_submissions s
    where s.id = submission_id
      and s.profile_id = voter_profile_id
  )
);
drop policy if exists "bc_votes_update" on bc_votes;
create policy "bc_votes_update" on bc_votes for update using (bc_profile_owned(voter_profile_id)) with check (
  bc_profile_owned(voter_profile_id)
  and bc_submission_visible(submission_id)
  and not exists (
    select 1 from bc_submissions s
    where s.id = submission_id
      and s.profile_id = voter_profile_id
  )
);
drop policy if exists "bc_votes_delete" on bc_votes;
create policy "bc_votes_delete" on bc_votes for delete using (bc_profile_owned(voter_profile_id) or bc_is_admin());

drop policy if exists "bc_rankings_read" on bc_rankings;
create policy "bc_rankings_read" on bc_rankings for select using (true);
drop policy if exists "bc_rankings_admin_write" on bc_rankings;
create policy "bc_rankings_admin_write" on bc_rankings for all using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_comments_read" on bc_comments;
create policy "bc_comments_read" on bc_comments for select using ((moderation_status = 'approved' and bc_submission_visible(submission_id)) or bc_profile_owned(profile_id));
drop policy if exists "bc_comments_insert" on bc_comments;
create policy "bc_comments_insert" on bc_comments for insert with check (bc_profile_owned(profile_id));
drop policy if exists "bc_comments_update" on bc_comments;
create policy "bc_comments_update" on bc_comments for update using (bc_profile_owned(profile_id) or bc_is_admin()) with check (bc_profile_owned(profile_id) or bc_is_admin());
drop policy if exists "bc_comments_delete" on bc_comments;
create policy "bc_comments_delete" on bc_comments for delete using (bc_profile_owned(profile_id) or bc_is_admin());

drop policy if exists "bc_comment_helpful_read" on bc_comment_helpful;
create policy "bc_comment_helpful_read" on bc_comment_helpful for select using (exists (select 1 from bc_comments c where c.id = comment_id));
drop policy if exists "bc_comment_helpful_all" on bc_comment_helpful;
create policy "bc_comment_helpful_all" on bc_comment_helpful for all using (bc_profile_owned(voter_profile_id)) with check (
  bc_profile_owned(voter_profile_id)
  and exists (
    select 1 from bc_comments c
    where c.id = comment_id
      and c.moderation_status = 'approved'
      and c.profile_id <> voter_profile_id
      and bc_submission_visible(c.submission_id)
  )
);

drop policy if exists "bc_photo_reports_read" on bc_photo_reports;
create policy "bc_photo_reports_read" on bc_photo_reports for select using (bc_profile_owned(reporter_id) or bc_is_admin());
drop policy if exists "bc_photo_reports_insert" on bc_photo_reports;
create policy "bc_photo_reports_insert" on bc_photo_reports for insert with check (bc_profile_owned(reporter_id));
drop policy if exists "bc_photo_reports_admin_update" on bc_photo_reports;
create policy "bc_photo_reports_admin_update" on bc_photo_reports for update using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_flags_read" on bc_flags;
create policy "bc_flags_read" on bc_flags for select using (bc_profile_owned(flagger_id) or bc_is_admin());
drop policy if exists "bc_flags_insert" on bc_flags;
create policy "bc_flags_insert" on bc_flags for insert with check (bc_profile_owned(flagger_id));
drop policy if exists "bc_flags_admin_update" on bc_flags;
create policy "bc_flags_admin_update" on bc_flags for update using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_notes_read" on bc_notes;
create policy "bc_notes_read" on bc_notes for select using (status = 'shown' or bc_profile_owned(author_id) or bc_is_admin());
drop policy if exists "bc_notes_insert" on bc_notes;
create policy "bc_notes_insert" on bc_notes for insert with check (bc_profile_owned(author_id));
drop policy if exists "bc_notes_update" on bc_notes;
create policy "bc_notes_update" on bc_notes for update using (bc_profile_owned(author_id) or bc_is_admin()) with check (bc_profile_owned(author_id) or bc_is_admin());

drop policy if exists "bc_note_ratings_read" on bc_note_ratings;
create policy "bc_note_ratings_read" on bc_note_ratings for select using (bc_profile_owned(rater_id) or bc_is_admin());
drop policy if exists "bc_note_ratings_all" on bc_note_ratings;
create policy "bc_note_ratings_all" on bc_note_ratings for all using (bc_profile_owned(rater_id)) with check (
  bc_profile_owned(rater_id)
  and exists (
    select 1 from bc_notes n
    where n.id = note_id
      and n.status in ('pending', 'shown')
      and n.author_id <> rater_id
  )
);

drop policy if exists "bc_badge_definitions_read" on bc_badge_definitions;
create policy "bc_badge_definitions_read" on bc_badge_definitions for select using (true);
drop policy if exists "bc_badge_definitions_admin_write" on bc_badge_definitions;
create policy "bc_badge_definitions_admin_write" on bc_badge_definitions for all using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_chef_badges_read" on bc_chef_badges;
create policy "bc_chef_badges_read" on bc_chef_badges for select using (true);
drop policy if exists "bc_chef_badges_admin_write" on bc_chef_badges;
create policy "bc_chef_badges_admin_write" on bc_chef_badges for all using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_creator_applications_read" on bc_creator_applications;
create policy "bc_creator_applications_read" on bc_creator_applications for select using (bc_profile_owned(profile_id) or status = 'approved' or bc_is_admin());
drop policy if exists "bc_creator_applications_insert" on bc_creator_applications;
create policy "bc_creator_applications_insert" on bc_creator_applications for insert with check (bc_profile_owned(profile_id));
drop policy if exists "bc_creator_applications_admin_update" on bc_creator_applications;
create policy "bc_creator_applications_admin_update" on bc_creator_applications for update using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_tips_read" on bc_tips;
create policy "bc_tips_read" on bc_tips for select using (bc_profile_owned(tipper_id) or bc_profile_owned(chef_id) or bc_is_admin());
drop policy if exists "bc_tips_insert" on bc_tips;
create policy "bc_tips_insert" on bc_tips for insert with check (bc_is_admin());
drop policy if exists "bc_tips_admin_update" on bc_tips;
create policy "bc_tips_admin_update" on bc_tips for update using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_subscription_tiers_read" on bc_subscription_tiers;
create policy "bc_subscription_tiers_read" on bc_subscription_tiers for select using (true);
drop policy if exists "bc_subscription_tiers_all" on bc_subscription_tiers;
create policy "bc_subscription_tiers_all" on bc_subscription_tiers for all using (bc_profile_owned(chef_id)) with check (bc_profile_owned(chef_id));

drop policy if exists "bc_subscriptions_read" on bc_subscriptions;
create policy "bc_subscriptions_read" on bc_subscriptions for select using (bc_profile_owned(subscriber_id) or bc_profile_owned(chef_id) or bc_is_admin());
drop policy if exists "bc_subscriptions_insert" on bc_subscriptions;
create policy "bc_subscriptions_insert" on bc_subscriptions for insert with check (bc_is_admin());
drop policy if exists "bc_subscriptions_update" on bc_subscriptions;
create policy "bc_subscriptions_update" on bc_subscriptions for update using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_posts_read" on bc_posts;
create policy "bc_posts_read" on bc_posts for select using (bc_post_visible(id));
drop policy if exists "bc_posts_all" on bc_posts;
create policy "bc_posts_all" on bc_posts for all using (bc_profile_owned(author_id)) with check (bc_profile_owned(author_id));

drop policy if exists "bc_recipe_forks_read" on bc_recipe_forks;
create policy "bc_recipe_forks_read" on bc_recipe_forks for select using (true);
drop policy if exists "bc_recipe_forks_insert" on bc_recipe_forks;
create policy "bc_recipe_forks_insert" on bc_recipe_forks for insert with check (bc_profile_owned(forked_by_profile_id));

drop policy if exists "bc_affiliate_orders_read" on bc_affiliate_orders;
create policy "bc_affiliate_orders_read" on bc_affiliate_orders for select using (bc_profile_owned(chef_id) or bc_is_admin());
drop policy if exists "bc_affiliate_orders_insert" on bc_affiliate_orders;
create policy "bc_affiliate_orders_insert" on bc_affiliate_orders for insert with check (bc_is_admin());

drop policy if exists "bc_brand_mappings_read" on bc_brand_mappings;
create policy "bc_brand_mappings_read" on bc_brand_mappings for select using (verified or bc_is_admin());
drop policy if exists "bc_brand_mappings_insert" on bc_brand_mappings;
create policy "bc_brand_mappings_insert" on bc_brand_mappings for insert with check (auth.uid() is not null);
drop policy if exists "bc_brand_mappings_admin_update" on bc_brand_mappings;
create policy "bc_brand_mappings_admin_update" on bc_brand_mappings for update using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_hubs_read" on bc_hubs;
create policy "bc_hubs_read" on bc_hubs for select using (status = 'active' or bc_profile_owned(owner_profile_id) or bc_is_admin());
drop policy if exists "bc_hubs_all" on bc_hubs;
create policy "bc_hubs_all" on bc_hubs for all using (bc_profile_owned(owner_profile_id) or bc_is_admin()) with check (bc_profile_owned(owner_profile_id) or bc_is_admin());

drop policy if exists "bc_content_events_read" on bc_content_events;
create policy "bc_content_events_read" on bc_content_events for select using (true);
drop policy if exists "bc_content_events_admin_write" on bc_content_events;
create policy "bc_content_events_admin_write" on bc_content_events for all using (bc_is_admin()) with check (bc_is_admin());

drop policy if exists "bc_leaderboard_snapshots_read" on bc_leaderboard_snapshots;
create policy "bc_leaderboard_snapshots_read" on bc_leaderboard_snapshots for select using (true);
drop policy if exists "bc_leaderboard_snapshots_admin_write" on bc_leaderboard_snapshots;
create policy "bc_leaderboard_snapshots_admin_write" on bc_leaderboard_snapshots for all using (bc_is_admin()) with check (bc_is_admin());

create or replace function bc_public_content_event_payload(p_table_name text, p_row jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_table_name = 'bc_dishes' then
    if p_row->>'status' <> 'active' then
      return null;
    end if;
    return p_row - array['proposed_by', 'merged_into_dish_id'];
  end if;

  if p_table_name = 'bc_dish_aliases' then
    return p_row;
  end if;

  if p_table_name = 'bc_recipe_snapshots' then
    if not exists (
      select 1
      from bc_submissions s
      where s.recipe_snapshot_id = (p_row->>'id')::uuid
        and s.moderation_status = 'approved'
    ) then
      return null;
    end if;
    return p_row - array['original_local_recipe_id'];
  end if;

  if p_table_name = 'bc_media_assets' then
    if p_row->>'moderation_status' <> 'approved'
      or p_row->>'upload_status' <> 'ready'
      or p_row->>'visibility' not in ('public', 'unlisted') then
      return null;
    end if;

    return jsonb_build_object(
      'id', p_row->'id',
      'owner_kind', p_row->'owner_kind',
      'owner_id', p_row->'owner_id',
      'media_kind', p_row->'media_kind',
      'remote_url', p_row->'remote_url',
      'content_hash', p_row->'content_hash',
      'byte_size', p_row->'byte_size',
      'width', p_row->'width',
      'height', p_row->'height',
      'duration_ms', p_row->'duration_ms',
      'visibility', p_row->'visibility',
      'metadata', p_row->'metadata',
      'created_at', p_row->'created_at',
      'updated_at', p_row->'updated_at'
    );
  end if;

  if p_table_name = 'bc_media_variants' then
    if not exists (
      select 1
      from bc_media_assets a
      where a.id = (p_row->>'asset_id')::uuid
        and a.moderation_status = 'approved'
        and a.upload_status = 'ready'
        and a.visibility in ('public', 'unlisted')
    ) then
      return null;
    end if;

    return jsonb_build_object(
      'id', p_row->'id',
      'asset_id', p_row->'asset_id',
      'variant', p_row->'variant',
      'remote_url', p_row->'remote_url',
      'content_hash', p_row->'content_hash',
      'byte_size', p_row->'byte_size',
      'width', p_row->'width',
      'height', p_row->'height',
      'duration_ms', p_row->'duration_ms',
      'created_at', p_row->'created_at'
    );
  end if;

  if p_table_name = 'bc_product_records' then
    if p_row->>'publication_status' <> 'published'
      or p_row->>'moderation_status' <> 'approved' then
      return null;
    end if;

    return jsonb_build_object(
      'id', p_row->'id',
      'canonical_name', p_row->'canonical_name',
      'brand', p_row->'brand',
      'manufacturer', p_row->'manufacturer',
      'product_type', p_row->'product_type',
      'barcode', p_row->'barcode',
      'gtin', p_row->'gtin',
      'category', p_row->'category',
      'grocery_section', p_row->'grocery_section',
      'default_storage_location', p_row->'default_storage_location',
      'nutrition_json', p_row->'nutrition_json',
      'source', p_row->'source',
      'source_id', p_row->'source_id',
      'source_url', p_row->'source_url',
      'confidence', p_row->'confidence',
      'license', p_row->'license',
      'license_url', p_row->'license_url',
      'attribution', p_row->'attribution',
      'fetched_at', p_row->'fetched_at',
      'confirmed_at', p_row->'confirmed_at',
      'updated_at', p_row->'updated_at'
    );
  end if;

  if p_table_name = 'bc_product_aliases' then
    if p_row->>'moderation_status' <> 'approved'
      or not exists (
        select 1
        from bc_product_records p
        where p.id = (p_row->>'product_id')::uuid
          and p.publication_status = 'published'
          and p.moderation_status = 'approved'
      ) then
      return null;
    end if;

    return jsonb_build_object(
      'id', p_row->'id',
      'product_id', p_row->'product_id',
      'alias_type', p_row->'alias_type',
      'alias_value', p_row->'alias_value',
      'normalized_value', p_row->'normalized_value',
      'source', p_row->'source',
      'source_id', p_row->'source_id',
      'confidence', p_row->'confidence',
      'license', p_row->'license',
      'attribution', p_row->'attribution',
      'fetched_at', p_row->'fetched_at',
      'confirmed_at', p_row->'confirmed_at',
      'updated_at', p_row->'updated_at'
    );
  end if;

  if p_table_name = 'bc_product_nutrition' then
    if p_row->>'moderation_status' <> 'approved'
      or not exists (
        select 1
        from bc_product_records p
        where p.id = (p_row->>'product_id')::uuid
          and p.publication_status = 'published'
          and p.moderation_status = 'approved'
      ) then
      return null;
    end if;

    return jsonb_build_object(
      'id', p_row->'id',
      'product_id', p_row->'product_id',
      'serving_basis', p_row->'serving_basis',
      'serving_size_text', p_row->'serving_size_text',
      'serving_quantity', p_row->'serving_quantity',
      'serving_unit', p_row->'serving_unit',
      'nutrition_json', p_row->'nutrition_json',
      'source', p_row->'source',
      'source_id', p_row->'source_id',
      'source_url', p_row->'source_url',
      'confidence', p_row->'confidence',
      'license', p_row->'license',
      'attribution', p_row->'attribution',
      'fetched_at', p_row->'fetched_at',
      'confirmed_at', p_row->'confirmed_at',
      'updated_at', p_row->'updated_at'
    );
  end if;

  if p_table_name = 'bc_product_evidence' then
    if p_row->>'share_opt_in' <> 'true'
      or p_row->>'moderation_status' <> 'approved'
      or p_row->>'visibility' not in ('public', 'unlisted')
      or p_row->>'image_consent_status' not in ('owned_by_user', 'permission_granted', 'public_domain', 'not_required')
      or (
        p_row->>'product_id' is not null
        and not exists (
          select 1
          from bc_product_records p
          where p.id = (p_row->>'product_id')::uuid
            and p.publication_status = 'published'
            and p.moderation_status = 'approved'
        )
      )
      or (
        p_row->>'media_asset_id' is not null
        and not exists (
          select 1
          from bc_media_assets a
          where a.id = (p_row->>'media_asset_id')::uuid
            and a.moderation_status = 'approved'
            and a.upload_status = 'ready'
            and a.visibility in ('public', 'unlisted')
        )
      ) then
      return null;
    end if;

    return jsonb_build_object(
      'id', p_row->'id',
      'product_id', p_row->'product_id',
      'media_asset_id', p_row->'media_asset_id',
      'evidence_kind', p_row->'evidence_kind',
      'source_url', p_row->'source_url',
      'image_license', p_row->'image_license',
      'image_consent_status', p_row->'image_consent_status',
      'visibility', p_row->'visibility',
      'attribution', p_row->'attribution',
      'captured_at', p_row->'captured_at',
      'approved_at', p_row->'approved_at',
      'updated_at', p_row->'updated_at'
    );
  end if;

  if p_table_name = 'bc_submissions' then
    if p_row->>'moderation_status' <> 'approved' then
      return null;
    end if;

    return jsonb_build_object(
      'id', p_row->'id',
      'dish_id', p_row->'dish_id',
      'recipe_snapshot_id', p_row->'recipe_snapshot_id',
      'profile_id', p_row->'profile_id',
      'photo_url', p_row->'photo_url',
      'primary_media_asset_id', p_row->'primary_media_asset_id',
      'photo_verified', p_row->'photo_verified',
      'photo_verified_at', p_row->'photo_verified_at',
      'verification_method', p_row->'verification_method',
      'chef_location', p_row->'chef_location',
      'chef_origin', p_row->'chef_origin',
      'country_code', p_row->'country_code',
      'vote_score', p_row->'vote_score',
      'rank', p_row->'rank',
      'created_at', p_row->'created_at',
      'updated_at', p_row->'updated_at'
    );
  end if;

  if p_table_name = 'bc_badge_definitions' then
    return p_row;
  end if;

  return null;
end;
$$;

create or replace function bc_record_content_event()
returns trigger as $$
declare
  source_payload jsonb;
  event_payload jsonb;
  event_record_id text;
begin
  if tg_op = 'DELETE' then
    source_payload := to_jsonb(old);
  else
    source_payload := to_jsonb(new);
  end if;

  event_payload := bc_public_content_event_payload(tg_table_name, source_payload);
  if event_payload is null then
    return coalesce(new, old);
  end if;

  event_record_id := source_payload->>'id';

  insert into bc_content_events (table_name, record_id, operation, payload)
  values (tg_table_name, event_record_id, tg_op, event_payload);

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_record_ranking_event()
returns trigger as $$
declare
  event_payload jsonb;
  event_record_id text;
begin
  if tg_op = 'DELETE' then
    event_payload := to_jsonb(old);
    event_record_id := old.dish_id::text || ':' || old.submission_id::text || ':' || coalesce(old.region, 'global');
  else
    event_payload := to_jsonb(new);
    event_record_id := new.dish_id::text || ':' || new.submission_id::text || ':' || coalesce(new.region, 'global');
  end if;

  insert into bc_content_events (table_name, record_id, operation, payload)
  values (tg_table_name, event_record_id, tg_op, event_payload);

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_refresh_dish_submission_count()
returns trigger as $$
declare
  target_dish_id uuid;
begin
  if tg_op = 'UPDATE' and old.dish_id is distinct from new.dish_id then
    update bc_dishes
    set submission_count = (
      select count(*) from bc_submissions
      where dish_id = old.dish_id
        and moderation_status = 'approved'
    )
    where id = old.dish_id;
  end if;

  if tg_op = 'DELETE' then
    target_dish_id := old.dish_id;
  else
    target_dish_id := new.dish_id;
  end if;

  update bc_dishes
  set submission_count = (
    select count(*) from bc_submissions
    where dish_id = target_dish_id
      and moderation_status = 'approved'
  )
  where id = target_dish_id;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_refresh_alias_count()
returns trigger as $$
declare
  target_dish_id uuid;
begin
  if tg_op = 'DELETE' then
    target_dish_id := old.dish_id;
  else
    target_dish_id := new.dish_id;
  end if;

  update bc_dishes
  set alias_count = (
    select count(*) from bc_dish_aliases
    where dish_id = target_dish_id
  )
  where id = target_dish_id;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_weighted_wilson_score(p_submission_id uuid)
returns double precision
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n double precision;
  weighted_sum double precision;
  p_hat double precision;
  z double precision := 1.96;
  z_squared double precision := 3.8416;
  denominator double precision;
  center double precision;
  spread double precision;
begin
  select count(*)::double precision,
    coalesce(sum(case tier when 0 then 0 when 1 then 1 when 2 then 3 when 3 then 5 else 0 end), 0)::double precision
  into n, weighted_sum
  from bc_votes
  where submission_id = p_submission_id;

  if n is null or n = 0 then
    return 0;
  end if;

  p_hat := weighted_sum / (n * 5);
  denominator := 1 + z_squared / n;
  center := p_hat + z_squared / (2 * n);
  spread := z * sqrt((p_hat * (1 - p_hat) + z_squared / (4 * n)) / n);

  return greatest(0, least(1, (center - spread) / denominator));
end;
$$;

create or replace function bc_refresh_submission_score()
returns trigger as $$
declare
  target_submission_id uuid;
begin
  if tg_op = 'UPDATE' and old.submission_id is distinct from new.submission_id then
    update bc_submissions
    set vote_score = bc_weighted_wilson_score(old.submission_id),
        updated_at = now()
    where id = old.submission_id;
  end if;

  if tg_op = 'DELETE' then
    target_submission_id := old.submission_id;
  else
    target_submission_id := new.submission_id;
  end if;

  update bc_submissions
  set vote_score = bc_weighted_wilson_score(target_submission_id),
      updated_at = now()
  where id = target_submission_id;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_refresh_comment_helpful_count()
returns trigger as $$
declare
  target_comment_id uuid;
begin
  if tg_op = 'DELETE' then
    target_comment_id := old.comment_id;
  else
    target_comment_id := new.comment_id;
  end if;

  update bc_comments
  set helpful_count = (
    select count(*) from bc_comment_helpful
    where comment_id = target_comment_id
  ),
  updated_at = now()
  where id = target_comment_id;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_recompute_note_consensus(target_note_id uuid)
returns void as $$
declare
  helpful_total integer;
  unhelpful_total integer;
  rating_total integer;
  unique_rater_total integer;
begin
  select
    count(*) filter (where rating = 'helpful')::integer,
    count(*) filter (where rating = 'unhelpful')::integer,
    count(*)::integer,
    count(distinct rater_id)::integer
  into helpful_total, unhelpful_total, rating_total, unique_rater_total
  from bc_note_ratings
  where note_id = target_note_id;

  update bc_notes
  set helpful_count = helpful_total,
      unhelpful_count = unhelpful_total,
      status = case
        when status = 'pending'
          and rating_total >= 5
          and unique_rater_total >= 3
          and rating_total > 0
          and (helpful_total::numeric / rating_total::numeric) >= 0.7
          then 'shown'
        when status = 'pending'
          and rating_total >= 5
          then 'hidden'
        else status
      end
  where id = target_note_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_refresh_note_rating_counts()
returns trigger as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform bc_recompute_note_consensus(old.note_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform bc_recompute_note_consensus(new.note_id);
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_guard_vote_user_update()
returns trigger as $$
begin
  if bc_is_admin() then
    return new;
  end if;

  if new.submission_id is distinct from old.submission_id
    or new.voter_profile_id is distinct from old.voter_profile_id then
    raise exception 'Vote ownership fields cannot be changed directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_guard_comment_user_update()
returns trigger as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if bc_is_admin() then
    return new;
  end if;

  if new.helpful_count is distinct from old.helpful_count
    or new.is_pinned is distinct from old.is_pinned
    or new.moderation_status is distinct from old.moderation_status
    or new.submission_id is distinct from old.submission_id
    or new.profile_id is distinct from old.profile_id
    or new.social_activity_id is distinct from old.social_activity_id then
    raise exception 'Server-controlled comment fields cannot be changed directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_guard_note_user_update()
returns trigger as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if bc_is_admin() then
    return new;
  end if;

  if new.helpful_count is distinct from old.helpful_count
    or new.unhelpful_count is distinct from old.unhelpful_count
    or new.status is distinct from old.status
    or new.flag_id is distinct from old.flag_id
    or new.author_id is distinct from old.author_id then
    raise exception 'Server-controlled note fields cannot be changed directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_guard_note_rating_update()
returns trigger as $$
begin
  if new.note_id is distinct from old.note_id
    or new.rater_id is distinct from old.rater_id then
    raise exception 'Note rating ownership fields cannot be changed directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_guard_submission_user_update()
returns trigger as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if bc_is_admin() then
    return new;
  end if;

  if new.vote_score is distinct from old.vote_score
    or new.rank is distinct from old.rank
    or new.photo_verified is distinct from old.photo_verified
    or new.photo_verified_at is distinct from old.photo_verified_at
    or new.verification_method is distinct from old.verification_method
    or new.moderation_status is distinct from old.moderation_status then
    raise exception 'Server-controlled submission fields cannot be changed directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists bc_dishes_set_updated_at on bc_dishes;
create trigger bc_dishes_set_updated_at before update on bc_dishes
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_media_assets_set_updated_at on bc_media_assets;
create trigger bc_media_assets_set_updated_at before update on bc_media_assets
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_product_records_set_updated_at on bc_product_records;
create trigger bc_product_records_set_updated_at before update on bc_product_records
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_product_aliases_set_updated_at on bc_product_aliases;
create trigger bc_product_aliases_set_updated_at before update on bc_product_aliases
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_product_nutrition_set_updated_at on bc_product_nutrition;
create trigger bc_product_nutrition_set_updated_at before update on bc_product_nutrition
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_product_contributions_set_updated_at on bc_product_contributions;
create trigger bc_product_contributions_set_updated_at before update on bc_product_contributions
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_product_evidence_set_updated_at on bc_product_evidence;
create trigger bc_product_evidence_set_updated_at before update on bc_product_evidence
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_submissions_set_updated_at on bc_submissions;
create trigger bc_submissions_set_updated_at before update on bc_submissions
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_votes_set_updated_at on bc_votes;
create trigger bc_votes_set_updated_at before update on bc_votes
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_comments_set_updated_at on bc_comments;
create trigger bc_comments_set_updated_at before update on bc_comments
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_flags_set_updated_at on bc_flags;
create trigger bc_flags_set_updated_at before update on bc_flags
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_subscriptions_set_updated_at on bc_subscriptions;
create trigger bc_subscriptions_set_updated_at before update on bc_subscriptions
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_posts_set_updated_at on bc_posts;
create trigger bc_posts_set_updated_at before update on bc_posts
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_hubs_set_updated_at on bc_hubs;
create trigger bc_hubs_set_updated_at before update on bc_hubs
  for each row execute function bc_set_updated_at();

drop trigger if exists bc_submissions_guard_user_update on bc_submissions;
create trigger bc_submissions_guard_user_update before update on bc_submissions
  for each row execute function bc_guard_submission_user_update();
drop trigger if exists bc_votes_guard_user_update on bc_votes;
create trigger bc_votes_guard_user_update before update on bc_votes
  for each row execute function bc_guard_vote_user_update();
drop trigger if exists bc_comments_guard_user_update on bc_comments;
create trigger bc_comments_guard_user_update before update on bc_comments
  for each row execute function bc_guard_comment_user_update();
drop trigger if exists bc_notes_guard_user_update on bc_notes;
create trigger bc_notes_guard_user_update before update on bc_notes
  for each row execute function bc_guard_note_user_update();
drop trigger if exists bc_note_ratings_guard_user_update on bc_note_ratings;
create trigger bc_note_ratings_guard_user_update before update on bc_note_ratings
  for each row execute function bc_guard_note_rating_update();

drop trigger if exists bc_dish_aliases_refresh_alias_count on bc_dish_aliases;
create trigger bc_dish_aliases_refresh_alias_count after insert or delete on bc_dish_aliases
  for each row execute function bc_refresh_alias_count();

drop trigger if exists bc_submissions_refresh_dish_count on bc_submissions;
create trigger bc_submissions_refresh_dish_count after insert or update or delete on bc_submissions
  for each row execute function bc_refresh_dish_submission_count();

drop trigger if exists bc_votes_refresh_submission_score on bc_votes;
create trigger bc_votes_refresh_submission_score after insert or update or delete on bc_votes
  for each row execute function bc_refresh_submission_score();

drop trigger if exists bc_comment_helpful_refresh_count on bc_comment_helpful;
create trigger bc_comment_helpful_refresh_count after insert or delete on bc_comment_helpful
  for each row execute function bc_refresh_comment_helpful_count();
drop trigger if exists bc_note_ratings_refresh_counts on bc_note_ratings;
create trigger bc_note_ratings_refresh_counts after insert or update or delete on bc_note_ratings
  for each row execute function bc_refresh_note_rating_counts();

drop trigger if exists bc_dishes_content_event on bc_dishes;
create trigger bc_dishes_content_event after insert or update or delete on bc_dishes
  for each row execute function bc_record_content_event();
drop trigger if exists bc_dish_aliases_content_event on bc_dish_aliases;
create trigger bc_dish_aliases_content_event after insert or update or delete on bc_dish_aliases
  for each row execute function bc_record_content_event();
drop trigger if exists bc_recipe_snapshots_content_event on bc_recipe_snapshots;
create trigger bc_recipe_snapshots_content_event after insert or delete on bc_recipe_snapshots
  for each row execute function bc_record_content_event();
drop trigger if exists bc_media_assets_content_event on bc_media_assets;
create trigger bc_media_assets_content_event after insert or update or delete on bc_media_assets
  for each row execute function bc_record_content_event();
drop trigger if exists bc_media_variants_content_event on bc_media_variants;
create trigger bc_media_variants_content_event after insert or delete on bc_media_variants
  for each row execute function bc_record_content_event();
drop trigger if exists bc_product_records_content_event on bc_product_records;
create trigger bc_product_records_content_event after insert or update or delete on bc_product_records
  for each row execute function bc_record_content_event();
drop trigger if exists bc_product_aliases_content_event on bc_product_aliases;
create trigger bc_product_aliases_content_event after insert or update or delete on bc_product_aliases
  for each row execute function bc_record_content_event();
drop trigger if exists bc_product_nutrition_content_event on bc_product_nutrition;
create trigger bc_product_nutrition_content_event after insert or update or delete on bc_product_nutrition
  for each row execute function bc_record_content_event();
drop trigger if exists bc_product_evidence_content_event on bc_product_evidence;
create trigger bc_product_evidence_content_event after insert or update or delete on bc_product_evidence
  for each row execute function bc_record_content_event();
drop trigger if exists bc_submissions_content_event on bc_submissions;
create trigger bc_submissions_content_event after insert or update or delete on bc_submissions
  for each row execute function bc_record_content_event();
drop trigger if exists bc_rankings_content_event on bc_rankings;
create trigger bc_rankings_content_event after insert or update or delete on bc_rankings
  for each row execute function bc_record_ranking_event();
drop trigger if exists bc_badge_definitions_content_event on bc_badge_definitions;
create trigger bc_badge_definitions_content_event after insert or update or delete on bc_badge_definitions
  for each row execute function bc_record_content_event();

create or replace function bc_submit_vote(
  p_submission_id uuid,
  p_voter_profile_id uuid,
  p_tier integer
)
returns bc_votes as $$
declare
  saved_vote bc_votes%rowtype;
begin
  if not bc_profile_owned(p_voter_profile_id) then
    raise exception 'Not authorized to vote from this profile';
  end if;
  if p_tier < 0 or p_tier > 3 then
    raise exception 'Vote tier must be between 0 and 3';
  end if;
  if not bc_submission_visible(p_submission_id) then
    raise exception 'Submission is not available for voting';
  end if;
  if exists (
    select 1 from bc_submissions
    where id = p_submission_id
      and profile_id = p_voter_profile_id
  ) then
    raise exception 'Chefs cannot vote on their own submissions';
  end if;

  insert into bc_votes (submission_id, voter_profile_id, tier, updated_at)
  values (p_submission_id, p_voter_profile_id, p_tier, now())
  on conflict (submission_id, voter_profile_id) do update
    set tier = excluded.tier,
        updated_at = now()
  returning * into saved_vote;

  return saved_vote;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_rebuild_rankings(p_dish_id uuid default null)
returns void as $$
begin
  if not bc_is_admin() then
    raise exception 'Not authorized to rebuild BestChef rankings';
  end if;

  delete from bc_rankings
  where p_dish_id is null or dish_id = p_dish_id;

  insert into bc_rankings (dish_id, submission_id, score, rank, region, country_code, updated_at)
  select
    ranked.dish_id,
    ranked.id,
    ranked.vote_score,
    ranked.rank,
    null,
    ranked.country_code,
    now()
  from (
    select
      s.*,
      row_number() over (
        partition by s.dish_id
        order by (s.photo_url is not null and length(s.photo_url) > 0) desc,
                 s.vote_score desc,
                 s.created_at asc
      ) as rank
    from bc_submissions s
    where s.moderation_status = 'approved'
      and (p_dish_id is null or s.dish_id = p_dish_id)
  ) ranked;

  insert into bc_leaderboard_snapshots (dish_id, scope, ranking_json, content_version)
  select
    r.dish_id,
    'global',
    jsonb_agg(
      jsonb_build_object(
        'submission_id', r.submission_id,
        'score', r.score,
        'rank', r.rank,
        'country_code', r.country_code
      )
      order by r.rank
    ),
    coalesce((select max(version) from bc_content_events), 0)
  from bc_rankings r
  where p_dish_id is null or r.dish_id = p_dish_id
  group by r.dish_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_submission_bundle(p_submission_id uuid)
returns jsonb as $$
declare
  bundle jsonb;
begin
  if not bc_submission_visible(p_submission_id) then
    return null;
  end if;

  select jsonb_build_object(
    'submission', to_jsonb(s) - array['chef_location_lat', 'chef_location_lng'],
    'recipe', to_jsonb(r) - array['original_local_recipe_id'],
    'media_assets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'owner_kind', a.owner_kind,
          'owner_id', a.owner_id,
          'media_kind', a.media_kind,
          'remote_url', a.remote_url,
          'content_hash', a.content_hash,
          'byte_size', a.byte_size,
          'width', a.width,
          'height', a.height,
          'duration_ms', a.duration_ms,
          'metadata', a.metadata,
          'variants', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', v.id,
                'variant', v.variant,
                'remote_url', v.remote_url,
                'content_hash', v.content_hash,
                'byte_size', v.byte_size,
                'width', v.width,
                'height', v.height,
                'duration_ms', v.duration_ms
              )
              order by v.variant
            )
            from bc_media_variants v
            where v.asset_id = a.id
          ), '[]'::jsonb)
        )
        order by a.created_at
      )
      from bc_media_assets a
      where a.owner_kind = 'submission'
        and a.owner_id = s.id::text
        and a.moderation_status = 'approved'
        and a.upload_status = 'ready'
        and a.visibility in ('public', 'unlisted')
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg((to_jsonb(c) - array['social_activity_id']) order by c.created_at)
      from bc_comments c
      where c.submission_id = s.id
        and c.moderation_status = 'approved'
    ), '[]'::jsonb)
  )
  into bundle
  from bc_submissions s
  join bc_recipe_snapshots r on r.id = s.recipe_snapshot_id
  where s.id = p_submission_id;

  return bundle;
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function bc_core_delta(
  after_version bigint default 0,
  result_limit integer default 500
)
returns table (
  version bigint,
  table_name text,
  record_id text,
  operation text,
  payload jsonb,
  created_at timestamptz
) as $$
begin
  return query
  select e.version, e.table_name, e.record_id, e.operation, e.payload, e.created_at
  from bc_content_events e
  where e.version > after_version
  order by e.version asc
  limit least(greatest(result_limit, 1), 1000);
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function bc_register_hub_manifest(
  p_hub_slug text,
  p_display_name text,
  p_owner_profile_id uuid,
  p_public_signing_key text,
  p_schema_version integer,
  p_media_base_url text,
  p_moderation_policy_url text,
  p_feature_flags jsonb default '{}'::jsonb
)
returns bc_hubs as $$
declare
  saved_hub bc_hubs%rowtype;
  existing_hub bc_hubs%rowtype;
begin
  if not bc_profile_owned(p_owner_profile_id) then
    raise exception 'Not authorized to register this hub';
  end if;

  select *
  into existing_hub
  from bc_hubs
  where hub_slug = p_hub_slug
  for update;

  if found and not (bc_is_admin() or existing_hub.owner_profile_id = p_owner_profile_id) then
    raise exception 'Not authorized to update this hub manifest';
  end if;

  insert into bc_hubs (
    hub_slug,
    display_name,
    owner_profile_id,
    public_signing_key,
    schema_version,
    media_base_url,
    moderation_policy_url,
    feature_flags,
    updated_at
  )
  values (
    p_hub_slug,
    p_display_name,
    p_owner_profile_id,
    p_public_signing_key,
    p_schema_version,
    p_media_base_url,
    p_moderation_policy_url,
    p_feature_flags,
    now()
  )
  on conflict (hub_slug) do update
    set display_name = excluded.display_name,
        owner_profile_id = excluded.owner_profile_id,
        public_signing_key = excluded.public_signing_key,
        schema_version = excluded.schema_version,
        media_base_url = excluded.media_base_url,
        moderation_policy_url = excluded.moderation_policy_url,
        feature_flags = excluded.feature_flags,
        updated_at = now()
  returning * into saved_hub;

  return saved_hub;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_record_media_asset(
  p_owner_profile_id uuid,
  p_owner_kind text,
  p_owner_id text,
  p_media_kind text,
  p_storage_bucket text,
  p_storage_key text,
  p_remote_url text,
  p_content_hash text default null,
  p_byte_size bigint default null,
  p_width integer default null,
  p_height integer default null,
  p_duration_ms integer default null
)
returns bc_media_assets as $$
declare
  saved_asset bc_media_assets%rowtype;
begin
  if not bc_profile_owned(p_owner_profile_id) then
    raise exception 'Not authorized to record media for this profile';
  end if;

  insert into bc_media_assets (
    owner_profile_id,
    owner_kind,
    owner_id,
    media_kind,
    storage_bucket,
    storage_key,
    remote_url,
    content_hash,
    byte_size,
    width,
    height,
    duration_ms,
    upload_status,
    moderation_status
  )
  values (
    p_owner_profile_id,
    p_owner_kind,
    p_owner_id,
    p_media_kind,
    p_storage_bucket,
    p_storage_key,
    p_remote_url,
    p_content_hash,
    p_byte_size,
    p_width,
    p_height,
    p_duration_ms,
    'uploaded',
    'pending'
  )
  returning * into saved_asset;

  return saved_asset;
end;
$$ language plpgsql security definer set search_path = public;
