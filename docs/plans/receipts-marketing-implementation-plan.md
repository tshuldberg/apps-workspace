# Receeps Marketing Implementation Plan

> **Date:** 2026-02-13
> **Synthesized from:** CMO Marketing Analysis + CPO Product-Marketing Alignment Analysis
> **Product:** Receeps -- Community-Driven Evidence & Fact-Checking Platform
> **Stack:** Django 5.x DRF, React (Vite), Mantine v8.1.1, Redux Toolkit, Celery, PostgreSQL, AWS SES/S3, dayjs

---

## 1. Executive Summary

### What Receeps Is

Receeps is a community-driven evidence verification platform where users submit evidence ("receipts") linked to discussion topics. The community votes on evidence along three dimensions (relevance, reliability, bias), staff moderators verify submissions, and credibility scores emerge from consensus. It combines Reddit-style discussion with structured fact-checking.

### Current Marketing State (CMO Findings)

The product has **near-zero marketing infrastructure**:

- **SEO:** Completely absent. SPA-only rendering, no meta tags, no sitemap, no robots.txt, no schema markup, no SSR. Google cannot index any content.
- **Analytics:** GA4 and Facebook Pixel initialized in code with blank tracking IDs (`""` in `frontend/src/App.jsx` lines 35-36). Zero visibility into user behavior.
- **Email:** AWS SES configured, Celery workers deployed, `NotificationPreference` model supports email frequency -- but zero emails are actually sent. No welcome email, no digests, no re-engagement.
- **Sharing:** Share icons displayed on receipt/topic cards with no click handler. No OG tags for link previews.
- **Signup:** 6 required fields, no social auth, no trust signals, no value demonstration.
- **Copy:** About page has placeholder content with hardcoded hex colors (violating project CSS variable rules). 7 footer links point to `#`.

### Current Product-Marketing Gaps (CPO Findings)

The core product loop (submit, vote, discuss, verify) is production-ready with a **Marketing Readiness Score of 2.3/5**. Key gaps blocking marketing:

- **No email lifecycle** beyond password reset -- single biggest blocker
- **Share buttons non-functional** -- no viral loop
- **Follow system model-only** -- `follows/models.py` exists with topic/category/user/community support, but no API endpoints
- **No onboarding flow** -- users land on the feed with zero guidance after signup
- **Analytics placeholder** -- infrastructure exists but tracking IDs blank

### What This Plan Achieves

This plan provides a phased, task-by-task roadmap to take Receeps from 0% to full marketing readiness. Every task is actionable by Claude Code with specific file paths, skill invocations, and success metrics. The plan prioritizes high-impact, low-effort changes first and builds toward a coordinated public launch.

---

## 2. Pre-Requisite: Product Marketing Context

**First task before any marketing skill invocation.**

### Task: Create `.claude/product-marketing-context.md`

- **Marketing skill:** `/marketing/product-marketing-context`
- **What to do:**
  1. Invoke the skill, which will auto-draft from the Receeps codebase
  2. The skill reads `README.md`, `PRODUCT_FEATURES.md`, `AboutUsPage.jsx`, `frontend/package.json`, `CLAUDE.md`, and the data models to draft positioning
  3. Review and fill in these sections with Receeps-specific answers:
     - **Product Overview:** Community-driven evidence verification platform. Free. B2C with community features.
     - **Target Audience:** Fact-checkers, journalists, researchers, politically engaged citizens, media literacy educators
     - **Problems:** Misinformation spreads unchecked; existing fact-checkers are editorial gatekeepers with binary true/false ratings; no community-driven multi-dimensional assessment exists
     - **Competitive Landscape:** Direct: Snopes, PolitiFact, FactCheck.org. Secondary: Reddit (discussion without structured verification). Indirect: Wikipedia (reference, not real-time fact-checking)
     - **Differentiation:** Community-driven (not editorial), multi-dimensional voting (not binary), transparent credibility scores, open participation
     - **Brand Voice:** Direct, trustworthy, anti-sensational, evidence-first. Not preachy or partisan.
     - **Customer Language:** "receipts" (evidence), "credibility score," "verified," "fact check," "misinformation"
- **Output file:** `/Users/trey/Desktop/Apps/receipts/.claude/product-marketing-context.md`
- **Complexity:** Low
- **Dependencies:** None
- **Success metric:** File exists and is referenced by subsequent marketing skill invocations

---

## 3. Phase 1: Quick Wins (Week 1)

Tasks that can each be completed in 1-2 hours. Ordered by impact.

---

### Task 1.1: Add GA4 Measurement ID

- **Marketing skill:** `/marketing/analytics-tracking`
- **Files to modify:** `frontend/src/App.jsx` (line 35)
- **What to do:**
  1. Create a GA4 property at analytics.google.com for Receeps
  2. Copy the `G-XXXXXXXXXX` measurement ID
  3. Replace `const googleTrackingId = ""` with `const googleTrackingId = "G-XXXXXXXXXX"` on line 35 of `frontend/src/App.jsx`
  4. Verify that `ReactGA.initialize(googleTrackingId)` is already called (it is)
  5. Verify the `CookieConsentWrapper` component integrates with analytics consent
- **Complexity:** Low
- **Dependencies:** None (pre-requisite: GA4 account creation is manual)
- **Success metric:** Page views appear in GA4 Real-Time report within 5 minutes of deployment

---

### Task 1.2: Add Meta Pixel ID

- **Marketing skill:** `/marketing/analytics-tracking`
- **Files to modify:** `frontend/src/App.jsx` (line 36)
- **What to do:**
  1. Create a Meta Pixel at business.facebook.com
  2. Copy the pixel ID
  3. Replace `const metaPixelId = ""` with `const metaPixelId = "XXXXXXXXXX"` on line 36 of `frontend/src/App.jsx`
  4. Verify that `ReactPixel.init(metaPixelId)` is already called (it is)
- **Complexity:** Low
- **Dependencies:** None
- **Success metric:** Events appear in Meta Events Manager

---

### Task 1.3: Add Conversion Event Tracking

