# MyMarket -- UI/UX Design Prompts

**Tagline:** Buy and sell, human to human
**Icon:** 🏪 | **Accent:** #14B8A6 | **Tier:** Free | **Storage:** Supabase + SQLite cache
**Bottom Tabs:** Home | Browse | Sell | Messages | Profile
**Total Screens:** 17 mobile + 1 web = 18

---

## Prompt 1 -- Mobile Screens 1-12

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyMarket
Platform: iOS (React Native / Expo)
Accent color: #14B8A6
Bottom tab bar: Home | Browse | Sell | Messages | Profile

Design 12 mobile screens:

1. HOME (index.tsx)
- Bottom tab bar with Home tab active, #14B8A6 accent highlight
- Recent listings carousel at top: horizontal scroll of listing cards with cover photo, price badge, condition pill
- Category grid below: 7 categories in 2-column grid (Electronics, Clothing, Home, Sports, Books, Auto, Services)
  - Each category: icon, name, listing count badge
  - Glass fill cards with rgba(255,255,255,0.04) background
- Watchlist preview section: "Your Watchlist" header, 3 listing cards in horizontal scroll
  - Price change indicator: green arrow down or red arrow up if price changed
- "See All" link per section in #14B8A6

2. BROWSE (browse.tsx)
- Bottom tab bar with Browse tab active
- Search bar at top: magnifying glass icon, #1A1A24 background, rgba(255,255,255,0.10) border
- Filter bar below search: horizontal scroll of filter chips
  - Category dropdown
  - Price range (Min-Max)
  - Location radius slider (1mi-50mi)
  - Condition (New/Like New/Good/Fair/Poor)
