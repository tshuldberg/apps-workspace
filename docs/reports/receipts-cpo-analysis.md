# Receeps CPO Product-Marketing Alignment Analysis

> **Date:** 2026-02-13
> **Author:** CPO Agent
> **Scope:** Deep product review of Receeps with marketing intersection analysis
> **Product Version:** As of 2026-02-11 (last PRODUCT_FEATURES.md update)

---

## Executive Summary

Receeps is a community-driven evidence verification platform with a surprisingly mature feature surface for a pre-launch product. The core loop (submit evidence, vote on credibility, discuss) is fully implemented with multi-dimensional voting, threaded comments, staff verification, and a personalized feed algorithm. The product has recently expanded into social features (MySpace-style profiles, communities, follow system) and monetization infrastructure (promoted posts/ads system).

**However, the product has significant gaps that would prevent effective marketing execution:**

1. **No email lifecycle beyond password reset** -- the single biggest blocker. No welcome email, no notification digests, no re-engagement emails. The `NotificationPreference` model supports `email_frequency` (immediate/daily/weekly/never) but no Celery tasks send actual email notifications.

2. **Share buttons are non-functional** -- Receipt and topic cards display Share icons with no click handler. There is no copy-link, no social sharing (Twitter/X, Facebook, Reddit), and no Open Graph meta tags for link previews.

3. **No SEO infrastructure** -- The SPA has a single `<title>` tag ("Receeps") in `index.html` with no meta description, no Open Graph tags, no Twitter Cards, no structured data (JSON-LD). The `DocumentTitle` component sets `document.title` dynamically but this is invisible to crawlers without server-side rendering.

4. **Follow system is model-only** -- The `Follow` model exists and supports topics, categories, users, and communities, but has no API endpoints (no viewsets, serializers, or URL routes). The sidebar shows "Followed Topics" placeholder with "No followed topics yet."

5. **No onboarding flow** -- After signup, users are redirected to `/` (which renders the receipts feed). No welcome modal, no guided tour, no suggested content, no first-action prompt.

6. **Analytics is placeholder** -- GA4 and Facebook Pixel are initialized with empty tracking IDs (`""` / TODO comments).

---

## 1. Product Capabilities Inventory

### What Exists Today (Fully Implemented)

| Domain | Capabilities | Maturity |
|--------|------------|----------|
| **Auth** | JWT signup/login, auto-refresh, password reset (with email template), route guards | Production-ready |
| **Receipts** | CRUD, multi-topic linking, source type classification (7 types), file upload (image/document via S3), duplicate URL detection, verification workflow (5 statuses) | Production-ready |
| **Topics** | CRUD, category grouping, AI summary field, optional initial receipt on create | Production-ready |
| **Voting** | Multi-dimensional (relevance 1-5, reliability 1-5, bias 7-point spectrum), expertise claim, optional comment, vote update | Production-ready |
| **Comments** | Threaded (self-referencing), upvote/downvote, edit/delete, moderation removal, reporting | Production-ready |
| **Notifications** | 13 types (vote, verification, expert vote, follower, threshold, etc.), in-app center with tabs/filters, mark-read, unread count badge, preference model with email frequency | In-app complete; email delivery missing |
| **Categories** | Name, slug, description, icon, color, sort order, active flag | Production-ready |
| **Feed Algorithm** | Personalized scoring (hot ranking, category/source weights, recency/verification bias, mood filter, diversity enforcement), user preferences, feed profiles (save/switch) | Production-ready |
| **Profiles** | Public profile page (`/profile/:username/`), about me, mood text/emoji, banner image, custom HTML/CSS (sanitized), profile templates, profile songs (Spotify/SoundCloud embed), profile views tracking, trust tiers (new/member/trusted/verified) | Production-ready |
| **Communities** | Subreddit-like model (name, slug, tagline, description, category, privacy levels, membership roles, invitation/ban tracking, post type restrictions, mod queue, mod log) | Recently built; frontend exists |
| **Ads** | `PromotedPost` model (title, image, destination URL, CTA, advertiser info, placement sidebar/in-feed, category targeting, impression/click tracking, budget/CPC/spent) | Model + API exist |
| **Moderation** | Report model (8 reasons, 6 statuses), topic unusual-activity detection (automated Celery), staff dashboard with bulk verification, receipt card quick-actions (publish/escalate/remove) | Production-ready |
| **Search** | Global search in header (debounced, cross-entity), receipt full-text search, filter by source type/verification/topic/category | Production-ready |
| **Mobile** | Responsive layouts, bottom navigation, mobile drawer sidebar, mobile category dropdown | Production-ready |