- **Marketing skill:** `/marketing/analytics-tracking`
- **Files to modify:**
  - `frontend/src/components/SignUp/SignUp.jsx` -- add `signup_completed` event
  - `frontend/src/components/Login/Login.jsx` -- add `login_completed` event
  - `frontend/src/components/Receipt/ReceiptSubmissionForm/ReceiptSubmissionForm.jsx` -- add `receipt_submitted` event
  - `frontend/src/components/Receipt/VotingInterface/VotingInterface.jsx` -- add `vote_cast` event
  - `frontend/src/components/Comments/CommentSection/CommentSection.jsx` -- add `comment_posted` event
  - `frontend/src/components/Topic/TopicForm/TopicForm.jsx` -- add `topic_created` event
  - `frontend/src/components/Receipt/ReceiptDetail/ReceiptDetail.jsx` -- add `receipt_viewed` event (on mount)
  - `frontend/src/components/Topic/TopicDetail/TopicDetail.jsx` -- add `topic_viewed` event (on mount)
  - `frontend/src/components/Header/HeaderSearch/HeaderSearch.jsx` -- add `search_performed` event
- **What to do:**
  1. Import `ReactGA` from `react-ga4` in each file
  2. In each success handler (after the API call resolves), add:
     ```javascript
     ReactGA.event({ category: "engagement", action: "signup_completed", label: "email" })
     ```
  3. Also add `ReactPixel.track("CompleteRegistration")` in `SignUp.jsx` and `ReactPixel.track("Lead")` in receipt submission
  4. Use the event naming convention: `object_action` (lowercase with underscores)
  5. Mark `signup_completed`, `receipt_submitted`, and `vote_cast` as conversions in GA4 Admin
- **Complexity:** Low
- **Dependencies:** Tasks 1.1 and 1.2 (tracking IDs must be set)
- **Success metric:** Custom events appear in GA4 Events report after test actions

---

### Task 1.4: Add Basic Meta Description to index.html

- **Marketing skill:** `/marketing/seo-audit`
- **Files to modify:** `frontend/index.html`
- **What to do:**
  1. Add inside `<head>`:
     ```html
     <meta name="description" content="Receeps is a community-driven evidence verification platform. Submit receipts, vote on credibility, and fight misinformation with multi-dimensional assessments.">
     <meta property="og:title" content="Receeps - Community-Driven Evidence Verification">
     <meta property="og:description" content="Submit evidence, vote on credibility, and fight misinformation. Join the community verifying claims with multi-dimensional assessments.">
     <meta property="og:type" content="website">
     <meta property="og:url" content="https://receeps.com">
     <meta name="twitter:card" content="summary_large_image">
     <meta name="twitter:title" content="Receeps - Community-Driven Evidence Verification">
     <meta name="twitter:description" content="Submit evidence, vote on credibility, and fight misinformation.">
     ```
  2. Update `<title>Receeps</title>` to `<title>Receeps - Community-Driven Evidence Verification</title>`
- **Complexity:** Low
- **Dependencies:** None
- **Success metric:** Social media link previews show title and description when URL is shared

---

### Task 1.5: Create robots.txt

- **Marketing skill:** `/marketing/seo-audit`
- **Files to modify:** Create `frontend/public/robots.txt`
- **What to do:**
  1. Create the file with:
     ```
     User-agent: *
     Allow: /
     Disallow: /dashboard
     Disallow: /staff-dashboard
     Disallow: /notifications
     Disallow: /api/

     Sitemap: https://receeps.com/sitemap.xml
     ```
  2. Verify Vite serves files from `public/` directory (it does by default)
- **Complexity:** Low
- **Dependencies:** None
- **Success metric:** `https://receeps.com/robots.txt` returns valid content after deployment

---

### Task 1.6: Fix About Page CSS Variable Violations

- **Marketing skill:** `/marketing/copywriting`
- **Files to modify:** `frontend/src/components/Pages/AboutUsPage.jsx`
- **What to do:**
  1. Search for hardcoded hex colors and replace:
     - `#2C2C2C` -> `var(--reddit-bg-primary)` or `var(--reddit-text-primary)` depending on context
     - `#333333` -> `var(--reddit-text-primary)`
     - `#FFD700` -> `var(--reddit-warning)` or `var(--reddit-orange)` (gold/accent)
     - `#444444` -> `var(--reddit-text-secondary)`
  2. Verify no other hardcoded hex values remain
  3. This also fixes a project rule violation (CLAUDE.md: "Use CSS variables (`var(--reddit-*)`); do not hardcode hex colors")
- **Complexity:** Low
- **Dependencies:** None
- **Success metric:** `grep -r "#[0-9A-Fa-f]\{6\}" AboutUsPage.jsx` returns zero results

---

### Task 1.7: Fix Dead Footer Links

- **Marketing skill:** `/marketing/copywriting`
- **Files to modify:** `frontend/src/components/Footer/Footer.jsx`
- **What to do:**
  1. Identify all links with `href="#"` in the footer
  2. For each dead link, either connect to an existing page or remove:
     - "Mission" -> link to `/about`
     - "How It Works" -> remove (page does not exist yet)
     - "Verification Process" -> remove (page does not exist yet)
     - "Guidelines" -> remove (page does not exist yet)
     - "Expert Program" -> remove (page does not exist yet)
     - "API Access" -> remove (page does not exist yet)
     - "Contact" -> replace with `mailto:` link or remove
  3. Connect social media icons to actual accounts (if they exist) or remove the non-functional `ActionIcon` components
  4. Use Mantine `Anchor` or the existing router link pattern for internal links
- **Complexity:** Low
- **Dependencies:** None
- **Success metric:** Zero `href="#"` links remain in `Footer.jsx`

---

### Task 1.8: Add Social Media Profile Links to Footer

- **Marketing skill:** `/marketing/copywriting`
- **Files to modify:** `frontend/src/components/Footer/Footer.jsx`
- **What to do:**
  1. Create a Twitter/X account for Receeps (manual step)
  2. Update the social icon `ActionIcon` components to include actual `href` values:
     ```jsx
     <ActionIcon component="a" href="https://twitter.com/receeps" target="_blank" rel="noopener noreferrer">
     ```
  3. Remove icons for platforms without accounts (YouTube, Instagram) unless accounts are created
- **Complexity:** Low
- **Dependencies:** Social media account creation (manual)
- **Success metric:** Social icons in footer navigate to real profiles

---

## 4. Phase 2: Foundation (Weeks 2-3)

Medium-effort tasks that build marketing infrastructure.

---

### Task 2.1: Reduce Signup Form Fields

- **Marketing skill:** `/marketing/signup-flow-cro`
- **Files to modify:**
  - `frontend/src/components/SignUp/SignUp.jsx` -- remove First Name and Last Name fields
  - Backend: `receipts/views/` or `accounts/views.py` (wherever `SignupView` is defined) -- make `first_name` and `last_name` optional
