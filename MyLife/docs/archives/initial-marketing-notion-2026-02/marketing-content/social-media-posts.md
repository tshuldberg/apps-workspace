# MyLife Social Media Content - Launch Pack

## Twitter/X Posts (10)

### Post 1 - The Hook
I added up every app subscription I pay for.

YNAB: $109/yr
Surfline: $120/yr
Strava: $80/yr
Calm: $70/yr
MFP: $200/yr
StoryGraph: $50/yr
Daylio: $36/yr
Habitify: $30/yr
Notion: $96/yr
Zero: $70/yr

Total: $861/year. For 10 apps.

I built one app that replaces all of them.

$20. One time. Forever.

It's called MyLife. Every byte of data stays on your device.

---

### Post 2 - The Privacy Angle
MyFitnessPal was hacked in 2018. 150 million accounts.

Flo Health stores 380 million users' cycle data on their servers.

Medisafe shares medication data with pharmaceutical companies.

Mint shut down and redirected users to Credit Karma.

MyLife stores everything in a local SQLite database on your phone. No server. No account. No breach possible.

Your budget, your health data, your reading list. On your device. Where it belongs.

---

### Post 3 - The Math
Year 1: You pay $861 for 10 app subscriptions. MyLife costs $20.
Year 2: You pay $1,722 cumulative. MyLife is still $20.
Year 3: You pay $2,583. Still $20.
Year 5: You've paid $4,305. MyLife? $20.

That's a 97.6% savings in year one.

99.5% over five years.

The price isn't a promotion. It's the price. Forever.

---

### Post 4 - The YNAB Thread
YNAB pricing history:

2015: One-time purchase, $60
2017: Subscription, $50/year
2021: Raised to $84/year
2024: Raised to $109/year

From $60 once to $109/year.

MyBudget does envelope budgeting with a subscription tracker. $2. One time. All data on your device.

Same methodology. 98% less money. 100% more privacy.

---

### Post 5 - The Free Tier
MyFast is a free fasting timer.

Not "free trial" free.
Not "free with ads" free.
Not "free for 7 days" free.

Actually free. Forever. No account. No upsell. No data collection.

Zero charges $70/yr for the same thing.

MyFast is the free module inside MyLife, which has 19 more modules for $20 total if you want them.

---

### Post 6 - The Privacy Architecture
"We take your privacy seriously" - every app's privacy policy

"We never have your data" - MyLife's entire privacy architecture

There's a difference between promising to protect your data and building a system where we physically cannot access it.

SQLite on your phone. No server. No account. No cloud.

We can't breach what we never had.

---

### Post 7 - The Bundle Math
Individual app subscriptions for one year:
- Budgeting: $109
- Workout tracking: $80
- Meditation: $70
- Book tracking: $50
- Fasting: $70
- Calorie counting: $200

Total: $579/yr for 6 apps

MyLife Complete: $20 for 20+ apps. One time.

That's not a discount. That's a different business model.

---

### Post 8 - The Cycle Tracker
After the Dobbs decision, period tracking privacy became a real concern.

61% of popular cycle tracking apps have code vulnerabilities. Many share data without meaningful consent.

MyCycle stores cycle data in a local SQLite database. No server. No account. No cloud sync. Your data physically cannot be subpoenaed from us because we never have it.

$2. Your most intimate health data, fully under your control.

---

### Post 9 - The Dead Apps
Mint: shut down, 20M users redirected to Credit Karma
Evernote: acquired, entire staff laid off
Yummly: acquired by Whirlpool, shut down 2024
Dictionary.com: deleted all user accounts 2025
MagicSeaweed: acquired by Surfline, absorbed

When your app lives on someone else's server, they decide when it dies.

MyLife runs on your device. We can't shut down your data.

---

### Post 10 - The Builder Story
I used to pay $100+/month for apps that track my life.

Budget. Workouts. Books. Fasting. Meditation. Recipes. Habits.

Each one wanted my data on their server and my credit card on file monthly.

So I built MyLife: 20+ apps in one. $20 one-time. All data on your device.

No VC funding. No data monetization. No subscription traps.

Just apps that work, stored where they should be.

---

## Reddit Posts (5)

### r/privacy - "Looking for privacy-first alternatives to mainstream apps"

**Title:** I built a privacy-first app hub that stores everything locally. No accounts, no cloud, no telemetry. Looking for feedback from this community.

**Body:**

I've been lurking here for years and the same question comes up constantly: "What's a private alternative to [popular app]?"

So I built one. MyLife is a single app with 20+ modules inside. Budget tracking, fasting timer, book tracker, workout logger, meditation timer, cycle tracker, mood diary, and more. Every module stores data in a local SQLite database on your device.