### What Exists in Skeleton Form

| Feature | Status | What's Missing |
|---------|--------|---------------|
| **Follow system** | Model only (`follows/models.py`) with topic/category/user/community support | No viewsets, serializers, URLs, or frontend UI |
| **Share** | Icon displayed on receipt cards and topic cards | No click handler -- zero functionality |
| **Email notifications** | Preference model stores `email_frequency` (immediate/daily/weekly/never), `send_templated_email` utility exists | No Celery tasks to batch/send notifications, only password reset template exists |
| **Analytics** | GA4 + FB Pixel initialized in `App.jsx` | Tracking IDs are empty strings (TODO) |
| **Cookie consent** | Banner displays via `react-cookie-consent` | No integration with actual analytics consent |
| **Explore page** | Route exists at `/explore` | Placeholder page |
| **About Us page** | Route exists at `/about` | Static placeholder content |

### What Does Not Exist

| Feature | Impact on Marketing |
|---------|-------------------|
| **Server-side rendering (SSR) or pre-rendering** | Fatal for SEO -- crawlers see empty `<div id="root">` |
| **Open Graph / Twitter Card meta tags** | Links shared on social media show no preview |
| **Sitemap.xml / robots.txt** | Search engines cannot efficiently discover content |
| **Email welcome sequence** | No activation nurturing |
| **Email notification delivery** | No re-engagement channel |
| **Social sharing (copy link, share to Twitter/X, etc.)** | No organic virality mechanism |
| **Referral system** | No word-of-mouth growth lever |
| **Public API documentation** | Cannot attract developer ecosystem |
| **Landing pages (beyond `/`)** | No campaign destination pages |
| **A/B testing infrastructure** | Cannot optimize conversion funnels |
| **Event tracking / product analytics** | Cannot measure activation, retention, or feature adoption |

---

## 2. User Flow Analysis

### Signup -> Activation -> Retention

```
SIGNUP FLOW:
/signup/ -> form (username, name, email, password) -> POST /api/signup/ -> JWT stored -> redirect /

ACTIVATION FLOW (current):
/ (receipts feed) -> ???

There is NO guided first action. User lands on the feed with no context, no prompt, no tutorial.

IDEAL ACTIVATION FLOW (missing):
/signup/ -> welcome modal -> "Pick 3 categories" -> "Browse trending topics" -> first vote -> "You're contributing!"
```

**Post-signup experience today:**
1. User creates account
2. Redirected to `/` which shows the receipts feed via `ReceiptsHomePage`
3. User must self-discover what to do
4. No email confirmation or welcome email
5. No suggestion of first action
6. No empty-state guidance specific to new users

**Critical gap:** The "aha moment" is likely the first vote (experiencing the multi-dimensional assessment) or seeing a credibility score update. But nothing guides users toward either action.

### Content Creator Flow

```
RECEIPT SUBMISSION:
/receipts/new/ -> form (title, evidence, source URL, source type, date, topics, file) -> POST -> redirect to receipt detail

TOPIC CREATION:
/topics/new/ -> form (name, summary, optional initial receipt) -> POST -> redirect to topic detail
```

**Strengths:** Both forms include validation, loading states, success notifications, and auto-redirect. The topic form cleverly allows bundling an initial receipt.

**Gaps:** No content suggestions, no trending topic prompts, no "topics that need evidence" discovery flow.

### Voter/Assessor Flow

```
VOTING:
Receipt or Topic detail page -> VotingInterface -> relevance (1-5) + reliability (1-5) + bias (7-point) + optional comment + expertise claim -> POST /api/v1/votes/ -> notification sent to content owner
```

**Strengths:** The voting interface is the product's crown jewel. Multi-dimensional assessment is genuinely novel and creates rich signal data.

**Gaps:** No "suggested for you" voting queue, no gamification around voting milestones, no explanation of what each dimension means to new users.

### Return Visit Flow

```
RETURN PATH (current):
Notification bell (if user checks) -> NotificationCenter -> click notification -> content

RETURN PATH (missing):
Email digest -> trending content link -> app
Push notification -> app
Follow system -> personalized feed -> new content from followed topics
```

**Critical gap:** The only return path is the user remembering to visit the site. No external trigger exists.

---

## 3. Product-Marketing Intersection Map

### Matrix: Product Feature x Marketing Skill

