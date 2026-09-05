# MyLife Full Feature Inventory

Generated: 2026-03-23 | Source: module source code audit (index.ts + definition.ts per module)

**29 modules** | **28 wired on mobile** | **19 wired on web** | **~1,800+ exported functions**

---

## 1. MyBooks (`books`)

| Field | Value |
|-------|-------|
| Tagline | Track your reading life |
| Storage | SQLite | Prefix: `bk_` | Tier: premium |
| Schema | v5, 5 migrations |
| Tests | 18 files, 264 tests |

**CRUD (70+ functions):** Books (create/get/list/update/delete), Shelves, Tags, Reading Sessions, Reviews, Goals, Import Logs, OL Cache, Share Events, Reader Documents, Reader Notes, Progress Updates, Timed Sessions, Series + Series Books, Mood Tags, Content Warnings, Challenges + Challenge Progress, Journal Entries + Photos + Book Links, Badges, Community Challenges + Participation, Book Clubs + Club Notes + Club History

**Open Library API:** searchOpenLibrary, getBookDetails, transformOpenLibraryBook, getCoverImageUrl, searchByISBN, searchByAuthor, getEditionDetails

**Import/Export:** parseGoodreadsCSV, parseStoryGraphCSV, validateImportCSV, deduplicateImportedBooks, mapImportedBook, exportBooksCSV/JSON/Markdown, exportShelvesMarkdown, exportReviewsMarkdown

**Stats Engine:** calculateReadingStats, getYearInReview, getMonthlyReading, getReadingGoalProgress, getReadingRate, getBookCountByShelf/Author, getAverageRating

**Reader Engine:** parseEPub, parsePDF, extractEReaderHighlights, uploadReaderDocument, parseReaderNotes

**Progress Engine:** updateProgress, getReadingSpeed, getProgressTimeline, estimateCompletionDate, logProgressUpdate, getProgressPercentage

**Discovery Engine:** discoverBooks, getBookDiscoveryProfile, filterByMood/Genre/Author, recommendBasedOnHistory

**Challenge Engine:** getChallengeStatus, getActiveChallengeStatuses, logBookCompletion, logReadingMinutes, checkChallengeProgress, calculateChallengeStats

**Journal Engine:** createEntry, getDecryptedEntry, getReflectionsForBook, getJournalStats, exportJournalToMarkdown, encryptContent/decryptContent

**Social:** getShareEvents, createShareEvent, getSharedBooksWithFriends, createBadge, checkBadgeEligibility, awardBadge, createCommunityChallenge, getChallengeLeaderboard, createBookClub, addClubMember

---

## 2. MyBudget (`budget`)

| Field | Value |
|-------|-------|
| Tagline | Envelope budgeting made simple |
| Storage | SQLite | Prefix: `bg_` | Tier: premium |
| Schema | v6, 6 migrations |
| Tests | 15 files, 176 tests |

**CRUD (130+ functions):** Envelopes, Accounts, Transactions, Goals, Subscriptions (with pause/cancel/resume), Category Groups, Transaction Splits, Activity by Envelope, Recurring Templates, Transaction Rules, Payee Cache/Suggestions, Transfers, Net Worth Snapshots, Debt Payoff Plans + Debts, Rollovers, Budget Alerts + History, Currencies + Exchange Rates + History, Receipts, Categorization Feedback, Loans + Payments, Holdings + Snapshots, Families + Members + Invite Codes, Sync Log, Contacts, Expense Splits + Participants + Settlements, Age of Money Snapshots, Milestones, Cancellation Actions, Budget Export Bundle

**Subscription Engine:** advanceRenewalDate, getUpcomingRenewals, normalize (daily/monthly/annual), calculateSubscriptionSummary, validateTransition, getRenewalNotifications, getTrialExpirationAlerts, recordPriceChange, getPriceHistory, getLifetimeCost, scoreSubscription, getOpportunities, calculateSavings, searchCatalog

**Budget Engine:** calculateMonthBudget, getCarryForward, moveMoneyBetweenCategories, allocateToEnvelope, calculateNextDate, generateOccurrences, evaluateConditions, matchRule, applyRules, detectIncomeStreams, classifyIncomePattern, estimateMonthlyIncome, detectPaydays, predictNextPayday, calculateNetCash, calculateCashFlowByPeriod, calculateRunningBalance, calculateGoalProgress, suggestMonthlyContribution, isGoalOnTrack, getGoalProjection, getSpendingByCategory, getMonthlySpendingTrend, getBudgetedVsSpent, getTopPayees, calculateNetWorth, buildNetWorthTimeline, calculateSnowball, calculateAvalanche, generateAmortizationSchedule, projectPayoffDate, calculateRollover, processMonthRollover, checkAlerts, convertAmount, calculateAgeOfMoney, buildFifoQueue, bucketizeCategories, calculateSavingsRate, detectMilestones, parseReceiptText, calculateMonthlyPayment, generateLoanAmortization, calculateHoldingValue, calculatePortfolioSummary, calculateAllocation, generateInviteCode, resolveConflict, buildSyncPayload, calculateEqualSplit/PercentageSplit/SharesSplit

**Bank Sync:** connection lifecycle, multi-provider routing, token vault, webhook security, audit log, recurring transaction detection, subscription discovery

---

## 3. MyCar (`car`)

| Field | Value |
|-------|-------|
| Tagline | Vehicle maintenance tracker |
| Storage | SQLite | Prefix: `cr_` | Tier: premium |
| Schema | v10, 10 migrations |
| Tests | 1 file |

**CRUD (65+ functions):** Vehicles, Maintenance Records, Fuel Logs, Settings, Maintenance Schedules (with auto-link), Trips, Insurance Policies + Documents, Registrations + Documents, GPS Trips, Tire Sets + Measurements + Rotations, Parking (save/get/clear/history), Recalls, OBD Snapshots + Diagnostic Codes, Live Data Logs

**Reminder Engine:** calculateNextDue, calculateScheduleStatus, getDefaultSchedules, sortByUrgency

**Trip Engine:** calculateTripDistance, getTripSummaryByPurpose, estimateIrsDeduction

**Cost Engine:** calculateCostPerMile, getCostBreakdown, getMonthlyCostTrend

**Fuel Price Engine:** getAveragePricePerGallon, getPriceTrend, getStationAnalysis, getCheapestStation, getFuelCostProjection

**Insurance Engine:** getExpirationStatus, annualizePremium, getTotalAnnualPremium, maskPolicyNumber

**Registration Engine:** getRegExpirationStatus, getInspectionExpirationStatus, getDaysUntilExpiration

**GPS Engine:** haversineDistance, calculateRouteDistance, encodePolyline, decodePolyline, simplifyRoute, filterDriftPoints

