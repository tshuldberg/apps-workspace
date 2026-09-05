-- MyNews canonical bootstrap (plan 34, Phase 0).
-- nw_* tables are the server-side canonical record for the MyNews open
-- journalism platform (BestChef public-launch pattern: RLS everywhere,
-- public-read/owner-write, service-role-only money and job tables carry RLS
-- with zero policies, public URL columns are CHECK-forced to https).
-- Signing note: articles and suggestions carry client-side ed25519 signatures;
-- the server verifies on write (edge function) and stores them so anyone can
-- re-verify the corpus offline. The server is canonical but cannot forge.

-- ============================================================ identity

create table if not exists public.nw_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null default '',
  pubkey_ed25519 text not null default '',
  kind text not null default 'reader' check (kind in ('reader', 'editor', 'journalist')),
  created_at timestamptz not null default now()
);
alter table public.nw_profiles enable row level security;
create policy nw_profiles_public_select on public.nw_profiles
  for select using (true);
create policy nw_profiles_self_insert on public.nw_profiles
  for insert with check (auth.uid() = user_id);
create policy nw_profiles_self_update on public.nw_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.nw_journalists (
  profile_id uuid primary key references public.nw_profiles (id) on delete cascade,
  tier text not null default 'open' check (tier in ('open', 'verified')),
  bio text not null default '',
  beats text[] not null default '{}',
  region text not null default '',
  stripe_account_id text,
  created_at timestamptz not null default now()
);
alter table public.nw_journalists enable row level security;
create policy nw_journalists_public_select on public.nw_journalists
  for select using (true);
create policy nw_journalists_self_insert on public.nw_journalists
  for insert with check (
    auth.uid() = (select user_id from public.nw_profiles where id = profile_id)
  );
create policy nw_journalists_self_update on public.nw_journalists
  for update using (
    auth.uid() = (select user_id from public.nw_profiles where id = profile_id)
  );
-- stripe_account_id is written by the billing edge function (service role);
-- clients never set it. Kept out of the public view below.

create table if not exists public.nw_journalist_verifications (
  id uuid primary key default gen_random_uuid(),
  journalist_id uuid not null references public.nw_journalists (profile_id) on delete cascade,
  method text not null check (method in ('domain_email', 'orcid', 'byline', 'manual')),
  evidence_ref text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  created_at timestamptz not null default now()
);
alter table public.nw_journalist_verifications enable row level security;
-- Service-role writes only. The public sees method + status through a view in
-- a later phase; evidence stays private, so: no policies.

-- ============================================================ content

create table if not exists public.nw_articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.nw_profiles (id) on delete restrict,
  newsroom_id uuid,
  kind text not null default 'news' check (kind in ('news', 'preprint')),
  status text not null default 'draft' check (status in ('draft', 'published', 'retracted')),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,120}$'),
  current_rev integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.nw_articles enable row level security;
create policy nw_articles_public_select on public.nw_articles
  for select using (status <> 'draft');
create policy nw_articles_owner_select on public.nw_articles
  for select using (
    auth.uid() = (select user_id from public.nw_profiles where id = author_id)
  );
create policy nw_articles_owner_insert on public.nw_articles
  for insert with check (
    auth.uid() = (select user_id from public.nw_profiles where id = author_id)
  );
create policy nw_articles_owner_update on public.nw_articles
  for update using (
    auth.uid() = (select user_id from public.nw_profiles where id = author_id)
  );

create table if not exists public.nw_article_revisions (
  article_id uuid not null references public.nw_articles (id) on delete cascade,
  rev integer not null check (rev >= 1),
  headline text not null,
  dek text,
  body_md text not null,
  signature text not null,
  signer_pubkey text not null,
  changelog_json jsonb not null default '[]',
  created_at timestamptz not null default now(),
  primary key (article_id, rev)
);
alter table public.nw_article_revisions enable row level security;
create policy nw_article_revisions_public_select on public.nw_article_revisions
  for select using (
    exists (
      select 1 from public.nw_articles a
      where a.id = article_id and a.status <> 'draft'
    )
  );
create policy nw_article_revisions_owner_all on public.nw_article_revisions
  for all using (
    auth.uid() = (
      select p.user_id from public.nw_articles a
      join public.nw_profiles p on p.id = a.author_id
      where a.id = article_id
    )
  );