- **What to do:**
  1. Read current `SignUp.jsx` to understand the form structure
  2. Remove the First Name and Last Name fields from the signup form
  3. Keep only: Username, Email, Password, Confirm Password (4 fields)
  4. Update the backend `SignupView` to accept `first_name` and `last_name` as optional (not required)
  5. Add a profile completion prompt post-signup (see Task 2.5 onboarding)
  6. Add trust signals below the form:
     - "Free forever. No credit card needed."
     - Query user count from API and display: "Join X users verifying evidence"
  7. Change heading from "Create an Account" to "Join the Evidence Community"
  8. Add subheading: "Submit receipts, vote on credibility, fight misinformation"
  9. Use Mantine `Text` and `Title` components with `var(--reddit-*)` colors
- **Complexity:** Medium
- **Dependencies:** None
- **Success metric:** Signup form has 4 fields instead of 6; trust signals visible below form

---

### Task 2.2: Implement Dynamic OG Tags with react-helmet-async

- **Marketing skill:** `/marketing/seo-audit`
- **Files to modify:**
  - `frontend/package.json` -- add `react-helmet-async` dependency
  - `frontend/src/main.jsx` or `frontend/src/App.jsx` -- wrap app with `HelmetProvider`
  - `frontend/src/components/core/DocumentTitle/DocumentTitle.jsx` -- enhance to set OG tags
  - `frontend/src/components/Receipt/ReceiptDetail/ReceiptDetail.jsx` -- add receipt-specific OG tags
  - `frontend/src/components/Topic/TopicDetail/TopicDetail.jsx` -- add topic-specific OG tags
  - `frontend/src/components/Pages/AboutUsPage.jsx` -- add about page OG tags
- **What to do:**
  1. Install: `cd /Users/trey/Desktop/Apps/receipts/frontend && npm install react-helmet-async`
  2. Wrap app with `<HelmetProvider>` in `main.jsx`
  3. Enhance `DocumentTitle` component to accept `description`, `ogImage`, `ogType` props and render `<Helmet>` with full OG tag set
  4. In `ReceiptDetail.jsx`, pass receipt-specific data:
     - `og:title`: `{receipt.title} | Receeps`
     - `og:description`: First 160 chars of `receipt.evidence_text`
     - `og:type`: `article`
  5. In `TopicDetail.jsx`, pass topic-specific data:
     - `og:title`: `{topic.name} - Evidence & Fact Check | Receeps`
     - `og:description`: First 160 chars of `topic.ai_summary` or topic description
  6. Note: This helps social platforms that execute JavaScript. For full SEO, SSR is needed (Phase 3).
- **Complexity:** Medium
- **Dependencies:** None
- **Success metric:** Sharing a receipt URL on Twitter/X shows title, description, and type in preview card

---

### Task 2.3: Create Django Sitemap

- **Marketing skill:** `/marketing/seo-audit`
- **Files to modify:**
  - Create `receipt/sitemaps.py`
  - Create `app/sitemaps.py`
  - Modify `receipts/urls.py` -- add sitemap URL pattern
  - Modify `receipts/settings/base.py` -- add `django.contrib.sitemaps` to `INSTALLED_APPS`
- **What to do:**
  1. Add `'django.contrib.sitemaps'` to `INSTALLED_APPS` in settings
  2. Create `receipt/sitemaps.py`:
     ```python
     from django.contrib.sitemaps import Sitemap
     from receipt.models import Receipt

     class ReceiptSitemap(Sitemap):
         changefreq = "weekly"
         priority = 0.8

         def items(self):
             return Receipt.objects.filter(
                 verification_status__in=["verified", "pending", "unverified"]
             ).order_by("-created_at")

         def lastmod(self, obj):
             return obj.updated_at

         def location(self, obj):
             return f"/receipts/{obj.id}/"
     ```
  3. Create `app/sitemaps.py` with `TopicSitemap` and `CategorySitemap` following the same pattern
  4. In `receipts/urls.py`, add:
     ```python
     from django.contrib.sitemaps.views import sitemap
     from receipt.sitemaps import ReceiptSitemap
     from app.sitemaps import TopicSitemap, CategorySitemap

     sitemaps = {
         "receipts": ReceiptSitemap,
         "topics": TopicSitemap,
         "categories": CategorySitemap,
     }

     urlpatterns = [
         path("sitemap.xml", sitemap, {"sitemaps": sitemaps}, name="sitemap"),
         # ... existing patterns
     ]
     ```
  5. Submit sitemap URL to Google Search Console
- **Complexity:** Medium
- **Dependencies:** None
- **Success metric:** `https://receeps.com/sitemap.xml` returns valid XML with receipt and topic URLs

---

### Task 2.4: Build Welcome Email

- **Marketing skill:** `/marketing/email-sequence`
- **Files to modify:**
  - Create `notifications/templates/email/welcome.html` -- HTML email template
  - Create `notifications/tasks.py` (or modify if exists) -- add `send_welcome_email` Celery task
  - Modify `notifications/signals.py` -- trigger welcome email on user creation
- **What to do:**
  1. Create an HTML email template at `notifications/templates/email/welcome.html`:
     - Subject: "Welcome to Receeps -- here's how to get started"
     - Content sections: Welcome greeting, what Receeps is, 3 things to do first (vote on a receipt, submit evidence, follow a topic), link to trending receipts
     - Use inline CSS (email clients strip `<style>` blocks)
     - Include unsubscribe link
  2. Create a Celery task `send_welcome_email(user_id)` in `notifications/tasks.py`:
     - Query user by ID
     - Render the welcome template with context (username, trending topics)
     - Send via existing SES backend using Django's `send_mail` or the existing `send_templated_email` utility
  3. In `notifications/signals.py`, find the `create_notification_preferences` post-save signal on User model and add a call to `send_welcome_email.delay(user.id)`
  4. Honor `NotificationPreference.email_enabled` -- only send if user has email enabled (default should be True for new users)
- **Complexity:** Medium
- **Dependencies:** AWS SES must be configured (it already is per CPO report)
- **Success metric:** New user signup triggers a welcome email delivered within 60 seconds

---

### Task 2.5: Post-Signup Onboarding Checklist