**Tire Engine:** getTireHealth, getPositionHealth, calculateWearRate, predictReplacementMiles, getRecommendedRotationOdometer, getTireCostPerMile

**Parking Engine:** getMeterStatus, getMinutesRemaining, isStaleParking, calculateWalkingTime, validateCoordinates

**VIN Engine:** validateVin, calculateCheckDigit, getModelYear, parseNhtsaResponse

**OBD Engine:** getInitCommands, parseDtcResponse, buildDtcCode, getStandardPids, parsePidResponse, getMilStatus, lookupDtc, getDtcSystem, getDtcSeverity

---

## 4. MyCloset (`closet`)

| Field | Value |
|-------|-------|
| Tagline | Your wardrobe, fully private |
| Storage | SQLite | Prefix: `cl_` | Tier: premium |
| Schema | v3, 3 migrations |
| Tests | 1 file, 40 tests |

**CRUD (40+ functions):** Clothing Items (with dirty items list), Closet Tags, Outfits, Wear Events/Logs, Laundry Events, Packing Lists (with toggle/custom items), Settings, Donation Candidates, Dashboard, Wishlist Items, Capsule Wardrobes + Items, Suggestion Feedback, Export

**Analytics Engine:** calculateWardrobeValue, calculateCostPerWear, summarizeClosetDashboard

**Laundry Engine:** calculateAverageWearsBetweenWashes, groupDirtyItemsByCare

**Packing Engine:** inferPackingSeason, generatePackingSuggestions

**Cost-per-Wear Engine:** getCPWLeaderboard, getCPWByCategory, getCPWSummary

**Weather Engine:** scoreItemForWeather, recommendForWeather, temperature conversions, getLayerLabel, getRecommendedCategories

**Seasonal Engine:** detectCurrentSeason, shouldShowRotationReminder, getItemsToStore/Activate

**Outfit Suggestion Engine:** generateOutfitSuggestions, hashOutfitItems

**Capsule Wardrobe Engine:** calculateVersatilityScore, suggestCapsuleItems, analyzeCapsuleGaps, estimateOutfitCombinations

**Color Analysis Engine:** normalizeColor, getColorDistribution, generateColorInsights, getColorHarmonyPairs

---

## 5. MyCycle (`cycle`)

| Field | Value |
|-------|-------|
| Tagline | Private period and fertility tracker |
| Storage | SQLite | Prefix: `cy_` | Tier: premium |
| Schema | v4, 4 migrations |
| Tests | 2 files, 30+ tests |

**CRUD (40+ functions):** Cycles (create/get/end/delete), Cycle Days (by date and cycle), Symptoms, Cycle Stats, Symptom Frequencies, Temperatures (create/get/update/upsert/delete by date and range), Pregnancy Configs (create/get/history/end/updateDueDate), Appointments (create/get/upcoming/update/complete/delete), Partner Links (create/get/getByCode/update/revoke)

**Prediction Engine:** calculateAverageCycleLength, calculateAveragePeriodLength, predictNextPeriod, getCurrentPhase, isLateByDays

**Temperature Engine:** celsiusToFahrenheit, fahrenheitToCelsius, calculateCoverline, detectTemperatureShift, analyzeTemperatures

**Pregnancy Engine:** calculateDueDate (from LMP/conception/transfer), getLMPFromDueDate, getCurrentWeek, getCurrentTrimester, getDaysUntilDue, getPregnancyWeekInfo, isPastDue, formatWeekDisplay, PREGNANCY_WEEK_DATA

**Sharing Engine:** generateShareCode, generateSharedView, validateSnapshot, isSnapshotStale

---

## 6. MyFast (`fast`)

| Field | Value |
|-------|-------|
| Tagline | Intermittent fasting timer |
| Storage | SQLite | Prefix: `ft_` | Tier: **free** |
| Schema | v4, 4 migrations |
| Tests | 1 file |

**CRUD (35+ functions):** Fasts (create/getActive/getById/list/complete/cancel), Weight Entries, Custom Protocols, Goals + Progress, Water Intake, Streaks, Notification Configs, Settings

**Timer Engine:** computeTimerState, formatDuration

**Fasting Zones:** FASTING_ZONES, getCurrentFastingZone, getCurrentZoneProgress

**Stats Engine:** calculateDailyStreak, calculateMonthlyAggregation, getStreakSummary

**CSV Export:** exportFastsCSV, exportWeightCSV

**HealthKit Sync:** convertWeight, shouldImportWeight, mergeWeightEntries, calculateSyncWindow, formatFastForHealthKit

**Water Reminder Engine:** calculatePersonalizedTarget, calculateNextReminderTime, shouldSendReminder, generateReminderSlots

**Apple Watch Sync:** formatWatchState, handleWatchCommand, mapZoneToWatchColor

**Hydration Engine:** calculateDailyHydration, hydrationToGlasses, meetsHydrationTarget, computeHydration

**Caffeine Engine:** scaleCaffeine, calculateDailyCaffeine, remainingFromDose, calculateRemainingCaffeine, calculateClearByTime, getCaffeineStatus, hasLateCaffeine, buildCaffeineSummary

---

## 7. MyFlash (`flash`)

| Field | Value |
|-------|-------|
| Tagline | Spaced repetition flashcards |
| Storage | SQLite | Prefix: `fl_` | Tier: premium |
| Schema | v4, 4 migrations |
| Tests | 2 files, 34+ tests |

**CRUD (60+ functions):** Decks, Flashcards (with due/browse/rate/suspend/bury), Review Logs, Settings, Export + Export Records, Dashboard, Media Files (with ref counting), Multiple Choice Results, Match Game Results, Occlusion Regions, Custom Templates, Practice Tests (create/save/submit/complete/abandon), AI Conversations, Competitive Leagues + Members + Scores

**Scheduler Engine:** calculateStudyStreak, scheduleFlashcard (SM-2 style)

**Cloze Engine:** buildClozeFlashcards, parseClozeText, renderClozeFront/Back

**Search Engine:** parseFlashSearchQuery

**Reminders:** buildNotificationContent, parseReminderConfig, filterDueByDecks

**Streaks:** MILESTONES, checkMilestone, getBadgeColor, getAtRiskState, getEncouragingMessage

**Multiple Choice Engine:** getEligibleCards, generateMCQuestions, calculateMCScore

**Match Game Engine:** generateBoard, checkMatch, calculateStars

**AI Card Generation:** generateCardsOnDevice, generateCards, validateTextLength, extractDefinitions, deduplicateCards

**Media:** validateMediaFile, mediaTagForImage/Audio, removeMediaTag

**Occlusion Engine:** clampRegion, percentToPixel, pixelToPercent, regionContainsPoint, validateRegions

**Custom Templates:** renderCardContent, extractPlaceholders, validateTemplateInput, BUILTIN_TEMPLATE_IDS

