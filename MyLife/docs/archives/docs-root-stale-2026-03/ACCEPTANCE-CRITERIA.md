# MyLife Acceptance Criteria

**Date:** 2026-03-04
**Author:** TheDawg

---

## Overview

This document defines explicit, verifiable criteria for three release milestones. Each criterion is binary (pass/fail) and must be validated by automated test, manual verification, or both. Criteria are cumulative: Beta includes all Alpha criteria, v1.0 includes all Beta criteria.

---

## Alpha (Internal Testing Ready)

**Goal:** The app can be installed on test devices and used by the development team to validate core flows end-to-end. Not for external users.

### Build and CI

- [ ] `pnpm typecheck` passes with zero errors across all packages
- [ ] `pnpm test` passes with zero failures across all packages
- [ ] `pnpm check:parity` passes with zero failures
- [ ] `pnpm lint` passes with zero warnings or errors
- [ ] CI pipeline (GitHub Actions) is green on main branch
- [ ] Mobile app builds successfully for iOS simulator (EAS Build or local)
- [ ] Mobile app builds successfully for Android emulator
- [ ] Web app builds and starts with `pnpm --filter @mylife/web build && pnpm --filter @mylife/web start`

### Core Functionality

- [ ] Hub dashboard displays all 13 registered modules with correct metadata
- [ ] Module enable/disable persists across app restarts (mobile and web)
- [ ] Hub mode selection (local_only, hosted, self_host) persists
- [ ] Database migrations run successfully for all 13 modules on fresh install
- [ ] At least 3 modules (books, budget, fast) have full CRUD working on both mobile and web
- [ ] Module error boundary catches rendering crashes and provides recovery UX (mobile)
- [ ] Database integrity check runs on mobile startup
- [ ] Settings page renders and is functional on both platforms

### Data Layer

- [ ] SQLite WAL mode is enabled on both platforms
- [ ] Foreign keys are enforced
- [ ] Module table prefixes prevent collisions
- [ ] Migration runner handles incremental upgrades (v1 -> v2) correctly
- [ ] `hub_schema_versions` tracks applied migrations accurately

### Testing

- [ ] Unit test coverage exists for all module CRUD operations
- [ ] At least 3 module integration tests pass on web (E2E)
- [ ] Hub dashboard E2E test passes (navigation to modules, enable/disable)
- [ ] Total test count > 150 across all packages (currently ~185 test files)

---

## Beta (Early User Testing)

**Goal:** The app can be distributed to a closed group of external testers via TestFlight (iOS) and internal testing track (Android). Core modules are feature-complete. Users can create accounts and manage subscriptions.

### All Alpha criteria, plus:

### Authentication

- [ ] @mylife/auth implements Supabase Auth (or equivalent)
- [ ] Users can sign up with email/password
- [ ] Users can sign in from mobile and web
- [ ] Anonymous/guest mode works for local-only users (no forced sign-up)
- [ ] Session persistence across app restarts
- [ ] Sign-out clears session state correctly

### Subscription and Billing

- [ ] @mylife/subscription implements RevenueCat (mobile) and Stripe (web)
- [ ] Free tier modules accessible without subscription
- [ ] Premium tier modules gated behind subscription
- [ ] Entitlement verification works offline (cached entitlements)
- [ ] Subscription status syncs between mobile and web for same user
- [ ] At least one test purchase flow works end-to-end (sandbox)

### Observability

- [ ] Sentry (or equivalent) integrated for mobile crash reporting
- [ ] Sentry (or equivalent) integrated for web error reporting
- [ ] Structured logging in self-host API (JSON format with levels)
- [ ] Web error boundary implemented matching mobile pattern
- [ ] Health check endpoint returns meaningful status for all dependencies

### Data Safety

- [ ] Users can export all their data as JSON or CSV from settings
- [ ] Data export includes all enabled modules' data
- [ ] Export works offline (operates on local SQLite)
- [ ] Mobile database is included in device backups (iCloud/Google)

### Distribution

- [ ] iOS TestFlight build distributed to testers
- [ ] Android internal testing track build distributed
- [ ] Web app deployed to a staging URL
- [ ] Self-host Docker image published to a container registry

### Module Maturity

- [ ] At least 6 modules have full CRUD on both platforms (books, budget, fast, health, car, habits)
- [ ] Parity checks pass for all modules with standalone repos
- [ ] Standalone MyBooks and MyBudget apps are functional and parity-verified
- [ ] Module discovery page shows accurate install/pricing information

### Security

- [ ] CSP removes unsafe-eval
- [ ] npm audit shows no critical or high vulnerabilities
- [ ] Rate limiting on all authenticated API endpoints
- [ ] Input validation (Zod or equivalent) on all API routes

### Performance

- [ ] Mobile app cold start < 3 seconds on iPhone 12 or equivalent
- [ ] Web app LCP < 2.5 seconds on 4G connection
- [ ] No memory leaks detected in 30-minute mobile usage session
- [ ] Database operations complete in < 100ms for standard CRUD

---

## v1.0 (Production Launch)

**Goal:** Public release on App Store and Google Play. Self-host option available. All core modules functional, billing live, data safe.

### All Beta criteria, plus:

### App Store Readiness

- [ ] iOS App Store listing complete (screenshots, description, privacy policy)
- [ ] Google Play Store listing complete
- [ ] App passes Apple Review guidelines
- [ ] App passes Google Play policy requirements
- [ ] Privacy policy published and linked in app
- [ ] Terms of service published and linked in app
- [ ] Age rating configured correctly

### Billing (Live)

- [ ] Stripe production account configured and verified
- [ ] RevenueCat production account configured
- [ ] At least one subscription tier purchasable in production
- [ ] Receipt validation working for both platforms
- [ ] Refund handling implemented
- [ ] Subscription management (cancel/resume) works
- [ ] Pricing page renders correctly with localized prices

### Module Coverage

- [ ] At least 10 modules have full CRUD on both platforms
- [ ] All 13 registered modules render without crashes on both platforms
- [ ] Module onboarding flows exist for all premium modules
- [ ] Module settings are accessible and functional

### Self-Host

- [ ] Self-host documentation published (README, setup guide)
- [ ] Docker Compose deployment tested on fresh Linux server
- [ ] Self-host backup/restore scripts tested and documented
- [ ] Federation between two self-host instances verified
- [ ] Self-host update process documented

### Operational

- [ ] Incident response runbook written and accessible
- [ ] Monitoring alerts configured for self-host health endpoint
- [ ] Database backup strategy documented and automated (self-host)
- [ ] On-call rotation established (even if it is just Trey)
- [ ] Release process documented (build -> test -> stage -> ship)
- [ ] Rollback procedure documented for mobile and web

### Performance (Production)

- [ ] Lighthouse score > 90 for web app
- [ ] Bundle size < 500KB gzipped for web initial load
- [ ] Mobile binary size < 50MB
- [ ] P95 API response time < 200ms for self-host
- [ ] Database handles 10,000+ rows per module without degradation

### Data and Compliance

- [ ] GDPR data export request handling implemented
- [ ] CCPA opt-out mechanism available
- [ ] Data retention policy documented
- [ ] Account deletion flow implemented (removes all user data)
- [ ] Analytics consent mechanism if any analytics are collected

### Quality Gates (Ongoing)

- [ ] Zero typecheck errors on every merge to main
- [ ] Zero test failures on every merge to main
- [ ] Parity checks pass on every merge to main
- [ ] E2E tests pass on every merge to main
- [ ] No critical/high dependency vulnerabilities