- **Marketing skill:** `/marketing/onboarding-cro`
- **Files to modify:**
  - Create `frontend/src/components/Onboarding/OnboardingChecklist/OnboardingChecklist.jsx`
  - Create `frontend/src/components/Onboarding/OnboardingChecklist/OnboardingChecklist.module.css`
  - Modify `frontend/src/store/slices/authSlice.jsx` -- add onboarding state tracking
  - Modify `frontend/src/components/Home/Home.jsx` -- show checklist for new users
  - Backend: Add `onboarding_completed` field to Profile model or track via localStorage
- **What to do:**
  1. Create an `OnboardingChecklist` component using Mantine `Card`, `Checkbox`, `Progress`, `Text`, `Stack`:
     - [ ] Vote on your first receipt (link to a popular receipt)
     - [ ] Submit your first receipt (link to `/receipts/new`)
     - [ ] Comment on a discussion
     - [ ] Complete your profile (link to profile settings)
  2. Track checklist completion in localStorage keyed by user ID (avoids backend changes for MVP):
     ```javascript
     const key = `onboarding_${userId}`
     const progress = JSON.parse(localStorage.getItem(key) || '{}')
     ```
  3. Show the checklist in a dismissible `Card` at the top of `Home.jsx` when:
     - User is authenticated
     - `onboarding_completed` is not set in localStorage
     - User account is less than 7 days old
  4. When all items are checked or user dismisses, set `onboarding_completed = true` in localStorage
  5. Use `var(--reddit-*)` CSS variables, `@tabler/icons-react` for check icons
  6. The "aha moment" is casting the first vote -- make that the first and most prominent item
- **Complexity:** Medium
- **Dependencies:** None
- **Success metric:** New users see a 4-item checklist on their first visit; items check off as actions are completed

---

### Task 2.6: Wire Up Share Buttons

- **Marketing skill:** (no specific skill -- product fix identified by CPO)
- **Files to modify:**
  - `frontend/src/components/Receipt/ReceiptCard/ReceiptCard.jsx` -- add share click handler
  - `frontend/src/components/Topic/TopicCard/TopicCard.jsx` -- add share click handler
  - `frontend/src/components/Receipt/ReceiptDetail/ReceiptDetail.jsx` -- add share button
  - `frontend/src/components/Topic/TopicDetail/TopicDetail.jsx` -- add share button
  - Create `frontend/src/components/core/ShareMenu/ShareMenu.jsx` -- reusable share component
- **What to do:**
  1. Create a reusable `ShareMenu` component that accepts `url`, `title`, and `description` props
  2. Implement share options:
     - **Copy link** -- uses `navigator.clipboard.writeText(url)` with Mantine notification on success
     - **Twitter/X** -- opens `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
     - **Facebook** -- opens `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
     - **Reddit** -- opens `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`
     - **Web Share API** (mobile) -- uses `navigator.share({ title, text: description, url })` when available
  3. Use Mantine `Menu` component with `ActionIcon` trigger (share icon from `@tabler/icons-react`)
  4. Add UTM parameters to shared URLs: `?utm_source=share&utm_medium=social&utm_campaign=receipt_share`
  5. Add `share_clicked` GA4 event with properties: `{ content_type: "receipt"|"topic", content_id, share_platform }`
  6. Wire the existing share icons in `ReceiptCard.jsx` and `TopicCard.jsx` to open this menu
- **Complexity:** Medium
- **Dependencies:** Task 1.3 (analytics tracking for share events)
- **Success metric:** Clicking share icon on any receipt or topic opens a functional menu; shared links include UTM params

---

### Task 2.7: Add ClaimReview Schema Markup

- **Marketing skill:** `/marketing/schema-markup`
- **Files to modify:**
  - Create `frontend/src/components/core/SchemaMarkup/SchemaMarkup.jsx` -- reusable JSON-LD component
  - Modify `frontend/src/components/Receipt/ReceiptDetail/ReceiptDetail.jsx` -- add ClaimReview + Article schema
  - Modify `frontend/src/components/Pages/AboutUsPage.jsx` -- add Organization schema
  - Modify `frontend/src/App.jsx` or `frontend/src/main.jsx` -- add WebSite schema
- **What to do:**
  1. Create a `SchemaMarkup` component that renders a `<script type="application/ld+json">` tag with serialized JSON data. Use React's standard approach for injecting JSON-LD into the DOM. The data passed to this component is always application-controlled (receipt/topic model data), never raw user HTML input.
  2. In `ReceiptDetail.jsx`, render ClaimReview schema after data loads:
     ```json
     {
       "@context": "https://schema.org",
       "@type": "ClaimReview",
       "claimReviewed": "{receipt.title}",
       "reviewBody": "{receipt.evidence_text}",
       "author": { "@type": "Person", "name": "{receipt.submitted_by.username}" },
       "datePublished": "{receipt.created_at}",
       "reviewRating": {
         "@type": "Rating",
         "ratingValue": "{receipt.credibility_score * 100}",
         "bestRating": 100,
         "worstRating": 0,
         "alternateName": "Credibility Score"
       },
       "itemReviewed": {
         "@type": "CreativeWork",
         "url": "{receipt.source_url}",
         "datePublished": "{receipt.source_date}"
       }
     }
     ```
  3. Add `Article` schema alongside `ClaimReview` in receipt detail
  4. Add `Organization` schema on the About page:
     ```json
     {
       "@context": "https://schema.org",
       "@type": "Organization",
       "name": "Receeps",
       "url": "https://receeps.com",
       "description": "Community-driven evidence verification platform"
     }
     ```
  5. Add `WebSite` schema with `SearchAction` in `App.jsx` for sitelinks search box potential
  6. Note: Schema renders client-side. For full crawler visibility, this needs SSR (Phase 3). However, Google does execute JavaScript for schema.
- **Complexity:** Medium
- **Dependencies:** None
- **Success metric:** Google Rich Results Test validates ClaimReview schema on receipt detail pages

---

### Task 2.8: Build Conditional Landing Page

- **Marketing skill:** `/marketing/page-cro` + `/marketing/copywriting`
- **Files to modify:**
  - Create `frontend/src/components/Landing/LandingPage/LandingPage.jsx`
  - Create `frontend/src/components/Landing/LandingPage/LandingPage.module.css`
  - Modify `frontend/src/components/Home/Home.jsx` -- conditionally render LandingPage or ReceiptsHomePage