- Sort dropdown top-right: Newest | Price Low-High | Price High-Low | Distance
- Listing grid: 2-column layout
  - Each card: cover photo, title (1 line), price (bold, #F0F0F5), condition badge, location distance
  - Heart icon overlay on photo for watchlist toggle
- Pull-to-refresh, infinite scroll with skeleton loading

3. LISTING DETAIL ([id].tsx)
- Full-screen scrollable
- Photo gallery at top: swipeable carousel, page dots indicator, full-screen zoom on tap
- Price: large, bold, #F0F0F5
- Condition badge: pill with color coding (New = #30D158, Like New = #14B8A6, Good = #A78BFA, Fair = #FFD60A, Poor = #FF453A)
- Title (bold), description (rgba(240,240,245,0.65))
- Seller info card on #12121A surface:
  - Avatar, seller name, star rating (1-5), review count
  - Verification tier badge (unverified/basic/verified/trusted/top_seller) with tier-specific color
  - "View Profile" link
- Action buttons row:
  - "Message Seller" button (outlined, #14B8A6)
  - "Make Offer" button (filled, #14B8A6)
- Details section: category, posted date, location, listing type
- Share button and report button in nav bar overflow

4. CREATE LISTING (sell.tsx)
- Bottom tab bar with Sell tab active (or full-screen modal)
- Listing type selector at top: 6 types as selectable pills
  - Sell | Trade | Free | Wanted | Service Offer | Service Request
  - #14B8A6 fill when selected
- Photo upload section: grid of up to 10 photo slots, first slot large (cover photo)
  - Camera icon for new photo, + icon for add from library
  - Drag-to-reorder photos
- Form fields on #12121A surface:
  - Title input
  - Description text area
  - Price input (currency formatted, disabled for "Free" type)
  - Condition selector: 5 options as radio buttons
  - Category dropdown
  - Location: auto-detect or manual entry
- "Post Listing" button at bottom, #14B8A6 fill

5. WATCHLIST (watchlist.tsx)
- Nav bar: back arrow, "Watchlist" title
- Listing list with cloud sync status indicator (synced/pending)
- Each card on #12121A surface:
  - Thumbnail photo, title, current price
  - Price change indicator: green pill "Price dropped $X" or red pill "Price increased $X"
  - Seller name, condition badge
  - Swipe-to-remove
- Empty state: heart icon, "Save listings to your watchlist"
- Sort options: Date Added | Price | Recently Updated

6. MESSAGES (messages.tsx)
- Bottom tab bar with Messages tab active
- Conversation list on #0A0A0F background
- Each conversation row on #12121A surface:
  - Listing thumbnail (small, square, left side)
  - Other party name (bold if unread)
  - Last message preview (1 line, rgba(240,240,245,0.65))
  - Timestamp (right-aligned)
  - Unread badge (circle with count, #14B8A6)
- E2E encryption indicator: lock icon in nav bar with "Encrypted" label
- Empty state: chat bubble icon, "No messages yet"

7. CONVERSATION (conversation/[id].tsx)
- Nav bar: back arrow, other party name, listing info mini-bar (thumbnail + title)
- Chat view on #0A0A0F background:
  - Sent messages: right-aligned bubbles, #14B8A6 fill, white text
  - Received messages: left-aligned bubbles, #1A1A24 fill, #F0F0F5 text
  - Photo messages: inline image with tap-to-expand
  - Offer messages: special card format showing offer amount, accept/decline/counter buttons
- Safety number verification: shield icon in nav bar, tap to verify
- Input bar fixed at bottom: text field, attachment button (camera icon), send button (#14B8A6)
- Typing indicator animation (three dots)

8. PROFILE (profile.tsx)
- Bottom tab bar with Profile tab active
- Profile header: avatar, display name, join date
- Rating display: star rating (1-5) with count, #14B8A6 stars
- Verification tier badge: shield icon with tier name and color
  - Unverified (gray), Basic (blue), Verified (#14B8A6), Trusted (#A78BFA), Top Seller (#FFD60A)
- Stats row: active listings, completed sales, completed purchases
- Section cards on #12121A surface:
  - "Active Listings" -- count, chevron to list
  - "Reviews" -- star average, chevron
  - "Offers" -- pending count badge, chevron
  - "Settings" -- gear icon, chevron

9. REVIEWS (reviews.tsx)
- Nav bar: back arrow, "Reviews" title
- Overall rating header: large star average, total review count, star distribution bar chart (5 bars)
- Tab toggle: "As Seller" | "As Buyer"
- Review list: each card on #12121A surface
  - Reviewer avatar, name, date
  - Star rating (1-5, #14B8A6 filled stars)
  - Review text
  - Transaction reference: listing title link
- Empty state per tab if no reviews

10. OFFERS (offers.tsx)
- Nav bar: back arrow, "Offers" title
- Tab toggle: "Incoming" | "Outgoing"
- Offer cards on #12121A surface:
  - Listing thumbnail, listing title
  - Offer amount (bold, #F0F0F5)
  - Original price shown for comparison (strikethrough, rgba(240,240,245,0.65))
  - Offer status badge: Pending (#FFD60A), Accepted (#30D158), Declined (#FF453A), Countered (#A78BFA), Expired (gray)
  - Expiration timer for pending offers (countdown)
- Action buttons per offer:
  - Incoming: Accept (#30D158), Decline (#FF453A), Counter (#14B8A6)
  - Outgoing: Cancel (outlined), Edit (if pending)
- Counter-offer flow: price input modal with "Send Counter" button

11. TRACKING (tracking.tsx)
- Nav bar: back arrow, "Tracking" title
- Tracking number input at top: text field, "Track" button (#14B8A6)
- Carrier auto-detection from tracking number format
- 6 supported carriers shown as icon row: USPS, UPS, FedEx, DHL, Amazon, Other
- Active tracking cards on #12121A surface:
  - Listing title, carrier logo, tracking number
  - Status timeline (vertical): ordered/shipped/in-transit/out-for-delivery/delivered
  - Current status highlighted with #14B8A6 dot, future steps grayed
  - Estimated delivery date
  - Last update timestamp
- Multiple active trackings listed vertically

12. DISPUTES (disputes.tsx)
- Nav bar: back arrow, "Disputes" title
- Dispute list: each card on #12121A surface
  - Listing thumbnail, title
  - Dispute status badge with color:
    - Open (#FFD60A), Seller Response (#A78BFA), Buyer Review (#14B8A6), Mediation (#FF9F0A), Resolved (#30D158), Escalated (#FF453A), Closed (gray)
  - Filed date, last update
- 7-state dispute timeline visualization (horizontal progress dots)
- Auto-timeout indicator: "Seller has 48h to respond" countdown
- Refund calculation card: original amount, proposed refund, fee breakdown
- Action buttons based on state: "Respond", "Accept Resolution", "Escalate"
- Resolution summary card when resolved
```

---

## Prompt 2 -- Mobile Screens 13-17 + Web Page

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyMarket
Accent color: #14B8A6

Design 6 screens (5 mobile + 1 web):

--- MOBILE (iOS, React Native / Expo) ---

1. SAVED SEARCHES (saved-searches.tsx)
- Nav bar: back arrow, "Saved Searches" title
- Saved search list: each card on #12121A surface
  - Search criteria summary: query text, category, price range, location
  - Match notification toggle switch (#14B8A6 when on)
  - Recent matches count badge (#14B8A6 pill)
  - Last checked timestamp in rgba(240,240,245,0.65)
- Tap card to run the search with saved criteria
- Swipe-to-delete saved search
- "Save Current Search" option accessible from browse screen
- Empty state: magnifying glass icon, "Save searches to get notified of new matches"

2. SERVICES (services.tsx)
- Nav bar: back arrow, "Services" title
- Service provider cards on #12121A surface:
  - Provider avatar, name, star rating, verification badge
  - Service category (Cleaning, Repair, Tutoring, etc.)
  - Portfolio thumbnails (horizontal scroll of 3-4 images)
  - Service area: location + radius text
  - Availability indicator: green dot "Available" or gray "Busy"
- Filter bar: category dropdown, distance slider, availability toggle
- "Book Service" button per card (#14B8A6)
- Provider detail view on tap: full portfolio, service list with prices, reviews, booking calendar

3. REPORT (report.tsx)
- Full-screen modal: "Cancel" (left), "Submit" (right, #FF453A)
- Report target info at top: listing photo/title or user avatar/name
- Reason picker: radio button list on #12121A surface
  - Prohibited item, Scam/fraud, Counterfeit, Harassment, Spam, Inappropriate content, Other
- Description text area: "Provide additional details..." placeholder
- Evidence section: attach screenshots (up to 3 photos)
- "Block User" toggle at bottom with explanation text
- Confirmation: "Report submitted" success state with #30D158 checkmark

4. SETTINGS (settings.tsx)
- Nav bar: back arrow, "Settings" title
- Settings sections on #12121A surface cards:
  - Privacy Preferences:
    - Profile visibility toggle (Public/Private)
    - Location precision (Exact/Approximate/Hidden)
    - Online status toggle
  - Payment Settings:
    - Stripe Connect status indicator (Connected/Not Connected)
    - "Connect Stripe" button (#14B8A6) or "Manage Account" link
    - Default currency selector
  - Notifications:
    - New messages toggle
    - Price drops on watchlist toggle
    - Offer updates toggle
    - Saved search matches toggle
  - Blocked Users: count, tap to manage list
- Danger zone: "Delete Account" in #FF453A

5. CHECKOUT/PAYMENT (checkout.tsx)
- Full-screen flow, nav bar: back arrow, "Checkout" title, lock icon (secure indicator)
- Order summary card on #12121A surface:
  - Listing photo, title, condition
  - Item price (large, bold)
  - Fee breakdown:
    - Subtotal
    - Platform fee (percentage shown)
    - Shipping estimate (if applicable)
    - Total (bold, #F0F0F5)
- Stripe Connect payment section:
  - Saved payment methods list (card icons, last 4 digits)
  - "Add Payment Method" button
  - Apple Pay / Google Pay button if available
- Escrow notice: info card explaining buyer protection -- "Payment held securely until delivery confirmed"
- Shipping address section: saved address or input form
- "Pay Now" button (#14B8A6, full width, prominent)
- Processing state: spinner with "Processing payment..."
- Success state: checkmark animation, order confirmation number, "Track Order" button

--- WEB (Next.js 15, desktop layout with persistent MyLife hub sidebar) ---

6. HUB (/market)
- Content area, max-width 1080px centered
- Hero section: "Buy and Sell, Human to Human" heading, search bar (prominent, centered)
- Category grid: 7 categories as large clickable cards with icons
- Recent listings section: 4-column grid of listing cards
  - Each card: photo, title, price, condition badge, location
  - Hover state: subtle elevation + border glow
- Watchlist preview: horizontal row of 4 watchlisted items
- Quick actions: "Create Listing" button (#14B8A6), "Browse All" link
- Note: backend is 90% complete -- this is the primary UI gap to fill
- Responsive: collapses to 2-column on tablet, 1-column on mobile web
```
