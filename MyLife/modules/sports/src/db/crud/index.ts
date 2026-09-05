export {
  followTeam,
  unfollowTeam,
  updateTeam,
  updateTeamTier,
  setTeamRival,
  updateTeamNotifications,
  listFollowedTeams,
  getTeamById,
  countFollowedTeams,
} from './teams';

export {
  upsertGames,
  pruneGamesOlderThan,
  getGameById,
  listGamesForDate,
  listGamesForTeams,
  listByDateRange,
} from './games';
export type {
  ListGamesForTeamsOptions,
  ListByDateRangeOptions,
} from './games';

export {
  recordNotification,
  listRecentNotifications,
  pruneOlderThan as pruneNotificationsOlderThan,
} from './notifications-log';
export type {
  NotificationEventType,
  NotificationLogEntry,
  ListRecentNotificationsOptions,
} from './notifications-log';

export {
  insertBet,
  getBet,
  listBets,
  listBetLegs,
  updateBetNotes,
  settleBet,
  settleBetLeg,
  deleteBet,
} from './bets';
export type {
  BetInsertInput,
  BetLegInsertInput,
  ListBetsFilters,
} from './bets';

export {
  ensureDefaultBankroll,
  getBankroll,
  updateBankroll,
} from './bankroll';
export type { UpdateBankrollPatch } from './bankroll';

export {
  getSetting,
  setSetting,
  getBetLimits,
  setBetLimits,
  sumStakesSince,
} from './settings';
export type { BetLimits, BetLimitsPatch } from './settings';

export {
  createFantasyLeague,
  getFantasyLeague,
  listFantasyLeagues,
  updateFantasyLeague,
  updateFantasyLeagueRecord,
  deleteFantasyLeague,
  logFantasyTransaction,
  listFantasyTransactions,
  getFantasyDraftLog,
  getFantasyTradeHistory,
  deleteFantasyTransaction,
} from './fantasy';
export type {
  CreateFantasyLeagueInput,
  UpdateFantasyLeagueInput,
  UpdateFantasyLeagueRecordInput,
  ListFantasyLeaguesFilters,
  LogFantasyTransactionInput,
  ListFantasyTransactionsFilters,
} from './fantasy';

export {
  logSession,
  getSession,
  listSessions,
  updateSession,
  deleteSession,
  getPersonalBests,
} from './participation';
export type {
  LogSessionInput,
  UpdateSessionInput,
  ListSessionsFilters,
} from './participation';

export {
  createRecLeague,
  getRecLeague,
  listRecLeagues,
  updateRecLeague,
  updateRecLeagueRecord,
  addScheduleEntry,
  getUpcomingGames,
  deleteRecLeague,
} from './rec-leagues';
export type {
  CreateRecLeagueInput,
  UpdateRecLeagueInput,
  UpdateRecLeagueRecordInput,
  ListRecLeaguesFilters,
} from './rec-leagues';

export {
  logAttendance,
  getAttendance,
  listAttendance,
  updateAttendance,
  deleteAttendance,
  getAttendanceStats,
} from './attendance';
export type {
  LogAttendanceInput,
  UpdateAttendanceInput,
  ListAttendanceFilters,
  AttendanceStats,
} from './attendance';

export {
  createVenue,
  getVenue,
  listVenues,
  updateVenue,
  markVisited,
  setBucketList,
  deleteVenue,
} from './venues';
export type {
  CreateVenueInput,
  UpdateVenueInput,
  ListVenuesFilters,
} from './venues';

export {
  createMemorabilia,
  getMemorabilia,
  listMemorabilia,
  updateMemorabilia,
  deleteMemorabilia,
  getCollectionValue,
} from './memorabilia';
export type {
  CreateMemorabiliaInput,
  UpdateMemorabiliaInput,
  ListMemorabiliaFilters,
  CollectionValue,
} from './memorabilia';

export {
  createPrediction,
  getPrediction,
  listPredictions,
  updatePrediction,
  settlePrediction,
  unsettlePrediction,
  deletePrediction,
} from './predictions';
export type {
  CreatePredictionInput,
  UpdatePredictionInput,
  ListPredictionsFilters,
  SettlePredictionInput,
} from './predictions';
