# CMO Marketing Analysis: Receeps

> **Date:** 2026-02-13
> **Author:** CMO Agent
> **Product:** Receeps -- Community-Driven Evidence & Fact-Checking Platform
> **Status:** Complete

---

## Executive Summary

Receeps is a well-built community-driven evidence verification platform with strong product fundamentals -- multi-dimensional voting, threaded comments, staff verification workflows, credibility scoring, and a Reddit-style feed experience. However, the product has **near-zero marketing infrastructure**. There is no SEO setup, no email marketing, no analytics implementation, no social sharing mechanics, no referral system, and no content strategy. The gap between product maturity and marketing maturity represents a massive opportunity.

**Top 5 findings:**
1. **SEO is completely absent** -- SPA-only rendering, no meta tags, no sitemap, no schema markup, no server-side rendering. Google cannot index any content.
2. **Analytics tracking is not implemented** -- GA4 and Facebook Pixel IDs are blank (`""`) in App.jsx. Zero visibility into user behavior.
3. **No email marketing exists** -- Despite AWS SES infrastructure and Celery workers, there are no transactional emails, welcome sequences, or re-engagement flows.
4. **The signup flow has high friction** -- 6 required fields, no social auth, no trust signals, no value demonstration before commitment.
5. **User-generated content has no public SEO value** -- Thousands of potential landing pages (topics, receipts, categories) are invisible to search engines.

**Bottom line:** Receeps has a strong product that nobody can find. Marketing infrastructure should be the #1 priority.

---

## 1. Product Understanding

### What Receeps Does
Receeps is a platform where users submit evidence ("receipts") linked to discussion topics. The community votes on evidence along three dimensions (relevance, reliability, bias), staff moderators verify submissions, and credibility scores emerge from consensus. Think of it as a Reddit-style platform specifically designed for fact-checking and evidence-based discourse.

### Core User Journey
1. **Discover** a topic or receipt (currently only via direct link or browsing)
2. **Browse** evidence cards with credibility scores, verification badges, and source types
3. **Sign up** to contribute (6-field registration form)
4. **Submit** receipts with evidence text, source URLs, file attachments, and topic links
5. **Vote** on evidence across relevance, reliability, and bias dimensions
6. **Comment** in threaded discussions on receipts and topics
7. **Track** activity via dashboard, notifications, and voting history

### Key Pages and Routes
| Route | Purpose | Auth Required |
|-------|---------|:---:|
| `/` | Home (redirects to Receipts feed) | No |
| `/receipts` | Browse/search/filter evidence | No |
| `/receipts/:id` | Full receipt detail + voting + comments | No (actions need auth) |
| `/receipts/new` | Submit new evidence | Yes |
| `/topics` | Browse/filter topics | No |
| `/topics/:id` | Topic detail + linked receipts | No (actions need auth) |
| `/topics/new` | Create new topic | Yes |
| `/communities` | Community directory | No |
| `/c/:slug` | Community detail | No |
| `/profile/:username` | Public user profile | No |
| `/dashboard` | User activity center | Yes |
| `/notifications` | Notification management | Yes |
| `/staff-dashboard` | Moderation tools | Staff only |
| `/about` | About page | No |
| `/login` | Login | No |
| `/signup` | Registration | No |

### Current Marketing State
- **Google Analytics:** Initialized in code but tracking ID is blank (`""`)
- **Facebook Pixel:** Initialized in code but pixel ID is blank (`""`)
- **SEO:** Zero implementation -- no meta descriptions, no OG tags, no sitemap, no robots.txt, no schema markup, no SSR/prerendering
- **Email marketing:** No welcome emails, no onboarding sequences, no re-engagement
- **Social sharing:** No share buttons, no OG image generation, no viral mechanics
- **Referral program:** None
- **Content marketing:** No blog, no educational content, no comparison pages
- **Paid acquisition:** No landing pages, no conversion tracking
- **About page:** Generic placeholder copy with hardcoded hex colors (`#2C2C2C`, `#333333`, `#FFD700`)

---

## 2. Marketing Skills Mapping (All 25 Skills)

### Priority Rating Table

