# Marketing Skills Applicability Assessment

**Date:** 2026-02-13
**Scope:** All user-facing projects in `/Users/trey/Desktop/Apps`
**Purpose:** Map the 25 marketing skills to each project, prioritized by impact and relevance, to guide which skills to install or invoke per project.

---

## 1. Receipts (Receeps) -- Receipt-Based Evidence Verification Platform

**Type:** Web application (Django + React SPA). User-facing consumer platform with community features (voting, comments, follows, notifications). AWS-hosted with public API.

| Skill | Priority | Rationale |
|-------|----------|-----------|
| seo-audit | High | Web SPA needs crawlability, meta tags, and on-page SEO for topics/receipts to rank in search. |
| schema-markup | High | Structured data (Article, ClaimReview, FactCheck) would enable rich snippets for evidence-based content. |
| analytics-tracking | High | GA4/Mixpanel event tracking for signup, receipt submissions, votes, topic views -- essential for understanding user behavior. |
| signup-flow-cro | High | JWT auth flow with signup form; optimizing conversion from visitor to registered user is critical for growth. |
| onboarding-cro | High | Post-signup activation (first receipt submission, first vote) determines retention. |
| content-strategy | High | Topics and receipts are user-generated content; a strategy for seeding initial content and guiding contributions is essential. |
| copywriting | Medium | Landing page, feature explanations, onboarding copy. |
| copy-editing | Medium | Polish existing UI text, error messages, notification copy. |
| email-sequence | Medium | Notification preferences already exist (immediate/daily/weekly); email sequences for activation, re-engagement, and digest are natural extensions. |
| social-content | Medium | Social media content showcasing verified topics, community growth, and evidence verification process. |
| launch-strategy | Medium | Needed for public launch (currently in development). Planning beta invites, press outreach, community seeding. |
| referral-program | Medium | Community-driven platform benefits from user referrals with incentives (badges, reputation points). |
| product-marketing-context | Medium | Creating a reusable positioning doc ("truth verification," "evidence-based discussions") for consistent messaging. |
| programmatic-seo | Medium | Auto-generated topic pages (e.g., "/topics/climate-change") could rank for informational queries at scale. |
| page-cro | Medium | Optimize topic detail pages and receipt submission pages for engagement. |
| marketing-ideas | Medium | 140+ tactics to evaluate for a new community platform launch. |
| marketing-psychology | Low | Apply scarcity (limited beta invites), social proof (vote counts), authority (verified experts). |
| free-tool-strategy | Low | Could offer a free "fact check widget" embeddable on other sites to drive traffic back. |
| competitor-alternatives | Low | Position against Reddit, Snopes, Wikipedia for fact-checking; useful but not urgent. |
| pricing-strategy | Low | Currently free; relevant only if introducing premium tiers later. |
| form-cro | Low | Receipt submission form optimization; modest impact since primary CTA is well-defined. |
| paid-ads | Low | Early stage -- organic growth and content strategy should come first. |
| popup-cro | Low | Community platform; popups risk annoying power users. Use sparingly. |
| paywall-upgrade-cro | Low | No paywall currently. Only relevant if premium features are introduced. |
| ab-test-setup | Low | Useful once there is enough traffic to run statistically significant tests. |

---

## 2. Fed Memes -- GIF/Meme Platform (Tenor Replacement)

**Type:** Multi-surface consumer platform: Django API, iMessage extension (iOS), Discord bot, iOS keyboard extension, public web SDK. Competing with Giphy in the meme/GIF space.