**Practice Tests:** generate MC/TF/ShortAnswer/FillBlank questions, levenshteinDistance, normalizeAnswer, scoreShortAnswer, calculateTestScore

**Conversation Practice:** selectCardsForContext, formatCardContext, estimateTokens, buildSystemPrompt, extractPerformanceRating

**Competitive Leagues:** calculateXP, determinePromotions, generateInviteCode, TIER_DEFINITIONS/ORDER

---

## 8. MyForums (`forums`)

| Field | Value |
|-------|-------|
| Tagline | Community discussions, your way |
| Storage | Supabase + SQLite cache | Prefix: `fr_` | Tier: free |
| Schema | v2, 2 migrations |
| Tests | 0 files |

**Cache CRUD (27 functions):** Communities, Members, Threads, Replies, Bookmarks, Tags, Profiles, Conversations, Messages

**Cloud Client (48 functions):** Communities (get/create/search/join/leave), Threads (get/create/search), Replies, Votes, Bookmarks, User Stats, Mod Log, Reports, Community Rules, Tags, Profiles (get/create/update + badges + activity), Media (upload/get/delete), Link Previews, Conversations, Messages (DM with read receipts), Voice Channels (create/join/leave/participants), Federation (instances/block/unblock/actor)

**Engines:** Profile (validateUsername, getDefaultAvatarColor, getEligibleBadges), Media (resize/thumbnail/storagePath/detectType), Realtime (channel builders for threads/presence/feed/DM/voice, typing indicators, online counts), Messaging (find 1:1, block check, validate body, sort by last message), Voice (detectSpeaking, calculateRMS, getActiveParticipants, mesh connections), Federation (ActivityPub conversion, NodeInfo, signature headers)

---

## 9. MyGarden (`garden`)

| Field | Value |
|-------|-------|
| Tagline | Plant care and garden planner |
| Storage | SQLite | Prefix: `gd_` | Tier: premium |
| Schema | v2, 2 migrations |
| Tests | 2 files, 41 tests |

**CRUD (60+ functions):** Plants, Journal Entries, Zones (with stats), Seeds, Settings, Garden Stats, Watering Schedule, Identifications, Seasonal Tasks (complete/snooze), Harvests (with crop types), Diagnoses (with status), Wish List, Propagations (with stage advancement + child linking), Light Readings (with zone averages), Layouts + Layout Items, Frost Config

**Watering Engine:** calculateNextWaterDate, isDaysOverdue, getSeason, adjustFrequencyForSeason, calculateSurvivalRate, calculateGDD

**Companion Planting Engine:** checkCompatibility, getCompanions, getAntagonists, searchCompanionPlants, COMPANION_DATA

**Diagnosis Engine:** matchSymptoms, getAllSymptoms

**Light Engine:** classifyLight, lightLevelDescription, averageLux

**Propagation Engine:** isValidStageTransition, getNextStages, calculateSuccessRate

**Seasonal Engine:** getSeasonalTasksForCategory, getPlantCategories, inferCategory

**Frost Engine:** lookupZone, calculateCountdown, getCurrentFrostPhase, getPlantingCalendar, ZONE_FROST_DATES, PLANTING_CALENDAR

---

## 10. MyHabits (`habits`)

| Field | Value |
|-------|-------|
| Tagline | Build habits that stick |
| Storage | SQLite | Prefix: `hb_` | Tier: premium |
| Schema | v4, 4 migrations |
| Tests | 1 file |

**CRUD (100+ functions):** Habits, Completions (with date queries), Streaks (with grace periods, negative, measurable), Timed Sessions, Measurements, Settings, Cycle Tracking (periods/symptoms/predictions/fertility), Sobriety Profiles + Pledges, Cravings + Triggers, Milestones, Focus Sessions (Pomodoro), HealthKit Links, Programs + Enrollments, Badges, Time Tracking Projects, RPG/Gamification (player profiles + XP transactions), Pet/Avatar State, Location Reminders

**Stats Engine:** getHeatmapData, completionRateByDayOfWeek/TimeOfDay, monthlyCompletionRate, yearlyStats, overallStats

**Export Engine:** exportHabitsCSV, exportCompletionsCSV, exportAllCSV

**Cycle Engine:** predictNextPeriod, estimateFertilityWindow, PREDEFINED_SYMPTOMS

**Sobriety Engine:** calculateSobrietyDuration, calculateMoneySaved, calculateLifetimeStats, getPledgeStreak, analyzeTriggerFrequency, analyzeIntensityTrend, analyzeCopingEffectiveness

**Milestones Engine:** STREAK/COMPLETION/SOBRIETY milestones, detectNewMilestones, getNextMilestone

**Focus Engine (Pomodoro):** createPomodoroState, getRemainingMs, isPhaseComplete, advancePhase, pause/resume/skipPhase, formatTimerDisplay, calculateFocusStats

**HealthKit Engine:** HEALTHKIT_DATA_SOURCES, checkThreshold, getAutoTrackProgress

**Programs Engine:** BUILT_IN_PROGRAMS, interpolateSchedule, getCurrentDay, resolveDailyTarget, isProgramComplete

**Badges Engine:** BADGE_CATALOG (by category), detectNewBadges

**Time Tracking Engine:** calculateBillableAmount, formatDuration, generateTimeReport, generateCSV

**RPG Engine:** calculateXPForAction, xpForLevel, getLevelForXP, getXPProgress, calculateStreakBonus, UNLOCKABLE_ITEMS

**Siri Engine:** handleSiriCompletion, generateSiriResponse

**Pet Engine:** PET_SPECIES_CATALOG, calculatePetMood, getMoodEmoji, equipItem/unequipItem

**Location Engine:** shouldShowNotification, validateRadius/Coordinates, formatNotificationBody

**Cross-Module:** getSearchableContent, getDataSummary, getActivityFeed, getCorrelationData

---

## 11. MyHealth (`health`)

| Field | Value |
|-------|-------|
| Tagline | Your complete health companion |
| Storage | SQLite | Prefix: `hl_` | Tier: premium (fasting free) |
| Schema | v3, 3 migrations |
| Tests | 3 files |

**Re-exports all of @mylife/meds** (98 functions -- see Meds module below) plus @mylife/fast

**Health-Specific CRUD (39 functions):** Documents (by type, starred), Vitals (by type, date range, aggregates, latest), Sleep Sessions (with quality score), Goals + Progress, Emergency Info, Settings (with sync toggle), Absorption Migration (detect/migrate absorbed modules)

**Breathing Engine:** BREATHING_PATTERNS, getPatternConfig, calculateSessionDuration, calculateMoodDelta, getBreathingStats + CRUD

**Readiness Engine:** calculateReadinessScore, getRecommendation, normalize factors (sleep/HRV/RHR/activity/strain), calculateDataCompleteness + CRUD

