# MyBooks

**Your reading list. Not Amazon's ad profile.**

A private, local-first book tracking app for iOS, Android, and web. Your reading habits stay on your device — not in Amazon's advertising pipeline.

## Why MyBooks

Goodreads has 150 million users and hasn't meaningfully updated since Amazon acquired it in 2013. Every book you shelve, rate, and review feeds Amazon's ad profile. Your reading history is cross-referenced with your purchases, browsing, and Alexa interactions.

The alternatives aren't much better. StoryGraph charges $49.99/year. Hardcover makes your reading public by default. Bookly limits you to 10 books on free tier. Apple Books only tracks Apple purchases.

**MyBooks eliminates the trade-off.** Beautiful book tracking. Zero data harvesting. $4.99 once, forever.

## Features

- **Personal library** — Add books via search, barcode scan, or manual entry
- **Smart shelves** — Want to Read, Currently Reading, Finished, plus custom shelves
- **Half-star ratings** — 0.5 to 5.0 in half-star increments (the #1 Goodreads complaint, fixed)
- **Private reviews & notes** — Write honest thoughts. They never leave your device.
- **Barcode scanning** — Point your camera at any ISBN barcode to instantly add a book
- **Reading stats & goals** — Annual goals, monthly charts, rating distribution, pace tracking
- **Year-in-review** — Beautiful summary cards of your reading year
- **Import from Goodreads/StoryGraph** — Bring your existing library. One-time import, no ongoing connection.
- **Export to CSV/JSON/Markdown** — Your data in open formats. No lock-in.
- **Tags** — Organize books your way with custom labels
- **Offline-first** — Browse your library, write reviews, track progress — all without internet

## Privacy

```
Goodreads: You rate a book -> Amazon ad profile updated ->
           personalized ads across Amazon, Kindle, Alexa,
           Fire TV, Ring, Twitch, Whole Foods app

MyBooks:   You rate a book -> written to local SQLite ->
           visible to you and nobody else. Ever.
```

- All data stored locally in SQLite on your device
- The ONLY network traffic is to Open Library (Internet Archive, a non-profit)
- No accounts, no sign-up, no email required
- No analytics SDK, no crash reporting, no ad SDK, no telemetry
- No Amazon API calls, no tracking pixels, no affiliate links
- Source-available (FSL license) so you can verify every claim
- Your reading history physically cannot leave the device

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo (React Native) — iOS + Android |
| Web | Next.js 15 |
| Database | SQLite (local, on-device) |
| Book Data | Open Library API (Internet Archive) |
| Monorepo | Turborepo + pnpm |
| Language | TypeScript |
| Testing | Vitest |

## Setup

```bash
# Prerequisites: Node >= 20, pnpm >= 9.15

# Clone and install
git clone https://github.com/mystar-llc/mybooks.git
cd mybooks
pnpm install

# Development
pnpm dev           # All apps
pnpm dev:mobile    # Mobile only (Expo)
pnpm dev:web       # Web only (Next.js)

# Build
pnpm build

# Test
pnpm test
```

## Pricing

**$4.99 one-time.** All features. Forever.

No subscriptions. No ads. No "premium tier." The price of a paperback for a lifetime of book tracking.

| App | Price | You Pay After 2 Years |
|-----|-------|-----------------------|
| StoryGraph Plus | $49.99/yr | $99.98 |
| Bookly Pro | $19.99/6mo | $79.96 |
| **MyBooks** | **$4.99 once** | **$4.99** |

## Powered By

Book metadata provided by [Open Library](https://openlibrary.org) — a project of the [Internet Archive](https://archive.org), a non-profit dedicated to universal access to knowledge. 30M+ titles indexed. No Amazon. No tracking. Open data.

## License

[FSL-1.1-Apache-2.0](https://fsl.software) — Functional Source License. Source-available today, Apache 2.0 after 2 years. You can read every line of code. Trust, but verify.