create table if not exists public.nw_article_meta (
  article_id uuid primary key references public.nw_articles (id) on delete cascade,
  doi text,
  orcid_authors text[] not null default '{}',
  license text not null default '',
  rights_route text not null default '' check (rights_route in ('', 'preprint', 'rights_retention', 'cc_by')),
  embargo_until timestamptz,
  dataset_hashes text[] not null default '{}',
  canonical_url text check (canonical_url is null or canonical_url ~ '^https://')
);
alter table public.nw_article_meta enable row level security;
create policy nw_article_meta_public_select on public.nw_article_meta
  for select using (
    exists (
      select 1 from public.nw_articles a
      where a.id = article_id and a.status <> 'draft'
    )
  );
create policy nw_article_meta_owner_all on public.nw_article_meta
  for all using (
    auth.uid() = (
      select p.user_id from public.nw_articles a
      join public.nw_profiles p on p.id = a.author_id
      where a.id = article_id
    )
  );

-- ============================================================ editing

create table if not exists public.nw_edit_suggestions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.nw_articles (id) on delete cascade,
  base_rev integer not null check (base_rev >= 1),
  editor_id uuid not null references public.nw_profiles (id) on delete cascade,
  type text not null check (type in ('correction', 'context', 'translation', 'clarity', 'headline', 'copyedit')),
  diff_json jsonb not null,
  citations jsonb not null default '[]',
  rationale text not null,
  signature text not null default '',
  status text not null default 'open' check (status in ('open', 'accepted', 'partial', 'rejected', 'stale')),
  created_at timestamptz not null default now(),
  constraint nw_edit_suggestions_citation_floor check (
    type not in ('correction', 'context') or jsonb_array_length(citations) >= 1
  )
);
alter table public.nw_edit_suggestions enable row level security;
create policy nw_edit_suggestions_public_select on public.nw_edit_suggestions
  for select using (
    exists (
      select 1 from public.nw_articles a
      where a.id = article_id and a.status <> 'draft'
    )
  );
create policy nw_edit_suggestions_editor_insert on public.nw_edit_suggestions
  for insert with check (
    auth.uid() = (select user_id from public.nw_profiles where id = editor_id)
  );
-- Status transitions (accept/reject/partial) happen in the review edge
-- function under the article author's session; direct client updates stay off.