**Activity Engine:** calculateRingProgress (all rings), isGoalMet, calculateStreak, aggregateDailySteps + CRUD

**Sleep Analysis:** calculateStageBreakdown, evaluateStageTargets, calculateSleepEfficiency, determineSleepTrend, analyzeSleepSession

**CBT Engine:** CBT_EXERCISES, getExercisePrompts, getCbtStats + CRUD

**HRV Engine:** calculateHrvBaseline, calculatePercentileRank, categorizeHrv, calculateHrvTrendDelta, generateHrvInsight, analyzeHrv

**Meditation Engine:** MEDITATION_TYPES, getMeditationPrompts, getMeditationStats, getMeditationStreak + CRUD

**Body Engine:** calculateBmi, getBmiCategory, calculateLeanMass, unit conversions, calculateMovingAverage + CRUD

**SOS Engine:** GROUNDING_STEPS, CRISIS_HOTLINES, getSosStats + CRUD

**Sleep Aids Engine:** WIND_DOWN_ROUTINES, AMBIENT_SOUNDS, SLEEP_HYGIENE_TIPS, calculateRoutineCorrelation + CRUD

**Data Aggregation:** deduplicateBatch, parseCsvRecords, buildImportSummary + import log CRUD

**SpO2 Engine:** categorizeSpo2, analyzeSpo2, checkSpo2LowAlert, determineSpo2Trend

**Sleep Bank Engine:** calculateSleepBank, getSleepBankStatus, getSleepBankTrend

**Timeline Engine:** createTimelineEvent, mergeTimelineEvents, filter/group/paginate, vital/sleep to timeline converters

**HR During Sleep:** getSleepHeartRateData, mapTimestampToStage, getStageAverages, calculateHrDip, calculateSleepHrAnalysis

**Smart Alarm:** calculateWakeWindow, parseTargetTime, shouldTriggerAlarm, calculateSuccessRate + CRUD (alarms + trigger history)

**Snore Detection:** classifySnoreIntensity, calculateSnorePercentage, calculateSnoreScore, getScoreCategory + CRUD (sessions + events)

---

## 12. MyHomes (`homes`)

| Field | Value |
|-------|-------|
| Tagline | Real estate, reimagined |
| Storage | Drizzle (tRPC) | Prefix: `hm_` | Tier: premium |
| Schema | v3, 3 migrations |
| Tests | 0 files |

**CRUD (63 functions):** Listings (with toggle saved, market metrics), Tours, Properties (with promote from listing), Maintenance Schedules, Settings, Cost Entries, Documents, Contractors (with favorites), Services, Insurance Policies, Rooms, Inventory Items, Appliances, Projects + Phases + Photos

**Schedule Engine:** getDefaultSchedules, calculateNextDueDate, calculateScheduleStatus, sortByUrgency, markComplete

**Cost Engine:** getCostSummary, getMonthlyCostTrend, getLifetimeCosts, getCostsBySchedule

**Document Engine:** getExpiringDocuments, searchDocuments, getDocumentStats

**Contractor Engine:** getContractorsBySpecialty, getFavoriteContractors, getContractorForTaskType, getContractorStats

**Insurance Engine:** getActivePolicies, getExpiringPolicies, getPolicyCostSummary, checkCoverageGaps

**Inventory Engine:** getPropertyInventoryValue, getRoomSummary, getItemsByCategory, getHighValueItems, exportInventoryCSV

**Appliance Engine:** getWarrantyStatus, getAppliancesNeedingAttention, searchAppliances

**Project Engine:** getProjectSummary, getBudgetVsActual, getPhaseProgress, getActiveProjectCount

---

## 13. MyJournal (`journal`)

| Field | Value |
|-------|-------|
| Tagline | Private daily journal |
| Storage | SQLite | Prefix: `jn_` | Tier: **free** |
| Schema | v4, 4 migrations |
| Tests | 2 files |

**CRUD (55+ functions):** Notebooks, Entries (with search, date queries), Tags, Settings, Dashboard, On This Day, Export, Voice Recordings (with transcription status), CBT Thought Records (with emotions/distortions steps), Therapy Topics (with ordering/completion)

**Stats Engine:** calculateJournalStreak, countWords, estimateReadingTimeMinutes, summarizeMoodDistribution

**Prompts Engine:** getDailyJournalPrompt, listJournalPromptCategories

**Voice Engine:** buildRecordingPath, shouldAutoStop, processTranscriptionResult

**Metadata Engine:** validateCoordinates, buildLocationData, formatPlaceName, mapWeatherCode, parseWeatherResponse

**CBT Engine:** calculateEmotionalImpact, calculateBeliefReduction, computeDistortionFrequency, COGNITIVE_DISTORTIONS, PREDEFINED_EMOTIONS

**Therapy Engine:** THERAPY_TEMPLATES, getTemplateSections, getNextSessionNumber, autoPopulateMoodSummary

**AI Prompts Engine:** analyzeMoodTrend, selectTheme, generatePrompt, PROMPT_THEMES

**Philosophy Engine:** getDayOfYear, getQuoteDayNumber, formatReflectionEntry

**Affirmations Engine:** selectDailyAffirmation, calculateAffirmationStreak, validateAffirmationText

**Grid Engine:** validateGridSize, assembleGridToMarkdown, BUILT_IN_LAYOUTS

**Vision Board Engine:** getExportDimensions, normalizedToPixels, validateItemSize, isBoardLimitReached

**Book Builder Engine:** getPageDimensions, estimatePageCount, formatEntryForPage, generateTOC, validateBookConfig

---

## 14. MyMail (`mail`)

| Field | Value |
|-------|-------|
| Tagline | Self-hosted private email |
| Storage | SQLite | Prefix: `ml_` | Tier: premium |
| Schema | v2, 2 migrations |
| Tests | 2 files |

**CRUD (53 functions):** Accounts, Messages (with read/star/move/delete), Drafts, Folders, Mail Stats, Attachments, Filters (with toggle), Contacts (with search/frequency/VIP), Threads (with mute), Calendar Events (with RSVP), Notification Preferences, Encryption Keys (with fingerprint/revoke), Sync State

**Search Engine:** searchMessages, groupByThread, getUnreadCount, filterByDateRange

**Attachment Engine:** getMimeType, getExtension, isBlockedExtension, validateFileSize/TotalSize, isPreviewableImage/Pdf

**Filter Engine:** applyFilters, matchesFilter, countMatches

**Contact Engine:** generateInitials, getAvatarColor, resolveContact, autoComplete, gravatarUrl

**Threading Engine:** normalizeSubject, resolveThread, buildThreadMetadata, sortThreadMessages

**Calendar Engine:** parseIcs, normalizeIcsDate, detectDatesInBody, eventToInput, generateRsvpReply

