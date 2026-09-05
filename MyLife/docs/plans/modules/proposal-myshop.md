# Module Proposal: MyShop

**Status:** Proposal - awaiting founder review
**Module ID candidate:** `shop`
**Table prefix:** `sh_`
**Tier:** Pro (premium)
**Target module number:** #41
**Date:** 2026-04-20
**Demographic pull:** Universal (ages 14-70), strongest 16-45

---

## Executive Summary

Your wishlist is scattered across 15 websites. Your purchase history is owned by Amazon. Your size preferences are re-entered on every site. Your warranty info is buried in email. No single tool gives you a private, unified view of what you want to buy, what you've bought, what's worth returning, and what warranties you need to track.

MyShop is a private shopping memory: universal wishlists across all categories, purchase journal with receipts, size/preference memory, gift shopping, warranty/return tracking, and spending awareness -- without Amazon/Google owning your shopping intent data.

**Positioning sentence:** *Amazon knows what you bought. MyShop remembers what was worth it.*

---

## Why This Module

1. **Wishlists are scattered everywhere.** Amazon, Target, Apple, Etsy, random bookmarks. No unified private wishlist exists.
2. **Purchase regret is universal.** No tool helps you reflect on whether purchases were worth it (buyer satisfaction over time).
3. **Shopping intent data is the most valuable data on the internet.** Google and Amazon pay billions for it. A private tool that keeps this data local is a strong privacy statement.
4. **Warranty/return tracking saves real money.** Most people lose track of return windows and warranty expiry.
5. **Cross-module integration.** Budget (spending), friends (gift ideas from their profiles), closet (clothing purchases), gaming (game purchases), music (vinyl/merch purchases).
6. **Universal demographic.** Everyone shops. Teens tracking wishlists, adults tracking warranties, parents tracking gift lists.

---

## Full Feature Set

### Core: Universal Wishlist

- **Add anything:** Name, category, price (or range), priority, where to buy, link
- **Categories:** Tech, clothing, books, home, kitchen, gaming, music, sports, gifts, hobby, other
- **Priority levels:** Need soon, want, someday, dream (aspirational)
- **Price tracking notes:** "Usually $50, wait for sale" or "price dropped from $80 to $60"
- **Multiple wishlists:** "Birthday wishes," "Home upgrade," "Tech next-up," "Gift ideas for others"
- **Occasion tagging:** "Christmas wishlist," "Back to school," "New apartment"
- **Photo/screenshot:** Save product images for reference
- **Link to product:** URL for quick access when ready to buy
- **Notes:** "Size M, color navy, the version with USB-C"
- **Purchased flag:** Mark items as bought (moves to purchase log)
- **Share as gift list:** Generate shareable link for birthday/holiday (opt-in)

### Core: Purchase Journal

- **Log purchases:** Item, price, date, where bought, category
- **Receipt capture:** Photo of receipt stored locally (links to receipts functionality)
- **Payment method:** Credit card, cash, gift card, financing (for tracking)
- **Was it worth it?** Satisfaction rating at purchase, then revisit after 30/90 days
- **Return deadline:** Auto-calculated from purchase date + store policy
- **Cost per use:** For repeated-use items, track how often you use it (cost divided by uses)
- **Impulse vs planned:** Tag whether this was impulsive or deliberate
- **Research notes:** What you compared it against, why you chose this one
- **Unboxing/setup notes:** First impressions, setup instructions you'll forget

### Core: Size & Preference Memory

- **Clothing sizes:** Store sizes per brand (Nike M =/= Zara M =/= Uniqlo M)
- **Shoe sizes:** Per brand/style
- **Ring size:** Yours and gift recipients
- **Tech preferences:** "I like 13-inch laptops," "prefer USB-C," "need 256GB minimum"
- **Household measurements:** Window dimensions, bed size, desk dimensions
- **Color preferences:** "I always buy navy/gray/black" -- helps with gift-givers
- **Brand preferences:** Brands you trust, brands you avoid (and why)
- **Allergy/material notes:** "Allergic to nickel," "wool irritates skin"

### Core: Warranty & Return Tracker

