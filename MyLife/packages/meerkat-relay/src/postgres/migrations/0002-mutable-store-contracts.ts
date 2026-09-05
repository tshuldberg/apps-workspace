import { COMMUNITY_DIRECTORY_SQL } from './0002-community-directory';
import { HOSTED_SQL } from './0002-hosted';
import { HUMANITY_PERSONA_SQL } from './0002-humanity-persona';
import { MODERATION_SQL } from './0002-moderation';
import { PUSH_ARCHIVE_OPS_SQL } from './0002-push-archive-ops';

export const MUTABLE_STORE_CONTRACTS_SQL = [
  COMMUNITY_DIRECTORY_SQL,
  HUMANITY_PERSONA_SQL,
  HOSTED_SQL,
  MODERATION_SQL,
  PUSH_ARCHIVE_OPS_SQL,
].join('\n');