**Notification Engine:** buildNotification, isQuietHours, shouldNotify, batchNotification

**Encryption Engine:** computeFingerprint, findKeyForContact, canEncrypt, isPgpEncrypted, hasPgpSignature

**IMAP Engine:** autoDiscoverConfig, getSupportedProviders, guessConfig, parseHeader, parseReferences

---

## 15. MyMarket (`market`)

| Field | Value |
|-------|-------|
| Tagline | Buy, sell, and trade with your community |
| Storage | Supabase + SQLite cache | Prefix: `mk_` | Tier: free |
| Schema | v3, 3 migrations |
| Tests | 0 files |

**Cache CRUD:** Categories, Listings, Watchlist, Conversations, Messages

**Cloud Client (40+ functions):** Listings (CRUD + search + radius), Conversations (with request/respond flow), Secure Messaging (device registration, pre-key bundles, E2E envelopes), Watchlist, Seller Reviews/Stats, Saved Searches, Offers (make/respond/get), Price History, Reporting (listing/user), Blocking, Seller Verification, Shipping (tracking/shipments), Service Portfolios

**E2E Encryption (Signal-style):** generateKeyPair, performDH, hkdfDeriveKey, encryptMessage, decryptMessage, computeSafetyNumber

**Seller Verification Engine:** calculateVerificationLevel, resolveEffectiveLevel, canCreateListing

**Dispute Resolution Engine:** isValidTransition, isWithinFilingWindow, calculateRefundAmount, calculateResponseDeadline

**Shipping Engine:** isValidTrackingNumber, buildTrackingUrl, normalizeCarrierStatus, calculateProcessingFee

---

## 16. MyMeds (`meds`)

| Field | Value |
|-------|-------|
| Tagline | Never miss a dose |
| Storage | SQLite | Prefix: `md_` | Tier: premium |
| Schema | v4, 4 migrations |
| Tests | 10 files |

**CRUD (80+ functions):** Medications (basic + extended with pill count), Doses, Adherence, Settings, Refills (with burn rate/days remaining/low supply alerts), Reminders (with snooze/dismiss), Dose Logs (with undo), Interactions (with seed data), Measurements (with trend + med markers), Mood Entries, Activities, Symptoms (with predefined seed), Mood Calendar

**Analytics:** getMoodMedicationCorrelation, getSymptomMedicationCorrelation, getAdherenceMoodCorrelation, getOverallWellnessTimeline, getOverallStats

**Export:** generateDoctorReport, generateTherapyReport

**Blood Pressure Engine:** classifyBP, validateBP, calculateBPAverages, getCategoryDistribution, logBPReading + CRUD, getBPTrendData, calculateTrendDirection, comparePeriods, aggregateToWeekly

**Blood Glucose Engine:** classifyGlucose, isInRange, convertGlucose, calculateTimeInRange, estimateA1c, calculateAverageGlucose, analyzeGlucosePatterns, logGlucoseReading + CRUD, getA1cConfidence, interpretA1c, calculateGMIFromA1c

**Insulin Engine:** calculateIOB, getSuggestedSite, getSiteRecency, getDailyInsulinTotals, calculateDailyAverage, logInsulinEntry + CRUD

**Caregiver Alert Engine:** generateAlertMessage, shouldFireAlert, generateWeeklySummary

**FODMAP Engine:** classifyMealFODMAP, getFODMAPTypes, searchFODMAPFoods, calculateTriggerCorrelation, groupByFODMAPType

**Weather Correlation Engine:** pearsonCorrelation, calculateWeatherCorrelation, identifyTriggerProfile, shouldShowForecastAlert

**Pain Mapping Engine:** calculateHeatmap, getActiveZones, getAverageSeverityByZone, getPainMedicationCorrelation

**CGM Integration Engine:** calculateGMI, calculateTrendArrow, calculateCV/SD, calculateTIRBreakdown, calculateAGP, getCGMStats, deduplicateReadings

---

## 17. MyMood (`mood`)

| Field | Value |
|-------|-------|
| Tagline | Track your emotional wellness |
| Storage | SQLite | Prefix: `mo_` | Tier: **free** |
| Schema | v3, 3 migrations |
| Tests | 2 files, 40 tests |

**CRUD (40+ functions):** Mood Entries (with emotion tags), Activities (with seed defaults), Breathing Sessions, Settings, Daily Averages, Dashboard, Activity Correlations, Top Emotions

**Streak Engine:** calculateStreaks, scoreToPixelColor, pearsonCorrelation

**Breathing Engine:** getBreathingCycleSteps, getCycleDuration, getCyclesForDuration

**Experiment Engine:** createExperiment + CRUD, getTemplates (by category), computeDateRanges, transitionExperiment, analyzeExperiment, generateConclusion, correlationStrength

**Lock Engine:** hashPin, verifyPin, checkLockout, computeLockedUntil

**Insight Engine:** detectDayOfWeekPattern, detectTimeOfDayPattern, detectActivityImpact, detectEmotionCluster, detectStreakImpact, detectTrendDirection, detectVolatilityAlert, detectBestWorstDay, generateInsights

**SOS Engine:** getSosFlow, getRandomAffirmation, computeSosDuration + CRUD (sessions + emergency contacts)

**Attachment Engine:** createAttachment + CRUD (by entry/type)

**Suggestion Engine:** generateSuggestions, SUGGESTION_CATALOG + CRUD (history/actions)

**Meditation Engine:** createTimerState, tickTimer, getStepProgress, getTotalProgress + CRUD (templates/sessions)

**Pet Engine:** feedPet, computeHappinessDecay, getEvolutionStage + CRUD (pet state/activities)

**Soundscape Engine:** SOUND_LIBRARY, DEFAULT_PRESETS, getSoundById, validateLayers, mixLayers

**Focus Engine:** CRUD (sessions + sound presets)

---

## 18. MyNotes (`notes`)

| Field | Value |
|-------|-------|
| Tagline | Plain markdown notes, no lock-in |
| Storage | SQLite with FTS5 | Prefix: `nt_` | Tier: **free** |
| Schema | v3, 3 migrations |
| Tests | 2 files, 46 tests |

**CRUD (60+ functions):** Notes (with FTS search), Folders, Tags (with note associations), Backlinks + Outgoing Links + Note Graph, Templates (with seed built-ins, use count), Settings, Stats, Attachments (with OCR status/search), AI History, Databases + Columns + Rows + Cells, Plugins (install/enable/disable/uninstall + settings), Canvas/Whiteboard (CRUD for canvases, nodes, edges, groups)

**Markdown Engine:** extractBacklinks, countWords, extractHeadings, countChecklistItems, generateSnippet

**Code Blocks Engine:** parseCodeBlocks, resolveLanguage, countCodeBlocks, extractCodeContent

