# MyClasses P21: Tutor SaaS Flywheel

Strategic scoping for an opt-in tutor marketplace built on top of MyClasses telemetry. Read this before any code in `modules/classes/` ships under `cs_tutor_*` table prefixes.

## 1. The flywheel premise

Students using MyClasses generate exhaust data every day: per-class grade trends, time-estimate-vs-actual ratios, study-session productivity, dependency blockages between assignments. Today none of this leaves the device. SQLite, prefixed `cs_`, no telemetry, no cloud. That is the privacy posture and it stays.

The question this doc scopes: if a student opts in, can their pattern of struggle on a specific class auto-match them with a tutor who has a measurable track record of unblocking that exact pattern? Not "I need help with calculus" but "I am at 67% in CALC-141, my time estimates are off by 2.3x on integration problems, and I have 2 blocked assignments tagged 'u-substitution'." That is a structurally different match than any incumbent runs.

## 2. Why this is defensible

**Match quality is the wedge.** Wyzant, Varsity, Preply match on subject string and star ratings. MyClasses can match on signals nobody else has access to: `getTimeEstimateAccuracy(classId)`, `getDependencyChain(assignmentId)`, `isBlocked(assignmentId)`, grade-trend slope from the P3-A grade engine, focus-session productivity from the P4-A study analytics. The tutor receives a structured profile of where the student is stuck before the first session, not after. Time-to-value collapses from 2-3 sessions of diagnostic to zero.

**Two-sided liquidity gets real evidence.** Students get instant context-aware matches. Tutors get pre-qualified leads with a built-in evidence trail: post-session, the platform watches whether the next assignment in that dependency chain came in on time and whether the grade trend inflected. That measurement is something Wyzant cannot do because they never see the LMS. It produces a "tutor effectiveness score" tied to actual outcomes per topic, not vibes.

**Privacy is the moat, not the constraint.** Opt-in only. Per-share, per-field consent. Time-limited share tokens. End-to-end-encrypted profile sync if any data leaves the device. We can publicly position competitors who scrape LMS data as surveillance, while we are service. The same posture that limits what we can do also makes the product trustworthy enough that students will share at all.

## 3. MVP scope

Three phases, sequenced to defer cloud and payments as long as possible.

### Phase F1 (3-4 weeks): student-side opt-in and shareable profile

- New table `cs_tutor_profiles`: `{ id, share_token, expires_at, included_class_ids: JSON, included_metrics: JSON, created_at, revoked_at }`.
- "Share with tutor" flow in MyClasses: student picks a class, picks which metrics to include (grade trend, time-estimate variance, blocked assignments, study session summary), generates a one-time share token plus URL.
- Tutor lands on `/tutor-view/[token]` (public web route, no auth) showing only the chosen fields. Token expires in 14 days default, revocable from the student's privacy log at any time.
- Reuses existing `getGradeTrend` (P3-A), `getTimeEstimateAccuracy` and `getDependencyChain` (P2-A), and the P4-A study session aggregator. No new analytics work, only a serializer.
- No cloud, no accounts, no payments. Token + URL is enough to validate the share UX with real tutors.

### Phase F2 (4-6 weeks): tutor profiles and matching MVP

- Cloud-side directory (Supabase or new Drizzle service): `tutors`, `tutor_subjects`, `tutor_credentials`, `tutor_availability`, `match_requests`, `cs_tutor_sessions`.
- Match algorithm v0: filter by subject (class.code prefix or subject taxonomy), then rank by `friction_score(student) * match_history_score(tutor, topic)`. Friction score is computed from MyClasses signals on-device and sent only after consent. Match history score starts at a uniform prior and updates from `cs_tutor_sessions` outcomes.
- Pricing surface: tutors set hourly rate, platform takes 15%. Stripe Connect for payouts. Identity verification at onboarding.

### Phase F3 (6-8 weeks): two-sided dashboards

- Tutor dashboard (Next.js route group inside `apps/web` or a sibling app): inbox of match requests, calendar, session log, payout history, ratings.
- Student dashboard inside MyClasses: post-session, the tutor's session note plus an outcome metric attached automatically (next assignment grade vs trend, time-estimate accuracy delta on similar tasks). This closes the loop and feeds the effectiveness score that becomes the platform's defensible asset.

## 4. Pricing and unit economics

The free tier of MyClasses stays untouched. No paywall on any existing function. The marketplace is purely additive.

Tutors pay a 15% platform fee on each booking. Optional "MyLife Pro+" student tier adds priority match, more concurrent active tutors, and group study rooms at a $7-9/mo price point to be tested. We do not charge students per match.

Rough unit math: average tutor session $40/hr, 1 session/wk per matched student, 8% match-acceptance among MyClasses MAU. At 30k MAU that is 2,400 weekly sessions, $96k weekly GMV, $14.4k weekly platform revenue at 15%. CAC is near zero on the student side because supply comes from the existing MyLife user base, which inverts the typical marketplace burn curve. Tutor-side CAC is the real cost, which is why F1 is structured to bring tutors in via direct partnerships before any paid acquisition.

## 5. Risks and mitigations

- Privacy regression risk: even opt-in sharing is a perception risk. Every share is a discrete, time-limited, audited event surfaced in the user's privacy log. Default OFF on every field. No bulk share, no recurring share without an explicit re-consent.
- Tutor quality liability: vet via credential upload, identity verification, post-session rating, and dispute flow. Suspend below threshold rating. We are a marketplace, not an employer, but we curate.
- Cold start: seed supply with TA partnerships at 5-10 universities before public launch. Without supply, F2 ships dead.
- Cannibalization of a future B2B tier: a MyClasses-for-Universities upsell could conflict with the marketplace if a school wants to direct all matches in-house. Keep the institutional tier and the open marketplace tier as composable products with separate billing.
- Regulatory: FERPA in the US, GDPR for any EU students, plus state-level tutor licensing rules. Counsel review required before any cross-border share token works in production.

## 6. Out of scope for MVP

- Live video. Use Zoom or Meet links pasted into the booking.
- In-app chat. Use email or SMS for v1.
- Group classes. 1:1 only.
- Scholarship and financial aid integration.
- Tutor directory browsing before a match is requested. Algorithmic match only, no marketplace search UI.

## 7. Build readiness checklist

| Dependency | MyClasses prompt | Readiness |
|---|---|---|
| Grade engine plus trend | P3-A | Ready |
| Time-estimate variance | P2-A `getTimeEstimateAccuracy` | Ready |
| Dependency / blocking detection | P2-A `getDependencyChain`, `isBlocked` | Ready |
| Study session analytics | P4-A | Ready |
| Privacy consent log | P5_5-B `privacyConsentAcknowledgedAt` | Partial, needs per-share audit log |
| Cloud sync infra | none yet | Not yet, Phase F1 introduces |
| Stripe Connect | none yet | Not yet, Phase F2 introduces |

## 8. Recommended next step

Do not build F2 yet. Build F1 share token plus tutor-view as a no-cloud, no-payments prototype. Hand share URLs to 5 tutor partners. Watch what they do with the data, watch which fields they ask for that we do not show, watch which fields they ignore. Iterate the share UX until tutors say the document saves them a session of diagnostic on its own. Only then stand up Stripe Connect and the matching service. The flywheel only matters if the share-with-tutor experience already saves students hours, before any marketplace exists.