| Skill | Priority | Rationale |
|-------|----------|-----------|
| launch-strategy | High | Replacing Tenor is time-sensitive. Needs coordinated launch across iMessage extension, Discord bot, and web SDK. |
| product-marketing-context | High | "The central bank of internet culture" positioning needs a clear, reusable context doc for all surfaces. |
| content-strategy | High | Seeding the meme library with quality content is critical pre-launch. Strategy for user-contributed vs curated content. |
| social-content | High | A meme platform lives and dies by social media presence. Showcasing trending memes across Twitter/X, Instagram, TikTok. |
| analytics-tracking | High | Track meme views, shares, searches, favorites across all surfaces (API, iMessage, Discord, web SDK). |
| seo-audit | High | Web-facing meme pages need to be crawlable and optimized for image search (Google Images, meme searches). |
| schema-markup | High | ImageObject, VideoObject structured data for GIFs/memes to appear in rich search results. |
| programmatic-seo | High | Auto-generate category and tag pages ("/memes/reaction/happy", "/memes/trending") at scale for organic traffic. |
| copywriting | Medium | App Store listing, iMessage extension description, Discord bot description, SDK documentation landing page. |
| marketing-ideas | Medium | 140+ tactics for a consumer platform competing against established players. |
| referral-program | Medium | Incentivize meme creators and curators to invite others (e.g., "creator badges," featured status). |
| competitor-alternatives | Medium | "Fed Memes vs Giphy" comparison page for developers choosing a GIF API. |
| free-tool-strategy | Medium | The web SDK picker itself is a free tool that drives API adoption. Strategy for maximizing developer integration. |
| marketing-psychology | Medium | Trending scores, share counts, and favorite counts leverage social proof. "Limited edition" meme collections. |
| pricing-strategy | Medium | API rate limits (100/min anon, 1000/min write) suggest a freemium model. Needs pricing page for developers. |
| paid-ads | Medium | App Store Search Ads for iMessage extension discovery. Google Ads for developer API queries. |
| page-cro | Medium | Optimize the developer portal and API docs landing page for signups. |
| email-sequence | Low | Email sequences for developer onboarding (API key activation, first integration, usage milestones). |
| signup-flow-cro | Low | API key registration flow for developers. Less critical than consumer-facing flows. |
| onboarding-cro | Low | Developer onboarding (first API call, first integration). Important but smaller audience. |
| form-cro | Low | Minimal forms (API key request, content submission). |
| copy-editing | Low | Polish existing copy; lower priority than creating new copy for launch. |
| ab-test-setup | Low | Useful post-launch once traffic volume supports experiments. |
| popup-cro | Low | Not applicable for iMessage/keyboard extensions. Minimal web presence initially. |
| paywall-upgrade-cro | Low | No paywall in current plan. Relevant only for future premium API tiers. |

---

## 3. EasyStreet -- Street Sweeping Parking App (Native iOS + Android)

**Type:** Dual-platform native mobile app (Swift/UIKit + Kotlin/Compose). Consumer utility app for San Francisco residents. MVP complete, heading toward App Store launch.

| Skill | Priority | Rationale |
|-------|----------|-----------|
| launch-strategy | High | App Store submission imminent. Needs coordinated launch plan: TestFlight beta, App Store Optimization, press outreach, local SF community marketing. |
| copywriting | High | App Store listing (title, subtitle, description, keywords), Play Store listing, screenshot captions, promotional text. |
| analytics-tracking | High | In-app event tracking: map views, "I Parked Here" taps, notification interactions, search usage. Essential for understanding feature adoption. |
| product-marketing-context | Medium | Positioning doc for "never get a street sweeping ticket again" messaging. Useful for App Store, social, press. |
| social-content | Medium | Local SF content: "Did you know Market Street gets swept every Tuesday?" shareable posts, TikTok/Reels of the app in action. |
| marketing-psychology | Medium | Loss aversion ("Avoid $76 parking tickets"), urgency ("Sweeping in 1 hour"), social proof ("Join 5,000 SF drivers"). |
| content-strategy | Medium | Blog/content plan: "SF parking tips," "street sweeping schedule changes," "holiday parking rules." |
| marketing-ideas | Medium | Tactics for local/hyper-local app marketing in San Francisco. |
| paid-ads | Medium | Apple Search Ads for "parking app SF," "street sweeping," "avoid parking tickets." High-intent local queries. |
| referral-program | Medium | Word-of-mouth is natural for utility apps. "Share with a neighbor" flow with in-app referral tracking. |
| competitor-alternatives | Low | Few direct competitors for SF street sweeping specifically. More useful for general parking app positioning. |
| seo-audit | Low | Native app -- no web presence unless a marketing website is built. Relevant for App Store SEO (ASO). |
| email-sequence | Low | Limited use case for a utility app. Perhaps a welcome email and weekly sweeping digest. |
| signup-flow-cro | Low | No account required for core features. Only relevant if accounts are added for premium features. |
| onboarding-cro | Low | First-launch tutorial flow. Important but simple (location permission, first parking pin). |
| pricing-strategy | Low | Currently free. Only relevant if introducing premium features (multi-car, widget, family plan). |
| free-tool-strategy | Low | The app itself is free. Could offer an embeddable "check my street" web widget. |
| schema-markup | Low | No web presence. Not applicable unless a website is created. |
| programmatic-seo | Low | No web presence. Not applicable unless a website is created. |
| form-cro | Low | No forms in the app. |
| page-cro | Low | No web pages. |
| popup-cro | Low | No web popups. Push notifications serve this role in mobile. |
| ab-test-setup | Low | Firebase A/B testing for in-app experiments. Useful post-launch once user base is established. |
| copy-editing | Low | Limited copy in the app UI. More relevant for App Store listing polish. |
| paywall-upgrade-cro | Low | No paywall currently. |