**Table Engine:** parseTable, generateTable, addRow/Column, deleteRow/Column, updateCell, setAlignment

**Daily Notes Engine:** formatDailyTitle, getOrCreateDailyNote, getDailyNoteDates

**Template Engine:** expandVariables, buildVariableMap

**Checklist Engine:** toggleChecklistItem, parseChecklistLine, insertChecklist, handleChecklistEnter, indent/outdent, autoSortChecked, getChecklistProgress

**Graph Analysis Engine:** filterGraph, getLocalGraph, findOrphans, clusterNotes, getGraphStats

**Web Clipper Engine:** htmlToMarkdown, buildClipBody, truncateClip

**AI Writing Assistant:** summarizeLocal, fixGrammarLocal, simplifyLocal, runLocalAiAction

**Canvas/Whiteboard Engine:** viewportCull, zoomToFit, hitTestNode, selectNodesInRect, computeBoundingBox, getGroupChildren, snapToGrid, clampZoom, screenToCanvas/canvasToScreen, parseCanvasJson, stringifyCanvasJson

---

## 19. MyNutrition (`nutrition`)

| Field | Value |
|-------|-------|
| Tagline | Track what you eat, hit your macros |
| Storage | SQLite with FTS5 | Prefix: `nu_` | Tier: premium |
| Schema | v5, 5 migrations |
| Tests | infrastructure present |

**CRUD (60+ functions):** Foods (with barcode, FTS search, AI estimate), Nutrients (with food-nutrient linking), Food Log Entries + Items, Daily Totals, Daily Goals, Settings, Barcode Cache, Water Entries, Energy Logs, Daily Notes, Restaurants + Menu Items, Community Profiles, Connections (request/accept/decline/block), Feed Items (with cheers), Challenges (join/progress/leaderboard)

**API Client:** searchFoodUnified, lookupBarcode (Open Food Facts + FatSecret), createRateLimiter

**AI Photo Logging:** analyzePhotoForFoods

**Stats Engine:** getDailySummary, getDailyGoalProgress, getMealBreakdown, getWeeklyTrends, getMonthlyTrends, getCalorieHistory, getMacroRatios, getMicronutrientSummary/Deficiencies, getTopNutrientSources

**MyFast Integration:** getEatingWindow, isInEatingWindow

**CSV Export:** exportFoodLogCSV, exportNutritionSummaryCSV

**Water Tracking Engine:** createWaterEntry + CRUD, unit conversions (ml/oz), getWaterGoalMl, getWaterContainers, getWeeklyWaterTotals

**Energy Balance Engine:** calculateBMR, applyActivityMultiplier, getNetCalories, getEnergyBalance, getWeeklyEnergyBalance, wearable sync (readActiveCaloriesFromHealth, syncEnergyForDate)

**Restaurant Engine:** createRestaurant + CRUD, menu items, logMenuItemAsMeal, search, seed data

**Social Engine:** generateShareCode, profiles, connections, feed items, challenges with leaderboards

---

## 20. MyPets (`pets`)

| Field | Value |
|-------|-------|
| Tagline | Pet health records and care tracker |
| Storage | SQLite | Prefix: `pt_` | Tier: premium |
| Schema | v4, 4 migrations |
| Tests | 2 files, 30+ tests |

**CRUD (70+ functions):** Pets, Vet Visits, Vaccinations (with due reminders), Medications (with due/logs), Weight Entries, Feeding Schedules + Logs, Dietary Info, Food Transitions, Exercise Goals + Logs, Grooming Records (with intervals/reminders), Training Logs, Emergency Contacts, Pet Expenses, Insurance Policies + Claims, Training Commands (with status), Alert Dismissals, Pet Photos (with milestones), Dashboard, Health Timeline, Pet Sitter Card, Export

**Reminder Engine:** getReminderStatus, computeNextMedicationDueAt, collectVaccination/MedicationReminders

**Weight Engine:** calculatePetAgeYears, calculateWeightTrend

**Cost Engine:** calculateOwnershipCost, calculateAverageMonthlyCost, getBreedHealthAlerts

**Feeding Engine:** getDailyFeedingStatus, calculateTransitionRatio

**Exercise Engine:** calculateExerciseProgress, calculateExerciseStreak, getBreedExerciseRecommendation

**Insurance Engine:** calculateAnnualInsuranceCost, calculateClaimReimbursementRate, getInsuranceSummary

**Expense Engine:** calculateMonthlySpending, calculateBudgetProgress, getCostOfOwnershipBreakdown, getExpenseTrend

**Grooming Engine:** calculateNextGroomingDate, getGroomingOverview, getOverdueGroomingTasks

**Training Engine:** calculateCommandProgress, getTrainingSummary, calculateTrainingStreak, TRAINING_CURRICULUM

**Photo Engine:** getPhotoTimeline, getMilestonePhotos, getPhotoStats

**Export/Poster Engine:** generateLostPetPoster, generateFoundPetPoster, formatPetSitterCard, serializePetExportBundle

---

## 21. MyRecipes (`recipes`)

| Field | Value |
|-------|-------|
| Tagline | Grow it, cook it, host it |
| Storage | SQLite | Prefix: `rc_`/`gd_`/`ev_` | Tier: premium |
| Schema | v6, 6 migrations |
| Tests | 16 files, 189 tests |

**CRUD (80+ functions):** Recipes (with favorites/ratings), Ingredients (structured), Tags, Settings, Pantry Items (with barcode/expiring/bulk update), Meal Plans (with shopping list generation), Garden Plants (with watering/harvests/journal), Garden Layouts, Events (with invite tokens/guests/menus/timeline/potluck/allergy warnings), Shopping Lists + Items (with recipe linking, pantry sync), Collections, Nutrition Data

**Parser Engine:** parseIngredientText, parseRecipeFromText/Html, parseIsoDuration

**Scaling Engine:** scaleIngredients

**Grocery Engine:** categorizeItem, mergeIngredients, generateShoppingList, unit conversions

**Pantry Engine:** normalizeItemName, fuzzyItemMatch, classifyExpiration, deductPantryForRecipe, matchRecipesToPantry, suggestRecipesForExpiringItems, lookupBarcode, identifyFood (AI)

**Import Engine:** fetchHtml, detectPlatform, extractRecipeFromText/Image, importRecipeFromVideo

**Nutrition Engine:** calculateRecipeNutrition

**Voice Engine:** parseVoiceCommand

**Print Engine:** generatePrintHtml

**Share Engine:** generateShareText, generateShareToken (with 30-day expiry), getRecipeByShareToken

---

## 22. MyRSVP (`rsvp`)

| Field | Value |
|-------|-------|
| Tagline | Events, invites, and RSVP tracking |
| Storage | SQLite | Prefix: `rv_` | Tier: premium |
| Schema | v3, 3 migrations |
| Tests | 1 file |

