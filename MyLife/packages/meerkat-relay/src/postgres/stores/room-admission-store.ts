/** PostgreSQL admission-generation store over migration 15 (rooms.admission_state). */

import type { QueryResult, QueryResultRow } from 'pg';
import type {
  AdmissionGenerationBump,
  AdmissionGenerationStore,
} from '../../room-admission-store';
import type { PostgresStoreContext } from '../store-context';
import { toPostgresStoreUnavailableError } from '../store-context';

const MAX_ROOM_SCOPE_CHARS = 256;

interface GenerationRow extends QueryResultRow {
  generation: unknown;
}

function assertRoomScopeId(name: string, value: string): void {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_ROOM_SCOPE_CHARS
    || value.trim().length === 0
  ) {
    throw new TypeError(`${name} must contain between 1 and ${MAX_ROOM_SCOPE_CHARS} characters`);
  }
}

function parseGeneration(value: unknown): number {
  const parsed = typeof value === 'bigint'
    ? Number(value)
    : typeof value === 'string' && /^\d+$/u.test(value)
      ? Number(value)
      : typeof value === 'number' ? value : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error('PostgreSQL room admission generation is invalid');
  }
  return parsed;
}

export class PostgresAdmissionGenerationStore implements AdmissionGenerationStore {
  constructor(private readonly database: PostgresStoreContext) {}

  private async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.database.query<Row>(text, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError('room admission store query', error);
    }
  }

  async getGeneration(communityId: string, roomId: string): Promise<number> {
    assertRoomScopeId('communityId', communityId);
    assertRoomScopeId('roomId', roomId);
    const result = await this.query<GenerationRow>(`
      SELECT generation::text AS generation
      FROM rooms.admission_state
      WHERE community_id = $1 AND room_id = $2
    `, [communityId, roomId]);
    const row = result.rows[0];
    return row ? parseGeneration(row.generation) : 1;
  }

  async bumpGeneration(communityId: string, roomId: string): Promise<AdmissionGenerationBump> {
    assertRoomScopeId('communityId', communityId);
    assertRoomScopeId('roomId', roomId);
    const result = await this.query<GenerationRow>(`
      INSERT INTO rooms.admission_state (
        community_id, room_id, generation, updated_at
      ) VALUES ($1, $2, 2, clock_timestamp())
      ON CONFLICT (community_id, room_id) DO UPDATE
      SET generation = rooms.admission_state.generation + 1,
          updated_at = clock_timestamp()
      RETURNING generation::text AS generation
    `, [communityId, roomId]);
    const row = result.rows[0];
    if (!row) throw new Error('PostgreSQL room admission bump returned no row');
    const generation = parseGeneration(row.generation);
    return { previousGeneration: generation - 1, generation };
  }
}
