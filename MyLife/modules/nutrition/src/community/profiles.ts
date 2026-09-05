import type { DatabaseAdapter } from '@mylife/db';
import type { CommunityProfile, ProfileVisibility } from './types';

// -- Share code generation ---------------------------------------------------

export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for readability
  let code = '';
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    code += chars[idx];
  }
  return `NUTR-${code}`;
}

// -- Profile CRUD ------------------------------------------------------------

export function createProfile(
  db: DatabaseAdapter,
  input: {
    displayName: string;
    avatarEmoji?: string;
    bio?: string;
    shareStreaks?: boolean;
    shareGoals?: boolean;
    shareCalories?: boolean;
    shareMacros?: boolean;
    shareWeight?: boolean;
    profileVisibility?: ProfileVisibility;
  },
): CommunityProfile {
  if (!input.displayName || input.displayName.trim().length === 0) {
    throw new Error('Display name is required');
  }
  if (input.displayName.length > 30) {
    throw new Error('Display name must be 30 characters or fewer');
  }

  // Check if profile already exists (single-user: only one profile)
  const existing = db.query('SELECT id FROM nu_community_profiles LIMIT 1');
  if (existing.length > 0) {
    throw new Error('Profile already exists');
  }

  const id = generateShareCode();
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO nu_community_profiles (id, display_name, avatar_emoji, bio, share_streaks, share_goals, share_calories, share_macros, share_weight, profile_visibility, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.displayName.trim(),
      input.avatarEmoji ?? '\u{1F966}',
      input.bio ?? null,
      input.shareStreaks !== false ? 1 : 0,
      input.shareGoals ? 1 : 0,
      input.shareCalories ? 1 : 0,
      input.shareMacros ? 1 : 0,
      input.shareWeight ? 1 : 0,
      input.profileVisibility ?? 'connections',
      now,
      now,
    ],
  );

  const rows = db.query('SELECT * FROM nu_community_profiles WHERE id = ?', [id]);
  return mapProfile(rows[0]);
}

export function getProfile(db: DatabaseAdapter): CommunityProfile | null {
  const rows = db.query('SELECT * FROM nu_community_profiles LIMIT 1');
  return rows.length > 0 ? mapProfile(rows[0]) : null;
}

export function getProfileById(db: DatabaseAdapter, id: string): CommunityProfile | null {
  const rows = db.query('SELECT * FROM nu_community_profiles WHERE id = ?', [id]);
  return rows.length > 0 ? mapProfile(rows[0]) : null;
}

export function updateProfile(
  db: DatabaseAdapter,
  id: string,
  input: Partial<{
    displayName: string;
    avatarEmoji: string;
    bio: string | null;
    shareStreaks: boolean;
    shareGoals: boolean;
    shareCalories: boolean;
    shareMacros: boolean;
    shareWeight: boolean;
    profileVisibility: ProfileVisibility;
  }>,
): CommunityProfile {
  if (input.displayName !== undefined) {
    if (!input.displayName || input.displayName.trim().length === 0) {
      throw new Error('Display name is required');
    }
    if (input.displayName.length > 30) {
      throw new Error('Display name must be 30 characters or fewer');
    }
  }

  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.displayName !== undefined) { sets.push('display_name = ?'); params.push(input.displayName.trim()); }
  if (input.avatarEmoji !== undefined) { sets.push('avatar_emoji = ?'); params.push(input.avatarEmoji); }
  if (input.bio !== undefined) { sets.push('bio = ?'); params.push(input.bio); }
  if (input.shareStreaks !== undefined) { sets.push('share_streaks = ?'); params.push(input.shareStreaks ? 1 : 0); }
  if (input.shareGoals !== undefined) { sets.push('share_goals = ?'); params.push(input.shareGoals ? 1 : 0); }
  if (input.shareCalories !== undefined) { sets.push('share_calories = ?'); params.push(input.shareCalories ? 1 : 0); }
  if (input.shareMacros !== undefined) { sets.push('share_macros = ?'); params.push(input.shareMacros ? 1 : 0); }
  if (input.shareWeight !== undefined) { sets.push('share_weight = ?'); params.push(input.shareWeight ? 1 : 0); }
  if (input.profileVisibility !== undefined) { sets.push('profile_visibility = ?'); params.push(input.profileVisibility); }

  if (sets.length === 0) return getProfileById(db, id)!;

  sets.push("updated_at = datetime('now')");
  params.push(id);

  db.execute(`UPDATE nu_community_profiles SET ${sets.join(', ')} WHERE id = ?`, params);
  const rows = db.query('SELECT * FROM nu_community_profiles WHERE id = ?', [id]);
  return mapProfile(rows[0]);
}

export function deleteProfile(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM nu_community_profiles WHERE id = ?', [id]);
}

// -- Row mapper --------------------------------------------------------------

function mapProfile(row: Record<string, unknown>): CommunityProfile {
  return {
    id: row.id as string,
    displayName: row.display_name as string,
    avatarEmoji: row.avatar_emoji as string,
    bio: row.bio as string | null,
    shareStreaks: (row.share_streaks as number) === 1,
    shareGoals: (row.share_goals as number) === 1,
    shareCalories: (row.share_calories as number) === 1,
    shareMacros: (row.share_macros as number) === 1,
    shareWeight: (row.share_weight as number) === 1,
    profileVisibility: row.profile_visibility as ProfileVisibility,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