---

## 4. easystreet-monorepo -- Street Sweeping App (Cross-Platform: Expo + Next.js)

**Type:** Cross-platform version of EasyStreet with a web component (Next.js). Same core product as EasyStreet native but with web presence.

| Skill | Priority | Rationale |
|-------|----------|-----------|
| seo-audit | High | Next.js web app is crawlable. Technical SEO for street pages, sweeping schedules, and local search. |
| schema-markup | High | LocalBusiness, Event (sweeping schedule), or FAQPage structured data for rich search results. |
| analytics-tracking | High | Same as EasyStreet native, plus web analytics (page views, session duration, bounce rate). |
| launch-strategy | High | If this becomes the primary version, needs a separate web launch strategy alongside mobile. |
| programmatic-seo | High | Auto-generate pages per street/neighborhood: "/sf/mission-street/sweeping-schedule" for organic local search traffic. |
| copywriting | Medium | Web landing page, feature descriptions, CTAs for app download. |
| content-strategy | Medium | Blog content strategy for SEO: "when does [street name] get swept?" FAQ pages per neighborhood. |
| product-marketing-context | Medium | Same positioning as EasyStreet but adapted for web + mobile messaging. |
| social-content | Medium | Same as EasyStreet native. |
| marketing-psychology | Medium | Same loss aversion and urgency tactics, applied to web CTAs. |
| page-cro | Medium | Optimize landing page and street detail pages for conversions (app download, notification signup). |
| signup-flow-cro | Medium | If web version requires accounts, optimize the registration flow. |
| marketing-ideas | Medium | Web-specific tactics: local SEO, neighborhood partnerships, city data partnerships. |
| paid-ads | Medium | Google Ads for local search queries ("street sweeping schedule SF"). |
| onboarding-cro | Low | Web onboarding flow (location permission, first search). |
| email-sequence | Low | Weekly sweeping digest for registered users. |
| referral-program | Low | Share-a-link referral for web version. |
| free-tool-strategy | Low | The web app itself is the free tool. |
| competitor-alternatives | Low | Same as EasyStreet native. |
| form-cro | Low | Minimal forms. |
| copy-editing | Low | Polish web copy. |
| ab-test-setup | Low | Next.js supports server-side A/B testing natively. Useful post-launch. |
| popup-cro | Low | Could use a notification opt-in popup. Low priority initially. |
| pricing-strategy | Low | Free product currently. |
| paywall-upgrade-cro | Low | No paywall. |

---

## 5. tron-castle-fight -- Neon Castle Clash (Browser RTS Game)

**Type:** Browser-based game. Vanilla HTML/CSS/JS, no backend, no accounts. Single-player + WebSocket multiplayer. Hobby/portfolio project with entertainment value.

