-- BestChef authoritative server schema.
-- Keep this file aligned with the active BestChef Supabase migrations.

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

create or replace function bc_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from social_profiles
  where user_id = auth.uid()
  limit 1;
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
  constraint bc_dishes_slug_unique unique (slug),
  constraint bc_dishes_photo_url_https check (photo_url is null or photo_url ~ '^https://')
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
  like_count integer not null default 0 check (like_count >= 0),
  rank integer,
  moderation_status text not null default 'approved' check (moderation_status in ('approved', 'pending', 'hidden', 'rejected')),
  -- P1-A: region filter + restaurant flag
  region text,
  is_restaurant boolean not null default false,
  -- P1-A: vote-score decomposition (triggers in P1-B)
  upvote_count integer not null default 0,
  downvote_count integer not null default 0,
  reviewed_count integer not null default 0,
  tap_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_submissions_photo_url_https check (photo_url is null or photo_url ~ '^https://')
);

create index if not exists bc_submissions_dish_score_idx on bc_submissions (dish_id, vote_score desc, created_at desc);
create index if not exists bc_submissions_profile_idx on bc_submissions (profile_id, created_at desc);
create index if not exists bc_submissions_snapshot_idx on bc_submissions (recipe_snapshot_id);
create index if not exists bc_submissions_region_idx on bc_submissions (region) where region is not null;

create table if not exists bc_votes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references bc_submissions(id) on delete cascade,
  voter_profile_id uuid not null references social_profiles(id) on delete cascade,
  tier text not null check (tier in ('gold','silver','bronze','like','tap_up','tap_down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_votes_unique unique (submission_id, voter_profile_id)
);

create index if not exists bc_votes_submission_idx on bc_votes (submission_id, created_at desc);
create index if not exists bc_votes_voter_idx on bc_votes (voter_profile_id, updated_at desc);

create table if not exists bc_submission_likes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references bc_submissions(id) on delete cascade,
  profile_id uuid not null references social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint bc_submission_likes_unique unique (submission_id, profile_id)
);

create index if not exists bc_submission_likes_submission_idx on bc_submission_likes (submission_id, created_at desc);
create index if not exists bc_submission_likes_profile_idx on bc_submission_likes (profile_id, created_at desc);

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
  constraint bc_comments_body_length check (char_length(body) between 1 and 2000),
  constraint bc_comments_photo_url_https check (photo_url is null or photo_url ~ '^https://')
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
  target_type text not null check (target_type in ('submission', 'comment', 'dish_proposal', 'photo', 'profile', 'media_asset', 'product_contribution', 'product_evidence', 'vote_proof')),
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
  status text not null default 'submitted' check (status in (
    'submitted',
    'under_review',
    'approved',
    'declined',
    'more_info_needed',
    'withdrawn'
  )),
  reviewed_at timestamptz,
  reviewer_note text,
  review_notes text,
  created_at timestamptz not null default now()
);

create index if not exists bc_creator_applications_profile_idx on bc_creator_applications (profile_id, created_at desc);
create index if not exists bc_creator_applications_status_idx on bc_creator_applications (status, created_at desc);
create index if not exists bc_creator_applications_user_idx on bc_creator_applications (profile_id);

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
alter table bc_submission_likes enable row level security;
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
  or exists (
    select 1
    from public.bc_submissions s
    where s.recipe_snapshot_id = public.bc_recipe_snapshots.id
      and s.moderation_status = 'approved'
  )
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

drop policy if exists "bc_submission_likes_read" on bc_submission_likes;
create policy "bc_submission_likes_read" on bc_submission_likes for select using (
  bc_submission_visible(submission_id) or bc_profile_owned(profile_id)
);
drop policy if exists "bc_submission_likes_insert" on bc_submission_likes;
create policy "bc_submission_likes_insert" on bc_submission_likes for insert with check (
  bc_profile_owned(profile_id)
  and bc_submission_visible(submission_id)
);
drop policy if exists "bc_submission_likes_delete" on bc_submission_likes;
create policy "bc_submission_likes_delete" on bc_submission_likes for delete using (
  bc_profile_owned(profile_id) or bc_is_admin()
);

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
      'like_count', p_row->'like_count',
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

-- Migration 20260427000008_bc_vote_proofs.sql
-- BestChef vote proof-of-cook gate.

create or replace function bc_is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role() = 'service_role', false)
    or coalesce((auth.jwt()->>'role') in ('admin', 'moderator', 'service_role'), false)
    or coalesce((auth.jwt()->'app_metadata'->>'role') in ('admin', 'moderator', 'service_role'), false)
    or coalesce((auth.jwt()->'app_metadata'->'roles') ?| array['admin', 'moderator', 'service_role'], false);
$$;

alter table bc_media_assets
  drop constraint if exists bc_media_assets_owner_kind_check;
alter table bc_media_assets
  add constraint bc_media_assets_owner_kind_check
  check (owner_kind in (
    'dish',
    'submission',
    'recipe_snapshot',
    'comment',
    'post',
    'product_record',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  ));

alter table bc_votes
  add column if not exists status text not null default 'active';
alter table bc_votes
  drop constraint if exists bc_votes_status_check;
alter table bc_votes
  add constraint bc_votes_status_check
  check (status in ('active', 'proof_pending', 'proof_rejected', 'deleted'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bc_votes_unique_voter_submission'
      and conrelid = 'bc_votes'::regclass
  ) then
    alter table bc_votes
      add constraint bc_votes_unique_voter_submission
      unique (voter_profile_id, submission_id);
  end if;
end;
$$;

create table if not exists bc_vote_proofs (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null unique references bc_votes(id) on delete cascade,
  submission_id uuid not null references bc_submissions(id) on delete cascade,
  profile_id uuid not null references social_profiles(id) on delete cascade,
  media_asset_id uuid not null references bc_media_assets(id) on delete restrict,
  content_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  captured_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_vote_proofs_unique_per_submission
    unique (submission_id, content_hash)
);

create index if not exists bc_vote_proofs_submission_idx
  on bc_vote_proofs (submission_id, status, captured_at desc);
create index if not exists bc_vote_proofs_profile_idx
  on bc_vote_proofs (profile_id, captured_at desc);
create index if not exists bc_vote_proofs_status_idx
  on bc_vote_proofs (status, captured_at desc);
create index if not exists bc_vote_proofs_media_asset_idx
  on bc_vote_proofs (media_asset_id);

create table if not exists bc_moderation_queue (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'submission',
    'comment',
    'profile',
    'media_asset',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  )),
  target_id uuid not null,
  profile_id uuid references social_profiles(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'decided', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_moderation_queue_target_unique unique (kind, target_id)
);

create index if not exists bc_moderation_queue_status_idx
  on bc_moderation_queue (status, created_at);
create index if not exists bc_moderation_queue_profile_idx
  on bc_moderation_queue (profile_id, created_at desc);