| # | Skill | Priority | Relevant to Receeps? | Key Opportunity |
|---|-------|:--------:|:---:|-----------------|
| 1 | **seo-audit** | Critical | Yes | Zero SEO infrastructure exists; this is the #1 blocker |
| 2 | **analytics-tracking** | Critical | Yes | GA4/Pixel IDs blank; no event tracking at all |
| 3 | **schema-markup** | Critical | Yes | No structured data; rich snippets impossible |
| 4 | **signup-flow-cro** | Critical | Yes | 6-field form, no social auth, no trust signals |
| 5 | **onboarding-cro** | Critical | Yes | No post-signup guidance; empty-state experience is weak |
| 6 | **email-sequence** | Critical | Yes | AWS SES exists but zero emails are sent |
| 7 | **programmatic-seo** | High | Yes | Topics + receipts = thousands of indexable pages |
| 8 | **page-cro** | High | Yes | Home page is just the feed; no marketing landing page |
| 9 | **copywriting** | High | Yes | About page, footer, signup page all need compelling copy |
| 10 | **content-strategy** | High | Yes | No blog, no educational content, no topic guides |
| 11 | **referral-program** | High | Yes | Strong viral potential; no sharing mechanics exist |
| 12 | **social-content** | High | Yes | Social icons in footer but no actual links or strategy |
| 13 | **marketing-psychology** | High | Yes | Credibility scores, verification badges = trust signals to leverage |
| 14 | **launch-strategy** | High | Yes | Product appears pre-launch; needs a go-to-market plan |
| 15 | **competitor-alternatives** | Medium | Yes | No comparison pages vs. Snopes, PolitiFact, etc. |
| 16 | **free-tool-strategy** | Medium | Yes | Could build credibility checker, source verifier tools |
| 17 | **marketing-ideas** | Medium | Yes | Broad ideation useful for planning |
| 18 | **copy-editing** | Medium | Yes | Existing copy (About page, footer) needs polish |
| 19 | **ab-test-setup** | Medium | Yes | After analytics, test signup flow and landing pages |
| 20 | **product-marketing-context** | Medium | Yes | No product-marketing-context.md exists; should create one |
| 21 | **paid-ads** | Medium | Yes | After conversion tracking, can run targeted ads |
| 22 | **form-cro** | Low | Yes | Receipt submission form is already well-designed |
| 23 | **popup-cro** | Low | Yes | Could use for email capture but not urgent |
| 24 | **pricing-strategy** | Low | Maybe | Product is free; pricing not relevant yet |
| 25 | **paywall-upgrade-cro** | Low | Maybe | No paid tier exists |

---

## 3. Detailed Analysis: Critical & High Priority Skills

### 3.1 SEO Audit (CRITICAL)

**Target Surface:** Entire application -- every public page (`/`, `/receipts`, `/receipts/:id`, `/topics`, `/topics/:id`, `/about`, `/communities`, `/profile/:username`)

**Current State:**
- Client-side rendered React SPA with zero SSR/prerendering
- `index.html` has only `<title>Receeps</title>` -- no meta description, no OG tags, no canonical URL
- No `robots.txt` file
- No `sitemap.xml`
- No server-side rendering or static pre-rendering
- `DocumentTitle` component sets `document.title` via JavaScript (invisible to crawlers without JS execution)
- No canonical tags anywhere
- URLs are clean (`/receipts/123/`, `/topics/456/`) but content behind them is invisible to most crawlers

**Opportunity:**
- Topics and receipts are user-generated content goldmines for long-tail SEO
- Each topic page could rank for its topic name + "evidence" / "fact check" / "receipts"
- Receipt pages with source citations create strong E-E-A-T signals
- Categories create natural topic clusters

**Concrete Recommendations:**
1. **Implement SSR or pre-rendering** -- The Django backend already serves the SPA; add pre-rendered meta tags via Django templates for key public routes (`/receipts/:id`, `/topics/:id`, `/about`)
   - File: `receipts/views/` -- add Django views that inject OG/meta tags into `index.html` template before serving
2. **Create robots.txt** -- `frontend/public/robots.txt` with sitemap reference
3. **Create sitemap.xml** -- Use `django.contrib.sitemaps` to auto-generate from Topic and Receipt models
   - Files: `receipts/sitemaps.py`, add to `receipts/urls.py`
4. **Add meta tags per page** -- Title, description, OG image, OG title, canonical URL
   - Enhance `DocumentTitle.jsx` to also set meta description and OG tags via `react-helmet-async` or direct DOM manipulation