| Skill | Priority | Rationale |
|-------|----------|-----------|
| social-content | Medium | Gameplay clips, GIFs of battles, "can you beat this?" challenges for Twitter/X, Reddit r/WebGames, itch.io. |
| copywriting | Medium | Game description for itch.io, GitHub README, any distribution platform listing. |
| launch-strategy | Medium | If publishing to itch.io or similar: coordinated posting to r/WebGames, Hacker News "Show HN," IndieDB. |
| content-strategy | Low | Limited content surface. Strategy for gameplay guides or "how I built this" blog posts. |
| analytics-tracking | Low | Optional: track game completions, multiplayer sessions, average match duration for game balance insights. |
| marketing-ideas | Low | Relevant if trying to grow a player base. Otherwise, standard indie game marketing applies. |
| marketing-psychology | Low | Competitive leaderboards, achievement systems to drive engagement (if added). |
| seo-audit | Low | Static HTML file. Minimal SEO surface unless hosted on a dedicated domain. |
| page-cro | Low | If hosted on its own landing page, optimize for "Play Now" conversion. |
| competitor-alternatives | Low | Positioning against other browser RTS games if seeking audience. |
| product-marketing-context | Low | Simple game description for consistent messaging across platforms. |
| schema-markup | Low | VideoGame schema markup if hosted on a dedicated page. |
| programmatic-seo | Low | Not applicable -- single-page game. |
| paid-ads | Low | Generally not cost-effective for free browser games. |
| referral-program | Low | "Challenge a friend" link sharing for multiplayer. |
| free-tool-strategy | Low | The game itself is free. Not a lead-gen tool. |
| email-sequence | Low | Not applicable -- no user accounts. |
| signup-flow-cro | Low | No signup flow. |
| onboarding-cro | Low | In-game tutorial. Not a marketing skill application. |
| pricing-strategy | Low | Free game. |
| form-cro | Low | No forms. |
| popup-cro | Low | Not applicable. |
| ab-test-setup | Low | Not applicable without significant traffic. |
| copy-editing | Low | Minimal copy in the game UI. |
| paywall-upgrade-cro | Low | No paywall. |

---

## 6. shiphawk-templates -- Shipping Document Templates

**Type:** B2B internal tooling. Liquid-templated HTML packing slips and JSON label configs for 20+ enterprise customers. No public-facing marketing surface.

| Skill | Priority | Rationale |
|-------|----------|-----------|
| product-marketing-context | Low | Internal positioning doc for what the template system offers to new customers during sales conversations. |
| copywriting | Low | Sales-support copy describing template customization capabilities. |
| content-strategy | Low | Internal documentation strategy for customer success team. |
| competitor-alternatives | Low | Comparison with competing shipping label/packing slip solutions for sales enablement. |

All other 21 skills are **Not Applicable** -- this is an internal B2B tooling project with no public-facing web presence, no user signups, no SEO surface, and no consumer marketing needs.

---

## Cross-Project Summary

### Skills with Broadest Applicability (High/Medium across 3+ projects)

| Skill | High-Priority Projects | Medium-Priority Projects | Total Applicable |
|-------|----------------------|------------------------|-----------------|
| analytics-tracking | Receipts, Fed Memes, EasyStreet, Monorepo | -- | 4 |
| launch-strategy | Fed Memes, EasyStreet, Monorepo | Receipts, Tron | 5 |
| content-strategy | Receipts, Fed Memes | EasyStreet, Monorepo | 4 |
| copywriting | EasyStreet | Receipts, Fed Memes, Monorepo, Tron | 5 |
| social-content | Fed Memes | Receipts, EasyStreet, Monorepo, Tron | 5 |
| product-marketing-context | Fed Memes | Receipts, EasyStreet, Monorepo | 4 |
| seo-audit | Receipts, Fed Memes, Monorepo | -- | 3 |
| schema-markup | Receipts, Fed Memes, Monorepo | -- | 3 |
| marketing-ideas | -- | Receipts, Fed Memes, EasyStreet, Monorepo | 4 |
| marketing-psychology | -- | EasyStreet, Fed Memes, Monorepo | 3 |
| programmatic-seo | Fed Memes, Monorepo | Receipts | 3 |

### Skills with Narrowest Applicability

| Skill | Only Relevant To |
|-------|-----------------|
| paywall-upgrade-cro | None currently (all products are free) |
| popup-cro | Minimal relevance across all projects |
| form-cro | Receipts only (receipt submission form) |
| ab-test-setup | All projects (but only post-launch with sufficient traffic) |

### Recommended Installation Priority

**Install everywhere (workspace-level):** analytics-tracking, launch-strategy, content-strategy, copywriting, product-marketing-context, social-content

**Install for web projects (Receipts, Fed Memes, Monorepo):** seo-audit, schema-markup, programmatic-seo, signup-flow-cro, page-cro

**Install per-project as needed:** pricing-strategy, paid-ads, referral-program, email-sequence, ab-test-setup

**Skip for now:** paywall-upgrade-cro, popup-cro, form-cro (negligible benefit across current projects)
