# MyCloset -- UI/UX Design Prompts

**Tagline:** Dress intentionally, waste nothing
**Icon:** 👔 | **Accent:** #EC4899 | **Tier:** Premium
**Bottom Tabs (mobile):** Home | Wardrobe | Outfits | Laundry | Settings
**Total Screens:** 14 mobile + 5 web = 19

---

## Prompt 1: Mobile Screens 1--12

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyCloset
Accent color: #EC4899
Icon: 👔
Bottom tabs: Home | Wardrobe | Outfits | Laundry | Settings

Design 12 mobile screens for a wardrobe management app. Each screen should use the Cool Obsidian dark theme with glass morphism cards, #EC4899 accent color, and smooth rounded corners.

1. HOME (index.tsx)
   - Greeting with date
   - Stats row (glass cards): total items count, outfit count, wardrobe value ($), 30-day wears logged
   - Donation candidates badge (count of items unworn past threshold)
   - Quick action buttons row: Add Item, Create Outfit, Laundry, Packing
   - Recent activity feed: last 3 items added or worn
   - Bottom tab bar: Home (active), Wardrobe, Outfits, Laundry, Settings

2. WARDROBE (wardrobe.tsx)
   - Search bar at top
   - Filter chips row: All | Tops | Bottoms | Dresses | Outerwear | Shoes | Accessories
   - Secondary filter: color picker dots, season tags (Spring/Summer/Fall/Winter)
   - Sort dropdown: Recently Added | Most Worn | Least Worn | Price High-Low
   - Clothing inventory grid (2 columns): photo thumbnail, item name, category label, wear count badge
   - Floating "+" add button

3. ADD ITEM (item/add.tsx)
   - Nav bar with "Cancel" and "Save"
   - Photo upload area (large, dashed border with camera icon)
   - Name (text input)
   - Category picker: Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories, Underwear, Swimwear, Activewear, Formal, Other
   - Color selector: 80+ named colors in a scrollable grid of swatches
   - Brand (text input)
   - Purchase date picker
   - Price input ($)
   - Size (text input)
   - Season picker: multi-select chips (Spring / Summer / Fall / Winter / All Season)
   - Care instructions (text area)

4. ITEM DETAIL (item/[id].tsx)
   - Full-width item photo (hero)
   - Item name as title, category + color badges below
   - Stats row: wear count, cost-per-wear ($, auto-calculated), last worn date
   - Laundry status badge: Clean (green) or Dirty (amber)
   - Wears-since-last-wash counter
   - Details section: brand, size, season, purchase date, price, care instructions
   - Action buttons: "Wear Today", "Mark Dirty/Clean", Edit, Delete (danger)

5. OUTFITS (outfits.tsx)
   - Section header "My Outfits" with outfit count
   - Filter chips: All | Casual | Work | Formal | Athletic | Date Night
   - Season filter: Spring | Summer | Fall | Winter
   - Outfit collection grid (2 columns): composite thumbnail (stacked item images), outfit name, occasion badge
   - Each card tappable
   - "Create Outfit" floating action button

6. CREATE OUTFIT (outfit/create.tsx)
   - Nav bar with "Cancel" and "Save"
   - Outfit name (text input)
   - Item picker section: scrollable wardrobe grid with multi-select checkboxes, selected items appear in a preview row at top
   - Category sub-filters to narrow item selection (Tops / Bottoms / Shoes / etc.)
   - Occasion picker: Casual, Work, Formal, Athletic, Date Night, Travel, Other
   - Season picker: multi-select chips
   - Star rating (1-5 stars)

7. OUTFIT DETAIL (outfit/[id].tsx)
   - Outfit name as title
   - Items in outfit: horizontal scrollable thumbnails, tap to view item detail
   - Occasion + season badges
   - Star rating display
   - Wear history list: dates this outfit was worn
   - "Wear Today" button (large, accent colored) -- logs wear for all items in outfit
   - Edit and Delete buttons

8. LAUNDRY (laundry.tsx)
   - Section header "Dirty Items" with count
   - Dirty items queue: item thumbnail, name, category, wears-since-wash count
   - Care instruction grouping sections: Machine Wash, Hand Wash, Dry Clean, Delicate
   - Each group collapsible with item count badge
   - Auto-dirty threshold info: "Items auto-marked dirty after N wears"
   - Bulk action: "Mark All Clean" button per group
   - Individual "Mark Clean" swipe action per item