create table if not exists public.nw_suggestion_events (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.nw_edit_suggestions (id) on delete cascade,
  actor_id uuid not null references public.nw_profiles (id) on delete cascade,
  action text not null check (action in ('comment', 'accept', 'reject', 'partial', 'rebase')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.nw_suggestion_events enable row level security;
create policy nw_suggestion_events_public_select on public.nw_suggestion_events
  for select using (true);
create policy nw_suggestion_events_actor_insert on public.nw_suggestion_events
  for insert with check (
    auth.uid() = (select user_id from public.nw_profiles where id = actor_id)
    and action = 'comment'
  );
-- Decision events (accept/reject/partial/rebase) are written by the review
-- edge function after author-signature verification.

create table if not exists public.nw_credibility_ledger (
  id uuid primary key default gen_random_uuid(),
  editor_id uuid not null references public.nw_profiles (id) on delete cascade,
  suggestion_id uuid not null unique references public.nw_edit_suggestions (id) on delete cascade,
  base_points numeric not null,
  diversity_mult numeric not null,
  standing_mult numeric not null,
  awarded_at timestamptz not null default now()
);
alter table public.nw_credibility_ledger enable row level security;
create policy nw_credibility_ledger_public_select on public.nw_credibility_ledger
  for select using (true);
-- Append-only via the review edge function (service role). No client writes.

-- ============================================================ reader graph

create table if not exists public.nw_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.nw_profiles (id) on delete cascade,
  journalist_id uuid not null references public.nw_journalists (profile_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, journalist_id)
);
alter table public.nw_follows enable row level security;
create policy nw_follows_self_all on public.nw_follows
  for all using (
    auth.uid() = (select user_id from public.nw_profiles where id = follower_id)
  ) with check (
    auth.uid() = (select user_id from public.nw_profiles where id = follower_id)
  );

-- ============================================================ money
-- Service-role territory. RLS on, zero client policies, except nw_supports
-- which both sides of the relationship may read.

create table if not exists public.nw_supports (
  id uuid primary key default gen_random_uuid(),
  supporter_id uuid not null references public.nw_profiles (id) on delete cascade,
  journalist_id uuid not null references public.nw_journalists (profile_id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  cadence text not null default 'monthly' check (cadence in ('monthly', 'oneoff')),
  status text not null default 'active' check (status in ('active', 'paused', 'canceled')),
  started_at timestamptz not null default now(),
  unique (supporter_id, journalist_id, cadence)
);
alter table public.nw_supports enable row level security;
create policy nw_supports_supporter_select on public.nw_supports
  for select using (
    auth.uid() = (select user_id from public.nw_profiles where id = supporter_id)
  );
create policy nw_supports_journalist_select on public.nw_supports
  for select using (
    auth.uid() = (select user_id from public.nw_profiles where id = journalist_id)
  );
-- Creation, pause, and cancel run through the billing edge function so the
-- ledger, Stripe subscription, and this table never drift.

create table if not exists public.nw_support_charges (
  id uuid primary key default gen_random_uuid(),
  supporter_id uuid not null references public.nw_profiles (id) on delete restrict,
  period text not null,
  gross_cents integer not null check (gross_cents > 0),
  stripe_fee_cents integer not null check (stripe_fee_cents >= 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  charge_ref text not null unique,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded', 'disputed')),
  created_at timestamptz not null default now()
);
alter table public.nw_support_charges enable row level security;
-- service-role only: no policies.

create table if not exists public.nw_transfer_ledger (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.nw_support_charges (id) on delete restrict,
  journalist_id uuid not null references public.nw_journalists (profile_id) on delete restrict,
  net_cents integer not null check (net_cents >= 0),
  transfer_ref text,
  created_at timestamptz not null default now()
);
alter table public.nw_transfer_ledger enable row level security;
-- service-role only: no policies.

create table if not exists public.nw_fee_config (
  key text primary key,
  value text not null,
  effective_at timestamptz not null default now()
);
alter table public.nw_fee_config enable row level security;
-- service-role only: no policies. Fees are data, not code.
insert into public.nw_fee_config (key, value) values
  ('platform_fee_bps', '200'),
  ('processing_pct_bps', '290'),
  ('processing_fixed_cents', '30'),
  ('payout_min_cents', '1000')
on conflict (key) do nothing;

create table if not exists public.nw_job_config (
  key text primary key,
  value text not null
);
alter table public.nw_job_config enable row level security;
-- service-role only: no policies (BestChef nw-equivalent of bc_job_config).

-- ============================================================ safety

create table if not exists public.nw_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.nw_profiles (id) on delete set null,
  target_kind text not null check (target_kind in ('article', 'revision', 'suggestion', 'profile', 'media')),
  target_id text not null,
  reason text not null check (reason in ('harassment', 'violence', 'ncii', 'copyright', 'impersonation', 'spam', 'other')),
  detail text not null default '',
  status text not null default 'open' check (status in ('open', 'actioned', 'no_action')),
  created_at timestamptz not null default now()
);
alter table public.nw_reports enable row level security;
create policy nw_reports_reporter_insert on public.nw_reports
  for insert with check (
    reporter_id is null
    or auth.uid() = (select user_id from public.nw_profiles where id = reporter_id)
  );
create policy nw_reports_reporter_select on public.nw_reports
  for select using (
    auth.uid() = (select user_id from public.nw_profiles where id = reporter_id)
  );
-- Review happens in the moderation console (service role). NCII reports also
-- start the 48h SLA clock in nw_job_config-driven workers (Phase 5).

create table if not exists public.nw_terms_acceptance (
  user_id uuid not null references auth.users (id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, terms_version)
);
alter table public.nw_terms_acceptance enable row level security;
create policy nw_terms_acceptance_self_all on public.nw_terms_acceptance
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================ indexes

create index if not exists idx_nw_articles_author on public.nw_articles (author_id, status);
create index if not exists idx_nw_articles_published on public.nw_articles (published_at desc) where status = 'published';
create index if not exists idx_nw_suggestions_article on public.nw_edit_suggestions (article_id, status);
create index if not exists idx_nw_suggestions_editor on public.nw_edit_suggestions (editor_id, status);
create index if not exists idx_nw_suggestion_events_sugg on public.nw_suggestion_events (suggestion_id, created_at);
create index if not exists idx_nw_credibility_editor on public.nw_credibility_ledger (editor_id, awarded_at);
create index if not exists idx_nw_follows_journalist on public.nw_follows (journalist_id);
create index if not exists idx_nw_supports_journalist on public.nw_supports (journalist_id, status);
create index if not exists idx_nw_transfer_journalist on public.nw_transfer_ledger (journalist_id, created_at);
create index if not exists idx_nw_reports_status on public.nw_reports (status, created_at);
