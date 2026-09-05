import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('social schema secure links', () => {
  it('defines secure friend link tables and the confirmation RPC', () => {
    const schema = readFileSync(
      new URL('../schema.sql', import.meta.url),
      'utf8',
    );

    expect(schema).toContain('create table if not exists social_friend_links');
    expect(schema).toContain('create table if not exists social_friendships');
    expect(schema).toContain('create or replace function social_confirm_friend_link');
    expect(schema).toContain('on conflict (follower_id, followee_id) do update');
  });

  it('has an active Supabase migration with social leaderboard RPCs', () => {
    const migration = readFileSync(
      new URL('../../../../supabase/migrations/20260424000004_add_social_server_schema.sql', import.meta.url),
      'utf8',
    );

    expect(migration).toContain('create table if not exists social_profiles');
    expect(migration).toContain('create table if not exists social_activities');
    expect(migration).toContain('create table if not exists social_comments');
    expect(migration).toContain('create table if not exists social_leaderboard_configs');
    expect(migration).toContain('create or replace function social_confirm_friend_link');
    expect(migration).toContain('create or replace function compute_leaderboard');
    expect(migration).toContain('create or replace function compute_friends_leaderboard');
    expect(migration).toContain('create or replace function social_guard_profile_user_update');
    expect(migration).toContain("raise exception 'Follow endpoints cannot be changed directly'");
    expect(migration).toContain("raise exception 'Unsupported leaderboard timeframe'");
  });
});
