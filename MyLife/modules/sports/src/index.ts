export { SPORTS_MODULE } from './definition';

export {
  DEFAULT_SPORTS_MODULE_STATUS,
  SportsModuleStatusSchema,
  SqliteBoolSchema,
  FollowTierSchema,
  TeamSchema,
  CreateTeamInputSchema,
  SettingSchema,
  LeagueIdSchema,
  LeagueSchema,
  TeamSearchResultSchema,
  UpdateTeamInputSchema,
  UpdateTeamNotificationsInputSchema,
  GameStatusSchema,
  GameTeamSchema,
  GameSchema,
  StandingRowSchema,
  StandingGroupSchema,
  PeriodScoreSchema,
  GameLeaderSchema,
  GameDetailSchema,
  TimelineEventTypeSchema,
  TimelineEventSchema,
  isMajorEvent,
  BetTypeSchema,
  BetResultSchema,
  BetLegTypeSchema,
  BetSchema,
  BetLegSchema,
  BankrollSchema,
  FantasyPlatformSchema,
  FantasyFormatSchema,
  FantasyTransactionTypeSchema,
  FantasyPlayerSchema,
  FantasyLeagueSchema,
  FantasyTransactionSchema,
  ActivityTypeSchema,
  MoodSchema,
  SessionStatsSchema,
  ScheduleEntrySchema,
  ParticipationSessionSchema,
  RecLeagueSchema,
  StarRatingSchema,
  AttendanceSchema,
  VenueSchema,
  MemorabiliaTypeSchema,
  MemorabiliaSchema,
  PredictionCategorySchema,
  PredictionSchema,
} from './types';
export type {
  SportsModuleStatus,
  SqliteBool,
  FollowTier,
  Team,
  CreateTeamInput,
  Setting,
  LeagueId,
  League,
  TeamSearchResult,
  UpdateTeamInput,
  UpdateTeamNotificationsInput,
  GameStatus,
  GameTeam,
  Game,
  StandingRow,
  StandingGroup,
  PeriodScore,
  GameLeader,
  GameDetail,
  TimelineEventType,
  TimelineEvent,
  BetType,
  BetResult,
  BetLegType,
  Bet,
  BetLeg,
  Bankroll,
  FantasyPlatform,
  FantasyFormat,
  FantasyTransactionType,
  FantasyPlayer,
  FantasyLeague,
  FantasyTransaction,
  ActivityType,
  Mood,
  SessionStats,
  ScheduleEntry,
  ParticipationSession,
  RecLeague,
  StarRating,
  Attendance,
  Venue,
  MemorabiliaType,
  Memorabilia,
  PredictionCategory,
  Prediction,
} from './types';