- **What to do:**
  1. In `Home.jsx`, check auth state from Redux:
     ```jsx
     const isAuthenticated = useSelector((state) => state.auth.isAuthenticated)
     return isAuthenticated ? <ReceiptsHomePage /> : <LandingPage />
     ```
  2. Build `LandingPage.jsx` with these sections using Mantine components (`Container`, `Title`, `Text`, `Button`, `SimpleGrid`, `Card`, `Group`, `Stack`):
     - **Hero section:**
       - Headline: "The Evidence Platform"
       - Subheadline: "Submit receipts. Vote on credibility. Fight misinformation."
       - Primary CTA: "Join Free" -> `/signup`
       - Secondary CTA: "Browse Evidence" -> `/receipts`
     - **Social proof bar:**
       - Fetch stats from API: "X receipts submitted | Y votes cast | Z topics verified"
       - Use Mantine `Group` with `Text` components
     - **How it works (3 steps):**
       - Step 1: "Submit Evidence" with `IconFileText` icon
       - Step 2: "Vote on Credibility" with `IconThumbUp` icon
       - Step 3: "See the Consensus" with `IconChartBar` icon
       - Use Mantine `SimpleGrid cols={3}` with `Card` components
     - **Featured verified receipts:**
       - Show 3 recently verified receipts using existing `ReceiptCard` component
       - Query: `/receipt/api/receipts/?verification_status=verified&ordering=-verified_at&limit=3`
     - **Final CTA section:**
       - "Join free -- start verifying evidence today"
       - Large "Create Account" button -> `/signup`
  3. All colors via `var(--reddit-*)` variables
  4. All icons from `@tabler/icons-react`
  5. Use Axios wrapper for any API calls
- **Complexity:** Medium
- **Dependencies:** None (but more effective with Tasks 1.6, 1.7 completed)
- **Success metric:** Unauthenticated visitors see a marketing landing page; authenticated visitors see the receipts feed

---

## 5. Phase 3: Growth (Weeks 4-6)

Larger features that drive user acquisition and retention.

---

### Task 3.1: Build Email Notification Delivery System

- **Marketing skill:** `/marketing/email-sequence`
- **Files to modify:**
  - Create or modify `notifications/tasks.py` -- add batch email delivery Celery task
  - Create `notifications/templates/email/notification_immediate.html`
  - Create `notifications/templates/email/notification_digest.html`
  - Modify Celery beat schedule in settings (add periodic task for daily/weekly digests)
- **What to do:**
  1. Create a Celery task `send_notification_emails()` that:
     - Queries `Notification` objects where `is_read=False`
     - Groups by user and their `NotificationPreference.email_frequency`
     - For `immediate`: sends individual notifications as they're created (wire via signal)
     - For `daily`: batches unsent notifications into a digest, runs once per day
     - For `weekly`: batches into weekly digest, runs once per week
  2. Create HTML email templates:
     - `notification_immediate.html`: Single notification with action link
     - `notification_digest.html`: List of notifications grouped by type
  3. Add Celery beat schedule entries in settings:
     ```python
     CELERY_BEAT_SCHEDULE = {
         "send-daily-digest": {
             "task": "notifications.tasks.send_daily_digest",
             "schedule": crontab(hour=9, minute=0),
         },
         "send-weekly-digest": {
             "task": "notifications.tasks.send_weekly_digest",
             "schedule": crontab(hour=9, minute=0, day_of_week=1),
         },
     }
     ```
  4. Honor `NotificationPreference.email_enabled` and `type_preferences` fields
  5. Use existing SES backend for delivery
  6. Track email sends to avoid re-sending (add `email_sent_at` field to `Notification` model or use a separate tracking table)
- **Complexity:** High
- **Dependencies:** Task 2.4 (welcome email establishes the template pattern)
- **Success metric:** Users with `email_frequency=daily` receive a digest email at 9am with their unread notifications

---

### Task 3.2: Build Activation Email Sequence (5 Emails over 14 Days)

- **Marketing skill:** `/marketing/email-sequence`
- **Files to modify:**
  - Create `notifications/templates/email/activation_*.html` (5 templates)
  - Modify `notifications/tasks.py` -- add activation sequence tasks
  - Add Celery beat or trigger-based scheduling
- **What to do:**
  1. **Email 1 -- Day 1 (if no votes cast):**
     - Subject: "Cast your first vote -- it takes 30 seconds"
     - Content: Link to a trending receipt, explain the 3 voting dimensions
     - Trigger: Check if user has 0 votes 24 hours after signup
  2. **Email 2 -- Day 3 (if no receipts submitted):**
     - Subject: "Got evidence? Submit your first receipt"
     - Content: How to submit, what makes good evidence, link to `/receipts/new`
     - Trigger: Check if user has 0 receipts 72 hours after signup
  3. **Email 3 -- Day 7 (social proof):**
     - Subject: "Your community this week"
     - Content: Platform stats, trending topics, featured verified receipts
     - Send to all users on Day 7 regardless of activity
  4. **Email 4 -- Day 10 (if no comments posted):**
     - Subject: "Join the conversation"
     - Content: Link to active discussions, explain threading
     - Trigger: Check if user has 0 comments
  5. **Email 5 -- Day 14 (re-engagement if inactive):**
     - Subject: "New evidence on topics you've voted on"
     - Content: Receipts added to topics the user engaged with
     - Trigger: Only if user hasn't logged in for 7+ days
  6. Create a Celery periodic task that checks user signup dates and activity levels, then dispatches the appropriate email
  7. Use existing `NotificationPreference.email_enabled` to respect opt-outs
  8. All emails include unsubscribe link
- **Complexity:** High
- **Dependencies:** Task 3.1 (email delivery system), Task 1.3 (analytics to track activation)
- **Success metric:** 30-day activation rate (first vote within 30 days) measurable via GA4

---

### Task 3.3: Expose Follow System API

- **Marketing skill:** (product change identified by CPO)
- **Files to modify:**
  - Create `follows/serializers.py`
  - Create `follows/viewsets.py`
  - Create `follows/urls.py`
  - Modify `receipts/urls.py` -- add follows URL include
  - Modify `frontend/src/components/Sidebar/Sidebar.jsx` -- wire "Followed Topics" section
  - Create `frontend/src/components/Follow/FollowButton/FollowButton.jsx`
