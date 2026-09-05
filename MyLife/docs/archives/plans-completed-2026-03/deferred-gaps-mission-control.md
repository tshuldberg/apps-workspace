# Deferred Feature Gaps: Mission Control

**Created:** 2026-03-29
**Total:** 18 deferred features across 4 modules
**Strategy:** Group by dependency blocker, install deps first, then build features sequentially

## Execution Order

Dependencies must be installed before features that need them. The order below maximizes unblocking.

| Phase | What | Unblocks |
|-------|------|----------|
| Phase 0 | Install expo-notifications, expo-sharing, expo-local-authentication | 7 features |
| Phase 1 | Workouts: social feed + profile completion (no deps needed) | 2 features |
| Phase 2 | Workouts: rest timer bg notification + shareable cards | 2 features |
| Phase 3 | Meds: notification suite (critical alerts, sounds, settings) | 4 features (bundled) |
| Phase 4 | Meds: passcode lock + onboarding wizard | 2 features |
| Phase 5 | Books: OL Ratings API + friends' challenge | 2 features |
| Phase 6 | Budget: bank connection screen | 1 feature |
| Phase 7 | Polish items (meds home styles, budget copy/KB) | 3 features |
| Phase 8 | Books cover scanning (native Vision) + Meds drug database | 2 features (large, defer further if needed) |

## Task Registry

| ID | Phase | Module | Feature | Effort | Prompt File |
|----|-------|--------|---------|--------|-------------|
| DEF-00 | 0 | Hub | Install expo-notifications + expo-sharing + expo-local-authentication | Small | DEF-00-install-deps.md |
| DEF-01 | 1 | Workouts | Social feed mobile UI | Medium | DEF-01-workouts-social-feed.md |
| DEF-02 | 1 | Workouts | Profile completion progress | Small | DEF-02-workouts-profile-completion.md |
| DEF-03 | 2 | Workouts | Rest timer background notification | Small | DEF-03-workouts-rest-notification.md |
| DEF-04 | 2 | Workouts | Shareable workout cards + share sheet | Medium | DEF-04-workouts-share-cards.md |
| DEF-05 | 3 | Meds | Notification permission + critical alerts | Medium | DEF-05-meds-notifications.md |
| DEF-06 | 3 | Meds | Custom notification sounds (Medtones) | Small | DEF-06-meds-custom-sounds.md |
| DEF-07 | 3 | Meds | Notification settings (snooze, message, morning reminder) | Medium | DEF-07-meds-notification-settings.md |
| DEF-08 | 4 | Meds | Passcode / biometric lock | Medium | DEF-08-meds-passcode-lock.md |
| DEF-09 | 4 | Meds | Guided onboarding wizard | Large | DEF-09-meds-onboarding.md |
| DEF-10 | 5 | Books | Open Library Ratings API + community rating counts | Medium | DEF-10-books-ol-ratings.md |
| DEF-11 | 5 | Books | Friends' challenge visibility | Medium | DEF-11-books-friends-challenge.md |
| DEF-12 | 6 | Budget | Bank connection screen with logos | Medium | DEF-12-budget-bank-connection.md |
| DEF-13 | 7 | Meds | Home screen style selection | Large | DEF-13-meds-home-styles.md |
| DEF-14 | 7 | Budget | Emotional onboarding copy | Small | DEF-14-budget-onboarding-copy.md |
| DEF-15 | 7 | Budget | In-app Knowledge Base | Large | DEF-15-budget-knowledge-base.md |
| DEF-16 | 8 | Books | Book cover scanning (Apple Vision) | Large | DEF-16-books-cover-scanning.md |
| DEF-17 | 8 | Meds | Drug database search (FDA/RxNorm) | Large | DEF-17-meds-drug-database.md |

## Compact Rule

All agents should compact context at 60% fill. Each task is self-contained with all context needed.