| Product Feature | Content Marketing | SEO | Social/Viral | Email | Community Building | Conversion Opt. | Analytics |
|----------------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Receipt submission | Seed content | Indexable pages (needs SSR) | Share button (broken) | "Your receipt was verified" email (no delivery) | Community receipt feeds | Submit CTA exists | No tracking |
| Multi-dimensional voting | Unique value prop for content | - | "I voted X on Y" share (missing) | Vote notification email (no delivery) | Engagement driver | Login-to-vote prompt exists | No tracking |
| Credibility scores | Trust/authority content | Rich snippets potential | "See the score" social proof | Score milestone email (model exists, no delivery) | Leaderboards (missing) | Score badges on cards | No tracking |
| Categories | Content hubs | Category landing pages (needs SSR) | - | Category digest (missing) | Category communities | Category filter works | No tracking |
| Topics | Evergreen content | Topic pages (needs SSR) | Topic sharing (broken) | New receipts for topic (no delivery) | Topic-centric communities | Topic creation CTA | No tracking |
| Comments/threads | Discussion depth | - | - | Reply notification (missing) | Active discussions | Comment-to-signup prompt | No tracking |
| Communities | User-generated hubs | Community pages (needs SSR) | Community invite (missing) | Community digest (missing) | Core growth lever | Join CTA | No tracking |
| Profiles | Creator showcase | Profile pages (needs SSR) | Profile sharing (missing) | Profile views notification (missing) | Identity/belonging | Profile customization hook | View tracking exists |
| Feed algorithm | Personalization content | - | - | "Recommended for you" email (missing) | Engagement retention | Feed preference settings | No tracking |
| Ads/promoted posts | Revenue enabler | - | - | - | Monetization for community | Ad placement + targeting | Impression/click tracking exists |
| Verification system | Trust authority content | Verification badges for SEO | "Staff verified" social proof | Verification notification (in-app only) | Trust signal | Verified badge on cards | No tracking |

### Key Intersections

**Highest Impact, Lowest Effort:**
1. **Share functionality** -- wire up existing share buttons with copy-link and Web Share API
2. **Open Graph tags** -- add dynamic `<meta>` tags per route (even client-side helps some platforms)
3. **Analytics activation** -- set GA4/FB Pixel tracking IDs (infrastructure already exists)
4. **Follow API** -- expose existing Follow model via DRF viewsets (model is done)

**Highest Impact, Medium Effort:**
5. **Email notification delivery** -- create Celery task to batch and send notifications using existing `send_templated_email`
6. **Welcome email** -- single template + post-signup signal
7. **SSR/Pre-rendering** -- either Next.js migration (large) or `django-prerender` / `rendertron` middleware (medium)

**Highest Impact, Highest Effort:**
8. **Full onboarding flow** -- welcome modal, category selection, first-action guided tour
9. **Sitemap generation** -- dynamic sitemap for topics/receipts/categories/profiles
10. **Structured data (JSON-LD)** -- Article/ClaimReview schema for receipts

---

## 4. Gap Analysis

### Gaps That Block Marketing Execution

| # | Gap | Blocks | Severity | Effort |
|---|-----|--------|----------|--------|
| G1 | **No email delivery for notifications** | Email marketing, re-engagement, lifecycle nurturing | Critical | Medium (Celery tasks + 3-4 templates) |
| G2 | **No SEO infrastructure (SSR, meta tags, sitemap)** | Search discovery, content marketing ROI, organic growth | Critical | High (SSR migration or pre-render setup) |
| G3 | **Share buttons non-functional** | Viral loops, social proof, word-of-mouth | Critical | Low (add click handlers, Web Share API) |
| G4 | **Analytics not connected** | Measuring anything, funnel optimization, attribution | Critical | Very Low (set tracking IDs) |
| G5 | **Follow system has no API** | Personalized notifications, retention via following | High | Medium (standard DRF viewsets) |
| G6 | **No onboarding/welcome flow** | Activation rate, first-action completion | High | Medium (modal + guided steps) |
| G7 | **No email templates (welcome, digest, verification)** | Email channel entirely unusable | High | Medium (HTML templates + Celery schedule) |
| G8 | **No referral mechanism** | Word-of-mouth growth, viral coefficient | Medium | Medium (invite codes or referral links) |
| G9 | **No public landing pages** | Campaign destinations, paid ads landing | Medium | Low-Medium (static pages or route additions) |
| G10 | **No A/B testing infrastructure** | Conversion optimization, feature rollouts | Medium | High (feature flags + experiment framework) |