**CRUD (80+ functions):** Events, Cohosts, Invites (with approve/waitlist), RSVPs (with check-in), Questions + Responses, Polls (with voting/closing), Announcements, Comments, Photos, Links, Settings, Expenses + Splits (with settlement), Calendar Event IDs, Recurrence Rules, Series Entries (with cancel/modify occurrence), Event Designs, Location Coordinates, Messages (with pinning), Registry Items (with claim/unclaim), Seating Tables + Assignments

**Analytics:** getRsvpSummary, getEventAnalytics, exportAttendanceCsv

**iCal Engine:** generateICalString, generateGoogleCalendarUrl, eventToICalEvent

**Settlement Engine:** calculateEqualSplit, calculateSettlements, validateCustomSplit

**Templates Engine:** getTemplates, getTemplateById, applyTemplate, EVENT_TEMPLATES

**Dietary Engine:** DIETARY_OPTIONS, parseDietaryAnswer, aggregateDietaryResponses

**Recurrence Engine:** calculateNextOccurrence, generateOccurrences, shouldGenerateMore

**Location Engine:** buildAppleMapsUrl, buildGoogleMapsUrl, buildDirectionsUrl, isVirtualLocation

**Design Engine:** INVITATION_DESIGNS, getDesigns (by category), applyDesignOverrides, autoContrastTextColor

**Recap Engine:** isRecapAvailable, calculateDurationMinutes, generateRecap

**Seating Engine:** validateAssignment, calculateRemainingCapacity, autoAssign, getUnassignedGuests, generateSeatingText

---

## 23. MyStars (`stars`)

| Field | Value |
|-------|-------|
| Tagline | Private astrology and birth charts |
| Storage | SQLite | Prefix: `st_` | Tier: premium |
| Schema | v2, 2 migrations |
| Tests | 2 files, 30+ tests |

**CRUD (30+ functions):** Birth Profiles, Transits (by profile/date), Daily Readings, Saved Charts, Stats, Moon Calendar (cache/get), Compatibility Results, Zodiac Events (cache/get), Transit Events, Journal Entries (with search), Solar Returns, Progressed Charts

**Astro Engine:** getMoonPhase, getZodiacSign, getZodiacElement, calculateCompatibility, getTarotCardOfDay

**Lunar Engine:** computeMoonCalendarMonth, computeIllumination, getKeyPhasesForMonth

**Compatibility Engine:** computeQuickMatch, canonicalPair

**Zodiac Engine:** computeSunIngresses, computeZodiacEvents, filterEventsByCategory

**Transits Engine:** detectTransitsForDate, classifySignificance, filterBySignificance

**Retrograde Engine:** computeRetrogradeBanner, getActiveRetrogrades, getUpcomingRetrogrades, getRetrogradeTips

**Journal Engine:** captureAstrologicalContext, detectPatterns

**Solar Return Engine:** computeSolarReturn, computeSolarReturnRange

**Progressions Engine:** computeProgressedChart, computeProgressedDate, forecastMoonSignChange

---

## 24. MySubs (`subs`)

| Field | Value |
|-------|-------|
| Tagline | Subscription cost tracker |
| Storage | SQLite | Prefix: `sb_` | Tier: premium |
| Schema | v1, 1 migration |
| Tests | 1 file, 58 tests |

**CRUD (30+ functions):** Subscriptions, Categories, Price History, Renewal Events (with mark paid), Cancellation Actions, Alternatives, Catalog (search/browse), Cost Totals (monthly/annual/by category)

**Cost Analysis Engine:** getCostSummary, getCategoryBreakdown, getCycleBreakdown, getPriceChanges, getSpendingProjection

**Renewal Calendar Engine:** getCalendarMonth, getAgendaView, getRenewalSummary, getDueNotifications

**Cancellation Assist Engine:** scoreSubscription, getOpportunities, shouldShowOpportunity, calculateTotalSavings

**Price Comparison Engine:** matchToCatalog, getComparison, getComparisonSummary

---

## 25. MySurf (`surf`)

| Field | Value |
|-------|-------|
| Tagline | Surf forecasts and spot intel |
| Storage | Supabase + SQLite cache | Prefix: `sf_` | Tier: premium |
| Schema | v4, 4 migrations |
| Tests | 16 files, 268 tests |

**Local CRUD (80+ functions):** Spots (with slug/conditions/profile/favorites), Sessions, Forecasts + Swell Components, Tides, Buoy Readings, Narratives, User Pins, Alerts + Rules, Reviews, Photos, Guides, Session Waves, Trail Hike Summaries, Zones, Cam Feeds + Snapshots, Model Runs, Ensemble Forecasts, Surf Profiles (with stats), Social (follows/followers), Shared Sessions + Comments + Likes, Crews + Members

**Cloud Adapters (30 functions):** Spots (region/slug/nearby/favorites/guide), Forecasts/Tides/Buoy/Narratives (with voting), Alerts, Community (reviews/photos), User (pins/sessions), Trails, Cams, Social (profile/follow/share/crews/feed)

**Rating Engine:** computeSpotRating, starsToColor, computeEnergy, classifyWind, windScore, scoreTide

**Ensemble Engine:** computeEnsemble/Batch, buildFeed, buildProfileTimeline

**Utilities:** angleDifference, degreesToCompass, computeDirectionFit, haversineDistance, unit conversions, detectWaves (GPS), evaluateAlertRules, trail analytics (distance/elevation/pace/summary), GPX export/import

---

## 26. MyTrails (`trails`)

| Field | Value |
|-------|-------|
| Tagline | Offline hiking and trail guide |
| Storage | SQLite | Prefix: `tr_` | Tier: premium |
| Schema | v10, 10 migrations |
| Tests | coverage across all features |

**CRUD (80+ functions):** Trails, Recordings + Waypoints, Offline Regions (with progress/ready/error/reset), Alert Settings, Deviation Events (with acknowledge), Weather Cache, Segments + Efforts + Personal Bests, Packing Templates + Items (with check/uncheck), Trips + Days + Activities (with reorder), Trail Database (with search/save), Planned Routes + Route Waypoints, Reviews (with ratings/conditions distribution)

**Geo Engine:** haversineDistance, calculateElevationGain, calculatePace, formatDuration, estimateCalories

**Offline Maps:** REGION_CATALOG, getCatalogByArea

**Tile Manager:** tilesAtZoom, estimateRegionTileCount/SizeBytes, tilePathForCoordinate, exceedsTileLimit

**Storage Engine:** totalStorageBytes, formatBytes, isLowStorage

**Deviation Detector:** deviationDistance, effectiveThreshold, DeviationStateMachine

**Route Geofence:** buildRouteGeofence, SpatialRouteIndex

