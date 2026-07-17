# My* LLC -- Marketing Strategy & Go-to-Market Plan

**Prepared:** 2026-02-22
**For:** Trey Shuldberg, Founder
**Role:** Chief Marketing Officer Analysis

---

## Table of Contents

1. [Brand Strategy](#1-brand-strategy)
2. [Pricing Research & Revenue Math](#2-pricing-research--revenue-math)
3. [Go-to-Market Plan](#3-go-to-market-plan)
4. [Competitive Landscape](#4-competitive-landscape)
5. [Audience Research](#5-audience-research)
6. [6-Month Launch Calendar](#6-six-month-launch-calendar)

---

## 1. Brand Strategy

### LLC Name Recommendation

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **MyApps LLC** | Clear, descriptive, memorable | Very generic -- hard to trademark "MyApps" as it's descriptive of what every developer makes | Not recommended |
| **My* Labs LLC** | Communicates the "My*" pattern + "Labs" signals innovation/experimentation | Asterisk is unusual in legal filings; some state registrars may reject special characters | Backup option (register as "MyStar Labs LLC") |
| **MyStar Labs LLC** | Clean legal name; "star" evokes the `*` wildcard visually; unique enough to trademark | Less immediately obvious connection to "My*" pattern | **Recommended** |
| **Shuldberg Software LLC** | Personal name = unmistakable ownership, easy to register | Doesn't communicate the "My*" brand to consumers | Good for the legal entity if you want separation |
| **MyStack LLC** | Implies a collection/suite of tools | Could conflict with existing dev tooling brands | Not recommended |

**Recommended approach:** Register as **MyStar Labs LLC** (or **Shuldberg Software LLC** as the legal entity), with **My\*** as the consumer-facing brand name and DBA. The asterisk/wildcard communicates "My[Anything]" and the legal entity avoids trademark issues with generic terms.

**Trademark note:** The prefix "My" is considered highly descriptive by the USPTO. You cannot trademark "My" alone, but you can protect individual product names (MyVoice, MySurf) within specific goods/services classes. File intent-to-use trademark applications for your first 2-3 apps before public launch. Cost: ~$250-350 per application via USPTO TEAS Plus. The "My*" umbrella brand is better protected as a trade dress pattern than a single registered mark.

### Brand Positioning

**Option A (Recommended): The Anti-Subscription Manifesto**
> "My* builds apps that respect you. Local-first, source-available, and priced fairly. No accounts, no tracking, no monthly ransom. Your Mac, your data, your apps."

This positions directly against the SaaS subscription fatigue that privacy communities vocally resent. It's confrontational in a way that earns organic sharing.

**Option B: The Personal Tools Workshop**
> "My* is a one-person studio building the apps that should have existed all along -- private, simple, and yours to keep. Each My* app replaces a bloated subscription with a tool that works offline and never phones home."

This leans into the indie/craft narrative. "One-person studio" is a feature, not a limitation, in privacy communities.

**Option C: The User-Owned Software Movement**
> "My* apps are built to be owned, not rented. Source-available code you can inspect. Local processing you can verify. Fair pricing you pay once. Software the way it should be."

This is the most ideological framing -- positions My* as part of a movement rather than just a product line.

**Recommendation:** Lead with Option A for launch (it's punchy and shareable), evolve toward Option C as the portfolio grows and the "movement" framing becomes credible with 5+ apps.

### Visual Identity Direction

**Research: What privacy-first brands look like**

| Brand | Visual Style | What Works |
|-------|-------------|------------|
| Proton | Dark backgrounds, shield iconography, blue/purple gradients | Signals security and professionalism |
| Standard Notes | Minimal, monochrome, clean typography | Communicates simplicity and focus |
| Obsidian | Dark purple/gem aesthetic, faceted crystal logo | Implies depth, durability, precious |
| Signal | White background, blue accent, speech bubble | Clean, approachable, not intimidating |
| Bitwarden | Blue shield, corporate-clean | Trust-oriented but somewhat generic |

**Recommended direction for My\*:**

- **Not corporate.** Proton and Bitwarden look like enterprise products. My* should feel personal and handcrafted.
- **Dark mode native.** The audience lives in dark mode. Default to dark backgrounds with warm accent colors.
- **Warm, not cold.** Privacy brands over-index on blue/cold tones (security signaling). My* should use warm tones -- amber, coral, warm white text -- to signal "personal" and "inviting" rather than "fortress."
- **The asterisk as icon.** A stylized `*` (six-pointed, hand-drawn feel) becomes the brand mark. Each app gets a color variant: MyVoice (amber/gold), MySurf (teal/ocean), MyMail (warm red), MyWorkouts (green).
- **Typography:** A humanist sans-serif (Inter, Atkinson Hyperlegible, or Source Sans Pro) -- readable, modern, but not cold.
- **No shield icons.** Shields scream "we're worried about security." Confidence in privacy means you don't need to constantly signal it.

### Tagline Options

| Tagline | Tone | Best For |
|---------|------|----------|
| **"Your apps. Your data. Your rules."** | Assertive, empowering | Primary tagline -- works everywhere |
| **"Software that stays on your Mac."** | Factual, clear | MyVoice-specific, technical audiences |
| **"Apps you own, not rent."** | Anti-subscription | Landing page hero, social media |
| **"Built for one. Available to all."** | Indie ethos | About page, press kit |
| **"No cloud. No account. No kidding."** | Playful | Social content, Product Hunt |

**Recommended primary:** "Your apps. Your data. Your rules." -- it's rhythmic, memorable, and immediately communicates the value proposition.

---

## 2. Pricing Research & Revenue Math

### Market Pricing Analysis

| App | Model | Price | Category | Notes |
|-----|-------|-------|----------|-------|
| Things 3 | One-time | $50 (Mac) / $10 (iPhone) | Productivity | Gold standard for premium one-time pricing |
| iA Writer | One-time | $30 | Writing | Explicitly anti-subscription; they report making more from one-time purchases than subscriptions |
| Bear | Annual | $30/yr | Notes | Migrated to subscription; community pushback but retained users |
| Halide | Annual / One-time | $12/yr or $36 lifetime | Camera | Dual model works well; subscription for ongoing development funding |
| CARROT Weather | Freemium + Sub | Free + $5-10/yr premium | Weather | Weather data costs justify subscription; 50K+ paying users |
| Craft | Freemium + Sub | Free + $60/yr | Docs | Higher price point requires serious feature differentiation |
| Superwhisper | One-time | $20 | Dictation | Direct MyVoice competitor; one-time purchase, local Whisper |
| MacWhisper | One-time | $15 | Dictation | Another local Whisper app; clean UI, no subscription |
| Kagi Search | Monthly | $5/mo ($60/yr) | Search | Proves people pay for privacy; 50K-65K subscribers |

### Recommended Pricing Strategy: Hybrid Model

**For MyVoice and utility apps (dictation, mail, workouts):**
- **$12 one-time purchase** (Mac App Store)
- **$10 direct purchase** (via website, no Apple cut)
- No subscription. No freemium. One price, full app.
- Rationale: Matches Superwhisper ($20) and MacWhisper ($15) but undercuts slightly. The "no subscription" stance is itself a marketing message.

**For MySurf and data-intensive apps:**
- **Free tier:** 3-day forecast, limited spots, basic map
- **$5/year premium:** 16-day forecast, all spots, AI narratives, advanced charts
- Rationale: Ongoing NOAA data pipeline costs justify a small subscription. $5/yr is so low it feels like a tip. Compare to Surfline at $100/yr -- the price gap is the marketing.

**For the future My* bundle:**
- **$25/year for all premium features across all My* apps** (when 3+ apps exist)
- This is the Proton play at 1/5th the price. "Everything, everywhere, for $25/year."

### Revenue Math

**Apple App Store Small Business Program:** 15% commission on first $1M in proceeds (vs. 30% standard). Eligible immediately as a new developer.

| Scenario | Price | Users Needed for $1K/mo | $5K/mo | $10K/mo |
|----------|-------|------------------------|--------|---------|
| One-time $12 (App Store, 15% cut) | $10.20 net | 98/mo new purchases | 490/mo | 980/mo |
| One-time $10 (Direct, ~3% Stripe) | $9.70 net | 103/mo new purchases | 515/mo | 1,031/mo |
| $5/yr subscription (App Store) | $4.25 net/yr | 2,824 active subs | 14,118 subs | 28,235 subs |
| $5/yr subscription (Direct) | $4.85 net/yr | 2,474 active subs | 12,371 subs | 24,742 subs |
| Bundle $25/yr (App Store) | $21.25 net/yr | 565 active subs | 2,824 subs | 5,647 subs |
| Bundle $25/yr (Direct) | $24.25 net/yr | 495 active subs | 2,474 subs | 4,948 subs |

**Key insight:** One-time purchases require constant new user acquisition. The $5/yr subscription needs enormous volume to be meaningful alone. The **bundle play is the business model** -- $25/yr with 2,500-5,000 subscribers is a sustainable indie income ($5K-$10K/mo). The individual apps are lead generation for the bundle.

**Realistic 12-month target:** 500-1,000 active subscribers at $25/yr bundle = $1,000-$2,000/mo. This is achievable with strong community presence and 3+ shipped apps.

### Payment Platform Recommendation

| Platform | Fees | MoR | Tax Handling | Setup Effort | Recommendation |
|----------|------|-----|-------------|--------------|----------------|
| **Lemon Squeezy** | 5% + $0.50 | Yes | Auto (100+ countries) | Minimal | **Best for solo dev** -- handles tax, refunds, global compliance |
| Paddle | 5% + $0.50 | Yes | Auto (global) | Low | Good alternative; slightly more enterprise-focused |
| Gumroad | 10% + $0.50 | Yes | Auto | Minimal | Too expensive at 10%; avoid |
| Stripe (direct) | 2.9% + $0.30 | No | DIY | Medium | Lowest fees but you handle tax compliance yourself |

**Recommendation:** Use **Lemon Squeezy** for direct web sales (handles everything as Merchant of Record). Use **App Store** for iOS/Mac distribution. The ~2% fee difference between Lemon Squeezy and Stripe isn't worth the tax compliance burden for a solo developer.

**Note:** Stripe acquired Lemon Squeezy in 2024. The platform's long-term direction is evolving, but for now it remains the simplest MoR option for indie devs.

---

## 3. Go-to-Market Plan

### Launch Sequence

**Recommended order: MyVoice first, MySurf second.**

| # | App | Why This Order | Target Launch |
|---|-----|---------------|---------------|
| 1 | **MyVoice** | Most mature codebase. Clear privacy narrative ("your voice never leaves your Mac"). Dictation market is hot (Whisper ecosystem growing). Low ongoing costs (no data pipeline). Establishes the brand. | Month 1-2 |
| 2 | **MySurf** | Clearest market gap (Surfline is $100/yr and widely disliked). Has natural virality among surfers. The $5/yr vs $100/yr price story writes itself. Introduces the subscription model. | Month 3-5 |
| 3 | **MyWorkouts** | Broadens audience beyond tech/privacy niche into health/fitness. Validates the "My* for everything" thesis. | Month 6-8 |

**Why MyVoice first (not MySurf):**
1. MyVoice is already built and functional. MySurf needs more development.
2. The dictation app market validates quickly -- users either need it or don't. Short feedback loop.
3. Privacy/tech communities (your first audience) care deeply about voice data privacy. Strong resonance.
4. A launched, reviewed, source-available Mac app gives you credibility for the MySurf launch.
5. MyVoice as a one-time purchase generates early revenue without subscription infrastructure.

### Product Hunt Strategy

**Pre-Launch (4+ weeks before):**
1. Create a "Coming Soon" page on Product Hunt immediately
2. Start engaging on PH daily: upvote products, leave thoughtful comments, follow makers
3. Build a pre-launch email list (target: 200+ signups via landing page)
4. Announce on Twitter/X, Mastodon, and relevant subreddits that something is coming
5. Line up 5-10 friends/contacts who will comment on launch day

**Launch Day Tactics:**
- Launch on a **Tuesday or Wednesday** (weekdays have more traffic; weekends are easier to win but lower volume)
- Post at **12:01 AM PST** to maximize the full 24-hour window
- Maker comment should be authentic and developer-focused: "I built this because cloud dictation felt wrong. Here's what it does, here's the source code, here's why."
- Reply to **every comment within minutes** for the first 3 hours (this is the algorithm window)
- Cross-post the PH link to Twitter/X, Mastodon, HN, relevant subreddits, and Discord communities

**Post-Launch:**
- Update the PH page with user testimonials and feature updates
- Use PH as a recurring channel: launch each new My* app as a separate product
- The "My* Suite" can be its own PH launch later

### Community Marketing Plan

**Tier 1 -- Primary channels (launch week):**

| Platform | Subreddit/Community | Size | Strategy |
|----------|-------------------|------|----------|
| Reddit | r/privacy | 1.5M+ members | "I built a dictation app that never sends your voice to the cloud" -- genuine, technical post. NOT a sales pitch. |
| Reddit | r/selfhosted | 800K+ members | Frame as local-first software. Mention source-available code. |
| Reddit | r/macapps | ~200K members | Straightforward app showcase with screenshots |
| Reddit | r/degoogle | ~100K members | Frame as de-clouding your voice input |
| Hacker News | Show HN | Millions of readers | "Show HN: MyVoice -- Local dictation for Mac using whisper.cpp" -- technical, concise |
| Product Hunt | Launch page | -- | See strategy above |

**Tier 2 -- Ongoing community presence (weeks 2-8):**

| Platform | Strategy |
|----------|----------|
| IndieHackers | "Building in public" journey posts. Revenue transparency. Monthly updates. |
| Twitter/X | Dev log thread. Daily/weekly updates on building My* apps with AI agents. |
| Mastodon | Privacy-focused instance communities (fosstodon.org, etc.) |
| Discord | Join dictation/productivity Discords; be helpful before promoting |
| Dev.to / Hashnode | Technical blog posts about building with Whisper, Electron, etc. |

**Tier 3 -- MySurf-specific (Month 3+):**

| Platform | Strategy |
|----------|----------|
| Reddit | r/surfing (800K+), r/SanDiego, r/bayarea, r/LosAngeles |
| Surfing forums | Swaylocks, Jamboards -- post comparison "MySurf vs Surfline" |
| Instagram | Surf content + forecast screenshots |
| Local surf shops | QR code flyers for beta testing (California MVP) |

### ASO (App Store Optimization)

**Keyword strategy for MyVoice:**
- Primary: "dictation", "voice typing", "speech to text"
- Long-tail (lower competition): "private dictation", "offline dictation mac", "local speech to text", "whisper dictation", "no cloud dictation"
- Competitor keywords: "superwhisper alternative", "macwhisper alternative"

**Keyword strategy for MySurf:**
- Primary: "surf forecast", "surf report", "wave forecast"
- Long-tail: "free surf forecast", "surfline alternative", "surf forecast California", "cheap surf app"
- Competitor keywords: "surfline alternative", "better than surfline"

**ASO best practices:**
- Include primary keyword in app name: "MyVoice - Private Dictation"
- Fill all 100 characters of the subtitle with keywords
- Use all 100 characters in the keyword field (comma-separated, no spaces)
- Update screenshots quarterly with fresh feature callouts
- Respond to every App Store review (signals active development)
- Localize metadata for top 5 languages even if app is English-only

### Source-Available as Marketing

**How successful open-source/source-available apps leverage transparency:**

| App | Approach | Marketing Effect |
|-----|----------|-----------------|
| Bitwarden | Fully open-source, third-party audited | "Complete transparency means users can verify every claim" -- trust is the product |
| Signal | Open-source protocol + apps | The protocol IS the brand. Technical credibility converts to mainstream trust. |
| Obsidian | Closed source but local-first Markdown files | "Your data is yours" without needing to show code. Format portability = trust. |
| Standard Notes | Open-source, now part of Proton | Community contributes and audits. Open source was the acquisition hook. |

**Recommended approach for My\*:**
1. **Publish source on GitHub under a source-available license** (e.g., BSL 1.1, SSPL, or a custom "look but don't compete" license). NOT fully open source (prevents cloning by funded competitors).
2. **Link to GitHub from every app listing.** "Don't trust us? Read the code."
3. **Publish security-relevant code paths.** For MyVoice: highlight that audio never leaves the device. For MySurf: show that location data stays local.
4. **Invite community audits.** "We welcome security researchers to review our source code."
5. **Use GitHub stars as social proof.** "Trusted by X developers who've read our source."

**The tagline for this angle:** "Source-available. Inspect everything. Trust nothing blindly."

### Content Marketing

**Blog topics (high-SEO, high-share potential):**

1. **"Why your voice assistant is listening (and what I built instead)"** -- Privacy angle for MyVoice. Link bait for r/privacy.
2. **"I replaced Surfline with a $5/yr app I built myself"** -- David vs Goliath story. r/surfing gold.
3. **"Building a Mac app with AI agents: My workflow"** -- Technical audience. HN, Dev.to.
4. **"The true cost of 'free' apps"** -- Evergreen privacy content. SEO play for "privacy apps" keywords.
5. **"Whisper vs cloud dictation: A privacy comparison"** -- Technical comparison. Ranks for dictation keywords.
6. **"One developer, six apps: How I'm building a software company with AI"** -- IndieHackers, Twitter/X.

**Comparison pages (high-intent SEO):**
- "MySurf vs Surfline" -- target surfers searching for alternatives
- "MyVoice vs Superwhisper vs MacWhisper" -- target dictation shoppers
- "My* vs Proton: Local-first vs cloud-encrypted" -- thought leadership

---

## 4. Competitive Landscape

### Privacy App Ecosystem Map

```
                    CLOUD-ENCRYPTED                    LOCAL-FIRST
                    (trust the server)                 (trust nothing)
                         |                                  |
    Enterprise    Proton (mail+VPN+drive+cal)          My* (dictation+surf+mail+...)
    Bundle        $10-13/mo                            $25/yr
                  Swiss jurisdiction                    Your Mac
                  300M+ users                          New entrant
                         |                                  |
    Single-App    Standard Notes ($90/yr)              Obsidian ($0 + $50/yr sync)
    Notes         Signal (free)                        iA Writer ($30 one-time)
                  Bitwarden ($10/yr)                   Things 3 ($50 one-time)
                  Fastmail ($30-90/yr)                 MacWhisper ($15 one-time)
```

### How My* Differentiates from Proton

| Dimension | Proton | My* |
|-----------|--------|-----|
| **Architecture** | Cloud-hosted, end-to-end encrypted | Local-first, on-device processing |
| **Trust model** | Trust Proton's servers + Swiss law | Trust your own hardware. Zero servers. |
| **Pricing** | $10-13/month ($120-156/yr) | $25/year for everything |
| **Data location** | Proton's data centers (Switzerland) | Your Mac's local storage |
| **Source code** | Open-source (most apps) | Source-available |
| **Target user** | Privacy-conscious mainstream | Privacy-maximalist, self-hosted leaning |
| **Business model** | VC-funded, 300M users, enterprise sales | Solo dev, community-funded, indie |

**The pitch:** "Proton encrypts your data on their servers. My* never sends it there in the first place."

This is not a competitive attack on Proton -- many My* users will also use Proton. It's a positioning distinction: My* is for people who want the **next level** of privacy beyond cloud-encrypted. The overlap audience is large.

### Indie App Success Stories -- Lessons

| App | Key Growth Lever | Revenue Peak | Lesson for My* |
|-----|-----------------|--------------|-----------------|
| CARROT Weather | Personality/humor + App Store editorial features | 50K+ subscribers | **Character matters.** Apps with personality get press and word-of-mouth. |
| Overcast | Marco Arment's podcast audience + technical blog posts | $1M+/yr (estimated) | **Existing audience is the cheat code.** Build the audience before/alongside the app. |
| Halide | Beautiful design + "why we charge" blog post went viral | Sustainable indie income | **Explain your pricing publicly.** The blog post about why Halide costs money was their best marketing. |
| Bear | Apple Design Award + Markdown community love | $2M+/yr (estimated) | **Design quality earns Apple features.** Invest in polish for editorial consideration. |
| Craft | Apple Design Award + freemium funnel | $10M+ ARR | **Freemium works at scale** but requires significant free tier investment. |

### Direct Competitors by App

**MyVoice competitors:**
- Superwhisper ($20 one-time) -- closest competitor, also local Whisper
- MacWhisper ($15 one-time) -- transcription-focused, less dictation-oriented
- Whisper Transcription ($10) -- basic, less polished
- Voice Type ($5) -- simpler feature set
- Apple Dictation (free) -- improving but limited customization

**MySurf competitors:**
- Surfline ($100/yr) -- dominant but expensive and increasingly disliked for paywalling basic data
- Surf-Forecast.com (free) -- independent, UK/NZ based, post-MagicSeaweed acquisition
- Windy (free + $20/yr) -- powerful but not surf-specific
- Surf Captain (low-cost) -- niche, less polished

---

## 5. Audience Research

### Primary Early Adopter Segments

**Segment 1: The Privacy Maximalists**
- Where: r/privacy (1.5M), r/degoogle, Privacy Guides forum, Mastodon (fosstodon.org)
- Who: Technical, informed, actively replacing cloud services with local/self-hosted alternatives
- Pain points: "Every app wants an account and sends my data to the cloud." "I'd pay for software that doesn't spy on me."
- What they wish existed: Simple, well-designed apps that are privacy-first WITHOUT being ugly or hard to use
- **My* appeal:** Source-available code, local processing, no accounts, no telemetry

**Segment 2: The Self-Hosters**
- Where: r/selfhosted (800K+), selfh.st newsletter, Awesome Selfhosted GitHub (150K+ stars)
- Who: Run their own servers, Docker enthusiasts, Linux/Mac power users
- Pain points: "Self-hosting is powerful but time-consuming." "I want privacy without running my own infrastructure."
- What they wish existed: Privacy-respecting apps that work out of the box without a server
- **My* appeal:** "Self-hosted quality privacy, zero infrastructure. Just install the app."

**Segment 3: The Subscription-Fatigued**
- Where: r/macapps, r/apple, Twitter/X, Hacker News
- Who: Mac users drowning in $5-15/mo subscriptions; actively seeking one-time purchase alternatives
- Pain points: "I pay $200/mo in app subscriptions." "I just want to buy software like the old days."
- What they wish existed: High-quality Mac apps at fair one-time prices
- **My* appeal:** One-time purchase (MyVoice) or ultra-low annual ($5/yr MySurf). Anti-subscription positioning.

**Segment 4: The Surfer Community (MySurf-specific)**
- Where: r/surfing (800K+), Swaylocks, Jamboards, local surf shops, Instagram surf accounts
- Who: Daily surfers frustrated with Surfline's pricing and accuracy
- Pain points: "Surfline is $100/yr and the forecast is often wrong." "I just want to know if it's worth paddling out."
- What they wish existed: Accurate, affordable surf forecasts without the bloat
- **My* appeal:** $5/yr, NOAA data (same underlying source as Surfline), AI narratives, no cam paywall

**Segment 5: The Indie Developer Community**
- Where: IndieHackers, Hacker News, Twitter/X, Dev.to
- Who: Developers building their own products; appreciate craftsmanship and technical transparency
- Pain points: N/A -- this segment is more about community than customer
- **My* appeal:** The "building with AI agents" story. Source-available code. "I'm one developer building a suite of apps" narrative. They'll amplify the story even if they're not customers.

### Audience Size Estimation

| Segment | Estimated Reachable Size | Conversion Potential |
|---------|------------------------|---------------------|
| Privacy Maximalists | 2-3M across platforms | High intent, moderate volume |
| Self-Hosters | 1-2M across platforms | High intent, niche |
| Subscription-Fatigued Mac Users | 10-20M (broader Mac community) | Lower intent, massive volume |
| Surfer Community (California) | 2-3M surfers in CA | High intent for MySurf specifically |
| Indie Developers | 500K-1M active builders | Low direct revenue, high amplification |

---

## 6. Six-Month Launch Calendar

### Month 1 (March 2026): Pre-Launch & Foundation

**Week 1-2:**
- [ ] Register LLC (MyStar Labs LLC or preferred name)
- [ ] Set up Lemon Squeezy account for direct sales
- [ ] Apple Developer Program enrollment ($99/yr)
- [ ] Create my-star.dev (or mystar.dev) landing page with email signup
- [ ] Set up social accounts: Twitter/X, Mastodon, IndieHackers
- [ ] Create Product Hunt "Coming Soon" page for MyVoice

**Week 3-4:**
- [ ] Begin daily engagement on Product Hunt (upvote, comment, follow makers)
- [ ] First "building in public" post on IndieHackers/Twitter
- [ ] Finalize MyVoice App Store listing (screenshots, keywords, description)
- [ ] Submit MyVoice to Mac App Store review
- [ ] Post in r/privacy: "I'm building a local-first dictation app. What matters most to you?"
- [ ] Write blog post: "Why your voice assistant is listening"

### Month 2 (April 2026): MyVoice Launch

**Week 1 (Launch Week):**
- [ ] MyVoice goes live on Mac App Store ($12) and direct ($10 via Lemon Squeezy)
- [ ] GitHub source published (source-available license)
- [ ] Product Hunt launch (Tuesday/Wednesday, 12:01 AM PST)
- [ ] Show HN post: "Show HN: MyVoice -- Local dictation for Mac using whisper.cpp"
- [ ] Reddit posts: r/privacy, r/selfhosted, r/macapps, r/degoogle
- [ ] Mastodon announcement on fosstodon.org

**Week 2-3:**
- [ ] Respond to all reviews, comments, and feedback
- [ ] Blog post: "Whisper vs cloud dictation: A privacy comparison"
- [ ] Reach out to 10 tech/privacy blogs for review
- [ ] Submit to Awesome Selfhosted, Awesome Privacy GitHub lists

**Week 4:**
- [ ] Analyze first month metrics (downloads, revenue, reviews)
- [ ] Publish revenue transparency post on IndieHackers
- [ ] Begin MySurf beta preparation

### Month 3 (May 2026): Community Building + MySurf Beta

**Week 1-2:**
- [ ] MyVoice 1.1 update (address top user feedback)
- [ ] Blog post: "Building a Mac app with AI agents: My workflow"
- [ ] MySurf closed beta launch (invite 50-100 surfers via r/surfing, local shops)
- [ ] Create Product Hunt "Coming Soon" page for MySurf

**Week 3-4:**
- [ ] MySurf beta feedback collection and iteration
- [ ] Blog post: "I replaced Surfline with a $5/yr app I built myself"
- [ ] Start r/surfing engagement (helpful posts about forecasting, not promotional)
- [ ] MySurf App Store listing preparation

### Month 4 (June 2026): MySurf Launch

**Week 1 (Launch Week):**
- [ ] MySurf goes live: App Store (free + $5/yr premium), direct sales
- [ ] Product Hunt launch for MySurf
- [ ] Reddit: r/surfing, r/SanDiego, r/bayarea, r/LosAngeles
- [ ] "MySurf vs Surfline" comparison page published on blog
- [ ] Local surf shop outreach (QR code flyers in 10 shops)

**Week 2-4:**
- [ ] Daily engagement with surfer community
- [ ] Respond to all reviews and feedback
- [ ] Publish "How MySurf forecasts work" technical blog post
- [ ] Instagram content: surf condition screenshots with forecasts

### Month 5 (July 2026): Growth & Bundle Planning

**Week 1-2:**
- [ ] MySurf 1.1 (top feedback, accuracy improvements)
- [ ] Announce My* Bundle concept: "$25/yr for everything"
- [ ] Revenue transparency update on IndieHackers
- [ ] Blog: "One developer, six apps: How I'm building a software company with AI"

**Week 3-4:**
- [ ] Begin MyWorkouts development
- [ ] Apply for Apple App Store editorial feature consideration
- [ ] Cross-promote MyVoice to MySurf users and vice versa
- [ ] Start SEO content pipeline (1 post/week on privacy, surfing, productivity)

### Month 6 (August 2026): Consolidation & Scale

**Week 1-2:**
- [ ] My* Bundle goes live ($25/yr for MyVoice Premium + MySurf Premium)
- [ ] Update all App Store listings with bundle cross-promotion
- [ ] MyWorkouts beta launch to existing My* users

**Week 3-4:**
- [ ] 6-month retrospective blog post (revenue, learnings, roadmap)
- [ ] Apply to speak at indie dev conferences (MicroConf, etc.)
- [ ] Begin outreach to podcast hosts (indie dev, privacy, surfing podcasts)
- [ ] Plan Month 7-12 roadmap based on data

### Key Metrics to Track

| Metric | Month 2 Target | Month 4 Target | Month 6 Target |
|--------|---------------|---------------|---------------|
| MyVoice downloads | 500 | 1,500 | 3,000 |
| MyVoice paid (direct + App Store) | 100 | 400 | 800 |
| MySurf downloads | -- | 1,000 | 3,000 |
| MySurf premium subscribers | -- | 200 | 600 |
| Email list | 300 | 1,000 | 2,500 |
| GitHub stars (MyVoice) | 200 | 500 | 1,000 |
| Monthly revenue | $1,000 | $2,500 | $4,000 |
| Product Hunt upvotes (per launch) | 200+ | 300+ | -- |

---

## Sources

- [Standard Notes and Proton's journey](https://standardnotes.com/blog/progress-with-proton)
- [Proton VPN 2026 roadmap](https://www.techradar.com/vpn/proton-vpn-2025s-privacy-milestones-and-the-2026-roadmap)
- [Top 15 Most Profitable Indie Apps](https://mktclarity.com/blogs/news/indie-apps-top)
- [iA Writer: Subscription or no Subscription?](https://ia.net/topics/subscription-or-no-subscription)
- [Why is Halide not free?](https://www.lux.camera/why-is-halide-not-free/)
- [CARROT Weather Success Story](https://appsamurai.com/blog/mobile-app-success-story-how-carrot-weather-did-it/)
- [Product Hunt Launch Guide 2026](https://hackmamba.io/developer-marketing/how-to-launch-on-product-hunt/)
- [Product Hunt Launch Checklist](https://key-g.com/blog/product-hunt-launch-checklist-47-steps-to-rank-no-1-in-2025/)
- [Best day to launch on Product Hunt](https://fmerian.medium.com/the-best-day-to-launch-on-product-hunt-eefe090fcc4a)
- [Product Hunt Tips for 2026](https://syntaxhut.tech/blog/best-product-hunt-launch-tips-2026)
- [Payment Processor Fees Compared](https://userjot.com/blog/stripe-polar-lemon-squeezy-gumroad-transaction-fees)
- [LemonSqueezy vs Gumroad](https://ruul.io/blog/lemonsqueezy-vs-gumroad)
- [Best Merchant of Record Platforms 2026](https://fungies.io/the-best-merchant-of-record-platforms-for-saas-in-2026/)
- [App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- [The 15% App Store Fee Guide](https://www.revenuecat.com/blog/engineering/small-business-program/)
- [Bitwarden Open Source Security](https://bitwarden.com/blog/bitwarden-open-source-security-explained/)
- [Bitwarden 2026 Privacy Survey](https://www.morningstar.com/news/business-wire/20260130912062/bitwarden-reveals-2026-data-privacy-week-survey-results-to-uncover-top-privacy-apps)
- [r/privacy Subreddit Stats](https://subredditstats.com/r/privacy)
- [Privacy Guides Recommendations](https://www.privacyguides.org/en/tools/)
- [Awesome Privacy on GitHub](https://github.com/pluja/awesome-privacy)
- [ASO Long-tail Optimization 2026](https://www.mobileaction.co/blog/aso-long-tail-optimization/)
- [ASO Keyword Research 2026](https://www.mobileaction.co/blog/aso-keyword-research/)
- [Organic App Growth Strategies 2026](https://www.mobileaction.co/blog/organic-app-growth-in-2025/)
- [Kagi Search Pricing](https://kagi.com/pricing)
- [Kagi Search Review](https://xraise.ai/blog/kagi-search-review/)
- [Proton Pricing Plans](https://proton.me/pricing)
- [Surfline Competitor Analysis](https://www.similarweb.com/website/surfline.com/competitors/)
- [Best Dictation Apps macOS 2026](https://www.macaiapps.com/blog/best-dictation-apps-for-macos/)
- [AI Dictation Apps on Product Hunt](https://www.producthunt.com/categories/ai-dictation-apps)
- [Trademarks for Mobile Apps](https://arapackelaw.com/trademarks/trademarks-for-mobile-apps/)
- [How to Register Software App Name as Trademark](https://www.nolo.com/legal-encyclopedia/how-register-your-software-app-name-trademark.html)
