export const ROOM_ADMISSION_STATE_SQL = `
-- Plan 25 WP-25E. The room-token service advances a durable admission generation when
-- moderation revokes a room. The generation feeds the opaque HMAC room name, so a token
-- minted for an older generation cannot rejoin the replacement room.

CREATE SCHEMA rooms;

CREATE TABLE rooms.admission_state (
  community_id text NOT NULL,
  room_id text NOT NULL,
  generation bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (community_id, room_id),
  CONSTRAINT room_admission_community_id_bounded
    CHECK (length(community_id) BETWEEN 1 AND 256),
  CONSTRAINT room_admission_room_id_bounded
    CHECK (length(room_id) BETWEEN 1 AND 256),
  CONSTRAINT room_admission_generation_valid
    CHECK (generation BETWEEN 1 AND 9007199254740991)
);
`;