- **What to do:**
  1. Create DRF serializers following the project's directory convention:
     ```python
     # follows/serializers.py
     class FollowSerializer(serializers.ModelSerializer):
         class Meta:
             model = Follow
             fields = ("id", "content_type", "object_id", "created_at")
     class FollowCreateSerializer(serializers.ModelSerializer):
         class Meta:
             model = Follow
             fields = ("content_type", "object_id")
     ```
  2. Create viewset with `create`, `destroy`, `list` actions
  3. Add URL routes: `POST /follows/`, `DELETE /follows/<id>/`, `GET /follows/`
  4. Create a `FollowButton` component using Mantine `Button` that toggles follow state
  5. Add follow button to `TopicDetail.jsx` and category pages
  6. Wire sidebar "Followed Topics" section to fetch from `/follows/?content_type=topic`
  7. Use Axios wrapper for API calls, `invalidate_*_cache()` after follow/unfollow mutations
  8. Use `UserBriefSerializer` for any user references (project rule)
- **Complexity:** High
- **Dependencies:** None (the Follow model already exists)
- **Success metric:** Users can follow topics; followed topics appear in sidebar; follow count visible on topic detail

---

### Task 3.4: Rewrite About Page Copy

- **Marketing skill:** `/marketing/copywriting`
- **Files to modify:** `frontend/src/components/Pages/AboutUsPage.jsx`
- **What to do:**
  1. Replace generic placeholder copy with Receeps-specific narrative using the product-marketing-context document
  2. Sections to include:
     - **Why we exist:** The misinformation problem and why existing fact-checkers aren't enough
     - **How it works:** Community-driven, multi-dimensional voting, transparent credibility scores
     - **Our approach:** What makes Receeps different (community vs. editorial, multi-dimensional vs. binary)
     - **The team:** Vision statement (can be placeholder if no team info exists)
     - **CTA:** "Join the community" button linking to `/signup`
  3. Ensure all colors use `var(--reddit-*)` variables (Task 1.6 must be done first)
  4. Use Mantine layout components (`Container`, `Title`, `Text`, `Stack`, `SimpleGrid`)
  5. Include Organization schema markup (from Task 2.7)
- **Complexity:** Medium
- **Dependencies:** Task 1.6 (CSS fixes), Pre-requisite (product-marketing-context)
- **Success metric:** About page communicates clear value proposition; zero hardcoded hex colors

---

### Task 3.5: Implement Pre-rendering for SEO

- **Marketing skill:** `/marketing/seo-audit`
- **Files to modify:**
  - Backend: Add pre-rendering middleware or Django views that inject meta tags
  - Option A: Install `django-prerender` or configure a pre-rendering service
  - Option B: Create Django template views for key public routes that inject meta tags into `index.html` before serving the SPA
- **What to do:**
  1. **Recommended approach (Option B -- Django meta tag injection):**
     - Create a Django view that serves `index.html` but injects route-specific meta tags:
     ```python
     # receipts/views/seo.py
     def receipt_detail_seo(request, receipt_id):
         receipt = Receipt.objects.get(id=receipt_id)
         context = {
             "title": f"{receipt.title} | Receeps",
             "description": receipt.evidence_text[:160],
             "og_type": "article",
             "url": f"https://receeps.com/receipts/{receipt_id}/",
         }
         return render(request, "index_seo.html", context)
     ```
     - Create `templates/index_seo.html` that extends the SPA's `index.html` but injects `<meta>` tags in the `<head>`
     - Add URL patterns for `/receipts/<id>/` and `/topics/<id>/` that use these views
     - The SPA still hydrates client-side; crawlers get the meta tags from the initial HTML
  2. This is a pragmatic middle ground between full SSR (requires Next.js migration) and no SEO
  3. **CMO recommends Option B for quick wins now, with full SSR (Next.js migration) as a future consideration**
  4. **CPO recommends Option A (pre-rendering service) as medium effort -- either approach works**
  5. Resolution: Use Option B (Django meta injection) since it requires no new infrastructure and leverages existing Django views
- **Complexity:** High
- **Dependencies:** Task 2.3 (sitemap), Task 1.4 (meta tags)
- **Success metric:** Crawling `https://receeps.com/receipts/123/` returns HTML with receipt-specific meta tags in the `<head>` (testable via `curl`)

---

## 6. Phase 4: Optimization (Ongoing)

A/B testing, analytics-driven iteration, content pipeline.

---

### Task 4.1: Set Up A/B Testing Infrastructure

- **Marketing skill:** `/marketing/ab-test-setup` (when sufficient traffic exists)
- **Files to modify:**
  - `frontend/src/util/experiments.js` -- create experiment framework
  - `frontend/src/App.jsx` -- initialize experiment framework
- **What to do:**
  1. Create a lightweight experiment framework using localStorage + GA4:
     ```javascript
     // frontend/src/util/experiments.js
     export const getVariant = (experimentName, variants = ["control", "treatment"]) => {
       const key = `exp_${experimentName}`
       let variant = localStorage.getItem(key)
       if (!variant) {
         variant = variants[Math.floor(Math.random() * variants.length)]
         localStorage.setItem(key, variant)
       }
       return variant
     }
     ```
  2. Track variant assignment as GA4 user property
  3. Use for testing:
     - Signup form variations (Task 2.1 improvements)
     - Landing page headline variations (Task 2.8)
     - Onboarding checklist ordering (Task 2.5)
  4. Requires sufficient traffic volume (100+ signups/week) to reach statistical significance
- **Complexity:** Medium
- **Dependencies:** Task 1.1 (GA4), sufficient traffic
- **Success metric:** Experiment variant distribution visible in GA4 user properties

---

### Task 4.2: Launch Content Strategy and Blog

- **Marketing skill:** `/marketing/content-strategy`
- **Files to modify:**
  - Create blog infrastructure (either as a Django app or static content served from the frontend)
  - Add `/blog` route to `frontend/src/components/Router/AppRouter.jsx`
- **What to do:**
  1. Define content pillars for Receeps:
     - **Pillar 1:** "Evidence Evaluation" -- How to assess sources, types of evidence, bias detection
     - **Pillar 2:** "Misinformation & Media Literacy" -- Current events fact-check roundups, media literacy guides
     - **Pillar 3:** "Platform Education" -- How credibility scoring works, voting guide, community guidelines
     - **Pillar 4:** "Community Spotlight" -- Top verified receipts, active contributors, topic deep-dives
  2. Create initial content pieces:
     - "How to Evaluate Sources: A Practical Guide" (evergreen, searchable)
     - "How Receeps Credibility Scoring Works" (product education)
     - "The Difference Between Primary and Secondary Sources" (educational, searchable)
  3. Content should be served from a blog route and be indexable (ties into SSR/pre-rendering from Task 3.5)
  4. Target keywords: "how to fact check," "evaluate sources," "credibility scoring," "evidence verification"