### Technical Debt Blocking Marketing

1. **SPA-only rendering**: The entire frontend is a client-side React SPA. All pages return the same `index.html` with an empty `<div id="root">`. This means:
   - Google crawls a blank page (even with rendering improvements, SPA SEO is unreliable)
   - Social media link previews show "Receeps" with no description or image
   - No structured data for rich snippets

2. **No event tracking integration**: GA4 is initialized but with an empty tracking ID. There is no custom event tracking for key actions (signup, first receipt, first vote, etc.). Without this data, marketing cannot measure funnel performance.

3. **Follow model without API surface**: The Follow model (`follows/models.py`) correctly validates against topics, categories, users, and communities -- but there are zero viewsets or URLs exposing this. The sidebar UI already has placeholder sections for "Followed Topics" and "Favorites."

### Data/Analytics Gaps

| Metric | Can We Measure Today? | What's Needed |
|--------|----------------------|---------------|
| DAU/MAU | No | GA4 tracking ID |
| Signup conversion rate | No | GA4 + signup event |
| Activation rate (first vote) | No | Custom event tracking |
| Content submission rate | No | Custom event tracking |
| Retention (D1/D7/D30) | No | GA4 user properties |
| Virality (share -> signup) | No | Share functionality + UTM tracking |
| Email open/click rates | No | SES configuration + tracking |
| Feed engagement (CTR) | Partially (ad impressions/clicks exist) | Extend to organic content |
| Profile engagement | Partially (profile_views field exists) | Extend with view duration, interaction |

---

## 5. Product Changes Needed to Unlock Marketing (Prioritized)

### Priority 1: Foundation (Must Have Before Any Marketing Push)

**P1.1: Activate Analytics** (1 day)
- Set GA4 tracking ID in `App.jsx`
- Add custom events for: signup, login, receipt_submit, topic_create, vote_cast, comment_post, share_click
- Wire cookie consent to analytics consent

**P1.2: Fix Share Buttons** (1-2 days)
- Add click handler to existing share icons on `ReceiptCard.jsx` and `TopicCard.jsx`
- Implement: copy link to clipboard, Web Share API (mobile native share sheet), fallback share menu (Twitter/X, Facebook, Reddit, email)
- Add UTM parameters to shared URLs

**P1.3: Add Open Graph Meta Tags** (1-2 days)
- Add dynamic `<meta property="og:*">` and `<meta name="twitter:*">` tags
- For SPA: use `react-helmet-async` or similar to set per-route meta
- Note: This helps with social platforms that execute JavaScript but does NOT help with Google SEO

**P1.4: Email Notification Delivery** (3-5 days)
- Create Celery periodic task that batches unsent notifications by `email_frequency`
- Create email templates: `notification_immediate.html`, `notification_digest.html`
- Wire to existing SES backend (already configured for prod/staging)
- Honor `NotificationPreference.email_enabled` and `type_preferences`

### Priority 2: Activation & Retention (Before Growth Marketing)

**P2.1: Welcome Email** (1 day)
- Create `email/welcome.html` template
- Send via post-save signal on User create (or modify existing `create_notification_preferences` signal)
- Include: welcome message, "here's what you can do," top 3 trending topics links

**P2.2: Onboarding Flow** (3-5 days)
- Post-signup modal: "Welcome to Receeps!" -> pick 3 categories -> see personalized feed
- Empty-state CTAs for new users (no receipts? "Submit your first evidence"), (no votes? "Cast your first assessment")
- Highlight the voting interface with a tooltip tour on first visit

**P2.3: Follow System API** (2-3 days)
- Create `follows/serializers.py`, `follows/viewsets.py`, `follows/urls.py`
- Endpoints: `POST /follows/` (follow), `DELETE /follows/:id/` (unfollow), `GET /follows/` (list my follows), `GET /follows/followers/` (list my followers)
- Wire to sidebar "Followed Topics" and "Favorites" sections
- Create notification on new follower

**P2.4: Notification Email for Follows** (1-2 days)
- "New receipt in a topic you follow"
- "New topic in a category you follow"
- Uses existing notification types that are already created in signals

### Priority 3: Discovery & Growth (Growth Marketing Enablers)

**P3.1: SSR or Pre-rendering** (5-10 days)
- Option A: Pre-rendering service (rendertron/prerender.io) -- medium effort, good enough for SEO
- Option B: Move to Next.js -- high effort, best long-term SEO story
- Recommendation: Start with Option A for quick wins, plan Option B for v2