**Difficulty Calculator:** calculateDifficultyScore, calculateDifficulty, difficultyColor

**Navigation Engine:** calculateBearing, angleBetweenBearings, classifyTurn, generateInstructions

**Weather Engine:** weatherDescription, weatherIcon, formatTemperature/WindSpeed, isWeatherCacheValid

**Packing Engine:** DEFAULT_TEMPLATES

**Segment Matcher:** isWithinRadius, matchSegmentEntry/Exit

---

## 27. MyVoice (`voice`)

| Field | Value |
|-------|-------|
| Tagline | Private on-device dictation |
| Storage | SQLite | Prefix: `vc_` | Tier: **free** |
| Schema | v2, 2 migrations |
| Tests | 2 files, 133 tests |

**CRUD (35+ functions):** Transcriptions, Voice Notes (with favorites), Settings, Stats, Speakers, Speaker Segments, Custom Commands (with usage tracking + execution log), Language Segments + Breakdown, Language Profiles (with default)

**Text Engine:** calculateWordCount, calculateReadingTime, extractKeywords, summarizeText, formatDuration

**Speaker Engine:** SPEAKER_COLORS, mergeShortSegments, assignSpeakerLabels, isMultiSpeaker, getSpeakerBreakdown, processDiarization

**Commands Engine:** normalizePhrase, phraseToRegex, hasVariableSlots, matchCommand, PRESET_TEMPLATES

**Language Engine:** LANGUAGE_COLORS, SUPPORTED_LANGUAGES, isValidBcp47, getBaseLanguage, mergeAdjacentLanguageSegments, calculateLanguageBreakdown, isMultiLanguage, validateProfileLanguages, processLanguageDetection

---

## 28. MyWords (`words`)

| Field | Value |
|-------|-------|
| Tagline | Dictionary + thesaurus in 270 languages |
| Storage | SQLite | Prefix: `wd_` | Tier: premium |
| Schema | v4, 4 migrations |
| Tests | 1 file |

**Service Layer:** lookupWord, getMyWordsLanguages, browseWordsAlphabetically, suggestWordReplacements

**CRUD (20+ functions):** Saved Words (with lookup count), Word Lists, Flash Card IDs (bridge to @mylife/flash), Offline Cache (with LRU/stale eviction, prefix matches, stats), FTS Search (with advanced query, part-of-speech filter)

**Flash Bridge Engine:** buildFlashcardContent, buildFlashcardTags, getOrCreateVocabularyDeck, createFlashcardFromWord, bulkCreateFlashcards, checkFlashCardExists

**Offline Engine:** lookupWordWithFallback, cacheAfterLookup

---

## 29. MyWorkouts (`workouts`)

| Field | Value |
|-------|-------|
| Tagline | Body-map guided workouts |
| Storage | SQLite | Prefix: `wk_` | Tier: premium |
| Schema | v5, 5 migrations |
| Tests | 24 files, 426 tests |

**CRUD (70+ functions):** Exercise Library (with seed from JSON), Workouts, Sessions, Form Recordings, Dashboard + Metrics, Set Weights, Previous Performance, 1RM History, Body Measurements, Workout Plans + Subscriptions, Overload Rules, AI Generation History, GPS Routes + Points, Plate Inventories (with validation), Progress Photos, Legacy Logs + Programs

**Workout Engine (state machine):** createPlayerStatus, reducePlayer, playerProgress, formatTime, buildGroupNavigation, SPEED_OPTIONS

**1RM Calculators:** calculateEpley1RM, calculateBrzycki1RM, calculate1RM

**Warmup Calculator:** calculateWarmupSets (progressive: bar/50%/70%/85%)

**Plate Calculator:** calculatePlates (greedy algorithm), STANDARD_PLATES_LBS/KG

**Plan Helpers:** getWeekSchedule, getCurrentPlanPosition, getTodaysWorkout, getPlanProgress, createEmptyWeek

**Body Map Engine:** BODY_MAP_MUSCLE_GROUPS, slug/muscleGroup mappings, buildHighlightData, getExercisesForMuscleGroup, getMuscleGroupsByRegion

**Voice Engine:** parseVoiceCommand, getSupportedCommands (20 phrases, 5 categories)

**Progress Engine:** calculateStreaks, calculateVolume, calculatePersonalRecords, getWeeklySummaries, buildHistory, calculateWeightPRs

**Recovery Engine:** calculateMuscleRecovery, buildRecoveryMap, getBestToTrain

**Overload Engine:** evaluateTrigger, calculateSuggestion, generateOverloadSuggestion

**AI Generation Engine:** generateLocalWorkout

**GPS Metrics Engine:** haversineDistance, calculateTotalDistance/Pace/Speed/ElevationGain, filterByAccuracy/Noise, estimateCalories, downsampleRoute

**Watch Sync Engine:** buildWatchWorkoutSummary, isValidWatchMessage

**Sharing Engine:** buildWorkoutSummary

**Social Engine:** applyPrivacyFilter, normalizePrivacySettings, sortFeedChronological, paginateFeed, isPostVisible

---

## Summary

| Module | Functions | Tests | Schema | Tier |
|--------|-----------|-------|--------|------|
| Books | 150+ | 264 | v5 | premium |
| Budget | 250+ | 176 | v6 | premium |
| Car | 100+ | -- | v10 | premium |
| Closet | 60+ | 40 | v3 | premium |
| Cycle | 60+ | 30+ | v4 | premium |
| Fast | 60+ | -- | v4 | **free** |
| Flash | 100+ | 34+ | v4 | premium |
| Forums | 100+ | 0 | v2 | free |
| Garden | 80+ | 41 | v2 | premium |
| Habits | 200+ | -- | v4 | premium |
| Health | 200+ | -- | v3 | premium |
| Homes | 90+ | 0 | v3 | premium |
| Journal | 140+ | -- | v4 | **free** |
| Mail | 85+ | -- | v2 | premium |
| Market | 70+ | 0 | v3 | free |
| Meds | 130+ | -- | v4 | premium |
| Mood | 80+ | 40 | v3 | **free** |
| Notes | 100+ | 46 | v3 | **free** |
| Nutrition | 90+ | -- | v5 | premium |
| Pets | 100+ | 30+ | v4 | premium |
| Recipes | 120+ | 189 | v6 | premium |
| RSVP | 100+ | -- | v3 | premium |
| Stars | 50+ | 30+ | v2 | premium |
| Subs | 40+ | 58 | v1 | premium |
| Surf | 150+ | 268 | v4 | premium |
| Trails | 100+ | -- | v10 | premium |
| Voice | 50+ | 133 | v2 | **free** |
| Words | 30+ | -- | v4 | premium |
| Workouts | 130+ | 426 | v5 | premium |
| **TOTAL** | **~3,000+** | **~1,800+** | | |