create table if not exists bc_moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'submission',
    'comment',
    'profile',
    'media_asset',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  )),
  target_id uuid not null,
  profile_id uuid references social_profiles(id) on delete set null,
  actor_profile_id uuid references social_profiles(id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected', 'hidden', 'removed', 'restored', 'dismissed')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  previous_state jsonb not null default '{}'::jsonb,
  new_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bc_moderation_decisions_target_idx
  on bc_moderation_decisions (kind, target_id, created_at desc);
create index if not exists bc_moderation_decisions_actor_idx
  on bc_moderation_decisions (actor_profile_id, created_at desc);

alter table bc_vote_proofs enable row level security;
alter table bc_moderation_queue enable row level security;
alter table bc_moderation_decisions enable row level security;

drop policy if exists "bc_votes_insert" on bc_votes;
create policy "bc_votes_insert" on bc_votes for insert
  with check (false);
drop policy if exists "bc_votes_update" on bc_votes;
create policy "bc_votes_update" on bc_votes for update
  using (bc_is_admin())
  with check (bc_is_admin());
drop policy if exists "bc_votes_delete" on bc_votes;
create policy "bc_votes_delete" on bc_votes for delete
  using (bc_is_admin());

drop policy if exists "bc_vote_proofs_read" on bc_vote_proofs;
create policy "bc_vote_proofs_read" on bc_vote_proofs for select using (
  status = 'approved'
  or bc_profile_owned(profile_id)
  or bc_is_admin()
);
drop policy if exists "bc_vote_proofs_insert" on bc_vote_proofs;
create policy "bc_vote_proofs_insert" on bc_vote_proofs for insert
  with check (false);
drop policy if exists "bc_vote_proofs_update" on bc_vote_proofs;
create policy "bc_vote_proofs_update" on bc_vote_proofs for update using (
  bc_is_admin()
  or (bc_profile_owned(profile_id) and status = 'pending')
) with check (
  bc_is_admin()
  or (bc_profile_owned(profile_id) and status = 'pending')
);
drop policy if exists "bc_vote_proofs_delete" on bc_vote_proofs;
create policy "bc_vote_proofs_delete" on bc_vote_proofs for delete using (
  bc_is_admin()
  or (bc_profile_owned(profile_id) and status = 'pending')
);

drop policy if exists "bc_moderation_queue_read" on bc_moderation_queue;
create policy "bc_moderation_queue_read" on bc_moderation_queue for select
  using (bc_is_admin());
drop policy if exists "bc_moderation_queue_write" on bc_moderation_queue;
create policy "bc_moderation_queue_write" on bc_moderation_queue for all
  using (bc_is_admin())
  with check (bc_is_admin());

drop policy if exists "bc_moderation_decisions_read" on bc_moderation_decisions;
create policy "bc_moderation_decisions_read" on bc_moderation_decisions for select
  using (bc_is_admin() or bc_profile_owned(profile_id));
drop policy if exists "bc_moderation_decisions_write" on bc_moderation_decisions;
create policy "bc_moderation_decisions_write" on bc_moderation_decisions for all
  using (bc_is_admin())
  with check (bc_is_admin());

drop trigger if exists bc_vote_proofs_set_updated_at on bc_vote_proofs;
create trigger bc_vote_proofs_set_updated_at before update on bc_vote_proofs
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_moderation_queue_set_updated_at on bc_moderation_queue;
create trigger bc_moderation_queue_set_updated_at before update on bc_moderation_queue
  for each row execute function bc_set_updated_at();

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
    coalesce(sum(case tier
      when 'tap_down' then 0
      when 'bronze' then 1
      when 'like' then 1
      when 'tap_up' then 1
      when 'silver' then 3
      when 'gold' then 5
      else 0
    end), 0)::double precision
  into n, weighted_sum
  from bc_votes
  where submission_id = p_submission_id
    and status = 'active';

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

create or replace function bc_vote_tier_from_text(p_tier text)
returns text
language sql
immutable
as $$
  select case p_tier
    when 'like' then 'like'
    when 'bronze' then 'bronze'
    when 'silver' then 'silver'
    when 'gold' then 'gold'
    when 'tap_up' then 'tap_up'
    when 'tap_down' then 'tap_down'
    else null
  end;
$$;

create or replace function bc_cast_vote(
  p_submission_id uuid,
  p_tier text,
  p_media_asset_id uuid
) returns table (
  vote_id uuid,
  proof_id uuid,
  status text,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_asset bc_media_assets%rowtype;
  v_existing_vote_id uuid;
  v_vote_id uuid;
  v_proof_id uuid;
  v_tier text;
begin
  if v_user_id is null then
    return query select null::uuid, null::uuid, null::text, 'unauthenticated'::text;
    return;
  end if;

  select id
  into v_profile_id
  from social_profiles
  where user_id = v_user_id
  limit 1;

  if v_profile_id is null then
    return query select null::uuid, null::uuid, null::text, 'profile_not_found'::text;
    return;
  end if;

  if not exists (
    select 1
    from bc_submissions s
    where s.id = p_submission_id
      and s.moderation_status = 'approved'
  ) then
    return query select null::uuid, null::uuid, null::text, 'submission_not_found'::text;
    return;
  end if;

  v_tier := bc_vote_tier_from_text(p_tier);
  if v_tier is null then
    return query select null::uuid, null::uuid, null::text, 'invalid_tier'::text;
    return;
  end if;

  select *
  into v_asset
  from bc_media_assets
  where id = p_media_asset_id;

  if not found
     or v_asset.owner_profile_id is distinct from v_profile_id
     or v_asset.media_kind <> 'image'
     or v_asset.upload_status <> 'uploaded'
     or v_asset.owner_kind <> 'vote_proof'
     or nullif(trim(coalesce(v_asset.content_hash, '')), '') is null then
    return query select null::uuid, null::uuid, null::text, 'invalid_proof_asset'::text;
    return;
  end if;

  if exists (
    select 1
    from bc_submissions s
    where s.id = p_submission_id
      and s.profile_id = v_profile_id
  ) then
    return query select null::uuid, null::uuid, null::text, 'cannot_vote_on_own'::text;
    return;
  end if;

  select id
  into v_existing_vote_id
  from bc_votes
  where submission_id = p_submission_id
    and voter_profile_id = v_profile_id
  limit 1;

  if v_existing_vote_id is not null then
    return query select v_existing_vote_id, null::uuid, null::text, 'vote_already_exists'::text;
    return;
  end if;

  insert into bc_votes (
    id,
    submission_id,
    voter_profile_id,
    tier,
    status,
    updated_at
  )
  values (
    gen_random_uuid(),
    p_submission_id,
    v_profile_id,
    v_tier,
    'proof_pending',
    now()
  )
  returning id into v_vote_id;

  begin
    insert into bc_vote_proofs (
      id,
      vote_id,
      submission_id,
      profile_id,
      media_asset_id,
      content_hash,
      status
    )
    values (
      gen_random_uuid(),
      v_vote_id,
      p_submission_id,
      v_profile_id,
      p_media_asset_id,
      v_asset.content_hash,
      'pending'
    )
    returning id into v_proof_id;
  exception
    when unique_violation then
      delete from bc_votes where id = v_vote_id;
      return query select null::uuid, null::uuid, null::text, 'proof_duplicate'::text;
      return;
  end;

  insert into bc_moderation_queue (
    kind,
    target_id,
    profile_id,
    status,
    metadata
  )
  values (
    'vote_proof',
    v_proof_id,
    v_profile_id,
    'queued',
    jsonb_build_object(
      'submission_id', p_submission_id,
      'media_asset_id', p_media_asset_id
    )
  )
  on conflict (kind, target_id) do update
    set status = 'queued',
        profile_id = excluded.profile_id,
        metadata = excluded.metadata,
        updated_at = now();

  return query select v_vote_id, v_proof_id, 'pending'::text, null::text;
end;
$$;

create or replace function bc_delete_vote(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_media_asset_id uuid;
  v_deleted_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select id
  into v_profile_id
  from social_profiles
  where user_id = v_user_id
  limit 1;

  if v_profile_id is null then
    raise exception 'profile_not_found';
  end if;

  select p.media_asset_id
  into v_media_asset_id
  from bc_votes v
  join bc_vote_proofs p on p.vote_id = v.id
  where v.submission_id = p_submission_id
    and v.voter_profile_id = v_profile_id
  limit 1;

  delete from bc_votes
  where submission_id = p_submission_id
    and voter_profile_id = v_profile_id;

  if v_media_asset_id is not null then
    update bc_media_assets
    set upload_status = 'deleted',
        moderation_status = 'rejected',
        visibility = 'private',
        metadata = metadata || jsonb_build_object(
          'deleted_by', 'bc_delete_vote',
          'deleted_at', v_deleted_at,
          'deletion_reason', 'user_deleted_vote',
          'storage_purge', 'pending_server_worker'
        ),
        updated_at = v_deleted_at
    where id = v_media_asset_id
      and owner_profile_id = v_profile_id
      and owner_kind = 'vote_proof';
  end if;
end;
$$;

create or replace function bc_apply_vote_proof_decision(
  p_proof_id uuid,
  p_decision text,
  p_reason text default null
) returns table (
  proof_id uuid,
  vote_id uuid,
  proof_status text,
  vote_status text,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_proof bc_vote_proofs%rowtype;
  v_proof_status text;
  v_vote_status text;
begin
  if not bc_is_admin() then
    return query select p_proof_id, null::uuid, null::text, null::text, 'not_authorized'::text;
    return;
  end if;

  if p_decision not in ('approved', 'rejected') then
    return query select p_proof_id, null::uuid, null::text, null::text, 'invalid_decision'::text;
    return;
  end if;

  select id
  into v_actor_profile_id
  from social_profiles
  where user_id = auth.uid()
  limit 1;

  select *
  into v_proof
  from bc_vote_proofs
  where id = p_proof_id
  for update;

  if not found then
    return query select p_proof_id, null::uuid, null::text, null::text, 'proof_not_found'::text;
    return;
  end if;

  if p_decision = 'approved' then
    v_proof_status := 'approved';
    v_vote_status := 'active';

    update bc_vote_proofs
    set status = v_proof_status,
        rejection_reason = null,
        reviewed_at = now(),
        updated_at = now()
    where id = p_proof_id;

    update bc_media_assets
    set moderation_status = 'approved',
        visibility = 'public',
        upload_status = case
          when upload_status = 'uploaded' then 'ready'
          else upload_status
        end,
        updated_at = now()
    where id = v_proof.media_asset_id;
  else
    v_proof_status := 'rejected';
    v_vote_status := 'proof_rejected';

    update bc_vote_proofs
    set status = v_proof_status,
        rejection_reason = p_reason,
        reviewed_at = now(),
        updated_at = now()
    where id = p_proof_id;

    update bc_media_assets
    set moderation_status = 'rejected',
        visibility = 'private',
        updated_at = now()
    where id = v_proof.media_asset_id;
  end if;

  update bc_votes
  set status = v_vote_status,
      updated_at = now()
  where id = v_proof.vote_id;

  insert into bc_moderation_decisions (
    kind,
    target_id,
    profile_id,
    actor_profile_id,
    decision,
    reason,
    metadata
  )
  values (
    'vote_proof',
    p_proof_id,
    v_proof.profile_id,
    v_actor_profile_id,
    p_decision,
    p_reason,
    jsonb_build_object('vote_id', v_proof.vote_id, 'submission_id', v_proof.submission_id)
  );

  update bc_moderation_queue
  set status = 'decided',
      updated_at = now()
  where kind = 'vote_proof'
    and target_id = p_proof_id;

  return query select p_proof_id, v_proof.vote_id, v_proof_status, v_vote_status, null::text;
end;
$$;

create or replace function bc_submit_vote(
  p_submission_id uuid,
  p_voter_profile_id uuid,
  p_tier integer
)
returns bc_votes as $$
begin
  raise exception 'Vote proof is required. Use bc_cast_vote with a proof media asset.';
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function bc_submit_vote(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function bc_cast_vote(uuid, text, uuid) to authenticated;
grant execute on function bc_delete_vote(uuid) to authenticated;
grant execute on function bc_apply_vote_proof_decision(uuid, text, text) to service_role;

-- BestChef public-launch moderation operations.

create or replace function bc_report_content(
  p_target_kind text,
  p_target_id uuid,
  p_reason text,
  p_reporter_profile_id uuid default null
) returns table (
  flag_id uuid,
  queue_id uuid,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_kind text := lower(trim(coalesce(p_target_kind, '')));
  v_queue_kind text;
  v_flag_target_type text;
  v_reporter_profile_id uuid;
  v_target_profile_id uuid;
begin
  if p_target_id is null then
    return query select null::uuid, null::uuid, 'target_required'::text;
    return;
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    return query select null::uuid, null::uuid, 'reason_required'::text;
    return;
  end if;

  v_reporter_profile_id := coalesce(p_reporter_profile_id, bc_current_profile_id());

  if v_reporter_profile_id is null or not bc_profile_owned(v_reporter_profile_id) then
    return query select null::uuid, null::uuid, 'not_authorized'::text;
    return;
  end if;

  v_queue_kind := case
    when v_target_kind = 'photo' then 'media_asset'
    else v_target_kind
  end;
  v_flag_target_type := case
    when v_target_kind = 'photo' then 'photo'
    else v_queue_kind
  end;

  if v_queue_kind not in (
    'submission',
    'comment',
    'profile',
    'media_asset',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  ) then
    return query select null::uuid, null::uuid, 'invalid_target_kind'::text;
    return;
  end if;

  if v_queue_kind = 'submission' then
    select profile_id
    into v_target_profile_id
    from bc_submissions
    where id = p_target_id;
  elsif v_queue_kind = 'comment' then
    select profile_id
    into v_target_profile_id
    from bc_comments
    where id = p_target_id;
  elsif v_queue_kind = 'profile' then
    select id
    into v_target_profile_id
    from social_profiles
    where id = p_target_id;
  elsif v_queue_kind = 'media_asset' then
    select owner_profile_id
    into v_target_profile_id
    from bc_media_assets
    where id = p_target_id;
  elsif v_queue_kind = 'product_contribution' then
    select profile_id
    into v_target_profile_id
    from bc_product_contributions
    where id = p_target_id;
  elsif v_queue_kind = 'product_evidence' then
    select owner_profile_id
    into v_target_profile_id
    from bc_product_evidence
    where id = p_target_id;
  elsif v_queue_kind = 'vote_proof' then
    select profile_id
    into v_target_profile_id
    from bc_vote_proofs
    where id = p_target_id;
  end if;

  if not found then
    return query select null::uuid, null::uuid, 'target_not_found'::text;
    return;
  end if;

  insert into bc_flags (
    target_type,
    target_id,
    flagger_id,
    reason,
    status
  )
  values (
    v_flag_target_type,
    p_target_id,
    v_reporter_profile_id,
    trim(p_reason),
    'open'
  )
  returning id into flag_id;

  insert into bc_moderation_queue (
    kind,
    target_id,
    profile_id,
    status,
    metadata
  )
  values (
    v_queue_kind,
    p_target_id,
    v_target_profile_id,
    'queued',
    jsonb_build_object(
      'first_flag_id', flag_id,
      'latest_flag_id', flag_id,
      'latest_reason', trim(p_reason),
      'latest_reporter_profile_id', v_reporter_profile_id,
      'source', 'bc_report_content'
    )
  )
  on conflict (kind, target_id) do update
    set status = case
          when bc_moderation_queue.status = 'decided' then 'queued'
          else bc_moderation_queue.status
        end,
        profile_id = coalesce(excluded.profile_id, bc_moderation_queue.profile_id),
        metadata = bc_moderation_queue.metadata || jsonb_build_object(
          'latest_flag_id', flag_id,
          'latest_reason', trim(p_reason),
          'latest_reporter_profile_id', v_reporter_profile_id,
          'source', 'bc_report_content'
        ),
        updated_at = now()
  returning id into queue_id;

  return query select flag_id, queue_id, null::text;
end;
$$;

create or replace function bc_apply_vote_proof_decision(
  p_proof_id uuid,
  p_decision text,
  p_reason text default null
) returns table (
  proof_id uuid,
  vote_id uuid,
  proof_status text,
  vote_status text,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_proof bc_vote_proofs%rowtype;
  v_proof_status text;
  v_vote_status text;
  v_previous_state jsonb := '{}'::jsonb;
  v_new_state jsonb := '{}'::jsonb;
begin
  if not bc_is_admin() then
    return query select p_proof_id, null::uuid, null::text, null::text, 'not_authorized'::text;
    return;
  end if;

  if p_decision not in ('approved', 'rejected') then
    return query select p_proof_id, null::uuid, null::text, null::text, 'invalid_decision'::text;
    return;
  end if;

  v_actor_profile_id := bc_current_profile_id();

  select *
  into v_proof
  from bc_vote_proofs
  where id = p_proof_id
  for update;

  if not found then
    return query select p_proof_id, null::uuid, null::text, null::text, 'proof_not_found'::text;
    return;
  end if;

  select jsonb_build_object(
    'proof_status', v_proof.status,
    'vote_status', v.status,
    'media_upload_status', m.upload_status,
    'media_moderation_status', m.moderation_status,
    'media_visibility', m.visibility
  )
  into v_previous_state
  from bc_votes v
  left join bc_media_assets m on m.id = v_proof.media_asset_id
  where v.id = v_proof.vote_id;

  if p_decision = 'approved' then
    v_proof_status := 'approved';
    v_vote_status := 'active';

    update bc_vote_proofs
    set status = v_proof_status,
        rejection_reason = null,
        reviewed_at = now(),
        updated_at = now()
    where id = p_proof_id;

    update bc_media_assets
    set moderation_status = 'approved',
        visibility = 'public',
        upload_status = case
          when upload_status = 'uploaded' then 'ready'
          else upload_status
        end,
        updated_at = now()
    where id = v_proof.media_asset_id;
  else
    v_proof_status := 'rejected';
    v_vote_status := 'proof_rejected';

    update bc_vote_proofs
    set status = v_proof_status,
        rejection_reason = p_reason,
        reviewed_at = now(),
        updated_at = now()
    where id = p_proof_id;

    update bc_media_assets
    set moderation_status = 'rejected',
        visibility = 'private',
        updated_at = now()
    where id = v_proof.media_asset_id;
  end if;

  update bc_votes
  set status = v_vote_status,
      updated_at = now()
  where id = v_proof.vote_id;

  select jsonb_build_object(
    'proof_status', p.status,
    'vote_status', v.status,
    'media_upload_status', m.upload_status,
    'media_moderation_status', m.moderation_status,
    'media_visibility', m.visibility
  )
  into v_new_state
  from bc_vote_proofs p
  join bc_votes v on v.id = p.vote_id
  left join bc_media_assets m on m.id = p.media_asset_id
  where p.id = p_proof_id;

  insert into bc_moderation_decisions (
    kind,
    target_id,
    profile_id,
    actor_profile_id,
    decision,
    reason,
    metadata,
    previous_state,
    new_state
  )
  values (
    'vote_proof',
    p_proof_id,
    v_proof.profile_id,
    v_actor_profile_id,
    p_decision,
    p_reason,
    jsonb_build_object('vote_id', v_proof.vote_id, 'submission_id', v_proof.submission_id),
    coalesce(v_previous_state, '{}'::jsonb),
    coalesce(v_new_state, '{}'::jsonb)
  );

  update bc_moderation_queue
  set status = 'decided',
      updated_at = now()
  where kind = 'vote_proof'
    and target_id = p_proof_id;

  return query select p_proof_id, v_proof.vote_id, v_proof_status, v_vote_status, null::text;
end;
$$;

-- Statement-of-reasons helpers (audit H4 / DSA Art. 17,
-- 20260711000006_bestchef_statement_of_reasons.sql). Defined before
-- bc_apply_moderation_decision / bc_resolve_appeal, which call them.

create or replace function public.bc_moderation_reason_category(
  p_reason text,
  p_decision text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when lower(coalesce(p_reason, '')) ~ 'csam|child|minor|exploitat' then 'child_safety'
    when lower(coalesce(p_reason, '')) ~ 'nsfw|sexual|explicit|nudity|porn' then 'sexual_content'
    when lower(coalesce(p_reason, '')) ~ 'hate|harass|abus|threat|bully' then 'harassment'
    when lower(coalesce(p_reason, '')) ~ 'spam|advertis|scam|fraud' then 'spam'
    when lower(coalesce(p_reason, '')) ~ 'violen|gore|graphic' then 'violence'
    when lower(coalesce(p_reason, '')) ~ 'copyright|infring|dmca|stolen|impersonat' then 'intellectual_property'
    when lower(coalesce(p_reason, '')) ~ 'vote|proof|fraud|manipulat|ring|farm' then 'vote_integrity'
    when lower(coalesce(p_reason, '')) ~ 'guideline|rule|policy|off.?topic|irrelevant|quality' then 'guidelines'
    else 'other'
  end;
$$;

grant execute on function public.bc_moderation_reason_category(text, text) to authenticated, service_role;

create or replace function public.bc_notify_moderation_decision(
  p_kind text,
  p_target_id uuid,
  p_target_profile_id uuid,
  p_decision text,
  p_reason text,
  p_appeal_available boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_content_title text;
  v_target_type text;
  v_target_ref text := p_target_id::text;
begin
  if p_target_profile_id is null then
    return;
  end if;

  select user_id into v_user_id
    from public.social_profiles
   where id = p_target_profile_id;

  if v_user_id is null then
    return;
  end if;

  if p_kind = 'submission' then
    v_target_type := 'submission';
    select coalesce(r.title, d.name)
      into v_content_title
      from public.bc_submissions s
      left join public.bc_recipe_snapshots r on r.id = s.recipe_snapshot_id
      left join public.bc_dishes d on d.id = s.dish_id
     where s.id = p_target_id;
  elsif p_kind = 'comment' then
    v_target_type := 'comment';
    select left(c.body, 120)
      into v_content_title
      from public.bc_comments c
     where c.id = p_target_id;
    select s.id::text
      into v_target_ref
      from public.bc_comments c
      join public.bc_submissions s on s.id = c.submission_id
     where c.id = p_target_id;
    if v_target_ref is not null then
      v_target_type := 'submission';
    end if;
  else
    v_target_type := 'submission';
    v_content_title := null;
  end if;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, params, target_type, target_id)
  values
    (v_user_id, 'moderation_decision', 'moderation', '', '',
     jsonb_strip_nulls(jsonb_build_object(
       'content_type', p_kind,
       'content_title', v_content_title,
       'decision', p_decision,
       'reason_category', public.bc_moderation_reason_category(p_reason, p_decision),
       'appeal_available', p_appeal_available
     )),
     v_target_type, v_target_ref);
exception when others then
  null;
end;
$$;

grant execute on function public.bc_notify_moderation_decision(text, uuid, uuid, text, text, boolean)
  to authenticated, service_role;

create or replace function public.bc_notify_appeal_resolved(
  p_appeal_id uuid,
  p_outcome text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile_id uuid;
begin
  select a.profile_id into v_profile_id
    from public.bc_appeals a
   where a.id = p_appeal_id;

  if v_profile_id is null then
    return;
  end if;

  select user_id into v_user_id
    from public.social_profiles
   where id = v_profile_id;

  if v_user_id is null then
    return;
  end if;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, params, target_type, target_id)
  values
    (v_user_id, 'appeal_resolved', 'moderation', '', '',
     jsonb_strip_nulls(jsonb_build_object(
       'outcome', p_outcome,
       'reason_category', public.bc_moderation_reason_category(p_reason, p_outcome)
     )),
     'appeal', p_appeal_id::text);
exception when others then
  null;
end;
$$;

grant execute on function public.bc_notify_appeal_resolved(uuid, text, text)
  to authenticated, service_role;

create or replace function bc_apply_moderation_decision(
  p_kind text,
  p_target_id uuid,
  p_decision text,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
) returns table (
  target_id uuid,
  decision_id uuid,
  previous_state jsonb,
  new_state jsonb,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_actor_profile_id uuid;
  v_target_profile_id uuid;
  v_content_status text;
  v_product_moderation_status text;
  v_previous_state jsonb := '{}'::jsonb;
  v_new_state jsonb := '{}'::jsonb;
  v_vote_result record;
begin
  if not bc_is_admin() then
    return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'not_authorized'::text;
    return;
  end if;

  if p_target_id is null then
    return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_required'::text;
    return;
  end if;

  if v_kind = 'photo' then
    v_kind := 'media_asset';
  end if;

  if v_kind not in (
    'submission',
    'comment',
    'profile',
    'media_asset',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  ) then
    return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'invalid_target_kind'::text;
    return;
  end if;

  if v_decision not in (
    'approved',
    'rejected',
    'hidden',
    'removed',
    'restored',
    'dismissed'
  ) then
    return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'invalid_decision'::text;
    return;
  end if;

  if v_kind = 'vote_proof' then
    if v_decision not in ('approved', 'rejected') then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'invalid_vote_proof_decision'::text;
      return;
    end if;

    select *
    into v_vote_result
    from bc_apply_vote_proof_decision(p_target_id, v_decision, p_reason);

    if v_vote_result.error_code is not null then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, v_vote_result.error_code::text;
      return;
    end if;

    select md.id, md.previous_state, md.new_state
    into decision_id, v_previous_state, v_new_state
    from bc_moderation_decisions md
    where md.kind = 'vote_proof'
      and md.target_id = p_target_id
    order by md.created_at desc
    limit 1;

    if p_metadata is not null and p_metadata <> '{}'::jsonb then
      update bc_moderation_decisions
      set metadata = metadata || p_metadata
      where id = decision_id;
    end if;

    return query select p_target_id, decision_id, v_previous_state, v_new_state, null::text;
    return;
  end if;

  v_actor_profile_id := bc_current_profile_id();

  if v_kind in ('submission', 'comment') then
    v_content_status := case
      when v_decision in ('approved', 'restored') then 'approved'
      when v_decision in ('hidden', 'removed') then 'hidden'
      when v_decision = 'rejected' then 'rejected'
      else null
    end;
  end if;

  if v_kind in ('product_contribution', 'product_evidence', 'media_asset') then
    v_product_moderation_status := case
      when v_decision in ('approved', 'restored') then 'approved'
      when v_decision in ('hidden', 'removed') then 'quarantined'
      when v_decision = 'rejected' then 'rejected'
      else null
    end;
  end if;

  if v_kind = 'submission' then
    select profile_id,
           jsonb_build_object('moderation_status', moderation_status)
    into v_target_profile_id, v_previous_state
    from bc_submissions
    where id = p_target_id
    for update;

    if not found then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_not_found'::text;
      return;
    end if;

    if v_content_status is not null then
      update bc_submissions
      set moderation_status = v_content_status,
          updated_at = now()
      where id = p_target_id
      returning jsonb_build_object('moderation_status', moderation_status, 'updated_at', updated_at)
      into v_new_state;
    else
      v_new_state := v_previous_state;
    end if;
  elsif v_kind = 'comment' then
    select profile_id,
           jsonb_build_object('moderation_status', moderation_status)
    into v_target_profile_id, v_previous_state
    from bc_comments
    where id = p_target_id
    for update;

    if not found then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_not_found'::text;
      return;
    end if;

    if v_content_status is not null then
      update bc_comments
      set moderation_status = v_content_status,
          updated_at = now()
      where id = p_target_id
      returning jsonb_build_object('moderation_status', moderation_status, 'updated_at', updated_at)
      into v_new_state;
    else
      v_new_state := v_previous_state;
    end if;
  elsif v_kind = 'media_asset' then
    select owner_profile_id,
           jsonb_build_object(
             'upload_status', upload_status,
             'moderation_status', moderation_status,
             'visibility', visibility
           )
    into v_target_profile_id, v_previous_state
    from bc_media_assets
    where id = p_target_id
    for update;

    if not found then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_not_found'::text;
      return;
    end if;

    if v_product_moderation_status is not null then
      update bc_media_assets
      set moderation_status = v_product_moderation_status,
          visibility = case
            when v_decision in ('approved', 'restored') then 'public'
            else 'private'
          end,
          upload_status = case
            when v_decision in ('approved', 'restored') and upload_status = 'uploaded' then 'ready'
            else upload_status
          end,
          updated_at = now()
      where id = p_target_id
      returning jsonb_build_object(
        'upload_status', upload_status,
        'moderation_status', moderation_status,
        'visibility', visibility,
        'updated_at', updated_at
      )
      into v_new_state;
    else
      v_new_state := v_previous_state;
    end if;
  elsif v_kind = 'product_contribution' then
    select profile_id,
           jsonb_build_object(
             'status', status,
             'moderation_status', moderation_status
           )
    into v_target_profile_id, v_previous_state
    from bc_product_contributions
    where id = p_target_id
    for update;

    if not found then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_not_found'::text;
      return;
    end if;

    if v_product_moderation_status is not null then
      update bc_product_contributions
      set moderation_status = v_product_moderation_status,
          status = case
            when v_decision in ('approved', 'restored') and status = 'submitted' then 'verified'
            when v_decision in ('rejected', 'removed') and status in ('submitted', 'verified') then 'rejected'
            else status
          end,
          reviewed_by_profile_id = coalesce(v_actor_profile_id, reviewed_by_profile_id),
          moderation_notes = coalesce(p_reason, moderation_notes),
          reviewed_at = now(),
          verified_at = case
            when v_decision in ('approved', 'restored') and status = 'submitted' then now()
            else verified_at
          end,
          rejected_at = case
            when v_decision in ('rejected', 'removed') and status in ('submitted', 'verified') then now()
            else rejected_at
          end,
          updated_at = now()
      where id = p_target_id
      returning jsonb_build_object(
        'status', status,
        'moderation_status', moderation_status,
        'updated_at', updated_at
      )
      into v_new_state;
    else
      v_new_state := v_previous_state;
    end if;
  elsif v_kind = 'product_evidence' then
    select owner_profile_id,
           jsonb_build_object(
             'moderation_status', moderation_status,
             'visibility', visibility
           )
    into v_target_profile_id, v_previous_state
    from bc_product_evidence
    where id = p_target_id
    for update;

    if not found then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_not_found'::text;
      return;
    end if;

    if v_product_moderation_status is not null then
      update bc_product_evidence
      set moderation_status = v_product_moderation_status,
          visibility = case
            when v_decision in ('approved', 'restored')
              and share_opt_in
              and image_consent_status in ('owned_by_user', 'permission_granted', 'public_domain', 'not_required')
              then 'public'
            when v_decision = 'dismissed' then visibility
            else 'private'
          end,
          approved_at = case
            when v_decision in ('approved', 'restored') then coalesce(approved_at, now())
            else approved_at
          end,
          updated_at = now()
      where id = p_target_id
      returning jsonb_build_object(
        'moderation_status', moderation_status,
        'visibility', visibility,
        'updated_at', updated_at
      )
      into v_new_state;
    else
      v_new_state := v_previous_state;
    end if;
  elsif v_kind = 'profile' then
    select id,
           jsonb_build_object(
             'profile_id', id,
             'handle', handle,
             'display_name', display_name
           )
    into v_target_profile_id, v_previous_state
    from social_profiles
    where id = p_target_id;

    if not found then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_not_found'::text;
      return;
    end if;

    v_new_state := v_previous_state || jsonb_build_object('moderation_decision', v_decision);
  end if;

  insert into bc_moderation_decisions (
    kind,
    target_id,
    profile_id,
    actor_profile_id,
    decision,
    reason,
    metadata,
    previous_state,
    new_state
  )
  values (
    v_kind,
    p_target_id,
    v_target_profile_id,
    v_actor_profile_id,
    v_decision,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(v_previous_state, '{}'::jsonb),
    coalesce(v_new_state, '{}'::jsonb)
  )
  returning id into decision_id;

  update bc_moderation_queue mq
  set status = 'decided',
      updated_at = now()
  where mq.kind = v_kind
    and mq.target_id = p_target_id;

  update bc_flags f
  set status = case
        when v_decision in ('approved', 'dismissed') then 'dismissed'
        else 'actioned'
      end,
      resolution = coalesce(p_reason, v_decision),
      updated_at = now()
  where f.target_id = p_target_id
    and (
      f.target_type = v_kind
      or (v_kind = 'media_asset' and f.target_type = 'photo')
    )
    and f.status in ('open', 'noted');

  -- Statement of reasons (audit H4 / DSA Art. 17,
  -- 20260711000006_bestchef_statement_of_reasons.sql). Restrictive decisions
  -- on user content notify the owner. Approvals/restores/dismissals stay
  -- silent; the audit trail already records them.
  if v_decision in ('rejected', 'hidden', 'removed') then
    perform public.bc_notify_moderation_decision(
      v_kind, p_target_id, v_target_profile_id, v_decision, p_reason, true
    );
  end if;

  return query select p_target_id, decision_id, v_previous_state, v_new_state, null::text;
end;
$$;

comment on function bc_report_content(text, uuid, text, uuid) is
  'Authenticated BestChef reporting RPC. Production launch must pair this with edge/API rate limits for report flooding.';
comment on function bc_apply_moderation_decision(text, uuid, text, text, jsonb) is
  'Admin/service moderation decision RPC. Hides, rejects, restores, or dismisses public content while writing audited previous/new state. Restrictive decisions notify the content owner with a statement of reasons (DSA Art. 17).';

grant execute on function bc_current_profile_id() to authenticated, service_role;
grant execute on function bc_get_submission_like_state(uuid) to authenticated, service_role;
grant execute on function bc_set_submission_like(uuid, boolean) to authenticated, service_role;
grant execute on function bc_report_content(text, uuid, text, uuid) to authenticated, service_role;
grant execute on function bc_apply_moderation_decision(text, uuid, text, text, jsonb) to authenticated, service_role;
grant execute on function bc_apply_vote_proof_decision(uuid, text, text) to authenticated, service_role;

-- Beta app hosted submission bridge.

-- Migration 001__dish_visuals.sql mirror (early apply).
-- The seed insert below references gradient_from/gradient_to/emoji, so the
-- columns must exist before the insert runs in a fresh top-to-bottom apply
-- of schema.sql. Mirror migration: cloud/migrations/001__dish_visuals.sql.
alter table public.bc_dishes
  add column if not exists gradient_from text,
  add column if not exists gradient_to text,
  add column if not exists emoji text;

insert into bc_dishes (name, slug, category, cuisine, status, gradient_from, gradient_to, emoji)
values
  ('Pad Thai', 'pad-thai', 'main', 'Thai', 'active', '#F28C33', '#E64D26', '🍜'),
  ('Carbonara', 'carbonara', 'main', 'Italian', 'active', '#F27333', '#A63326', '🍽️'),
  ('Tacos al Pastor', 'tacos-al-pastor', 'main', 'Mexican', 'active', '#F2662E', '#A6401F', '🌮'),
  ('Ramen', 'ramen', 'soup', 'Japanese', 'active', '#EBC766', '#B37333', '🍜'),
  ('Butter Chicken', 'butter-chicken', 'main', 'Indian', 'active', '#EB7326', '#B8401A', '🍛'),
  ('Pho', 'pho', 'soup', 'Vietnamese', 'active', '#B37340', '#7A471F', '🍜'),
  ('Ceviche', 'ceviche', 'appetizer', 'Peruvian', 'active', '#D9664D', '#8C332E', '🐟'),
  ('Bibimbap', 'bibimbap', 'main', 'Korean', 'active', '#F25940', '#B32E26', '🍚'),
  ('Shakshuka', 'shakshuka', 'breakfast', 'Middle Eastern', 'active', '#D98C4D', '#8C4D26', '🍳'),
  ('Tiramisu', 'tiramisu', 'dessert', 'Italian', 'active', '#F27333', '#A63326', '🍰'),
  ('Jollof Rice', 'jollof-rice', 'main', 'West African', 'active', '#F28033', '#B3401F', '🍚'),
  ('Tom Yum', 'tom-yum', 'soup', 'Thai', 'active', '#F28C33', '#E64D26', '🍲'),
  ('Empanadas', 'empanadas', 'appetizer', 'Argentine', 'active', '#8CA6D9', '#4D66A6', '🥟'),
  ('Croissant', 'croissant', 'bread', 'French', 'active', '#F5C773', '#C7803F', '🥐'),
  ('Dumplings', 'dumplings', 'appetizer', 'Chinese', 'active', '#CC4059', '#801F38', '🥟'),
  ('Fish Tacos', 'fish-tacos', 'main', 'Mexican', 'active', '#F2662E', '#A6401F', '🌮'),
  ('Risotto', 'risotto', 'main', 'Italian', 'active', '#F27333', '#A63326', '🍚'),
  ('Banh Mi', 'banh-mi', 'main', 'Vietnamese', 'active', '#B37340', '#7A471F', '🥖'),
  ('Churros', 'churros', 'dessert', 'Spanish', 'active', '#F28C33', '#BF4D26', '🥐'),
  ('Falafel', 'falafel', 'appetizer', 'Middle Eastern', 'active', '#D98C4D', '#8C4D26', '🧆')
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  cuisine = excluded.cuisine,
  status = 'active',
  gradient_from = excluded.gradient_from,
  gradient_to = excluded.gradient_to,
  emoji = excluded.emoji,
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
    coalesce(sum(case tier
      when 'tap_down' then 0
      when 'bronze' then 1
      when 'like' then 1
      when 'tap_up' then 1
      when 'silver' then 3
      when 'gold' then 5
      else 0
    end), 0)::double precision
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

create or replace function bc_refresh_submission_like_count()
returns trigger as $$
declare
  target_submission_id uuid;
begin
  if tg_op = 'DELETE' then
    target_submission_id := old.submission_id;
  else
    target_submission_id := new.submission_id;
  end if;

  update bc_submissions
  set like_count = (
        select count(*)::integer
        from bc_submission_likes
        where submission_id = target_submission_id
      ),
      updated_at = now()
  where id = target_submission_id;

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_get_submission_like_state(p_submission_id uuid)
returns table (
  submission_id uuid,
  like_count integer,
  liked boolean,
  error_code text
) as $$
declare
  v_profile_id uuid;
  v_like_count integer;
  v_liked boolean;
begin
  v_profile_id := bc_current_profile_id();

  if v_profile_id is null then
    return query select p_submission_id, 0::integer, false, 'profile_not_found'::text;
    return;
  end if;

  if not bc_submission_visible(p_submission_id) then
    return query select p_submission_id, 0::integer, false, 'submission_not_found'::text;
    return;
  end if;

  select coalesce(s.like_count, 0)::integer
  into v_like_count
  from bc_submissions s
  where s.id = p_submission_id;

  select exists (
    select 1
    from bc_submission_likes l
    where l.submission_id = p_submission_id
      and l.profile_id = v_profile_id
  ) into v_liked;

  return query select p_submission_id, coalesce(v_like_count, 0), coalesce(v_liked, false), null::text;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_set_submission_like(
  p_submission_id uuid,
  p_liked boolean
)
returns table (
  submission_id uuid,
  like_count integer,
  liked boolean,
  error_code text
) as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := bc_current_profile_id();

  if v_profile_id is null then
    return query select p_submission_id, 0::integer, false, 'profile_not_found'::text;
    return;
  end if;

  if not bc_submission_visible(p_submission_id) then
    return query select p_submission_id, 0::integer, false, 'submission_not_found'::text;
    return;
  end if;

  if p_liked then
    insert into bc_submission_likes (submission_id, profile_id)
    values (p_submission_id, v_profile_id)
    on conflict on constraint bc_submission_likes_unique do nothing;
  else
    delete from bc_submission_likes l
    where l.submission_id = p_submission_id
      and l.profile_id = v_profile_id;
  end if;

  return query select * from bc_get_submission_like_state(p_submission_id);
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
    or new.like_count is distinct from old.like_count
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
drop trigger if exists bc_submission_likes_refresh_count on bc_submission_likes;
create trigger bc_submission_likes_refresh_count after insert or delete on bc_submission_likes
  for each row execute function bc_refresh_submission_like_count();

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
    ranked.submission_id,
    ranked.vote_score,
    ranked.computed_rank,
    null,
    ranked.country_code,
    now()
  from (
    select
      s.id as submission_id,
      s.dish_id,
      s.vote_score,
      s.country_code,
      row_number() over (
        partition by s.dish_id
        order by (s.photo_url is not null and length(s.photo_url) > 0) desc,
                 s.vote_score desc,
                 s.created_at asc
      ) as computed_rank
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

-- Account lifecycle: identity status, deletion requests, and support checks.

create table if not exists bc_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  profile_id uuid references social_profiles(id) on delete set null,
  status text not null default 'requested' check (status in (
    'requested',
    'processing',
    'completed',
    'cancelled',
    'rejected',
    'failed'
  )),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid references social_profiles(id) on delete set null,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on column bc_account_deletion_requests.user_id is
  'Nullable after account deletion so the request row survives auth.users deletion for audit and support verification.';

create index if not exists bc_account_deletion_requests_user_idx
  on bc_account_deletion_requests (user_id, requested_at desc);
create index if not exists bc_account_deletion_requests_profile_idx
  on bc_account_deletion_requests (profile_id, requested_at desc);
create index if not exists bc_account_deletion_requests_status_idx
  on bc_account_deletion_requests (status, requested_at desc);
create unique index if not exists bc_account_deletion_requests_one_open_idx
  on bc_account_deletion_requests (user_id)
  where status in ('requested', 'processing');

create table if not exists bc_account_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references social_profiles(id) on delete set null,
  target_profile_id uuid references social_profiles(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'identity_status_checked',
    'account_deletion_requested',
    'account_deletion_status_changed',
    'profile_owned_row_counted',
    'profile_merge_conflicts_checked'
  )),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bc_account_lifecycle_events_actor_idx
  on bc_account_lifecycle_events (actor_profile_id, created_at desc);
create index if not exists bc_account_lifecycle_events_target_profile_idx
  on bc_account_lifecycle_events (target_profile_id, created_at desc);
create index if not exists bc_account_lifecycle_events_target_user_idx
  on bc_account_lifecycle_events (target_user_id, created_at desc);
create index if not exists bc_account_lifecycle_events_type_idx
  on bc_account_lifecycle_events (event_type, created_at desc);

alter table bc_account_deletion_requests enable row level security;
alter table bc_account_lifecycle_events enable row level security;

drop policy if exists "bc_account_deletion_requests_read" on bc_account_deletion_requests;
create policy "bc_account_deletion_requests_read"
  on bc_account_deletion_requests for select
  using (user_id = auth.uid() or bc_is_admin());

drop policy if exists "bc_account_deletion_requests_insert" on bc_account_deletion_requests;
create policy "bc_account_deletion_requests_insert"
  on bc_account_deletion_requests for insert
  with check (user_id = auth.uid());

drop policy if exists "bc_account_deletion_requests_update" on bc_account_deletion_requests;
create policy "bc_account_deletion_requests_update"
  on bc_account_deletion_requests for update
  using (bc_is_admin())
  with check (bc_is_admin());

drop policy if exists "bc_account_deletion_requests_delete" on bc_account_deletion_requests;
create policy "bc_account_deletion_requests_delete"
  on bc_account_deletion_requests for delete
  using (bc_is_admin());

drop policy if exists "bc_account_lifecycle_events_read" on bc_account_lifecycle_events;
create policy "bc_account_lifecycle_events_read"
  on bc_account_lifecycle_events for select
  using (
    bc_is_admin()
    or target_user_id = auth.uid()
    or bc_profile_owned(actor_profile_id)
    or bc_profile_owned(target_profile_id)
  );

drop policy if exists "bc_account_lifecycle_events_insert" on bc_account_lifecycle_events;
create policy "bc_account_lifecycle_events_insert"
  on bc_account_lifecycle_events for insert
  with check (bc_is_admin());

create or replace function bc_current_identity_status()
returns jsonb as $$
declare
  current_profile social_profiles%rowtype;
  jwt jsonb := auth.jwt();
  anonymous_claim boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into current_profile
  from social_profiles
  where user_id = auth.uid()
  limit 1;

  anonymous_claim := coalesce((jwt->>'is_anonymous')::boolean, false);

  return jsonb_build_object(
    'user_id', auth.uid(),
    'profile_id', current_profile.id,
    'is_anonymous', anonymous_claim,
    'has_profile', current_profile.id is not null,
    'role', coalesce(jwt->'app_metadata'->>'role', 'authenticated'),
    'roles', coalesce(jwt->'app_metadata'->'roles', '[]'::jsonb)
  );
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function bc_request_account_deletion(
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bc_account_deletion_requests as $$
declare
  current_profile_id uuid;
  existing_request bc_account_deletion_requests%rowtype;
  saved_request bc_account_deletion_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id
  into current_profile_id
  from social_profiles
  where user_id = auth.uid()
  limit 1;

  select *
  into existing_request
  from bc_account_deletion_requests
  where user_id = auth.uid()
    and status in ('requested', 'processing')
  order by requested_at desc
  limit 1;

  if found then
    return existing_request;
  end if;

  insert into bc_account_deletion_requests (
    user_id,
    profile_id,
    reason,
    metadata
  )
  values (
    auth.uid(),
    current_profile_id,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into saved_request;

  insert into bc_account_lifecycle_events (
    actor_profile_id,
    target_profile_id,
    target_user_id,
    event_type,
    reason,
    metadata
  )
  values (
    current_profile_id,
    current_profile_id,
    auth.uid(),
    'account_deletion_requested',
    p_reason,
    jsonb_build_object('request_id', saved_request.id)
      || coalesce(p_metadata, '{}'::jsonb)
  );

  return saved_request;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_profile_owned_row_counts(p_profile_id uuid)
returns jsonb as $$
declare
  counts jsonb;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if not (bc_is_admin() or bc_profile_owned(p_profile_id)) then
    raise exception 'Not authorized to inspect this profile';
  end if;

  counts := jsonb_build_object(
    'bc_recipe_snapshots.profile_id', (select count(*) from bc_recipe_snapshots where profile_id = p_profile_id),
    'bc_media_assets.owner_profile_id', (select count(*) from bc_media_assets where owner_profile_id = p_profile_id),
    'bc_product_records.created_by_profile_id', (select count(*) from bc_product_records where created_by_profile_id = p_profile_id),
    'bc_product_records.verified_by_profile_id', (select count(*) from bc_product_records where verified_by_profile_id = p_profile_id),
    'bc_product_contributions.profile_id', (select count(*) from bc_product_contributions where profile_id = p_profile_id),
    'bc_product_contributions.reviewed_by_profile_id', (select count(*) from bc_product_contributions where reviewed_by_profile_id = p_profile_id),
    'bc_product_evidence.owner_profile_id', (select count(*) from bc_product_evidence where owner_profile_id = p_profile_id),
    'bc_submissions.profile_id', (select count(*) from bc_submissions where profile_id = p_profile_id),
    'bc_submission_likes.profile_id', (select count(*) from bc_submission_likes where profile_id = p_profile_id),
    'bc_votes.voter_profile_id', (select count(*) from bc_votes where voter_profile_id = p_profile_id),
    'bc_comments.profile_id', (select count(*) from bc_comments where profile_id = p_profile_id),
    'bc_comment_helpful.voter_profile_id', (select count(*) from bc_comment_helpful where voter_profile_id = p_profile_id),
    'bc_photo_reports.reporter_id', (select count(*) from bc_photo_reports where reporter_id = p_profile_id),
    'bc_flags.flagger_id', (select count(*) from bc_flags where flagger_id = p_profile_id),
    'bc_notes.author_id', (select count(*) from bc_notes where author_id = p_profile_id),
    'bc_note_ratings.rater_id', (select count(*) from bc_note_ratings where rater_id = p_profile_id),
    'bc_chef_badges.profile_id', (select count(*) from bc_chef_badges where profile_id = p_profile_id),
    'bc_creator_applications.profile_id', (select count(*) from bc_creator_applications where profile_id = p_profile_id),
    'bc_tips.tipper_id', (select count(*) from bc_tips where tipper_id = p_profile_id),
    'bc_tips.chef_id', (select count(*) from bc_tips where chef_id = p_profile_id),
    'bc_subscription_tiers.chef_id', (select count(*) from bc_subscription_tiers where chef_id = p_profile_id),
    'bc_subscriptions.subscriber_id', (select count(*) from bc_subscriptions where subscriber_id = p_profile_id),
    'bc_subscriptions.chef_id', (select count(*) from bc_subscriptions where chef_id = p_profile_id),
    'bc_posts.author_id', (select count(*) from bc_posts where author_id = p_profile_id),
    'bc_recipe_forks.forked_by_profile_id', (select count(*) from bc_recipe_forks where forked_by_profile_id = p_profile_id),
    'bc_affiliate_orders.chef_id', (select count(*) from bc_affiliate_orders where chef_id = p_profile_id),
    'bc_hubs.owner_profile_id', (select count(*) from bc_hubs where owner_profile_id = p_profile_id),
    'bc_submission_aliases.created_by_profile_id', (select count(*) from bc_submission_aliases where created_by_profile_id = p_profile_id)
  );

  insert into bc_account_lifecycle_events (
    actor_profile_id,
    target_profile_id,
    target_user_id,
    event_type,
    metadata
  )
  select
    viewer.id,
    p_profile_id,
    auth.uid(),
    'profile_owned_row_counted',
    counts
  from social_profiles viewer
  where viewer.user_id = auth.uid()
  limit 1;

  return counts;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_profile_merge_conflicts(
  p_source_profile_id uuid,
  p_target_profile_id uuid
)
returns jsonb as $$
declare
  conflicts jsonb;
begin
  if not bc_is_admin() then
    raise exception 'Not authorized to inspect profile merge conflicts';
  end if;

  if p_source_profile_id is null or p_target_profile_id is null then
    raise exception 'Source and target profile ids are required';
  end if;

  conflicts := jsonb_build_object(
    'bc_submission_likes.same_submission', (
      select count(*)
      from bc_submission_likes source_like
      where source_like.profile_id = p_source_profile_id
        and exists (
          select 1
          from bc_submission_likes target_like
          where target_like.submission_id = source_like.submission_id
            and target_like.profile_id = p_target_profile_id
        )
    ),
    'bc_votes.same_submission', (
      select count(*)
      from bc_votes source_vote
      where source_vote.voter_profile_id = p_source_profile_id
        and exists (
          select 1
          from bc_votes target_vote
          where target_vote.submission_id = source_vote.submission_id
            and target_vote.voter_profile_id = p_target_profile_id
        )
    ),
    'bc_comment_helpful.same_comment', (
      select count(*)
      from bc_comment_helpful source_helpful
      where source_helpful.voter_profile_id = p_source_profile_id
        and exists (
          select 1
          from bc_comment_helpful target_helpful
          where target_helpful.comment_id = source_helpful.comment_id
            and target_helpful.voter_profile_id = p_target_profile_id
        )
    ),
    'bc_note_ratings.same_note', (
      select count(*)
      from bc_note_ratings source_rating
      where source_rating.rater_id = p_source_profile_id
        and exists (
          select 1
          from bc_note_ratings target_rating
          where target_rating.note_id = source_rating.note_id
            and target_rating.rater_id = p_target_profile_id
        )
    ),
    'bc_chef_badges.same_badge', (
      select count(*)
      from bc_chef_badges source_badge
      where source_badge.profile_id = p_source_profile_id
        and exists (
          select 1
          from bc_chef_badges target_badge
          where target_badge.badge_id = source_badge.badge_id
            and target_badge.profile_id = p_target_profile_id
        )
    )
  );

  insert into bc_account_lifecycle_events (
    target_profile_id,
    target_user_id,
    event_type,
    metadata
  )
  values (
    p_source_profile_id,
    auth.uid(),
    'profile_merge_conflicts_checked',
    jsonb_build_object(
      'source_profile_id', p_source_profile_id,
      'target_profile_id', p_target_profile_id,
      'conflicts', conflicts
    )
  );

  return conflicts;
end;
$$ language plpgsql security definer set search_path = public;

-- Final-state overrides for 20260427000008 when this schema mirror is executed
-- top-to-bottom after older function definitions.

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
    coalesce(sum(case tier
      when 'tap_down' then 0
      when 'bronze' then 1
      when 'like' then 1
      when 'tap_up' then 1
      when 'silver' then 3
      when 'gold' then 5
      else 0
    end), 0)::double precision
  into n, weighted_sum
  from bc_votes
  where submission_id = p_submission_id
    and status = 'active';

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

create or replace function bc_submit_vote(
  p_submission_id uuid,
  p_voter_profile_id uuid,
  p_tier integer
)
returns bc_votes as $$
begin
  raise exception 'Vote proof is required. Use bc_cast_vote with a proof media asset.';
end;
$$ language plpgsql security definer set search_path = public;

-- ── P1-A additions ────────────────────────────────────────────────────

-- Notifications activity feed
create table if not exists public.bc_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'upvote','reviewed_vote','rank_up','rank_milestone','follow',
    'comment','mention','badge','competition','system',
    'moderation_decision','appeal_resolved'
  )),
  category text not null check (category in ('votes','ranks','social','system','moderation')),
  title text not null,
  body text not null default '',
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  actor_color text,
  target_type text check (target_type in ('submission','chef','dish','badge','challenge','comment','appeal') or target_type is null),
  target_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists bc_notifications_user_unread on public.bc_notifications (user_id, is_read, created_at desc);
alter table public.bc_notifications enable row level security;
-- Inserts go through SECURITY DEFINER fanout fns only (P1-C).

-- Followers graph
create table if not exists public.bc_followers (
  follower_id uuid not null references public.social_profiles(id) on delete cascade,
  chef_id uuid not null references public.social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, chef_id),
  check (follower_id <> chef_id)
);
create index if not exists bc_followers_chef_idx on public.bc_followers (chef_id, created_at desc);
create index if not exists bc_followers_follower_idx on public.bc_followers (follower_id, created_at desc);
alter table public.bc_followers enable row level security;

-- Rank history (sparkline)
create table if not exists public.bc_rank_history (
  chef_id uuid not null references public.social_profiles(id) on delete cascade,
  week date not null,
  rank int not null,
  total_chefs int not null,
  primary key (chef_id, week)
);
alter table public.bc_rank_history enable row level security;

-- Provider cost control: durable usage ledger + global cap + kill switch (N-28 / OPS-09).
create table if not exists public.bc_provider_usage (
  id bigint generated always as identity primary key,
  user_id text not null,
  fn text not null,
  called_at timestamptz not null default now(),
  usage_day date not null default (now() at time zone 'utc')::date
);
alter table public.bc_provider_usage enable row level security;

create table if not exists public.bc_provider_controls (
  id boolean primary key default true check (id),
  kill_switch boolean not null default false,
  global_daily_cap integer not null default 50000 check (global_daily_cap >= 0),
  updated_at timestamptz not null default now()
);
alter table public.bc_provider_controls enable row level security;

-- Scheduled-job configuration (functions base URL + worker secret per environment).
create table if not exists public.bc_job_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.bc_job_config enable row level security;

-- Block-list (Guideline 1.2): a profile blocks another; blocked content is hidden from the blocker.
create table if not exists public.bc_blocks (
  blocker_id uuid not null references public.social_profiles(id) on delete cascade,
  blocked_id uuid not null references public.social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists bc_blocks_blocker_idx on public.bc_blocks (blocker_id, created_at desc);
create index if not exists bc_blocks_blocked_idx on public.bc_blocks (blocked_id);
alter table public.bc_blocks enable row level security;

-- Mirror parity (DATA-01): tables present in active migrations but previously missing here.
create table if not exists public.bc_handle_history (
  handle text not null,
  released_at timestamptz not null default now(),
  primary key (handle, released_at)
);
alter table public.bc_handle_history enable row level security;

create table if not exists public.bc_submission_sync_queue (
  local_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  last_error text,
  attempt_count int not null default 0,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.bc_submission_sync_queue enable row level security;

create table if not exists public.bc_pending_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  attempt_count int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  synced boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.bc_pending_reports enable row level security;

create table if not exists public.bc_custom_themes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_overrides jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table public.bc_custom_themes enable row level security;

create table if not exists public.bc_challenges (
  id uuid primary key default gen_random_uuid(),
  template_id text not null,
  title text not null,
  description text not null default '',
  reward text not null default '',
  badge_id text,
  metric text not null default 'submissions',
  target_count integer not null default 1,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  claim_deadline timestamptz,
  status text not null default 'active'
    check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  constraint bc_challenges_target_positive check (target_count > 0)
);
alter table public.bc_challenges enable row level security;

create table if not exists public.bc_challenge_enrollments (
  challenge_id uuid not null references public.bc_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  reward_claimed_at timestamptz,
  primary key (challenge_id, user_id)
);
alter table public.bc_challenge_enrollments enable row level security;

-- EULA / Terms acceptance record (Guideline 1.2 + GDPR consent audit).
create table if not exists public.bc_terms_acceptance (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.social_profiles(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'mobile' check (source in ('mobile', 'web')),
  unique (profile_id, terms_version)
);
alter table public.bc_terms_acceptance enable row level security;

revoke all on function bc_submit_vote(uuid, uuid, integer) from public, anon, authenticated;

-- ===========================================================================
-- Integrity floor (migration 20260703000002): durable action quotas, per-user
-- global proof-hash ledger, delete throttle + recast cooldown, server-side
-- block enforcement (plan 33 Phase 1.2 + 1.5, findings N3 + N13).
-- Appended verbatim from the migration; later definitions supersede earlier
-- ones above, matching how the live database ends up.
-- ===========================================================================

-- BestChef trust/safety integrity floor (plan 33 Phase 1.2 + 1.5, findings N3 + N13).
--
-- What this closes, in one migration because the pieces share the same functions:
--   1. Proof-of-cook dedup was per-submission (unique(submission_id, content_hash)):
--      one staged photo could justify weighted votes on unlimited submissions.
--      Now a durable per-user GLOBAL ledger (bc_proof_hash_ledger) owns dedup, and
--      it survives vote deletion, so delete+recast churn never frees a hash.
--   2. Cross-user hash reuse (vote rings sharing one photo) flags the proof's
--      moderation-queue row instead of passing silently.
--   3. bc_delete_vote was free and unthrottled. Now a durable daily cap, and each
--      delete stamps bc_action_usage with the submission context so bc_cast_vote
--      can enforce a 24h recast cooldown (recasts also re-enter moderation because
--      new votes are always 'proof_pending').
--   4. Votes, comments, reports, follows, likes, and media uploads get durable
--      rate limits through one bc_consume_action_quota() engine in the CHF-1
--      pattern (ledger + caps table + kill switch), enforced server-side inside
--      the write RPCs and BEFORE INSERT triggers -- never in the client. Triggers
--      (not client-visible RPC swaps) keep existing TestFlight clients working.
--   5. Blocks become server-enforced (N13): bc_blocked_between() feeds
--      bc_submission_visible(), the submission/comment read policies, the vote
--      path, the comment path, and the follow path. Previously bc_blocks was
--      client-side filtering only; a blocked user's content stayed API-readable.
--
-- Ops levers (service-role SQL):
--   update bc_action_controls set kill_switch = true;        -- freeze rate-limited social writes
--   update bc_action_limits set max_count = ... where action = '...';
--   select bc_job_health();                                   -- now also reports quota engine state

-- ---------------------------------------------------------------------------
-- 1. Block enforcement helpers + read-side policies (N13)
-- ---------------------------------------------------------------------------

-- True when either profile has blocked the other. SECURITY DEFINER because
-- bc_blocks RLS intentionally hides "who blocked me" from the blocked party;
-- enforcement still needs to see both directions. Not client-callable (a user
-- could otherwise probe "has X blocked me?").
create or replace function public.bc_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when a is null or b is null or a = b then false
    else exists (
      select 1
      from public.bc_blocks
      where (blocker_id = a and blocked_id = b)
         or (blocker_id = b and blocked_id = a)
    )
  end;
$$;

revoke all on function public.bc_blocked_between(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bc_blocked_between(uuid, uuid) to service_role;

-- v2: block-aware. Owners always see their own rows; admins bypass; everyone
-- else sees approved submissions only when no block exists in either direction
-- between the viewer and the author. Anonymous viewers have no profile, so
-- bc_blocked_between(null, ...) = false and visibility is unchanged for them.
create or replace function public.bc_submission_visible(submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bc_submissions s
    where s.id = submission_id
      and (
        bc_profile_owned(s.profile_id)
        or (
          s.moderation_status = 'approved'
          and (
            bc_is_admin()
            or not public.bc_blocked_between(public.bc_current_profile_id(), s.profile_id)
          )
        )
      )
  );
$$;

-- The base-table read policy must match the helper, or blocked content stays
-- reachable by querying bc_submissions directly.
drop policy if exists "bc_submissions_read" on public.bc_submissions;
create policy "bc_submissions_read" on public.bc_submissions for select using (
  bc_profile_owned(profile_id)
  or (
    moderation_status = 'approved'
    and (
      bc_is_admin()
      or not public.bc_blocked_between(public.bc_current_profile_id(), profile_id)
    )
  )
);

-- Comments: hide a blocked author's comments too (the submission-level check
-- above only covers the submission author).
drop policy if exists "bc_comments_read" on public.bc_comments;
create policy "bc_comments_read" on public.bc_comments for select using (
  bc_profile_owned(profile_id)
  or (
    moderation_status = 'approved'
    and bc_submission_visible(submission_id)
    and (
      bc_is_admin()
      or not public.bc_blocked_between(public.bc_current_profile_id(), profile_id)
    )
  )
);

-- ---------------------------------------------------------------------------
-- 2. Durable action-quota engine (N3, CHF-1 pattern)
-- ---------------------------------------------------------------------------

create table if not exists public.bc_action_limits (
  action text primary key,
  max_count integer not null check (max_count >= 0),
  window_seconds integer not null check (window_seconds > 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.bc_action_limits enable row level security;
-- No anon/authenticated policies: service-role/definer only.

insert into public.bc_action_limits (action, max_count, window_seconds) values
  ('vote',         25,  3600),
  ('vote_delete',   5, 86400),
  ('comment',      20,  3600),
  ('report',       20, 86400),
  ('follow',       60,  3600),
  ('like',        200,  3600),
  ('media_upload', 40, 86400)
on conflict (action) do nothing;

create table if not exists public.bc_action_controls (
  id boolean primary key default true check (id),
  kill_switch boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.bc_action_controls (id) values (true) on conflict (id) do nothing;
alter table public.bc_action_controls enable row level security;

-- Usage ledger. FK cascade means account deletion erases a user's action
-- history (GDPR posture matches the rest of the bc_ ledgers).
create table if not exists public.bc_action_usage (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.social_profiles(id) on delete cascade,
  action text not null,
  context uuid,
  called_at timestamptz not null default now()
);
create index if not exists bc_action_usage_profile_action_idx
  on public.bc_action_usage (profile_id, action, called_at desc);
create index if not exists bc_action_usage_called_at_idx
  on public.bc_action_usage (called_at);
alter table public.bc_action_usage enable row level security;

-- Atomic check-and-log. Denials are not logged (they consume nothing).
-- A missing/disabled bc_action_limits row means "no cap configured": the call
-- is allowed and still logged, so observability survives a deleted config row
-- instead of silently disabling enforcement (the N5 lesson). bc_job_health()
-- reports the seeded-row count so a gap is visible.
create or replace function public.bc_consume_action_quota(
  p_profile_id uuid,
  p_action text,
  p_context uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kill boolean;
  v_max integer;
  v_window integer;
  v_has_limit boolean := false;
  v_count integer;
begin
  if p_profile_id is null or nullif(trim(coalesce(p_action, '')), '') is null then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_request');
  end if;

  select kill_switch into v_kill from public.bc_action_controls where id = true;
  if coalesce(v_kill, false) then
    return jsonb_build_object('allowed', false, 'reason', 'kill_switch');
  end if;

  select max_count, window_seconds into v_max, v_window
  from public.bc_action_limits
  where action = p_action and enabled;
  if found then
    v_has_limit := true;
    select count(*) into v_count
    from public.bc_action_usage
    where profile_id = p_profile_id
      and action = p_action
      and called_at > now() - make_interval(secs => greatest(v_window, 1));
    if v_count >= v_max then
      return jsonb_build_object('allowed', false, 'reason', 'rate_limited');
    end if;
  end if;

  insert into public.bc_action_usage (profile_id, action, context)
  values (p_profile_id, p_action, p_context);
  return jsonb_build_object(
    'allowed', true,
    'reason', case when v_has_limit then 'ok' else 'no_limit' end
  );
end;
$$;

revoke all on function public.bc_consume_action_quota(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.bc_consume_action_quota(uuid, text, uuid) to service_role;

-- Ledger hygiene: nothing reads usage older than the largest window (24h);
-- 35 days keeps a generous forensic tail without unbounded growth.
create or replace function public.bc_prune_action_usage()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.bc_action_usage
  where called_at < now() - interval '35 days';
$$;

revoke all on function public.bc_prune_action_usage() from public, anon, authenticated;
grant execute on function public.bc_prune_action_usage() to service_role;

-- ---------------------------------------------------------------------------
-- 3. Per-user global proof-hash ledger (N3)
-- ---------------------------------------------------------------------------

-- One content hash may back at most ONE vote per user, ever, across all
-- submissions. Rows intentionally outlive the vote/proof (vote deletion does
-- not free the hash); account deletion cascades the user's rows away.
create table if not exists public.bc_proof_hash_ledger (
  profile_id uuid not null references public.social_profiles(id) on delete cascade,
  content_hash text not null,
  first_vote_id uuid,
  first_submission_id uuid,
  created_at timestamptz not null default now(),
  primary key (profile_id, content_hash)
);
create index if not exists bc_proof_hash_ledger_hash_idx
  on public.bc_proof_hash_ledger (content_hash);
alter table public.bc_proof_hash_ledger enable row level security;
-- No anon/authenticated policies: definer-path only.

-- Backfill from every proof that exists today (any status): hashes already
-- spent stay spent.
insert into public.bc_proof_hash_ledger
  (profile_id, content_hash, first_vote_id, first_submission_id, created_at)
select profile_id, content_hash, vote_id, submission_id, created_at
from public.bc_vote_proofs
on conflict (profile_id, content_hash) do nothing;

-- ---------------------------------------------------------------------------
-- 4. bc_cast_vote v4: block check, recast cooldown, durable quota,
--    global hash dedup, cross-user reuse flag
-- ---------------------------------------------------------------------------

create or replace function public.bc_cast_vote(
  p_submission_id uuid,
  p_tier text,
  p_media_asset_id uuid
) returns table (
  vote_id uuid,
  proof_id uuid,
  status text,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_author_profile_id uuid;
  v_asset public.bc_media_assets%rowtype;
  v_existing_vote_id uuid;
  v_vote_id uuid;
  v_proof_id uuid;
  v_quota jsonb;
  v_hash_reuse integer := 0;
begin
  if v_user_id is null then
    return query select null::uuid, null::uuid, null::text, 'unauthenticated'::text;
    return;
  end if;

  select id
    into v_profile_id
    from public.social_profiles
   where user_id = v_user_id
   limit 1;

  if v_profile_id is null then
    return query select null::uuid, null::uuid, null::text, 'profile_not_found'::text;
    return;
  end if;

  if p_tier not in ('gold', 'silver', 'bronze', 'like') then
    return query select null::uuid, null::uuid, null::text, 'invalid_tier'::text;
    return;
  end if;

  select s.profile_id
    into v_author_profile_id
    from public.bc_submissions s
   where s.id = p_submission_id
     and s.moderation_status = 'approved';

  if v_author_profile_id is null then
    return query select null::uuid, null::uuid, null::text, 'submission_not_found'::text;
    return;
  end if;

  -- Server-side block enforcement (N13). Indistinguishable from a missing
  -- submission on purpose: do not reveal blocks.
  if public.bc_blocked_between(v_profile_id, v_author_profile_id) then
    return query select null::uuid, null::uuid, null::text, 'submission_not_found'::text;
    return;
  end if;

  select *
    into v_asset
    from public.bc_media_assets
   where id = p_media_asset_id;

  if not found
     or v_asset.owner_profile_id is distinct from v_profile_id
     or v_asset.media_kind <> 'image'
     or v_asset.upload_status <> 'uploaded'
     or v_asset.owner_kind <> 'vote_proof'
     or nullif(trim(coalesce(v_asset.content_hash, '')), '') is null then
    return query select null::uuid, null::uuid, null::text, 'invalid_proof_asset'::text;
    return;
  end if;

  if v_author_profile_id = v_profile_id then
    return query select null::uuid, null::uuid, null::text, 'cannot_vote_on_own'::text;
    return;
  end if;

  select id
    into v_existing_vote_id
    from public.bc_votes
   where submission_id = p_submission_id
     and voter_profile_id = v_profile_id
   limit 1;

  if v_existing_vote_id is not null then
    return query select v_existing_vote_id, null::uuid, null::text, 'vote_already_exists'::text;
    return;
  end if;

  -- Recast cooldown: deleting a vote on this submission starts a 24h clock
  -- before a new vote is accepted (and the new vote re-enters moderation as
  -- 'proof_pending' like every vote).
  if exists (
    select 1
    from public.bc_action_usage u
    where u.profile_id = v_profile_id
      and u.action = 'vote_delete'
      and u.context = p_submission_id
      and u.called_at > now() - interval '24 hours'
  ) then
    return query select null::uuid, null::uuid, null::text, 'recast_cooldown'::text;
    return;
  end if;

  -- Durable rate limit, consumed only after all validation passes.
  v_quota := public.bc_consume_action_quota(v_profile_id, 'vote', p_submission_id);
  if not coalesce((v_quota ->> 'allowed')::boolean, false) then
    return query select null::uuid, null::uuid, null::text, 'rate_limited'::text;
    return;
  end if;

  -- Cross-user reuse count BEFORE we insert our own ledger row.
  select count(*)
    into v_hash_reuse
    from public.bc_proof_hash_ledger l
   where l.content_hash = v_asset.content_hash
     and l.profile_id <> v_profile_id;

  insert into public.bc_votes (
    id,
    submission_id,
    voter_profile_id,
    tier,
    status,
    updated_at
  )
  values (
    gen_random_uuid(),
    p_submission_id,
    v_profile_id,
    p_tier,
    'proof_pending',
    now()
  )
  returning id into v_vote_id;

  -- Per-user GLOBAL dedup: one hash, one vote, ever (N3).
  begin
    insert into public.bc_proof_hash_ledger
      (profile_id, content_hash, first_vote_id, first_submission_id)
    values
      (v_profile_id, v_asset.content_hash, v_vote_id, p_submission_id);
  exception
    when unique_violation then
      delete from public.bc_votes where id = v_vote_id;
      return query select null::uuid, null::uuid, null::text, 'proof_duplicate'::text;
      return;
  end;

  begin
    insert into public.bc_vote_proofs (
      id,
      vote_id,
      submission_id,
      profile_id,
      media_asset_id,
      content_hash,
      status
    )
    values (
      gen_random_uuid(),
      v_vote_id,
      p_submission_id,
      v_profile_id,
      p_media_asset_id,
      v_asset.content_hash,
      'pending'
    )
    returning id into v_proof_id;
  exception
    when unique_violation then
      -- (submission_id, content_hash) collision: another user already used
      -- this exact photo on this submission. Roll our rows back.
      delete from public.bc_proof_hash_ledger
       where profile_id = v_profile_id
         and content_hash = v_asset.content_hash
         and first_vote_id = v_vote_id;
      delete from public.bc_votes where id = v_vote_id;
      return query select null::uuid, null::uuid, null::text, 'proof_duplicate'::text;
      return;
  end;

  insert into public.bc_moderation_queue (
    kind,
    target_id,
    profile_id,
    status,
    metadata
  )
  values (
    'vote_proof',
    v_proof_id,
    v_profile_id,
    'queued',
    jsonb_build_object(
      'submission_id', p_submission_id,
      'media_asset_id', p_media_asset_id
    )
    || case
         when v_hash_reuse > 0 then jsonb_build_object(
           'cross_user_hash_reuse', true,
           'hash_reuse_other_profiles', v_hash_reuse
         )
         else '{}'::jsonb
       end
  )
  on conflict (kind, target_id) do update
    set status = 'queued',
        profile_id = excluded.profile_id,
        metadata = excluded.metadata,
        updated_at = now();

  return query select v_vote_id, v_proof_id, 'pending'::text, null::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. bc_delete_vote v3: durable daily throttle + recast-cooldown stamp
-- ---------------------------------------------------------------------------

create or replace function public.bc_delete_vote(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_media_asset_id uuid;
  v_deleted_at timestamptz := now();
  v_max integer;
  v_window integer;
  v_recent integer;
  v_deleted integer;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select id
  into v_profile_id
  from social_profiles
  where user_id = v_user_id
  limit 1;

  if v_profile_id is null then
    raise exception 'profile_not_found';
  end if;

  -- Durable throttle (N3). Checked manually (not bc_consume_action_quota)
  -- because usage must be stamped only when a vote actually gets deleted, and
  -- the kill switch must not stop users removing their own content.
  select max_count, window_seconds into v_max, v_window
  from public.bc_action_limits
  where action = 'vote_delete' and enabled;
  if found then
    select count(*) into v_recent
    from public.bc_action_usage
    where profile_id = v_profile_id
      and action = 'vote_delete'
      and called_at > now() - make_interval(secs => greatest(v_window, 1));
    if v_recent >= v_max then
      raise exception 'vote_delete_rate_limited';
    end if;
  end if;

  select p.media_asset_id
  into v_media_asset_id
  from bc_votes v
  join bc_vote_proofs p on p.vote_id = v.id
  where v.submission_id = p_submission_id
    and v.voter_profile_id = v_profile_id
  limit 1;

  delete from bc_votes
  where submission_id = p_submission_id
    and voter_profile_id = v_profile_id;
  get diagnostics v_deleted = row_count;

  -- Stamp only real deletions: powers both the daily cap and the 24h recast
  -- cooldown in bc_cast_vote. The hash stays spent in bc_proof_hash_ledger.
  if v_deleted > 0 then
    insert into public.bc_action_usage (profile_id, action, context)
    values (v_profile_id, 'vote_delete', p_submission_id);
  end if;

  if v_media_asset_id is not null then
    update bc_media_assets
    set upload_status = 'deleted',
        moderation_status = 'rejected',
        visibility = 'private',
        metadata = metadata || jsonb_build_object(
          'deleted_by', 'bc_delete_vote',
          'deleted_at', v_deleted_at,
          'deletion_reason', 'user_deleted_vote',
          'storage_purge', 'pending_server_worker'
        ),
        updated_at = v_deleted_at
    where id = v_media_asset_id
      and owner_profile_id = v_profile_id
      and owner_kind = 'vote_proof';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Enforcement triggers on the remaining write paths
--    (triggers, not RPC swaps: every path is covered, including the direct
--    table writes existing TestFlight clients already ship.)
-- ---------------------------------------------------------------------------

-- Generic quota trigger: tg_argv[0] = action, tg_argv[1] = profile-id column.
create or replace function public.bc_enforce_action_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := tg_argv[0];
  v_profile_id uuid;
  v_quota jsonb;
begin
  -- Server contexts (migrations, workers) and admins bypass.
  if auth.uid() is null or bc_is_admin() then
    return new;
  end if;
  v_profile_id := (to_jsonb(new) ->> tg_argv[1])::uuid;
  if v_profile_id is null then
    return new;
  end if;
  v_quota := public.bc_consume_action_quota(v_profile_id, v_action, null);
  if not coalesce((v_quota ->> 'allowed')::boolean, false) then
    raise exception 'rate_limited' using
      errcode = 'P0001',
      detail = v_action,
      hint = coalesce(v_quota ->> 'reason', 'rate_limited');
  end if;
  return new;
end;
$$;

-- Comments need more than a cap: the submission must be approved and visible
-- to the commenter, blocks must hold (N13), and threaded replies must stay on
-- their own submission.
create or replace function public.bc_comments_enforce_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_profile_id uuid;
  v_quota jsonb;
begin
  if auth.uid() is null or bc_is_admin() then
    return new;
  end if;

  select s.profile_id
    into v_author_profile_id
    from public.bc_submissions s
   where s.id = new.submission_id
     and s.moderation_status = 'approved';

  if v_author_profile_id is null then
    raise exception 'submission_not_found' using errcode = 'P0001';
  end if;

  if public.bc_blocked_between(new.profile_id, v_author_profile_id) then
    -- Indistinguishable from a missing submission: do not reveal blocks.
    raise exception 'submission_not_found' using errcode = 'P0001';
  end if;

  if new.parent_id is not null and not exists (
    select 1
    from public.bc_comments c
    where c.id = new.parent_id
      and c.submission_id = new.submission_id
  ) then
    raise exception 'invalid_parent' using errcode = 'P0001';
  end if;

  v_quota := public.bc_consume_action_quota(new.profile_id, 'comment', new.submission_id);
  if not coalesce((v_quota ->> 'allowed')::boolean, false) then
    raise exception 'rate_limited' using
      errcode = 'P0001',
      detail = 'comment',
      hint = coalesce(v_quota ->> 'reason', 'rate_limited');
  end if;

  return new;
end;
$$;

-- Follows: social_follows is suite-shared, but BestChef is the only public
-- social surface; the cap is generous and admins/server contexts bypass.
-- Also block-enforced: you cannot follow across a block in either direction.
create or replace function public.bc_social_follows_enforce()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quota jsonb;
begin
  if auth.uid() is null or bc_is_admin() then
    return new;
  end if;

  if public.bc_blocked_between(new.follower_id, new.followee_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  v_quota := public.bc_consume_action_quota(new.follower_id, 'follow', new.followee_id);
  if not coalesce((v_quota ->> 'allowed')::boolean, false) then
    raise exception 'rate_limited' using
      errcode = 'P0001',
      detail = 'follow',
      hint = coalesce(v_quota ->> 'reason', 'rate_limited');
  end if;

  return new;
end;
$$;

drop trigger if exists bc_comments_integrity_gate on public.bc_comments;
create trigger bc_comments_integrity_gate
  before insert on public.bc_comments
  for each row execute function public.bc_comments_enforce_integrity();

drop trigger if exists bc_flags_action_quota on public.bc_flags;
create trigger bc_flags_action_quota
  before insert on public.bc_flags
  for each row execute function public.bc_enforce_action_quota('report', 'flagger_id');

drop trigger if exists bc_submission_likes_action_quota on public.bc_submission_likes;
create trigger bc_submission_likes_action_quota
  before insert on public.bc_submission_likes
  for each row execute function public.bc_enforce_action_quota('like', 'profile_id');

drop trigger if exists bc_photo_reports_action_quota on public.bc_photo_reports;
create trigger bc_photo_reports_action_quota
  before insert on public.bc_photo_reports
  for each row execute function public.bc_enforce_action_quota('report', 'reporter_id');

drop trigger if exists bc_comment_helpful_action_quota on public.bc_comment_helpful;
create trigger bc_comment_helpful_action_quota
  before insert on public.bc_comment_helpful
  for each row execute function public.bc_enforce_action_quota('like', 'voter_profile_id');

drop trigger if exists bc_social_follows_gate on public.social_follows;
create trigger bc_social_follows_gate
  before insert on public.social_follows
  for each row execute function public.bc_social_follows_enforce();

-- ---------------------------------------------------------------------------
-- 7. Ledger prune job + job-health v2 (quota engine observability)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'bestchef-prune-action-usage',
      '41 3 * * *',
      $job$select public.bc_prune_action_usage();$job$
    );
  else
    raise notice 'pg_cron not installed: bestchef-prune-action-usage not scheduled.';
  end if;
exception when others then
  raise notice 'BestChef prune job scheduling skipped: %', sqlerrm;
end $$;

create or replace function public.bc_job_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_url boolean;
  v_has_secret boolean;
  v_pg_cron boolean;
  v_pg_net boolean;
  v_rankings_job boolean;
  v_deletion_job boolean;
  v_prune_job boolean;
  v_last_rankings_update timestamptz;
  v_pending_deletions bigint;
  v_oldest_pending timestamptz;
  v_action_limits bigint;
  v_action_kill boolean;
begin
  select exists (select 1 from public.bc_job_config where key = 'functions_base_url')
    into v_has_url;
  select exists (select 1 from public.bc_job_config where key = 'account_deletion_worker_secret')
    into v_has_secret;
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_pg_cron;
  select exists (select 1 from pg_extension where extname = 'pg_net') into v_pg_net;

  v_rankings_job := false;
  v_deletion_job := false;
  v_prune_job := false;
  if v_pg_cron then
    begin
      select
        exists (select 1 from cron.job where jobname = 'bestchef-rebuild-rankings'),
        exists (select 1 from cron.job where jobname = 'bestchef-account-deletion-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-prune-action-usage')
        into v_rankings_job, v_deletion_job, v_prune_job;
    exception when others then
      -- cron schema unreadable: report unscheduled rather than erroring out.
      v_rankings_job := false;
      v_deletion_job := false;
      v_prune_job := false;
    end;
  end if;

  select max(updated_at) from public.bc_rankings into v_last_rankings_update;

  select count(*), min(requested_at)
    from public.bc_account_deletion_requests
    where status in ('requested', 'processing')
    into v_pending_deletions, v_oldest_pending;

  select count(*) from public.bc_action_limits where enabled into v_action_limits;
  select kill_switch from public.bc_action_controls where id = true into v_action_kill;

  return jsonb_build_object(
    'config_functions_base_url', v_has_url,
    'config_worker_secret', v_has_secret,
    'pg_cron_installed', v_pg_cron,
    'pg_net_installed', v_pg_net,
    'rankings_job_scheduled', v_rankings_job,
    'deletion_job_scheduled', v_deletion_job,
    'action_usage_prune_job_scheduled', v_prune_job,
    'last_rankings_update', v_last_rankings_update,
    'pending_deletion_requests', v_pending_deletions,
    'oldest_pending_deletion_requested_at', v_oldest_pending,
    'action_limits_enabled_rows', v_action_limits,
    'action_kill_switch', coalesce(v_action_kill, false),
    'healthy',
      v_has_url and v_has_secret and v_pg_cron and v_pg_net
      and v_rankings_job and v_deletion_job and v_prune_job
      and v_action_limits > 0 and not coalesce(v_action_kill, false),
    'checked_at', now()
  );
end;
$$;

revoke all on function public.bc_job_health() from public, anon, authenticated;
grant execute on function public.bc_job_health() to service_role;

-- Moderation appeals (migration 20260703000003, plan 33 Phase 1.7 / DSA Art. 20).

-- BestChef moderation appeals (plan 33 Phase 1.7, P0-08 / DSA Art. 20
-- internal complaint handling).
--
-- A user may contest a moderation decision made about THEIR content. The
-- appeal records the user's argument, is rate limited like other actions,
-- and lands in a queue the moderator console (plan 33 Phase 1.3) works
-- through. Resolving an appeal records the outcome + reason (statement of
-- reasons); actually reversing content state stays with the existing
-- decision RPCs (bc_apply_moderation_decision / bc_apply_vote_proof_decision).

create table if not exists public.bc_appeals (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.bc_moderation_decisions(id) on delete cascade,
  profile_id uuid not null references public.social_profiles(id) on delete cascade,
  body text not null,
  status text not null default 'open' check (status in ('open', 'upheld', 'overturned')),
  resolution_reason text,
  resolved_by uuid references public.social_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint bc_appeals_body_length check (char_length(body) between 1 and 2000),
  constraint bc_appeals_one_per_decision unique (decision_id)
);

create index if not exists bc_appeals_profile_idx
  on public.bc_appeals (profile_id, created_at desc);
create index if not exists bc_appeals_status_idx
  on public.bc_appeals (status, created_at);

alter table public.bc_appeals enable row level security;

drop policy if exists "bc_appeals_read" on public.bc_appeals;
create policy "bc_appeals_read" on public.bc_appeals for select
  using (bc_profile_owned(profile_id) or bc_is_admin());
drop policy if exists "bc_appeals_insert" on public.bc_appeals;
create policy "bc_appeals_insert" on public.bc_appeals for insert
  with check (false); -- RPC only
drop policy if exists "bc_appeals_update" on public.bc_appeals;
create policy "bc_appeals_update" on public.bc_appeals for update
  using (bc_is_admin()) with check (bc_is_admin());

-- Appeals get their own durable cap.
insert into public.bc_action_limits (action, max_count, window_seconds)
values ('appeal', 10, 86400)
on conflict (action) do nothing;

create or replace function public.bc_submit_appeal(
  p_decision_id uuid,
  p_body text
) returns table (
  appeal_id uuid,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_decision public.bc_moderation_decisions%rowtype;
  v_quota jsonb;
  v_appeal_id uuid;
begin
  v_profile_id := public.bc_current_profile_id();
  if v_profile_id is null then
    return query select null::uuid, 'unauthenticated'::text;
    return;
  end if;

  if nullif(trim(coalesce(p_body, '')), '') is null or char_length(p_body) > 2000 then
    return query select null::uuid, 'invalid_body'::text;
    return;
  end if;

  select * into v_decision
  from public.bc_moderation_decisions
  where id = p_decision_id;

  if not found or v_decision.profile_id is distinct from v_profile_id then
    -- Only the affected user may appeal, and we do not reveal other
    -- decisions' existence.
    return query select null::uuid, 'decision_not_found'::text;
    return;
  end if;

  if exists (select 1 from public.bc_appeals a where a.decision_id = p_decision_id) then
    return query select null::uuid, 'already_appealed'::text;
    return;
  end if;

  v_quota := public.bc_consume_action_quota(v_profile_id, 'appeal', p_decision_id);
  if not coalesce((v_quota ->> 'allowed')::boolean, false) then
    return query select null::uuid, 'rate_limited'::text;
    return;
  end if;

  insert into public.bc_appeals (decision_id, profile_id, body)
  values (p_decision_id, v_profile_id, trim(p_body))
  returning id into v_appeal_id;

  return query select v_appeal_id, null::text;
end;
$$;

grant execute on function public.bc_submit_appeal(uuid, text) to authenticated;

-- Console-side resolution (service role / moderators only): records the
-- outcome and statement of reasons.
create or replace function public.bc_resolve_appeal(
  p_appeal_id uuid,
  p_outcome text,
  p_reason text
) returns table (
  appeal_id uuid,
  status text,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  if not bc_is_admin() then
    return query select p_appeal_id, null::text, 'not_authorized'::text;
    return;
  end if;

  if p_outcome not in ('upheld', 'overturned') then
    return query select p_appeal_id, null::text, 'invalid_outcome'::text;
    return;
  end if;

  select id into v_actor
  from public.social_profiles
  where user_id = auth.uid()
  limit 1;

  update public.bc_appeals as a
  set status = p_outcome,
      resolution_reason = nullif(trim(coalesce(p_reason, '')), ''),
      resolved_by = v_actor,
      resolved_at = now()
  where a.id = p_appeal_id
    and a.status = 'open';

  if not found then
    return query select p_appeal_id, null::text, 'appeal_not_found'::text;
    return;
  end if;

  return query select p_appeal_id, p_outcome, null::text;
end;
$$;

revoke all on function public.bc_resolve_appeal(uuid, text, text) from public, anon, authenticated;
grant execute on function public.bc_resolve_appeal(uuid, text, text) to service_role;

-- Typed notifications, no stored English (migration 20260703000004, plan 33 Phase 2.1 / N1).

-- Backend notifications stop speaking English (plan 33 Phase 2.1, finding N1).
--
-- bc_notifications rows used to store English titles/bodies baked inside
-- Postgres ("<name> upvoted your recipe", tier labels, to_char dates), which
-- ships English to every locale and makes stored rows unmigratable later.
-- From this migration on:
--   * rows carry kind (the type) + params jsonb; title/body are written EMPTY
--   * clients render localized copy from kind + params via the i18n catalogs
--   * existing rows are backfilled with best-effort params (actor name via
--     profile join, comment snippet from body); their legacy English
--     title/body remains as a render fallback for pre-typed rows
--   * bc_profile_activity_v exposes params per branch; its legacy
--     title/subtitle columns stay TEMPORARILY (computed, nothing stored) so
--     TestFlight build 24 keeps rendering, and drop once build 25 is the floor
--
-- Ordering is load-bearing: this must land before any non-EN user exists
-- (plan 33 risk register).

alter table public.bc_notifications
  add column if not exists params jsonb not null default '{}'::jsonb;
alter table public.bc_notifications
  alter column title set default '';

-- ── Fanout functions: kind + params only ─────────────────────────────

create or replace function public.bc_notify_upvote(
  submission_id uuid,
  actor_id uuid,
  tier text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_profile_id uuid;
  v_author_user_id uuid;
  v_actor_user_id uuid;
  v_actor_name text;
  v_dish_title text;
begin
  select s.profile_id, p.user_id
    into v_author_profile_id, v_author_user_id
    from public.bc_submissions s
    join public.social_profiles p on p.id = s.profile_id
   where s.id = submission_id;

  select user_id, coalesce(display_name, handle)
    into v_actor_user_id, v_actor_name
    from public.social_profiles
   where id = actor_id;

  if v_author_profile_id is null
     or v_author_profile_id = actor_id
     or v_author_user_id is null then
    return;
  end if;

  select coalesce(r.title, d.name) into v_dish_title
    from public.bc_submissions s
    join public.bc_recipe_snapshots r on r.id = s.recipe_snapshot_id
    join public.bc_dishes d on d.id = s.dish_id
   where s.id = submission_id;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, params, actor_user_id, actor_name, target_type, target_id)
  values
    (v_author_user_id, 'upvote', 'votes', '', '',
     jsonb_strip_nulls(jsonb_build_object(
       'actor_name', v_actor_name,
       'dish_title', v_dish_title
     )),
     v_actor_user_id, v_actor_name, 'submission', submission_id::text);
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_reviewed_vote(
  submission_id uuid,
  actor_id uuid,
  tier text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_profile_id uuid;
  v_author_user_id uuid;
  v_actor_user_id uuid;
  v_actor_name text;
begin
  if tier not in ('gold', 'silver', 'bronze') then
    return;
  end if;

  select s.profile_id, p.user_id
    into v_author_profile_id, v_author_user_id
    from public.bc_submissions s
    join public.social_profiles p on p.id = s.profile_id
   where s.id = submission_id;

  select user_id, coalesce(display_name, handle)
    into v_actor_user_id, v_actor_name
    from public.social_profiles
   where id = actor_id;

  if v_author_profile_id is null
     or v_author_profile_id = actor_id
     or v_author_user_id is null then
    return;
  end if;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, params, actor_user_id, actor_name, target_type, target_id)
  values
    (v_author_user_id, 'reviewed_vote', 'votes', '', '',
     jsonb_strip_nulls(jsonb_build_object(
       'actor_name', v_actor_name,
       'tier', tier
     )),
     v_actor_user_id, v_actor_name, 'submission', submission_id::text);
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_follow(
  follower_id uuid,
  chef_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chef_user_id uuid;
  v_follower_user_id uuid;
  v_name text;
begin
  if follower_id = chef_id then
    return;
  end if;

  select user_id, coalesce(display_name, handle)
    into v_follower_user_id, v_name
    from public.social_profiles
   where id = follower_id;

  select user_id into v_chef_user_id
    from public.social_profiles
   where id = chef_id;

  if v_chef_user_id is null then
    return;
  end if;

  insert into public.bc_notifications
    (user_id, kind, category, title, params, actor_user_id, actor_name, target_type, target_id)
  values
    (v_chef_user_id, 'follow', 'social', '',
     jsonb_strip_nulls(jsonb_build_object('actor_name', v_name)),
     v_follower_user_id, v_name, 'chef', follower_id::text);
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_comment(
  submission_id uuid,
  comment_id uuid,
  actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_profile_id uuid;
  v_author_user_id uuid;
  v_actor_user_id uuid;
  v_actor_name text;
  v_body text;
  v_parent_id uuid;
  v_parent_author_profile_id uuid;
  v_parent_author_user_id uuid;
  v_handle text;
  v_mention_profile_id uuid;
  v_mention_user_id uuid;
begin
  select s.profile_id, p.user_id
    into v_author_profile_id, v_author_user_id
    from public.bc_submissions s
    join public.social_profiles p on p.id = s.profile_id
   where s.id = submission_id;

  if v_author_profile_id is null then
    return;
  end if;

  select p.user_id, coalesce(p.display_name, p.handle)
    into v_actor_user_id, v_actor_name
    from public.social_profiles p
   where p.id = actor_id;

  select c.body, c.parent_id
    into v_body, v_parent_id
    from public.bc_comments c
   where c.id = comment_id;

  if v_author_profile_id <> actor_id and v_author_user_id is not null then
    insert into public.bc_notifications
      (user_id, kind, category, title, body, params, actor_user_id, actor_name, target_type, target_id)
    values
      (v_author_user_id, 'comment', 'social', '', '',
       jsonb_strip_nulls(jsonb_build_object(
         'actor_name', v_actor_name,
         'snippet', left(coalesce(v_body, ''), 120),
         'reply', false
       )),
       v_actor_user_id, v_actor_name, 'submission', submission_id::text);
  end if;

  if v_parent_id is not null then
    select c.profile_id, p.user_id
      into v_parent_author_profile_id, v_parent_author_user_id
      from public.bc_comments c
      join public.social_profiles p on p.id = c.profile_id
     where c.id = v_parent_id;

    if v_parent_author_profile_id is not null
       and v_parent_author_profile_id <> actor_id
       and v_parent_author_profile_id <> v_author_profile_id
       and v_parent_author_user_id is not null then
      insert into public.bc_notifications
        (user_id, kind, category, title, body, params, actor_user_id, actor_name, target_type, target_id)
      values
        (v_parent_author_user_id, 'comment', 'social', '', '',
         jsonb_strip_nulls(jsonb_build_object(
           'actor_name', v_actor_name,
           'snippet', left(coalesce(v_body, ''), 120),
           'reply', true
         )),
         v_actor_user_id, v_actor_name, 'submission', submission_id::text);
    end if;
  end if;

  if v_body is not null then
    for v_handle in
      select distinct (regexp_matches(v_body, '@([A-Za-z0-9_]+)', 'g'))[1]
    loop
      select p.id, p.user_id
        into v_mention_profile_id, v_mention_user_id
        from public.social_profiles p
       where lower(p.handle) = lower(v_handle)
       limit 1;

      if v_mention_profile_id is not null
         and v_mention_profile_id <> actor_id
         and v_mention_user_id is not null then
        insert into public.bc_notifications
          (user_id, kind, category, title, body, params, actor_user_id, actor_name, target_type, target_id)
        values
          (v_mention_user_id, 'mention', 'social', '', '',
           jsonb_strip_nulls(jsonb_build_object(
             'actor_name', v_actor_name,
             'snippet', left(v_body, 120)
           )),
           v_actor_user_id, v_actor_name, 'submission', submission_id::text);
      end if;
    end loop;
  end if;
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_rank_change(
  chef_id uuid,
  old_rank int,
  new_rank int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_kind text;
  v_milestone int;
begin
  if new_rank >= old_rank then
    return;
  end if;

  select user_id into v_user_id
    from public.social_profiles
   where id = chef_id;

  if v_user_id is null then
    return;
  end if;

  v_kind := 'rank_up';
  foreach v_milestone in array array[1, 3, 10, 25, 50, 100] loop
    if old_rank > v_milestone and new_rank <= v_milestone then
      v_kind := 'rank_milestone';
      exit;
    end if;
  end loop;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, params, target_type, target_id)
  values
    (v_user_id, v_kind, 'ranks', '', '',
     jsonb_build_object(
       'new_rank', new_rank,
       'old_rank', old_rank,
       'delta', old_rank - new_rank
     ),
     'chef', chef_id::text);
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_badge(
  chef_id uuid,
  badge_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_name text;
  v_desc text;
begin
  select user_id into v_user_id
    from public.social_profiles
   where id = chef_id;

  if v_user_id is null then
    return;
  end if;

  select name, description into v_name, v_desc
    from public.bc_badge_definitions
   where id = badge_id;

  if v_name is null then
    return;
  end if;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, params, target_type, target_id)
  values
    (v_user_id, 'badge', 'system', '', '',
     jsonb_strip_nulls(jsonb_build_object(
       'badge_id', badge_id,
       'badge_name', v_name,
       'badge_description', v_desc
     )),
     'badge', badge_id);
exception when others then
  null;
end;
$$;

-- ── Backfill existing rows to typed form (best-effort) ───────────────

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

-- ── Activity view v2: params per branch ──────────────────────────────
-- Legacy English title/subtitle stay temporarily (view-computed, nothing
-- stored) so pre-params clients keep rendering; drop with build 25.
-- drop+create because create-or-replace cannot insert the params column.

drop view if exists public.bc_profile_activity_v;
create view public.bc_profile_activity_v as
select
  concat('rank:', chef_id::text, ':', week::text) as id,
  chef_id,
  'rank_change'::text as kind,
  'trophy.fill' as icon,
  '#EAB308' as tint,
  concat('Climbed to #', rank) as title,
  concat('Week of ', to_char(week, 'Mon DD')) as subtitle,
  jsonb_build_object('rank', rank, 'week', week::text) as params,
  week::timestamptz as occurred_at,
  null::text as target_route
from public.bc_rank_history
where week >= current_date - interval '30 days'
union all
select
  concat('reviewed:', v.id) as id,
  s.profile_id as chef_id,
  'reviewed_vote'::text as kind,
  'checkmark.seal.fill' as icon,
  '#22C55E' as tint,
  concat(initcap(v.tier::text), ' vote received') as title,
  'On your submission' as subtitle,
  jsonb_build_object('tier', v.tier) as params,
  v.created_at as occurred_at,
  concat('/submission/', s.id) as target_route
from public.bc_votes v
join public.bc_submissions s on s.id = v.submission_id
where v.tier in ('gold', 'silver', 'bronze')
  and v.created_at >= now() - interval '14 days'
union all
select
  concat('follow:', follower_id::text, ':', chef_id::text) as id,
  chef_id,
  'new_follower'::text as kind,
  'person.badge.plus' as icon,
  '#3B82F6' as tint,
  'New follower' as title,
  '' as subtitle,
  '{}'::jsonb as params,
  created_at as occurred_at,
  null::text as target_route
from public.bc_followers
where created_at >= now() - interval '14 days'
union all
select
  concat('badge:', cb.id) as id,
  cb.profile_id as chef_id,
  'badge'::text as kind,
  'rosette' as icon,
  '#F97316' as tint,
  concat(bd.name, ' unlocked') as title,
  bd.description as subtitle,
  jsonb_build_object('badge_name', bd.name, 'badge_description', bd.description) as params,
  cb.earned_at as occurred_at,
  null::text as target_route
from public.bc_chef_badges cb
join public.bc_badge_definitions bd on bd.id = cb.badge_id
where cb.earned_at >= now() - interval '30 days'
union all
select
  concat('upvotes:', s.id, ':', date_trunc('day', v.created_at)::text) as id,
  s.profile_id as chef_id,
  'upvotes'::text as kind,
  'hand.thumbsup.fill' as icon,
  '#EF4444' as tint,
  concat(count(v.id), ' new upvotes') as title,
  'On your submission' as subtitle,
  jsonb_build_object('count', count(v.id)) as params,
  max(v.created_at) as occurred_at,
  concat('/submission/', s.id) as target_route
from public.bc_votes v
join public.bc_submissions s on s.id = v.submission_id
where v.tier = 'tap_up'
  and v.created_at >= now() - interval '7 days'
group by s.id, s.profile_id, date_trunc('day', v.created_at)
union all
select
  concat('posted:', s.id) as id,
  s.profile_id as chef_id,
  'posted_recipe'::text as kind,
  'fork.knife' as icon,
  '#A855F7' as tint,
  'Posted a recipe' as title,
  'Entered the competition' as subtitle,
  '{}'::jsonb as params,
  s.created_at as occurred_at,
  concat('/submission/', s.id) as target_route
from public.bc_submissions s
where s.created_at >= now() - interval '14 days'
  and s.moderation_status = 'approved';

-- ============================================================================
-- Dish translation layer + locale-aware search (migration 20260703000005,
-- plan 33 Phase 2.3). Mirrored verbatim below.
-- ============================================================================

-- BestChef dish translation layer (plan 33 Phase 2.3).
--
-- Dishes stay canonical in bc_dishes (name/native_name); per-locale display
-- names and descriptions live in bc_dish_translations with locale fallback
-- to the canonical row. Locale-tagged bc_dish_aliases become the
-- per-language search layer. The editorial write path is the moderator
-- console (service role); community proposals are a later phase, which is
-- why the status column exists from day one.
--
-- bc_search_dishes replaces the client-side PostgREST `.or(ilike)` search:
-- it is fully parameterized (the old path interpolated user text into the
-- filter string) and matches canonical fields, approved translations for
-- the requested locale (exact tag first, then base language), and aliases
-- (untagged aliases match every locale; tagged aliases only their own).

create table if not exists public.bc_dish_translations (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.bc_dishes(id) on delete cascade,
  locale text not null,
  name text not null,
  description text,
  status text not null default 'approved'
    check (status in ('pending', 'approved', 'rejected')),
  source text not null default 'editorial'
    check (source in ('editorial', 'community')),
  -- Console editorial attribution (moderator email); RPCs run as service
  -- role so actor identity must ride the row itself.
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_dish_translations_unique unique (dish_id, locale),
  -- Lowercase-only storage so exact-match lookups never miss on case
  -- ('pt-br', never 'pt-BR'); writers normalize before insert.
  constraint bc_dish_translations_locale_shape
    check (locale ~ '^[a-z]{2}(-[a-z0-9]{2,8})?$'),
  constraint bc_dish_translations_name_length
    check (char_length(name) between 1 and 200),
  constraint bc_dish_translations_description_length
    check (description is null or char_length(description) <= 2000)
);

create index if not exists bc_dish_translations_dish_idx
  on public.bc_dish_translations (dish_id);
create index if not exists bc_dish_translations_locale_idx
  on public.bc_dish_translations (locale) where status = 'approved';
-- Search matching is leading-wildcard ilike through the lateral join, so a
-- btree on lower(name) is unusable; pg_trgm gin indexes are the scale plan
-- once the catalog grows (plan 33 Phase 4 note).

alter table public.bc_dish_translations enable row level security;

drop policy if exists "bc_dish_translations_read" on public.bc_dish_translations;
create policy "bc_dish_translations_read" on public.bc_dish_translations for select
  using (status = 'approved' or bc_is_admin());

drop policy if exists "bc_dish_translations_write" on public.bc_dish_translations;
create policy "bc_dish_translations_write" on public.bc_dish_translations for all
  using (bc_is_admin()) with check (bc_is_admin());

-- ── Locale-aware dish search ──────────────────────────────────────────

create or replace function public.bc_search_dishes(
  p_query text default '',
  p_locale text default null,
  p_category text default null,
  p_cuisine text default null,
  p_status text default 'active',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  dish public.bc_dishes,
  localized_name text,
  localized_description text
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_query text := trim(coalesce(p_query, ''));
  v_pattern text;
  v_locale text := nullif(lower(trim(coalesce(p_locale, ''))), '');
  v_base_locale text;
  -- 500 cap: the catalog surfaces load up to 200 dishes in one call; the
  -- cap exists only as an abuse ceiling, never to silently truncate them.
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  -- LIKE-escape the user query: %, _ and \ must match literally.
  v_pattern := '%' || replace(replace(replace(v_query,
    '\', '\\'),
    '%', '\%'),
    '_', '\_') || '%';
  v_base_locale := case when v_locale is null then null else split_part(v_locale, '-', 1) end;

  return query
  select
    d,
    t.name,
    t.description
  from public.bc_dishes d
  left join lateral (
    -- Exact tag or the BARE base language only ('pt-br' falls back to 'pt',
    -- never to sibling 'pt-pt'; 'zh-hans' must never be served 'zh-hant').
    -- At most two rows can match (unique dish_id+locale), so exact-first
    -- ordering is fully deterministic.
    select tr.name, tr.description
    from public.bc_dish_translations tr
    where tr.dish_id = d.id
      and tr.status = 'approved'
      and v_locale is not null
      and lower(tr.locale) in (v_locale, v_base_locale)
    order by (lower(tr.locale) = v_locale) desc
    limit 1
  ) t on true
  where (p_status is null or d.status = p_status)
    and (p_category is null or d.category = p_category)
    and (p_cuisine is null or d.cuisine = p_cuisine)
    and (
      v_query = ''
      or d.name ilike v_pattern
      or d.native_name ilike v_pattern
      or d.description ilike v_pattern
      or (t.name is not null and t.name ilike v_pattern)
      or (t.description is not null and t.description ilike v_pattern)
      or exists (
        -- Untagged aliases match every locale; tagged aliases match ONLY
        -- their exact locale or their bare base language. With no caller
        -- locale (canonical/English surface) tagged aliases never match.
        select 1
        from public.bc_dish_aliases a
        where a.dish_id = d.id
          and (
            a.locale is null
            or (v_locale is not null and lower(a.locale) in (v_locale, v_base_locale))
          )
          and a.alias ilike v_pattern
      )
    )
  order by d.submission_count desc, d.name asc
  limit v_limit
  offset v_offset;
end;
$$;

comment on function public.bc_search_dishes(text, text, text, text, text, integer, integer) is
  'Locale-aware, injection-safe dish search: canonical fields + approved '
  'translations (exact locale tag first, then base language) + aliases '
  '(untagged aliases match every locale; tagged ones only their own). '
  'localized_name/localized_description are null when no approved '
  'translation exists for the requested locale (clients fall back to the '
  'canonical name).';

grant execute on function public.bc_search_dishes(text, text, text, text, text, integer, integer)
  to anon, authenticated, service_role;

-- ============================================================================
-- UGC language tagging (migration 20260703000006, plan 33 Phase 2.5).
-- Mirrored verbatim below.
-- ============================================================================

-- BestChef UGC language tagging (plan 33 Phase 2.5).
--
-- Submissions, recipe snapshots, and comments carry the author's app
-- language at write time (nullable: rows written before this migration and
-- clients older than build 25 stay untagged and only appear in unfiltered
-- views). Feed and leaderboard queries filter on bc_submissions.language;
-- per-market leaderboards compose this with the existing region kind.
--
-- Vote-proof moderation queue rows inherit the submission's language via a
-- BEFORE trigger so the moderator console's queue language filter (built
-- dormant in Phase 1.3) activates without touching the bc_cast_vote RPC.

alter table public.bc_submissions
  add column if not exists language text;
alter table public.bc_recipe_snapshots
  add column if not exists language text;
alter table public.bc_comments
  add column if not exists language text;

-- Lowercase-only tags, same shape as bc_dish_translations.locale.
alter table public.bc_submissions
  drop constraint if exists bc_submissions_language_shape;
alter table public.bc_submissions
  add constraint bc_submissions_language_shape
  check (language is null or language ~ '^[a-z]{2}(-[a-z0-9]{2,8})?$');
alter table public.bc_recipe_snapshots
  drop constraint if exists bc_recipe_snapshots_language_shape;
alter table public.bc_recipe_snapshots
  add constraint bc_recipe_snapshots_language_shape
  check (language is null or language ~ '^[a-z]{2}(-[a-z0-9]{2,8})?$');
alter table public.bc_comments
  drop constraint if exists bc_comments_language_shape;
alter table public.bc_comments
  add constraint bc_comments_language_shape
  check (language is null or language ~ '^[a-z]{2}(-[a-z0-9]{2,8})?$');

-- Feed/leaderboard filter path: language + approved + ranking order.
create index if not exists bc_submissions_language_idx
  on public.bc_submissions (language, moderation_status, vote_score desc)
  where language is not null;

-- ── Vote-proof queue language stamp ───────────────────────────────────

create or replace function public.bc_stamp_queue_language()
returns trigger
language plpgsql
as $$
declare
  v_submission_id uuid;
  v_language text;
begin
  if new.kind <> 'vote_proof' then
    return new;
  end if;
  begin
    v_submission_id := nullif(new.metadata ->> 'submission_id', '')::uuid;
  exception when others then
    return new;
  end;
  if v_submission_id is null then
    return new;
  end if;
  select s.language into v_language
  from public.bc_submissions s
  where s.id = v_submission_id;
  if v_language is not null then
    new.metadata := new.metadata || jsonb_build_object('language', v_language);
  end if;
  return new;
end;
$$;

drop trigger if exists bc_moderation_queue_language on public.bc_moderation_queue;
create trigger bc_moderation_queue_language
  before insert or update of metadata on public.bc_moderation_queue
  for each row
  execute function public.bc_stamp_queue_language();

-- BestChef plan 33 Phase 5.6 (F-010): cloud bookmarks.
-- bc_saved_submissions is the durable backing for the video-feed and
-- submission bookmark affordances. Saves are PRIVATE library data: unlike
-- bc_submission_likes, only the owner (or an admin) can read who saved
-- what. Writes ride the CHF-1 durable action-quota engine ('save').

create table if not exists bc_saved_submissions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references bc_submissions(id) on delete cascade,
  profile_id uuid not null references social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint bc_saved_submissions_unique unique (profile_id, submission_id)
);

create index if not exists bc_saved_submissions_profile_idx
  on bc_saved_submissions (profile_id, created_at desc);
create index if not exists bc_saved_submissions_submission_idx
  on bc_saved_submissions (submission_id);

alter table bc_saved_submissions enable row level security;

drop policy if exists "bc_saved_submissions_read" on bc_saved_submissions;
create policy "bc_saved_submissions_read" on bc_saved_submissions for select using (
  bc_profile_owned(profile_id) or bc_is_admin()
);
drop policy if exists "bc_saved_submissions_insert" on bc_saved_submissions;
create policy "bc_saved_submissions_insert" on bc_saved_submissions for insert with check (
  bc_profile_owned(profile_id)
  and bc_submission_visible(submission_id)
);
drop policy if exists "bc_saved_submissions_delete" on bc_saved_submissions;
create policy "bc_saved_submissions_delete" on bc_saved_submissions for delete using (
  bc_profile_owned(profile_id) or bc_is_admin()
);

-- Durable rate limit: same ceiling as likes (cheap, reversible action).
insert into public.bc_action_limits (action, max_count, window_seconds)
values ('save', 200, 3600)
on conflict (action) do nothing;

drop trigger if exists bc_saved_submissions_action_quota on public.bc_saved_submissions;
create trigger bc_saved_submissions_action_quota
  before insert on public.bc_saved_submissions
  for each row execute function public.bc_enforce_action_quota('save', 'profile_id');

-- DSAR/inventory completeness: the pre-deletion row-count manifest must
-- include saved submissions (review finding, GDPR data inventory).
create or replace function bc_profile_owned_row_counts(p_profile_id uuid)
returns jsonb as $$
declare
  counts jsonb;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if not (bc_is_admin() or bc_profile_owned(p_profile_id)) then
    raise exception 'Not authorized to inspect this profile';
  end if;

  counts := jsonb_build_object(
    'bc_recipe_snapshots.profile_id', (select count(*) from bc_recipe_snapshots where profile_id = p_profile_id),
    'bc_media_assets.owner_profile_id', (select count(*) from bc_media_assets where owner_profile_id = p_profile_id),
    'bc_product_records.created_by_profile_id', (select count(*) from bc_product_records where created_by_profile_id = p_profile_id),
    'bc_product_records.verified_by_profile_id', (select count(*) from bc_product_records where verified_by_profile_id = p_profile_id),
    'bc_product_contributions.profile_id', (select count(*) from bc_product_contributions where profile_id = p_profile_id),
    'bc_product_contributions.reviewed_by_profile_id', (select count(*) from bc_product_contributions where reviewed_by_profile_id = p_profile_id),
    'bc_product_evidence.owner_profile_id', (select count(*) from bc_product_evidence where owner_profile_id = p_profile_id),
    'bc_submissions.profile_id', (select count(*) from bc_submissions where profile_id = p_profile_id),
    'bc_submission_likes.profile_id', (select count(*) from bc_submission_likes where profile_id = p_profile_id),
    'bc_saved_submissions.profile_id', (select count(*) from bc_saved_submissions where profile_id = p_profile_id),
    'bc_votes.voter_profile_id', (select count(*) from bc_votes where voter_profile_id = p_profile_id),
    'bc_comments.profile_id', (select count(*) from bc_comments where profile_id = p_profile_id),
    'bc_comment_helpful.voter_profile_id', (select count(*) from bc_comment_helpful where voter_profile_id = p_profile_id),
    'bc_photo_reports.reporter_id', (select count(*) from bc_photo_reports where reporter_id = p_profile_id),
    'bc_flags.flagger_id', (select count(*) from bc_flags where flagger_id = p_profile_id),
    'bc_notes.author_id', (select count(*) from bc_notes where author_id = p_profile_id),
    'bc_note_ratings.rater_id', (select count(*) from bc_note_ratings where rater_id = p_profile_id),
    'bc_chef_badges.profile_id', (select count(*) from bc_chef_badges where profile_id = p_profile_id),
    'bc_creator_applications.profile_id', (select count(*) from bc_creator_applications where profile_id = p_profile_id),
    'bc_tips.tipper_id', (select count(*) from bc_tips where tipper_id = p_profile_id),
    'bc_tips.chef_id', (select count(*) from bc_tips where chef_id = p_profile_id),
    'bc_subscription_tiers.chef_id', (select count(*) from bc_subscription_tiers where chef_id = p_profile_id),
    'bc_subscriptions.subscriber_id', (select count(*) from bc_subscriptions where subscriber_id = p_profile_id),
    'bc_subscriptions.chef_id', (select count(*) from bc_subscriptions where chef_id = p_profile_id),
    'bc_posts.author_id', (select count(*) from bc_posts where author_id = p_profile_id),
    'bc_recipe_forks.forked_by_profile_id', (select count(*) from bc_recipe_forks where forked_by_profile_id = p_profile_id),
    'bc_affiliate_orders.chef_id', (select count(*) from bc_affiliate_orders where chef_id = p_profile_id),
    'bc_hubs.owner_profile_id', (select count(*) from bc_hubs where owner_profile_id = p_profile_id),
    'bc_submission_aliases.created_by_profile_id', (select count(*) from bc_submission_aliases where created_by_profile_id = p_profile_id)
  );

  insert into bc_account_lifecycle_events (
    actor_profile_id,
    target_profile_id,
    target_user_id,
    event_type,
    metadata
  )
  select
    viewer.id,
    p_profile_id,
    auth.uid(),
    'profile_owned_row_counted',
    counts
  from social_profiles viewer
  where viewer.user_id = auth.uid()
  limit 1;

  return counts;
end;
$$ language plpgsql security definer set search_path = public;

-- BestChef media purge job wiring (TS-04, plan 33 Phase 4.1 item).
--
-- The bestchef-media-purge Edge Function deletes storage objects for
-- purgeable bc_media_assets rows (user/account deletions immediately;
-- moderation rejections only after the 183-day appeal-evidence window).
-- Deploying the function alone leaves it dormant (review 2026-07-04):
-- this migration schedules it and folds it into bc_job_health().
--
-- Per-environment ops setup (staging + production), service-role SQL:
--   insert into public.bc_job_config (key, value) values
--     ('functions_base_url', 'https://<project-ref>.supabase.co/functions/v1'),
--     ('media_purge_worker_secret', '<BESTCHEF_MEDIA_PURGE_WORKER_SECRET>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();

-- Invoke the purge worker. Quiet no-op when unconfigured, when nothing is
-- purgeable, or when pg_net is missing (mirrors bc_run_account_deletion_worker).
create or replace function bc_run_media_purge_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_purgeable integer;
begin
  select value into v_url from public.bc_job_config where key = 'functions_base_url';
  select value into v_secret from public.bc_job_config where key = 'media_purge_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  select count(*) into v_purgeable
  from public.bc_media_assets
  where storage_key is not null
    and metadata ->> 'purged_at' is null
    and (
      upload_status = 'deleted'
      or (moderation_status = 'rejected' and updated_at < now() - interval '183 days')
    );
  if v_purgeable = 0 then
    return;
  end if;

  begin
    perform net.http_post(
      url := rtrim(v_url, '/') || '/bestchef-media-purge',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-BestChef-Worker-Secret', v_secret
      ),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'bc_run_media_purge_worker: http_post failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function bc_run_media_purge_worker() from public, anon, authenticated;
grant execute on function bc_run_media_purge_worker() to service_role;

-- Daily is plenty: the batch limit bounds each run and the appeal window
-- means rejections wait months anyway.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'bestchef-media-purge-worker',
      '43 3 * * *',
      $job$select public.bc_run_media_purge_worker();$job$
    );
  else
    raise notice 'pg_cron not installed: media purge job not scheduled in this environment.';
  end if;
exception when others then
  raise notice 'media purge job scheduling skipped: %', sqlerrm;
end $$;

-- bc_job_health() now reports the purge job too.
create or replace function public.bc_job_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_url boolean;
  v_has_secret boolean;
  v_has_purge_secret boolean;
  v_pg_cron boolean;
  v_pg_net boolean;
  v_rankings_job boolean;
  v_deletion_job boolean;
  v_purge_job boolean;
  v_last_rankings_update timestamptz;
  v_pending_deletions bigint;
  v_oldest_pending timestamptz;
  v_purgeable_media bigint;
begin
  select exists (select 1 from public.bc_job_config where key = 'functions_base_url')
    into v_has_url;
  select exists (select 1 from public.bc_job_config where key = 'account_deletion_worker_secret')
    into v_has_secret;
  select exists (select 1 from public.bc_job_config where key = 'media_purge_worker_secret')
    into v_has_purge_secret;
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_pg_cron;
  select exists (select 1 from pg_extension where extname = 'pg_net') into v_pg_net;

  v_rankings_job := false;
  v_deletion_job := false;
  v_purge_job := false;
  if v_pg_cron then
    begin
      select
        exists (select 1 from cron.job where jobname = 'bestchef-rebuild-rankings'),
        exists (select 1 from cron.job where jobname = 'bestchef-account-deletion-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-media-purge-worker')
        into v_rankings_job, v_deletion_job, v_purge_job;
    exception when others then
      v_rankings_job := false;
      v_deletion_job := false;
      v_purge_job := false;
    end;
  end if;

  select max(updated_at) from public.bc_rankings into v_last_rankings_update;

  select count(*), min(requested_at)
    from public.bc_account_deletion_requests
    where status in ('requested', 'processing')
    into v_pending_deletions, v_oldest_pending;

  select count(*)
    from public.bc_media_assets
    where storage_key is not null
      and metadata ->> 'purged_at' is null
      and (
        upload_status = 'deleted'
        or (moderation_status = 'rejected' and updated_at < now() - interval '183 days')
      )
    into v_purgeable_media;

  return jsonb_build_object(
    'config_functions_base_url', v_has_url,
    'config_worker_secret', v_has_secret,
    'config_media_purge_secret', v_has_purge_secret,
    'pg_cron_installed', v_pg_cron,
    'pg_net_installed', v_pg_net,
    'rankings_job_scheduled', v_rankings_job,
    'deletion_job_scheduled', v_deletion_job,
    'media_purge_job_scheduled', v_purge_job,
    'last_rankings_update', v_last_rankings_update,
    'pending_deletion_requests', v_pending_deletions,
    'oldest_pending_deletion_requested_at', v_oldest_pending,
    'purgeable_media_rows', v_purgeable_media,
    'healthy',
      v_has_url and v_has_secret and v_has_purge_secret and v_pg_cron and v_pg_net
      and v_rankings_job and v_deletion_job and v_purge_job,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.bc_job_health() from public, anon, authenticated;
grant execute on function public.bc_job_health() to service_role;
