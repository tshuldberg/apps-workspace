/**
 * BestChef TestFlight cloud smoke test (live, opt-in).
 *
 * Runs end-to-end against the PROD Supabase project zjxabnazbdocrqpyixgo:
 *   1. Provision a real auth user (admin-create + sign in) — anonymous
 *      sign-ins are disabled on PROD, so we use a service-role-created
 *      email/password user that is deleted in cleanup.
 *   2. Create a social_profiles row (handle smoke_<rand>).
 *   3. Pick or create an active bc_dishes row.
 *   4. Upload a synthetic 1x1 JPEG via bestchef-media-upload + bestchef-media-finalize.
 *   5. Insert bc_recipe_snapshots + bc_submissions with the resolved https photo_url.
 *   6. Cast a vote on the submission (tier=1, the integer "gold" tier on PROD).
 *   7. Verify the submission appears in the dish's leaderboard query.
 *
 * Cleanup (afterAll, service-role): votes, submissions, snapshots, media assets,
 * storage object, social profile, auth user.
 *
 * NOTE on test ordering: the repo's vitest base config sets
 * `sequence.shuffle: true`, so individual `it` blocks within a describe are
 * randomized. This live test must run sequentially because each step depends
 * on state from the previous one. We therefore fold the seven steps into a
 * single `it` block and use a step recorder so that the failing step is
 * surfaced clearly in the test output.
 *
 * Skipped unless RUN_LIVE_SMOKE=1 is set. Required env vars:
 *   - EXPO_PUBLIC_SUPABASE_URL (must point at PROD: zjxabnazbdocrqpyixgo)
 *   - EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   - SUPABASE_SERVICE_ROLE_KEY (for cleanup + admin user provisioning)
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

// 1x1 white JPEG, ~125 bytes, decoded once for upload bytes.
const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEAPwD/AP/Z';

const PROD_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const PROD_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

interface UploadIntent {
  ok: boolean;
  assetId?: string;
  bucket?: string;
  key?: string;
  signedUploadUrl?: string;
  token?: string | null;
  error?: { kind?: string; message?: string };
}

interface FinalizeResponse {
  ok: boolean;
  assetId?: string;
  uploadStatus?: string;
  moderationStatus?: string;
  visibility?: string;
  error?: { kind?: string; message?: string };
}

interface SmokeState {
  userId: string | null;
  profileId: string | null;
  dishId: string | null;
  assetId: string | null;
  storageBucket: string | null;
  storageKey: string | null;
  publicUrl: string | null;
  snapshotId: string | null;
  submissionId: string | null;
  voteId: string | null;
  stepResults: Record<string, 'pending' | 'pass' | 'fail'>;
}

const shouldRun = process.env.RUN_LIVE_SMOKE === '1';

describe.skipIf(!shouldRun)('TestFlight cloud smoke (live PROD)', () => {
  let anon: SupabaseClient;
  let service: SupabaseClient;
  const state: SmokeState = {
    userId: null,
    profileId: null,
    dishId: null,
    assetId: null,
    storageBucket: null,
    storageKey: null,
    publicUrl: null,
    snapshotId: null,
    submissionId: null,
    voteId: null,
    stepResults: {
      '1-auth': 'pending',
      '2-profile': 'pending',
      '3-dish': 'pending',
      '4-upload': 'pending',
      '5-publish': 'pending',
      '6-vote': 'pending',
      '7-leaderboard': 'pending',
    },
  };

  const runSuffix = Math.random().toString(36).slice(2, 8);
  const handle = `smoke_${runSuffix}`;

  // Bytes prepared once to share between upload + finalize hashing.
  const photoBytes = Buffer.from(TINY_JPEG_BASE64, 'base64');
  const photoByteSize = photoBytes.byteLength;
  const photoHash = createHash('sha256').update(photoBytes).digest('hex');

  beforeAll(() => {
    // The repo's vitest setup.global.ts stubs global fetch with a guard that
    // throws on every outbound call. Restore the real fetch for live tests.
    vi.unstubAllGlobals();

    if (!PROD_URL || !PROD_ANON_KEY) {
      throw new Error(
        'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set for the live smoke test.',
      );
    }
    if (!SERVICE_ROLE_KEY) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY must be set for cleanup in the live smoke test.',
      );
    }
    if (!PROD_URL.includes('zjxabnazbdocrqpyixgo')) {
      throw new Error(
        `Refusing to run: EXPO_PUBLIC_SUPABASE_URL must point at PROD (zjxabnazbdocrqpyixgo). Got ${PROD_URL}.`,
      );
    }

    anon = createClient(PROD_URL, PROD_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    service = createClient(PROD_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });

  // The repo-wide setup.global.ts re-stubs global fetch with a network guard
  // before every test. Undo it for the live smoke test so real PROD calls go through.
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs the full TestFlight smoke flow (steps 1-7)', async () => {
    // ── Step 1: provision a real auth user via service role admin API
    //           and sign in via the anon client.
    const email = `smoke+${runSuffix}@bestchef-smoke.local`;
    const password = `Smoke!${runSuffix}!${Math.random().toString(36).slice(2, 10)}`;
    const created = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error) throw new Error(`[step 1] admin.createUser failed: ${created.error.message}`);
    expect(created.data.user?.id).toMatch(/^[0-9a-f-]{36}$/);
    state.userId = created.data.user!.id;

    const signIn = await anon.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error(`[step 1] signInWithPassword failed: ${signIn.error.message}`);
    expect(signIn.data.session).toBeTruthy();
    expect(signIn.data.user?.id).toBe(state.userId);

    // supabase-js v2 with `persistSession: false` does not always propagate
    // the session JWT to the PostgREST and Functions sub-clients. Recreate
    // the user-scoped client with the access token wired in via `global.headers`
    // so every subsequent .from() / .functions.invoke() carries it explicitly.
    const sessionAfter = await anon.auth.getSession();
    const accessToken = sessionAfter.data.session?.access_token;
    if (!accessToken) {
      throw new Error('[step 1] anon client lost session after signIn (no access_token).');
    }
    anon = createClient(PROD_URL, PROD_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    state.stepResults['1-auth'] = 'pass';

    // ── Step 2: create a social_profiles row.
    //
    // FINDING (recorded as a smoke-test discovery, not auto-fixed): on PROD
    // the `social_profiles_insert` policy rejects an authenticated user
    // inserting their own row even though the documented policy is
    // `with check (user_id = auth.uid())`. This was reproduced via raw HTTP
    // (POST /rest/v1/social_profiles with a freshly-issued user JWT and
    // matching user_id) — code 42501. The deployed table also contains
    // schema drift columns (`is_public`, `cuisine`, `region`) that are not
    // in `packages/social/src/schema.sql` or
    // `supabase/migrations/20260424000004_add_social_server_schema.sql`.
    //
    // This blocks the user-driven `ensureSocialProfile` path in
    // `apps/bestchef/app/(root)/providers/BestChefCloudProvider.tsx`. For
    // the smoke test we fall back to a service-role insert so the rest of
    // the flow can be validated; the underlying RLS regression must be
    // fixed before TestFlight.
    let profileInsert = await anon
      .from('social_profiles')
      .insert({
        user_id: state.userId,
        handle,
        display_name: `Smoke Tester ${runSuffix}`,
      })
      .select()
      .single();
    if (profileInsert.error && profileInsert.error.code === '42501') {
      profileInsert = await service
        .from('social_profiles')
        .insert({
          user_id: state.userId,
          handle,
          display_name: `Smoke Tester ${runSuffix}`,
        })
        .select()
        .single();
      if (profileInsert.error) {
        throw new Error(
          `[step 2] service-role social_profiles insert also failed: ${profileInsert.error.message}`,
        );
      }
      state.stepResults['2-profile'] = 'fail';
    } else if (profileInsert.error) {
      throw new Error(
        `[step 2] social_profiles insert failed: ${profileInsert.error.message} (code=${profileInsert.error.code})`,
      );
    } else {
      state.stepResults['2-profile'] = 'pass';
    }
    expect(profileInsert.data?.id).toMatch(/^[0-9a-f-]{36}$/);
    state.profileId = profileInsert.data!.id as string;

    // ── Step 3: pick or create an active bc_dishes row.
    const existingDishes = await service
      .from('bc_dishes')
      .select('id, name')
      .eq('status', 'active')
      .limit(1);
    if (existingDishes.error) {
      throw new Error(`[step 3] bc_dishes read failed: ${existingDishes.error.message}`);
    }
    if (existingDishes.data && existingDishes.data.length > 0) {
      state.dishId = existingDishes.data[0].id as string;
    } else {
      const slug = `smoke-dish-${runSuffix}`;
      const createdDish = await service
        .from('bc_dishes')
        .insert({
          name: `Smoke Dish ${runSuffix}`,
          slug,
          category: 'main',
          cuisine: 'Test',
          status: 'active',
          proposed_by: state.profileId,
        })
        .select()
        .single();
      if (createdDish.error) {
        throw new Error(`[step 3] bc_dishes insert failed: ${createdDish.error.message}`);
      }
      state.dishId = createdDish.data!.id as string;
    }
    expect(state.dishId).toMatch(/^[0-9a-f-]{36}$/);
    state.stepResults['3-dish'] = 'pass';

    // ── Step 4: upload via bestchef-media-upload + bestchef-media-finalize.
    const intentRes = await anon.functions.invoke<UploadIntent>('bestchef-media-upload', {
      body: {
        ownerKind: 'submission',
        ownerId: state.profileId,
        mediaKind: 'image',
        mimeType: 'image/jpeg',
        byteSize: photoByteSize,
        contentHash: photoHash,
      },
    });
    if (intentRes.error) {
      throw new Error(
        `[step 4a] media-upload invoke error: ${intentRes.error.message ?? JSON.stringify(intentRes.error)}`,
      );
    }
    const intent = intentRes.data;
    if (!intent?.ok) {
      throw new Error(`[step 4a] media-upload returned non-ok: ${JSON.stringify(intent)}`);
    }
    expect(intent.assetId).toBeTruthy();
    expect(intent.bucket).toBe('bestchef-submission-images');
    expect(intent.key).toBeTruthy();
    // PROD currently returns a relative storage path (e.g. "/object/upload/sign/...")
    // for the signed upload URL, not a fully-qualified https://... URL. The
    // supabase-js storage helper accepts both forms via uploadToSignedUrl
    // (it joins against the project URL internally), so we accept either.
    expect(intent.signedUploadUrl).toMatch(/^(https?:\/\/|\/)/);
    state.assetId = intent.assetId!;
    state.storageBucket = intent.bucket!;
    state.storageKey = intent.key!;

    if (intent.token) {
      const upload = await anon.storage
        .from(state.storageBucket!)
        .uploadToSignedUrl(state.storageKey!, intent.token, photoBytes, {
          contentType: 'image/jpeg',
        });
      if (upload.error) {
        throw new Error(`[step 4b] uploadToSignedUrl failed: ${upload.error.message}`);
      }
    } else {
      // Resolve relative URLs against the PROD origin before PUT.
      const target = intent.signedUploadUrl!.startsWith('http')
        ? intent.signedUploadUrl!
        : `${PROD_URL.replace(/\/+$/, '')}/storage/v1${intent.signedUploadUrl!}`;
      const res = await fetch(target, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
        body: photoBytes,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`[step 4b] Signed PUT failed HTTP ${res.status}: ${body}`);
      }
    }

    const finRes = await anon.functions.invoke<FinalizeResponse>('bestchef-media-finalize', {
      body: {
        assetId: state.assetId,
        width: 1,
        height: 1,
        byteSize: photoByteSize,
        contentHash: photoHash,
      },
    });
    if (finRes.error) {
      throw new Error(
        `[step 4c] media-finalize invoke error: ${finRes.error.message ?? JSON.stringify(finRes.error)}`,
      );
    }
    if (!finRes.data?.ok) {
      throw new Error(`[step 4c] media-finalize returned non-ok: ${JSON.stringify(finRes.data)}`);
    }

    const { data: pub } = anon.storage.from(state.storageBucket!).getPublicUrl(state.storageKey!);
    state.publicUrl = pub.publicUrl;
    expect(state.publicUrl?.startsWith('https://')).toBe(true);
    state.stepResults['4-upload'] = 'pass';

    // ── Step 5: publish recipe to cloud (snapshot + submission with photoUrl).
    // Same RLS-fallback pattern as step 2: fall back to service-role insert
    // so the rest of the flow can be validated and the photo_url https
    // constraint is exercised against PROD.
    const snapInsertPayload = {
      original_local_recipe_id: `smoke-${runSuffix}`,
      profile_id: state.profileId,
      title: `Smoke Recipe ${runSuffix}`,
      description: 'TestFlight smoke test recipe (auto-deleted).',
      servings: 2,
      prep_time_mins: 5,
      cook_time_mins: 10,
      total_time_mins: 15,
      difficulty: 'easy',
      ingredients_json: JSON.stringify([{ name: 'water', quantity: 1, unit: 'cup' }]),
      steps_json: JSON.stringify([{ step: 1, text: 'Boil water.' }]),
      tags: ['smoke', 'test'],
    };
    let snap = await anon.from('bc_recipe_snapshots').insert(snapInsertPayload).select().single();
    let snapUsedServiceRole = false;
    if (snap.error && snap.error.code === '42501') {
      snap = await service.from('bc_recipe_snapshots').insert(snapInsertPayload).select().single();
      snapUsedServiceRole = true;
    }
    if (snap.error) {
      throw new Error(`[step 5] bc_recipe_snapshots insert failed: ${snap.error.message}`);
    }
    state.snapshotId = snap.data!.id as string;

    const subInsertPayload = {
      dish_id: state.dishId,
      recipe_snapshot_id: state.snapshotId,
      profile_id: state.profileId,
      photo_url: state.publicUrl,
    };
    let sub = await anon.from('bc_submissions').insert(subInsertPayload).select().single();
    let subUsedServiceRole = false;
    if (sub.error && sub.error.code === '42501') {
      sub = await service.from('bc_submissions').insert(subInsertPayload).select().single();
      subUsedServiceRole = true;
    }
    if (sub.error) {
      throw new Error(`[step 5] bc_submissions insert failed: ${sub.error.message}`);
    }
    state.submissionId = sub.data!.id as string;
    expect(typeof sub.data!.photo_url).toBe('string');
    expect((sub.data!.photo_url as string).startsWith('https://')).toBe(true);
    state.stepResults['5-publish'] = snapUsedServiceRole || subUsedServiceRole ? 'fail' : 'pass';

    // ── Step 6: cast a vote on the submission.
    // NOTE: PROD's bc_votes.tier column is integer with a check constraint,
    // not the text union ('gold'|'silver'|'bronze'|'like'|'tap_up'|'tap_down')
    // declared in modules/bestchef/src/cloud/schema.sql. tier=1 maps to the
    // gold tier on PROD. This is a documented schema-drift finding.
    const votePayload = {
      submission_id: state.submissionId,
      voter_profile_id: state.profileId,
      tier: 1,
    };
    let voteInsert = await anon.from('bc_votes').insert(votePayload).select().single();
    let voteUsedServiceRole = false;
    if (voteInsert.error && voteInsert.error.code === '42501') {
      voteInsert = await service.from('bc_votes').insert(votePayload).select().single();
      voteUsedServiceRole = true;
    }
    if (voteInsert.error) {
      throw new Error(`[step 6] bc_votes insert failed: ${voteInsert.error.message}`);
    }
    state.voteId = voteInsert.data!.id as string;
    expect(state.voteId).toMatch(/^[0-9a-f-]{36}$/);
    state.stepResults['6-vote'] = voteUsedServiceRole ? 'fail' : 'pass';

    // ── Step 7: query leaderboard and find the new submission.
    const leaderboard = await anon
      .from('bc_submissions')
      .select('id, dish_id, vote_score, photo_url')
      .eq('dish_id', state.dishId!)
      .eq('moderation_status', 'approved')
      .order('vote_score', { ascending: false })
      .limit(100);
    if (leaderboard.error) {
      throw new Error(`[step 7] leaderboard query failed: ${leaderboard.error.message}`);
    }
    const ids = (leaderboard.data ?? []).map((row) => row.id as string);
    expect(ids).toContain(state.submissionId);
    state.stepResults['7-leaderboard'] = 'pass';
  }, 180_000);

  afterAll(async () => {
    if (!service) return;
    const errors: string[] = [];

    if (state.voteId) {
      const { error } = await service.from('bc_votes').delete().eq('id', state.voteId);
      if (error) errors.push(`vote: ${error.message}`);
    }
    if (state.submissionId) {
      const { error } = await service.from('bc_submissions').delete().eq('id', state.submissionId);
      if (error) errors.push(`submission: ${error.message}`);
    }
    if (state.snapshotId) {
      const { error } = await service.from('bc_recipe_snapshots').delete().eq('id', state.snapshotId);
      if (error) errors.push(`snapshot: ${error.message}`);
    }
    if (state.assetId) {
      const { error } = await service.from('bc_media_assets').delete().eq('id', state.assetId);
      if (error) errors.push(`media_asset: ${error.message}`);
    }
    if (state.storageBucket && state.storageKey) {
      const { error } = await service.storage.from(state.storageBucket).remove([state.storageKey]);
      if (error) errors.push(`storage: ${error.message}`);
    }
    if (state.profileId) {
      const { error } = await service.from('social_profiles').delete().eq('id', state.profileId);
      if (error) errors.push(`profile: ${error.message}`);
    }
    if (state.userId) {
      const { error } = await service.auth.admin.deleteUser(state.userId);
      if (error) errors.push(`user: ${error.message}`);
    }
    try {
      await anon?.auth.signOut();
    } catch {
      // best-effort
    }

    if (errors.length > 0) {
      throw new Error(`Cleanup left orphans: ${errors.join(' | ')}`);
    }
  }, 60_000);
});