- **Complexity:** High
- **Dependencies:** Task 3.5 (pre-rendering for SEO), Pre-requisite (product-marketing-context)
- **Success metric:** 3 published blog posts indexed by Google within 30 days of publication

---

### Task 4.3: Build Competitor Comparison Pages

- **Marketing skill:** `/marketing/competitor-alternatives`
- **Files to modify:** Create comparison page components and routes
- **What to do:**
  1. Create comparison pages targeting high-intent searches:
     - "Receeps vs Snopes" -- community-driven vs. editorial fact-checking
     - "Receeps vs PolitiFact" -- multi-dimensional vs. binary ratings
     - "Best Fact-Checking Platforms 2026" -- listicle format
  2. Key differentiation messaging:
     - Community-driven (not editorial gatekeepers)
     - Multi-dimensional voting (not true/false binary)
     - Transparent credibility scores (not opinion)
     - Open participation (anyone can contribute)
  3. Each page should include a comparison table, feature breakdown, and CTA to sign up
  4. These pages are high-intent SEO targets for users evaluating fact-checking alternatives
- **Complexity:** Medium
- **Dependencies:** Task 3.5 (pre-rendering for SEO), Task 3.4 (copywriting patterns)
- **Success metric:** Comparison pages ranking on page 1 for "[competitor] alternative" queries within 90 days

---

### Task 4.4: Coordinate Public Launch

- **Marketing skill:** `/marketing/launch-strategy`
- **What to do:**
  1. Prepare launch materials:
     - Product Hunt listing (title, tagline, description, screenshots, maker comment)
     - Hacker News "Show HN" post
     - Reddit posts in r/factchecking, r/skeptic, r/media, r/journalism
  2. Phased launch:
     - Week 1: Soft launch with 50-100 beta users to seed initial content
     - Week 2: Product Hunt launch + social media
     - Week 3: Press outreach (misinformation is a hot media topic)
  3. Pre-launch checklist (all previous tasks should be complete):
     - [ ] Analytics tracking live (Tasks 1.1-1.3)
     - [ ] SEO basics in place (Tasks 1.4-1.5, 2.2-2.3)
     - [ ] Email sequences working (Tasks 2.4, 3.1-3.2)
     - [ ] Share buttons functional (Task 2.6)
     - [ ] Landing page live (Task 2.8)
     - [ ] Onboarding flow active (Task 2.5)
     - [ ] About page polished (Task 3.4)
- **Complexity:** High
- **Dependencies:** All Phase 1-3 tasks
- **Success metric:** 1,000+ signups in first week of public launch

---

## 7. Cross-Cutting Concerns

### Analytics Event Taxonomy

Standardized event names for GA4 tracking across the application:

| Event Name | Category | Properties | Trigger Location |
|------------|----------|------------|-----------------|
| `signup_completed` | acquisition | `method` (email/social) | `SignUp.jsx` success handler |
| `login_completed` | engagement | `method` | `Login.jsx` success handler |
| `receipt_submitted` | engagement | `source_type`, `topic_count` | `ReceiptSubmissionForm.jsx` success |
| `receipt_viewed` | engagement | `receipt_id`, `verification_status` | `ReceiptDetail.jsx` mount |
| `vote_cast` | engagement | `content_type` (receipt/topic), `content_id` | `VotingInterface.jsx` success |
| `comment_posted` | engagement | `content_type`, `content_id`, `is_reply` | `CommentSection.jsx` success |
| `topic_created` | engagement | `category` | `TopicForm.jsx` success |
| `topic_viewed` | engagement | `topic_id`, `category` | `TopicDetail.jsx` mount |
| `search_performed` | engagement | `query`, `result_count` | `HeaderSearch.jsx` submit |
| `share_clicked` | engagement | `content_type`, `content_id`, `platform` | `ShareMenu.jsx` click |
| `follow_toggled` | engagement | `content_type`, `content_id`, `action` (follow/unfollow) | `FollowButton.jsx` |
| `onboarding_step_completed` | activation | `step_name`, `step_number` | `OnboardingChecklist.jsx` |
| `cta_clicked` | conversion | `cta_text`, `cta_location`, `page` | Various CTA buttons |

**Conversions (mark in GA4 Admin):** `signup_completed`, `receipt_submitted`, `vote_cast`

**Meta Pixel Events:** `CompleteRegistration` (signup), `Lead` (receipt submission), `ViewContent` (receipt/topic view)

### SEO Technical Requirements

1. **Pre-rendering:** Django views inject meta tags for `/receipts/:id` and `/topics/:id` routes (Task 3.5)
2. **Meta tags per page:** Title, description, OG tags via `react-helmet-async` (Task 2.2)
3. **Sitemap:** Auto-generated from Receipt, Topic, Category models via `django.contrib.sitemaps` (Task 2.3)
4. **robots.txt:** Allow all public pages, disallow dashboard/API/staff routes (Task 1.5)
5. **Schema markup:** ClaimReview on receipts, Organization on about page, WebSite on home (Task 2.7)
6. **Canonical URLs:** Self-referencing canonicals via `react-helmet-async`
7. **URL structure:** Already clean (`/receipts/123/`, `/topics/456/`) -- no changes needed

### Email Infrastructure Completion

The existing email infrastructure needs these additions to become marketing-ready:

| Component | Exists? | What's Needed |
|-----------|---------|---------------|
| AWS SES | Yes | Already configured for prod/staging |
| Celery workers | Yes | Running (beat + default queues) |
| `NotificationPreference` model | Yes | `email_frequency` field (immediate/daily/weekly/never) |
| `send_templated_email` utility | Yes | Exists but underused |
| Email templates | No | Need welcome, immediate notification, digest templates |
| Celery periodic tasks for digests | No | Need daily/weekly digest tasks |
| Welcome email signal | No | Need post-signup trigger |
| Activation sequence logic | No | Need day-based trigger tasks |
| Unsubscribe mechanism | No | Need one-click unsubscribe per CAN-SPAM |

### CSS/Component Patterns for Marketing Pages