- **Warranty log:** Item, purchase date, warranty expiry, coverage details
- **Extended warranty:** If purchased, log separately
- **Return windows:** Track return deadlines with reminders (3 days before expiry)
- **AppleCare / protection plans:** Expiry tracking with renewal reminders
- **Manufacturer registration:** Track registered products
- **Serial numbers:** Store for insurance/warranty claims
- **Receipt archive:** Linked receipt photos for proof of purchase
- **Warranty claims log:** If you made a claim, track status

### Core: Gift Shopping

- **Gift lists per person:** What to buy for each person (links to Friends module)
- **Occasion tracking:** Birthday, holiday, graduation, housewarming, thank-you
- **Budget per person:** Spending target per gift recipient
- **Past gifts given:** History of what you gave (avoid repeats)
- **Gift ideas saved:** When you see something perfect for someone, quick-save
- **Group gift coordination:** Split cost with others, track who paid
- **Wrapping/shipping notes:** "Ships direct" or "Need to wrap"

### Advanced: Spending Awareness

- **Monthly purchase summary:** What you bought this month, total spend
- **Category breakdown:** Where is your money going? (not full budgeting -- that's Budget module)
- **Impulse spending tracker:** Flag and review impulse purchases
- **"Cost of ownership" view:** Total spent on a hobby/category over time
- **Sale vs full-price ratio:** How often are you buying on sale?
- **Subscription vs purchase analysis:** When subscribing costs more than buying outright
- **30-day rule log:** Items you're waiting 30 days before buying (impulse control)

### Advanced: Research & Comparison

- **Product comparison notes:** Save pros/cons lists for products you're considering
- **Review notes:** Key points from reviews you read
- **"Why I chose X over Y":** Decision journal for expensive purchases
- **Deal tracking notes:** "Black Friday usually drops to $X"
- **Store loyalty notes:** Which stores give best returns policy, fastest shipping, etc.

### Advanced: Year-in-Review

- **Annual shopping summary:** Total spent, categories, best purchases, worst purchases
- **Satisfaction scores:** Did your 5-star purchases actually hold up over time?
- **Gift giving summary:** People gifted, total gift spend, best reactions
- **Warranty utilization:** Warranties that saved you money vs paid for nothing
- **Wishlist conversion:** What percentage of wishlisted items did you actually buy?
- **Impulse audit:** Impulse purchase regret rate

---

## Data Model

```
sh_wishlist_items
  id, list_id, name, category, description_md,
  price_cents, price_range_low, price_range_high,
  priority (need|want|someday|dream),
  url, photo_id, store, brand,
  occasion_tag, notes_md, size_notes,
  is_purchased, purchased_at, purchase_id,
  is_gift_for (person_id nullable),
  created_at, updated_at

sh_wishlists
  id, name, description, occasion, person_id (nullable for gift lists),
  is_shareable, share_token, created_at, updated_at

sh_purchases
  id, name, category, price_cents, purchase_date,
  store, payment_method, brand, url,
  receipt_photo_id, satisfaction_initial (1-5),
  satisfaction_30day, satisfaction_90day,
  is_impulse, research_notes_md,
  return_deadline, returned (bool), return_reason,
  wishlist_item_id (nullable),
  notes_md, photo_id, created_at, updated_at

sh_warranties
  id, purchase_id, item_name, coverage_type (manufacturer|extended|protection),
  start_date, expiry_date, coverage_details_md,
  serial_number, registration_number,
  claim_filed (bool), claim_notes,
  reminder_days_before, created_at, updated_at

sh_sizes
  id, type (clothing|shoe|ring|other), brand,
  size_value, fit_notes, last_verified, created_at

sh_preferences
  id, category, key, value, notes, created_at

sh_gifts_given
  id, person_id, item_description, occasion,
  purchase_id (nullable), amount_cents, date,
  reaction_notes, photo_id, created_at

sh_comparisons
  id, category, items (json array of {name, pros, cons, price, rating}),
  winner, reasoning_md, decided_at, created_at

sh_photos
  id, purchase_id, wishlist_item_id, warranty_id,
  kind (product|receipt|unboxing|comparison),
  local_uri, caption, created_at

sh_settings
  key, value
```

---

## Phase Plan

| Phase | Scope | Weeks |
|-------|-------|-------|
| P0 | Foundation: scaffold, schema, definition, empty hub screens | 1-2 |
| P1 | Wishlist: items, lists, priority, links, photos, share | 2-3 |
| P2 | Purchase journal: log, receipts, satisfaction tracking | 2 |
| P3 | Warranty + return tracker: deadlines, reminders, serial numbers | 1-2 |
| P4 | Size + preference memory | 1 |
| P5 | Gift shopping: per-person lists, past gifts, budget, coordination | 2 |
| P6 | Spending awareness: summaries, impulse tracking, 30-day rule | 1-2 |
| P7 | Research + comparisons + year-in-review | 1-2 |
| P8 | Cross-module (budget, friends, closet, gaming, music) | 2 |
| **Total P0-P8** | | **~14-18 weeks** |

---

## Cross-Module Integration Map

| Module | Integration |
|--------|-------------|
| **Budget** | Purchase spending feeds budget categories, monthly spend awareness |
| **Friends** | Gift ideas per person, gift giving history, size memory for friends |
| **Closet** | Clothing purchases tracked, size memory shared |
| **Gaming** | Game wishlist and purchase tracking |
| **Music** | Vinyl/merch wishlist and purchases |
| **Dining** | Gift cards, restaurant merch |
| **Home** (if exists) | Home improvement purchases, appliance warranties |
| **Car** | Auto part purchases, maintenance supply tracking |
| **Pets** | Pet supply purchases, vet product tracking |

---

## Business Flywheel (Future)

### Local Shop Discovery (Year 3+)

**Concept:** Local indie shops pay for visibility to nearby MyLife users who have relevant items on their wishlists. NOT ads -- opt-in "this local shop carries what you're looking for" notifications.

**Privacy model:** User's wishlist never leaves device. Local shops post their inventory categories (not individual items). Matching happens on-device. Shop never sees the user's wishlist. User sees "Local shop X carries [category] items."

**Revenue:** $9/mo per local shop for inclusion in the matching network.

This is speculative and far-future. The consumer module stands alone without it.

---

## Competitor Analysis

| Tool | What It Does | Why It Falls Short |
|------|-------------|-------------------|
| Amazon wishlist | Shopping wishlist | Amazon-only, public-default, feeds their recommendation algorithm |
| Google Shopping | Price tracking | Google owns your intent data, cross-sells ads |
| Honey/PayPal | Price alerts | Tracks ALL your browsing, recently exposed for selling data |
| Warranty Life | Warranty tracking | Single feature, subscription, limited |
| Notion/Sheets | Manual lists | Generic, no shopping-specific features |
| Flipp | Deal finding | Ad-supported, retail-focused |
| ShopSavvy | Barcode scanner | Defunct model, ad-supported |
| Earny | Price drop refunds | Requires full purchase history access |

**Gap:** No privacy-first tool combines wishlists + purchase journal + warranty tracker + size memory + gift shopping + spending awareness.

---

## Open Questions (Founder Input Needed)

1. **Module accent color?** Suggestions: Shopping bag green #10B981, retail purple #7C3AED, receipt blue #3B82F6
2. **Receipt scanning?** On-device OCR to extract purchase details from receipt photos? Recommend: yes (P2+), using on-device ML. No cloud processing.
3. **Price alert mechanism?** We can't scrape prices. Options: (A) Manual "check price" reminders, (B) Deep-link to price tracking sites, (C) None. Recommend A.
4. **Gift list sharing format?** Public link (anonymous), or requires MyLife account to view? Recommend: public link, no account required, no tracking on the viewer.
5. **Free or Pro?** Basic wishlist (10 items, 1 list) could be free. Full = Pro. Recommend: Pro entirely. Wishlist is a compelling enough feature that it justifies the subscription.
6. **Overlap with Budget module:** Keep spending awareness light here (shopping-focused), or remove it entirely and link to Budget? Recommend: keep light version (it's purchase-reflection, not budgeting).
7. **Barcode/QR scanning?** Scan a product in-store to quick-add to wishlist? Recommend: research feasibility. On-device barcode decoding is easy; product lookup requires a database (UPC lookup APIs exist but add dependency).