9. PACKING LISTS (packing.tsx)
   - "New Packing List" button at top
   - Existing lists: destination name, dates, item count, completion percentage bar
   - List detail view: destination, travel dates, season auto-detected badge
   - Items organized by category (Tops / Bottoms / Shoes / Toiletries / Other)
   - Check-off toggles per item
   - "Suggest Items" button (pulls from wardrobe based on season + trip duration)
   - Pack/unpack all toggle

10. WISHLIST (wishlist.tsx)
    - "Add Item" button at top
    - Wishlist cards: item name, link (tappable URL), price ($), priority badge (Low -- gray / Medium -- yellow / High -- red)
    - Purchased toggle per item (strikethrough styling when purchased)
    - Sort: Priority | Price | Date Added
    - Total wishlist value summary
    - Swipe to delete

11. CAPSULE BUILDER (capsule.tsx)
    - Explanation header: "Build a capsule wardrobe -- select versatile core items"
    - Item selector grid (multi-select from wardrobe)
    - Selected items count and preview strip
    - Versatility score per item (based on how many outfits it appears in)
    - Gap analysis panel: missing categories highlighted (e.g., "No outerwear selected")
    - Combo estimation: "X possible outfits from Y items" (calculated from selected items)
    - "Save Capsule" button

12. COLOR ANALYSIS (colors.tsx)
    - Color distribution chart: horizontal bar chart of colors in wardrobe (sorted by count)
    - 80+ named colors mapped to items -- tap a color to see matching items
    - Color harmony pairs section: complementary color suggestions based on existing wardrobe
    - Color palette insights: "Your wardrobe is 60% neutrals, 25% cool tones, 15% warm tones"
    - Season-based color recommendations
    - Visual color wheel with owned colors highlighted
```

---

## Prompt 2: Mobile Screens 13--14 + Web Pages

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyCloset
Accent color: #EC4899
Icon: 👔

Design 2 remaining mobile screens and 4 web pages for a wardrobe management app. Use Cool Obsidian dark theme throughout.

MOBILE SCREENS:

13. DONATIONS (donations.tsx)
    - Section header "Donation Candidates" with count
    - Explanation: "Items unworn for more than [threshold] days"
    - Candidate list: item photo thumbnail, name, category, last worn date, days since last wear
    - Items sorted by longest unworn first
    - Configurable threshold: "Unworn threshold" slider or number input (default 180 days)
    - Per-item actions: "Keep" (dismiss from list), "Donate" (mark as donated, removes from wardrobe)
    - Donation history section: items previously donated with date
    - Summary: total items donated, estimated value donated

14. SETTINGS (settings.tsx)
    - Default season selector (for filtering defaults)
    - Donation threshold setting: days input (e.g., 180 days)
    - Auto-dirty threshold: wears before marking dirty (e.g., 3 wears)
    - Data management section: Export data (CSV/JSON), Import data
    - Wardrobe value display (total)
    - Clear all data (danger button with confirmation dialog)
    - About: version, support link

WEB PAGES:

15. HUB (/closet)
    - Desktop dashboard layout with sidebar navigation
    - Metrics row: total items, outfit count, wardrobe value, 30-day wears
    - Quick action cards: Add Item, Create Outfit, Laundry Queue, Packing List
    - Recent activity feed
    - Donation candidates alert (if any items over threshold)

16. WARDROBE (/closet/wardrobe)
    - Full inventory browser with desktop grid layout (3-4 columns)
    - Advanced filter sidebar: category checkboxes, color multi-select, season, brand, price range
    - Sort controls: name, wear count, cost-per-wear, date added
    - Item detail panel (click to expand in sidebar or modal)
    - Bulk actions toolbar: multi-select with "Mark Dirty", "Donate", "Delete"

17. OUTFITS (/closet/outfits)
    - Outfit management grid: composite thumbnails, names, occasion badges
    - Create outfit modal with item picker
    - Outfit detail panel: items shown, wear log, rating
    - Filter by occasion and season

18. STATS (/closet/stats)
    - Wardrobe analytics dashboard
    - Cost-per-wear leaderboard: items ranked by best value (lowest cost-per-wear)
    - Category distribution pie chart
    - Seasonal rotation status: which items are in/out of season
    - Color distribution chart
    - Most/least worn items lists
    - Monthly wear trends line chart
    - Donation candidates panel
```