No account creation. No email required. No analytics SDK. No telemetry. No cloud sync (by default -- a couple modules have opt-in sync). No Plaid bank linking. No third-party data sharing.

The privacy model is simple: we never have your data. There's no server to store it on. There's no database to breach. There's no privacy policy to update because there's nothing to disclose.

Pricing: MyFast (fasting timer) is free forever. Individual modules are $2 one-time. Complete suite is $20 one-time.

I know this community is skeptical, and you should be. I'm looking for genuine feedback on the approach. What would you want to see to trust a privacy claim like this? Would open-sourcing the data layer help?

---

### r/ynab - "For anyone frustrated with YNAB's price increases"

**Title:** I switched from YNAB after 4 years. Here's what I moved to and the trade-offs.

**Body:**

I was a YNAB devotee. The methodology works. Zero-based budgeting changed my relationship with money. But when the price went from $50/yr to $84/yr to $109/yr, I started questioning the value.

$109/year for envelope categories and a Plaid connection. That's what it comes down to.

I moved to MyBudget (part of the MyLife app). It does envelope budgeting with a subscription tracker built in. The cost is $2. One time. Not $2/month. $2 total, forever.

The trade-offs are real:
- No bank linking. You enter transactions manually. For me, this was actually a positive because I'm more aware of spending when I type it in. For people who rely on auto-import, this is a dealbreaker.
- No web app (mobile and web via Next.js, but not the same polish as YNAB's web experience yet).
- Newer product, so it doesn't have the decade of refinement YNAB has.
- No reports as sophisticated as YNAB's Age of Money or net worth tracking.

The positives:
- $2 vs. $109/year. I'll save $535 over five years.
- All data on my device. No cloud dependency.
- Built-in subscription tracker with 215 pre-loaded services. Found two subscriptions I'd forgotten about ($17/month wasted).
- No account to create or manage.

If you're happy with YNAB at $109/yr, genuinely, keep using it. The methodology is proven. But if the price bothers you and you're comfortable with manual entry, this exists.

---

### r/books - "Privacy-first book tracking that isn't Goodreads"

**Title:** I built a book tracker after getting frustrated with Goodreads. No Amazon. No account. No cloud. Here's what it does.

**Body:**

I love tracking what I read. I hate that my reading data feeds Amazon's recommendation engine.

Goodreads has 150 million users, hasn't shipped a meaningful update in years, killed its API, and exists primarily as a data pipeline for Amazon. Your reading list, your ratings, your reviews -- it's all product input for their algorithm.

StoryGraph is better but costs $50/year for the full experience and still requires a cloud account.

MyBooks is a book tracker that stores everything on your device. Library management, TBR/reading/finished lists, half-star ratings, private reviews, reading goals, year-in-review stats, and barcode scanning. Import your Goodreads or StoryGraph CSV export.

Book metadata comes from Open Library (a non-profit, not Amazon).

$2. One time. No account. No cloud. Your reading life is your own.

Part of MyLife, which has 19 other modules (budget, fasting, workouts, etc.) but MyBooks works great on its own.

Not here to spam. Genuinely built this because the book tracking space frustrated me and I think others here feel the same. Happy to answer questions about the approach.

---

### r/surfing - "Alternative to Surfline that doesn't cost $120/year"

**Title:** Built a surf forecast app using the same NOAA/NDBC data Surfline uses. $2 instead of $120/year.

**Body:**

I love surfing. I don't love paying $15.99/month ($120/year) for swell data that comes from government buoys.

Surfline's cameras are worth something -- I get it. If you need to watch a live cam before driving to the beach, Surfline has that and MySurf doesn't.

But if you want swell height, period, direction, wind speed, and tide charts for California spots? That data comes from NOAA and NDBC buoys. It's public. Surfline packages it nicely and charges $120/year.

MySurf packages the same data, adds AI-generated forecast narratives that explain what the conditions mean in plain English, and covers 200+ California spots. $2. One time.

No cameras. No social features. No $120/year. Just the data you need to decide whether to paddle out.

Part of a bigger app called MyLife (20+ modules, $20 for everything), but MySurf works on its own for $2.

Honest question for this sub: what do you actually use from Surfline Premium that a data-focused forecast app can't provide? Trying to understand which features matter most beyond cameras.

---

### r/fitness - "Looking for a workout tracker that doesn't want to be a social network"

**Title:** Every workout tracker wants to be a social network. I just want to log my lifts privately.

**Body:**

Strava has a feed. Hevy has a social tab. Fitbod tracks your data in the cloud. Every workout app wants you to share, follow, compete, and build a profile.

I just want to write down what I did in the gym.

MyWorkouts is a workout logger that tracks exercises, sets, reps, and weight. View progress over time. Build custom routines. That's it. No social feed. No activity sharing. No leaderboards.

All data stored locally on your device. No account. No cloud. Your body measurements and workout history are nobody's business.

$2 one-time (not $80/year like Strava or $156/year like Fitbod).

It's part of a bigger app called MyLife, but works as a standalone module. Still early-stage, so if there are features you'd consider essential in a workout logger, I'm interested in what those are.

---

## Instagram Captions (5)

### Post 1 - The Savings Visual
(Image: Side-by-side comparison. Left: stack of app icons with prices. Right: single MyLife icon, $20)

You're looking at $861/year on the left.

And $20 on the right. One time.

Same apps. Different model. Every byte of data stays on your device.

20 apps. $20. Once.

#MyLife #AppSubscriptions #PrivacyFirst #DigitalMinimalism #OneTimePurchase #NoSubscription #PrivacyMatters #TechThatRespectsYou #BudgetLife #AppAlternative

---

### Post 2 - The Privacy Statement
(Image: Phone screen with lock icon. Text overlay: "Your data lives here. Nowhere else.")

Your budget numbers.
Your workout logs.
Your reading list.
Your fasting records.
Your mood diary.
Your medication schedule.
Your cycle data.

All of it. On your phone. Nowhere else.

No server. No account. No cloud. No breach possible.

That's not a feature. That's the architecture.

#PrivacyFirst #DataPrivacy #LocalFirst #NoCloud #MyLife #DigitalPrivacy #AppSecurity #YourDataYourDevice #PrivacyMatters #TechEthics

---

### Post 3 - Module Grid
(Image: Grid of 20 module icons with names)

One app. Twenty modules. Your choice.

Enable what you need. Disable what you don't. Each module is a full-featured app that runs entirely on your device.

Fasting (free), budgeting, books, workouts, surf, recipes, habits, car, meditation, sleep, calories, mood, cycle tracking, meds, trails, words, flashcards, journal, notes, and voice transcription.

$2 per module. Or $20 for everything.

#MyLife #AppHub #AllInOne #PrivacyFirst #ModularApp #PersonalApps #OneApp #DigitalLife #AppOrganization #TechSimplified

---

### Post 4 - The Dead Apps Memorial
(Image: Tombstone-style graphic with RIP dates for dead apps)

RIP Mint (2007-2024)
RIP Yummly (2010-2024)
RIP MagicSeaweed (2001-2023)
RIP Evernote staff (laid off post-acquisition)
RIP Dictionary.com accounts (deleted 2025)

When your app lives on someone else's server, they decide when it dies.

MyLife runs on your device. We can't shut down your data.

#AppGraveyard #DigitalOwnership #PrivacyFirst #MyLife #LocalFirst #OwnYourData #TechHistory #AppShutdowns #DataOwnership #DigitalRights

---

### Post 5 - The Free Module
(Image: MyFast interface screenshot with "Always Free" badge)

MyFast is a fasting timer.

Actually free. Not "free trial" free. Not "free with ads" free. Not "free for 14 days then $70/year" free.

Free. Forever. No account. No catch.

Zero charges $70/yr. Simple charges $30-60/yr.

MyFast is free because it's the first thing you try in MyLife. And when you like it, the other 19 modules are waiting.

#IntermittentFasting #FastingTimer #FreeFastingApp #MyFast #MyLife #IF168 #HealthApp #NoSubscription #FreeApp #FastingTracker

---

## LinkedIn Posts (3)

### Post 1 - The Founder Story

The average American pays $219/month in subscriptions. 42% have forgotten about at least one they're still paying for.

I was one of those people.

Last year I added up every personal app I subscribe to. Budget tracker. Workout logger. Fasting timer. Meditation app. Book tracker. Surf forecast. Habit tracker. Calorie counter. The total was over $800/year.

Each app wanted my data on their server and my credit card on file monthly. Each one had a different account, a different password, a different privacy policy.

I'm a software engineer. So I built the alternative.

MyLife is a single app with 20+ modules inside. Budget, workouts, fasting, meditation, books, surf, habits, recipes, and more. All data stored locally on your device. No cloud. No accounts. No recurring charges.

$2 per module. $20 for everything. One-time.

The business model is simple: we don't run servers, so we don't need recurring revenue to pay for them. The marginal cost of an additional user is effectively zero. One-time pricing works because the architecture demands it.

Early response has been validating. Users are reporting $400-800+ in annual savings from consolidating their app subscriptions.

If you're curious about the local-first approach or the economics of one-time pricing: happy to discuss. This is a space where I think the incentives between developer and user are finally aligned.

---

### Post 2 - The Privacy Architecture (Technical Angle)

An interesting technical decision: building 20+ consumer apps with zero server infrastructure.

MyLife stores all user data in a single SQLite database on the user's device. No backend. No cloud sync (by default). No accounts. No authentication flow. No database to manage. No servers to scale.

The result:
- $0/month infrastructure cost per user
- Zero data breaches possible (no data to breach)
- Zero GDPR/CCPA compliance burden (no data processing)
- One-time purchase pricing ($2-20) because there's no ongoing cost to cover

The trade-off: no cross-device sync (by default), no collaborative features, no "forgot my password" recovery. For personal tracking apps (budget, workouts, books, habits), this trade-off is worth it.

The business model this enables is unusual: one-time pricing in a market where $5-15/month subscriptions are standard. YNAB charges $109/year. Surfline charges $120/year. Calm charges $70/year.

MyLife replaces all of them for $20. Once.

We make this work because our costs are fundamentally different. No server costs, no Plaid API fees, no data engineering team, no cloud infrastructure. The economics of local-first software are compelling when you don't need a backend.

Building consumer software without servers is a design constraint that leads to better products. You build for the user, not for the dashboard.

---

### Post 3 - The Market Opportunity

A data point that surprised me: the combined TAM across 20+ personal app categories exceeds $150 billion.

Budget apps ($10-30B), fitness apps ($10.6B), cycle tracking ($1.69B apps, $39B femtech), meditation ($2.25B), calorie counting ($6.13B), habit tracking ($1.7-13B), and 15 more categories.

Each one is dominated by subscription-model companies. YNAB ($109/yr, est. $49M ARR). Surfline ($120/yr, est. $29M). Calm ($70/yr, $150M revenue). Strava ($80/yr, approaching $500M ARR, filing for $2-3B IPO).

The common thread: subscription fatigue is real and growing. 6% growth in one-time purchase preference in 2025. Consumers are tired of renting software.

We built MyLife as a one-time purchase alternative. 20+ modules. $20 total. All on-device.

Proven models exist: Anki iOS generates ~$10.8M/year from a single $25 one-time purchase. Streaks won an Apple Design Award at $4.99. Obsidian built a $2M+ business with zero VC.

The question isn't whether local-first, one-time purchase apps can work. It's whether one app can consolidate 20+ categories the way DraftKings consolidated sports betting and Polymarket consolidated prediction markets.

We're betting it can. Early indicators are positive.

---

## Product Hunt "Maker" Comments (2)

### Comment 1 - The Story Behind MyLife

Hey everyone,

I built MyLife because I got tired of being a product.

I had 10+ app subscriptions totaling over $800/year. Each one wanted my data on their servers, my credit card on monthly autopay, and my attention trapped in their ecosystem.

So I built the alternative: one app, 20+ modules, everything stored locally on your device. $2 per module, $20 for the whole suite. One time.

The key insight: these apps don't need servers. Your budget numbers, workout logs, reading list, and fasting streaks don't need to live in someone's cloud. They need to live on your phone.

By eliminating servers, I eliminated recurring costs. By eliminating recurring costs, I could offer one-time pricing. By offering one-time pricing, the product becomes its own marketing ("wait, $20 for 20 apps? forever?").

The free module (MyFast, a fasting timer) is the entry point. Try it, use it, see the quality. When you're ready, the other 19 modules are there.

Would love feedback on which modules interest you most and what's missing from the lineup.

---

### Comment 2 - The Privacy Angle

A few people have asked about the privacy claims, and I want to address that head-on.

MyLife doesn't have a privacy policy because it doesn't need one. There's no data to write a policy about.

The app uses SQLite, a local database that runs on your device. There is no server. No API calls home. No analytics SDK. No account system.

I can't tell you how many users MyLife has, because I genuinely don't know. I don't track installs, I don't track opens, I don't track anything. The App Store tells me purchase numbers, but I don't know who those people are or what they're tracking.

This isn't philosophical. It's architectural. The system was designed so that user data physically cannot reach us.

Some have asked: "How do you sustain a business without recurring revenue?"

Same way Anki does ($10.8M/year from a $25 one-time purchase). Same way Streaks does. Same way Obsidian does. Build a great product, sell it once, keep building.

The server costs that force other apps into subscription pricing don't exist here. No servers = no recurring cost = no need for recurring revenue.

Happy to answer any questions about the technical approach or the business model.