**P3.2: Sitemap & robots.txt** (1-2 days)
- Django management command to generate `sitemap.xml` from topics, receipts, categories, communities, profiles
- Serve `robots.txt` allowing crawlers, pointing to sitemap
- Submit to Google Search Console

**P3.3: Structured Data (JSON-LD)** (2-3 days)
- `ClaimReview` schema for receipts (Google supports this for fact-checking)
- `DiscussionForumPosting` for topics
- `Organization` for site-wide identity
- This is a major SEO advantage since Google actively surfaces ClaimReview in search results

**P3.4: Referral System** (3-5 days)
- Unique referral codes per user
- Track signups from referral links
- Referral reward (badge, reputation points, etc.)

### Priority 4: Optimization (Once Traffic Exists)

**P4.1: A/B Testing Framework** (3-5 days)
**P4.2: Campaign Landing Pages** (2-3 days per page)
**P4.3: Push Notifications (PWA)** (3-5 days)
**P4.4: Public API + Developer Portal** (5-10 days)

---

## 6. Recommended Product Metrics to Track

### North Star Metric
**Weekly Active Assessors (WAA):** Users who cast at least 1 vote per week. This captures the core value loop -- evidence assessment.

### Funnel Metrics

| Stage | Metric | Target | How to Measure |
|-------|--------|--------|---------------|
| **Awareness** | Unique visitors / week | -- | GA4 |
| **Acquisition** | Signup rate (visitors -> signups) | >5% | GA4 event |
| **Activation** | First vote within 24h of signup | >30% | Custom event + user property |
| **Retention** | D7 return rate | >20% | GA4 cohort analysis |
| **Revenue** | Promoted post CTR | >1% | Existing `PromotedPost.clicks_count` |
| **Referral** | Shares per active user / week | >0.5 | Share event tracking (needs implementation) |

### Engagement Metrics

| Metric | Definition | Why It Matters |
|--------|-----------|---------------|
| Votes per receipt | Average vote count per receipt | Content quality signal |
| Comments per topic | Average comment threads per topic | Discussion depth |
| Receipts per topic | Average evidence pieces per topic | Evidence breadth |
| Community join rate | Joins / community page views | Community product-market fit |
| Feed scroll depth | How far users scroll the feed | Content relevance |
| Credibility score distribution | Distribution of receipt credibility scores | Platform health |
| Verification throughput | Receipts verified / week | Staff capacity indicator |

### Health Metrics

| Metric | Alert Threshold |
|--------|---------------|
| Report volume / day | >2x 7-day average |
| Unusual activity flags / week | Trending up |
| Average credibility score | Deviates >1 std dev from historical mean |
| User churn (no login in 30 days) | >60% of total users |
| Content creation ratio (receipts:votes) | <1:5 or >1:1 |

---

## 7. Product-Marketing Readiness Score

| Dimension | Score (1-5) | Notes |
|-----------|:-----------:|-------|
| Core product loop | 4 | Submit, vote, discuss, verify -- all working |
| Onboarding & activation | 1 | No onboarding flow, no welcome email, no guided first action |
| Sharing & virality | 1 | Share buttons exist but are non-functional |
| SEO & discoverability | 1 | SPA with no SSR, no meta tags, no sitemap, no structured data |
| Email lifecycle | 1 | Only password reset template exists |
| Analytics & measurement | 1 | GA4/FB Pixel initialized with empty IDs |
| Social features (follow/community) | 3 | Communities fully built, follow model exists but no API |
| Content moderation & trust | 4 | Reporting, staff dashboard, unusual activity detection, trust tiers |
| Monetization infrastructure | 3 | Promoted posts model with targeting and budget tracking |
| Mobile experience | 4 | Responsive layouts, bottom nav, drawer sidebar |

**Overall Marketing Readiness: 2.3 / 5**

The core product is strong, but the infrastructure that connects product to marketing (analytics, email, sharing, SEO) is almost entirely absent. Marketing campaigns would drive users to a product with no measurement, no re-engagement channels, and no organic discovery path.

**Recommendation:** Invest 2-3 weeks in Priority 1 and Priority 2 items before any marketing spend. The P1 items (analytics, share, OG tags, email) are all low-to-medium effort and dramatically increase the surface area for marketing skills to operate on.

---

*Report generated from deep codebase analysis of `/Users/trey/Desktop/Apps/receipts/` including all Django apps, React components, data models, API endpoints, Celery tasks, and frontend routing.*