5. **Implement canonical URLs** -- Self-referencing canonicals on all pages
6. **Add structured breadcrumbs** -- Already shown visually on receipt/topic detail pages; add BreadcrumbList schema

**Expected Impact:** Going from 0% organic discoverability to having every public page indexed could drive 10x+ organic traffic as the content library grows. This is the single highest-leverage marketing investment.

---

### 3.2 Analytics Tracking (CRITICAL)

**Target Surface:** `App.jsx` (lines 35-36), entire application

**Current State:**
- `App.jsx` line 35: `const googleTrackingId = ""` -- GA4 not configured
- `App.jsx` line 36: `const metaPixelId = ""` -- Facebook Pixel not configured
- `react-ga4` and `react-facebook-pixel` are imported and initialized in code but do nothing
- No custom event tracking anywhere
- No conversion tracking
- Cookie consent banner exists (`CookieConsentWrapper`) but consents to nothing
- Zero visibility into: signups, receipt submissions, votes, comments, page views, feature usage

**Opportunity:**
- The code scaffolding already exists; just needs IDs and custom events
- Understanding user behavior is prerequisite to every other marketing optimization

**Concrete Recommendations:**
1. **Set up GA4 property** and add measurement ID to `App.jsx` line 35
2. **Set up Meta Pixel** and add pixel ID to `App.jsx` line 36
3. **Add custom events** for key actions:
   - `signup_completed` (in `SignUp.jsx` success handler)
   - `login_completed` (in `Login.jsx` success handler)
   - `receipt_submitted` (in `ReceiptSubmissionForm.jsx` success handler)
   - `vote_cast` (in `VotingInterface.jsx` submission)
   - `comment_posted` (in `CommentSection.jsx` submission)
   - `topic_created` (in `TopicForm.jsx` success handler)
   - `receipt_viewed` (in `ReceiptDetail.jsx` mount)
   - `topic_viewed` (in `TopicDetail.jsx` mount)
   - `search_performed` (in `HeaderSearch.jsx`)
   - `filter_applied` (in filter components)
4. **Mark conversions in GA4:** signup_completed, receipt_submitted, vote_cast
5. **Set up UTM parameter tracking** for future marketing campaigns

**Expected Impact:** Without analytics, every marketing decision is a guess. This is a prerequisite for measuring the effectiveness of all other marketing initiatives.

---

### 3.3 Schema Markup (CRITICAL)

**Target Surface:** Receipt detail pages, topic detail pages, home page, about page

**Current State:**
- Zero structured data anywhere
- No JSON-LD scripts
- No rich results possible

