# Requirements Document

## Introduction

MyLife is a privacy-first personal life suite consolidating 30 modules into a single cross-platform application (Expo mobile + Next.js web). The project has reached a mature pre-alpha state with 445+ tests passing, 24 modules QA'd, navigation wiring complete, and TestFlight readiness verified. However, critical gaps remain between the current state and a credible initial production release: authentication, subscription billing, legal compliance, error reporting, data safety, onboarding, and app store submission infrastructure are all missing or stubbed.

This requirements document defines the full scope of work needed to close those gaps and achieve an initial production release on iOS App Store, Google Play Store, and web. The release targets 9 GA modules and up to 17 Public Beta modules, with honest tiering, real billing, and legal compliance for US consumers. The feature inventory confirms 568 mobile screens, 269 web pages, 470+ features, and 100+ computation engines across 30 modules, all of which must be accounted for in the release plan.

## Glossary

- **Hub**: The MyLife shell application that registers, enables/disables, and renders modules dynamically
- **Module**: A self-contained feature unit (e.g. MyBooks, MyBudget) with its own definition, navigation, data schema, and release state
- **GA**: General Availability release state indicating a module is production-ready, supported, and included in paid marketing
- **Public_Beta**: Release state indicating a module is usable but has known gaps, displayed with a beta badge
- **Hidden**: Release state for modules not visible to users until promoted
- **Auth_Package**: The @mylife/auth shared package providing authentication services
- **Subscription_Package**: The @mylife/subscription shared package providing billing and entitlement services
- **Entitlement_System**: The mechanism that gates premium module access based on subscription status
- **Cool_Obsidian**: The dark-themed design system used across all MyLife surfaces
- **Module_Registry**: The @mylife/module-registry package that defines module metadata, IDs, and lifecycle
- **EAS_Build**: Expo Application Services build pipeline for producing signed mobile binaries
- **RevenueCat**: Mobile subscription management service for iOS and Android in-app purchases
- **Stripe**: Web payment processing service for subscription billing
- **Sentry**: Error reporting and crash analytics service
- **Consumer_Health_Data**: Data covered by WA MHMDA, NV SB 370, CT CTDPA including vitals, medications, menstrual cycles, mood, nutrition, and sleep data
- **MHMDA**: Washington My Health My Data Act requiring consent, privacy policy, and deletion rights for consumer health data
- **Onboarding_Flow**: The first-run experience guiding new users through privacy pledge, module selection, and optional account creation
- **Data_Export**: The mechanism allowing users to download all their personal data in a portable format
- **Release_Gate**: A set of criteria that must pass before a module or the suite can advance to a release state
- **Web_Fallback**: A ModuleWebFallback stub component shown when a module lacks a real web UI
- **Obsidian_Noir**: The evolved design variant of Cool Obsidian documented in the UI/UX prompts, featuring warmer tones (#131318 background), 5-tier surface system, amber hub accent (#C9894D/#ffb877), and Plus Jakarta Sans typography
- **UI_UX_Prompts**: The 40 design specification files in `docs/uiux-prompts/` that define the target visual design for every hub screen and module, used as input for the UI/UX redesign tool (Google Stitch or equivalent)

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to create an account and sign in so that I can restore purchases, access cloud-backed modules, and sync entitlements across devices.

#### Acceptance Criteria

1. WHEN a user selects "Create Account," THE Auth_Package SHALL present a sign-up form accepting email and password
2. WHEN a user submits valid sign-up credentials, THE Auth_Package SHALL create a user account and establish an authenticated session
3. WHEN a user submits valid sign-in credentials, THE Auth_Package SHALL authenticate the user and restore the session
4. WHEN a user selects "Sign Out," THE Auth_Package SHALL clear the session state on the current device
5. WHILE the Hub is in local-only mode, THE Auth_Package SHALL allow full module access without requiring account creation or sign-in
6. WHEN the app restarts after a previous successful sign-in, THE Auth_Package SHALL restore the authenticated session without requiring re-entry of credentials
7. WHEN a user requests account deletion, THE Auth_Package SHALL delete the user account and all associated server-side data within 30 days
8. THE Auth_Package SHALL store session tokens using platform-appropriate secure storage (Keychain on iOS, Keystore on Android, httpOnly cookies on web)
9. IF the Auth_Package receives invalid credentials, THEN THE Auth_Package SHALL display a descriptive error message without revealing whether the email or password was incorrect

### Requirement 2: Subscription Billing and Entitlement Gating

**User Story:** As a user, I want to subscribe to MyLife Pro so that I can unlock premium modules, and as a free user I want access to free-tier modules without payment.

#### Acceptance Criteria

1. THE Entitlement_System SHALL allow access to free-tier modules (fast, forums, journal, market, mood, notes, voice) without requiring a subscription
2. WHEN a user without an active subscription attempts to open a premium module, THE Subscription_Package SHALL display a paywall screen describing MyLife Pro benefits and pricing
3. WHEN a user completes a subscription purchase on mobile, THE Subscription_Package SHALL verify the receipt through RevenueCat and grant premium entitlements
4. WHEN a user completes a subscription purchase on web, THE Subscription_Package SHALL verify the payment through Stripe and grant premium entitlements
5. WHILE a user has an active subscription, THE Entitlement_System SHALL cache entitlements locally so that premium modules remain accessible during network outages
6. WHEN a user with an active subscription signs in on a new device, THE Entitlement_System SHALL restore premium entitlements using the purchase restore flow
7. WHEN a user cancels a subscription, THE Subscription_Package SHALL maintain premium access until the end of the current billing period
8. THE Subscription_Package SHALL present subscription management options (view plan, cancel, resume) in the Hub settings screen
9. IF a receipt validation request fails due to a network error, THEN THE Entitlement_System SHALL fall back to cached entitlement state rather than revoking access

### Requirement 3: Legal Compliance (Privacy Policy, Terms of Service, Health Data Consent)

**User Story:** As a user, I want to understand how my data is handled, agree to terms of service, and provide informed consent for health data collection so that my privacy rights are protected.

#### Acceptance Criteria

1. THE Hub SHALL publish a Privacy Policy accessible from the settings screen, app store listings, and the marketing website
2. THE Hub SHALL publish Terms of Service accessible from the settings screen and app store listings
3. THE Privacy Policy SHALL include a Consumer Health Data Privacy Policy section compliant with WA MHMDA, NV SB 370, and CT CTDPA
4. WHEN a user enables a module that collects Consumer_Health_Data (health, meds, cycle, mood, nutrition, workouts, fast, habits, presence), THE Hub SHALL present an affirmative consent dialog specific to that module's data types before any data collection begins
5. WHEN a user withdraws health data consent for a module, THE Hub SHALL stop collecting new health data for that module and offer deletion of existing health data
6. THE Hub SHALL include health and wellness disclaimers stating that MyLife is not a medical device and does not provide medical advice
7. THE Privacy Policy SHALL explicitly state that MyLife does not sell, share, or transmit Consumer_Health_Data to third parties
8. WHEN a user requests deletion of all health data, THE Hub SHALL delete all Consumer_Health_Data across all health-related modules within 30 days

### Requirement 4: Error Reporting and Crash Analytics

**User Story:** As a developer, I want production error reporting so that I can identify and fix crashes and errors affecting real users.

#### Acceptance Criteria

1. THE Hub SHALL integrate an error reporting service (Sentry or equivalent) for both mobile and web platforms
2. WHEN an unhandled exception occurs on mobile, THE Hub SHALL capture the exception with module context (module ID, screen name, hub mode) and report it to the error reporting service
3. WHEN an unhandled exception occurs on web, THE Hub SHALL capture the exception with module context and report it to the error reporting service
4. WHEN a module rendering crash is caught by the error boundary, THE Hub SHALL report the error to the error reporting service with the module ID
5. THE Hub SHALL upload source maps for both mobile and web builds to enable readable stack traces in the error reporting service
6. THE Hub SHALL not include any personally identifiable user data in error reports

### Requirement 5: Data Export and Backup

**User Story:** As a user, I want to export all my data so that I can maintain a personal backup and exercise my data portability rights.

#### Acceptance Criteria

1. WHEN a user selects "Export My Data" from the settings screen, THE Hub SHALL generate a JSON file containing all data from all enabled modules
2. THE Data_Export SHALL include data from every enabled module that stores local data
3. WHEN the export is triggered on mobile, THE Hub SHALL present the system share sheet with the generated JSON file
4. WHEN the export is triggered on web, THE Hub SHALL initiate a browser download of the generated JSON file
5. THE Data_Export SHALL complete without requiring a network connection (operating on local SQLite data only)
6. WHEN a user selects "Delete All My Data" from the settings screen, THE Hub SHALL delete all module data from local storage after confirmation
7. IF the export process encounters a module-level error, THEN THE Hub SHALL skip the failing module, include an error note in the export file, and continue exporting remaining modules

### Requirement 6: Onboarding Flow

**User Story:** As a new user, I want a guided first-run experience so that I understand MyLife's privacy model, can select modules relevant to me, and can optionally create an account.

#### Acceptance Criteria

1. WHEN a user launches MyLife for the first time, THE Onboarding_Flow SHALL present a welcome screen explaining the privacy-first, local-only data model
2. WHEN the user proceeds past the welcome screen, THE Onboarding_Flow SHALL present a module selection screen where the user can choose which modules to enable
3. WHEN the user completes module selection, THE Onboarding_Flow SHALL present an optional account creation step that clearly explains account benefits (purchase restore, cloud modules) and that it is not required for local-only usage
4. WHEN the user completes or skips all onboarding steps, THE Onboarding_Flow SHALL navigate to the Hub dashboard with the selected modules enabled
5. THE Onboarding_Flow SHALL persist completion state so that it is not shown again on subsequent app launches
6. WHEN a module that collects Consumer_Health_Data is selected during onboarding, THE Onboarding_Flow SHALL present the health data consent dialog for that module before enabling it

### Requirement 7: App Store Submission and Build Pipeline

**User Story:** As a developer, I want a repeatable build and submission pipeline so that I can produce signed builds and submit to the iOS App Store and Google Play Store.

#### Acceptance Criteria

1. THE Hub SHALL have an EAS Build configuration (eas.json) with development, preview, and production profiles
2. WHEN a production build is triggered, THE EAS_Build pipeline SHALL produce a signed iOS binary suitable for App Store submission
3. WHEN a production build is triggered, THE EAS_Build pipeline SHALL produce a signed Android binary suitable for Google Play submission
4. THE Hub SHALL have complete App Store listing metadata including screenshots, description, privacy policy URL, and age rating
5. THE Hub SHALL have complete Google Play Store listing metadata including screenshots, description, privacy policy URL, and content rating
6. THE Hub SHALL include a release checklist document covering build, test, stage, submit, monitor, and rollback steps
7. IF a production build fails, THEN THE EAS_Build pipeline SHALL report the failure with build logs accessible to the development team

### Requirement 8: Web UI Completion for GA Modules

**User Story:** As a web user, I want real web interfaces for all GA-tier modules so that I can use the full suite from a browser without encountering placeholder stubs.

#### Acceptance Criteria

1. THE Hub web application SHALL render a functional web UI (not a Web_Fallback stub) for every GA-tier module (books, budget, fast, habits, health, meds, recipes, rsvp, words)
2. WHEN a user navigates to a GA module on web, THE Hub SHALL display all primary tab routes with real content and working CRUD operations
3. WHEN a user navigates to a Public_Beta module that lacks a web UI, THE Hub SHALL display the Web_Fallback component with a clear message that the web version is in development
4. THE web UI for each GA module SHALL follow the Cool_Obsidian design system with no light-theme leaks or hardcoded colors

### Requirement 9: Module Release State Enforcement

**User Story:** As a user, I want modules to be honestly labeled with their release state so that I know which modules are production-ready and which are still in development.

#### Acceptance Criteria

1. THE Module_Registry SHALL assign a release state (GA, Public_Beta, Hidden, or Merged) to every registered module
2. WHEN the Hub renders the Discover screen, THE Hub SHALL display a "Beta" badge on all Public_Beta modules
3. THE Hub SHALL not display Hidden-state modules in the Discover screen or module browser
4. WHEN a module's release state is Merged, THE Hub SHALL redirect or hide that module and surface its functionality within the absorbing module (e.g. subs functionality within budget)
5. THE Hub SHALL not include Hidden or Merged modules in marketing copy, pricing descriptions, or app store metadata as part of the paid value proposition
6. WHILE a module is in Public_Beta state, THE Hub SHALL display a disclaimer on the module's home screen indicating that the module is in beta and may have known gaps

### Requirement 10: Shared Notification Infrastructure

**User Story:** As a user, I want reliable reminders from modules like Meds, Habits, and Cycle so that I receive timely notifications without conflicts between modules.

#### Acceptance Criteria

1. THE Hub SHALL provide a shared notification service that modules can use to schedule, edit, cancel, and manage local notifications
2. WHEN a module schedules a reminder, THE shared notification service SHALL handle time-zone-aware scheduling
3. WHEN the user opens notification settings in the Hub, THE Hub SHALL display per-module notification preferences allowing the user to enable or disable reminders for each module independently
4. IF the user denies notification permissions at the OS level, THEN THE Hub SHALL display a guidance message explaining how to enable notifications in device settings
5. WHEN the device reboots or the app is reinstalled, THE shared notification service SHALL reschedule all active reminders from persisted state

### Requirement 11: Web Error Boundary

**User Story:** As a web user, I want graceful error recovery when a module crashes so that I can continue using the app without a full page reload.

#### Acceptance Criteria

1. THE Hub web application SHALL wrap each module route with a React error boundary component
2. WHEN a module rendering crash occurs on web, THE error boundary SHALL display the module name, a user-friendly error message, and "Try Again" and "Back to Hub" actions
3. WHEN the user selects "Try Again," THE error boundary SHALL attempt to re-render the module
4. WHEN the user selects "Back to Hub," THE error boundary SHALL navigate to the Hub dashboard
5. THE error boundary SHALL report the caught error to the error reporting service (Requirement 4)

### Requirement 12: Performance Baselines and Budgets

**User Story:** As a developer, I want documented performance baselines so that I can detect regressions and ensure the app meets quality standards for production users.

#### Acceptance Criteria

1. THE Hub SHALL measure and document a cold start time baseline on a reference iOS device (iPhone 12 or equivalent) with a target of less than 3 seconds
2. THE Hub web application SHALL achieve a Lighthouse performance score of 90 or higher
3. THE Hub web application SHALL achieve a Largest Contentful Paint of less than 2.5 seconds on a simulated 4G connection
4. THE Hub SHALL measure and document database operation baselines (insert, query, update, delete) with a target of less than 100ms for standard CRUD operations
5. THE Hub web application SHALL have an initial JavaScript bundle size of less than 500KB gzipped
6. THE Hub SHALL document all performance baselines in a BASELINE.md file under docs/performance/

### Requirement 13: Structured Logging

**User Story:** As a developer, I want structured logging so that I can diagnose production issues efficiently using searchable, leveled log output.

#### Acceptance Criteria

1. THE Hub self-host API SHALL output logs in structured JSON format with fields for timestamp, level, message, and context
2. THE Hub self-host API SHALL support log levels: error, warn, info, and debug
3. WHEN a request is processed by the self-host API, THE Hub SHALL log the request method, path, status code, and response time
4. THE Hub SHALL not include personally identifiable user data or secrets in log output

### Requirement 14: Security Hardening

**User Story:** As a user, I want the application to follow security best practices so that my data is protected from common web and mobile vulnerabilities.

#### Acceptance Criteria

1. THE Hub web application SHALL serve a Content-Security-Policy header that does not include 'unsafe-eval' in production
2. THE Hub SHALL pass `npm audit` with zero critical or high severity vulnerabilities in CI
3. THE Hub web application SHALL implement rate limiting on all authenticated API endpoints
4. THE Hub SHALL validate all API request inputs using Zod schemas or equivalent runtime validation
5. IF a dependency vulnerability scan detects a critical or high severity issue, THEN THE CI pipeline SHALL fail the build and report the vulnerability

### Requirement 15: Trademark and Brand Resolution

**User Story:** As the product owner, I want the trademark risk resolved so that the product can launch without legal exposure from the existing "MyLife" trademark holder.

#### Acceptance Criteria

1. WHEN a formal trademark clearance search is completed, THE product team SHALL document the findings and a go/no-go decision for the "MyLife" name
2. IF the trademark search reveals a conflict, THEN THE product team SHALL execute a rebrand including new name, domain, app store listings, and in-app references before public launch
3. THE product team SHALL not file a trademark application for "MyLife" in USPTO Class 9 or 42 until legal counsel confirms viability
4. THE product team SHALL reserve alternative domain names and social media handles for candidate replacement names before public launch

### Requirement 16: CI/CD and Release Operations

**User Story:** As a developer, I want automated CI/CD pipelines and documented release operations so that I can ship updates reliably and roll back safely.

#### Acceptance Criteria

1. THE CI pipeline SHALL run typecheck, lint, test, and parity checks on every pull request to the main branch
2. THE CI pipeline SHALL run `npm audit --audit-level high` and fail the build on critical or high vulnerabilities
3. THE Hub SHALL have a documented rollback procedure for mobile builds (via app store phased rollout revert) and web deploys (via redeployment of previous build)
4. THE Hub SHALL have a staging environment for web and cloud module validation before production deployment
5. THE Hub SHALL have a documented incident response runbook covering triage, communication, and resolution steps
6. WHEN a release is prepared, THE release process SHALL follow the documented release checklist (Requirement 7, criterion 6)

### Requirement 17: Module-Level Data Deletion

**User Story:** As a user, I want to delete all data for a specific module so that I can remove personal information from modules I no longer use.

#### Acceptance Criteria

1. WHEN a user selects "Delete Module Data" for a specific module in settings, THE Hub SHALL delete all local data associated with that module after confirmation
2. THE Hub SHALL present a confirmation dialog before deleting module data, clearly stating that the action is irreversible
3. WHEN module data is deleted, THE Hub SHALL reset the module's schema version so that migrations re-run on next enable
4. IF the module stores data in a cloud backend (Supabase), THEN THE Hub SHALL also delete the user's cloud data for that module

### Requirement 18: Fresh Install and Upgrade Migration Safety

**User Story:** As a user, I want database migrations to run reliably on fresh installs and upgrades so that I never lose data or encounter a broken app state.

#### Acceptance Criteria

1. WHEN the app is installed fresh, THE Hub SHALL run all module migrations sequentially and successfully for every enabled module
2. WHEN the app is upgraded from a previous version, THE Hub SHALL run only the new incremental migrations for each module
3. IF a module migration fails, THEN THE Hub SHALL disable that module, log the error, and allow the rest of the app to continue functioning
4. THE Hub SHALL display a loading indicator during first-run migration if the process exceeds 1 second
5. THE Hub SHALL track applied migration versions in the hub_schema_versions table to prevent duplicate migration execution
6. WHEN migrations are running, THE Hub SHALL execute them within a transaction so that a partial failure does not leave the database in an inconsistent state

### Requirement 19: Privacy Dashboard

**User Story:** As a user, I want a centralized privacy dashboard so that I can see exactly what data each module stores, where it lives, and delete it if I choose.

#### Acceptance Criteria

1. THE Hub SHALL provide a Privacy Dashboard screen accessible from the settings screen on both mobile and web
2. THE Privacy Dashboard SHALL display each enabled module with an expandable list of its data tables and row counts queried from SQLite
3. THE Privacy Dashboard SHALL indicate whether each module's data is stored locally, in the cloud, or both
4. WHEN a user selects a module in the Privacy Dashboard, THE Hub SHALL offer a "Delete Module Data" action (linking to Requirement 17)
5. THE Privacy Dashboard SHALL display the total local storage size used by the Hub database

### Requirement 20: Backup and Restore

**User Story:** As a user, I want to back up my local database and restore from a previous backup so that I can recover from data loss or migrate to a new device.

#### Acceptance Criteria

1. WHEN a user selects "Back Up" from the Backup & Restore screen, THE Hub SHALL export the SQLite database file via the system share sheet (mobile) or browser download (web)
2. WHEN a user selects "Restore" and provides a valid SQLite backup file, THE Hub SHALL replace the current database with the backup after confirmation
3. THE Hub SHALL validate the backup file's schema compatibility before restoring, and reject incompatible backups with a descriptive error message
4. THE Hub SHALL warn the user that restoring a backup will overwrite all current data and require confirmation before proceeding
5. IF the restore process fails, THEN THE Hub SHALL preserve the existing database and display an error message

### Requirement 21: Sensitive Module Protection (Biometric/PIN Lock)

**User Story:** As a user, I want to protect sensitive modules (health, meds, mood, journal, budget, cycle) with a PIN or biometric lock so that my private data is not accessible if someone else uses my device.

#### Acceptance Criteria

1. THE Hub SHALL offer a per-module lock option in module settings for modules that handle sensitive data (health, meds, mood, journal, budget, cycle, notes, mail)
2. WHEN a user enables a module lock, THE Hub SHALL require PIN entry or biometric authentication (Face ID, Touch ID, fingerprint) before displaying the module's content
3. THE Hub SHALL support both PIN-based and biometric authentication methods, with PIN as the fallback when biometrics are unavailable
4. WHEN a user fails PIN entry 5 consecutive times, THE Hub SHALL enforce a 60-second lockout before allowing retry
5. THE Hub SHALL not transmit or store biometric data; it SHALL use only the OS-level biometric confirmation (boolean result from Secure Enclave)

### Requirement 22: Cloud Module Operational Readiness

**User Story:** As a developer, I want cloud-backed modules (Forums, Market, Surf, Workouts social features) to have proper staging and production environments so that cloud data is safe and services are reliable.

#### Acceptance Criteria

1. EACH cloud-backed module (forums, market, surf, workouts) SHALL have separate Supabase staging and production projects
2. THE Hub SHALL use environment-based configuration to connect to the correct Supabase project (staging vs production) based on the build profile
3. ALL Supabase tables used by cloud modules SHALL have Row Level Security (RLS) policies enforced, preventing unauthorized data access
4. WHEN a cloud module API request fails due to a network error, THE module SHALL degrade gracefully by displaying cached data or an offline state message rather than crashing
5. THE Hub SHALL document rate limits, failure runbooks, and migration procedures for each cloud module's Supabase project

### Requirement 23: Hub Search Reliability

**User Story:** As a user, I want cross-module search to return accurate, fast results so that I can find any piece of my data from one search bar.

#### Acceptance Criteria

1. THE Hub search SHALL query the cross-module FTS5 index and return results within 200ms for typical queries
2. THE Hub search SHALL group results by module with the module's accent color and icon
3. WHEN a user selects a search result, THE Hub SHALL deep-link to the corresponding module screen with the relevant item displayed
4. THE Hub search SHALL index content from all enabled modules that implement the CrossModuleInterface
5. THE Hub search SHALL display a recent activity feed when the search field is empty, showing the 15 most recent cross-module actions

### Requirement 24: Import Wizard for Competitor App Migration

**User Story:** As a new user switching from competitor apps, I want to import my existing data so that I don't have to re-enter everything manually.

#### Acceptance Criteria

1. THE Hub SHALL provide an Import Wizard accessible from the settings screen and during onboarding
2. THE Import Wizard SHALL support importing data from at least: Goodreads (CSV for MyBooks), YNAB (CSV for MyBudget), MyFitnessPal (CSV for MyNutrition), and Day One (JSON for MyJournal)
3. THE Import Wizard SHALL present a multi-step flow: app selection, export instructions for the source app, file upload, progress indicator, and results summary with error details
4. IF an import encounters parsing errors, THEN THE Import Wizard SHALL display which rows failed and why, and import the valid rows successfully
5. THE Import Wizard SHALL not require a network connection for local file imports

### Requirement 25: UI/UX Redesign (Hub Shell)

**User Story:** As a user, I want a polished, cohesive hub experience so that the app feels like a premium product worthy of a paid subscription, not a developer prototype.

#### Acceptance Criteria

1. THE Hub dashboard SHALL be redesigned to match the Obsidian Noir design language documented in `docs/uiux-prompts/hub-dashboard.md`, including dynamic greeting, configurable bento summary cards, quick action row, and module library grid
2. THE Hub Discover screen SHALL be redesigned to match `docs/uiux-prompts/hub-discover.md`, including asymmetric bento grid layout, featured module hero card, category-based browsing, and premium lock overlay
3. THE Hub Settings screen SHALL be redesigned to match `docs/uiux-prompts/hub-settings.md`, including metallic gradient subscription card, sync mode selector, and glass navigation cards to sub-screens
4. THE Hub Search screen SHALL be redesigned to match `docs/uiux-prompts/hub-search.md`, including cross-module result grouping with module accent colors, keyword highlighting, and recent activity feed
5. THE Hub Onboarding flow SHALL be redesigned to match `docs/uiux-prompts/hub-onboarding.md`, including privacy consent, sync architecture picker, optional self-host setup, and module selection grid
6. THE Hub Backup & Restore screen SHALL be redesigned to match `docs/uiux-prompts/hub-backup-restore.md`, including local archive export/import, cloud sync status, and system restore with two-step confirmation
7. THE Hub Privacy Dashboard SHALL be redesigned to match `docs/uiux-prompts/hub-privacy-dashboard.md`, including storage allocation visualization, expandable per-module data listings, and destructive zone with two-step delete
8. THE Hub Import Wizard SHALL be redesigned to match `docs/uiux-prompts/hub-import-wizard.md`, including 4-step flow with source selection, file upload, import preview stats, and parsing discrepancy resolution
9. THE Hub Data & Sync screen SHALL be redesigned to match `docs/uiux-prompts/hub-data-sync.md`, including sync tier cards, archival usage bar, device pairing with zero-knowledge codes, and network node status
10. THE Hub Sharing Preferences screen SHALL be redesigned to match `docs/uiux-prompts/hub-sharing-preferences.md`, including global sharing toggle, collaborator management, sharing activity log, and granular per-module controls
11. ALL hub redesign work SHALL use the existing Cool Obsidian token system from `packages/ui/src/tokens/`, extending it with additional surface tiers if needed, rather than replacing it
12. THE Hub web application SHALL receive equivalent redesign treatment for the dashboard, discover, settings, sidebar, and command palette screens as documented in `docs/uiux-prompts/hub-shell.md` (Prompt 2)

### Requirement 26: UI/UX Redesign (GA Module Screens)

**User Story:** As a user, I want each GA module to have a polished, consistent visual design so that every module feels like part of the same premium product.

#### Acceptance Criteria

1. EACH GA-tier module (books, budget, fast, habits, health, meds, recipes, rsvp, words) SHALL have its mobile screens redesigned to match the corresponding UI/UX prompt file in `docs/uiux-prompts/`
2. EACH GA-tier module's redesigned screens SHALL use the module's registered accent color from the Module_Registry for all accent elements (headers, active states, buttons, progress indicators)
3. ALL redesigned module screens SHALL follow the Cool Obsidian design system with glass morphism cards, #0A0A0F background, #12121A surfaces, and rgba(255,255,255,0.04) glass fills
4. ALL redesigned module screens SHALL implement complete empty states, loading states, and error states with user-friendly messages
5. THE redesign SHALL preserve all existing functionality and data flows; it is a visual refresh, not a feature rewrite
6. EACH redesigned module SHALL pass the existing module test suite without regressions after the visual update

### Requirement 27: UI/UX Redesign (Public Beta Module Screens)

**User Story:** As a user, I want Public Beta modules to have a consistent visual design so that they feel usable and trustworthy even while in beta.

#### Acceptance Criteria

1. EACH Public_Beta module with existing mobile screens SHALL have its screens redesigned to match the corresponding UI/UX prompt file in `docs/uiux-prompts/`
2. THE redesign priority for Public_Beta modules SHALL follow this order based on user impact: workouts, nutrition, closet, cycle, journal, mood, notes, pets, car, flash, surf, trails, stars, garden, homes, voice, mail, forums, market, presence
3. ALL Public_Beta module redesigns SHALL follow the same Cool Obsidian design system and glass morphism patterns as GA modules
4. EACH Public_Beta module's redesigned screens SHALL display a "Beta" badge on the module home screen as required by Requirement 9
5. THE redesign for Public_Beta modules SHALL NOT block the production release; modules that have not been redesigned SHALL ship with their current visual treatment

### Requirement 28: Design System Token Evolution

**User Story:** As a developer, I want the design system tokens to support the full range of surface tiers and accent patterns needed by the redesigned screens so that all modules render consistently.

#### Acceptance Criteria

1. THE `packages/ui/src/tokens/colors.ts` file SHALL be extended to include additional surface tiers (surface-container-low, surface-container, surface-container-high, surface-container-highest, surface-container-lowest) if the redesign adopts the 5-tier surface system
2. THE `packages/ui/src/tokens/` directory SHALL include a hub-level accent color token (#C9894D amber) for hub shell screens, separate from per-module accent colors
3. THE design token source of truth SHALL remain in `packages/ui/src/tokens/` and all redesigned screens SHALL import tokens from this package rather than using hardcoded color values
4. IF the redesign adopts a new typography family (Plus Jakarta Sans), THEN the font SHALL be configured in both Expo (mobile) and Next.js (web) build configurations with Inter as the fallback
5. ALL glass morphism tokens (glass fill opacity, blur radius, border opacity) SHALL be defined in `packages/ui/src/tokens/glass.ts` and used consistently across all redesigned screens

