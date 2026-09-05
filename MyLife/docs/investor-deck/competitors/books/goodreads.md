# Goodreads — Deep Dive (vs MyBooks)

**Module:** books
**Tier:** direct
**Founded:** 2007
**HQ:** San Francisco, USA
**Status:** acquired (Amazon, 2013)

## One-line
The world's largest book-discovery social network, owned and neglected by Amazon; default for reading lists, reviews, and the Reading Challenge.

## Product
- Book shelves (Read, Currently Reading, Want to Read)
- Ratings and reviews, friend activity feed, groups, lists
- Annual Reading Challenge (count-of-books goal)
- Barcode scanner, Amazon/Kindle deep-link purchase rails
- Platforms: iOS, Android, Web (no desktop reader)
- Pricing: free, ad-supported
- Distinguishing UX choice: the Reading Challenge and the social graph of "friends"

## Financials (public-source only)
| Year | Revenue | ARR | Valuation | Source |
|------|---------|-----|-----------|--------|
| 2023 | N/D (bundled in Amazon) | N/D | N/A | Amazon 10-K does not break out |
| 2024 | N/D (bundled) | N/D | N/A | Amazon 10-K |
| 2025 | N/D (bundled) | N/D | N/A | Amazon 10-K |

**Revenue mix:** ads 100% (display + Amazon/Kindle referral). No subscription tier.
**Profit / burn:** N/D; estimated marginal cost center for Amazon given stagnant product investment.
**Runway:** N/A.

## Cap Table (best public reconstruction)
| Round | Date | Amount | Lead | Post-money | Ownership notes |
|-------|------|--------|------|------------|-----------------|
| Seed | 2007 | $0.75M | True Ventures | N/D | Otis Chandler + Elizabeth Khuri Chandler founders |
| Series A | 2009 | $2M | True Ventures | N/D | Extension round |
| Series B | 2012 | $2.75M (est.) | True Ventures | ~$20M est. | Pre-acquisition |
| Acquisition | Mar 2013 | ~$150M est. | Amazon | N/A | Amazon absorbs 100% |

Founders: Otis Chandler (CEO, exited 2018). Institutional holder: Amazon (100%).
Sources: Crunchbase, TechCrunch (2013), Reuters acquisition coverage.

## Funding History (round by round)
| Year | Stage | Amount | Lead investor | Other investors | Post-money valuation | Source |
|------|-------|--------|---------------|-----------------|---------------------|--------|
| 2007 | Seed | $0.75M | True Ventures | angels | N/D | Crunchbase |
| 2009 | Series A | $2M | True Ventures | — | N/D | Crunchbase |
| 2012 | Series B | ~$2.75M est. | True Ventures | — | ~$20M est. | TechCrunch |
| 2013 | Acquisition | ~$150M est. | Amazon | — | N/A | TechCrunch 2013-03-28 |

Total raised pre-acquisition: ~$5.5M
Current stage: Acquired (Amazon, 2013)

## Timeline to Success
| Year | Milestone | Signal |
|------|-----------|--------|
| 2007 | Founded by Otis Chandler and Elizabeth Khuri Chandler in San Francisco | bootstrapped launch |
| 2008 | 650K members | viral word-of-mouth via book-club niche |
| 2011 | 5M members, introduced Reading Challenge | category-defining feature |
| 2013 | Acquired by Amazon for ~$150M | exit at ~20M members |
| 2018 | Founder Otis Chandler exits Amazon | product stagnation confirmed |
| 2023 | 150M+ registered members disclosed | dominant but unloved |
| 2026 | Still default reading tracker, poor product investment | moat = data + inertia |

## Acquisition / Exit
- Acquired by: Amazon (AMZN)
- Date: 2013-03
- Price: ~$150M estimated (undisclosed; cash)
- Current status inside parent: absorbed, standalone brand with minimal investment
- Strategic rationale: defensive Kindle moat + review/recommendation data + blocking Barnes & Noble
- Founder outcome: Otis Chandler stayed through 2018, then departed; no public earn-out terms

## Users
- MAU: est. 125M+ logged-in site visits; 150M+ registered members (company statements, 2023)
- DAU: N/D
- Geography: US 45-55%, UK + Canada + Australia heavy; limited non-English presence
- Conversion rate: N/A (free only)

## How they make money (precise)
1. **Display ads** on book pages and reviews sold via Amazon's ad stack.
2. **Kindle/Amazon referral** funnel from "Get a Copy" CTAs back to Amazon.com.
3. **Author paid programs** (Giveaways moved behind paywall in 2018; Ads for Authors still active).

Unit economics: negligible incremental hosting cost per user; ad RPM estimated <$5 per 1,000 pageviews given the low-density layout. Primary strategic value to Amazon is Kindle affinity and review data moat.

## Wedge MyLife can exploit
- **Stagnant product**: no native reader, no ePub annotations, clunky mobile UX since 2013. MyBooks ships a full ePub/PDF reader inside the library.
- **Data-exhaust model**: every shelf and review feeds Amazon's recommendation engine. MyBooks keeps shelves private and offers Goodreads CSV import, one-click exit.
- **No pace tracking or mood data**: MyBooks ships session timers, peak-hour insights, genre evolution.
- **Stale social layer**: the feed is a graveyard. MyBooks connected book clubs and community challenges replace a broken social graph with small private circles.

## Logo
`../assets/logos/goodreads.png` — Wikimedia Commons, Goodreads_logo_2025.svg rendered at 500px. Public logo, used as identifier for commentary/criticism.

## Logo Source
- URL: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Goodreads_logo_2025.svg/500px-Goodreads_logo_2025.svg.png`
- License: Wikimedia Commons — PD-textlogo / trademark owner retains rights; used for identification.

## Sources
- https://en.wikipedia.org/wiki/Goodreads
- https://techcrunch.com/2013/03/28/amazon-acquires-social-reading-site-goodreads/
- https://www.crunchbase.com/organization/goodreads
- https://www.amazon.com/gp/help/customer/display.html?nodeId=201929030 (Goodreads ad terms)