export {
  V1_TABLES,
  V1_INDEXES,
  V2_TABLES,
  V2_INDEXES,
  V3_TABLES,
  V3_INDEXES,
  V4_TABLES,
  V4_INDEXES,
  V5_TABLES,
  V5_INDEXES,
  V6_TABLES,
  V6_INDEXES,
  V7_TABLES,
  V7_INDEXES,
  V8_TABLES,
  V8_INDEXES,
  SPORTS_MIGRATION_V2,
  SPORTS_MIGRATION_V3,
  SPORTS_MIGRATION_V4,
  SPORTS_MIGRATION_V5,
  SPORTS_MIGRATION_V6,
  SPORTS_MIGRATION_V7,
  SPORTS_MIGRATION_V8,
} from './db';

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
  upsertGames,
  pruneGamesOlderThan,
  getGameById,
  listGamesForDate,
  listGamesForTeams,
  listByDateRange,
  recordNotification,
  listRecentNotifications,
  pruneNotificationsOlderThan,
  insertBet,
  getBet,
  listBets,
  listBetLegs,
  updateBetNotes,
  settleBet,
  settleBetLeg,
  deleteBet,
  ensureDefaultBankroll,
  getBankroll,
  updateBankroll,
  getSetting,
  setSetting,
  getBetLimits,
  setBetLimits,
  sumStakesSince,
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
  logSession,
  getSession,
  listSessions,
  updateSession,
  deleteSession,
  getPersonalBests,
  createRecLeague,
  getRecLeague,
  listRecLeagues,
  updateRecLeague,
  updateRecLeagueRecord,
  addScheduleEntry,
  getUpcomingGames,
  deleteRecLeague,
  logAttendance,
  getAttendance,
  listAttendance,
  updateAttendance,
  deleteAttendance,
  getAttendanceStats,
  createVenue,
  getVenue,
  listVenues,
  updateVenue,
  markVisited,
  setBucketList,
  deleteVenue,
  createMemorabilia,
  getMemorabilia,
  listMemorabilia,
  updateMemorabilia,
  deleteMemorabilia,
  getCollectionValue,
  createPrediction,
  getPrediction,
  listPredictions,
  updatePrediction,
  settlePrediction,
  unsettlePrediction,
  deletePrediction,
} from './db/crud';
export type {
  ListGamesForTeamsOptions,
  ListByDateRangeOptions,
  NotificationEventType,
  NotificationLogEntry,
  ListRecentNotificationsOptions,
  BetInsertInput,
  BetLegInsertInput,
  ListBetsFilters,
  UpdateBankrollPatch,
  BetLimits,
  BetLimitsPatch,
  CreateFantasyLeagueInput,
  UpdateFantasyLeagueInput,
  UpdateFantasyLeagueRecordInput,
  ListFantasyLeaguesFilters,
  LogFantasyTransactionInput,
  ListFantasyTransactionsFilters,
  LogSessionInput,
  UpdateSessionInput,
  ListSessionsFilters,
  CreateRecLeagueInput,
  UpdateRecLeagueInput,
  UpdateRecLeagueRecordInput,
  ListRecLeaguesFilters,
  LogAttendanceInput,
  UpdateAttendanceInput,
  ListAttendanceFilters,
  AttendanceStats,
  CreateVenueInput,
  UpdateVenueInput,
  ListVenuesFilters,
  CreateMemorabiliaInput,
  UpdateMemorabiliaInput,
  ListMemorabiliaFilters,
  CollectionValue,
  CreatePredictionInput,
  UpdatePredictionInput,
  ListPredictionsFilters,
  SettlePredictionInput,
} from './db/crud';

export {
  detectPersonalBest,
  METRICS_BY_SPORT,
} from './engine/personal-bests';
export type {
  StatMetric,
  DetectPersonalBestResult,
} from './engine/personal-bests';

export {
  americanToDecimal,
  decimalToAmerican,
  americanToFractional,
  combineDecimalOdds,
  computeBetStats,
  groupStatsBy,
  computeStreak,
  computeUnitsPnL,
} from './engine/bet-analytics';
export type {
  BetStats,
  StreakSummary,
  UnitsPnL,
} from './engine/bet-analytics';

export {
  decideNotifications,
  isCloseGame,
  isOvertime,
  CLOSE_GAME_THRESHOLDS,
} from './engine/notification-rules';
export type {
  NotificationIntent,
  DecideNotificationsArgs,
  CloseGameThreshold,
} from './engine/notification-rules';

export {
  LAUNCH_LEAGUES,
  getLeagueById,
  buildTeamIndexUrl,
} from './engine/leagues';

export {
  searchTeams,
  clearTeamSearchCache,
} from './engine/team-search';
export type {
  TeamSearchFetch,
  SearchTeamsOptions,
} from './engine/team-search';

export {
  fetchLiveScores,
  clearScoreboardCache,
  SCOREBOARD_TTL_MS,
} from './engine/scores';
export type {
  ScoresFetch,
  FetchLiveScoresOptions,
} from './engine/scores';

export {
  pickInterval,
  LIVE_INTERVAL_MS,
  SOON_INTERVAL_MS,
  IDLE_INTERVAL_MS,
  SOON_WINDOW_MS,
} from './engine/polling';
export type { PickIntervalOptions } from './engine/polling';

