# MyLife Top 20 Competitor Ring

Date: 2026-04-20

## Summary

This pack is the first curated set of replacement-brand logos for a future homepage logo ring.

I reviewed:

- live module definitions in `modules/*/src/definition.ts`
- future-module mission-control HTML docs in `docs/plans/`
- existing module competitor writeups in `docs/competitor-analysis/`
- compiled market research in `docs/business-plan/BUSINESS-PLAN-MyLife-2026.md`
- compiled competitor metrics in `docs/business-plan/competitor-financials-2024-2026.md`
- current official and public sources where useful to confirm scale signals

Selection bias was intentional:

- prioritize brands that are highly recognizable on a marketing page
- keep broad coverage across both shipped and planned MyLife modules
- prefer compact marks that can survive a circular ring treatment
- use official brand assets when easy, otherwise use clean `simpleicons` vectors

Asset folder:

- `apps/web/public/marketing/replace-ring/logos/`

Manifest:

- `apps/web/public/marketing/replace-ring/manifest.json`

## Top 20

| Rank | Competitor | MyLife module | Why it made the cut | Asset |
|------|------------|---------------|---------------------|-------|
| 1 | Goodreads | `books` | Still the clearest mainstream reading-tracker replacement target. Repo research tracks Goodreads at 150M+ members. | `goodreads.svg` |
| 2 | YNAB | `budget` | The repo repeatedly treats YNAB as the gold-standard envelope-budget competitor. | `ynab.svg` |
| 3 | Notion | `notes` | Notion passed 100M users in 2024 and remains the most recognizable all-in-one notes/workspace brand. | `notion.svg` |
| 4 | Obsidian | `notes` | Obsidian matters because MyNotes is explicitly privacy and local-first. It is the closest brand-adjacent comparison. | `obsidian.svg` |
| 5 | MyFitnessPal | `nutrition` | Category leader in repo research with 220M registered users and broad mainstream recognition. | `myfitnesspal.svg` |
| 6 | Strava | `workouts` | Official Strava material now cites 180M+ athletes. Strong brand recognition beyond runners and cyclists. | `strava.svg` |
| 7 | Flo | `cycle` | Repo research and Flo’s own materials keep it among the strongest cycle-tracking incumbents. | `flo.png` |
| 8 | Quizlet | `flash` | Quizlet still reports 60M+ monthly active users and is the most recognizable flashcard/study app. | `quizlet.svg` |
| 9 | Day One | `journal` | Day One remains the most recognizable premium journaling brand and the clearest MyJournal comparison. | `dayone.svg` |
| 10 | Daylio | `mood` | The strongest lightweight mood-tracker brand in repo research, with large install scale and clear consumer recognition. | `daylio.png` |
| 11 | Medisafe | `meds` | Still the best-known medication-reminder app in the repo’s research layer. | `medisafe.png` |
| 12 | AllTrails | `trails` | AllTrails now presents itself as a 90M+ person community and remains the default hiking-trails comparison. | `alltrails.svg` |
| 13 | Surfline | `surf` | Still the dominant surf-forecast brand and the clearest MySurf replacement logo to show. | `surfline.png` |
| 14 | Otter.ai | `voice` | Repo competitor-financials tracks Otter at 35M+ users and $100M ARR. High recognition in voice transcription. | `otterai.png` |
| 15 | Spotify | `music` | Official Spotify earnings report Q4 2025 reached 751M MAU. It is the obvious future MyMusic comparison. | `spotify.svg` |
| 16 | Letterboxd | `watch` | The clearest future MyWatch replacement brand for film logging and personal watch history. | `letterboxd.svg` |
| 17 | Venmo | `payments` | One of the strongest consumer payment brands in the U.S. and the most useful future MyPay signal. | `venmo.svg` |
| 18 | Zillow | `homes` | Zillow remains the dominant real-estate consumer brand with massive traffic and recognition. | `zillow.svg` |
| 19 | Reddit | `forums` | Reddit is the strongest public-forums reference point by a wide margin and maps cleanly to MyForums. | `reddit.svg` |
| 20 | Eventbrite | `rsvp` | Chosen over Partiful and Evite on scale. Repo research tracks Eventbrite at 87M MAU. | `eventbrite.png` |

## Near Misses

- Hevy: more direct gym-tracker comparison than Strava, but weaker mainstream recognition.
- Facebook Marketplace: very strong future `market` logo candidate, but I kept the first pack tighter around brands that map cleanly to a single product identity.
- Partiful: more design-adjacent than Eventbrite for future `rsvp`, but smaller on scale.
- Paprika: strong `recipes` candidate, but meaningfully less mainstream than the final 20.
- StoryGraph: important `books` alternative, but Goodreads still dominates recognition.

## Current Source Checks

These were the most useful current checks outside the repo’s own research docs:

- Goodreads: `https://www.goodreads.com/about/us`
- Notion 100M users: `https://www.notion.com/blog/100-million-of-you`
- Quizlet scale: `https://quizlet.com/ads/Audiences`
- Flo user base: `https://flo.health/newsroom/flo-launches-anonymous-mode`
- AllTrails community scale: `https://www.alltrails.com/press`
- Strava scale: `https://press.strava.com/about`
- Spotify Q4 2025 MAU: `https://newsroom.spotify.com/2026-02-10/spotify-q4-2025-earnings/`
- Reddit current audience: `https://investor.redditinc.com/overview/`
- Zillow traffic: `https://investors.zillowgroup.com/files/doc_earnings/2025/q3/presentation/Zillow-3Q25-Shareholders-Letter.pdf`
- Venmo current commerce update: `https://newsroom.paypal-corp.com/2025-06-04-Venmo-Unleashes-Next-Phase-of-Commerce-with-the-Venmo-Debit-Card-and-Venmo-Checkout`

## Notes

- This is not a one-per-module parity matrix.
- This is a marketing-first top-20 pack.
- If the next step is implementation, build the ring off `manifest.json` so swapping in alternates is trivial.