All marketing pages (landing page, about page, blog, comparison pages) must follow Receeps frontend conventions:

- **Components:** Use Mantine v8.1.1 (`Container`, `Title`, `Text`, `Button`, `Card`, `SimpleGrid`, `Stack`, `Group`)
- **Wrappers:** Use `ButtonWrapper`, `TextInputWrapper`, `ActionIconWrapper` from `frontend/src/components/core/`
- **Colors:** Only `var(--reddit-*)` CSS variables (see `frontend/src/index.css` for full palette)
- **Icons:** Only `@tabler/icons-react`
- **API calls:** Only via Axios wrapper (`frontend/src/util/Axios.js`)
- **Dates:** Only `dayjs`
- **CSS:** Scoped CSS Modules (`ComponentName.module.css`)
- **Routing:** Use `ButtonWrapper` with `to` prop for internal navigation (integrates with React Router)

---

## 8. Skill Invocation Guide

Quick-reference table for marketing tasks:

| When you want to... | Invoke this skill | Prerequisites |
|---------------------|-------------------|---------------|
| Set up product positioning and messaging context | `/marketing/product-marketing-context` | None |
| Add GA4/Pixel tracking or custom events | `/marketing/analytics-tracking` | GA4/Pixel accounts created |
| Audit SEO issues (meta tags, crawlability, indexation) | `/marketing/seo-audit` | `product-marketing-context.md` |
| Add JSON-LD structured data (ClaimReview, Article, etc.) | `/marketing/schema-markup` | Receipt/topic data available |
| Optimize the signup/registration form | `/marketing/signup-flow-cro` | `product-marketing-context.md` |
| Design post-signup onboarding flow | `/marketing/onboarding-cro` | Signup flow optimized |
| Create welcome/activation/re-engagement email sequences | `/marketing/email-sequence` | SES + Celery configured |
| Optimize a landing page or marketing page for conversions | `/marketing/page-cro` | Page exists, analytics tracking live |
| Plan blog topics, content pillars, editorial calendar | `/marketing/content-strategy` | `product-marketing-context.md` |
| Write/rewrite marketing copy (headlines, CTAs, about page) | `/marketing/copywriting` | `product-marketing-context.md` |
| Create comparison pages (vs. Snopes, PolitiFact) | `/marketing/competitor-alternatives` | `product-marketing-context.md` |
| Build SEO pages at scale (topic/category landing pages) | `/marketing/programmatic-seo` | SSR/pre-rendering in place |
| Design referral/share mechanics | `/marketing/referral-program` | Share buttons working |
| Plan social media content calendar | `/marketing/social-content` | Social accounts created |
| Apply psychological principles to CTAs and copy | `/marketing/marketing-psychology` | Pages exist to optimize |
| Coordinate a public launch (PH, HN, press) | `/marketing/launch-strategy` | All Phase 1-3 tasks complete |
| Set up A/B tests for conversion optimization | `/marketing/ab-test-setup` | Analytics live, sufficient traffic |

---

## 9. Success Metrics Dashboard

### North Star Metric

**Weekly Active Assessors (WAA):** Users who cast at least 1 vote per week.

### 30-Day Targets (Post-Phase 1)

| Metric | Target | How to Measure |
|--------|--------|---------------|
| GA4 tracking live | Yes/No | Check GA4 Real-Time |
| Pages indexed by Google | >0 (from 0) | Google Search Console |
| Signup form fields | 4 (from 6) | Visual check |
| Dead footer links | 0 (from 7) | Visual check |
| CSS variable violations | 0 | `grep` for hardcoded hex in JSX |

### 60-Day Targets (Post-Phase 2)

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Welcome email delivery rate | >95% | SES delivery metrics |
| Onboarding checklist completion | >40% | localStorage tracking / GA4 events |
| Signup conversion rate | >5% | GA4 funnel (visitors -> signups) |
| Social shares per receipt | >0.2 | GA4 `share_clicked` event |
| OG tags working | All public pages | Test with social media debuggers |
| Sitemap URL count | >100 | Check `sitemap.xml` |

### 90-Day Targets (Post-Phase 3)

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Organic search traffic | >500 sessions/month | GA4 acquisition |
| Activation rate (first vote within 24h) | >30% | GA4 custom event + user property |
| Email open rate (welcome) | >50% | SES tracking |
| Email open rate (digest) | >25% | SES tracking |
| D7 return rate | >20% | GA4 cohort analysis |
| Share-to-signup ratio | Measurable | UTM tracking on shared URLs |
| ClaimReview rich results | >0 | Google Search Console |
| Follow system adoption | >10% of users follow 1+ topic | API query |

### Ongoing Optimization Metrics

| Metric | Alert Threshold | Action |
|--------|---------------|--------|
| Signup completion rate | Drops below 3% | Review signup flow, run A/B test |
| Welcome email bounce rate | >5% | Check SES configuration |
| D30 churn rate | >80% | Review onboarding sequence, add re-engagement email |
| Organic traffic trend | Month-over-month decline | SEO audit, content refresh |
| Share button usage | <0.1 per active user/week | Test share button placement/copy |

---

## CMO vs. CPO Priority Differences and Resolutions

Both analyses agree on the top priorities but differ on some specifics:

| Area | CMO Perspective | CPO Perspective | Resolution |
|------|----------------|-----------------|------------|
| **SSR approach** | Django views injecting meta tags (pragmatic) | Pre-rendering service (rendertron) or Next.js migration | Use Django meta injection (Task 3.5) -- lowest effort, uses existing stack, no new infra |
| **Follow system priority** | Not listed in top 10 | P2.3 priority (before growth marketing) | Include in Phase 3 -- CPO is right that follows enable retention, but shares and email have higher immediate impact |
| **Sitemap effort** | Listed as "2 hours" quick win | Listed as "1-2 days" high-impact | Realistic estimate is 2-4 hours for basic sitemap -- included in Phase 2 |
| **Email sequence depth** | 6 emails across lifecycle | 7 emails across 14 days (more detailed) | Start with 5 emails (Task 3.2) covering the union of both recommendations, expand based on performance |
| **Landing page priority** | #7 in top 10 | Not explicitly ranked but identified as missing | Included in Phase 2 (Task 2.8) -- medium effort with high impact for first-time visitor conversion |

---

*Plan generated 2026-02-13 by Technical Writer Agent, synthesizing CMO and CPO analyses for the receipts-marketing-plan team.*