export {
  fetchStandings,
  fetchStandingsForLeagues,
  findTeamRecord,
  clearStandingsCache,
  STANDINGS_TTL_MS,
} from './engine/standings';
export type {
  StandingsFetch,
  FetchStandingsOptions,
  FetchStandingsForLeaguesOptions,
} from './engine/standings';

export {
  fetchTeamSchedule,
  clearTeamScheduleCache,
  TEAM_SCHEDULE_TTL_MS,
} from './engine/team-schedule';
export type {
  TeamScheduleFetch,
  FetchTeamScheduleOptions,
} from './engine/team-schedule';

export {
  fetchGameDetail,
  clearGameDetailCache,
  pickGameDetailTtl,
  GAME_DETAIL_LIVE_TTL_MS,
  GAME_DETAIL_IDLE_TTL_MS,
} from './engine/game-detail';
export type {
  GameDetailFetch,
  FetchGameDetailOptions,
} from './engine/game-detail';

export {
  fetchGameTimeline,
  clearGameTimelineCache,
  pickTimelineTtl,
  TIMELINE_LIVE_TTL_MS,
  TIMELINE_FINAL_TTL_MS,
} from './engine/game-tracker';
export type {
  GameTimelineFetch,
  FetchGameTimelineOptions,
} from './engine/game-tracker';

export {
  fetchHistorySlice,
  computeCoveredDates,
  clearHistoryCache,
  HISTORY_SLICE_TTL_MS,
  HISTORY_FETCH_CONCURRENCY,
} from './engine/history';
export type {
  HistoryFetch,
  FetchHistorySliceOptions,
} from './engine/history';

export {
  fetchCurrentOdds,
  fetchFuturesOdds,
  clearOddsCache,
  ODDS_CACHE_TTL_MS,
  ODDS_NEGATIVE_TTL_MS,
} from './engine/odds-fetch';
export type {
  OddsSnapshot,
  OddsMarket,
  FetchCurrentOddsOptions,
  FetchFuturesOddsOptions,
} from './engine/odds-fetch';

export {
  generateYearInReview,
  makeCalendarYearWindow,
  makeRollingYearWindow,
} from './engine/year-in-review';
export type {
  YearWindow,
  YearInReviewInput,
  YearInReviewSummary,
} from './engine/year-in-review';

export { aggregateSportsSpending } from './engine/spending';
export type {
  SportsSpendingWindow,
  SportsSpendingInput,
  SportsSpendingSummary,
} from './engine/spending';

export { computePredictionAccuracy } from './engine/prediction-accuracy';
export type {
  AccuracyBreakdown,
  SeasonAccuracyRow,
  PredictionAccuracyReport,
} from './engine/prediction-accuracy';

export { computeMoodCorrelation } from './engine/mood-correlation';
export type {
  DailyMoodEntry,
  MoodCorrelationInput,
  MoodCorrelationSummary,
  PerGameMoodRow,
  PerGameOutcome,
} from './engine/mood-correlation';

export {
  LEAGUE_EVENT_PRESETS,
  STAT_REFERENCE_BASES,
  buildStatReferenceUrl,
  getLeagueCalendar,
  getUpcomingLeagueEvents,
  groupFavoritesByLeague,
  materializeLeagueEvents,
} from './engine/calendar';
export type {
  LeagueEvent,
  LeagueEventPreset,
  LeagueEventType,
  PlayerFavorite,
} from './engine/calendar';

export { summarizeTraining } from './engine/training-summary';
export type {
  TrainingWindow,
  TrainingSummaryInput,
  TrainingBySport,
  TrainingByWeek,
  TrainingSummary,
} from './engine/training-summary';

export {
  DEFAULT_GAME_DURATION_MS,
  buildSportsCalendar,
  gameToIcsEvent,
  leagueEventToIcsEvent,
  renderIcs,
} from './engine/calendar-export';
export type {
  IcsEventInput,
  SportsCalendarExportInput,
} from './engine/calendar-export';

export { extractVenueGeoPoints } from './engine/venue-geo';
export type { VenueGeoPoint } from './engine/venue-geo';
