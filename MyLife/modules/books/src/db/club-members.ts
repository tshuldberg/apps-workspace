/**
 * Club Member CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface ClubMember {
  id: string;
  club_id: string;
  name: string;
  current_page: number;
  joined_at: string;
}

export function addClubMember(db: DatabaseAdapter, id: string, clubId: string, name: string): ClubMember {
  const now = new Date().toISOString();
  db.execute(
    'INSERT INTO bk_club_members (id, club_id, name, joined_at) VALUES (?, ?, ?, ?)',
    [id, clubId, name, now],
  );
  return { id, club_id: clubId, name, current_page: 0, joined_at: now };
}

export function getClubMembers(db: DatabaseAdapter, clubId: string): ClubMember[] {
  return db.query<ClubMember>(
    'SELECT * FROM bk_club_members WHERE club_id = ? ORDER BY name',
    [clubId],
  );
}

export function updateMemberProgress(db: DatabaseAdapter, memberId: string, currentPage: number): void {
  db.execute(
    'UPDATE bk_club_members SET current_page = ? WHERE id = ?',
    [currentPage, memberId],
  );
}

export function removeClubMember(db: DatabaseAdapter, memberId: string): void {
  db.execute('DELETE FROM bk_club_members WHERE id = ?', [memberId]);
}