**Opportunity:**
- Receipt pages are perfect for `Article` + `ClaimReview` schema (Google's fact-check markup)
- Topic pages map naturally to `WebPage` + `FAQPage` schema
- `ClaimReview` schema can trigger fact-check rich results in Google Search -- a massive visibility advantage

**Concrete Recommendations:**
1. **ClaimReview schema on receipt pages** -- This is the Google-supported fact-check schema. Receeps' data model maps perfectly:
   - `claimReviewed`: receipt title
   - `reviewBody`: evidence_text
   - `author`: submitted_by
   - `reviewRating`: credibility_score mapped to textual rating
   - `itemReviewed.datePublished`: source_date
   - `itemReviewed.author`: source attribution
2. **Article schema on receipt pages** -- headline, datePublished, author, image
3. **WebSite schema on home page** -- with SearchAction for sitelinks search box
4. **Organization schema on about page** -- name, url, logo, sameAs
5. **BreadcrumbList schema** on all detail pages

**Expected Impact:** ClaimReview rich results can dramatically increase click-through rates from search. This is a unique competitive advantage most platforms cannot claim.

---

### 3.4 Signup Flow CRO (CRITICAL)

**Target Surface:** `/signup/` route, `SignUp.jsx`

**Current State:**
- 6 required fields: Username, First Name, Last Name, Email, Password, Confirm Password
- No social auth (Google, Apple, etc.)
- No trust signals (no "No credit card required," no user counts, no testimonials)
- No value proposition on the signup page itself
- Simple form in a card with "Create an Account" heading
- No password strength indicator
- No inline validation
- Redirects to home (feed) after signup with no onboarding guidance
- No email verification step

**Opportunity:**
- Reducing fields from 6 to 2-3 could significantly increase conversion
- Adding Google OAuth would remove most friction for new users
- Adding social proof and value proposition would increase motivation

**Concrete Recommendations:**
1. **Reduce required fields** -- Move First/Last Name to post-signup profile completion
   - Essential only: Email + Password (or just Email for magic link)
   - Files: `SignUp.jsx`, `receipts/views/auth.py`
2. **Add Google OAuth** -- `django-allauth` + `@react-oauth/google`
3. **Add trust signals below the form:**
   - "Join X users verifying evidence" (query user count from API)
   - "Free forever. No credit card needed."
   - Testimonial or social proof snippet
4. **Add value proposition headline:**
   - Change "Create an Account" to "Join the fight against misinformation"
   - Add subhead: "Submit evidence, vote on credibility, build consensus"
5. **Add inline validation** -- real-time feedback on each field
6. **Add password visibility toggle** and strength meter
7. **Show what happens after signup** -- "You'll be able to submit receipts and vote on evidence"

**Expected Impact:** Each field removed can increase conversion by 5-15%. Adding social auth can increase signups by 20-40%. These are among the highest-ROI changes possible.

---

### 3.5 Onboarding CRO (CRITICAL)

**Target Surface:** Post-signup experience, empty states across the application

**Current State:**
- After signup, user is redirected to `/` (the receipts feed) with no guidance
- No onboarding checklist or wizard
- Dashboard shows empty states with basic "Submit New Receipt" / "Create New Topic" CTAs but no contextual guidance
- No explanation of the voting system or how credibility scores work
- No "aha moment" engineering
- No progressive disclosure of features

**Opportunity:**
- The "aha moment" for Receeps is likely: **casting your first vote on a receipt and seeing how your assessment contributes to the credibility score**
- This needs to be the first thing new users experience

**Concrete Recommendations:**
1. **Post-signup welcome modal** -- 3-step quick tour:
   - Step 1: "This is a receipt -- evidence linked to a topic"
   - Step 2: "Vote on relevance, reliability, and bias"
   - Step 3: "Watch the credibility score update with community consensus"
2. **First-session guided action** -- Prompt new users to vote on their first receipt
   - File: Add onboarding state to `authSlice.jsx`, show guided callout in `ReceiptDetail.jsx`
3. **Onboarding checklist** in dashboard:
   - [ ] Vote on your first receipt
   - [ ] Submit your first receipt
   - [ ] Comment on a discussion
   - [ ] Follow a topic
   - [ ] Create a topic
4. **Contextual empty states** in dashboard tabs:
   - "My Receipts" tab: "You haven't submitted any evidence yet. Start by finding a topic you care about and adding a receipt."
   - "Voting History" tab: "Cast your first vote to see it here. Try voting on [link to popular receipt]."

**Expected Impact:** Proper onboarding typically increases activation (first meaningful action) by 50-100%. Without it, most signups will churn before understanding the product.

---

### 3.6 Email Sequence (CRITICAL)

**Target Surface:** Backend Celery tasks, notification system

**Current State:**
- AWS SES is configured in infrastructure
- Celery workers are deployed (beat queue + default queue)
- `NotificationPreference` model supports `email_frequency` (immediate/daily/weekly/never)
- 13 notification types are defined in the backend
- **Zero emails are actually sent** -- no email templates, no Celery tasks for email delivery
- No welcome email, no onboarding sequence, no re-engagement

**Opportunity:**
- The notification infrastructure is a perfect foundation for email marketing
- Email is the #1 re-engagement channel and Receeps has zero presence

**Concrete Recommendations:**
1. **Welcome email** (immediate after signup):
   - Subject: "Welcome to Receeps -- here's how to get started"
   - Content: Quick intro, link to first receipt to vote on, what makes Receeps different
   - File: `notifications/tasks.py` -- add `send_welcome_email` Celery task
2. **Activation email** (Day 1, if no votes cast):
   - Subject: "Cast your first vote -- it takes 30 seconds"
   - Content: Link to trending receipt, explain the voting interface
3. **First receipt prompt** (Day 3, if no receipts submitted):
   - Subject: "Got evidence? Submit your first receipt"
   - Content: How to submit, what makes good evidence, link to receipt form
4. **Social proof email** (Day 7):
   - Subject: "Your community this week: X new receipts verified"
   - Content: Platform stats, trending topics, featured verified receipts
5. **Re-engagement email** (Day 14, if inactive):
   - Subject: "New evidence on topics you've voted on"
   - Content: Receipts added to topics they previously engaged with
6. **Weekly digest** (for opted-in users):
   - Subject: "This week on Receeps: top evidence and hot topics"

**Expected Impact:** Welcome emails alone have 50-80% open rates. A 5-email onboarding sequence can increase 30-day retention by 30-50%.

---

### 3.7 Programmatic SEO (HIGH)

**Target Surface:** Topic pages, category pages, receipt pages

**Current State:**
- Hundreds of topic pages at `/topics/:id` with unique content
- Hundreds of receipt pages at `/receipts/:id` with unique evidence
- Multiple categories organizing content
- None of this is indexable by search engines

**Opportunity:**
- Every topic maps to a searchable query: "[topic name] evidence," "[topic name] fact check"
- Category pages can target broader terms: "[category] fact checks," "[category] evidence"
- Comparison patterns: "Is [claim] true?" pages driven by topic data

**Concrete Recommendations:**
1. **Topic SEO pages** -- After SSR is implemented, each topic URL becomes a long-tail SEO page
   - Title template: `[Topic Name] - Evidence & Fact Check | Receeps`
   - Meta description template: `See [X] pieces of evidence for [Topic Name]. Community credibility score: [Y]%. Verified by [Z] experts.`
2. **Category hub pages** -- `/topics/category/[name]` as hub pages linking to all topics in that category
3. **"Is [X] true?" pages** -- Programmatic pages driven by topic data, targeting question-based searches
4. **Source type landing pages** -- "Primary source evidence," "Academic evidence," "News evidence" pages

**Expected Impact:** Each topic/receipt page that gets indexed is a new entry point from organic search. With proper SEO, this could drive the majority of new user acquisition.

---

### 3.8 Page CRO -- Landing Page (HIGH)

**Target Surface:** `/` home route, currently `Home.jsx` which just renders `ReceiptsHomePage`

**Current State:**
- The home page IS the receipts feed -- there is no marketing landing page
- The `PRODUCT_FEATURES.md` describes a previous marketing home page with hero section, feature cards, how-it-works, and CTAs -- but `Home.jsx` now just renders `ReceiptsHomePage`
- New visitors land directly in the feed with no context about what Receeps is
- No value proposition, no social proof, no explanation

**Opportunity:**
- First-time visitors need a different experience than returning users
- A compelling landing page could dramatically increase signup conversion

**Concrete Recommendations:**
1. **Conditional home page** -- Show marketing landing page for unauthenticated users, feed for authenticated users
   - File: `Home.jsx` -- check auth state, render `LandingPage` or `ReceiptsHomePage`
2. **Landing page sections:**
   - Hero: "The Evidence Platform. Submit receipts. Vote on credibility. Fight misinformation."
   - Social proof: "X receipts submitted, Y votes cast, Z topics verified"
   - How it works: 3-step visual (Submit > Vote > Verify)
   - Featured verified receipts (social proof of real content)
   - Categories/topics preview
   - Final CTA: "Join free -- start verifying evidence today"
3. **A/B test** landing page vs. direct-to-feed for unauthenticated visitors

**Expected Impact:** A dedicated landing page for new visitors can increase signup rates by 2-5x compared to dropping them into a feed they don't understand.

---

### 3.9 Copywriting (HIGH)

**Target Surface:** About page, footer, signup page, home page

**Current State:**
- About page (`AboutUsPage.jsx`) has generic placeholder copy ("Our journey began with a simple observation...") with hardcoded hex colors violating project CSS variable rules
- Footer tagline: "Send the Receeps. Combat misinformation with verifiable evidence." -- decent but could be stronger
- Signup page title: "Create an Account" -- functional but not compelling
- Login page title: "Welcome Back!" -- friendly but missing brand voice
- Many footer links point to `#` (non-functional): Verification Process, How It Works, Guidelines, Expert Program, API Access, Mission, Contact

**Opportunity:**
- Every piece of copy is a chance to communicate value and build trust
- The About page and dead footer links are credibility killers

**Concrete Recommendations:**
1. **Rewrite About page** with Receeps-specific narrative:
   - Why evidence verification matters now
   - How the credibility scoring system works
   - The team's vision for fighting misinformation
   - Also fix hardcoded colors: replace `#2C2C2C`, `#333333`, `#FFD700`, `#444444` with CSS variables
   - File: `frontend/src/components/Pages/AboutUsPage.jsx`
2. **Rewrite signup page headline**: "Create an Account" -> "Join the Evidence Revolution"
3. **Fix dead footer links** -- Either create the pages or remove the links
   - Verification Process -> create or link to existing how-it-works
   - How It Works -> create page
   - Guidelines -> create community guidelines page
   - Expert Program -> create or remove
   - API Access -> create or remove
   - Mission -> link to about page
   - Contact -> create contact form or email link
   - File: `frontend/src/components/Footer/Footer.jsx`
4. **Add brand voice guidelines** to `product-marketing-context.md`

**Expected Impact:** Professional copy and working links build credibility. Dead links actively harm trust.

---

### 3.10 Content Strategy (HIGH)

**Target Surface:** New blog/content section, educational pages

**Current State:**
- Zero content marketing infrastructure
- No blog, no guides, no educational content
- Topics and receipts are user-generated but not leveraged for content marketing

**Opportunity:**
- The fact-checking/misinformation space is highly searched
- Educational content about evidence evaluation is naturally high-value
- Content can drive SEO traffic and establish authority

**Concrete Recommendations:**
1. **Create a blog section** at `/blog` with content around:
   - "How to evaluate sources" (evergreen educational)
   - "The difference between primary and secondary sources" (educational)
   - "[Current event] fact check roundup" (timely)
   - "How credibility scoring works" (product education)
2. **Topic cluster strategy:**
   - Pillar: "Evidence-based fact checking"
   - Clusters: Source types, verification methods, bias assessment, credibility scoring
3. **Leverage UGC** -- Curated "best of" posts from top-rated receipts

**Expected Impact:** Content marketing is the primary long-term organic growth engine for platforms in the information/media space.

---

### 3.11 Referral Program (HIGH)

**Target Surface:** User dashboard, receipt/topic detail pages

**Current State:**
- No share buttons anywhere
- No referral mechanics
- No invite system
- Social icons in footer are non-functional (no actual social media links)

**Opportunity:**
- Fact-checking content is inherently shareable ("Look at this evidence!")
- The voting mechanic creates discussion/debate that people want to share

**Concrete Recommendations:**
1. **Add share buttons** to receipt and topic detail pages:
   - "Share this receipt" with Twitter/X, Facebook, LinkedIn, copy link
   - File: `ReceiptDetail.jsx`, `TopicDetail.jsx`
2. **Generate shareable OG images** per receipt showing:
   - Receipt title, credibility score, verification status, Receeps branding
3. **Invite flow**: "Invite friends to vote on this evidence" via email/link
4. **Leaderboard/reputation** system to incentivize quality contributions

**Expected Impact:** Adding share buttons is the lowest-effort, highest-impact referral mechanic. Fact-checking content has natural viral potential.

---

### 3.12 Social Content (HIGH)

**Target Surface:** External social media channels

**Current State:**
- Footer shows Twitter, YouTube, Instagram icons but they have no `href` attributes -- they are non-functional decorations
- No social media presence or strategy

**Opportunity:**
- The misinformation/fact-checking space has massive social media engagement
- Verified receipts are perfect social content ("We fact-checked this claim. Here's what the evidence says...")

**Concrete Recommendations:**
1. **Create social accounts** (Twitter/X is highest priority for fact-checking content)
2. **Connect footer social icons** to actual accounts
   - File: `frontend/src/components/Footer/Footer.jsx`
3. **Content types for Twitter/X:**
   - "Fact Check: [Claim]. Credibility score: [X]%" with link to receipt
   - "Trending on Receeps: [Topic] -- [X] pieces of evidence submitted"
   - "Verified by the community: [Receipt title]"
4. **Auto-post** when receipts reach "verified" status (Celery task -> Twitter API)

**Expected Impact:** Social media is the primary discovery channel for fact-checking content.

---

### 3.13 Marketing Psychology (HIGH)

**Target Surface:** Cross-cutting; applies to landing page, signup, onboarding, retention

**Current State:**
- The product has natural psychological hooks (credibility scores, verification badges, voting) but they are not leveraged in marketing
- No social proof displayed for prospective users
- No urgency or scarcity mechanics
- No loss aversion messaging

**Concrete Recommendations:**
1. **Social proof** -- Display platform stats on landing page and signup:
   - "X pieces of evidence submitted"
   - "Y community votes cast"
   - "Z claims verified"
2. **Authority signaling** -- Verification badges and staff-verified labels should be more prominent in marketing copy
3. **Commitment & consistency** -- The voting system naturally creates investment; leverage this in re-engagement ("You've voted on X receipts -- new evidence needs your assessment")
4. **IKEA effect** -- Users who submit receipts are more invested; encourage first submission early
5. **Gamification** -- Credibility milestones, voting streaks, contribution badges (the notification system supports `credibility_milestone` type already)

**Expected Impact:** Psychological principles applied to the signup and onboarding flow can increase conversion rates by 15-30%.

---

### 3.14 Launch Strategy (HIGH)

**Target Surface:** Product Hunt, Hacker News, Reddit, social media

**Current State:**
- Product appears to be in active development but has no public launch presence
- No waitlist, no early access program, no launch announcement

**Concrete Recommendations:**
1. **Product Hunt launch** -- Receeps is a perfect PH candidate (community-driven, fact-checking, public good angle)
2. **Reddit launch** -- Post in r/factchecking, r/skeptic, r/media, r/journalism subreddits
3. **Hacker News** -- "Show HN: Receeps -- community-driven evidence verification"
4. **Press outreach** -- Misinformation is a hot media topic; pitch to tech/media journalists
5. **Phase the launch:**
   - Week 1: Soft launch with 50-100 beta users for initial content
   - Week 2: Product Hunt + social media blast
   - Week 3: Press outreach and content marketing push

**Expected Impact:** A coordinated launch can generate 1,000+ signups in the first week and establish initial content volume.

---

### 3.15 Competitor Alternatives (MEDIUM)

**Target Surface:** New comparison pages

**Current State:**
- No comparison or alternative pages
- Competitors include: Snopes, PolitiFact, FactCheck.org, Reuters Fact Check, Wikipedia (for reference)

**Concrete Recommendations:**
1. Create comparison pages:
   - "Receeps vs Snopes -- Community vs Editorial Fact-Checking"
   - "Receeps vs PolitiFact -- Multi-dimensional vs Binary Ratings"
   - "Best Fact-Checking Platforms 2026"
2. Key differentiator messaging:
   - Community-driven (not editorial gatekeepers)
   - Multi-dimensional voting (not true/false binary)
   - Evidence-based credibility scores (not opinion)
   - Transparent verification process

**Expected Impact:** Comparison pages capture high-intent search traffic from users evaluating alternatives.

---

## 4. Top 10 Highest-Impact Marketing Recommendations

Ordered by expected impact relative to effort:

| Rank | Recommendation | Skill | Effort | Impact |
|------|---------------|-------|:------:|:------:|
| 1 | **Set up GA4 + Facebook Pixel** (just add IDs to existing code) | analytics-tracking | 1 hour | Critical -- prerequisite for everything |
| 2 | **Add meta tags + OG tags** via enhanced DocumentTitle component | seo-audit | 4 hours | Critical -- enables social sharing and basic SEO |
| 3 | **Create robots.txt + sitemap.xml** via Django sitemaps | seo-audit | 2 hours | Critical -- lets Google discover content |
| 4 | **Reduce signup fields to 3** (username, email, password) | signup-flow-cro | 2 hours | High -- could increase signups 20-30% |
| 5 | **Build welcome email sequence** (3 emails over 7 days) | email-sequence | 6 hours | High -- increases activation and retention |
| 6 | **Add share buttons to receipt/topic pages** | referral-program | 3 hours | High -- enables organic sharing |
| 7 | **Create conditional landing page** for unauthenticated visitors | page-cro | 8 hours | High -- explains the product before asking for signup |
| 8 | **Add ClaimReview schema markup** to receipt pages | schema-markup | 4 hours | High -- enables fact-check rich results in Google |
| 9 | **Post-signup onboarding checklist** | onboarding-cro | 6 hours | High -- guides users to first meaningful action |
| 10 | **Fix dead footer links** and rewrite About page | copywriting | 4 hours | Medium -- removes credibility-damaging broken links |

---

## 5. Quick Wins (1-2 Hours Each)

These can be implemented immediately with minimal risk:

### QW-1: Add GA4 Measurement ID (30 minutes)
- Create GA4 property at analytics.google.com
- Add measurement ID to `App.jsx` line 35
- Immediately gain page view tracking

### QW-2: Add robots.txt (15 minutes)
- Create `frontend/public/robots.txt`:
  ```
  User-agent: *
  Allow: /
  Sitemap: https://receeps.com/sitemap.xml
  ```

### QW-3: Fix footer dead links (1 hour)
- Remove or connect the 7 broken `#` links in `Footer.jsx`
- At minimum link Mission -> `/about`, remove non-existent pages

### QW-4: Fix About page CSS violations (30 minutes)
- Replace hardcoded hex colors in `AboutUsPage.jsx` with `var(--reddit-*)` variables
- This also fixes a project rule violation

### QW-5: Add social media profile links (15 minutes)
- Create Twitter/X account
- Add `href` to social icon `ActionIcon` components in `Footer.jsx`

### QW-6: Add basic meta description (30 minutes)
- Add `<meta name="description" content="...">` to `frontend/index.html`
- Content: "Receeps is a community-driven evidence verification platform. Submit receipts, vote on credibility, and fight misinformation."

### QW-7: Add conversion events to existing analytics code (1 hour)
- In `SignUp.jsx`, `Login.jsx`, `ReceiptSubmissionForm.jsx`, `VotingInterface.jsx`:
  - Add `ReactGA.event()` calls in success handlers
  - Add `ReactPixel.track()` calls for signup and content creation

### QW-8: Create product-marketing-context.md (1 hour)
- Use the `product-marketing-context` skill to generate `.claude/product-marketing-context.md`
- All future marketing skill invocations will use this as context

---

## 6. Strategic Recommendations

### Phase 1: Foundation (Weeks 1-2)
- Analytics tracking (QW-1, QW-7)
- SEO basics (QW-2, QW-6, robots.txt, sitemap)
- Fix broken links and About page (QW-3, QW-4, QW-5)
- Product marketing context document (QW-8)
- Reduce signup form fields

### Phase 2: Growth Infrastructure (Weeks 3-4)
- Welcome email sequence
- Post-signup onboarding flow
- Share buttons on receipt/topic pages
- Marketing landing page for unauthenticated users
- Schema markup (ClaimReview + Article)

### Phase 3: Scale (Weeks 5-8)
- Content strategy and blog launch
- Social media presence and content calendar
- Programmatic SEO for topic/category pages
- Competitor comparison pages
- Launch strategy (Product Hunt, HN, press)

### Phase 4: Optimize (Ongoing)
- A/B testing signup flow, landing page, onboarding
- Email sequence optimization
- Paid acquisition (after conversion tracking proves the funnel)
- Referral program with gamification

---

## 7. Key Files Referenced

| File | Marketing Relevance |
|------|-------------------|
| `frontend/src/App.jsx:35-36` | GA4 and Facebook Pixel IDs (blank) |
| `frontend/index.html` | Single `<title>` tag, no meta tags |
| `frontend/src/components/core/DocumentTitle/DocumentTitle.jsx` | Dynamic title setting (client-side only) |
| `frontend/src/components/SignUp/SignUp.jsx` | 6-field signup form |
| `frontend/src/components/Login/Login.jsx` | Login form |
| `frontend/src/components/Home/Home.jsx` | Home = ReceiptsHomePage (no landing page) |
| `frontend/src/components/Pages/AboutUsPage.jsx` | Placeholder copy, hardcoded colors |
| `frontend/src/components/Footer/Footer.jsx` | 7 dead `#` links, non-functional social icons |
| `frontend/src/components/Router/AppRouter.jsx` | All route definitions |
| `frontend/src/components/Router/routes.js` | Route constants |
| `frontend/src/components/Receipt/ReceiptDetail/ReceiptDetail.jsx` | No share buttons, no schema markup |
| `frontend/src/components/Topic/TopicDetail/TopicDetail.jsx` | No share buttons, no schema markup |
| `receipts/urls.py` | Django URL routing (sitemap integration point) |
| `notifications/models.py` | NotificationPreference with email_frequency |
| `notifications/signals.py` | Notification triggers (email integration point) |

---

*Report generated 2026-02-13 by CMO Agent as part of the receipts-marketing-plan team analysis.*
